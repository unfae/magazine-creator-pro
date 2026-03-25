// src/pages/studio/BriefBuilder.tsx — dark theme

import { useState, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Wand2, X, Plus } from 'lucide-react';

// ── Shared dark styles ────────────────────────────────────────────────────────
const S = {
  page:    'min-h-screen bg-background text-foreground',
  card:    'rounded-xl border border-border bg-card p-5',
  label:   'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
  input:   'w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors',
  textarea:'w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors resize-none',
  chip:    'flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground',
  pill:    (active: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${active ? 'bg-gold border-gold text-black' : 'border-input text-muted-foreground hover:border-gold hover:text-foreground'}`,
};

// ── Tag input ─────────────────────────────────────────────────────────────────
function TagInput({
  tags, onChange, placeholder, isColor,
}: {
  tags: string[]; onChange: (t: string[]) => void;
  placeholder?: string; isColor?: boolean;
}) {
  const [input, setInput] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1));
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-md border border-input bg-muted p-2 cursor-text focus-within:border-gold transition-colors min-h-[40px]"
      onClick={() => ref.current?.focus()}
    >
      {tags.map(t => (
        <span key={t} className={S.chip}>
          {isColor && (
            <span className="w-3 h-3 rounded-full border border-white/20 inline-block mr-1 shrink-0"
              style={{ background: t.startsWith('#') ? t : undefined }} />
          )}
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
            className="ml-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => input.trim() && add()}
        placeholder={tags.length ? '' : (placeholder ?? 'Type and press Enter')}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
      />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={S.card + ' space-y-4'}>
      <h2 className="text-[10px] font-bold text-gold uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={S.label}>{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground/80 -mt-1 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PRESET_TYPES = ['Personal', 'Fashion', 'Travel', 'Brand', 'Portfolio', 'Editorial', 'Lifestyle', 'Wedding', 'Baby/Family'];
const WORD_MASK_TYPES = ['single line', '2 lines', '3 lines', '4 lines'];
const WORD_MASK_DIRS = ['horizontal', 'vertical', 'diagonal'];
const TYPO_CATS = ['Display / Title', 'Condensed / Label', 'Body / Reading', 'Accent / Mono'] as const;
type TypoCat = typeof TYPO_CATS[number];

export default function BriefBuilder() {
  const navigate = useNavigate();

  const [magazineType, setMagazineType]   = useState('Personal');
  const [customType, setCustomType]       = useState('');
  const [magazineTitle, setMagazineTitle] = useState('');
  const [description, setDescription]    = useState('');
  const [audience, setAudience]           = useState('');
  const [aim, setAim]                     = useState('');
  const [concepts, setConcepts]           = useState('');
  const [pageCount, setPageCount]         = useState(10);
  const [accentColors, setAccentColors]   = useState<string[]>([]);
  const [wordMaskWord, setWordMaskWord]   = useState('');
  const [wordMaskType, setWordMaskType]   = useState('single line');
  const [wordMaskDir, setWordMaskDir]     = useState('horizontal');
  const [typography, setTypography]       = useState<Record<TypoCat, string[]>>({
    'Display / Title':    [],
    'Condensed / Label':  [],
    'Body / Reading':     [],
    'Accent / Mono':      [],
  });

  const effectiveType = magazineType === 'Others' ? customType : magazineType;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!magazineTitle.trim()) return;
    navigate('/studio/foundation', {
      state: {
        brief: {
          magazineType:        effectiveType,
          magazineTitle,
          magazineDescription: description,
          targetAudience:      audience,
          magazineAim:         aim,
          pageConceptIdeas:    concepts,
          accentColorHint:     accentColors.join(', '),
          pageCount,
          wordMaskWord,
          wordMaskType,
          wordMaskDirection: wordMaskDir,
          typographyFamilies: {
            display:   typography['Display / Title'].join(', '),
            condensed: typography['Condensed / Label'].join(', '),
            body:      typography['Body / Reading'].join(', '),
            mono:      typography['Accent / Mono'].join(', '),
          },
          typographyDisplay:   typography['Display / Title'].join(', '),
          typographyCondensed: typography['Condensed / Label'].join(', '),
          typographyBody:      typography['Body / Reading'].join(', '),
          typographyMono:      typography['Accent / Mono'].join(', '),
        },
      },
    });
  }

  return (
    <div className={S.page}>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <p className="text-[10px] text-gold uppercase tracking-widest mb-1">Studio</p>
          <h1 className="text-2xl font-semibold">Brief Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in the creative brief. Claude generates page titles, visual metaphors and a creative prompt.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Identity */}
          <Section title="Magazine Identity">
            <Field label="Magazine type">
              <div className="flex flex-wrap gap-2">
                {[...PRESET_TYPES, 'Others'].map(t => (
                  <button key={t} type="button" onClick={() => setMagazineType(t)}
                    className={S.pill(magazineType === t)}>
                    {t}
                  </button>
                ))}
              </div>
              {magazineType === 'Others' && (
                <input value={customType} onChange={e => setCustomType(e.target.value)}
                  placeholder="Describe the magazine type…"
                  className={S.input + ' mt-2'} />
              )}
            </Field>

            <Field label="Magazine title" hint='"Uncommon", "Volume I", "Made by Amara"'>
              <input value={magazineTitle} onChange={e => setMagazineTitle(e.target.value)}
                placeholder="Enter title…" required className={S.input} />
            </Field>

            <Field label="Description" hint="1–3 sentences on what this captures and celebrates">
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="This magazine captures…" className={S.textarea} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Target audience" hint="Identity, values, aesthetic">
                <textarea rows={2} value={audience} onChange={e => setAudience(e.target.value)}
                  placeholder="Young creative women who…" className={S.textarea} />
              </Field>
              <Field label="Magazine aim" hint="How the reader should feel after the last page">
                <textarea rows={2} value={aim} onChange={e => setAim(e.target.value)}
                  placeholder="Inspired, seen, celebrated…" className={S.textarea} />
              </Field>
            </div>

            <Field label="Total pages">
              <input type="number" min={4} max={30} value={pageCount}
                onChange={e => setPageCount(Number(e.target.value))}
                className={S.input + ' w-24'} />
            </Field>
          </Section>

          {/* Page concepts */}
          <Section title="Page Concepts">
            <Field label="Loose page ideas" hint="10–20 ideas, one per line">
              <textarea rows={8} value={concepts} onChange={e => setConcepts(e.target.value)}
                placeholder={"Cover — strong portrait, editorial stance\nA quote page about growth\n…"}
                className={S.textarea} />
            </Field>
          </Section>

          {/* Style */}
          <Section title="Style Direction">
            <Field label="Accent / palette colours" hint="Type a hex code or colour name and press Enter">
              <TagInput tags={accentColors} onChange={setAccentColors}
                placeholder="#C69339 or 'deep burgundy'" isColor />
            </Field>

            <div>
              <label className={S.label}>Typography families</label>
              <p className="text-[11px] text-muted-foreground/80 mb-3">Type a font family name and press Enter to add. Add multiple per category.</p>
              <div className="space-y-3">
                {TYPO_CATS.map(cat => (
                  <div key={cat}>
                    <p className="text-[11px] text-muted-foreground mb-1">{cat}</p>
                    <TagInput
                      tags={typography[cat]}
                      onChange={v => setTypography(prev => ({ ...prev, [cat]: v }))}
                      placeholder="e.g. Playfair Display"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Word mask */}
          <Section title="Word Mask">
            <Field label="Mask word" hint="One strong word, e.g. LIVE, BOLD, MADE">
              <input value={wordMaskWord} onChange={e => setWordMaskWord(e.target.value.toUpperCase())}
                placeholder="BOLD" className={S.input} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Line count">
                <div className="flex flex-wrap gap-2">
                  {WORD_MASK_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setWordMaskType(t)}
                      className={S.pill(wordMaskType === t)}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Direction">
                <div className="flex flex-wrap gap-2">
                  {WORD_MASK_DIRS.map(d => (
                    <button key={d} type="button" onClick={() => setWordMaskDir(d)}
                      className={S.pill(wordMaskDir === d)}>{d}</button>
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          <button type="submit"
            disabled={!magazineTitle.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold text-black font-semibold py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/90 transition-colors">
            <Wand2 className="h-4 w-4" />
            Generate Creative Foundation
            <ChevronRight className="h-4 w-4 ml-auto" />
          </button>
        </form>
      </div>
    </div>
  );
}