'use client';

import { useState, useEffect } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Faq {
  id: number;
  question: string;
  answer: string;
  is_featured: boolean;
  is_active: boolean;
}

export function FAQSection() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false });

      if (!error && data) setFaqs(data);
      setLoading(false);
    };

    fetchFaqs();
  }, []);

  if (loading) {
    return (
      <div className="py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <p className="text-muted-foreground">Loading FAQs...</p>
        </div>
      </div>
    );
  }

  if (faqs.length === 0) {
    return null;
  }

  return (
    <div className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-editorial-md text-foreground mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Quick answers to common questions about MagznMaker and templates.
          </p>
        </div>

        <div className="mb-8">
          <Accordion type="single" collapsible className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
                <AccordionTrigger
                  className={cn(
                    'text-left text-base font-medium',
                    faq.is_featured && 'text-primary'
                  )}
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="text-center">
          <a
            href="/faqs"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            See all FAQs
          </a>
        </div>
      </div>
    </div>
  );
}
