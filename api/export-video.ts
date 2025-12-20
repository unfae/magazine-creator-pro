import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pages, userId, templateName, userName } = req.body

    if (!pages || !Array.isArray(pages)) {
      return res.status(400).json({ error: 'Invalid pages data' })
    }

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 1416 })

    // HTML slideshow
    const html = `
      <html>
        <body style="margin:0; overflow:hidden;">
          ${pages
            .map(
              (img: string) => `
              <img src="${img}" style="
                width:1000px;
                height:1416px;
                object-fit:cover;
                position:absolute;
                top:0;
                left:0;
                animation: flip 6s linear infinite;
              "/>
            `
            )
            .join('')}
        </body>
      </html>
    `

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const buffer = await page.screenshot({ type: 'jpeg', quality: 90 })

    await browser.close()

    // Upload placeholder (replace with video pipeline later)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
    })

    res.status(200).json({
      success: true,
      message: 'Video export initiated',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Export failed' })
  }
}
