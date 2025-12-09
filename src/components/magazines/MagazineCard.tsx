import { Magazine } from '@/types/magazine';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MagazineCardProps {
  magazine: Magazine;
}

export function MagazineCard({ magazine }: MagazineCardProps) {
  return (
    <Card className="group overflow-hidden hover:shadow-elevated">
      <div className="aspect-[4/5] overflow-hidden relative">
        <img
          src={magazine.thumbnailUrl}
          alt={magazine.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 right-3">
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full",
              magazine.status === 'completed'
                ? "bg-gold text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            {magazine.status === 'completed' ? 'Completed' : 'Draft'}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex gap-2">
            <Button variant="gold" size="sm" className="flex-1">
              <Eye className="h-4 w-4" />
              View
            </Button>
            {magazine.status === 'draft' && (
              <Button variant="secondary" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button variant="secondary" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-medium mb-1 truncate">{magazine.title}</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Using {magazine.templateName} template
        </p>
        <p className="text-xs text-muted-foreground">
          Updated {format(magazine.updatedAt, 'MMM d, yyyy')}
        </p>
      </div>
    </Card>
  );
}
