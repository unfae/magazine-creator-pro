import { createClient } from '@supabase/supabase-js';

// Transition config inlined — Vercel serverless can't resolve src/ imports at runtime.
// Keep in sync with src/lib/videoTransitions.ts when you add/change transitions.
//
// Timing model: out:'none' on all styles eliminates the "dip to black" gap.
// The exiting clip stays at full brightness; the next clip enters on top of it.
interface TransitionPair { in: string; out: string; }
interface TransitionStyle { clipLength: number; cycle: TransitionPair[]; }

const VIDEO_TRANSITIONS: Record<string, TransitionStyle> = {
  simple: {
    clipLength: 4,
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'fadeFast',      out: 'none' },
    ],
  },
  bold: {
    clipLength: 4,
    cycle: [
      { in: 'wipeLeftFast',     out: 'none' },
      { in: 'carouselLeftFast', out: 'none' },
      { in: 'wipeRightFast',    out: 'none' },
    ],
  },
  elegant: {
    clipLength: 5,
    cycle: [
      { in: 'revealSlow',        out: 'none' },
      { in: 'shuffleTopRight',   out: 'none' },
      { in: 'carouselRightSlow', out: 'none' },
    ],
  },
};

function getStyle(id: string): TransitionStyle {
  return VIDEO_TRANSITIONS[id] ?? VIDEO_TRANSITIONS['simple'];
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
    const SHOTSTACK_URL = 'https://api.shotstack.io/v1/render';

    const style = getStyle(transitionId ?? 'simple');
    const { clipLength, cycle } = style;

    const clips = pages.map((src: string, index: number) => {
      const t = cycle[index % cycle.length];
      return {
        asset: { type: 'image', src: src.trim() },
        start: index * clipLength,
        length: clipLength,
        fit: 'contain',
        position: 'center',
        transition: { in: t.in, out: t.out },
      };
    });

    const payload = {
      timeline: {
        tracks: [{ clips }],
        background: '#000000',
      },
      output: {
        format: 'mp4',
        resolution: '1080',
        aspectRatio: '9:16',
        fps: 25,
        quality: 'high',
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
      console.error('Shotstack error:', errorText);   // log full error server-side only
      return res.status(400).json({ error: 'Video render failed. Please try again.' });
    }

    const shotstackData = await response.json();
    const renderId = shotstackData.response?.id;

    if (!renderId) {
      console.error('Shotstack missing renderId:', shotstackData);
      return res.status(400).json({ error: 'Video render failed. Please try again.' });
    }

    // Log fire-and-forget
    supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      template_id: templateId || null,
      shotstack_render_id: renderId,
      status: 'queued',
      page_count: pages.length,
      transition_id: transitionId ?? 'simple',
    });

    res.status(202).json({
      success: true,
      message: `Rendering ${pages.length} magazine pages...`,
      renderId,
    });
  } catch (error: any) {
    console.error('Video export error:', error);
    res.status(500).json({ error: 'Video export failed. Please try again.' });
  }
}