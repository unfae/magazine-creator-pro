import { useState, useEffect } from 'react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase'; // 👈 ADDED

const categories = ['All', 'Fashion', 'Travel', 'Family', 'Portfolio', 'Wedding', 'Street'];

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [templates, setTemplates] = useState<any[]>([]); // 👈 replaces mock data
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

  const filteredTemplates =
    selectedCategory === 'All'
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="text-editorial-lg mb-3">Choose Your Template</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Select a beautifully crafted template to start your magazine
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
              selectedCategory === category
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      )}

      {/* Templates Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger-children">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No templates found in this category.</p>
        </div>
      )}
    </div>
  );
}
