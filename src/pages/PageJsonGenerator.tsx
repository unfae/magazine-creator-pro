import { useMemo, useState } from 'react';
import { generatePageLayout } from '@/lib/pageLayoutGenerator';

export default function PageJsonGenerator() {
  const [photoSlots, setPhotoSlots] = useState(1);
  const [pngElements, setPngElements] = useState(1);
  const [textCount, setTextCount] = useState(1);
  const [photosBaseUrl, setPhotosBaseUrl] = useState('https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance');
  const [pngBaseUrl, setPngBaseUrl] = useState('https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance');
  const [fontFamily, setFontFamily] = useState('PlayfairDisplay SC');

  const [textsRaw, setTextsRaw] = useState('title:Magazine Title');

  const layout = useMemo(() => {
    const texts = textsRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const [id, ...rest] = line.split(':');
        return {
          id: (id || `text_${idx + 1}`).trim(),
          defaultText: (rest.join(':') || `Text ${idx + 1}`).trim(),
        };
      });

    return generatePageLayout({
      photoSlots,
      pngElements,
      textCount,
      photosBaseUrl,
      pngBaseUrl,
      texts,
      fontFamily,
    });
  }, [photoSlots, pngElements, textCount, photosBaseUrl, pngBaseUrl, textsRaw, fontFamily]);

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: 16 }}>
      <h2>Page JSON Generator</h2>

      <label>Photo slots: <input type="number" value={photoSlots} onChange={e => setPhotoSlots(+e.target.value)} /></label><br/>
      <label>PNG elements: <input type="number" value={pngElements} onChange={e => setPngElements(+e.target.value)} /></label><br/>
      <label>Text blocks: <input type="number" value={textCount} onChange={e => setTextCount(+e.target.value)} /></label><br/>

      <label>Photos base URL: <input style={{ width: '100%' }} value={photosBaseUrl} onChange={e => setPhotosBaseUrl(e.target.value)} /></label><br/>
      <label>PNGs base URL: <input style={{ width: '100%' }} value={pngBaseUrl} onChange={e => setPngBaseUrl(e.target.value)} /></label><br/>
      <label>Font family: <input style={{ width: '100%' }} value={fontFamily} onChange={e => setFontFamily(e.target.value)} /></label><br/>

      <label>Texts (one per line: id:text):</label>
      <textarea style={{ width: '100%', height: 80 }} value={textsRaw} onChange={e => setTextsRaw(e.target.value)} />

      <div style={{ marginTop: 12 }}>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(layout, null, 2))}>
          Copy JSON
        </button>
      </div>

      <pre style={{ marginTop: 12, background: '#0b1020', color: '#e5e7eb', padding: 12, borderRadius: 8, overflow: 'auto' }}>
        {JSON.stringify(layout, null, 2)}
      </pre>
    </div>
  );
}
