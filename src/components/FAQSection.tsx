'use client';

import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) setFaqs(data);
      setLoading(false);
    };

    fetchFaqs();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading FAQs...</p>
      </div>
    );
  }

  if (faqs.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>

      <Accordion type="single" collapsible>
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
            <AccordionTrigger
              className={cn(
                'text-left',
                faq.is_featured && 'text-primary font-medium'
              )}
            >
              {faq.question}
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground whitespace-pre-line">{faq.answer}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
