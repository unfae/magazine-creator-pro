// src/pages/studio/Foundation.tsx
// Receives brief from BriefBuilder, calls Claude, shows per-page results.

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, ChevronRight, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface PageFoundation {
  pageNumber:      number;
  title:           string;
  direction:       string;
  visualMetaphor:  string;
  suggestedLayout: string;
  textHints:       string[];
}

interface FoundationResult {
  creativePrompt:      string;
  overallMood:         string;
  colorDirection:      string;
  typographyDirection: string;
  pages:               PageFoundation[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={copy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
      <Copy className="h-3 w-3" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PageCard({ page }: { page: PageFoundation }) {
  const fullText = [
    `Page ${page.pageNumber}: ${page.title}`,
    `Direction: ${page.direction}`,
    `Visual metaphor: ${page.visualMetaphor}`,
    `Suggested layout: ${page.suggestedLayout}`,
    page.textHints?.length ? `Text hints: ${page.textHints.join(' | ')}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
            {page.pageNumber}
          </span>
          <h3 className="font-semibold text-sm leading-snug">{page.title}</h3>
        </div>
        <CopyButton text={fullText} />
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{page.direction}</p>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {page.suggestedLayout}
        </span>
        <span className="text-xs rounded-full bg-gold/10 text-gold px-2.5 py-1 font-medium">
          {page.visualMetaphor}
        </span>
      </div>

      {page.textHints?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text hints</p>
          {page.textHints.map((h, i) => (
            <p key={i} className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">{h}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Foundation() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const brief     = (location.state as any)?.brief;

  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<FoundationResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!brief) return;
    generate();
  }, []); // eslint-disable-line

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-foundation', {
        body: brief,
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setResult(data.foundation);
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Check that ANTHROPIC_API_KEY is set.');
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!result) return;
    const allText = [
      `CREATIVE BRIEF: ${result.creativePrompt}`,
      `\nMOOD: ${result.overallMood}`,
      `COLOUR: ${result.colorDirection}`,
      `TYPOGRAPHY: ${result.typographyDirection}`,
      '\n── PAGES ──',
      ...result.pages.map(p => [
        `\nPage ${p.pageNumber}: ${p.title}`,
        `Direction: ${p.direction}`,
        `Visual: ${p.visualMetaphor}`,
        `Layout: ${p.suggestedLayout}`,
        p.textHints?.length ? `Hints: ${p.textHints.join(' | ')}` : '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    navigator.clipboard.writeText(allText);
    toast.success('All copied to clipboard');
  }

  if (!brief) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">No brief found. Start from the Brief Builder.</p>
        <Link to="/studio/brief"><Button variant="outline">Go to Brief Builder</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Studio</p>
          <h1 className="text-2xl font-semibold tracking-tight">Creative Foundation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{brief.magazineTitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/studio/brief')} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Edit Brief
          </Button>
          {result && (
            <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Claude is reading your brief…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={generate}>Try again</Button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">

          {/* Overview */}
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Creative Prompt</h2>
              <CopyButton text={result.creativePrompt} />
            </div>
            <p className="text-sm leading-relaxed">{result.creativePrompt}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              {[
                ['Mood', result.overallMood],
                ['Colour', result.colorDirection],
                ['Typography', result.typographyDirection],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-xs">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-page results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pages ({result.pages.length})
              </h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyAll}>
                  <Copy className="h-3.5 w-3.5" /> Copy all
                </Button>
                <Button type="button" size="sm" className="gap-1.5"
                  onClick={() => navigate('/studio/page-builder', { state: { brief, foundation: result } })}>
                  Build Pages <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {result.pages.map(page => <PageCard key={page.pageNumber} page={page} />)}
          </div>

        </div>
      )}
    </div>
  );
}