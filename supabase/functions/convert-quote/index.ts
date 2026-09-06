import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface QuoteItem {
  product_id: string
  quantity: number
  unit_price: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { quote_id, target } = await req.json() as { quote_id: string; target: 'stockpile' | 'sale' }
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

  const { data: quote } = await supabase
    .from('quotes')
    .select('client_id, items, status, discount_percent')
    .eq('id', quote_id)
    .single()

  if (!quote) {
    return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (quote.status !== 'approved') {
    return new Response(
      JSON.stringify({ error: 'Solo se pueden convertir presupuestos aprobados' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const items = quote.items as QuoteItem[]

  if (target === 'stockpile') {
    for (const item of items) {
      const { error } = await supabase.from('stockpiles').insert({
        client_id: quote.client_id,
        product_id: item.product_id,
        total_reserved: item.quantity,
        total_withdrawn: 0,
      })
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } else if (target === 'sale') {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const discount_percent = quote.discount_percent ?? 0
    const total_amount = subtotal * (1 - discount_percent / 100)

    const { error: saleError } = await supabase.functions.invoke('register-sale', {
      body: {
        client_id: quote.client_id,
        is_formal: false,
        payments: [{ method: 'cash', amount: total_amount, discount_percent }],
      },
    })
    if (saleError) {
      return new Response(JSON.stringify({ error: saleError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
  } else {
    return new Response(JSON.stringify({ error: 'Destino de conversión inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ status: 'converted' })
    .eq('id', quote_id)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
