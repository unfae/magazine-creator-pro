// src/pages/studio/Foundation.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, ChevronRight, Loader2, RefreshCw, ArrowLeft, Download, Grid } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface BriefData {
  magazineTitle:       string;
  magazineType:        string;
  accentColorHint:     string;
  typographyDisplay:   string;
  typographyCondensed: string;
  typographyBody:      string;
  typographyMono:      string;
  pageCount:           number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return [198, 147, 57];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

// Detect dominant bg intent from colorDirection text
function parseBg(colorDirection: string, accent: string): { bg: string; fg: string; fgMuted: string } {
  const lower = colorDirection.toLowerCase();
  if (lower.includes('dark') || lower.includes('black') || lower.includes('deep')) {
    return { bg: '#141414', fg: '#F5F0E8', fgMuted: '#8a8a7a' };
  }
  if (lower.includes('cream') || lower.includes('ivory') || lower.includes('warm white')) {
    return { bg: '#FAF7F2', fg: '#1A1A1A', fgMuted: '#7a7a6a' };
  }
  return { bg: '#FFFFFF', fg: '#111111', fgMuted: '#888880' };
}

function extractFont(fonts: string): string {
  return fonts?.split(',')[0]?.trim() || 'Georgia';
}

// ── Page Mockup Renderer ─────────────────────────────────────────────────────
// Renders a 400×566 px visual mockup of a magazine page.
// Actual layout varies by suggestedLayout type.

const PAGE_W = 400;
const PAGE_H = 566;

interface MockupProps {
  page:           PageFoundation;
  brief:          BriefData;
  colorDirection: string;
}

function ImageRect({ x, y, w, h, opacity = 0.18, style = {} }: {
  x: number; y: number; w: number; h: number; opacity?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      background: `rgba(180,170,155,${opacity})`,
      ...style,
    }} />
  );
}

