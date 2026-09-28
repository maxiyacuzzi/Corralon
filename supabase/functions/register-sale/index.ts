import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CheckDetails {
  bank: string
  check_number: string
  holder_name?: string
  holder_tax_id?: string
  emission_date?: string
  due_date: string
  is_deferred?: boolean
}

interface PaymentInput {
  method: 'cash' | 'transfer' | 'checks'
  amount: number // ya con descuento aplicado
  covered_amount?: number // parte del total de la venta que cubre esta línea (antes del descuento)
  discount_percent?: number
  check?: CheckDetails | null
}

interface SaleItemInput {
  product_id: string
  quantity: number
  unit_price: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { client_id, delivery_note_ids, items, payments, is_formal } = await req.json() as {
    client_id: string
    delivery_note_ids?: string[]
    items?: SaleItemInput[]
    payments: PaymentInput[]
    is_formal?: boolean
  }
  const authHeader = req.headers.get('Authorization')!

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!payments || payments.length === 0) {
    return new Response(JSON.stringify({ error: 'La venta necesita al menos una forma de pago' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const total_amount = payments.reduce((sum, p) => sum + p.amount, 0)
  const covered_amount = payments.reduce((sum, p) => sum + (p.covered_amount ?? p.amount), 0)

  // Total de la venta: productos cargados directo + remitos a precio ACTUAL (el remito no guarda precio)
  let sale_total = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  if (delivery_note_ids && delivery_note_ids.length > 0) {
    const { data: notes } = await supabase.from('delivery_notes').select('items').in('id', delivery_note_ids)
    const noteItems = (notes ?? []).flatMap((note) => (note.items ?? []) as { product_id: string; quantity: number }[])
    const productIds = [...new Set(noteItems.map((item) => item.product_id))]
    const { data: products } = productIds.length > 0
      ? await supabase.from('products').select('id, price').in('id', productIds)
      : { data: [] }
    const priceById = Object.fromEntries((products ?? []).map((p) => [p.id, Number(p.price)]))
    sale_total += noteItems.reduce((sum, item) => sum + item.quantity * (priceById[item.product_id] ?? 0), 0)
  }

  // Lo que no se cubrió va a la cuenta corriente (o queda a favor si entregó de más).
  // Una venta sin productos ni remitos no tiene total contra el cual comparar: no mueve la cuenta.
  const account_balance_change = sale_total > 0 ? Math.round((sale_total - covered_amount) * 100) / 100 : 0
  const distinctMethods = [...new Set(payments.map((p) => p.method))]
  const payment_method = distinctMethods.length === 1 ? distinctMethods[0] : 'mixed'
  const discount_percent = payments.length === 1 ? (payments[0].discount_percent ?? 0) : 0

  // Registrar la venta
  const { data: sale, error: insertError } = await supabase
    .from('sales')
    .insert({
      client_id,
      items: items && items.length > 0 ? items : null,
      total_amount,
      payment_method,
      is_formal: is_formal ?? false,
      discount_percent,
      account_balance_change,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Descontar del stock los productos cargados directo en la venta (sin remito previo)
  if (items && items.length > 0) {
    for (const item of items) {
      const { error: movementError } = await supabase.functions.invoke('register-stock-movement', {
        body: {
          product_id: item.product_id,
          type: 'sale_out',
          quantity: -item.quantity,
          reference_id: sale.id,
        },
      })
      if (movementError) {
        return new Response(JSON.stringify({ error: movementError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  // Registrar el detalle de formas de pago
  const { error: paymentsError } = await supabase.from('sale_payments').insert(
    payments.map((p) => ({
      sale_id: sale.id,
      method: p.method,
      amount: p.amount,
      discount_percent: p.discount_percent ?? 0,
    }))
  )

  if (paymentsError) {
    return new Response(JSON.stringify({ error: paymentsError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Actualizar cuenta corriente del cliente con lo que quedó debiendo (o a favor)
  const { data: client } = await supabase
    .from('clients')
    .select('account_balance')
    .eq('id', client_id)
    .single()

  const newBalance = Number(client?.account_balance ?? 0) + account_balance_change

  if (account_balance_change !== 0) {
    await supabase.from('clients').update({ account_balance: newBalance }).eq('id', client_id)
  }

  // Vincular los remitos que esta venta factura, si los hay
  if (delivery_note_ids && delivery_note_ids.length > 0) {
    const { error: linkError } = await supabase.from('sale_delivery_notes').insert(
      delivery_note_ids.map((delivery_note_id) => ({ sale_id: sale.id, delivery_note_id }))
    )
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Por cada pago en Valores, registrar el cheque recibido
  for (const payment of payments) {
    if (payment.method === 'checks' && payment.check) {
      const { error: checkError } = await supabase.from('checks').insert({
        client_id,
        sale_id: sale.id,
        check_number: payment.check.check_number,
        bank: payment.check.bank,
        holder_name: payment.check.holder_name || null,
        holder_tax_id: payment.check.holder_tax_id || null,
        emission_date: payment.check.emission_date || null,
        amount: payment.amount,
        due_date: payment.check.due_date,
        is_deferred: payment.check.is_deferred ?? false,
        status: 'in_wallet',
        created_by: user.id,
      })
      if (checkError) {
        return new Response(JSON.stringify({ error: checkError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  return new Response(JSON.stringify({ success: true, sale, new_balance: newBalance }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
