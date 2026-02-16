import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('Pages:', pages.length);

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ error: 'Missing SHOTSTACK_API_KEY' });
    }

    // ✅ SHOTSTACK SANDBOX ENDPOINT
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    // VALIDATED clips - explicit numbers, max 10 pages
    const clips = pages.slice(0, 10).map((src: string, index: number) => ({
      asset: {
        type: 'image',
        src: src  // Your public image URLs
      },
      start: index * 3,  // 0, 3, 6, 9...
      length: 3,
      transition: {
        "in": "fade",
        "out": "fade"
      }
    }));

    const payload = {
      timeline: {
        tracks: [{
          clips: clips
        }],
        background: '#000000'
      },
      output: {
        format: 'mp4',
        resolution: 'sd'
      },
      merge: []  // No merging needed
    };

    console.log('Sending payload to Shotstack...');

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const shotstackData = await response.json();

    console.log('Shotstack response:', shotstackData);

    if (!response.ok || !shotstackData.success) {
      return res.status(400).json({ 
        error: shotstackData.message || 'Shotstack validation failed',
        details: shotstackData.response?.errors || null
      });
    }

    const renderId = shotstackData.response.id;

    // Log to Supabase
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId || null,
      shotstack_render_id: renderId,
      status: 'queued'
    });

    res.status(202).json({
      success: true,
      message: 'Video queued! Polling status...',
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`
    });

  } catch (error: any) {
    console.error('Export video error:', error);
    res.status(500).json({ error: error.message });
  }
}
