// src/pages/MagazinesPage.tsx

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Filter, Pencil, FileText, Video, BookOpen, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FilterType = 'all' | 'draft' | 'exported';

interface Magazine {
  id: string;
  title: string;
  template_id: string;
  template_slug: string | null;
  template_name: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  export_type: string | null;
  created_at: string;
  updated_at: string;
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({ open, title, onConfirm, onCancel }: {
  open: boolean; title: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base">Delete magazine?</h3>
        <p className="text-sm text-muted-foreground">
          "<span className="font-medium text-foreground">{title || 'Untitled'}</span>" will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-input hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button" onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function MagazineCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="aspect-[3/4] w-full bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-8 w-full rounded-lg bg-muted mt-2" />
      </div>
    </div>
  );
}

// ── Magazine card ─────────────────────────────────────────────────────────────
function MagazineCard({ magazine, onEdit, onDelete }: {
  magazine: Magazine;
  onEdit:   (m: Magazine) => void;
  onDelete: (m: Magazine) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isExported = magazine.is_published || !!magazine.export_type;
  const exportIcon = magazine.export_type === 'video'
    ? <Video className="h-3 w-3" />
    : magazine.export_type === 'pdf'
    ? <FileText className="h-3 w-3" />
    : null;

  const dateStr = new Date(magazine.updated_at || magazine.created_at)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-xl border bg-card overflow-hidden group hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full bg-muted overflow-hidden">
        {magazine.thumbnail_url ? (
          <img
            src={magazine.thumbnail_url}
            alt={magazine.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge */}
        <span className={cn(
          'absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm',
          isExported ? 'bg-gold/80 text-black' : 'bg-black/60 text-white'
        )}>
          {exportIcon}
          {isExported ? (magazine.export_type?.toUpperCase() ?? 'Exported') : 'Draft'}
        </span>

        {/* 3-dot menu */}
        <div className="absolute top-1.5 right-1.5">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border bg-card shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(magazine); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {magazine.title || 'Untitled'}
        </p>
        <p className="text-xs text-muted-foreground">
          {magazine.template_name || 'Template'} · {dateStr}
        </p>
        <Button
          size="sm" variant="outline"
          className="w-full mt-1 gap-2 text-xs"
          onClick={() => onEdit(magazine)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit & Export
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MagazinesPage() {
  const navigate = useNavigate();

  const [filter, setFilter]           = useState<FilterType>('all');
  const [magazines, setMagazines]     = useState<Magazine[]>([]);
  const [loading, setLoading]         = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Magazine | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('You must be signed in to view magazines');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('magazines')
        .select('id, title, template_id, template_slug, template_name, thumbnail_url, is_published, export_type, created_at, updated_at')
        .eq('owner', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching magazines:', error);
        toast.error('Failed to load magazines');
        setLoading(false);
        return;
      }

      if (mounted) {
        setMagazines((data as Magazine[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('magazine_pages').delete().eq('magazine_id', deleteTarget.id);
      const { error } = await supabase.from('magazines').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setMagazines(prev => prev.filter(m => m.id !== deleteTarget.id));
      toast.success('Magazine deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete magazine');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function handleEdit(magazine: Magazine) {
    const slug = magazine.template_slug || magazine.template_id;
    navigate(`/create/${slug}?magazine=${magazine.id}`);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = magazines.filter(m => {
    const isExported = m.is_published || !!m.export_type;
    if (filter === 'all')      return true;
    if (filter === 'draft')    return !isExported;
    if (filter === 'exported') return isExported;
    return true;
  });

  const draftCount    = magazines.filter(m => !m.is_published && !m.export_type).length;
  const exportedCount = magazines.filter(m =>  m.is_published ||  !!m.export_type).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">My Magazines</h1>
          <p className="text-sm text-muted-foreground">
            {magazines.length} total · {draftCount} draft{draftCount !== 1 ? 's' : ''} · {exportedCount} exported
          </p>
        </div>
        <Link to="/templates">
          <Button variant="gold">
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {(['all', 'draft', 'exported'] as FilterType[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-full transition-all capitalize',
              filter === f
                ? 'bg-foreground text-background'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <MagazineCardSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(m => (
            <MagazineCard
              key={m.id}
              magazine={m}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            {filter === 'all' ? 'No magazines yet' : `No ${filter} magazines`}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            {filter === 'all'
              ? 'Start creating your first magazine from a template'
              : `You don't have any ${filter} magazines yet`}
          </p>
          <Link to="/templates">
            <Button variant="gold">Browse Templates</Button>
          </Link>
        </div>
      )}

      {/* Delete confirmation modal */}
      <DeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.title ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  );
}