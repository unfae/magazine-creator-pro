import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MagazineCard } from '@/components/magazines/MagazineCard';
import { Button } from '@/components/ui/button';
import { Plus, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FilterType = 'all' | 'draft' | 'completed';

export default function MagazinesPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [magazines, setMagazines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchMagazines = async () => {
      setLoading(true);
      // get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to view magazines.');
        setLoading(false);
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('magazines')
        .select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching magazines:', error);
        toast.error('Failed to load magazines');
        setLoading(false);
        return;
      }

      if (!mounted) return;

      // Map DB rows to the shape the UI expects (status field)
      const mapped = (data || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        thumbnailUrl: m.thumbnail_url ?? null,
        templateId: m.template_id,
        metadata: m.metadata,
        is_published: m.is_published,
        created_at: m.created_at,
        updated_at: m.updated_at,
        // UI in this file expects 'status' values like 'draft' | 'completed'
        status: m.is_published ? 'completed' : 'draft',
        // keep any other fields the MagazineCard might use
        raw: m,
      }));

      setMagazines(mapped);
      setLoading(false);
    };

    fetchMagazines();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // keep original filtering logic using the same "status" values
  const filteredMagazines = magazines.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const drafts = magazines.filter((m) => m.status === 'draft').length;
  const completed = magazines.filter((m) => m.status === 'completed').length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-editorial-lg mb-1">My Magazines</h1>
          <p className="text-muted-foreground">
            {magazines.length} magazines • {drafts} drafts • {completed} completed
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
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading magazines...</p>
        </div>
      ) : filteredMagazines.length > 0 ? (
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
