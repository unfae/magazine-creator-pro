import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { renderId } = req.query;

  if (!renderId || typeof renderId !== 'string') {
    return res.status(400).json({ error: 'Missing renderId' });
  }

  const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;

  const response = await fetch(
    `https://api.shotstack.io/v1/render/${encodeURIComponent(renderId)}`,
    { headers: { 'x-api-key': SHOTSTACK_API_KEY } }
  );

  const data = await response.json();
  if (!response.ok) {
    return res.status(400).json(data);
  }

  const status: string = data?.response?.status ?? '';
  const videoUrl: string | null = data?.response?.url ?? null;

  // ── Update video_exports log when render reaches a terminal state ──────────
  if (status === 'done' || status === 'failed') {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase
        .from('video_exports')
        .update({
          status: status === 'done' ? 'done' : 'failed',
          video_url: status === 'done' ? videoUrl : null,
          error_message: status === 'failed'
            ? (data?.response?.error ?? 'Render failed')
            : null,
        })
        .eq('shotstack_render_id', renderId);
    } catch (err) {
      // non-fatal — don't block the response
      console.error('video_exports status update failed:', err);
    }
  }

  return res.status(200).json(data);
}