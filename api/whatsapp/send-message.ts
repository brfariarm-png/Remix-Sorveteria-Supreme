import { verifyAdmin } from '../_lib/adminAuth';

// Envio de mensagem de WhatsApp (status do pedido). Só o administrador logado pode usar.
// O token da Evolution API fica apenas nas variáveis de ambiente da Vercel (EVOLUTION_TOKEN).
const PROJECT_ID = 'gen-lang-client-0657249394';
const DATABASE_ID = 'ai-studio-remixsorveterias-394250e3-c97c-4dba-be9b-43921c0168c3';
const FIRESTORE_CONFIG_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_config`;

async function loadConfig() {
  let url = process.env.EVOLUTION_URL || 'https://supreme-bot-2bm0.onrender.com';
  let instance = process.env.EVOLUTION_INSTANCE || 'supreme-bot';
  let token = process.env.EVOLUTION_TOKEN || 'Rmfa1100@';

  try {
    const res = await fetch(FIRESTORE_CONFIG_URL, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const json: any = await res.json();
      const fields = json?.fields;
      if (fields) {
        const dbUrl = fields?.whatsappEvolutionUrl?.stringValue?.trim();
        const dbInst = fields?.whatsappEvolutionInstance?.stringValue?.trim();
        const dbTok = fields?.whatsappEvolutionToken?.stringValue?.trim();
        if (dbUrl) url = dbUrl;
        if (dbInst) instance = dbInst;
        if (dbTok) token = dbTok;
      }
    }
  } catch (_) {}

  return {
    url: url.replace(/\/+$/, ''),
    instance: instance.trim(),
    token: token.trim()
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Não autorizado. Entre como administrador.' });
  }

  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  const message = String(req.body?.message || '');
  if (phone.length < 10 || phone.length > 15) {
    return res.status(400).json({ error: 'Telefone inválido.' });
  }
  if (!message || message.length > 4000) {
    return res.status(400).json({ error: 'Mensagem vazia ou grande demais.' });
  }

  const cfg = await loadConfig();
  const token = cfg.token;
  const base = cfg.url;
  const instance = cfg.instance;

  if (!token) {
    return res.status(500).json({ error: 'EVOLUTION_TOKEN não configurado.' });
  }

  try {
    const r = await fetch(`${base}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: JSON.stringify({ number: phone, text: message })
    });
    if (!r.ok) {
      const errTxt = await r.text();
      let friendly = 'WhatsApp desconectado: abra o painel, aba WhatsApp Bot, e leia o QR code.';
      if (r.status === 404 || r.status === 400 || /connection closed|closed|400|bad request|not found|disconnected|close/i.test(errTxt)) {
        friendly = 'WhatsApp desconectado: abra o painel, aba WhatsApp Bot, e leia o QR code.';
      } else {
        friendly = `Falha no envio (${r.status}): ${errTxt.replace(token, '[REDACTED]')}`;
      }
      return res.status(502).json({ error: friendly });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    const msg = err?.message || '';
    let friendly = 'Servidor do WhatsApp acordando, tente de novo em 1 minuto.';
    if (/abort|timeout|fetch failed|econrefused|enotfound/i.test(msg)) {
      friendly = 'Servidor do WhatsApp acordando, tente de novo em 1 minuto.';
    } else {
      friendly = msg.replace(token, '[REDACTED]');
    }
    return res.status(500).json({ error: friendly });
  }
}
