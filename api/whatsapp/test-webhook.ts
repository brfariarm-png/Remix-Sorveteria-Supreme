import { verifyAdmin } from '../_lib/adminAuth';

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }

    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(401).json({ ok: false, error: 'Não autorizado. Entre como administrador.' });
    }

    let body = req.body || {};
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch {
        body = {};
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { url, payload } = body;

    if (!url) {
      return res.status(400).json({ ok: false, error: 'URL do webhook é obrigatória.' });
    }

    const webhookRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(15000)
    });

    const text = await webhookRes.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    return res.status(200).json({
      ok: true,
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
      data
    });
  } catch (err: any) {
    console.error('[Test Webhook Error]:', err);
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Falha ao testar webhook'
    });
  }
}
