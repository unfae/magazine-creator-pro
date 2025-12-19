import puppeteer from "puppeteer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath!);

export async function renderBookFlipVideo(images: string[]) {
  const tmp = fs.mkdtempSync("/tmp/magvid-");

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.setViewport({ width: 1000, height: 1416 });
  await page.goto(`file://${path.join(__dirname, "renderer.html")}`);

  await page.evaluate((imgs) => {
    // @ts-ignore
    window.loadPages(imgs);
  }, images);

  const framesPerPage = 150; // ~5s per page @30fps
  let frame = 0;

  for (let p = 0; p < images.length; p++) {
    for (let i = 0; i < framesPerPage; i++) {
      await page.evaluate((progress) => {
        // @ts-ignore
        window.render(progress);
      }, i / framesPerPage);

      await page.screenshot({
        path: `${tmp}/frame_${String(frame).padStart(4, "0")}.png`,
      });
      frame++;
    }
  }

  await browser.close();

  const output = `${tmp}/output.mp4`;

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${tmp}/frame_%04d.png`)
      .inputFPS(30)
      .outputOptions("-pix_fmt yuv420p")
      .save(output)
      .on("end", resolve)
      .on("error", reject);
  });

  return output;
}
