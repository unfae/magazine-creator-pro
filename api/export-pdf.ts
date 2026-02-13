// pages/api/export-pdf.ts (Vercel)

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // admin key for writes
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

  if (payment.pdf_exports_used >= maxExports) {
    return res.status(402).json({ error: 'PDF export limit reached. Please pay again.' });
  }

  // 2. Increment PDF exports (hot count)
  await supabase
    .from('template_payments')
    .update({
      pdf_exports_used: payment.pdf_exports_used + 1,
    })
    .eq('id', payment.id);

  // 3. Generate PDF (simplified from your current export PDF logic)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [1000, 1415],
    compress: true,
  });

  // Dummy pages for example; you’ll plug in your real pages
  for (let i = 0; i < 5; i++) {
    pdf.addPage();
    pdf.text(`Page ${i + 1} of your magazine`, 10, 20);
  }

  // 4. Stream PDF back
  const pdfBlob = new Blob([pdf.output('blob')], { type: 'application/pdf' });
  const pdfUrl = URL.createObjectURL(pdfBlob);

  res.status(200).json({
    success: true,
    downloadUrl: pdfUrl,
    remainingPdfExports: maxExports - (payment.pdf_exports_used + 1),
  });
}
