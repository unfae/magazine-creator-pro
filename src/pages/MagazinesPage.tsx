import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MagazineCard } from '@/components/magazines/MagazineCard';
import { Button } from '@/components/ui/button';
import { sampleMagazines } from '@/data/mockData';
import { Plus, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'draft' | 'completed';

export default function MagazinesPage() {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredMagazines = sampleMagazines.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const drafts = sampleMagazines.filter(m => m.status === 'draft').length;
  const completed = sampleMagazines.filter(m => m.status === 'completed').length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-editorial-lg mb-1">My Magazines</h1>
          <p className="text-muted-foreground">
            {sampleMagazines.length} magazines • {drafts} drafts • {completed} completed
          </p>
        </div>
        <Link to="/templates">
          <Button variant="gold">
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-8">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(['all', 'draft', 'completed'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full transition-all",
              filter === f
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Magazines Grid */}
      {filteredMagazines.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger-children">
          {filteredMagazines.map((magazine) => (
            <MagazineCard key={magazine.id} magazine={magazine} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl mb-2">No magazines yet</h3>
          <p className="text-muted-foreground mb-6">
            Start creating your first magazine from a template
          </p>
          <Link to="/templates">
            <Button variant="gold">Browse Templates</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
