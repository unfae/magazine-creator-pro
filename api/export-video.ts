import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { pages, userId, templateName } = req.body;

    if (!pages?.length) return res.status(400).json({ error: 'No pages' });

    // Test first image loads
    const testImg = new Image();
    testImg.src = pages[0];
    await new Promise(r => testImg.onload = r);

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const API_KEY = process.env.SHOTSTACK_API_KEY!;

    const clips = pages.slice(0, 8).map((src, i) => ({
      asset: { type: 'image', src },  // ✅ Public CORS image
      start: i * 3,                  // ✅ Number!
      length: 3,
      effect: 'fadeInFadeOut'        // ✅ Valid effect
    }));

    const payload = {
      timeline: {
        tracks: [{ clips }]
      },
      output: {
        format: 'mp4',
        resolution: 'sd'
      }
    };

    const response = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('Shotstack:', data);
      return res.status(400).json({ error: data.message || 'Validation failed' });
    }

    const renderId = data.response.id;

    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      render_id: renderId
    });

    res.json({
      success: true,
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
