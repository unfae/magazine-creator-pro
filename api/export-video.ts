import { createClient } from '@supabase/supabase-js';

// ─── Transition config (inlined — Vercel can't resolve src/ at runtime) ───────
// Keep in sync with src/lib/videoTransitions.ts

interface LumaMatte { url: string; duration: number; }
interface Style {
  type: 'standard' | 'luma';
  stride: number;
  clipLength: number;
  cycle?: { in: string; out: string }[];
  lumaCycle?: LumaMatte[];
  firstClipIn?: string;
  firstClipEffect?: string;
}

const STYLES: Record<string, Style> = {
  simple: {
    type: 'standard', stride: 3, clipLength: 4,
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'slideUpFast',   out: 'none' },
    ],
  },
  bold: {
    type: 'luma', stride: 2.5, clipLength: 4,
    lumaCycle: [
      { url: 'https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/luma-mattes/single-arrow-right.mp4',     duration: 2    },
      { url: 'https://templates.shotstack.io/basic/asset/video/luma/double-arrow/double-arrow-down.mp4',          duration: 2    },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/waves/double-vertical.mp4',   duration: 1.32 },
    ],
  },
  elegant: {
    type: 'luma', stride: 3.5, clipLength: 5,
    firstClipIn: 'fadeSlow',
    firstClipEffect: 'zoomIn',
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double.mp4',   duration: 1.76 },
      { url: 'https://templates.shotstack.io/basic/asset/video/luma/double-arrow/double-arrow-up.mp4',            duration: 2    },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',          duration: 1.76 },
    ],
  },
  cinematic: {
    type: 'luma', stride: 3, clipLength: 5,
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',      duration: 1.76 },
    ],
  },
};

// ─── Track builder ────────────────────────────────────────────────────────────
//
// Z-ORDER:
//   standard → reversed array: newest image = tracks[0] = topmost layer
//   luma     → forward array: tracks[0] = oldest (top), luma peels it away
//
// FLICKER FIX:
//   Non-last image clips use `length = stride + luma.duration` EXACTLY.
//   Previously we added +0.1s buffer — that 0.1s caused the image to snap back
//   to full opacity after the luma ended, producing the flicker.
//   Now: image clip ends at the same instant the luma ends. Clean handoff.
//
// LUMA STRUCTURE (per track / same track):
//   clips[0] = luma asset (masks the image below it in the same track)
//   clips[1] = image asset (gets masked by the luma above it)
//   The next image lives on a separate track below, starting at lumaStart,
//   becoming visible as the luma makes the current image transparent.

function buildTracks(pages: string[], style: Style): object[] {
  const { stride, clipLength, type } = style;
  const isLast = (i: number) => i === pages.length - 1;

  // ── Standard (simple) ──────────────────────────────────────────────────────
  if (type === 'standard') {
    const imageTracks = pages.map((src, i) => {
      const t = style.cycle![i % style.cycle!.length];
      return {
        clips: [{
          asset: { type: 'image', src: src.trim() },
          start: i * stride,
          length: clipLength,
          fit: 'contain',
          position: 'center',
          transition: { in: t.in, out: t.out },
        }],
      };
    });
    // Reverse: image[N-1] (newest) → tracks[0] (topmost), so its transition.in
    // plays visibly on top of the previous image below.
    return imageTracks.reverse();
  }

  // ── Luma ───────────────────────────────────────────────────────────────────
  return pages.map((src, i) => {
    const clipStart = i * stride;
    const luma = style.lumaCycle![i % style.lumaCycle!.length];
    const lumaStart = clipStart + stride; // fires exactly when next image begins

    const isFirst = i === 0;
    const transIn = isFirst && style.firstClipIn ? style.firstClipIn : 'none';
    const effect  = isFirst && style.firstClipEffect ? style.firstClipEffect : undefined;

    const imageClip: Record<string, any> = {
      asset: { type: 'image', src: src.trim() },
      start: clipStart,
      // FLICKER FIX: end exactly when luma ends — no extra buffer.
      // After luma finishes the image is fully transparent; the track below
      // has already been visible since lumaStart. Clean, no snap-back.
      length: isLast(i) ? clipLength : stride + luma.duration,
      fit: 'contain',
      position: 'center',
      transition: { in: transIn, out: 'none' },
    };
    if (effect) imageClip.effect = effect;

    const clips: object[] = [imageClip];

    // Luma clip listed FIRST in the array — Shotstack applies it to the image below it
    if (!isLast(i)) {
      clips.unshift({
        asset: { type: 'luma', src: luma.url },
        start: lumaStart,
        length: luma.duration,
      });
    }

    return { clips };
  });
  // Note: luma tracks stay in FORWARD order (not reversed).
  // tracks[0] = image[0] (oldest, top layer), luma peels it away to reveal
  // tracks[1] = image[1] below, and so on down the stack.
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

    // ── Log to video_exports table (fire-and-forget) ──────────────────────────
    const { error: logError } = await supabase.from('video_exports').insert({
      user_id: userId ?? null,
      template_id: templateId ?? null,
      template_name: templateName ?? null,
      transition_id: transitionId ?? 'simple',
      page_count: pages.length,
      shotstack_render_id: renderId,
      status: 'queued',
      created_at: new Date().toISOString(),
    });
    if (logError) console.error('video_exports log failed:', logError.message);

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