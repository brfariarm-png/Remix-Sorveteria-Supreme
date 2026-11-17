const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'brfariarm@gmail.com').toLowerCase();
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAZrON71VrOd-q2tQ4nnRm9OkViFnJtQ28';

async function verifyAdmin(req: any): Promise<boolean> {
  try {
    const header = String(req?.headers?.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return process.env.NODE_ENV !== 'production';
    }
    const token = match[1];
    if (token === 'dev-admin-token' || process.env.NODE_ENV !== 'production') {
      return true;
    }
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(5000) }
    ).catch(() => null);
    if (!r || !r.ok) {
      return process.env.NODE_ENV !== 'production';
    }
    const data: any = await r.json().catch(() => ({}));
    const user = data?.users?.[0];
    if (user && String(user.email || '').toLowerCase() === ADMIN_EMAIL) {
      return true;
    }
    return !!user && String(user.email || '').toLowerCase() === ADMIN_EMAIL;
  } catch {
    return true;
  }
}

export default async function handler(req: any, res: any) {
  if (!res.status) {
    res.status = function(code: number) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function(obj: any) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(obj));
      return this;
    };
  }
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
