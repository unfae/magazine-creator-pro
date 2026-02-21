import { useState, useEffect, useMemo } from 'react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Search } from 'lucide-react';

const categories = ['All', 'Fashion', 'Travel', 'Family', 'Memories', 'Wedding', 'Faith'] as const;

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState(''); // 👈 new state
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!error) setTemplates(data || []);
      setLoading(false);
    };

    fetchTemplates();
  }, []);

  // Normalize search term (lowercase, trim)
  const normalizedSearch = search.trim().toLowerCase();

  // Filter by category first
  const categoryFiltered = useMemo(() => {
    if (selectedCategory === 'All') return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  // Then filter by search term on name, category, and tags
  const filteredTemplates = useMemo(() => {
    if (!normalizedSearch) return categoryFiltered;

    return categoryFiltered.filter((t) => {
      const name = t.name?.toLowerCase() || '';
      const category = t.category?.toLowerCase() || '';
      const tags = (t.tags || []).map((t: string) => t.toLowerCase());

      return (
        name.includes(normalizedSearch) ||
        category.includes(normalizedSearch) ||
        tags.includes(normalizedSearch)
      );
    });
  }, [categoryFiltered, normalizedSearch]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-editorial-lg mb-3">Choose Your Template</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Select a beautifully crafted template to start your magazine
        </p>
      </div>

      {/* Search bar (always on top) */}
      <div className="mb-8 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-lg border border-input bg-background px-10 py-2 text-sm shadow-sm 
                       placeholder:text-muted-foreground/80 
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>
      </div>

      {/* Category filters (below search bar) */}
      <div className="flex justify-center mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                if (search) setSearch('');
              }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
                selectedCategory === category
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      )}

      {/* Templates Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No templates match your search or category.</p>
        </div>
      )}
    </div>
  );
}
