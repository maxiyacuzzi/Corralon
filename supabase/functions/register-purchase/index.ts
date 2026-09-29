import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PurchaseItemInput {
  product_id: string
  quantity: number
  unit: 'bulk' | 'retail'
  unit_cost: number
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { supplier_id, purchase_date, payment_method, items, amount_paid, notes } = await req.json() as {
    supplier_id: string
    purchase_date: string
    payment_method: 'cash' | 'transfer' | 'checks'
    items: PurchaseItemInput[]
    amount_paid?: number // si no viene, se paga el total
    notes?: string | null
  }
  const authHeader = req.headers.get('Authorization')!

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'No autorizado' }, 401)

  const validItems = (items ?? []).filter((item) => item.product_id && item.quantity > 0)
  if (validItems.length === 0) {
    return jsonResponse({ error: 'La compra necesita al menos un producto con cantidad' }, 400)
  }

  // La conversión a retail_unit se hace acá con el factor guardado, no se confía en el cliente
  const productIds = [...new Set(validItems.map((item) => item.product_id))]
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, conversion_factor')
    .in('id', productIds)
  if (productsError) return jsonResponse({ error: productsError.message }, 400)
  const factorById = Object.fromEntries((products ?? []).map((p) => [p.id, Number(p.conversion_factor)]))

  const storedItems = validItems.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unit_cost,
    retail_quantity: item.unit === 'bulk' ? item.quantity * (factorById[item.product_id] ?? 1) : item.quantity,
  }))
  const total_amount = storedItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)
  const paid = amount_paid ?? total_amount
  if (paid < 0) return jsonResponse({ error: 'El monto pagado no puede ser negativo' }, 400)
  // Lo que no se pagó queda en la cuenta corriente con el proveedor (lo suma un trigger en la base)
  const account_balance_change = Math.round((total_amount - paid) * 100) / 100

  const { data: purchase, error: insertError } = await supabase
    .from('purchases')
    .insert({
      supplier_id,
      purchase_date,
      payment_method,
      items: storedItems,
      total_amount,
      amount_paid: paid,
      account_balance_change,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single()
  if (insertError) return jsonResponse({ error: insertError.message }, 400)

  // Sumar al stock cada producto comprado
  for (const item of storedItems) {
    const { error: movementError } = await supabase.functions.invoke('register-stock-movement', {
      body: {
        product_id: item.product_id,
        type: 'purchase_in',
        quantity: item.retail_quantity,
        reference_id: purchase.id,
      },
    })
    if (movementError) return jsonResponse({ error: movementError.message }, 400)
  }

  return jsonResponse({ success: true, purchase })
})
