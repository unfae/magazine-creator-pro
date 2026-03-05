import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Mail, Handshake } from 'lucide-react';
import { useState } from 'react';

const ctas = [
  {
    icon: Sparkles,
    heading: 'Need a different template?',
    description: "Don't see what you're looking for? Request one and we'll create it for you.",
    buttonLabel: 'Request a Template',
    href: '/template-request',
  },
  {
    icon: Mail,
    heading: 'Got complaints or feedback?',
    description: "We're always looking to improve. Reach out and let us know how we can do better.",
    buttonLabel: 'Contact Us',
    href: '/contact',
  },
  {
    icon: Handshake,
    heading: 'Interested in partnering?',
    description: "We're open to collaborations, sponsorships, and affiliates. Let's build something together.",
    buttonLabel: 'Partner With Us',
    href: '/partner',
  },
];

export function CTASection() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-editorial-md mb-2">How can we help?</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Whether you need support, have an idea, or want to work with us — we're here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ctas.map((cta, i) => {
            const Icon = cta.icon;
            const isHovered = hovered === i;

            return (
              <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={`
                  group relative rounded-xl border bg-card p-6 flex flex-col gap-4
                  cursor-pointer transition-all duration-300
                  ${isHovered
                    ? 'border-gold/50 shadow-gold -translate-y-1'
                    : 'border-border hover:border-gold/30'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-300
                  ${isHovered ? 'bg-gold text-primary-foreground' : 'bg-gold/10 text-gold'}
                `}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Text */}
                <div className="flex-1">
                  <h3 className="font-serif text-lg font-medium text-foreground mb-1">
                    {cta.heading}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cta.description}
                  </p>
                </div>

                {/* Button */}
                <Link to={cta.href}>
                  <Button
                    variant={isHovered ? 'gold' : 'outline'}
                    size="sm"
                    className="w-full transition-all duration-300"
                  >
                    {cta.buttonLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                {/* Subtle glow on hover */}
                {isHovered && (
                  <div className="absolute inset-0 rounded-xl bg-gold/5 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}