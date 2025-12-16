import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const allowedOrigins = new Set([
  'https://magzinemaker.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'null'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const headers = corsHeaders(req)

  // ✅ Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers })
  }

  try {
    const { templateId, amount } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ✅ IMPORTANT: on Edge Functions the header name is usually "authorization" (lowercase),
    // but .get() is case-insensitive; still handle missing safely.
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', ''); // ✅ important
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }


    const reference = crypto.randomUUID()

    // create pending payment
    const { error: insertErr } = await supabase.from('template_payments').insert({
      user_id: user.id,
      template_id: templateId,
      provider: 'paystack',
      reference,
      amount,
      currency: 'NGN',
      status: 'pending',
    })

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(Number(amount) * 100),
        reference,
      }),
    })

    const data = await res.json()

    // Pass through Paystack response, but keep CORS headers
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
