// src/hooks/useSvgPalette.ts
// Fetches an SVG by URL, injects palette colours into fill/stroke attributes,
// and returns it as an inline data-URI that can be used as an <img> src or
// as a CSS mask-image URL.
//
// SVG files should use these placeholder fill colours so we can swap them:
//   --palette-primary    →  #C8A97E  (warm gold placeholder)
//   --palette-secondary  →  #F2EDE4  (cream placeholder)
//   --palette-accent     →  #2C2C2C  (dark placeholder)
//   --palette-text       →  #111111  (near-black placeholder)
//   --palette-background →  #FFFFFF  (white placeholder)
//
// Any SVG that doesn't use these placeholders is returned as-is.

import { useEffect, useState, useRef } from 'react';
import type { PaletteColors } from './useTemplatePalettes';

// Cache so we don't re-fetch the same SVG on every render
const SVG_CACHE: Record<string, string> = {};

const PLACEHOLDER_FILLS: Record<keyof PaletteColors, string> = {
  primary:    '#C8A97E',
  secondary:  '#F2EDE4',
  accent:     '#2C2C2C',
  text:       '#111111',
  background: '#FFFFFF',
};

function injectPaletteIntoSvg(svgText: string, colors: PaletteColors): string {
  let result = svgText;
  for (const [role, placeholder] of Object.entries(PLACEHOLDER_FILLS)) {
    const newColor = colors[role as keyof PaletteColors];
    if (!newColor) continue;
    // Replace both fill="PLACEHOLDER" and fill: PLACEHOLDER in style attrs
    const escaped = placeholder.replace('#', '\\#');
    result = result
      .replace(new RegExp(`fill="${placeholder}"`, 'gi'),    `fill="${newColor}"`)
      .replace(new RegExp(`fill:${placeholder}`,   'gi'),    `fill:${newColor}`)
      .replace(new RegExp(`fill: ${placeholder}`,  'gi'),    `fill: ${newColor}`)
      .replace(new RegExp(`stroke="${placeholder}"`, 'gi'),  `stroke="${newColor}"`)
      .replace(new RegExp(`stroke:${placeholder}`,  'gi'),   `stroke:${newColor}`);
  }
  return result;
}

function svgToDataUri(svgText: string): string {
  // Encode as a data URI — avoids CORS issues with CSS mask-image
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

export function useSvgPalette(
  svgUrl: string | null | undefined,
  colors: PaletteColors | null
): string | null {
  const [dataUri, setDataUri] = useState<string | null>(svgUrl ?? null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!svgUrl) { setDataUri(null); return; }
    // No palette → return original URL as-is
    if (!colors) { setDataUri(svgUrl); return; }

    const cacheKey = `${svgUrl}__${JSON.stringify(colors)}`;
    if (SVG_CACHE[cacheKey]) { setDataUri(SVG_CACHE[cacheKey]); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        const res  = await fetch(svgUrl, { signal: ctrl.signal });
        const text = await res.text();
        const injected = injectPaletteIntoSvg(text, colors);
        const uri      = svgToDataUri(injected);
        SVG_CACHE[cacheKey] = uri;
        setDataUri(uri);
      } catch (e: any) {
        if (e.name !== 'AbortError') setDataUri(svgUrl); // fallback to original
      }
    })();

    return () => { ctrl.abort(); };
  }, [svgUrl, colors]);

  return dataUri;
}