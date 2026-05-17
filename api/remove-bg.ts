// api/remove-bg.ts
// Proxies remove.bg API — keeps API key off the client.
// Request:  POST { imageUrl: string } OR multipart with image file
// Response: { processedUrl: string }  (base64 data URL)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
  if (!REMOVE_BG_API_KEY) return res.status(500).json({ error: 'Missing REMOVE_BG_API_KEY' });

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

    // Call remove.bg with the image URL directly — simplest path
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    formData.append('size', 'auto');
    formData.append('format', 'png');

    const bgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': REMOVE_BG_API_KEY },
      body: formData,
    });

    if (!bgRes.ok) {
      const errText = await bgRes.text();
      console.error('remove.bg error:', errText);
      return res.status(400).json({ error: 'Background removal failed. Please try again.' });
    }

    // remove.bg returns the processed image as binary PNG
    const buffer = await bgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const processedUrl = `data:image/png;base64,${base64}`;

    return res.status(200).json({ processedUrl });
  } catch (err: any) {
    console.error('remove-bg handler error:', err);
    return res.status(500).json({ error: 'Background removal failed.' });
  }
}