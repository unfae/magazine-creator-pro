export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { pages, userId, templateName } = req.body;
    
    if (!pages?.length) return res.status(400).json({ error: 'No pages' });
    
    // ✅ MAX 8 PAGES (413 safe)
    const safePages = pages.slice(0, 8);

    const API_KEY = process.env.SHOTSTACK_API_KEY!;
    const SHOTSTACK_URL = 'https://api.shotstack.io/stage/render';

    const clips = safePages.map((src, i) => ({
      asset: { type: 'image', src },
      start: i * 4,
      length: 4,
      width: 1000,
      height: 1416,
      fit: 'contain'
    }));

    const payload = {
      timeline: { tracks: [{ clips }] },
      output: { format: 'mp4', resolution: 'sd' }
    };

    const response = await fetch(SHOTSTACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(400).json({ error: errText });
    }

    const result = await response.json();
    const renderId = result.response.id;

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from('exported_videos_log').insert({
      user_id: userId,
      template_name: templateName,
      render_id: renderId,
      page_count: safePages.length
    });

    res.json({ success: true, renderId, statusUrl: `https://api.shotstack.io/stage/render/${renderId}` });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
