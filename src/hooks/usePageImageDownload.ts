// src/hooks/usePageImageDownload.ts
import { useState } from "react";
import type html2canvasType from "html2canvas";

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1415;
const EXPORT_SCALE = 2.5;

const SHIFT_RATIO = 0.08; // 0.06–0.12 is typical; avoid huge values like 0.3+

export function usePageImageDownload() {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [downloading, setDownloading] = useState(false);

  const togglePage = (pageNumber: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNumber) ? prev.filter((n) => n !== pageNumber) : [...prev, pageNumber]
    );
  };

  const clearSelection = () => setSelectedPages([]);

  const downloadSelected = async () => {
    if (selectedPages.length === 0) return;

    setDownloading(true);

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const popupRef = isIOS ? window.open("", "_blank") : null;

      const html2canvas: typeof html2canvasType = (await import("html2canvas")).default;

      const pages = [...selectedPages].sort((a, b) => a - b);

      for (const pageNumber of pages) {
        const original = document.getElementById(`page-${pageNumber}`);
        if (!original) continue;

        // 1) Clone node (keep your existing approach)
        const clone = original.cloneNode(true) as HTMLElement;

        // Give clone a stable id so onclone can find it inside the cloned document
        const exportCloneId = `export-clone-${pageNumber}-${Date.now()}`;
        clone.id = exportCloneId;

        // Convert img slots → background images (keep your existing workaround)
        clone.querySelectorAll('[data-image-slot="true"]').forEach((slotEl) => {
          const slot = slotEl as HTMLElement;
          const img = slot.querySelector("img") as HTMLImageElement | null;
          if (!img || !img.src) return;

          slot.style.backgroundImage = `url(${img.src})`;
          slot.style.backgroundSize = "cover";
          slot.style.backgroundPosition = "center";
          slot.style.backgroundRepeat = "no-repeat";
          img.style.display = "none";
        });

        // Remove editor-only UI (keep)
        clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

        // Normalize size & position (keep)
        clone.style.width = `${PAGE_WIDTH}px`;
        clone.style.height = `${PAGE_HEIGHT}px`;
        clone.style.transform = "none";
        clone.style.position = "absolute";
        clone.style.left = "-99999px";
        clone.style.top = "0";

        document.body.appendChild(clone);

        // Wait for fonts before capture (stabilizes metrics)
        // document.fonts.ready resolves when font loading + layout are complete. [web:864]
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }

        // 2) High-res render
        const baseCanvas = await html2canvas(clone, {
          scale: EXPORT_SCALE,
          useCORS: true,
          backgroundColor: null,
          imageTimeout: 30000,
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,

          // Modify what html2canvas actually renders (most reliable)
          // onclone is documented for this purpose. [web:838]
          onclone: (clonedDoc) => {
            const exportRoot = clonedDoc.getElementById(exportCloneId) as HTMLElement | null;
            if (!exportRoot) return;

            exportRoot.querySelectorAll('[data-text-block="true"]').forEach((el) => {
              const t = el as HTMLElement;

              // Stop clipping in export snapshot
              t.style.overflow = "visible";
              t.style.boxSizing = "border-box";
              t.style.paddingBottom = "3px";

              // Font-size-relative upward nudge
              const view = clonedDoc.defaultView;
              const cs = view ? view.getComputedStyle(t) : null;
              const fs = parseFloat(cs?.fontSize || "16");
              const yshift = Math.round(fs * SHIFT_RATIO);

              // Use inline transform as base (keeps rotate, avoids matrix parsing)
              const base = t.style.transform || "";
              t.style.transform = `${base} translateY(${-yshift}px)`.trim();
              t.style.outline = "3px solid red";

            });
          },
        });

        document.body.removeChild(clone);

        // 3) Optional: explicit canvas (keep)
        const canvas = document.createElement("canvas");
        canvas.width = baseCanvas.width;
        canvas.height = baseCanvas.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(baseCanvas, 0, 0, canvas.width, canvas.height);
        }

        const filename = `magazine-page-${pageNumber}.jpg`;

        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) return resolve();

            const url = URL.createObjectURL(blob);

            if (isIOS) {
              if (popupRef) popupRef.location.href = url;
              setTimeout(() => URL.revokeObjectURL(url), 30_000);
              resolve();
              return;
            }

            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            resolve();
          }, "image/jpeg", 0.95);
        });

        if (isIOS) break;

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
    setSelectedPages,
  };
}
