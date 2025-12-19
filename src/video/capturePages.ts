import html2canvas from "html2canvas";

export async function capturePagesAsImages(
  pages: HTMLElement[],
  width = 1000,
  height = 1416
): Promise<string[]> {
  const images: string[] = [];

  for (const page of pages) {
    const clone = page.cloneNode(true) as HTMLElement;

    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.transform = "none";
    clone.style.position = "fixed";
    clone.style.left = "-99999px";

    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    document.body.removeChild(clone);

    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}
