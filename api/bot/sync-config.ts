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

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    console.log('[Bot Sync Config received]:', body);

    return res.status(200).json({
      ok: true,
      success: true,
      message: 'Configurações de bot sincronizadas com sucesso.'
    });
  } catch (err: any) {
    console.error('[Bot Sync Config Error]:', err);
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Falha ao sincronizar configuração'
    });
  }
}
