// ─── Video Transition Config ──────────────────────────────────────────────────
// Each style defines a CYCLE of transition pairs.
// Clips rotate through the cycle: clip 0 uses index 0, clip 1 uses index 1, etc.
// To add a new style: add an object to VIDEO_TRANSITIONS — nothing else needs updating.
// gifUrl: host a gif and drop the URL in — the dialog renders it automatically.
//
// Valid Shotstack transition names:
//   fade, fadeSlow, fadeFast, slideLeft, slideRight, slideUp, slideDown,
//   carouselLeft, carouselRight, carouselUp, carouselDown, wipeLeft, wipeRight,
//   shuffleTopRight, shuffleTopLeft, shuffleBottomRight, shuffleBottomLeft,
//   shuffleRightTop, shuffleRightBottom, shuffleLeftTop, shuffleLeftBottom,
//   reveal, flipLeft, flipRight, flipUp, flipDown, zoom

export type TransitionId = string;

export interface TransitionPair {
  in: string;
  out: string;
}

export interface VideoTransition {
  id: TransitionId;
  label: string;
  description: string;
  gifUrl: string | null;
  // Clips cycle through these pairs in order — gives a varied, dynamic feel
  cycle: TransitionPair[];
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Clean fades and gentle slides',
    gifUrl: null,
    cycle: [
      { in: 'fadeSlow',  out: 'fadeSlow'  },
      { in: 'slideLeft', out: 'fadeSlow'  },
      { in: 'fadeFast',  out: 'slideLeft' },
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Strong wipes and sharp carousels',
    gifUrl: null,
    cycle: [
      { in: 'wipeLeft',     out: 'wipeLeft'    },
      { in: 'carouselLeft', out: 'wipeLeft'     },
      { in: 'wipeRight',    out: 'carouselLeft' },
    ],
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Cinematic reveals and refined sweeps',
    gifUrl: null,
    cycle: [
      { in: 'revealSlow',      out: 'fadeSlow'         },  // slow cinematic uncover
      { in: 'shuffleTopRight', out: 'shuffleTopLeft'   },  // refined card sweep
      { in: 'carouselRightSlow', out: 'fadeSlow'       },  // smooth panoramic push
    ],
  },
];

// Returns the correct transition pair for a given clip index (cycles through the array)
export function getTransitionForClip(style: VideoTransition, clipIndex: number): TransitionPair {
  return style.cycle[clipIndex % style.cycle.length];
}

// Safe lookup by id — falls back to first entry
export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}