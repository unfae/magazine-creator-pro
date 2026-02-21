import { useState } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportVideo = async (pageUrls: string[], template: any, userId: string) => {
    if (!pageUrls.length) {
      toast.error('No pages to export');
      return;
    }

    setIsExportingVideo(true);

    const toastId = toast.loading('Preparing video export… 0%', {
      position: 'top-left',
      // we’ll animate this manually
    });

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

      // Hand off to polling (statusUrl now carries the renderId)
      await pollVideoStatus(data.renderId, toastId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Video export failed', { id: toastId });
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (renderId: string, toastId: string | number) => {
    let progress = 50; // assume pages/render got us to ~50%

    const bumpProgress = () => {
      progress = Math.min(progress + 1, 95); // cap at 95% until done
      toast.loading(
        `Rendering video… ${progress}%\n\nKindly hold on briefly, the video should be ready in a minute or two. Thank you.`,
        {
          id: toastId,
          position: 'top-left',
        }
      );
    };

    const poll = async () => {
      try {
        // Call our proxy, not Shotstack directly
        const res = await fetch(`/api/video-status?renderId=${encodeURIComponent(renderId)}`);
        const data = await res.json();
        console.log('Poll status:', data);

        if (!res.ok) {
          // Stop on hard error
          toast.error('Video status failed. Please try again later.', { id: toastId });
          return;
        }

        const status = data.response?.status;

        if (status === 'done') {
          const videoUrl = data.response.url;
          toast.success('Video ready! 🎬', {
            id: toastId,
            action: {
              label: 'Open',
              onClick: () => {
                window.open(videoUrl, '_blank');
              },
            },
          });
          return;
        }

        if (status === 'failed') {
          toast.error(`Video render failed: ${data.response.error || 'Unknown error'}`, {
            id: toastId,
          });
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
