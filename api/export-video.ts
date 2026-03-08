import { createClient } from '@supabase/supabase-js';

// ─── Transition config (inlined — Vercel can't resolve src/ at runtime) ───────
// Keep in sync with src/lib/videoTransitions.ts
interface TransitionPair { in: string; out: string; }
interface LumaMatte { url: string; duration: number; }
interface Style {
  type: 'standard' | 'luma';
  stride: number;
  clipLength: number;
  cycle?: TransitionPair[];
  lumaCycle?: LumaMatte[];
}

const STYLES: Record<string, Style> = {
  simple: {
    type: 'standard', stride: 4, clipLength: 5,
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'fadeFast',      out: 'none' },
    ],
  },
  bold: {
    type: 'standard', stride: 4, clipLength: 5,
    cycle: [
      { in: 'wipeLeftFast',     out: 'none' },
      { in: 'carouselLeftFast', out: 'none' },
      { in: 'wipeRightFast',    out: 'none' },
    ],
  },
  elegant: {
    type: 'standard', stride: 4.5, clipLength: 6,
    cycle: [
      { in: 'revealSlow',        out: 'none' },
      { in: 'shuffleTopRight',   out: 'none' },
      { in: 'carouselRightSlow', out: 'none' },
    ],
  },
  cinematic: {
    type: 'luma', stride: 4, clipLength: 5.4,
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',      duration: 1.76 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
    ],
  },
};

// ─── Track builder ────────────────────────────────────────────────────────────
//
// Each image gets its OWN track, staggered by `stride` seconds.
// Since they're separate tracks, they can overlap — the next image enters
// while the previous one is still fully visible. No black gaps.
//
// Standard: track i = [image clip with transition.in]
// Luma:     track i = [image clip (no built-in transition) + luma clip timed at the boundary]
//           The luma makes image i transparent, revealing image i+1 on the track below.

function buildTracks(pages: string[], style: Style): object[] {
  const { stride, clipLength, type } = style;
  const isLast = (i: number) => i === pages.length - 1;

  return pages.map((src, i) => {
    const clipStart = i * stride;

    if (type === 'luma') {
      const luma = style.lumaCycle![i % style.lumaCycle!.length];
      const lumaStart = clipStart + stride; // luma plays right when next image starts

      const clips: object[] = [
        {
          asset: { type: 'image', src: src.trim() },
          start: clipStart,
          // Last image: just show for clipLength, no luma needed
          // Other images: extend to cover the luma transition period
          length: isLast(i) ? clipLength : stride + luma.duration,
          fit: 'contain',
          position: 'center',
          transition: { in: 'none', out: 'none' },
        },
      ];

      // Add luma clip on the same track (makes this image transparent at the boundary)
      if (!isLast(i)) {
        clips.unshift({
          asset: { type: 'luma', src: luma.url },
          start: lumaStart,
          length: luma.duration,
        });
      }

      return { clips };
    } else {
      // Standard transition — just the image clip with a built-in transition.in
      const t = style.cycle![i % style.cycle!.length];
      return {
        clips: [
          {
            asset: { type: 'image', src: src.trim() },
            start: clipStart,
            length: clipLength,
            fit: 'contain',
            position: 'center',
            transition: { in: t.in, out: t.out },
          },
        ],
      };
    }
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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

    const style = STYLES[transitionId ?? 'simple'] ?? STYLES['simple'];
    const tracks = buildTracks(pages, style);

    const payload = {
      timeline: {
        tracks,
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
      console.error('Shotstack error:', errorText);
      return res.status(400).json({ error: 'Video render failed. Please try again.' });
    }

    const shotstackData = await response.json();
    const renderId = shotstackData.response?.id;

    if (!renderId) {
      console.error('Shotstack missing renderId:', shotstackData);
      return res.status(400).json({ error: 'Video render failed. Please try again.' });
    }

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