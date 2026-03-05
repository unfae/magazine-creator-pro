import { useState, useEffect, useMemo } from 'react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Search, ArrowRight } from 'lucide-react';

const categories = ['All', 'Fashion', 'Travel', 'Family', 'Memories', 'Wedding', 'Faith'] as const;

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_public', true)
        .eq('private_template', false)
        .order('created_at', { ascending: false });

      if (!error) setTemplates(data || []);

      const { data: exportData } = await supabase
        .from('template_usage_counts')
        .select('template_id, usage_count');

      if (exportData) {
        const counts: Record<string, number> = {};
        exportData.forEach(({ template_id, usage_count }: { template_id: string; usage_count: number }) => {
          if (template_id) counts[template_id] = usage_count;
        });
        setUsageCounts(counts);
      }

      setLoading(false);
    };

    fetchTemplates();
  }, []);

  const triggerSearch = () => setSearch(searchInput.trim().toLowerCase());

  const normalizedSearch = search.trim().toLowerCase();

  const categoryFiltered = useMemo(() => {
    if (selectedCategory === 'All') return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  const filteredTemplates = useMemo(() => {
    if (!normalizedSearch) return categoryFiltered;
    return categoryFiltered.filter((t) => {
      const name = t.name?.toLowerCase() || '';
      const category = t.category?.toLowerCase() || '';
      const tags = (t.tags || []).map((tag: string) => tag.toLowerCase());
      return (
        name.includes(normalizedSearch) ||
        category.includes(normalizedSearch) ||
        tags.some((tag: string) => tag.includes(normalizedSearch))
      );
    });
  }, [categoryFiltered, normalizedSearch]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-editorial-lg mb-3">Choose Your Template</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Select a beautifully crafted template to start your magazine
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-8 flex justify-center">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
            placeholder="Search templates..."
            className="w-full rounded-lg border border-input bg-background pl-4 pr-10 py-2 text-sm shadow-sm placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />

          <button
            onClick={triggerSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {searchInput ? (
              <span className="flex items-center justify-center w-6 h-6 rounded-full border border-current">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            ) : (
              <Search className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex justify-center mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                if (searchInput) { setSearchInput(''); setSearch(''); }
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

      {loading && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              usageCount={usageCounts[template.id] || 0}
            />
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