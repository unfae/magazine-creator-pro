import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { pages, userId, templateName } = req.body;
    
    console.log('Images:', pages.length, pages[0]);

    if (!pages?.length) return res.status(400).json({ error: 'No images' });

    const API_KEY = process.env.SHOTSTACK_API_KEY!;
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    // Validate 1st image
    const headRes = await fetch(pages[0], { method: 'HEAD' });
    if (!headRes.ok) {
      return res.status(400).json({ error: `Image 404/403: ${pages[0]}` });
    }

    const clips = pages.slice(0, 3).map((src, i) => ({
      asset: { type: "image", src: src.trim() },
      start: i * 4,
      length: 4,
      fit: "cover",
      position: "center"
    }));

    const payload = {
      timeline: { tracks: [{ clips }] },
      output: { format: "mp4", resolution: "sd", fps: 30 }
    };

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('RESULT:', result);

    if (!result.success) {
      return res.status(400).json({ error: result.message, details: result.response?.errors });
    }

    const renderId = result.response.id;

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      render_id: renderId
    });

    res.json({ success: true, renderId, statusUrl: `https://api.shotstack.io/stage/render/${renderId}` });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
