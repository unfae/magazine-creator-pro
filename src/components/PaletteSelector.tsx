// src/components/PaletteSelector.tsx
// Shows colour swatches for each available palette.
// Tapping a swatch selects it; the selected palette is applied across the canvas.

import { cn } from '@/lib/utils';
import type { TemplatePalette } from '@/hooks/useTemplatePalettes';

interface PaletteSelectorProps {
  palettes:          TemplatePalette[];
  selectedPaletteId: string | null;
  onSelect:          (id: string) => void;
  loading?:          boolean;
}

export function PaletteSelector({
  palettes, selectedPaletteId, onSelect, loading = false,
}: PaletteSelectorProps) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!palettes.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Colour palette
      </p>
      <div className="flex flex-wrap gap-2">
        {palettes.map(palette => {
          const isSelected = palette.id === selectedPaletteId;
          const { primary, secondary, accent } = palette.colors;

          return (
            <button
              key={palette.id}
              type="button"
              title={palette.name}
              onClick={() => onSelect(palette.id)}
              className={cn(
                'group flex items-center gap-1.5 rounded-full border px-2 py-1 transition-all',
                isSelected
                  ? 'border-foreground shadow-sm'
                  : 'border-border hover:border-foreground/40'
              )}
            >
              {/* Three colour dots representing the palette */}
              <span
                className="h-4 w-4 rounded-full ring-1 ring-black/10 flex-shrink-0"
                style={{ background: primary }}
              />
              <span
                className="h-4 w-4 rounded-full ring-1 ring-black/10 flex-shrink-0"
                style={{ background: secondary }}
              />
              <span
                className="h-4 w-4 rounded-full ring-1 ring-black/10 flex-shrink-0"
                style={{ background: accent }}
              />
              <span className="text-xs ml-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                {palette.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}