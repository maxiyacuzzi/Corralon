import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CheckDetails {
  bank: string
  check_number: string
  due_date: string
  is_deferred?: boolean
}

interface PaymentInput {
  method: 'cash' | 'transfer' | 'checks'
  amount: number
  discount_percent?: number
  check?: CheckDetails | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { client_id, delivery_note_ids, payments, is_formal } = await req.json() as {
    client_id: string
    delivery_note_ids?: string[]
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
  const distinctMethods = [...new Set(payments.map((p) => p.method))]
  const payment_method = distinctMethods.length === 1 ? distinctMethods[0] : 'mixed'
  const discount_percent = payments.length === 1 ? (payments[0].discount_percent ?? 0) : 0

  // Registrar la venta
  const { data: sale, error: insertError } = await supabase
    .from('sales')
    .insert({
      client_id,
      total_amount,
      payment_method,
      is_formal: is_formal ?? false,
      discount_percent,
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

  // Actualizar cuenta corriente del cliente
  const { data: client } = await supabase
    .from('clients')
    .select('account_balance')
    .eq('id', client_id)
    .single()

  const newBalance = (client?.account_balance ?? 0) + total_amount

  await supabase.from('clients').update({ account_balance: newBalance }).eq('id', client_id)

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
