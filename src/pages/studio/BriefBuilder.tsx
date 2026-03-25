// src/pages/studio/BriefBuilder.tsx
// Internal tool — unlisted route /studio/brief
// Collects all inputs for a magazine brief and passes them to /studio/foundation

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Wand2 } from 'lucide-react';

const MAGAZINE_TYPES = ['Personal', 'Fashion', 'Travel', 'Brand', 'Portfolio', 'Editorial', 'Lifestyle', 'Wedding', 'Baby/Family'];
const WORD_MASK_TYPES = ['single line', '2 lines', '3 lines', '4 lines'];
const WORD_MASK_DIRECTIONS = ['horizontal', 'vertical', 'diagonal'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export default function BriefBuilder() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    magazineType:        'Personal',
    magazineTitle:       '',
    magazineDescription: '',
    targetAudience:      '',
    magazineAim:         '',
    pageConceptIdeas:    '',
    accentColorHint:     '',
    pageCount:           10,
    wordMaskWord:        '',
    wordMaskType:        'single line' as string,
    wordMaskDirection:   'horizontal' as string,
    typographyDisplay:   '',
    typographyCondensed: '',
    typographyBody:      '',
    typographyMono:      '',
  });

  const set = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.magazineTitle.trim()) return;

    const typographyFamilies = {
      display:   form.typographyDisplay,
      condensed: form.typographyCondensed,
      body:      form.typographyBody,
      mono:      form.typographyMono,
    };

    // Pass brief data via router state → Foundation page
    navigate('/studio/foundation', {
      state: { brief: { ...form, typographyFamilies } },
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Brief Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the creative brief. Claude will generate page titles, visual metaphors and a creative prompt.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Identity ── */}
        <Section title="Magazine Identity">
          <Field label="Magazine type">
            <div className="flex flex-wrap gap-2">
              {MAGAZINE_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => set('magazineType', t)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    form.magazineType === t
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Magazine title" hint='e.g. "Uncommon", "Volume I", "Made by Amara"'>
            <Input value={form.magazineTitle}
              onChange={e => set('magazineTitle', e.target.value)}
              placeholder="Enter title…" required />
          </Field>

          <Field label="Description" hint="1–3 sentences on what this captures and celebrates">
            <Textarea rows={3} value={form.magazineDescription}
              onChange={e => set('magazineDescription', e.target.value)}
              placeholder="This magazine captures…" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Target audience" hint="Who reads this — identity, values, aesthetic">
              <Textarea rows={2} value={form.targetAudience}
                onChange={e => set('targetAudience', e.target.value)}
                placeholder="Young creative women who…" />
            </Field>
            <Field label="Magazine aim" hint="How the reader should feel after the last page">
              <Textarea rows={2} value={form.magazineAim}
                onChange={e => set('magazineAim', e.target.value)}
                placeholder="Inspired, seen, celebrated…" />
            </Field>
          </div>

          <Field label="Total pages">
            <Input type="number" min={4} max={30} value={form.pageCount}
              onChange={e => set('pageCount', Number(e.target.value))}
              className="w-32" />
          </Field>
        </Section>

        {/* ── Page concepts ── */}
        <Section title="Page Concepts">
          <Field label="Loose page ideas"
            hint="10–20 ideas in natural language — one per line. e.g. 'a spread of her in a red coat on the street', 'a quote page about growth'">
            <Textarea rows={8} value={form.pageConceptIdeas}
              onChange={e => set('pageConceptIdeas', e.target.value)}
              placeholder={"Cover — strong portrait, editorial stance\nOpening spread — city skyline at golden hour\nA quote page…"} />
          </Field>
        </Section>

        {/* ── Style ── */}
        <Section title="Style Direction">
          <Field label="Accent colour hint" hint="Optional — a colour name, hex code, or description">
            <Input value={form.accentColorHint}
              onChange={e => set('accentColorHint', e.target.value)}
              placeholder="Deep burgundy #7C1E2E, or 'warm gold and black'" />
          </Field>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Typography</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['typographyDisplay',   'Display / Title',    'e.g. Playfair Display, Cormorant'],
              ['typographyCondensed', 'Condensed / Label',  'e.g. Bebas Neue, Barlow Condensed'],
              ['typographyBody',      'Body / Reading',     'e.g. DM Sans, Cormorant Garamond'],
              ['typographyMono',      'Accent / Mono',      'e.g. Space Mono, IBM Plex Mono'],
            ].map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[key]}
                  onChange={e => set(key as any, e.target.value)}
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Word mask ── */}
        <Section title="Word Mask">
          <Field label="Mask word" hint="One strong word used for text-masked image pages, e.g. LIVE, BOLD, MADE">
            <Input value={form.wordMaskWord}
              onChange={e => set('wordMaskWord', e.target.value.toUpperCase())}
              placeholder="BOLD" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Line count">
              <div className="flex flex-wrap gap-2">
                {WORD_MASK_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => set('wordMaskType', t)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      form.wordMaskType === t
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Direction">
              <div className="flex flex-wrap gap-2">
                {WORD_MASK_DIRECTIONS.map(d => (
                  <button key={d} type="button"
                    onClick={() => set('wordMaskDirection', d)}
                    className={`px-3 py-1 text-xs rounded-full border capitalize transition-colors ${
                      form.wordMaskDirection === d
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        <Button type="submit" className="w-full gap-2" size="lg"
          disabled={!form.magazineTitle.trim()}>
          <Wand2 className="h-4 w-4" />
          Generate Creative Foundation
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>

      </form>
    </div>
  );
}