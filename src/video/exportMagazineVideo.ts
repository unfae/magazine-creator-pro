import { toast } from "sonner";
import { capturePagesAsImages } from "./capturePages";
import { ExportVideoPayload } from "./types";

export async function exportMagazineVideo({
  title,
  templateId,
  templateName,
  pages,
}: ExportVideoPayload) {
  try {
    toast.loading("Preparing pages for video export...");

    const images = await capturePagesAsImages(pages);

    const res = await fetch("/api/render-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        title,
        templateId,
        templateName,
      }),
    });

    if (!res.ok) throw new Error("Failed to start render");

    const { videoUrl } = await res.json();

    toast.success("Video ready!");
    window.open(videoUrl, "_blank");
  } catch (err) {
    console.error(err);
    toast.error("Failed to export video");
  }
}
