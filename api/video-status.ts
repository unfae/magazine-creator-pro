export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { renderId } = req.query;

  if (!renderId || typeof renderId !== 'string') {
    return res.status(400).json({ error: 'Missing renderId' });
  }

  const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;

  // ✅ Production endpoint — matches export-video.ts
  const response = await fetch(`https://api.shotstack.io/v1/render/${encodeURIComponent(renderId)}`, {
    method: 'GET',
    headers: {
      'x-api-key': SHOTSTACK_API_KEY,
    },
  });

  const data = await response.json();
  return res.status(response.ok ? 200 : 400).json(data);
}