function PageMockup({ page, brief, colorDirection }: MockupProps) {
  const accent  = brief.accentColorHint?.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#C69339';
  const theme   = parseBg(colorDirection, accent);
  const displayFont  = extractFont(brief.typographyDisplay)  || 'Georgia';
  const bodyFont     = extractFont(brief.typographyBody)     || 'Georgia';
  const condensedFont = extractFont(brief.typographyCondensed) || 'Georgia';
  const monoFont     = extractFont(brief.typographyMono)     || 'monospace';

  const layout = page.suggestedLayout?.toLowerCase() ?? '';
  const title  = page.title;
  const metaphor = page.visualMetaphor;
  const hint1  = page.textHints?.[0] ?? '';
  const hint2  = page.textHints?.[1] ?? '';
  const pageNum = String(page.pageNumber).padStart(2, '0');

  const base: React.CSSProperties = {
    position: 'relative',
    width: PAGE_W,
    height: PAGE_H,
    overflow: 'hidden',
    background: theme.bg,
    flexShrink: 0,
  };

  // ── Pagination line (appears on all pages) ────────────────────────────────
  const pagination = (
    <div style={{
      position: 'absolute', bottom: 14, left: 20, right: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ height: 1, flex: 1, background: `${theme.fg}20` }} />
      <span style={{ fontFamily: monoFont, fontSize: 9, color: theme.fgMuted, margin: '0 10px', letterSpacing: 2 }}>
        {pageNum}
      </span>
      <div style={{ height: 1, flex: 1, background: `${theme.fg}20` }} />
    </div>
  );

  // ── COVER ─────────────────────────────────────────────────────────────────
  if (layout.includes('cover') || layout.includes('full-bleed')) {
    return (
      <div style={base}>
        {/* Full bleed image placeholder */}
        <ImageRect x={0} y={0} w={PAGE_W} h={PAGE_H} opacity={0.22} />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to bottom, transparent 30%, ${theme.bg}ee 75%, ${theme.bg} 100%)`,
        }} />
        {/* Accent line top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
        {/* Magazine name */}
        <div style={{
          position: 'absolute', top: 22, left: 22, right: 22,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: condensedFont, fontSize: 11, letterSpacing: 4, color: theme.fgMuted, textTransform: 'uppercase' }}>
            {brief.magazineType}
          </span>
          <span style={{ fontFamily: monoFont, fontSize: 9, color: accent }}>
            {pageNum}
          </span>
        </div>
        {/* Title block */}
        <div style={{ position: 'absolute', bottom: 52, left: 24, right: 24 }}>
          <div style={{ height: 1.5, width: 32, background: accent, marginBottom: 14 }} />
          <div style={{ fontFamily: displayFont, fontSize: 26, fontWeight: 700, color: theme.fg, lineHeight: 1.2, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.fgMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
            {metaphor}
          </div>
        </div>
      </div>
    );
  }

  // ── SPLIT ─────────────────────────────────────────────────────────────────
  if (layout.includes('split') || layout.includes('half')) {
    return (
      <div style={base}>
        {/* Left — image */}
        <ImageRect x={0} y={0} w={PAGE_W * 0.48} h={PAGE_H} opacity={0.22} />
        {/* Right — text */}
        <div style={{ position: 'absolute', left: PAGE_W * 0.52, top: 0, right: 0, bottom: 0, padding: '32px 20px' }}>
          <div style={{ fontFamily: monoFont, fontSize: 8, color: accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>
            {pageNum}
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 700, color: theme.fg, lineHeight: 1.2, marginBottom: 14 }}>
            {title}
          </div>
          <div style={{ height: 1, background: `${accent}60`, marginBottom: 14 }} />
          <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.fgMuted, lineHeight: 1.7, marginBottom: 16 }}>
            {metaphor}
          </div>
          {hint1 && (
            <div style={{ fontFamily: bodyFont, fontSize: 9, color: theme.fgMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
              {hint1}
            </div>
          )}
        </div>
        {/* Divider line */}
        <div style={{ position: 'absolute', left: PAGE_W * 0.5 - 0.5, top: 40, bottom: 40, width: 1, background: `${theme.fg}15` }} />
        {pagination}
      </div>
    );
  }

  // ── TEXT-HEAVY ────────────────────────────────────────────────────────────
  if (layout.includes('text') || layout.includes('editorial') || layout.includes('quote')) {
    return (
      <div style={base}>
        {/* Small header image */}
        <ImageRect x={0} y={0} w={PAGE_W} h={PAGE_H * 0.28} opacity={0.2} />
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 3, background: accent, opacity: 0.7 }} />
        {/* Text area */}
        <div style={{ position: 'absolute', top: PAGE_H * 0.32, left: 28, right: 28, bottom: 40 }}>
          <div style={{ fontFamily: condensedFont, fontSize: 9, letterSpacing: 4, color: accent, textTransform: 'uppercase', marginBottom: 14 }}>
            {brief.magazineType} · {pageNum}
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 700, color: theme.fg, lineHeight: 1.25, marginBottom: 14 }}>
            {title}
          </div>
          <div style={{ height: 1, width: 24, background: accent, marginBottom: 14 }} />
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, color: theme.fg, lineHeight: 1.75, marginBottom: 14 }}>
            {metaphor}
          </div>
          {hint1 && (
            <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.fgMuted, lineHeight: 1.65, fontStyle: 'italic' }}>
              "{hint1}"
            </div>
          )}
        </div>
        {pagination}
      </div>
    );
  }

  // ── COLLAGE ───────────────────────────────────────────────────────────────
  if (layout.includes('collage') || layout.includes('grid') || layout.includes('mosaic')) {
    const gap = 6;
    const colW = (PAGE_W - gap * 3) / 2;
    return (
      <div style={base}>
        {/* 2×2 image grid top half */}
        <ImageRect x={gap}         y={gap}           w={colW}       h={PAGE_H * 0.35} opacity={0.22} />
        <ImageRect x={gap + colW + gap} y={gap}      w={colW}       h={PAGE_H * 0.22} opacity={0.18} />
        <ImageRect x={gap + colW + gap} y={PAGE_H * 0.25} w={colW} h={PAGE_H * 0.13} opacity={0.15} />
        <ImageRect x={gap} y={PAGE_H * 0.38} w={PAGE_W - gap * 2} h={PAGE_H * 0.15} opacity={0.18} />
        {/* Text below */}
        <div style={{ position: 'absolute', top: PAGE_H * 0.57, left: 24, right: 24, bottom: 40 }}>
          <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 700, color: theme.fg, marginBottom: 10, lineHeight: 1.25 }}>
            {title}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 9.5, color: theme.fgMuted, lineHeight: 1.65, fontStyle: 'italic' }}>
            {metaphor}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: accent }} />
        {pagination}
      </div>
    );
  }

  // ── MINIMAL ───────────────────────────────────────────────────────────────
  if (layout.includes('minimal') || layout.includes('clean') || layout.includes('simple')) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 36px' }}>
          <div style={{ height: 1.5, width: 20, background: accent, marginBottom: 28 }} />
          <div style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 300, color: theme.fg, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 24 }}>
            {title}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.fgMuted, lineHeight: 1.8, fontStyle: 'italic', maxWidth: '90%' }}>
            {metaphor}
          </div>
          {hint1 && (
            <div style={{ marginTop: 20, fontFamily: monoFont, fontSize: 9, color: `${accent}cc`, letterSpacing: 2, textTransform: 'uppercase' }}>
              {hint1}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', top: 22, right: 24, fontFamily: monoFont, fontSize: 9, color: theme.fgMuted, letterSpacing: 2 }}>
          {pageNum}
        </div>
        {pagination}
      </div>
    );
  }

  // ── WORD MASK ─────────────────────────────────────────────────────────────
  if (layout.includes('word') || layout.includes('mask') || layout.includes('type')) {
    return (
      <div style={base}>
        <ImageRect x={0} y={0} w={PAGE_W} h={PAGE_H} opacity={0.2} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, ${theme.bg}cc 0%, ${theme.bg}88 50%, transparent 100%)`,
        }} />
        {/* Big masked word simulation */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: displayFont, fontSize: 72, fontWeight: 900,
            color: 'transparent',
            WebkitTextStroke: `2px ${accent}`,
            letterSpacing: 6, textTransform: 'uppercase', lineHeight: 1,
            userSelect: 'none',
          }}>
            {page.textHints?.[0]?.split(' ')[0] ?? title.split(' ')[0]}
          </div>
        </div>
        {/* Subtitle below */}
        <div style={{ position: 'absolute', bottom: 52, left: 24, right: 24 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.fg, lineHeight: 1.6 }}>
            {metaphor}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
        {pagination}
      </div>
    );
  }

  // ── PORTRAIT ─────────────────────────────────────────────────────────────
  if (layout.includes('portrait') || layout.includes('headshot') || layout.includes('person')) {
    return (
      <div style={base}>
        <ImageRect x={PAGE_W * 0.2} y={24} w={PAGE_W * 0.6} h={PAGE_H * 0.55}
          opacity={0.22} style={{ borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: PAGE_H * 0.62, left: 24, right: 24, bottom: 40 }}>
          <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 700, color: theme.fg, lineHeight: 1.2, marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ height: 1, width: 24, background: accent, marginBottom: 10 }} />
          <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.fgMuted, lineHeight: 1.65, fontStyle: 'italic' }}>
            {metaphor}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: accent }} />
        {pagination}
      </div>
    );
  }

  // ── DEFAULT (full-bleed with text overlay) ────────────────────────────────
  return (
    <div style={base}>
      <ImageRect x={0} y={0} w={PAGE_W} h={PAGE_H * 0.65} opacity={0.22} />
      <div style={{ position: 'absolute', top: PAGE_H * 0.68, left: 24, right: 24, bottom: 40 }}>
        <div style={{ fontFamily: monoFont, fontSize: 8, color: accent, letterSpacing: 3, marginBottom: 12 }}>
          {pageNum} — {brief.magazineType?.toUpperCase()}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 700, color: theme.fg, lineHeight: 1.25, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.fgMuted, lineHeight: 1.7, fontStyle: 'italic' }}>
          {metaphor}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      {pagination}
    </div>
  );
}

