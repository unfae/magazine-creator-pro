import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    
    // ✅ OFFICIAL SANDBOX ENDPOINT from Shotstack docs
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    const clips = pages.map((src: string, i: number) => ({
      asset: { type: 'image', src },
      start: i * 3,
      length: 3,
      transition: { in: 'fade', out: 'fade' }
    }));

    const payload = {
      timeline: {
        tracks: [{ clips }],
        background: '#000000'
      },
      output: {
        format: 'mp4',
        resolution: 'sd'
      }
    };

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.text();
    
    if (!response.ok) {
      console.error('SHOTSTACK ERROR:', data);
      return res.status(500).json({ error: data });
    }

    const result = JSON.parse(data);
    const renderId = result.response.id;  // Shotstack wraps in "response"

    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      render_id: renderId
    });

    res.status(202).json({
      success: true,
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
