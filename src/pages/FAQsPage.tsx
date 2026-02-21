'use client';

import { useState, useEffect, useMemo } from 'react';
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

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [search, setSearch] = useState('');
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

  const normalizedSearch = search.trim().toLowerCase();

  const filteredFaqs = useMemo(() => {
    if (!normalizedSearch) return faqs;

    return faqs.filter((f) => {
      const question = f.question?.toLowerCase() || '';
      const answer = f.answer?.toLowerCase() || '';

      return question.includes(normalizedSearch) || answer.includes(normalizedSearch);
    });
  }, [faqs, normalizedSearch]);

  const hasSearchResults = !loading && normalizedSearch && filteredFaqs.length === 0;

  return (
    <div className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-foreground mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Have questions about MagznMaker, templates, or how to create your magazine? We’ve got answers.
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-10">
          <div className="relative max-w-lg mx-auto">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all FAQs..."
              className="block w-full rounded-lg border border-input bg-background px-10 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading FAQs...</p>
          </div>
        ) : hasSearchResults ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              No FAQs match your search.
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="flex flex-col gap-4">
            {filteredFaqs.map((faq) => (
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
        )}
      </div>
    </div>
  );
}
