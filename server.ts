import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (Number(process.env.PORT) || 8080) : 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory logs for live inspection in admin dashboard
interface BotLog {
  id: string;
  timestamp: string;
  from: string;
  pushName?: string;
  incomingText: string;
  replyText: string;
  status: 'sent' | 'error' | 'ignored';
  details?: string;
}

const recentBotLogs: BotLog[] = [];

function addBotLog(log: Omit<BotLog, 'id' | 'timestamp'>) {
  const newLog: BotLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ...log
  };
  recentBotLogs.unshift(newLog);
  if (recentBotLogs.length > 50) {
    recentBotLogs.pop();
  }
  return newLog;
}

// In-memory store config cache (updated via sync or API)
let cachedStoreConfig = {
  botName: 'Supreme Bot Premium 💜',
  storeName: 'Sorveteria Gourmet Supreme',
  phone: '5519974118672',
  evolutionUrl: 'https://supreme-bot-2bm0.onrender.com',
  evolutionInstance: 'supreme-bot',
  evolutionToken: 'Rmfa1100@',
  welcomeMsg: `Olá! Seja muito bem-vindo ao assistente automático da *Sorveteria Gourmet Supreme*! 🍨\n\nSou o *Supreme Bot Premium 💜*.\n\nEscolha uma das opções abaixo enviando o número ou digitando sua dúvida:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`,
  menuLink: 'https://ais-dev-yhf54sfjf6of4ko46v7bn3-576759142795.us-west2.run.app',
  menuMsg: `⭐️ *CARDÁPIO DIGITAL SUPREME* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso cardápio online para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\nEnvie *1* para fazer pedido ou *4* para falar com atendente!`,
  supportMsg: `🙋‍♂️ *CONECTANDO À NOSSA EQUIPE*\n\nEntendi! Estou transferindo seu atendimento para a nossa equipe na loja física. Nosso tempo médio de resposta é de menos de 4 minutos!\n\nSe preferir ligar diretamente, use o número comercial:\n👉 *{telefone}*`,
  address: 'Rua Chequer Assis, 195 - ao lado do extra supermercado - Monte Mor/SP',
  openHours: '13:00 às 20:00'
};

// Auto-sync configuration directly from Firestore settings/store_config
async function syncStoreConfigFromDb() {
  try {
    const { db } = await import('./src/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'settings', 'store_config'));
    if (snap.exists()) {
      const data = snap.data();
      cachedStoreConfig = {
        ...cachedStoreConfig,
        botName: data.whatsappBotName || cachedStoreConfig.botName,
        storeName: data.name || cachedStoreConfig.storeName,
        phone: data.phone || cachedStoreConfig.phone,
        evolutionUrl: (data.whatsappEvolutionUrl || cachedStoreConfig.evolutionUrl || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/$/, ''),
        evolutionInstance: (data.whatsappEvolutionInstance || cachedStoreConfig.evolutionInstance || 'supreme-bot').trim(),
        evolutionToken: (data.whatsappEvolutionToken || cachedStoreConfig.evolutionToken || 'Rmfa1100@').trim(),
        welcomeMsg: data.whatsappBotWelcomeMessage || cachedStoreConfig.welcomeMsg,
        menuMsg: data.whatsappBotMenuMessage || cachedStoreConfig.menuMsg,
        menuLink: data.whatsappBotMenuLink || cachedStoreConfig.menuLink,
        supportMsg: data.whatsappBotSupportMessage || cachedStoreConfig.supportMsg,
        address: data.address || cachedStoreConfig.address,
      };
      console.log(`✅ [WhatsApp Bot] Configurações carregadas do Firestore! Evolution URL: ${cachedStoreConfig.evolutionUrl} | Instância: ${cachedStoreConfig.evolutionInstance}`);
    }
  } catch (err: any) {
    console.warn('⚠️ [WhatsApp Bot] Erro não impeditivo ao ler Firestore:', err?.message || err);
  }
}

// Initial sync on startup
syncStoreConfigFromDb();
// Periodic refresh every 60s
setInterval(syncStoreConfigFromDb, 60000);

// Determine response text based on incoming message
function processIncomingMessage(userText: string, pushName: string = 'Cliente') {
  const clean = userText.trim().toLowerCase();
  const cfg = cachedStoreConfig;

  // 1. Menu
  if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean.includes('fazer pedido') || clean.includes('pedir') || clean.includes('menu')) {
    const raw = cfg.menuMsg.replace('{menu_link}', cfg.menuLink).replace('[LINK_CARDAPIO]', cfg.menuLink);
    return raw;
  }

  // 2. Track Order
  if (clean === '2' || clean.includes('rastrear') || clean.includes('status') || clean.includes('onde esta') || clean.includes('onde está') || clean.includes('pedido')) {
    return `🔍 *RASTREADOR DE PEDIDOS SUPREME*\n\nOlá, *${pushName}*! Para acompanhar o status do seu pedido em tempo real, acesse:\n👉 ${cfg.menuLink}?track=true\n\nCaso já tenha o código do pedido (ex: #SUP123), digite aqui que verificamos para você!`;
  }

  // 3. Location & Hours
  if (clean === '3' || clean.includes('localizacao') || clean.includes('localização') || clean.includes('onde fica') || clean.includes('endereco') || clean.includes('endereço') || clean.includes('horario') || clean.includes('horário')) {
    return `📍 *LOCALIZAÇÃO & HORÁRIOS SUPREME*\n\n🏠 *Endereço:* ${cfg.address}\n⏰ *Horário de Funcionamento:* ${cfg.openHours}\n💬 *Telefone Comercial:* ${cfg.phone}\n\nVenha nos visitar ou faça seu pedido online para receber quentinho/geladinho em casa!`;
  }

  // 4. Human Support
  if (clean === '4' || clean.includes('atendente') || clean.includes('humano') || clean.includes('falar com') || clean.includes('ajuda') || clean.includes('suporte')) {
    return cfg.supportMsg.replace('{telefone}', cfg.phone).replace('[TELEFONE]', cfg.phone);
  }

  // Default: Greeting & Welcome Menu Options
  return cfg.welcomeMsg.replace('{nome}', pushName);
}

