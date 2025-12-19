import { createClient } from "@supabase/supabase-js";
import { renderBookFlipVideo } from "./bookFlip";
import path from "path";
import fs from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function renderVideoHandler(req, res) {
  const { images, title, templateId, templateName } = req.body;

  const userId = req.auth.user.id;
  const safe = (s: string) => s.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  const filename = `${safe(title)}_${safe(templateName)}_magazine_video.mp4`;

  const outputPath = await renderBookFlipVideo(images);

  const videoBuffer = fs.readFileSync(outputPath);

  const storagePath = `${userId}/${Date.now()}_${filename}`;

  await supabase.storage
    .from("exported-videos")
    .upload(storagePath, videoBuffer, {
      contentType: "video/mp4",
      upsert: false,
    });

  await supabase.from("exported_videos_log").insert({
    user_id: userId,
    template_id: templateId,
    template_name: templateName,
    video_path: storagePath,
  });

  const { data } = supabase.storage
    .from("exported-videos")
    .getPublicUrl(storagePath);

  res.json({ videoUrl: data.publicUrl });
}
