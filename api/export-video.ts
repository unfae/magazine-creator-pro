import { createClient } from '@supabase/supabase-js';

// Transition config inlined — Vercel serverless can't resolve src/ imports at runtime.
// Keep in sync with src/lib/videoTransitions.ts when you add/change transitions.
interface TransitionPair { in: string; out: string; }
interface TransitionStyle { cycle: TransitionPair[]; }

const VIDEO_TRANSITIONS: Record<string, TransitionStyle> = {
  simple: {
    cycle: [
      { in: 'fadeSlow',  out: 'fadeSlow'  },
      { in: 'slideLeft', out: 'fadeSlow'  },
      { in: 'fadeFast',  out: 'slideLeft' },
    ],
  },
  bold: {
    cycle: [
      { in: 'wipeLeft',     out: 'wipeLeft'    },
      { in: 'carouselLeft', out: 'wipeLeft'     },
      { in: 'wipeRight',    out: 'carouselLeft' },
    ],
  },
  elegant: {
    cycle: [
      { in: 'revealSlow',        out: 'fadeSlow'       },
      { in: 'shuffleTopRight',   out: 'shuffleTopLeft' },
      { in: 'carouselRightSlow', out: 'fadeSlow'       },
    ],
  },
};

function getTransitionForClip(id: string, clipIndex: number): TransitionPair {
  const style = VIDEO_TRANSITIONS[id] ?? VIDEO_TRANSITIONS['simple'];
  return style.cycle[clipIndex % style.cycle.length];
}

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

    // ✅ Production endpoint — switch SHOTSTACK_API_KEY env var on Vercel to your production key
    const SHOTSTACK_URL = 'https://api.shotstack.io/v1/render';

    // All pages — no arbitrary limit
    const allPages = pages;

    const clips = allPages.map((src: string, index: number) => {
      const transition = getTransitionForClip(transitionId ?? 'simple', index);
      return {
        asset: { type: 'image', src: src.trim() },
        start: index * 3,
        length: 3,
        fit: 'contain',
        position: 'center',
        transition: {
          in: transition.in,
          out: transition.out,
        },
      };
    });

    const payload = {
      timeline: {
        tracks: [{ clips }],
        background: '#000000',
      },
      output: {
        format: 'mp4',
        resolution: '1080',   // ✅ Highest — 1080px (1920×1080 landscape / 1080×1920 portrait)
        aspectRatio: '9:16',  // Portrait magazine format
        fps: 25,
        quality: 'high',      // ✅ Visually lossless compression
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
    const renderId = shotstackData.response?.id;

    if (!renderId) {
      return res.status(400).json({ error: 'Shotstack did not return a render ID', details: shotstackData });
    }

    // Log (fire-and-forget)
    supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId || null,
      shotstack_render_id: renderId,
      status: 'queued',
      page_count: allPages.length,
      transition_id: transitionId ?? 'simple',
    });

    res.status(202).json({
      success: true,
      message: `Rendering ${allPages.length} magazine pages...`,
      renderId,
    });
  } catch (error: any) {
    console.error('Video export error:', error);
    res.status(500).json({ error: error.message });
  }
}