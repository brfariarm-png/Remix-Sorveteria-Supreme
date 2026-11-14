import { verifyAdmin } from '../_lib/adminAuth';

// Envio de mensagem de WhatsApp (status do pedido). Só o administrador logado pode usar.
// O token da Evolution API fica apenas nas variáveis de ambiente da Vercel (EVOLUTION_TOKEN).
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

  const token = (process.env.EVOLUTION_TOKEN || '').trim();
  if (!token) {
    return res.status(500).json({ error: 'EVOLUTION_TOKEN não configurado na Vercel.' });
  }
  const base = (process.env.EVOLUTION_URL || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/+$/, '');
  const instance = (process.env.EVOLUTION_INSTANCE || 'supreme-bot').trim();

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
