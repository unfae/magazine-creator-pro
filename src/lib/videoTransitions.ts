// ─── Video Transition Config ──────────────────────────────────────────────────
//
// ARCHITECTURE — multi-track overlap (no black gaps):
//   Each image lives on its OWN track, staggered by `stride` seconds.
//   Separate tracks can overlap — the next image enters while the previous
//   one is still fully visible.
//
// TRACK Z-ORDER:
//   Standard: tracks are REVERSED before sending to Shotstack so the newest
//             image is always on top (index 0 = topmost layer).
//   Luma:     tracks stay in forward order — image 0 is on top (index 0),
//             the luma on each track dissolves it away revealing the image
//             on the track below.
//
// CINEMATIC / ELEGANT / BOLD use luma mattes (type: 'luma').
// SIMPLE uses built-in transitions (type: 'standard').
//
// introFlash (luma styles only): adds a warm white overlay clip at t=0
//   that fades out fast — simulates a light leak / cinematic flare on entry.
// firstClipIn: overrides transition.in for the very first image clip only.
// firstClipEffect: Ken Burns / zoom effect on the first image clip only.
//
// gifUrl: drop in a hosted gif for a preview thumbnail in the dialog.

export type TransitionId = string;
export type StyleType = 'standard' | 'luma';

export interface TransitionPair {
  in: string;
  out: string;
}

export interface LumaMatte {
  url: string;
  duration: number; // exact mp4 duration in seconds
}

export interface VideoTransition {
  id: TransitionId;
  label: string;
  description: string;
  gifUrl: string | null;
  type: StyleType;
  stride: number;      // seconds between clip start times
  clipLength: number;  // how long each image track clip runs
  // Standard only
  cycle?: TransitionPair[];
  // Luma only
  lumaCycle?: LumaMatte[];
  introFlash?: boolean;         // add a warm light-flare overlay at t=0
  firstClipIn?: string;         // transition.in override for clip 0 only
  firstClipEffect?: string;     // Shotstack effect for clip 0 only
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Quick and clean — perfect for fast shares',
    gifUrl: null,
    type: 'standard',
    stride: 4,
    clipLength: 5, // 1s overlap
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'fadeFast',      out: 'none' },
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High energy — great for making a statement',
    gifUrl: null,
    type: 'luma',
    stride: 3.5,
    clipLength: 5.1, // stride(3.5) + maxLuma(1.4) + 0.2 buffer
    lumaCycle: [
      // paint brush sweep left → aggressive, punchy
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      // block pattern reveal → bold, structured
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
      // paint brush sweep right → direction change keeps it dynamic
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
    ],
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'More stylish and luxurious — feels high-end',
    gifUrl: null,
    type: 'luma',
    stride: 4.5,
    clipLength: 6.5, // stride(4.5) + maxLuma(1.76) + 0.24 buffer
    introFlash: true,        // warm light-flare overlay on first entry
    firstClipIn: 'fadeSlow', // graceful first reveal
    firstClipEffect: 'zoomIn',
    lumaCycle: [
      // soft radial reveal — expands outward from center
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',            duration: 1.76 },
      // double concentric circles — refined, editorial
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double.mp4',      duration: 1.76 },
      // vertical wave sweep — organic, flowing
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/waves/double-vertical.mp4',      duration: 1.32 },
    ],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Looks like a real film edit — the full experience',
    gifUrl: null,
    type: 'luma',
    stride: 4,
    clipLength: 6.0, // stride(4) + maxLuma(1.76) + 0.24 buffer
    lumaCycle: [
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',      duration: 1.76 },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
    ],
  },
];

export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}