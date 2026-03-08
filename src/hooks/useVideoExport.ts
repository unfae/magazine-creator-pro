import { useState } from 'react';
import { toast } from 'sonner';
// TransitionId is just a string — no import needed from videoTransitions

const SUBTITLE = 'Kindly hold on briefly while your video is being prepared...';

function setLoadingToast(toastId: string | number, progress: number) {
  toast.loading(`Generating Video... ${progress}%`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: SUBTITLE,
  });
}

function setErrorToast(toastId: string | number, progress: number, _rawMessage: string) {
  // Never show raw API errors to users — always a clean message with a contact link
  toast.error(`Video export failed`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: 'Something went wrong. Please try again or contact us.',
    action: {
      label: 'Contact Us',
      onClick: () => window.open('/contact', '_blank'),
    },
    classNames: {
      actionButton: '!h-8 !text-xs !font-medium',
    },
  });
}

function setSuccessToast(toastId: string | number, videoUrl: string) {
  toast.success(`Video Generated!`, {
    id: toastId,
    position: 'top-left',
    duration: Infinity,
    description: 'Your video is ready.',
    action: {
      label: 'Open Video',
      onClick: () => window.open(videoUrl, '_blank'),
    },
    className: 'flex-col items-start gap-3',
    classNames: {
      actionButton: '!h-10 w-[50%] !mr-auto !ml-0 !justify-center !text-sm !font-semibold',
    },
  });
}

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportVideo = async (
    pageUrls: string[],
    template: any,
    userId: string,
    toastId: string | number,
    startProgress: number = 50,
    transitionId: string = 'fade'         // ← new param
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
          transitionId,   // ← pass to API
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

  const pollVideoStatus = async (
    renderId: string,
    toastId: string | number,
    startProgress: number
  ) => {
    let progress = Math.max(0, Math.min(99, startProgress));
    let stopTick = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 3s = 2 minutes max

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
      attempts++;

      if (attempts > MAX_ATTEMPTS) {
        stop();
        setErrorToast(toastId, progress, 'Video render timed out. Please try again.');
        return;
      }

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

        // Still processing — poll again
        setTimeout(poll, 3000);
      } catch (err) {
        console.error('Status poll failed:', err);
        // Network hiccup — retry up to the limit
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  return { exportVideo, isExportingVideo };
}