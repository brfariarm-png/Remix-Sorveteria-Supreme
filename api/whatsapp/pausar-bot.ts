/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const PROJECT_ID = 'gen-lang-client-0657249394';
const DATABASE_ID = 'ai-studio-remixsorveterias-394250e3-c97c-4dba-be9b-43921c0168c3';

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, x-webhook-secret');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }

    let payload = req.body || {};
    if (Buffer.isBuffer(payload)) {
      try { payload = JSON.parse(payload.toString('utf8')); } catch { payload = {}; }
    } else if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }

    const phone = String(payload?.phone || '').replace(/\D/g, '');
    const pausado = Boolean(payload?.pausado);

    if (!phone || phone.length < 8) {
      return res.status(400).json({ ok: false, error: 'Telefone inválido' });
    }

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/whatsapp_conversations/${phone}?updateMask.fieldPaths=botPausado&updateMask.fieldPaths=phone`;
    const body = {
      fields: {
        phone: { stringValue: phone },
        botPausado: { booleanValue: pausado }
      }
    };

    const updateRes = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000)
    });

    if (!updateRes.ok) {
      const createUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/whatsapp_conversations?documentId=${phone}`;
      await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            phone: { stringValue: phone },
            botPausado: { booleanValue: pausado },
            ultimaAusencia: { integerValue: '0' }
          }
        }),
        signal: AbortSignal.timeout(4000)
      });
    }

    return res.status(200).json({ ok: true, phone, botPausado: pausado });
  } catch (err: any) {
    console.error('Error pausing bot:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}