// ── Page Card (mockup + controls) ─────────────────────────────────────────────

function PageCard({ page, brief, colorDirection }: {
  page: PageFoundation; brief: BriefData; colorDirection: string;
}) {
  const mockupRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPage() {
    if (!mockupRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mockupRef.current, {
        scale: 3, useCORS: true, logging: false,
        width: PAGE_W, height: PAGE_H,
      });
      const a    = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = `page-${String(page.pageNumber).padStart(2, '0')}-${page.title.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (e) {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function copyText() {
    const t = [
      `Page ${page.pageNumber}: ${page.title}`,
      `Layout: ${page.suggestedLayout}`,
      `Visual: ${page.visualMetaphor}`,
      `Direction: ${page.direction}`,
      page.textHints?.length ? `Hints: ${page.textHints.join(' | ')}` : '',
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(t);
    toast.success('Copied');
  }

  return (
    <div className="space-y-2">
      {/* Page label */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-medium text-muted-foreground">
          <span className="text-foreground">{String(page.pageNumber).padStart(2, '0')}</span>
          {' — '}
          {page.title}
        </p>
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {page.suggestedLayout}
        </span>
      </div>

      {/* Mockup */}
      <div ref={mockupRef} style={{ width: PAGE_W, height: PAGE_H }} className="rounded-lg overflow-hidden shadow-md">
        <PageMockup page={page} brief={brief} colorDirection={colorDirection} />
      </div>

      {/* Direction note */}
      <p className="text-[11px] text-muted-foreground leading-relaxed px-0.5">
        {page.direction}
      </p>

      {/* Actions */}
      <div className="flex gap-3 px-0.5">
        <button type="button" onClick={downloadPage} disabled={downloading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          <Download className="h-3 w-3" />
          {downloading ? 'Saving…' : 'Download page'}
        </button>
        <button type="button" onClick={copyText}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3 w-3" />
          Copy notes
        </button>
      </div>
    </div>
  );
}

// ── Download all pages ────────────────────────────────────────────────────────

async function downloadAllPages(
  pages: PageFoundation[], brief: BriefData, colorDirection: string
) {
  const toastId = toast.loading(`Preparing 0 of ${pages.length} pages…`);
  const html2canvas = (await import('html2canvas')).default;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    toast.loading(`Rendering page ${i + 1} of ${pages.length}…`, { id: toastId });

    // Mount offscreen
    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;`;
    document.body.appendChild(container);

    // We need to render React into this container — simplest approach is to
    // re-use the ref approach. Since this is an internal tool, we just
    // instruct html2canvas to capture the already-rendered card refs.
    // For the "download all" flow, we use a simpler text-only fallback.
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = PAGE_W * 3;
      canvas.height = PAGE_H * 3;
      const ctx = canvas.getContext('2d')!;
      const accent = brief.accentColorHint?.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#C69339';
      const { bg, fg, fgMuted } = parseBg(colorDirection, accent);
      ctx.scale(3, 3);

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, PAGE_W, 3);

      ctx.fillStyle = `${fg}18`;
      ctx.fillRect(0, 0, PAGE_W, PAGE_H * 0.55);

      ctx.fillStyle = fg;
      ctx.font = `700 20px Georgia, serif`;
      ctx.fillText(page.title, 24, PAGE_H * 0.65);

      ctx.fillStyle = fgMuted;
      ctx.font = `italic 10px Georgia, serif`;
      const words = page.visualMetaphor.split(' ');
      let line = ''; let lineY = PAGE_H * 0.72;
      for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > PAGE_W - 48) {
          ctx.fillText(line, 24, lineY);
          line = w + ' '; lineY += 16;
        } else { line = test; }
      }
      ctx.fillText(line, 24, lineY);

      ctx.fillStyle = fgMuted;
      ctx.font = `9px monospace`;
      ctx.fillText(String(page.pageNumber).padStart(2, '0'), PAGE_W / 2 - 6, PAGE_H - 14);

      const a    = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = `page-${String(page.pageNumber).padStart(2, '0')}-${page.title.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 300));
    } finally {
      document.body.removeChild(container);
    }
  }
  toast.success(`${pages.length} pages downloaded`, { id: toastId });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Foundation() {
  const location = useLocation();
  const navigate = useNavigate();
  const brief    = (location.state as any)?.brief as BriefData | undefined;

  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<FoundationResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('single');

  useEffect(() => {
    if (!brief) return;
    generate();
  }, []); // eslint-disable-line

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-foundation', { body: brief });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setResult(data.foundation);
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Is ANTHROPIC_API_KEY set?');
    } finally {
      setLoading(false);
    }
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center"><div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">No brief found. Start from the Brief Builder.</p>
        <Link to="/studio/brief"><Button variant="outline">Go to Brief Builder</Button></Link>
      </div></div>
    );
  }

  const accent = brief.accentColorHint?.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#C69339';

  return (
    <div className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-5xl px-4 py-10">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-1">Studio</p>
          <h1 className="text-2xl font-semibold tracking-tight">Creative Foundation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{brief.magazineTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/studio/brief')} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Edit Brief
          </Button>
          {result && (
            <>
              <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => downloadAllPages(result.pages, brief, result.colorDirection)}
                className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download All
              </Button>
              <Button size="sm" className="gap-1.5"
                onClick={() => navigate('/studio/page-builder', { state: { brief, foundation: result } })}>
                Build Pages <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: accent }} />
          <p className="text-sm text-muted-foreground">Claude is building your foundation…</p>
          <p className="text-xs text-muted-foreground/60">This takes 10–20 seconds for a full magazine</p>
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
        <div className="space-y-8">

          {/* Overview strip */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                ['Mood', result.overallMood],
                ['Colour', result.colorDirection],
                ['Typography', result.typographyDirection],
                ['Creative prompt', result.creativePrompt],
              ].map(([label, value]) => (
                <div key={label} className={label === 'Creative prompt' ? 'sm:col-span-1' : ''}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-xs leading-relaxed line-clamp-3">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pages ({result.pages.length})
            </h2>
            <button type="button"
              onClick={() => setViewMode(v => v === 'grid' ? 'single' : 'grid')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Grid className="h-3.5 w-3.5" />
              {viewMode === 'grid' ? 'List view' : 'Grid view'}
            </button>
          </div>

          {/* Pages — grid or list */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {result.pages.map(page => (
                <div key={page.pageNumber} className="space-y-1.5">
                  <div className="rounded-lg overflow-hidden shadow-sm"
                    style={{ width: '100%', aspectRatio: `${PAGE_W}/${PAGE_H}` }}>
                    <div style={{ transform: `scale(${1})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
                      <PageMockup page={page} brief={brief} colorDirection={result.colorDirection} />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate px-0.5">{page.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {result.pages.map(page => (
                <PageCard
                  key={page.pageNumber}
                  page={page}
                  brief={brief}
                  colorDirection={result.colorDirection}
                />
              ))}
            </div>
          )}

        </div>
      )}
    </div></div>
  );
}