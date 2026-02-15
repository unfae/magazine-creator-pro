import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('Export video called with:', { pages: pages.length, userId, templateName }); // DEBUG

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty pages data' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ CORRECT Shotstack Sandbox endpoint + version
    const SHOTSTACK_URL = 'https://api.shotstack.io/sandbox/render';
    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;

    if (!SHOTSTACK_API_KEY) {
      console.error('Missing SHOTSTACK_API_KEY');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Build VALID timeline (simplified for magazine pages)
    const pageDuration = 3; // 3s per page
    const clips = pages.map((imageUrl: string, index: number) => ({
      asset: {
        type: 'image',
        src: imageUrl,
      },
      start: index * pageDuration,
      length: pageDuration,
      transition: {
        in: 'fade',
        out: 'fade',
      },
    }));

    const payload = {
      name: `magazine-${templateName}-${userId.slice(-8)}`,
      timeline: {
        soundtrack: null, // No audio
        background: '#000000',
        tracks: [{
          clips: clips,
        }],
      },
      output: {
        format: 'mp4',
        resolution: 'sd', // 720p - cheap
      },
    };

    console.log('Sending to Shotstack:', JSON.stringify(payload, null, 2)); // DEBUG

    // POST to Shotstack
    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const shotstackData = await response.json();
    console.log('Shotstack response:', shotstackData); // DEBUG

    if (!response.ok) {
      console.error('Shotstack error:', shotstackData);
      return res.status(500).json({ 
        error: `Shotstack API error: ${shotstackData.message || response.statusText}` 
      });
    }

    const renderId = shotstackData.id;

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
      message: 'Video queued successfully',
      renderId,
      statusUrl: `https://api.shotstack.io/sandbox/render/${renderId}`,
    });

  } catch (err: any) {
    console.error('Full export-video error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
