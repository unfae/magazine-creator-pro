import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { MagazineCard } from '@/components/magazines/MagazineCard';
import { templates, sampleMagazines } from '@/data/mockData';
import { Plus, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getFeaturedTemplates } from '@/data/featured_templates';

export default function DashboardPage() {
  const [featuredTemplates, setFeaturedTemplates] = useState([]);

  useEffect(() => {
    getFeaturedTemplates(3).then(setFeaturedTemplates);
  }, []);

  const recentMagazines = sampleMagazines.slice(0, 2);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12 animate-slide-up">
        <Card className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-secondary border-0">
          <div className="p-8 md:p-12 lg:p-16">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-gold" />
                <span className="text-sm font-medium text-gold">Start Creating</span>
              </div>
              <h1 className="text-editorial-lg mb-4">
                Turn your photos into <span className="italic">beautiful</span> magazines
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg">
                Choose from our curated templates and upload your photos. We'll do the rest.
              </p>
              <Link to="/templates">
                <Button variant="elegant" size="lg">
                  Create Magazine
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 pointer-events-none hidden lg:block">
            <div className="w-full h-full bg-gold rotate-12 translate-x-1/2 scale-150" />
          </div>
        </Card>
      </section>

      {/* Recent Magazines.. I deleted it */}
      

      {/* Featured Templates.. */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-editorial-md mb-1">Featured Templates</h2>
            <p className="text-muted-foreground">Professionally designed layouts</p>
          </div>
          <Link to="/templates">
            <Button variant="ghost" size="sm">
              See All Templates
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {featuredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      </section>
    </div>
  );
}
