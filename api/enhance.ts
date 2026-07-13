import { enhance } from '../server/core.ts';

// Vercel Node serverless function. The client posts { storeName, products[] }.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  const { status, body: out } = await enhance(body, process.env);
  res.status(status).json(out);
}
