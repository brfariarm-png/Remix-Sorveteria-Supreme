import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';

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
  botEnabled: true,
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
        botEnabled: data.whatsappBotEnabled !== false,
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

// ------------------- NATIVE WHATSAPP ENGINE (BAILEYS) ------------------- //
const WA_AUTH_DIR = path.resolve(__dirname, '.wa_auth');
let nativeSocket: ReturnType<typeof makeWASocket> | null = null;
let nativeStatus: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' = 'disconnected';
let nativeQrRaw: string | null = null;
let nativeQrDataUrl: string | null = null;
let nativePairingCode: string | null = null;
let nativeOwnerJid: string | null = null;
let nativeLastError: string | null = null;
let nativeManualStop = false;
const sentBotMessageIds = new Set<string>();
function trackSentMessageId(id?: string | null) {
  if (!id) return;
  sentBotMessageIds.add(id);
  if (sentBotMessageIds.size > 300) {
    const first = sentBotMessageIds.values().next().value;
    if (first) sentBotMessageIds.delete(first);
  }
}

function unwrapWhatsAppMessage(msgContent: any): any {
  let current = msgContent;
  for (let i = 0; i < 6 && current; i++) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
    } else if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message;
    } else if (current.editedMessage?.message) {
      current = current.editedMessage.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.protocolMessage?.editedMessage) {
      current = current.protocolMessage.editedMessage;
    } else {
      break;
    }
  }
  return current;
}

function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  // Auto-prefix Brazil DDI 55 for standard 10 or 11 digit DDD+number strings
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

async function resolveWhatsAppJid(sock: ReturnType<typeof makeWASocket>, rawPhone: string): Promise<string> {
  const normalized = normalizePhoneDigits(rawPhone);
  const candidates = [normalized];

  // For Brazilian mobile numbers (55 + 2-digit DDD + 8 or 9 digits), test both with and without the 9th digit
  if (normalized.startsWith('55') && normalized.length === 13 && normalized[4] === '9') {
    candidates.push(normalized.slice(0, 4) + normalized.slice(5));
  } else if (normalized.startsWith('55') && normalized.length === 12) {
    candidates.push(normalized.slice(0, 4) + '9' + normalized.slice(4));
  }

  try {
    const checks = await sock.onWhatsApp(...candidates);
    const valid = checks?.find((item) => item.exists && item.jid);
    if (valid?.jid) {
      return valid.jid;
    }
  } catch (err: any) {
    console.warn('[WhatsApp Native] onWhatsApp lookup warning:', err?.message || err);
  }

  return `${normalized}@s.whatsapp.net`;
}

let nativeReconnectAttempts = 0;

