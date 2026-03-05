import { Template } from '@/types/magazine';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Image, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TemplateCardProps {
  template: Template;
  usageCount?: number;
}

export function TemplateCard({ template, usageCount }: TemplateCardProps) {
  const isFree = !template.price || template.price === 0;

  return (
    <Link to={`/create/${template.slug}`}>
      <Card className="group overflow-hidden hover:shadow-elevated cursor-pointer">
        <div className="aspect-[4/5] overflow-hidden relative">
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <Button variant="gold" size="sm" className="w-full pointer-events-none">
              Use Template
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          {/* Tags row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full text-secondary-foreground">
              {template.category}
            </span>
            {isFree ? (
              <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full text-muted-foreground">
                Free
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-1 bg-gold/10 text-gold rounded-full">
                ₦{Number(template.price).toLocaleString()}
              </span>
            )}
          </div>

          <h3 className="font-serif text-xl font-medium mb-1">{template.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {template.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {template.pageCount} pages
            </span>
            <span className="flex items-center gap-1">
              <Image className="h-3.5 w-3.5" />
              {template.requiredPhotos} photos max.
            </span>
          </div>

          {/* Usage count */}
          {usageCount !== undefined && usageCount > 0 ? (
            <div className="flex items-center gap-1 mt-2 text-xs text-gold font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              Loved {usageCount} {usageCount === 1 ? 'time' : 'times'}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-2 text-xs text-gold italic">
              ✨ Be the first to use this template
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}