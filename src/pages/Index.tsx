import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Sparkles, Image } from 'lucide-react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { getFeaturedTemplates } from '@/data/featured_templates';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'



export default function Index() {
  
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const [featuredTemplates, setFeaturedTemplates] = useState([]);

  useEffect(() => {
    getFeaturedTemplates(3).then(setFeaturedTemplates);
  }, []);


  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section... */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-gold" />
              <span className="text-sm font-medium tracking-wide uppercase text-gold">
                Photo to Magazine
              </span>
            </div>

            <h1 className="text-editorial-lg mb-6">
              Transform your photos into <span className="italic">stunning</span> magazines
            </h1>

            <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
              Choose a template, upload your pictures, and watch your memories come to life in beautifully designed magazine layouts.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button variant="elegant" size="xl">
                  Get Started Free
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="xl">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-editorial-md mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Create professional-looking magazines in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto stagger-children">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-7 w-7 text-gold" />
              </div>
              <h3 className="font-serif text-xl mb-2">1. Choose Template</h3>
              <p className="text-muted-foreground text-sm">
                Browse our collection of professionally designed magazine templates
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <Image className="h-7 w-7 text-gold" />
              </div>
              <h3 className="font-serif text-xl mb-2">2. Upload Photos</h3>
              <p className="text-muted-foreground text-sm">
                Add your favorite photos and we'll arrange them beautifully
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-gold" />
              </div>
              <h3 className="font-serif text-xl mb-2">3. Generate & Share</h3>
              <p className="text-muted-foreground text-sm">
                Your magazine is instantly created and ready to share or print
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ⭐ Featured Templates */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-editorial-md mb-1">Featured Templates</h2>
              <p className="text-muted-foreground">
                Professionally designed layouts to get you started
              </p>
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
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-editorial-md mb-4">
            Ready to create your first magazine?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join several others making beautiful photo magazines
          </p>
          <Link to="/auth">
            <Button variant="gold" size="xl">
              Start Creating
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
