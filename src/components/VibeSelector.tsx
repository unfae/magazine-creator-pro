// src/components/VibeSelector.tsx
// Shows vibe options as cards. Selecting a vibe auto-applies its palette too.
// If Anthropic API key is set, shows an "AI match" button that calls match-vibe.
// If not set, the manual cards still work perfectly.

import { useState } from 'react';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { TemplateVibe } from '@/hooks/useTemplateVibes';

interface VibeSelectorProps {
  vibes:           TemplateVibe[];
  selectedVibeId:  string | null;
  onSelect:        (vibe: TemplateVibe) => void;   // passes full vibe so caller can also set palette
  loading?:        boolean;
  // For AI matching — optional. If not provided, the AI button is hidden.
  templateId?:     string;
  templateName?:   string;
  category?:       string;
  aiEnabled?:      boolean; // true once ANTHROPIC_API_KEY is set
}

export function VibeSelector({
  vibes, selectedVibeId, onSelect,
  loading = false,
  templateId, templateName, category,
  aiEnabled = false,
}: VibeSelectorProps) {
  const [matchInput, setMatchInput] = useState('');
  const [matching, setMatching]     = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  async function handleAIMatch() {
    if (!matchInput.trim() || !templateId) return;
    setMatching(true);

    try {
      const { data, error } = await supabase.functions.invoke('match-vibe', {
        body: {
          templateId,
          templateName,
          category,
          userPrompt: matchInput.trim(),
          vibeOptions: vibes.map(v => ({ id: v.id, name: v.name, description: v.description })),
        },
      });

      if (error || !data?.vibeId) throw new Error('No match returned');

      const matched = vibes.find(v => v.id === data.vibeId);
      if (matched) {
        onSelect(matched);
        setShowAiInput(false);
        setMatchInput('');
      }
    } catch {
      // Silently fall back — user can still pick manually
    } finally {
      setMatching(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!vibes.length) return null;

  return (
    <div className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Vibe
        </p>
        {aiEnabled && (
          <button
            type="button"
            onClick={() => setShowAiInput(v => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Wand2 className="h-3 w-3" />
            AI match
          </button>
        )}
      </div>

      {/* AI match input — only visible when aiEnabled + toggled */}
      {aiEnabled && showAiInput && (
        <div className="flex gap-2">
          <input
            value={matchInput}
            onChange={e => setMatchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAIMatch()}
            placeholder="Describe the feel… e.g. soft and romantic"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button" size="sm" variant="outline"
            onClick={handleAIMatch}
            disabled={matching || !matchInput.trim()}
            className="shrink-0"
          >
            {matching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Vibe cards */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory scrollbar-none">
        {vibes.map(vibe => {
          const isSelected = vibe.id === selectedVibeId;
          return (
            <button
              key={vibe.id}
              type="button"
              onClick={() => onSelect(vibe)}
              className={cn(
                'flex-shrink-0 w-28 snap-start rounded-lg border p-2.5 text-left transition-all',
                isSelected
                  ? 'border-foreground bg-foreground/5 shadow-sm'
                  : 'border-border hover:border-foreground/40 hover:bg-muted/40'
              )}
            >
              <p className={cn(
                'text-xs font-semibold leading-tight',
                isSelected ? 'text-foreground' : 'text-foreground/80'
              )}>
                {vibe.name}
              </p>
              {vibe.description && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                  {vibe.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}