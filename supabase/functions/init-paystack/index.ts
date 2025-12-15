import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

serve(async (req) => {
  const { templateId, amount } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const authHeader = req.headers.get('Authorization')!
  const { data: { user } } = await supabase.auth.getUser(authHeader)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const reference = crypto.randomUUID()

  // create pending payment
  await supabase.from('template_payments').insert({
    user_id: user.id,
    template_id: templateId,
    provider: 'paystack',
    reference,
    amount,
    currency: 'NGN',
    status: 'pending'
  })

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: user.email,
      amount: amount * 100,
      reference
    })
  })

  const data = await res.json()

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
