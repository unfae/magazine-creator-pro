import { useState } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  // Accept toastId and startProgress so we keep a single toast
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

    // Ensure toast is in a known state at handoff
    toast.loading(
      `Generating Video... ${progress}%\n\nKindly hold on briefly while your video is being prepared...`,
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
      toast.error(
        `Generating Video... ${progress}%\n\n${err.message || 'Video export failed'}`,
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
    let progress = currentProgress;

    const bumpProgress = () => {
      progress = Math.min(progress + 1, 99); // 1% steps up to 99
      toast.loading(
        `Generating Video... ${progress}%\n\nKindly hold on briefly while your video is being prepared...`,
        { id: toastId, position: 'top-left', duration: 0 }
      );
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/video-status?renderId=${encodeURIComponent(renderId)}`);
        const data = await res.json();
        console.log('Poll status:', data);

        if (!res.ok) {
          toast.error(
            `Generating Video... ${progress}%\n\nVideo status check failed. Please try again later.`,
            { id: toastId, position: 'top-left' }
          );
          return;
        }

        const status = data.response?.status;

        if (status === 'done') {
          const videoUrl = data.response.url;

          // Final state: 100% with "Open Video" button (as toast action)
          toast.success(
            `Generating Video... 100%\n\nKindly hold on briefly while your video is being prepared...`,
            {
              id: toastId,
              position: 'top-left',
              duration: 0,
              action: {
                label: 'Open Video',
                onClick: () => {
                  window.open(videoUrl, '_blank');
                },
              },
            }
          );
          return;
        }

        if (status === 'failed') {
          toast.error(
            `Generating Video... ${progress}%\n\n${data.response.error || 'Video render failed'}`,
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