function clearNativeAuthDir() {
  try {
    if (fs.existsSync(WA_AUTH_DIR)) {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[WhatsApp Native] Erro ao limpar .wa_auth:', e);
  }
}

async function stopNativeSocket() {
  if (nativeSocket) {
    try {
      nativeSocket.ev.removeAllListeners('connection.update');
      nativeSocket.ev.removeAllListeners('creds.update');
      nativeSocket.ev.removeAllListeners('messages.upsert');
      nativeSocket.end(undefined);
    } catch (_) {}
    nativeSocket = null;
  }
}

async function startNativeWhatsApp(options?: { forceFresh?: boolean; pairingPhone?: string }) {
  nativeManualStop = false;
  nativeLastError = null;

  if (options?.forceFresh) {
    await stopNativeSocket();
    clearNativeAuthDir();
    nativeQrRaw = null;
    nativeQrDataUrl = null;
    nativePairingCode = null;
    nativeOwnerJid = null;
    nativeReconnectAttempts = 0;
  }

  if (nativeStatus === 'connected' && nativeSocket && !options?.forceFresh) {
    return;
  }

  await stopNativeSocket();
  nativeStatus = 'connecting';

  try {
    if (!fs.existsSync(WA_AUTH_DIR)) {
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
    }

    let version: [number, number, number] = [2, 3000, 1043857760];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) {
        version = latest.version;
      }
    } catch (_) {}

    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }) as any,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      connectTimeoutMs: 25000,
      defaultQueryTimeoutMs: 25000,
      syncFullHistory: false
    });

    nativeSocket = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          nativeQrRaw = qr;
          nativeQrDataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: { dark: '#075E54', light: '#FFFFFF' }
          });
          nativeStatus = 'qr_ready';
          nativeLastError = null;
        } catch (qrErr: any) {
          nativeLastError = qrErr?.message || 'Erro ao gerar imagem QR';
        }
      }

      if (connection === 'open') {
        nativeStatus = 'connected';
        nativeQrRaw = null;
        nativeQrDataUrl = null;
        nativePairingCode = null;
        nativeLastError = null;
        nativeReconnectAttempts = 0;
        const rawId = sock.user?.id || '';
        nativeOwnerJid = rawId ? rawId.split(':')[0].split('@')[0] : null;
        console.log(`✅ [WhatsApp Native] Conectado com sucesso! Número: +${nativeOwnerJid}`);
        addBotLog({
          from: nativeOwnerJid || 'Sistema',
          incomingText: 'Pareamento WhatsApp Direto',
          replyText: `Aparelho conectado diretamente (+${nativeOwnerJid || 'WhatsApp'})`,
          status: 'sent'
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMsg = (lastDisconnect?.error as any)?.message || '';
        const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        console.log(`[WhatsApp Native] Conexão fechada. Código: ${statusCode} | Msg: ${errorMsg}`);

        if (loggedOut) {
          clearNativeAuthDir();
          nativeStatus = 'disconnected';
          nativeOwnerJid = null;
          nativeQrRaw = null;
          nativeQrDataUrl = null;
          nativePairingCode = null;
          nativeLastError = 'Sessão desconectada no celular. Gere um novo QR Code.';
          return;
        }

        if (!nativeManualStop && nativeReconnectAttempts < 6) {
          nativeReconnectAttempts++;
          const hasCreds = Boolean(state.creds?.me?.id || state.creds?.registered || fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json')));
          if (hasCreds || statusCode === DisconnectReason.restartRequired || statusCode === 515) {
            setTimeout(() => {
              startNativeWhatsApp().catch(() => {});
            }, 2000);
            return;
          }
        }

        nativeStatus = 'disconnected';
        nativeLastError = errorMsg || 'Conexão encerrada. Tente gerar um novo QR Code.';
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const msg of messages) {
        try {
          if (!msg.message) continue;
          const msgId = msg.key.id;
          if (msgId && sentBotMessageIds.has(msgId)) continue;

          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

          // Ignore old messages synced from history (older than 2 minutes)
          const msgTs = Number(msg.messageTimestamp || 0);
          if (msgTs > 0 && Date.now() / 1000 - msgTs > 120) continue;

          const cleanSender = remoteJid.split(':')[0].split('@')[0];
          const ownNum = (sock.user?.id || '').split(':')[0].split('@')[0];
          const ownLid = (sock.user?.lid || '').split(':')[0].split('@')[0];
          const isSelfChat = Boolean(cleanSender && (cleanSender === ownNum || cleanSender === ownLid));

          // Ignore manual human replies sent from the store phone to customers, but allow self-chat testing
          if (msg.key.fromMe && !isSelfChat) continue;

          const content = unwrapWhatsAppMessage(msg.message);
          const incomingText =
            content?.conversation ||
            content?.extendedTextMessage?.text ||
            content?.imageMessage?.caption ||
            content?.videoMessage?.caption ||
            content?.buttonsResponseMessage?.selectedDisplayText ||
            content?.buttonsResponseMessage?.selectedButtonId ||
            content?.listResponseMessage?.title ||
            content?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            content?.templateButtonReplyMessage?.selectedDisplayText ||
            '';

          if (!incomingText.trim()) continue;

          if (cachedStoreConfig.botEnabled === false) {
            console.log(`[WhatsApp Native] Robô pausado nas configurações; ignorando mensagem de +${cleanSender}.`);
            continue;
          }

          const pushName = msg.pushName || 'Cliente';
          console.log(`[WhatsApp Native] Mensagem recebida de +${cleanSender} (${pushName}): "${incomingText}"`);

          const replyText = processIncomingMessage(incomingText, pushName);
          const sent = await sock.sendMessage(remoteJid, { text: replyText });
          trackSentMessageId(sent?.key?.id);

          console.log(`[WhatsApp Native] Resposta automática enviada para ${remoteJid}`);
          addBotLog({
            from: cleanSender,
            pushName,
            incomingText,
            replyText,
            status: 'sent'
          });
        } catch (msgErr: any) {
          console.error('[WhatsApp Native] Erro ao responder mensagem:', msgErr?.message || msgErr);
          addBotLog({
            from: msg?.key?.remoteJid?.split('@')[0] || 'Desconhecido',
            incomingText: 'Mensagem recebida',
            replyText: '',
            status: 'error',
            details: msgErr?.message || String(msgErr)
          });
        }
      }
    });

    if (options?.pairingPhone && !state.creds.registered) {
      const cleanPhone = options.pairingPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        setTimeout(async () => {
          try {
            if (nativeSocket === sock && nativeStatus !== 'connected') {
              const code = await sock.requestPairingCode(cleanPhone);
              nativePairingCode = code;
              nativeStatus = 'qr_ready';
              console.log(`[WhatsApp Native] Código de pareamento gerado para ${cleanPhone}: ${code}`);
            }
          } catch (pairErr: any) {
            nativeLastError = pairErr?.message || 'Erro ao solicitar código de pareamento';
          }
        }, 2500);
      }
    }
  } catch (err: any) {
    nativeStatus = 'disconnected';
    nativeLastError = err?.message || 'Falha ao iniciar conexão nativa com WhatsApp';
    throw err;
  }
}

