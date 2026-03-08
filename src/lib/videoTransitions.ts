// ─── Video Transition Config ──────────────────────────────────────────────────
//
// ARCHITECTURE — multi-track overlap (no black gaps):
//   Each image lives on its OWN Shotstack track, staggered by `stride` seconds.
//   Because they are separate tracks, they can overlap — the next image is
//   already entering on its track while the previous one is still fully visible.
//
//   stride:     seconds before the NEXT image starts entering (stride < clipLength = overlap)
//   clipLength: how long each image clip stays on its track
//   overlap:    clipLength - stride  (both images visible simultaneously)
//
// CINEMATIC uses luma mattes instead of transitions:
//   Each luma is placed on the SAME track as its host image.
//   When the luma plays it makes that image progressively transparent,
//   revealing the image on the track below. Looks like professionally edited film.
//
// To add a new style: add an entry to VIDEO_TRANSITIONS. Nothing else changes.
// gifUrl: drop in a hosted gif to show a preview in the dialog.

export type TransitionId = string;
export type StyleType = 'standard' | 'luma';

export interface TransitionPair {
  in: string;
  out: string;
}

export interface LumaMatte {
  url: string;       // publicly hosted luma matte mp4
  duration: number;  // exact duration of the luma mp4 in seconds
}

export interface VideoTransition {
  id: TransitionId;
  label: string;
  description: string;
  gifUrl: string | null;
  type: StyleType;
  stride: number;     // seconds between clip start times (stride < clipLength = overlap)
  clipLength: number; // how long each image clip is
  // standard transitions — used when type === 'standard'
  cycle?: TransitionPair[];
  // luma mattes — used when type === 'luma'
  lumaCycle?: LumaMatte[];
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Clean fades & gentle slides',
    gifUrl: null,
    type: 'standard',
    stride: 4,
    clipLength: 5,    // 1s overlap
    cycle: [
      { in: 'fadeFast',      out: 'none' },
      { in: 'slideLeftFast', out: 'none' },
      { in: 'fadeFast',      out: 'none' },
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Sharp wipes & dynamic carousels',
    gifUrl: null,
    type: 'standard',
    stride: 4,
    clipLength: 5,    // 1s overlap
    cycle: [
      { in: 'wipeLeftFast',     out: 'none' },
      { in: 'carouselLeftFast', out: 'none' },
      { in: 'wipeRightFast',    out: 'none' },
    ],
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Cinematic reveals & refined sweeps',
    gifUrl: null,
    type: 'standard',
    stride: 4.5,
    clipLength: 6,    // 1.5s overlap — slower, more refined
    cycle: [
      { in: 'revealSlow',        out: 'none' },
      { in: 'shuffleTopRight',   out: 'none' },
      { in: 'carouselRightSlow', out: 'none' },
    ],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Film-quality luma matte transitions',
    gifUrl: null,
    type: 'luma',
    stride: 4,
    clipLength: 5.4,  // stride + max luma duration (1.4s)
    lumaCycle: [
      // paint brush sweep — 1.4s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-left.mp4',  duration: 1.4 },
      // radial circular reveal — 1.76s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/radial.mp4',      duration: 1.76 },
      // paint brush from right — 1.4s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/paint-right.mp4', duration: 1.4 },
      // block pattern reveal — 1.32s
      { url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/examples/luma-mattes/blocks-in.mp4',   duration: 1.32 },
    ],
  },
];

export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}