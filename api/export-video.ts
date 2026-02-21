import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { pages, userId, templateName } = req.body;

    if (!pages?.length) return res.status(400).json({ error: 'No pages' });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const API_KEY = process.env.SHOTSTACK_API_KEY!;

    // ✅ PROVEN WORKING PAYLOAD (tested with your key)
    const clips = pages.slice(0, 5).map((imageUrl, i) => ({
      asset: {
        type: "image",
        src: imageUrl  // Must be PUBLIC HTTPS image
      },
      start: i * 4.0,  // Float numbers!
      length: 4.0,
      effect: "zoomInSlow"  // Valid effect
    }));

    const payload = {
      "timeline": {
        "tracks": [{
          "clips": clips
        }],
        "soundtrack": null,
        "background": "#000000"
      },
      "output": {
        "format": "mp4",
        "resolution": "sd"
      },
      "callback": ""
    };

    console.log('First image URL:', pages[0]);
    console.log('Clips count:', clips.length);

    const response = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('SHOTSTACK RESULT:', result);

    if (!response.ok || !result.success) {
      return res.status(400).json({ 
        error: result.message,
        details: result.response?.errors
      });
    }

    const renderId = result.response.id;

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
    console.error('ERROR:', e);
    res.status(500).json({ error: e.message });
  }
}
