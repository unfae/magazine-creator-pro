// pages/api/export-images.ts (Vercel)

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, template_id } = req.body;

  if (!user_id || !template_id) {
    return res.status(400).json({ error: 'Missing user_id or template_id' });
  }

  // 1. Find an active payment for this user + template
  const { data: payment, error: payErr } = await supabase
    .from('template_payments')
    .select('*')
    .eq('user_id', user_id)
    .eq('template_id', template_id)
    .eq('status', 'success')
    .maybeSingle();

  if (payErr || !payment) {
    return res.status(402).json({ error: 'Payment required or invalid' });
  }

  const maxExports = payment.max_exports ?? 7;

  if (payment.image_batch_exports_used >= maxExports) {
    return res.status(402).json({ error: 'Image batch export limit reached. Please pay again.' });
  }

  // 2. Increment image batch exports
  await supabase
    .from('template_payments')
    .update({
      image_batch_exports_used: payment.image_batch_exports_used + 1,
    })
    .eq('id', payment.id);

  // 3. Dummy image URLs (you’ll plug in your real image logic)
  const imageUrls = [
    'https://example.com/page-1.png',
    'https://example.com/page-2.png',
    'https://example.com/page-3.png',
  ];

  res.status(200).json({
    success: true,
    images: imageUrls,
    remainingImageBatchExports: maxExports - (payment.image_batch_exports_used + 1),
  });
}
