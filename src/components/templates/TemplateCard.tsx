// src/components/templates/TemplateCard.tsx

import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: any;
  usageCount?: number;
}

export function TemplateCard({ template, usageCount = 0 }: TemplateCardProps) {
  const navigate = useNavigate();

  const isAI  = template.template_type === 'ai';
  const slug  = template.slug ?? template.id;
  const route = isAI ? `/create-ai/${slug}` : `/create/${slug}`;
  const isFree = !template.price || template.price === 0;
  const price  = isFree ? null : `₦${Number(template.price).toLocaleString()}`;

  function handleClick() {
    navigate(route);
  }

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden cursor-pointer group hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full bg-muted overflow-hidden">
        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No preview
          </div>
        )}

        {/* AI badge */}
        {isAI && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 backdrop-blur-sm">
            <Zap className="h-3 w-3 fill-yellow-400" />
            AI
          </span>
        )}

        {/* Private badge */}
        {template.private_template && (
          <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            Private
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        {/* Category + price row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium capitalize rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {template.category ?? ''}
          </span>
          {price ? (
            <span className="text-xs font-semibold rounded-full bg-gold/10 text-gold px-2 py-0.5">
              {price}
            </span>
          ) : (
            // Free tag uses foreground/background (adapts to dark/light theme) — no green
            <span className="text-xs font-semibold rounded-full border border-foreground/20 text-foreground/70 px-2 py-0.5">
              Free
            </span>
          )}
        </div>

        {/* Template name */}
        <p className="text-sm font-medium leading-snug line-clamp-2">{template.name}</p>

        {/* Usage count — "loved X times" or "be the first to use it" */}
        {usageCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            loved {usageCount.toLocaleString()} {usageCount === 1 ? 'time' : 'times'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">be the first to use it</p>
        )}

        {/* CTA — always "Use Template" regardless of cta_link_text (that's for a different purpose) */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleClick(); }}
          className={cn(
            'w-full mt-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
            isAI
              ? 'bg-yellow-400/90 hover:bg-yellow-400 text-black'
              : 'bg-foreground hover:bg-foreground/90 text-background'
          )}
        >
          {isAI ? 'Create with AI' : 'Use Template'}
        </button>
      </div>
    </div>
  );
}