import { useState } from 'react';
import { toast } from 'sonner';

const SUBTITLE = 'Kindly hold on briefly while your video is being prepared...';

function setLoadingToast(toastId: string | number, progress: number) {
  toast.loading(`Generating Video... ${progress}%`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: SUBTITLE,
  });
}

function setErrorToast(toastId: string | number, progress: number, message: string) {
  toast.error(`Generating Video... ${progress}%`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: message,
  });
}

function setSuccessToast(toastId: string | number, videoUrl: string) {
  toast.success(`Video Generated...`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: SUBTITLE,
    action: {
      label: 'Open Video',
      onClick: () => window.open(videoUrl, '_blank'),
    },

    // ✅ Put action under text + make it bigger
    className: 'flex-col items-start gap-3', // action goes to bottom when column layout [web:132]
    classNames: {
      actionButton: '!h-10 w-[50%] !mr-auto !ml-0 !justify-center !text-sm !font-semibold',
    },
  });
}


export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  // NOTE: toastId is created outside (in handleExportVideo) so we never open a second toast.
  const exportVideo = async (
    pageUrls: string[],
    template: any,
    userId: string,
    toastId: string | number,
    startProgress: number = 50
  ) => {
    if (!pageUrls.length) {
      setErrorToast(toastId, startProgress, 'No pages to export.');
      return;
    }

    setIsExportingVideo(true);

    try {
      setLoadingToast(toastId, startProgress);

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

      await pollVideoStatus(data.renderId, toastId, startProgress);
    } catch (err: any) {
      console.error(err);
      setErrorToast(toastId, startProgress, err?.message || 'Video export failed.');
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (renderId: string, toastId: string | number, startProgress: number) => {
    let progress = Math.max(0, Math.min(99, startProgress));
    let stopTick = false;

    // Smooth +1% ticking up to 99 while polling happens in the background.
    const tick = setInterval(() => {
      if (stopTick) return;
      progress = Math.min(progress + 1, 99);
      setLoadingToast(toastId, progress);
    }, 350);

    const stop = () => {
      stopTick = true;
      clearInterval(tick);
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/video-status?renderId=${encodeURIComponent(renderId)}`);
        const data = await res.json();

        if (!res.ok) {
          stop();
          setErrorToast(toastId, progress, 'Video status check failed. Please try again.');
          return;
        }

        const status = data.response?.status;

        if (status === 'done') {
          stop();
          setSuccessToast(toastId, data.response.url);
          return;
        }

        if (status === 'failed') {
          stop();
          setErrorToast(toastId, progress, data.response?.error || 'Video render failed.');
          return;
        }

        setTimeout(poll, 3000);
      } catch (err) {
        console.error('Status poll failed:', err);
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  return { exportVideo, isExportingVideo };
}
