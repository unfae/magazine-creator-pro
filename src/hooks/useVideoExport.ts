import { createClient } from '@supabase/supabase-js';

// Import transition config — must be compatible with your bundler's server-side resolution.
// If this import path causes issues, copy the VIDEO_TRANSITIONS array inline here instead.
import { getTransition } from '../../src/lib/videoTransitions';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pages, userId, templateName, templateId, transitionId } = req.body;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    // Resolve transition — safe fallback to 'fade' if unknown id sent
    const transition = getTransition(transitionId ?? 'fade');

    // Limit to 8 pages
    const safePages = pages.slice(0, 8);

    const clips = safePages.map((src: string, index: number) => ({
      asset: {
        type: 'image',
        src: src.trim(),
      },
      start: index * 3,
      length: 3,
      fit: 'contain',
      position: 'center',
      transition: {
        in: transition.shotstackIn,
        out: transition.shotstackOut,
      },
    }));

    const payload = {
      timeline: {
        tracks: [{ clips }],
        background: '#000000',
      },
      output: {
        format: 'mp4',
        resolution: 'sd',
        aspectRatio: '9:16',
        fps: 24,
      },
    };

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(400).json({ error: `Shotstack: ${errorText}` });
    }

    const shotstackData = await response.json();
    const renderId = shotstackData.response.id;

    // Log (fire-and-forget)
    supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId || null,
      shotstack_render_id: renderId,
      status: 'queued',
      page_count: safePages.length,
      transition_id: transitionId ?? 'fade',
    });

    res.status(202).json({
      success: true,
      message: `Rendering ${safePages.length} magazine pages...`,
      renderId,
      statusUrl: `https://api.shotstack.io/stage/render/${renderId}`,
    });
  } catch (error: any) {
    console.error('Video export error:', error);
    res.status(500).json({ error: error.message });
  }
}
