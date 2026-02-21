import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('📱 Magazine export:', {
      pageCount: pages?.length || 0,
      firstPage: pages?.[0]?.substring(0, 50) + '...'
    });

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ error: 'SHOTSTACK_API_KEY missing' });
    }

    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    // ✅ MAGAZINE PORTAIT SPECS (1000x1416)
    const MAGAZINE_WIDTH = 1000;
    const MAGAZINE_HEIGHT = 1416;
    const PAGE_DURATION = 4; // seconds per page

    const clips = pages.slice(0, 12).map((src: string, index: number) => ({
      asset: {
        type: 'image',
        src: src.trim()
      },
      start: index * PAGE_DURATION,
      length: PAGE_DURATION,
      // ✅ PERFECT FIT (no stretch!)
      width: MAGAZINE_WIDTH,
      height: MAGAZINE_HEIGHT,
      position: 'center',
      fit: 'contain',
      // ✅ RUNWAY TRANSITIONS
      transition: {
        in: 'fade',
        out: 'fade'
      },
      effect: 'zoomInSlow' // Subtle movement
    }));

    const payload = {
      timeline: {
        soundtrack: null, // Silent (add music later)
        background: '#000000',
        tracks: [{
          clips: clips
        }]
      },
      output: {
        format: 'mp4',
        resolution: 'hd', // Crisp
        fps: 30
      }
    };

    console.log('🎬 Sending to Shotstack...');

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const shotstackData = await response.json();
    console.log('🎥 Shotstack result:', shotstackData);

    if (!response.ok || !shotstackData.success) {
      console.error('Shotstack errors:', shotstackData.response?.errors);
      return res.status(400).json({
        error: shotstackData.message || 'Validation failed',
        details: shotstackData.response?.errors
      });
    }

    const renderId = shotstackData.response.id;

    // Log for dashboard
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId || null,
      shotstack_render_id: renderId,
      status: 'queued',
      page_count: pages.length
    });

    res.status(202).json({
      success: true,
      message: `Rendering ${pages.length} magazine pages...`,
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`
    });

  } catch (error: any) {
    console.error('❌ Export error:', error);
    res.status(500).json({ error: error.message });
  }
}
