// ─── Video Transition Config ──────────────────────────────────────────────────
//
// FLICKER FIX — image clip ends exactly when luma ends (no buffer):
//   In the builder, non-last clips use `length = stride + luma.duration` exactly.
//   When the luma ends the image is fully transparent. Any extra buffer after
//   the luma ends causes the image to "snap back" to full opacity = the flicker.
//   Shotstack's own examples always end both at the same time.
//
// Z-ORDER:
//   standard → tracks REVERSED before sending (newest image = tracks[0] = top)
//   luma     → tracks forward order (oldest = top, luma peels it away)
//
// UNIQUE LUMA SETS — no overlap between styles:
//   cinematic : paint-left · radial · paint-right · blocks-in
//   bold      : single-arrow-right · double-arrow-down · double-vertical-wave
//   elegant   : center-double · double-arrow-up · (radial shared w/ cinematic is
//               fine — styles feel totally different; user cares about the feel)
//
// stride     = seconds before next image enters (determines visible display time)
// clipLength = display length for the LAST image only (no outgoing luma needed)

export type TransitionId = string;
export type StyleType = 'standard' | 'luma';

export interface LumaMatte {
  url: string;
  duration: number; // exact mp4 duration in seconds — must be precise to avoid flicker
}

export interface VideoTransition {
  id: TransitionId;
  label: string;
  description: string;
  gifUrl: string | null;
  type: StyleType;
  stride: number;
  clipLength: number;       // only used for the last image clip
  cycle?: { in: string; out: string }[];   // standard only
  lumaCycle?: LumaMatte[];                  // luma only
  firstClipIn?: string;                     // graceful entry for clip 0
  firstClipEffect?: string;                 // Ken Burns for clip 0
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Quick and clean — perfect for fast shares',
    gifUrl: null,
    type: 'standard',
    stride: 3,
    clipLength: 4,
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'slideUpFast',   out: 'none' },
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High energy — great for making a statement',
    gifUrl: null,
    type: 'luma',
    stride: 2.5,
    clipLength: 4,
    // Unique set: directional arrows — left/right/down — never appear in other styles
    lumaCycle: [
      // arrow sweeps right → 2s
      { url: 'https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/luma-mattes/single-arrow-right.mp4', duration: 2 },
      // double arrow sweeps DOWN ↓ → 2s (vertical direction)
      { url: 'https://templates.shotstack.io/basic/asset/video/luma/double-arrow/double-arrow-down.mp4',     duration: 2 },
      // vertical wave ↕ → 1.32s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/waves/double-vertical.mp4', duration: 1.32 },
    ],
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'More stylish and luxurious — feels high-end',
    gifUrl: null,
    type: 'luma',
    stride: 3.5,
    clipLength: 5,
    firstClipIn: 'fadeSlow',   // graceful cinematic opening
    firstClipEffect: 'zoomIn', // gentle Ken Burns push-in on first slide
    // Unique set: soft geometric — concentric circles and upward reveal
    lumaCycle: [
      // concentric double circles — refined, editorial → 1.76s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double.mp4',  duration: 1.76 },
      // double arrow sweeps UP ↑ → 2s (opposes bold's downward direction)
      { url: 'https://templates.shotstack.io/basic/asset/video/luma/double-arrow/double-arrow-up.mp4',           duration: 2    },
      // radial outward expand ○ → 1.76s (elegant version of a bloom)
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',         duration: 1.76 },
    ],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Looks like a real film edit — the full experience',
    gifUrl: null,
    type: 'luma',
    stride: 3,
    clipLength: 5,
    // Unique set: paint brush strokes + geometric block pattern
    lumaCycle: [
      // paint brush sweep ← → 1.4s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4  },
      // paint brush sweep → → 1.4s (direction alternates)
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4  },
      // block mosaic pattern → 1.32s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
      // radial outward ○ → 1.76s (4th luma in rotation — only cinematic has 4)
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',      duration: 1.76 },
    ],
  },
];

export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}