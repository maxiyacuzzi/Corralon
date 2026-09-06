import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DeliveryNoteItem {
  product_id: string
  quantity: number
  unit_price: number
}

serve(async (req) => {
  const { client_id, stockpile_id, items } = await req.json() as {
    client_id: string
    stockpile_id: string | null
    items: DeliveryNoteItem[]
  }
  const authHeader = req.headers.get('Authorization')!

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

  // Si el remito es contra un acopio, descontar el saldo primero
  if (stockpile_id) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    const { error: withdrawError } = await supabase.functions.invoke('withdraw-stockpile', {
      body: { stockpile_id, quantity: totalQuantity },
    })
    if (withdrawError) {
      return new Response(JSON.stringify({ error: withdrawError.message }), { status: 400 })
    }
  } else {
    // Venta directa: descontar cada producto del stock general
    for (const item of items) {
      await supabase.functions.invoke('register-stock-movement', {
        body: {
          product_id: item.product_id,
          type: 'sale_out',
          quantity: -item.quantity,
          reference_id: null,
        },
      })
    }
  }

  const { data: deliveryNote, error: insertError } = await supabase
    .from('delivery_notes')
    .insert({
      client_id,
      stockpile_id,
      items,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ success: true, delivery_note: deliveryNote }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
