import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { stockpile_id, quantity } = await req.json()
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

  const { data: stockpile } = await supabase
    .from('stockpiles')
    .select('product_id, total_reserved, total_withdrawn')
    .eq('id', stockpile_id)
    .single()

  if (!stockpile) {
    return new Response(JSON.stringify({ error: 'Acopio no encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const remaining = stockpile.total_reserved - stockpile.total_withdrawn
  if (quantity > remaining) {
    return new Response(
      JSON.stringify({ error: `Saldo de acopio insuficiente. Disponible: ${remaining}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Actualizar acopio
  await supabase
    .from('stockpiles')
    .update({ total_withdrawn: stockpile.total_withdrawn + quantity })
    .eq('id', stockpile_id)

  // Descontar del stock general
  await supabase.functions.invoke('register-stock-movement', {
    body: {
      product_id: stockpile.product_id,
      type: 'stockpile_out',
      quantity: -quantity,
      reference_id: stockpile_id,
    },
  })

  return new Response(JSON.stringify({ success: true, remaining: remaining - quantity }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
