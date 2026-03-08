// ─── Video Transition Config ──────────────────────────────────────────────────
// Timing model:
//   length: 5s per clip — longer hold feels more cinematic
//   transition.in:  fast (0.5s) — snappy entry on top of the previous clip
//   transition.out: 'none' — clip stays at full brightness until the next one cuts in
//                            this eliminates the "dip to black" caused by two slow fades
//                            overlapping at reduced opacity
//
// To add a new style: add an object to VIDEO_TRANSITIONS — nothing else changes.
// gifUrl: drop in a hosted gif URL to show a preview in the dialog.
//
// Valid Shotstack transition names (append Slow=2s, Fast=0.5s, or nothing=1s):
//   none, fade, reveal, wipeLeft, wipeRight,
//   slideLeft, slideRight, slideUp, slideDown,
//   carouselLeft, carouselRight, carouselUp, carouselDown,
//   shuffleTopRight, shuffleTopLeft, shuffleBottomRight, shuffleBottomLeft,
//   shuffleRightTop, shuffleRightBottom, shuffleLeftTop, shuffleLeftBottom,
//   zoom

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
  clipLength: number;         // seconds each page is displayed
  cycle: TransitionPair[];    // clips rotate through these pairs in order
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Clean fades and gentle slides',
    gifUrl: null,
    clipLength: 4,
    cycle: [
      { in: 'fadeFast',       out: 'none' },
      { in: 'slideLeftFast',  out: 'none' },
      { in: 'fadeFast',       out: 'none' },
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Sharp wipes and dynamic carousels',
    gifUrl: null,
    clipLength: 4,
    cycle: [
      { in: 'wipeLeftFast',      out: 'none' },
      { in: 'carouselLeftFast',  out: 'none' },
      { in: 'wipeRightFast',     out: 'none' },
    ],
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Cinematic reveals and refined sweeps',
    gifUrl: null,
    clipLength: 5,            // slightly longer hold for elegance
    cycle: [
      { in: 'revealSlow',         out: 'none' },   // slow cinematic uncover
      { in: 'shuffleTopRight',    out: 'none' },   // refined card sweep
      { in: 'carouselRightSlow',  out: 'none' },   // smooth panoramic push
    ],
  },
];

// Returns the correct transition pair for a given clip index
export function getTransitionForClip(style: VideoTransition, clipIndex: number): TransitionPair {
  return style.cycle[clipIndex % style.cycle.length];
}

// Safe lookup by id — falls back to first entry
export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}