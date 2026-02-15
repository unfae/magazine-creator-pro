import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('Pages received:', pages.length);

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'Invalid pages' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ error: 'SHOTSTACK_API_KEY missing' });
    }

    // ✅ CORRECT ENDPOINT: /render (sandbox auto-detected by API key)
    const SHOTSTACK_URL = `https://api.shotstack.io/sandbox/render`;

    // Simple 3s-per-page slideshow
    const clips = pages.map((src: string, i: number) => ({
      asset: { type: 'image', src },
      start: i * 3,
      length: 3,
      transition: { in: 'fade', out: 'fade' }
    }));

    const payload = {
      timeline: {
        tracks: [{ clips }],
        background: '#000'
      },
      output: { format: 'mp4', resolution: 'sd' },
      name: `${templateName}-${userId.slice(-6)}`
    };

    console.log('Payload size:', JSON.stringify(payload).length);

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.text(); // Raw text first
    console.log('Raw Shotstack response:', data.substring(0, 500));

    if (!response.ok) {
      return res.status(500).json({ 
        error: `Shotstack ${response.status}: ${data.substring(0, 200)}`
      });
    }

    const shotstackResponse = JSON.parse(data);
    const renderId = shotstackResponse.id;

    // Save to DB
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      shotstack_render_id: renderId,
      status_url: `https://api.shotstack.io/sandbox/render/${renderId}`
    });

    res.status(202).json({
      success: true,
      renderId,
      statusUrl: `https://api.shotstack.io/sandbox/render/${renderId}`
    });

  } catch (error: any) {
    console.error('Export-video full error:', error);
    res.status(500).json({ error: error.message });
  }
}