// Send Text via Evolution API
async function sendWhatsAppMessage(targetNumber: string, messageText: string, config: typeof cachedStoreConfig) {
  let cleanUrl = (config.evolutionUrl || '').trim().replace(/\/$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  const cleanInstance = (config.evolutionInstance || 'supreme-bot').trim();
  const cleanToken = (config.evolutionToken || 'Rmfa1100@').trim();
  const cleanNumber = targetNumber.replace(/\D/g, '');

  if (!cleanUrl || !cleanInstance) {
    throw new Error('Evolution API URL e Instância não configuradas.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${cleanUrl}/message/sendText/${cleanInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanToken
      },
      signal: controller.signal,
      body: JSON.stringify({
        number: cleanNumber,
        text: messageText
      })
    });

    clearTimeout(timeoutId);
    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(`Evolution API erro ${res.status}: ${responseText}`);
    }

    let data = null;
    try { data = JSON.parse(responseText); } catch (_) {}
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Timeout de 8s na Evolution API (o WhatsApp ainda não está pareado/conectado na Evolution API)');
    }
    throw err;
  }
}

// ------------------- API ROUTES ------------------- //

// Sync store config from client
app.post('/api/bot/sync-config', (req: Request, res: Response) => {
  const body = req.body;
  if (body) {
    cachedStoreConfig = {
      ...cachedStoreConfig,
      ...body
    };
  }
  res.json({ success: true, config: cachedStoreConfig });
});

// Force sync from Firestore DB
app.post('/api/bot/sync-from-db', async (_req: Request, res: Response) => {
  await syncStoreConfigFromDb();
  res.json({ success: true, config: cachedStoreConfig });
});

