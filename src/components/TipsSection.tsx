// components/TipsSection.tsx

import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

const tips = [
  {
    title: 'Use the samples as a guide',
    content: 'Check the sample texts and images to choose your own best‑fit photos and wording.',
    number: 1,
  },
  {
    title: 'Review before exporting',
    content:
      'After generating your magazine, preview the pages carefully before exporting the magazine to guarantee the best result.',
    number: 2,
  },
  {
    title: 'Fill all text first',
    content:
      'Type and apply all your text in the Bulk Text Edit section before uploading images, so you can focus on layout and photos.',
    number: 3,
  },
  {
    title: 'Upload many images at once',
    content:
      'Upload several images in bulk first, then replace only the slots that need special photos to save time and get it right.',
    number: 4,
  },
  {
    title: 'Crop before uploading',
    content:
      'If you need tighter framing or better composition, crop your images first, then upload or replace them.',
    number: 5,
  },
  {
    title: 'On Iphone; download one image at a time',
    content:
      'On iPhone, download page images one after the other, as the browser does not allow multiple downloads at once.',
    number: 6,
  },
];

export function TipsSection() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-editorial-md text-foreground">
              Tips to get the best from the magazine creator
            </h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Make the most of the magazine creator with these simple best practices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tips.map((tip) => (
            <Card
              key={tip.number}
              className="group p-5 border border-border/60 bg-card hover:border-gold/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/15 text-gold flex items-center justify-center font-medium text-sm">
                  {tip.number}
                </span>
                <h3 className="font-serif text-base font-medium text-foreground flex items-center gap-1 leading-tight">
                  {tip.title}
                  <Sparkles
                    className="w-3.5 h-3.5 text-muted-foreground group-hover:text-gold transition-colors"
                  />
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{tip.content}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
