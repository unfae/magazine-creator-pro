// /api/video-status.ts
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { renderId } = req.query;

  if (!renderId || typeof renderId !== 'string') {
    return res.status(400).json({ error: 'Missing renderId' });
  }

  try {
    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
    const url = `https://api.shotstack.io/stage/render/${renderId}`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': SHOTSTACK_API_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('Video status error:', err);
    return res.status(500).json({ error: err.message });
  }
}
