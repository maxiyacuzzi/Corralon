import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { product_id, type, quantity, reference_id } = await req.json()
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

  // Registrar el movimiento
  const { error: insertError } = await supabase.from('stock_movements').insert({
    product_id,
    type,
    quantity,
    reference_id,
    created_by: user.id,
  })

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Actualizar stock actual del producto
  const { data: product } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', product_id)
    .single()

  const newStock = (product?.current_stock ?? 0) + quantity

  await supabase.from('products').update({ current_stock: newStock }).eq('id', product_id)

  return new Response(JSON.stringify({ success: true, new_stock: newStock }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
