import { createClient } from '@supabase/supabase-js';  // ✅ MISSING IMPORT

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId } = req.body;

    console.log('📱 Video export:', pages.length, 'pages');

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    // Optional Supabase logging
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    // ✅ 413-SAFE: Max 8 pages, compact URLs
    const safePages = pages.slice(0, 8);

    const clips = safePages.map((src: string, index: number) => ({
      asset: {
        type: 'image',
        src: src.trim()
      },
      start: index * 4,
      length: 4,
      // ✅ MAGAZINE ASPECT (no stretch)
      width: 1000,
      height: 1416,
      position: 'center',
      fit: 'contain',
      // ✅ SMOOTH FADES
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
        resolution: 'sd',
        fps: 24
      }
    };

    console.log('🎬 Clips created:', clips.length);

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shotstack 400:', errorText);
      return res.status(400).json({ error: errorText });
    }

    const shotstackData = await response.json();
    const renderId = shotstackData.response.id;

    console.log('✅ Render queued:', renderId);

    // Log (non-blocking)
    supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId,
      shotstack_render_id: renderId,
      status: 'queued',
      page_count: safePages.length
    }).catch(console.error);

    res.status(202).json({
      success: true,
      message: `Rendering ${safePages.length} pages...`,
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}
