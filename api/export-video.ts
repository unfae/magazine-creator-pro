import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    if (!pages || !Array.isArray(pages)) {
      return res.status(400).json({ error: 'Invalid pages data' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Shotstack Sandbox API endpoint
    const SHOTSTACK_URL = 'https://api.shotstack.io/sandbox/render';
    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;

    // Build video timeline: 3s per page with fade transitions
    const pageDuration = 3;
    const clips = pages.map((imageUrl: string, index: number) => ({
      asset: { type: 'image', src: imageUrl },
      start: index * pageDuration,
      length: pageDuration,
      transition: { in: 'fade', out: 'fade' },
    }));

    const payload = {
      name: `magazine-${templateName}-${userId}-${Date.now()}`,
      timeline: {
        background: '#000000',
        tracks: [{ clips }],
      },
      output: {
        format: 'mp4',
        resolution: 'sd', // Cheap & fast
      },
    };

    // Direct HTTP call to Shotstack (no SDK needed!)
    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shotstack API error: ${error}`);
    }

    const data = await response.json();
    const renderId = data.id;

    // Log to Supabase
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId,
      shotstack_render_id: renderId,
      status_url: `https://api.shotstack.io/sandbox/render/${renderId}`,
      status: 'queued',
    });

    res.status(202).json({
      success: true,
      message: 'Video rendering queued (3-10s)',
      renderId,
      statusUrl: `https://api.shotstack.io/sandbox/render/${renderId}`,
    });
  } catch (err: any) {
    console.error('Video export error:', err);
    res.status(500).json({ error: 'Video export failed' });
  }
}
