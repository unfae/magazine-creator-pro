// src/hooks/usePageImageDownload.ts
import { useState } from 'react';
import type html2canvasType from 'html2canvas';

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1415;
const EXPORT_SCALE = 2.5; // effective resolution multiplier (can bump to 3–4)

export function usePageImageDownload() {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [downloading, setDownloading] = useState(false);

  const togglePage = (pageNumber: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNumber)
        ? prev.filter((n) => n !== pageNumber)
        : [...prev, pageNumber]
    );
  };

  const clearSelection = () => setSelectedPages([]);

  const downloadSelected = async () => {
    if (selectedPages.length === 0) return;

    setDownloading(true);
    try {
      const html2canvas: typeof html2canvasType = (await import('html2canvas')).default;

      const pages = [...selectedPages].sort((a, b) => a - b);

      for (const pageNumber of pages) {
        const original = document.getElementById(`page-${pageNumber}`);
        if (!original) continue;

        // 1) Clone node, same trick as PDF export to avoid scaling/aspect issues
        const clone = original.cloneNode(true) as HTMLElement;

        // Convert img slots → background images so html2canvas respects cover/center like PDF export
        clone.querySelectorAll('[data-image-slot="true"]').forEach((slotEl) => {
          const slot = slotEl as HTMLElement;
          const img = slot.querySelector('img') as HTMLImageElement | null;
          if (!img || !img.src) return;

          slot.style.backgroundImage = `url(${img.src})`;
          slot.style.backgroundSize = 'cover';
          slot.style.backgroundPosition = 'center';
          slot.style.backgroundRepeat = 'no-repeat';

          // hide img in clone to prevent double rendering/stretching
          img.style.display = 'none';
        });

        // Remove editor-only UI
        clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

        // Normalize size & position (ignore preview scale)
        clone.style.width = `${PAGE_WIDTH}px`;
        clone.style.height = `${PAGE_HEIGHT}px`;
        clone.style.transform = 'none';
        clone.style.position = 'absolute';
        clone.style.left = '-99999px';
        clone.style.top = '0';

        document.body.appendChild(clone);

        // 2) High-res render
        const baseCanvas = await html2canvas(clone, {
          scale: EXPORT_SCALE,
          useCORS: true,
          backgroundColor: null,
          imageTimeout: 30000,
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
        });

        document.body.removeChild(clone);

        // 3) Optional: explicit canvas (keeps aspect ratio, lets you tweak final size)
        const canvas = document.createElement('canvas');
        canvas.width = baseCanvas.width;   // PAGE_WIDTH * EXPORT_SCALE
        canvas.height = baseCanvas.height; // PAGE_HEIGHT * EXPORT_SCALE

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(baseCanvas, 0, 0, canvas.width, canvas.height);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `magazine-page-${pageNumber}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setDownloading(false);
    }
  };

  return {
    selectedPages,
    downloading,
    togglePage,
    clearSelection,
    downloadSelected,
    setSelectedPages, // expose so we can implement "Select all"
  };
}
