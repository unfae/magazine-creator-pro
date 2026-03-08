import { useState } from 'react';
import { Sparkles, Play, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useVideoAccess } from '@/hooks/useVideoAccess';
import { useVideoExport } from '@/hooks/useVideoExport';
import { VIDEO_TRANSITIONS, TransitionId } from '@/lib/videoTransitions';
import { cn } from '@/lib/utils';

const VIDEO_PRICE = 1000; // ₦1,000 for video export on free templates

interface VideoExportDialogProps {
  template: any;
  templatePages: any[];
  renderPageToImageUrl: (pg: any) => Promise<string | null>;
  disabled?: boolean;
  refetchKey?: number; // increment from parent to force video access re-check
}

export function VideoExportDialog({
  template,
  templatePages,
  renderPageToImageUrl,
  disabled = false,
  refetchKey = 0,
}: VideoExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<TransitionId>('fade');
  const [isExporting, setIsExporting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const { hasVideoAccess, checkingVideo } = useVideoAccess(template, refetchKey);
  const { exportVideo } = useVideoExport();

  const isPaidTemplate = (template?.price ?? 0) > 0;

  // ─── Handle video-only payment (free template) ───────────────────────────────
  const handleUnlockVideo = async () => {
    setIsUnlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }

      const { data, error } = await supabase.functions.invoke('init-paystack', {
        body: {
          templateId: template.id,
          templateSlug: template.slug,
          amount: VIDEO_PRICE,
          videoOnly: true,   // tells init-paystack this is a video-only payment
        },
      });

      if (error) throw error;

      const authorizationUrl = data?.data?.authorization_url;
      if (!authorizationUrl) {
        toast.error('Could not initiate payment. Please try again.');
        return;
      }

      window.location.href = authorizationUrl;
    } catch (e: any) {
      if (e instanceof FunctionsHttpError) {
        const body = await e.context.json();
        toast.error(body?.error || 'Payment failed. Please try again.');
      } else {
        toast.error(e?.message || 'Payment failed. Please try again.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // ─── Handle actual video export ───────────────────────────────────────────────
  const handleExport = async () => {
    if (templatePages.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsExporting(true);
    setOpen(false); // close dialog — progress shows in toast

    const SUBTITLE = 'Kindly hold on briefly while your video is being prepared...';
    let progress = 0;

    const toastId = toast.loading(`Generating Video... ${progress}%`, {
      position: 'top-left',
      duration: Infinity,
      description: SUBTITLE,
    });

    let stopTick = false;
    const tick = setInterval(() => {
      if (stopTick) return;
      progress = Math.min(progress + 1, 45);
      toast.loading(`Generating Video... ${progress}%`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: SUBTITLE,
      });
    }, 900);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        stopTick = true;
        clearInterval(tick);
        toast.error('Sign in required.', { id: toastId });
        return;
      }

      const maxPages = Math.min(templatePages.length, 8);
      const renderedUrls: (string | null)[] = [];

      for (let i = 0; i < maxPages; i++) {
        const url = await renderPageToImageUrl(templatePages[i]);
        renderedUrls.push(url);
      }

      const pageUrls = renderedUrls.filter((u): u is string => !!u);

      if (pageUrls.length === 0) {
        stopTick = true;
        clearInterval(tick);
        toast.error('Failed to prepare pages. Please try again.', { id: toastId });
        return;
      }

      stopTick = true;
      clearInterval(tick);
      progress = 50;
      toast.loading(`Generating Video... ${progress}%`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: SUBTITLE,
      });

      await exportVideo(pageUrls, template, user.id, toastId, progress, selectedTransition);

    } catch (err: any) {
      stopTick = true;
      clearInterval(tick);
      toast.error(`Video export failed`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: 'Something went wrong. Please try again or contact us.',
        action: {
          label: 'Contact Us',
          onClick: () => window.open('/contact', '_blank'),
        },
      });
    } finally {
      stopTick = true;
      clearInterval(tick);
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="gold"
          size="sm"
          disabled={disabled || templatePages.length === 0}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Export Video
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            Export as Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Transition picker ───────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-medium mb-3">Choose a transition</p>
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
              {VIDEO_TRANSITIONS.map((t) => {
                const isSelected = selectedTransition === t.id;
                const isCinematic = t.id === 'cinematic';
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTransition(t.id)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border p-2.5 text-center transition-all',
                      'flex-shrink-0 w-[30%] min-w-[90px] snap-start',
                      isSelected
                        ? 'border-gold bg-gold/5 ring-1 ring-gold'
                        : 'border-border hover:border-gold/40 hover:bg-muted/50'
                    )}
                  >
                    {/* GIF preview or placeholder */}
                    <div className="w-full aspect-[9/12] rounded-md bg-muted overflow-hidden flex items-center justify-center relative">
                      {t.gifUrl ? (
                        <img
                          src={t.gifUrl}
                          alt={t.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play
                          className={cn(
                            'h-5 w-5',
                            isSelected ? 'text-gold' : 'text-muted-foreground'
                          )}
                        />
                      )}
                      {isCinematic && (
                        <span className="absolute top-1 right-1 bg-gold text-black text-[9px] font-bold px-1 py-0.5 rounded leading-none">
                          PRO
                        </span>
                      )}
                    </div>

                    <div>
                      <p className={cn('text-xs font-semibold', isSelected && 'text-gold')}>
                        {t.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Access / payment section ─────────────────────────────────────── */}
          {checkingVideo ? (
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
          ) : hasVideoAccess ? (
            // Access confirmed — show export button
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>
                  {isPaidTemplate
                    ? 'Video export included with your template purchase.'
                    : 'Video export unlocked.'}
                </span>
              </div>
              <Button
                variant="gold"
                className="w-full"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isExporting ? 'Preparing…' : 'Export Video'}
              </Button>
            </div>
          ) : isPaidTemplate ? (
            // Paid template but no video_unlocked yet — template itself not purchased
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Unlock template first</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Purchase this template to get video export included at no extra cost. Kindly Refresh if you paid already.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Free template — needs ₦1,000 video payment
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Video export — ₦1,000</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One-time payment for this template. Paid templates include video export for free.
                  </p>
                </div>
              </div>
              <Button
                variant="gold"
                className="w-full"
                onClick={handleUnlockVideo}
                disabled={isUnlocking}
              >
                {isUnlocking ? 'Redirecting…' : 'Unlock Video Export — ₦1,000'}
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}