// Send Text via Native Socket (if connected) or Evolution API
async function sendWhatsAppMessage(targetNumber: string, messageText: string, config: typeof cachedStoreConfig) {
  const cleanNumber = normalizePhoneDigits(targetNumber);
  if (!cleanNumber || cleanNumber.length < 10) {
    throw new Error('Número de telefone inválido. Informe DDD + número (ex: 5519999999999).');
  }

  // If native session is currently reconnecting after server startup, wait up to 6s for it to open
  if (nativeStatus === 'connecting' && fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json'))) {
    const waitStart = Date.now();
    while (nativeStatus === 'connecting' && Date.now() - waitStart < 6000) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // Priority 1: Native Baileys socket if paired and open
  if (nativeStatus === 'connected' && nativeSocket) {
    const jid = await resolveWhatsAppJid(nativeSocket, cleanNumber);
    const result = await nativeSocket.sendMessage(jid, { text: messageText });
    trackSentMessageId(result?.key?.id);
    return { provider: 'native', jid, result };
  }

  let cleanUrl = (config.evolutionUrl || '').trim().replace(/\/$/, '');
  if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  const cleanInstance = (config.evolutionInstance || 'supreme-bot').trim();
  const cleanToken = (config.evolutionToken || 'Rmfa1100@').trim();

  if (!cleanUrl || !cleanInstance) {
    throw new Error('Nenhum canal de WhatsApp conectado (conecte via QR Code Direto ou Evolution API).');
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
      nativeStatus,
      nativeIsPaired: nativeStatus === 'connected',
      nativeOwnerJid,
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
    nativeStatus,
    nativeOwnerJid,
    recentLogs: recentBotLogs
  });
});