// Complete server-side diagnostic of Evolution API and Webhook
app.get('/api/evolution/diagnostic', async (_req: Request, res: Response) => {
  try {
    const cleanUrl = cachedStoreConfig.evolutionUrl.replace(/\/$/, '');
    const cleanInstance = cachedStoreConfig.evolutionInstance;
    const cleanToken = cachedStoreConfig.evolutionToken;

    // 1. Test ping to root
    let online = false;
    let version = '';
    try {
      const rootRes = await fetch(`${cleanUrl}/`, { method: 'GET' });
      if (rootRes.ok) {
        const rootJson = await rootRes.json();
        online = true;
        version = rootJson.version || '';
      }
    } catch (_) {}

    // 2. Fetch instances
    let instanceExists = false;
    let instanceState = 'disconnected';
    let isPaired = false;
    let ownerJid: string | null = null;
    let tokenValid = false;

    try {
      const instRes = await fetch(`${cleanUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': cleanToken }
      });
      if (instRes.ok) {
        tokenValid = true;
        const instances: any[] = await instRes.json();
        const found = instances.find(i => i.name === cleanInstance);
        if (found) {
          instanceExists = true;
          instanceState = found.connectionStatus || 'close';
          ownerJid = found.ownerJid || null;
          isPaired = Boolean(found.ownerJid);
        }
      } else if (instRes.status === 401 || instRes.status === 403) {
        tokenValid = false;
      }
    } catch (_) {}

    // 3. Check Webhook
    let webhookActive = false;
    let webhookUrl: string | null = null;
    try {
      const whRes = await fetch(`${cleanUrl}/webhook/find/${cleanInstance}`, {
        method: 'GET',
        headers: { 'apikey': cleanToken }
      });
      if (whRes.ok) {
        const whData = await whRes.json();
        webhookActive = whData.enabled === true || whData.webhook?.enabled === true;
        webhookUrl = whData.url || whData.webhook?.url || null;
      }
    } catch (_) {}

    res.json({
      success: true,
      evolutionOnline: online,
      evolutionVersion: version,
      evolutionUrl: cleanUrl,
      instanceName: cleanInstance,
      tokenValid,
      instanceExists,
      instanceState,
      isPaired,
      ownerJid,
      webhookActive,
      webhookUrl,
      recentLogs: recentBotLogs.slice(0, 10)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erro no diagnóstico' });
  }
});

// Get current config & logs
app.get('/api/bot/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: cachedStoreConfig,
    recentLogs: recentBotLogs
  });
});

// Connect or get QR Code from Evolution API via server proxy (avoids browser CORS & network drops)
app.post('/api/evolution/connect', async (req: Request, res: Response) => {
  try {
    const { evolutionUrl, evolutionInstance, evolutionToken } = req.body;
    let cleanUrl = (evolutionUrl || cachedStoreConfig.evolutionUrl || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const cleanInstance = (evolutionInstance || cachedStoreConfig.evolutionInstance || 'supreme-bot').trim();

    const candidateKeys = [
      (evolutionToken || '').trim(),
      cachedStoreConfig.evolutionToken,
      'Rmfa1100@',
      '429683C4C977415CAAFCCE10F7D57E11',
      'supreme2026'
    ].filter(Boolean);

    // 1. Identify working apikey
    let workingKey = candidateKeys[0] || 'Rmfa1100@';
    for (const key of candidateKeys) {
      try {
        const testRes = await fetch(`${cleanUrl}/instance/fetchInstances`, {
          headers: { 'apikey': key },
          signal: AbortSignal.timeout(6000)
        });
        if (testRes.status !== 401 && testRes.status !== 403) {
          workingKey = key;
          break;
        }
      } catch (_) {}
    }

    // 2. Check connectionState of instance
    let isConnected = false;
    try {
      const stateRes = await fetch(`${cleanUrl}/instance/connectionState/${cleanInstance}`, {
        headers: { 'apikey': workingKey },
        signal: AbortSignal.timeout(6000)
      });
      if (stateRes.ok) {
        const stateData: any = await stateRes.json();
        const state = stateData?.instance?.state || stateData?.state;
        if (state === 'open' || state === 'CONNECTED') {
          isConnected = true;
        }
      }
    } catch (_) {}

    if (isConnected) {
      return res.json({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado e operacional!'
      });
    }

    // 3. Ensure instance exists, or create it
    try {
      await fetch(`${cleanUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': workingKey
        },
        body: JSON.stringify({
          instanceName: cleanInstance,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }),
        signal: AbortSignal.timeout(8000)
      });
    } catch (_) {}

    // 4. Poll /instance/connect/:instance for QR Code
    let qrPayloadFound: string | null = null;
    let lastResponse: any = null;

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const connRes = await fetch(`${cleanUrl}/instance/connect/${cleanInstance}`, {
          headers: { 'apikey': workingKey },
          signal: AbortSignal.timeout(8000)
        });
        const data: any = await connRes.json();
        lastResponse = data;

        if (data.status === 'open' || data.instance?.state === 'open') {
          return res.json({
            success: true,
            connected: true,
            message: 'WhatsApp conectado com sucesso!'
          });
        }

        const qr = data.base64 || (data.qrcode && data.qrcode.base64) || data.code || (data.qrcode && data.qrcode.code) || data.pairingCode;
        if (qr) {
          qrPayloadFound = qr;
          break;
        }

        if (attempt < 4) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (_) {}
    }

    if (qrPayloadFound) {
      return res.json({
        success: true,
        connected: false,
        qrCode: qrPayloadFound,
        instance: cleanInstance
      });
    }

    const needsVersionConfig = lastResponse?.count === 0 || lastResponse?.qrcode?.count === 0;

    return res.json({
      success: false,
      needsVersionConfig,
      variableName: 'CONFIG_SESSION_PHONE_VERSION',
      variableValue: '2.3000.1032750324',
      message: needsVersionConfig
        ? 'A Evolution API no Render está ativa, mas a Meta (WhatsApp) exige a variável CONFIG_SESSION_PHONE_VERSION para liberar o QR Code.'
        : 'Instância em inicialização no Render. Aguarde alguns instantes.',
      simulatedFallbackQr: `supreme_wa_pairing_code_${cleanInstance}_${Date.now()}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao conectar à Evolution API' });
  }
});

// Check Webhook status on Evolution API
app.post('/api/bot/check-webhook', async (req: Request, res: Response) => {
  try {
    const { evolutionUrl, evolutionInstance, evolutionToken } = req.body;
    let cleanUrl = (evolutionUrl || cachedStoreConfig.evolutionUrl || '').trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const cleanInstance = (evolutionInstance || cachedStoreConfig.evolutionInstance || 'supreme-bot').trim();
    const cleanToken = (evolutionToken || cachedStoreConfig.evolutionToken || '429683C4C977415CAAFCCE10F7D57E11').trim();

    if (!cleanUrl) {
      return res.status(400).json({ error: 'URL da Evolution API obrigatória.' });
    }

    const checkRes = await fetch(`${cleanUrl}/webhook/find/${cleanInstance}`, {
      method: 'GET',
      headers: { 'apikey': cleanToken }
    });

    const text = await checkRes.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch (_) {}

    const isActive = data?.enabled === true || data?.webhook?.enabled === true;
    const url = data?.url || data?.webhook?.url || null;

    res.json({
      success: true,
      active: isActive,
      webhookUrl: url,
      raw: data || text
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao consultar webhook' });
  }
});

// Configure Webhook automatically on Evolution API
app.post('/api/bot/setup-webhook', async (req: Request, res: Response) => {
  try {
    const { evolutionUrl, evolutionInstance, evolutionToken, publicAppUrl } = req.body;
    let cleanUrl = (evolutionUrl || cachedStoreConfig.evolutionUrl || '').trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const cleanInstance = (evolutionInstance || cachedStoreConfig.evolutionInstance || 'supreme-bot').trim();
    const cleanToken = (evolutionToken || cachedStoreConfig.evolutionToken || '429683C4C977415CAAFCCE10F7D57E11').trim();

    if (!cleanUrl) {
      return res.status(400).json({ error: 'URL da Evolution API obrigatória.' });
    }

    // Persist configuration in cachedStoreConfig so webhook reply knows the URL & Token
    cachedStoreConfig.evolutionUrl = cleanUrl;
    cachedStoreConfig.evolutionInstance = cleanInstance;
    cachedStoreConfig.evolutionToken = cleanToken;
    if (publicAppUrl) {
      cachedStoreConfig.menuLink = publicAppUrl.replace(/\/$/, '');
    }

    // The webhook destination is this server's endpoint
    const appHost = publicAppUrl || `${req.protocol}://${req.get('host')}`;
    const webhookDestination = `${appHost.replace(/\/$/, '')}/api/webhook/whatsapp`;

    // Call Evolution API /webhook/set/{instance} with both flat and nested payloads
    const webhookPayload = {
      enabled: true,
      url: webhookDestination,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'MESSAGES_UPSERT',
        'SEND_MESSAGE',
        'CONNECTION_UPDATE'
      ],
      webhook: {
        enabled: true,
        url: webhookDestination,
        byEvents: false,
        base64: false,
        events: [
          'MESSAGES_UPSERT',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE'
        ]
      }
    };

    const setWebhookRes = await fetch(`${cleanUrl}/webhook/set/${cleanInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanToken
      },
      body: JSON.stringify(webhookPayload)
    });

    const respText = await setWebhookRes.text();
    if (!setWebhookRes.ok) {
      return res.status(setWebhookRes.status).json({
        error: `Erro na Evolution API ao configurar webhook: ${respText}`
      });
    }

    addBotLog({
      from: 'Sistema',
      incomingText: 'Configuração de Webhook 24h',
      replyText: `Webhook ativado apontando para: ${webhookDestination}`,
      status: 'sent'
    });

    return res.json({
      success: true,
      message: 'Webhook configurado com sucesso na Evolution API!',
      webhookUrl: webhookDestination,
      evolutionResponse: respText
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Falha ao configurar webhook' });
  }
});

// MAIN WEBHOOK RECEIVER: Evolution API calls this on incoming WhatsApp messages
app.post('/api/webhook/whatsapp', async (req: Request, res: Response) => {
  // Always acknowledge webhook immediately with 200 OK so Evolution API doesn't retry
  res.status(200).json({ received: true });

  try {
    const payload = req.body;
    const event = (payload?.event || payload?.type || '').toLowerCase();

    // Check if it's messages.upsert
    if (!event.includes('messages.upsert') && !event.includes('message')) {
      return;
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!data) return;

    const key = data?.key;
    // CRITICAL: ignore messages sent by the bot itself to prevent infinite echo loops
    if (key?.fromMe) {
      return;
    }

    // Extract sender phone number (e.g., 5519998765432@s.whatsapp.net)
    const remoteJid = key?.remoteJid || '';
    if (!remoteJid || remoteJid.includes('@g.us')) {
      // Ignore group messages
      return;
    }

    const cleanSender = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const pushName = data?.pushName || 'Cliente';

    // Extract text from message payload across Baileys variations
    const incomingText = 
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.imageMessage?.caption ||
      data?.message?.videoMessage?.caption ||
      data?.message?.buttonsResponseMessage?.selectedDisplayText ||
      data?.message?.buttonsResponseMessage?.selectedButtonId ||
      data?.message?.listResponseMessage?.title ||
      data?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      '';

    if (!incomingText.trim()) {
      return;
    }

    console.log(`[WhatsApp Bot] Mensagem recebida de +${cleanSender} (${pushName}): "${incomingText}"`);

    // Ensure config is fresh
    if (!cachedStoreConfig.evolutionUrl || !cachedStoreConfig.evolutionToken) {
      await syncStoreConfigFromDb();
    }

    // Generate the bot response (welcome message + options)
    const replyText = processIncomingMessage(incomingText, pushName);

    // Send reply via Evolution API
    try {
      await sendWhatsAppMessage(cleanSender, replyText, cachedStoreConfig);
      console.log(`[WhatsApp Bot] Resposta enviada com sucesso para +${cleanSender}`);
      addBotLog({
        from: cleanSender,
        pushName,
        incomingText,
        replyText,
        status: 'sent'
      });
    } catch (sendErr: any) {
      console.error(`[WhatsApp Bot] Falha ao enviar resposta para +${cleanSender}:`, sendErr);
      addBotLog({
        from: cleanSender,
        pushName,
        incomingText,
        replyText,
        status: 'error',
        details: sendErr.message || String(sendErr)
      });
    }
  } catch (err: any) {
    console.error('[WhatsApp Bot] Erro no processamento do webhook:', err);
  }
});

// SIMULATION ENDPOINT: allows testing bot answers without a real WhatsApp phone
app.post('/api/bot/simulate-message', async (req: Request, res: Response) => {
  try {
    const { message, pushName, phone, sendToEvolution } = req.body;
    const sender = phone || cachedStoreConfig.phone || '5519998765432';
    const name = pushName || 'Cliente Teste';
    const text = message || 'Olá';

    const reply = processIncomingMessage(text, name);

    let evolutionResult = null;
    let status: 'sent' | 'error' = 'sent';
    let details: string | undefined = undefined;

    if (sendToEvolution && cachedStoreConfig.evolutionUrl) {
      try {
        evolutionResult = await sendWhatsAppMessage(sender, reply, cachedStoreConfig);
      } catch (e: any) {
        status = 'error';
        details = e.message;
      }
    }

    const log = addBotLog({
      from: sender,
      pushName: name,
      incomingText: text,
      replyText: reply,
      status,
      details
    });

    res.json({
      success: true,
      sender,
      incomingText: text,
      replyText: reply,
      evolutionResult,
      log
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erro ao simular' });
  }
});

// ------------------- VITE & STATIC HANDLING ------------------- //

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware in dev
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    // Express 5 wildcard fallback (avoids path-to-regexp PathError)
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Supreme rodando na porta ${PORT}`);
    console.log(`🤖 Webhook WhatsApp pronto em: http://0.0.0.0:${PORT}/api/webhook/whatsapp`);
  });
}

startServer();
