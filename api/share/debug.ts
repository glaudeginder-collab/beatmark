import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    // Write a test blob and return the URL
    const blob = await put('shares/debug-test.json', '{"debug":true}', { access: 'public', contentType: 'application/json' });
    const { blobs } = await list({ prefix: 'shares/', limit: 3 });
    res.status(200).json({ putUrl: blob.url, listCount: blobs.length, sampleBlobs: blobs.slice(0,3).map(b => ({pathname: b.pathname, url: b.url})) });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
}
