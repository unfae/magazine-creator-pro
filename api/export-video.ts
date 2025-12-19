import type { VercelRequest, VercelResponse } from '@vercel/node'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createClient } from '@supabase/supabase-js'

ffmpeg.setFfmpegPath(ffmpegPath as string)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pages, userName, templateName, userId, templateId } = req.body

    if (!pages || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' })
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-video-'))
    const imagesDir = path.join(tmpDir, 'images')
    fs.mkdirSync(imagesDir)

    // 1️⃣ Download page images
    for (let i = 0; i < pages.length; i++) {
      const response = await fetch(pages[i])
      const buffer = await response.arrayBuffer()
      fs.writeFileSync(
        path.join(imagesDir, `page-${String(i).padStart(3, '0')}.jpg`),
        Buffer.from(buffer)
      )
    }

    const outputPath = path.join(tmpDir, 'output.mp4')

    // 2️⃣ Generate video (horizontal page flip feel)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(imagesDir, 'page-%03d.jpg'))
        .inputOptions('-framerate 1')
        .outputOptions([
          '-vf',
          'scale=1000:1416,format=yuv420p',
          '-movflags',
          '+faststart',
          '-pix_fmt',
          'yuv420p'
        ])
        .duration(Math.min(pages.length * 6, 60))
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject)
    })

    // 3️⃣ Upload to Supabase Storage
    const fileName = `${userName}_${templateName}_magazine_video.mp4`
      .replace(/\s+/g, '_')
      .toLowerCase()

    const videoBuffer = fs.readFileSync(outputPath)

    const { data, error } = await supabase.storage
      .from('exported-videos')
      .upload(`${Date.now()}_${fileName}`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false
      })

    if (error) throw error

    const publicUrl = supabase.storage
      .from('exported-videos')
      .getPublicUrl(data.path).data.publicUrl

    // 4️⃣ Log export (NO video stored in DB)
    await supabase.from('video_exports').insert({
      user_id: userId,
      template_id: templateId
    })

    res.status(200).json({ url: publicUrl })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Video export failed' })
  }
}
