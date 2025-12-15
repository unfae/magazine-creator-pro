import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('PAYSTACK_SECRET_KEY')),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['verify']
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    Uint8Array.from(Buffer.from(signature!, 'hex')),
    new TextEncoder().encode(body)
  )

  if (!valid) return new Response('Invalid signature', { status: 400 })

  const event = JSON.parse(body)

  if (event.event === 'charge.success') {
    const reference = event.data.reference

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase
      .from('template_payments')
      .update({ status: 'success' })
      .eq('reference', reference)
  }

  return new Response('ok')
})
