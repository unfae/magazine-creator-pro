import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('Export video - pages:', pages.length);

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ error: 'Missing API key' });
    }

    // ✅ CORRECT ENDPOINT: Just /render (sandbox auto-detected)
    const SHOTSTACK_URL = 'https://api.shotstack.io/sandbox/render';

    const clips = pages.slice(0, 10).map((src: string, i: number) => ({  // Max 10 for testing
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
      },
      name: `${templateName}-${Date.now()}`
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
    console.log('SHOTSTACK FULL RESPONSE:', data);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Shotstack ${response.status}: ${data}` 
      });
    }

    const result = JSON.parse(data);
    const renderId = result.id;

    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      render_id: renderId,
      status: 'queued'
    });

    res.status(202).json({
      success: true,
      renderId,
      statusUrl: `https://api.shotstack.io/sandbox/render/${renderId}`
    });

  } catch (error: any) {
    console.error('API ERROR:', error);
    res.status(500).json({ error: error.toString() });
  }
}
