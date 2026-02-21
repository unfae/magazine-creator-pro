import { useState } from 'react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

// Simple layout for the toast
function videoToastContent(progress: number, subtitle?: string, showButton?: boolean, videoUrl?: string): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-semibold text-base">
        Generating Video… {progress}%
      </div>
      <div className="text-xs text-muted-foreground">
        Kindly hold on briefly, the video should be ready in a minute or two. Thank you.
      </div>
      {subtitle && (
        <div className="text-xs">
          {subtitle}
        </div>
      )}
      {showButton && videoUrl && (
        <button
          className="mt-1 inline-flex items-center justify-center rounded bg-foreground px-3 py-1 text-xs font-medium text-background"
          onClick={() => window.open(videoUrl, '_blank')}
        >
          Open Video
        </button>
      )}
    </div>
  );
}

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  // Now expects a toastId (created in handleExportVideo) and a starting progress
  const exportVideo = async (
    pageUrls: string[],
    template: any,
    userId: string,
    toastId: string | number,
    startProgress: number = 50
  ) => {
    if (!pageUrls.length) {
      toast.error('No pages to export', { id: toastId });
      return;
    }

    setIsExportingVideo(true);

    let progress = startProgress;

    // Ensure toast shows our layout at handoff
    toast.custom(
      () => videoToastContent(progress, 'Rendering video…'),
      { id: toastId, position: 'top-left', duration: 0 }
    );

    try {
      const res = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pageUrls,
          userId,
          templateName: template.name,
          templateId: template.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');

      await pollVideoStatus(data.renderId, toastId, progress);
    } catch (err: any) {
      console.error(err);
      toast.custom(
        () => videoToastContent(progress, err.message || 'Video export failed'),
        { id: toastId, position: 'top-left' }
      );
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (
    renderId: string,
    toastId: string | number,
    currentProgress: number
  ) => {
    let progress = currentProgress; // e.g. 50

    const bumpProgress = () => {
      progress = Math.min(progress + 1, 99); // 1% steps up to 99
      toast.custom(
        () => videoToastContent(progress, 'Rendering video…'),
        { id: toastId, position: 'top-left', duration: 0 }
      );
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/video-status?renderId=${encodeURIComponent(renderId)}`);
        const data = await res.json();
        console.log('Poll status:', data);

        if (!res.ok) {
          toast.custom(
            () => videoToastContent(progress, 'Video status check failed. Please try again later.'),
            { id: toastId, position: 'top-left' }
          );
          return;
        }

        const status = data.response?.status;

        if (status === 'done') {
          const videoUrl = data.response.url;

          // Final state: 100%, persistent, with button
          toast.custom(
            () => videoToastContent(100, 'Video is ready.', true, videoUrl),
            { id: toastId, position: 'top-left', duration: 0 }
          );
          return;
        }

        if (status === 'failed') {
          toast.custom(
            () => videoToastContent(progress, data.response.error || 'Video render failed'),
            { id: toastId, position: 'top-left' }
          );
          return;
        }

        bumpProgress();
        setTimeout(poll, 3000);
      } catch (err) {
        console.error('Status poll failed:', err);
        bumpProgress();
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  return { exportVideo, isExportingVideo };
}
