// ─── Video Transition Config ──────────────────────────────────────────────────
// Add, rename, or remove transitions here. No other file needs to change.
// gifUrl: set to a hosted gif URL to show a preview, or null to show a placeholder.
// shotstackIn / shotstackOut: must be valid Shotstack transition names.
//   Valid values: https://shotstack.io/docs/guide/transitions/

export type TransitionId = string; // intentionally loose so new entries just work

export interface VideoTransition {
  id: TransitionId;
  label: string;
  description: string;
  gifUrl: string | null;      // preview gif — set to URL or leave null
  shotstackIn: string;
  shotstackOut: string;
}

export const VIDEO_TRANSITIONS: VideoTransition[] = [
  {
    id: 'fade',
    label: 'Fade',
    description: 'Pages gently fade into each other',
    gifUrl: null,              // e.g. 'https://cdn.magznmaker.com/previews/fade.gif'
    shotstackIn: 'fade',
    shotstackOut: 'fade',
  },
  {
    id: 'slideLeft',
    label: 'Slide',
    description: 'Pages slide in from the right',
    gifUrl: null,
    shotstackIn: 'slideLeft',
    shotstackOut: 'slideLeft',
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description: 'Pages carousel in from the left',
    gifUrl: null,
    shotstackIn: 'carouselLeft',
    shotstackOut: 'fade',
  },
];

// Helper — safe fallback if an unknown id arrives
export function getTransition(id: TransitionId): VideoTransition {
  return VIDEO_TRANSITIONS.find((t) => t.id === id) ?? VIDEO_TRANSITIONS[0];
}