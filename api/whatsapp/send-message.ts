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
      const detail = (await r.text()).slice(0, 300);
      return res.status(502).json({ error: `Falha no envio (${r.status}): ${detail}` });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao enviar mensagem' });
  }
}