// Native WhatsApp Web (Baileys): Start / Generate QR Code
app.post('/api/whatsapp/native/connect', async (req: Request, res: Response) => {
  try {
    const forceFresh = req.body?.forceFresh !== false;
    await startNativeWhatsApp({ forceFresh });

    // Wait up to 10s for QR code or immediate connection
    const startMs = Date.now();
    while (Date.now() - startMs < 10000) {
      if (nativeStatus === 'connected') {
        return res.json({
          success: true,
          connected: true,
          ownerJid: nativeOwnerJid,
          message: 'WhatsApp conectado diretamente com sucesso!'
        });
      }
      if (nativeQrDataUrl) {
        return res.json({
          success: true,
          connected: false,
          qrCode: nativeQrDataUrl,
          qrRaw: nativeQrRaw
        });
      }
      if (nativeStatus === 'disconnected' && nativeLastError) {
        return res.status(500).json({ error: nativeLastError });
      }
      await new Promise(r => setTimeout(r, 350));
    }

    return res.json({
      success: false,
      status: nativeStatus,
      error: nativeLastError || 'Tempo esgotado aguardando QR Code do WhatsApp Web. Tente novamente.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao gerar QR Code direto' });
  }
});

// Native WhatsApp Web (Baileys): Request 8-digit Pairing Code by phone number
app.post('/api/whatsapp/native/pairing-code', async (req: Request, res: Response) => {
  try {
    const cleanPhone = String(req.body?.phoneNumber || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Informe o número completo com DDI + DDD (ex: 5519999999999).' });
    }
    await startNativeWhatsApp({ forceFresh: true, pairingPhone: cleanPhone });

    const startMs = Date.now();
    while (Date.now() - startMs < 12000) {
      if (nativeStatus === 'connected') {
        return res.json({
          success: true,
          connected: true,
          ownerJid: nativeOwnerJid
        });
      }
      if (nativePairingCode) {
        return res.json({
          success: true,
          connected: false,
          pairingCode: nativePairingCode
        });
      }
      if (nativeStatus === 'disconnected' && nativeLastError) {
        return res.status(500).json({ error: nativeLastError });
      }
      await new Promise(r => setTimeout(r, 400));
    }

    return res.json({
      success: false,
      error: nativeLastError || 'Não foi possível obter o código de pareamento a tempo.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao gerar código de pareamento' });
  }
});

// Native WhatsApp Web (Baileys): Status polling
app.get('/api/whatsapp/native/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: nativeStatus,
    isPaired: nativeStatus === 'connected',
    ownerJid: nativeOwnerJid,
    qrDataUrl: nativeQrDataUrl,
    pairingCode: nativePairingCode,
    lastError: nativeLastError,
    recentLogs: recentBotLogs.slice(0, 10)
  });
});

// Native WhatsApp Web (Baileys): Disconnect
app.post('/api/whatsapp/native/disconnect', async (_req: Request, res: Response) => {
  nativeManualStop = true;
  try {
    if (nativeSocket) {
      await nativeSocket.logout().catch(() => {});
    }
  } catch (_) {}
  await stopNativeSocket();
  clearNativeAuthDir();
  nativeStatus = 'disconnected';
  nativeOwnerJid = null;
  nativeQrRaw = null;
  nativeQrDataUrl = null;
  nativePairingCode = null;
  res.json({ success: true });
});

// Unified Send Message route (uses Native Socket if connected, or Evolution API)
app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
    }
    const result = await sendWhatsAppMessage(String(phone), String(message), cachedStoreConfig);
    addBotLog({
      from: normalizePhoneDigits(String(phone)),
      incomingText: 'Disparo Manual / Pedido',
      replyText: String(message),
      status: 'sent'
    });
    res.json({ success: true, result });
  } catch (err: any) {
    addBotLog({
      from: normalizePhoneDigits(String(req.body?.phone || '')),
      incomingText: 'Tentativa de Disparo',
      replyText: String(req.body?.message || '').slice(0, 120),
      status: 'error',
      details: err.message || String(err)
    });
    res.status(500).json({ error: err.message || 'Falha ao enviar mensagem' });
  }
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
      variableValue: '2.3000.1043857760',
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
    if (fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json'))) {
      console.log('🔄 [WhatsApp Native] Sessão salva encontrada! Reconectando automaticamente...');
      startNativeWhatsApp().catch((e) => console.warn('[WhatsApp Native] Falha ao reconectar:', e?.message));
    }
  });
}

startServer();
