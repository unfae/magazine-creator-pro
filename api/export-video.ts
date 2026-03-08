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
  introFlash?: boolean;
  firstClipIn?: string;
  firstClipEffect?: string;
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
    type: 'luma', stride: 3.5, clipLength: 5.1,
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
    ],
  },
  elegant: {
    type: 'luma', stride: 4.5, clipLength: 6.5,
    introFlash: true,
    firstClipIn: 'fadeSlow',
    firstClipEffect: 'zoomIn',
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',          duration: 1.76 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double.mp4',    duration: 1.76 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/waves/double-vertical.mp4',    duration: 1.32 },
    ],
  },
  cinematic: {
    type: 'luma', stride: 4, clipLength: 6.0,
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
// Z-ORDER RULE (critical):
//   Shotstack: tracks[0] = TOPMOST layer. tracks[N] = bottom layer.
//
//   STANDARD: We want the NEW (incoming) image to be on top so its transition.in
//             plays over the old image. So we REVERSE the tracks array — newest
//             image ends up at index 0.
//
//   LUMA:     The luma matte on track[i] dissolves image[i] away, revealing
//             image[i+1] on the track BELOW. So we keep forward order —
//             oldest image is index 0 (top), newest is last (bottom).
//             As each luma plays it peels the top image away, revealing the next.
//
// INTRO FLASH (elegant only):
//   An extra track is prepended at index 0 (topmost) containing a single warm-
//   white overlay clip that fades out in the first second — a light-flare entry.
//   It sits above everything and disappears quickly, then the luma transitions
//   take over for the rest of the video.

function buildTracks(pages: string[], style: Style): object[] {
  const { stride, clipLength, type } = style;

  if (type === 'standard') {
    // ── Standard: one track per image, reversed so newest = topmost ──────────
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

    // Reverse: image N-1 (last/newest) becomes tracks[0] (topmost)
    return imageTracks.reverse();
  }

  // ── Luma: one track per image, forward order (oldest = top) ─────────────────
  // The luma on track[i] dissolves image[i], revealing image[i+1] on track[i+1].
  const isLast = (i: number) => i === pages.length - 1;

  const imageTracks = pages.map((src, i) => {
    const clipStart = i * stride;
    const luma = style.lumaCycle![i % style.lumaCycle!.length];
    const lumaStart = clipStart + stride; // luma fires right when next image begins

    // First clip: apply optional graceful entry + Ken Burns effect
    const isFirst = i === 0;
    const transitionIn = isFirst && style.firstClipIn ? style.firstClipIn : 'none';
    const effect = isFirst && style.firstClipEffect ? style.firstClipEffect : undefined;

    const imageClip: Record<string, any> = {
      asset: { type: 'image', src: src.trim() },
      start: clipStart,
      // Last clip: just show for clipLength (no outgoing luma needed)
      // Others: extend to cover the full luma transition window
      length: isLast(i) ? clipLength : stride + luma.duration + 0.1,
      fit: 'contain',
      position: 'center',
      transition: { in: transitionIn, out: 'none' },
    };
    if (effect) imageClip.effect = effect;

    const clips: object[] = [imageClip];

    // Add luma clip BEFORE image in the clips array (same track, applies to the image)
    // The luma must be listed BEFORE the image clip in the clips array for Shotstack
    if (!isLast(i)) {
      clips.unshift({
        asset: { type: 'luma', src: luma.url },
        start: lumaStart,
        length: luma.duration,
      });
    }

    return { clips };
  });

  // Optionally prepend a warm light-flare overlay track (topmost, index 0)
  if (style.introFlash) {
    const flashTrack = {
      clips: [{
        asset: {
          type: 'html',
          html: '<p></p>',
          width: 608,
          height: 1080,
          background: '#FFFBF0', // warm cream-white → simulates a golden light leak
        },
        start: 0,
        length: 1.4,
        opacity: 0.55,
        transition: { in: 'none', out: 'fadeFast' },
      }],
    };
    return [flashTrack, ...imageTracks];
  }

  return imageTracks;
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