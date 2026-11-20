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
import { verifyAdmin, webhookSecretOk } from './api/_lib/adminAuth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

let adminDb: Firestore | null = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
    }
    const app = getApps()[0];
    adminDb = getFirestore(app);
    const dbId = firebaseConfig.firestoreDatabaseId;
    if (dbId && dbId !== '(default)') {
      adminDb.settings({ databaseId: dbId });
    }
    console.log('Firebase Admin conectado');
  } else {
    console.error('ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_JSON não configurada. O bot do WhatsApp precisará desta chave para acessar o Firestore.');
  }
} catch (e: any) {
  console.error('ERRO ao inicializar Firebase Admin:', e?.message || e);
}

for (const level of ['log', 'info', 'warn'] as const) {
  const original = (console as any)[level].bind(console);
  (console as any)[level] = (...args: any[]) => {
    const first = String(args[0] ?? '');
    if (/Closing session|Opening session|Removing old closed session|Migrating session|SessionEntry|Session already/i.test(first)) return;
    original(...args);
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
let PORT = Number(process.env.PORT) || (isProd ? 8080 : 3000);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    const p = Number(args[i + 1]);
    if (!isNaN(p) && p > 0) PORT = p;
  }
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));
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

const BOT_LOGS_FILE = path.resolve(__dirname, '.wa_bot_logs.json');
let recentBotLogs: BotLog[] = [];
try {
  if (fs.existsSync(BOT_LOGS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(BOT_LOGS_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      recentBotLogs = parsed.slice(0, 50);
    }
  }
} catch (_) {}

function persistBotLogs() {
  try {
    fs.writeFileSync(BOT_LOGS_FILE, JSON.stringify(recentBotLogs.slice(0, 50), null, 2));
  } catch (_) {}
}

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
  persistBotLogs();
  return newLog;
}

const ENABLE_NATIVE = process.env.ENABLE_NATIVE_WHATSAPP === 'true';

function getEffectiveProvider(): string {
  const raw = cachedStoreConfig.connectionProvider || 'evolution';
  if (raw === 'native' && !ENABLE_NATIVE) {
    return 'evolution';
  }
  return raw;
}

// In-memory store config cache (updated via sync or API)
let cachedStoreConfig = {
  botEnabled: true,
  botName: 'Supreme Bot Premium 💜',
  storeName: 'Sorveteria Gourmet Supreme',
  phone: '5519974118672',
  connectionProvider: 'evolution',
  evolutionUrl: 'https://supreme-bot-2bm0.onrender.com',
  evolutionInstance: 'supreme-bot',
  evolutionToken: 'Rmfa1100@',
  welcomeMsg: `Olá! Seja muito bem-vindo ao assistente automático da *Sorveteria Gourmet Supreme*! 🍨\n\nSou o *Supreme Bot Premium 💜*.\n\nEscolha uma das opções abaixo enviando o número ou digitando sua dúvida:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`,
  closedMsg: `🌙 *ESTABELECIMENTO FECHADO NO MOMENTO*\n\nOlá, *{nome}*! No momento nossa sorveteria encontra-se fechada. 🍨\n\nVocê pode navegar pelo nosso cardápio online e programar seu pedido para quando abrirmos, ou deixar sua mensagem que responderemos assim que a loja abrir!\n\n👉 Cardápio: {menu_link}`,
  menuLink: 'https://sorveteriasupreme.vercel.app',
  menuMsg: `⭐️ *CARDÁPIO DIGITAL SUPREME* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso cardápio online para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\nEnvie *1* para fazer pedido ou *4* para falar com atendente!`,
  supportMsg: `🙋‍♂️ *CONECTANDO À NOSSA EQUIPE*\n\nEntendi! Estou transferindo seu atendimento para a nossa equipe na loja física. Nosso tempo médio de resposta é de menos de 4 minutos!`,
  address: 'Rua Chequer Assis, 195 - ao lado do extra supermercado - Monte Mor/SP',
  openHours: '13:00 às 20:00',
  statusOverride: 'auto',
  openTime: '13:00',
  closeTime: '20:00',
  weeklyHours: []
};

let lastSyncedConfigStr = '';

// Auto-sync configuration directly from Firestore settings/store_config
async function syncStoreConfigFromDb() {
  try {
    if (!adminDb) return;
    const snap = await adminDb.collection('settings').doc('store_config').get();
    if (snap.exists) {
      const data = snap.data() || {};
      const rawProv = data.whatsappConnectionProvider || cachedStoreConfig.connectionProvider || 'evolution';
      const effectiveProv = (!ENABLE_NATIVE && rawProv === 'native') ? 'evolution' : rawProv;

      const newConfig = {
        ...cachedStoreConfig,
        botEnabled: data.whatsappBotEnabled !== false,
        botName: data.whatsappBotName || cachedStoreConfig.botName,
        storeName: data.name || cachedStoreConfig.storeName,
        phone: data.phone || cachedStoreConfig.phone,
        connectionProvider: effectiveProv,
        evolutionUrl: (data.whatsappEvolutionUrl || cachedStoreConfig.evolutionUrl || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/$/, ''),
        evolutionInstance: (data.whatsappEvolutionInstance || cachedStoreConfig.evolutionInstance || 'supreme-bot').trim(),
        evolutionToken: (data.whatsappEvolutionToken || cachedStoreConfig.evolutionToken || 'Rmfa1100@').trim(),
        welcomeMsg: data.whatsappBotWelcomeMessage || cachedStoreConfig.welcomeMsg,
        closedMsg: data.whatsappBotClosedMessage || cachedStoreConfig.closedMsg,
        menuMsg: data.whatsappBotMenuMessage || cachedStoreConfig.menuMsg,
        menuLink: (data.whatsappBotMenuLink && !String(data.whatsappBotMenuLink).includes('.run.app'))
          ? String(data.whatsappBotMenuLink).trim().replace(/\/+$/, '')
          : cachedStoreConfig.menuLink,
        supportMsg: data.whatsappBotSupportMessage || cachedStoreConfig.supportMsg,
        address: data.address || cachedStoreConfig.address,
        statusOverride: data.statusOverride || 'auto',
        openTime: data.openTime || '13:00',
        closeTime: data.closeTime || '20:00',
        weeklyHours: data.weeklyHours || []
      };

      const configStr = JSON.stringify(newConfig);
      if (configStr !== lastSyncedConfigStr) {
        lastSyncedConfigStr = configStr;
        cachedStoreConfig = newConfig;
        console.log(`✅ [WhatsApp Bot] Configurações carregadas do Firestore! Provedor: ${cachedStoreConfig.connectionProvider} | Evolution URL: ${cachedStoreConfig.evolutionUrl}`);
      }
    }
  } catch (err: any) {
    // Read failed, using cached config
  }
}

// Initial sync on startup (no periodic polling)
syncStoreConfigFromDb();

// Evolution keepalive ping every 10 minutes to prevent Render free instance from sleeping
async function pingEvolutionKeepAlive() {
  try {
    const url = (cachedStoreConfig.evolutionUrl || '').trim().replace(/\/+$/, '');
    if (url) {
      const clean = url.startsWith('http') ? url : `https://${url}`;
      await fetch(clean, { signal: AbortSignal.timeout(8000) }).catch(() => {});
    }
  } catch (_) {}
}
setTimeout(pingEvolutionKeepAlive, 5000);
setInterval(pingEvolutionKeepAlive, 10 * 60 * 1000);

// Protect native routes if ENABLE_NATIVE is false
app.use('/api/whatsapp/native', (req: Request, res: Response, next: Function) => {
  if (!ENABLE_NATIVE) {
    return res.status(410).json({ error: 'Conexão direta desativada. Use a Evolution API.' });
  }
  next();
});

// Check if store is currently open based on Brasilia time and weekly hours / statusOverride
function isStoreCurrentlyOpen() {
  const cfg = cachedStoreConfig;
  if (cfg.statusOverride === 'open') return true;
  if (cfg.statusOverride === 'closed') return false;

  const now = new Date();
  const formatterTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatterTime.formatToParts(now);
  let hours = 0;
  let minutes = 0;
  for (const p of parts) {
    if (p.type === 'hour') hours = parseInt(p.value, 10);
    if (p.type === 'minute') minutes = parseInt(p.value, 10);
  }
  if (hours === 24) hours = 0;
  const currentMinutes = hours * 60 + minutes;

  const formatterDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short'
  });
  const dayStr = formatterDay.format(now).toLowerCase();
  const dayMap: Record<string, number> = {
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
  };
  const dayOfWeekIndex = dayMap[dayStr] ?? now.getDay();
  const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;
  const dayOfWeekKey = dayKeys[dayOfWeekIndex];

  if (cfg.weeklyHours && Array.isArray(cfg.weeklyHours) && cfg.weeklyHours.length > 0) {
    const todaySchedule = cfg.weeklyHours.find((h: any) => h.dayOfWeek === dayOfWeekKey);
    if (todaySchedule) {
      if (!todaySchedule.isOpen) return false;
      const [openH, openM] = (todaySchedule.openTime || "13:00").split(':').map(Number);
      const [closeH, closeM] = (todaySchedule.closeTime || "20:00").split(':').map(Number);
      const openTotalMinutes = openH * 60 + openM;
      const closeTotalMinutes = closeH * 60 + closeM;
      if (closeTotalMinutes > openTotalMinutes) {
        return currentMinutes >= openTotalMinutes && currentMinutes < closeTotalMinutes;
      } else {
        return currentMinutes >= openTotalMinutes || currentMinutes < closeTotalMinutes;
      }
    }
  }

  const [openHour, openMin] = (cfg.openTime || "13:00").split(':').map(Number);
  const [closeHour, closeMin] = (cfg.closeTime || "20:00").split(':').map(Number);
  const openTotalMinutes = openHour * 60 + openMin;
  const closeTotalMinutes = closeHour * 60 + closeMin;
  if (closeTotalMinutes > openTotalMinutes) {
    return currentMinutes >= openTotalMinutes && currentMinutes < closeTotalMinutes;
  } else {
    return currentMinutes >= openTotalMinutes || currentMinutes < closeTotalMinutes;
  }
}

// Track contacts greeted recently (key: sender digits/jid -> timestamp ms) so first message in 24h triggers Welcome/Absence Message once
const greetedContacts = new Map<string, number>();
const GREET_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const conversationPauseCache = new Map<string, { paused: boolean; expires: number }>();
const processedWebhookMessageIds = new Set<string>();

// Determine response text based on incoming message
function processIncomingMessage(userText: string, pushName: string = 'Cliente', senderKey?: string) {
  const clean = userText.trim().toLowerCase();
  const cfg = cachedStoreConfig;

  const isExactOption = clean === '1' || clean === '2' || clean === '3' || clean === '4';
  const lastGreeted = senderKey ? greetedContacts.get(senderKey) : undefined;
  const isFirstContact = senderKey ? (!lastGreeted || Date.now() - lastGreeted > GREET_TTL_MS) : false;

  if (senderKey && isFirstContact) {
    greetedContacts.set(senderKey, Date.now());
    if (greetedContacts.size > 1000) {
      const now = Date.now();
      for (const [k, ts] of greetedContacts.entries()) {
        if (now - ts > 48 * 60 * 60 * 1000) {
          greetedContacts.delete(k);
        }
      }
    }
  }

  const storeOpen = isStoreCurrentlyOpen();

  // If store is closed, return the automated closed absence message on first contact / greeting / default
  if (!storeOpen && ((isFirstContact && !isExactOption) || /^(oi|olá|ola|oii+|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|ajuda|menu inicial)\b/i.test(clean) || !isExactOption)) {
    if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean === 'menu') {
      return `🌙 *ESTABELECIMENTO FECHADO NO MOMENTO*\n\nOlá, *${pushName}*! Nossa sorveteria está fechada agora, mas você pode conferir o cardápio e programar seu pedido para quando abrirmos:\n👉 ${cfg.menuLink}`;
    }
    if (clean === '4' || clean.includes('atendente') || clean.includes('humano')) {
      return cfg.supportMsg.replace('{telefone}', cfg.phone).replace('[TELEFONE]', cfg.phone) + `\n\n*(Nota: A loja está fechada no momento, responderemos assim que abrirmos!)*`;
    }
    return cfg.closedMsg.replace('{nome}', pushName).replace('{menu_link}', cfg.menuLink);
  }

  // First contact (any text except exact menu digit 1/2/3/4) OR explicit greeting => ALWAYS send Welcome Message!
  if ((isFirstContact && !isExactOption) || /^(oi|olá|ola|oii+|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|ajuda|menu inicial)\b/i.test(clean)) {
    return cfg.welcomeMsg.replace('{nome}', pushName);
  }

  // 1. Menu
  if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean === 'menu') {
    const raw = cfg.menuMsg.replace('{menu_link}', cfg.menuLink).replace('[LINK_CARDAPIO]', cfg.menuLink);
    return storeOpen ? raw : `🌙 *ESTABELECIMENTO FECHADO*\n\n${raw}\n\n*(Nota: A loja encontra-se fechada no momento).*`;
  }

  // 2. Track Order (only explicit tracking words, not "fazer pedido")
  if (clean === '2' || clean.includes('rastrear') || clean.includes('rastreio') || clean.includes('status') || clean.includes('onde esta') || clean.includes('onde está') || clean.includes('meu pedido') || clean.includes('acompanhar')) {
    return `🔍 *RASTREADOR DE PEDIDOS SUPREME*\n\nOlá, *${pushName}*! Para acompanhar o status do seu pedido em tempo real, acesse:\n👉 ${cfg.menuLink}?track=true\n\nCaso já tenha o código do pedido (ex: #SUP123), digite aqui que verificamos para você!`;
  }

  // 3. Location & Hours
  if (clean === '3' || clean.includes('localizacao') || clean.includes('localização') || clean.includes('onde fica') || clean.includes('endereco') || clean.includes('endereço') || clean.includes('horario') || clean.includes('horário')) {
    return `📍 *LOCALIZAÇÃO & HORÁRIOS SUPREME*\n\n🏠 *Endereço:* ${cfg.address}\n⏰ *Horário de Funcionamento:* ${cfg.openHours}\n💬 *WhatsApp (Somente Mensagens):* ${cfg.phone}\n\nStatus Atual: ${storeOpen ? '🟢 *ABERTO*' : '🔴 *FECHADO*'}`;
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
const repliedInboundMsgIds = new Set<string>();
const sentMessageStore = new Map<string, any>();

function trackSentMessageId(id?: string | null, msgProto?: any) {
  if (!id) return;
  sentBotMessageIds.add(id);
  if (msgProto) {
    sentMessageStore.set(id, msgProto);
  }
  if (sentBotMessageIds.size > 300) {
    const first = sentBotMessageIds.values().next().value;
    if (first) {
      sentBotMessageIds.delete(first);
      sentMessageStore.delete(first);
    }
  }
}

let nativeConnectedAtMs = 0;

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
    } else if (current.deviceSentMessage?.message) {
      current = current.deviceSentMessage.message;
    } else if (current.associatedChildMessage?.message) {
      current = current.associatedChildMessage.message;
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
      logger: pino({ level: 'warn' }) as any,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      connectTimeoutMs: 25000,
      defaultQueryTimeoutMs: 25000,
      keepAliveIntervalMs: 20000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      getMessage: async (key) => {
        if (key?.id && sentMessageStore.has(key.id)) {
          return sentMessageStore.get(key.id);
        }
        return undefined;
      }
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
        nativeConnectedAtMs = Date.now();
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

        if (!nativeManualStop && nativeReconnectAttempts < 6 && cachedStoreConfig.connectionProvider === 'native') {
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
      if (type !== 'notify') return; // Ignore append events
      for (const msg of messages) {
        try {
          const fromMe = Boolean(msg.key.fromMe);
          if (fromMe) continue; // Ignore messages sent from self
          const msgId = msg.key.id;
          if (!msg.message) continue;

          const remoteJid = msg.key.remoteJid || '';
          if (
            !remoteJid ||
            remoteJid.endsWith('@g.us') ||
            remoteJid.endsWith('@newsletter') ||
            remoteJid === 'status@broadcast'
          ) {
            continue;
          }

          const remoteBase = remoteJid.split(':')[0].split('@')[0];
          const ownNum = (sock.user?.id || state.creds?.me?.id || '').split(':')[0].split('@')[0];
          const ownLid = (sock.user?.lid || (state.creds?.me as any)?.lid || '').split(':')[0].split('@')[0];
          if (nativeOwnerJid && remoteBase === nativeOwnerJid) continue;
          if (ownNum && remoteBase === ownNum) continue;
          if (ownLid && remoteBase === ownLid) continue;

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

          const hasCustomerMedia = Boolean(
            content?.imageMessage ||
            content?.videoMessage ||
            content?.audioMessage ||
            content?.stickerMessage ||
            content?.documentMessage ||
            content?.locationMessage ||
            content?.contactMessage
          );

          const effectiveText = incomingText.trim() || (hasCustomerMedia ? 'Oi' : '');
          if (!effectiveText) continue;

          if (cachedStoreConfig.botEnabled === false) continue;

          const pushName = msg.pushName || 'Cliente';
          await processConversationBotMessage({
            phone: remoteBase,
            pushName,
            incomingText: effectiveText,
            msgId,
            fromMe
          });
        } catch (msgErr: any) {
          console.error('[WhatsApp Native] Erro ao responder mensagem:', msgErr?.message || msgErr);
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

// Send Text via Native Socket (if connected and config.connectionProvider === 'native') or Evolution API
async function sendWhatsAppMessage(targetNumber: string, messageText: string, config: typeof cachedStoreConfig) {
  const cleanNumber = normalizePhoneDigits(targetNumber);
  if (!cleanNumber || cleanNumber.length < 10) {
    throw new Error('Número de telefone inválido. Informe DDD + número (ex: 5519999999999).');
  }

  // If native session files exist (.wa_auth/creds.json) or socket is active, use Native Baileys socket
  const hasNativeSession = fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json')) || Boolean(nativeSocket) || nativeStatus === 'connected';

  if (hasNativeSession) {
    if (nativeStatus !== 'connected' || !nativeSocket) {
      console.log('🔄 [WhatsApp Native] Sessão salva encontrada, mas socket inativo. Iniciando conexão nativa para envio...');
      try {
        await startNativeWhatsApp();
      } catch (e) {
        console.warn('[WhatsApp Native] Falha ao iniciar socket sob demanda:', e);
      }
      const startWait = Date.now();
      while (nativeStatus !== 'connected' && Date.now() - startWait < 10000) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (nativeStatus === 'connected' && nativeSocket) {
      try {
        const jid = await resolveWhatsAppJid(nativeSocket, cleanNumber);
        const result = await nativeSocket.sendMessage(jid, { text: messageText });
        trackSentMessageId(result?.key?.id, result?.message);
        return { provider: 'native', jid, result };
      } catch (nativeErr: any) {
        console.warn('[WhatsApp] Falha ao enviar via socket nativo, tentando auto-reconexão:', nativeErr?.message || nativeErr);
        try {
          await startNativeWhatsApp({ forceFresh: false });
          const retryWait = Date.now();
          while (nativeStatus !== 'connected' && Date.now() - retryWait < 8000) {
            await new Promise((r) => setTimeout(r, 300));
          }
          if (nativeStatus === 'connected' && nativeSocket) {
            const jid = await resolveWhatsAppJid(nativeSocket, cleanNumber);
            const result = await nativeSocket.sendMessage(jid, { text: messageText });
            trackSentMessageId(result?.key?.id, result?.message);
            return { provider: 'native', jid, result };
          }
        } catch (retryErr) {
          console.warn('[WhatsApp] Tentativa de reenvio falhou:', retryErr);
        }
        throw new Error('WhatsApp desconectado (Erro 400). Vá na aba "Conexão & QR Code Real", clique em "Desconectar" e escaneie um novo QR Code.');
      }
    } else {
      throw new Error('WhatsApp Nativo está offline ou reconectando. Aguarde alguns segundos e tente novamente.');
    }
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

  // Pre-check live socket state on Render so connecting/closed instances fail fast
  try {
    const stRes = await fetch(`${cleanUrl}/instance/connectionState/${cleanInstance}`, {
      headers: { apikey: cleanToken },
      signal: AbortSignal.timeout(5000)
    });
    if (stRes.ok) {
      const stJson: any = await stRes.json();
      const liveState = stJson?.instance?.state || stJson?.state;
      if (liveState && liveState !== 'open' && liveState !== 'CONNECTED') {
        const err: any = new Error(`Instância "${cleanInstance}" está em estado "${liveState}" no Render (reconectando ou desconectada do WhatsApp). Clique em "Forçar Novo QR Code".`);
        err.status = 503;
        throw err;
      }
    }
  } catch (preErr: any) {
    if (preErr?.status === 503) throw preErr;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

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
        text: messageText,
        delay: 0,
        linkPreview: false
      })
    });

    clearTimeout(timeoutId);
    const responseText = await res.text();
    if (!res.ok) {
      const errTxt = responseText;
      let friendlyMsg = `Evolution API erro ${res.status}: ${errTxt}`;
      if (/connection closed|closed|400/i.test(errTxt)) {
        friendlyMsg = `WhatsApp está desconectado no Render (Connection Closed). Reconecte o aparelho na aba "Conexão & QR Code Real".`;
      }
      const err: any = new Error(friendlyMsg);
      err.status = res.status;
      throw err;
    }

    let data = null;
    try { data = JSON.parse(responseText); } catch (_) {}
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      const timeoutErr: any = new Error(`Render Evolution API (/message/sendText/${cleanInstance}) travou >18s para +${cleanNumber} mesmo conectada. No Render > Environment defina CACHE_REDIS_ENABLED=false e CACHE_LOCAL_ENABLED=true (ou use Conexão Direta / Z-API).`);
      timeoutErr.status = 504;
      throw timeoutErr;
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

    // Live in-memory socket check (overrides stale Postgres fetchInstances status)
    try {
      const stateRes = await fetch(`${cleanUrl}/instance/connectionState/${cleanInstance}`, {
        method: 'GET',
        headers: { 'apikey': cleanToken }
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const st = stateData?.instance?.state || stateData?.state;
        if (st === 'open' || st === 'CONNECTED') {
          isPaired = true;
          instanceState = 'open';
        } else if (st) {
          isPaired = false;
          instanceState = st;
        }
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

// Test Webhook proxy (bypasses browser CORS for external webhook testing)
app.post('/api/whatsapp/test-webhook', async (req: Request, res: Response) => {
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Não autorizado. Entre como administrador.' });
  }
  try {
    const { url, payload } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL do webhook é obrigatória.' });
    }
    const webhookRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const text = await webhookRes.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { data = { rawText: text }; }

    res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
      data
    });
  } catch (err: any) {
    res.json({
      success: false,
      status: 500,
      statusText: 'Network Error',
      data: { error: `Falha de rede ao disparar webhook (o servidor Render pode estar dormindo): ${err.message || err}` }
    });
  }
});

// Unified Send Message route (uses Native Socket if connected, or Evolution API)
app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Não autorizado. Entre como administrador.' });
  }
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

// Pause / Resume bot per conversation route
app.post(['/api/pausar-bot', '/api/whatsapp/pausar-bot'], async (req: Request, res: Response) => {
  try {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    const pausado = Boolean(req.body?.pausado);
    if (!phone || phone.length < 8) {
      return res.status(400).json({ ok: false, error: 'Telefone inválido' });
    }
    if (!adminDb) {
      return res.status(500).json({ ok: false, error: 'Firebase Admin não inicializado' });
    }
    await adminDb.collection('conversas_bot').doc(phone).set({
      phone,
      botPausado: pausado,
      pausadoEm: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    conversationPauseCache.set(phone, { paused: pausado, expires: Date.now() + 5 * 60 * 1000 });
    return res.json({ ok: true, phone, botPausado: pausado });
  } catch (err: any) {
    console.error('Error pausing bot in server.ts:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal error' });
  }
});

// Notify store owner about new order via WhatsApp without touching Firestore (bypassing Firestore quota limits)
app.post(['/api/notificar-pedido', '/api/whatsapp/notificar-pedido'], async (req: Request, res: Response) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const orderData = req.body || {};
    const orderId = String(orderData.id || `SUP-${Date.now().toString().slice(-6)}`).slice(-6).toUpperCase();
    const customerName = String(orderData.customerName || orderData.details?.customerName || 'Cliente');
    const customerPhone = String(orderData.customerPhone || orderData.details?.customerPhone || '');
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const total = Number(orderData.total || 0);
    const deliveryType = String(orderData.deliveryType || orderData.details?.deliveryType || 'delivery');
    const address = String(orderData.address || orderData.details?.address || 'Retirada na Loja');
    const paymentType = String(orderData.paymentType || orderData.details?.paymentType || 'pix');
    const notes = String(orderData.notes || orderData.details?.notes || '');

    const itemsFormatted = items.map((item: any) => {
      const q = item.quantity || 1;
      const name = item.menuItem?.name || item.name || 'Item';
      const itemTotal = ((item.customCupPrice || item.menuItem?.price || item.price || 0) * q).toFixed(2);
      let desc = `• ${q}x ${name} (R$ ${itemTotal})`;
      if (item.customCupConfig) {
        const sz = item.customCupConfig.size || '';
        if (sz) desc += ` [Tamanho: ${sz}]`;
        if (item.customCupConfig.flavors?.length) desc += ` [Sabores: ${item.customCupConfig.flavors.join(', ')}]`;
        if (item.customCupConfig.toppings?.length) desc += ` [Adicionais: ${item.customCupConfig.toppings.join(', ')}]`;
      }
      if (item.notes) desc += ` (Obs: ${item.notes})`;
      return desc;
    }).join('\n');

    const paymentMap: Record<string, string> = {
      'pix': '💳 PIX Online',
      'card': '💳 Cartão App',
      'cash_on_delivery': '💵 Dinheiro na Entrega',
      'card_on_delivery': '💳 Cartão na Entrega'
    };
    const paymentText = paymentMap[paymentType] || paymentType;
    const typeText = deliveryType === 'delivery' ? '🛵 Delivery' : '🏃 Retirada na Loja';

    const messageText = `🚨 *NOVO PEDIDO RECEBIDO! (#SUP${orderId})* 🚨\n\n👤 *Cliente:* ${customerName}\n📱 *Telefone:* ${customerPhone}\n📍 *Tipo:* ${typeText}\n🏠 *Endereço:* ${address}\n💳 *Pagamento:* ${paymentText}\n\n🛒 *Itens do Pedido:*\n${itemsFormatted}\n\n💰 *Total do Pedido: R$ ${total.toFixed(2)}*\n${notes ? `\n📝 *Obs Geral:* ${notes}` : ''}\n\n_Enviado pelo Alerta de Pedidos Sem Firestore_`;

    const evoUrl = (process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/+$/, '');
    const evoInstance = (process.env.EVOLUTION_INSTANCE || 'supreme-bot').trim();
    const evoToken = (process.env.EVOLUTION_TOKEN || 'Rmfa1100@').trim();
    const ownerPhone = (process.env.NUMERO_DONO || process.env.WHATSAPP_DONO || '5519974118672').replace(/\D/g, '');

    if (!ownerPhone || ownerPhone.length < 10) {
      return res.status(400).json({ ok: false, error: 'NUMERO_DONO not configured' });
    }

    let sentOk = false;
    let lastResult = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sendRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evoToken
          },
          body: JSON.stringify({
            number: ownerPhone,
            text: messageText,
            delay: 0,
            linkPreview: false
          }),
          signal: AbortSignal.timeout(6000)
        });
        const respText = await sendRes.text();
        lastResult = respText;
        if (sendRes.ok) {
          sentOk = true;
          break;
        }
      } catch (err: any) {
        lastResult = err?.message || 'Timeout';
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    return res.status(200).json({ ok: sentOk, detail: lastResult.slice(0, 200) });
  } catch (err: any) {
    console.error('Error in /api/notificar-pedido:', err);
    return res.status(200).json({ ok: false, error: err?.message || 'Internal error' });
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

    // 4. Poll /instance/connect/:instance for QR Code (with stale-session auto-recovery)
    let qrPayloadFound: string | null = null;
    let lastResponse: any = null;

    const pollConnectQr = async (tries: number) => {
      for (let attempt = 1; attempt <= tries; attempt++) {
        try {
          const connRes = await fetch(`${cleanUrl}/instance/connect/${cleanInstance}`, {
            headers: { 'apikey': workingKey },
            signal: AbortSignal.timeout(8000)
          });
          const data: any = await connRes.json();
          lastResponse = data;

          if (data.status === 'open' || data.instance?.state === 'open') {
            return 'OPEN' as const;
          }

          const qr = data.base64 || (data.qrcode && data.qrcode.base64) || data.code || (data.qrcode && data.qrcode.code) || data.pairingCode;
          if (qr) {
            qrPayloadFound = qr;
            return 'FOUND' as const;
          }

          if (attempt < tries) {
            await new Promise(r => setTimeout(r, 1400));
          }
        } catch (_) {}
      }
      return 'EMPTY' as const;
    };

    let activeInstance = cleanInstance;
    let outcome = await pollConnectQr(2);
    if (outcome === 'EMPTY') {
      console.log(`[Evolution Connect] Sessão "${cleanInstance}" retornou vazio/count:0. Limpando sessão antiga...`);
      try {
        await fetch(`${cleanUrl}/instance/logout/${cleanInstance}`, {
          method: 'DELETE',
          headers: { 'apikey': workingKey },
          signal: AbortSignal.timeout(5000)
        });
        await new Promise(r => setTimeout(r, 1000));
      } catch (_) {}
      outcome = await pollConnectQr(1);

      if (outcome === 'EMPTY') {
        try {
          await fetch(`${cleanUrl}/instance/delete/${cleanInstance}`, {
            method: 'DELETE',
            headers: { 'apikey': workingKey },
            signal: AbortSignal.timeout(5000)
          });
          await new Promise(r => setTimeout(r, 1200));
          const recreateRes = await fetch(`${cleanUrl}/instance/create`, {
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
          if (recreateRes.ok) {
            const recreated: any = await recreateRes.json();
            const qr = recreated?.qrcode?.base64 || recreated?.qrcode?.code || recreated?.base64 || recreated?.code;
            if (qr) {
              qrPayloadFound = qr;
              outcome = 'FOUND';
            }
          }
        } catch (_) {}

        if (outcome === 'EMPTY') {
          outcome = await pollConnectQr(2);
        }
      }

      if (outcome === 'EMPTY') {
        const fallbackInst = cleanInstance === 'supreme-bot' ? 'supreme-loja' : `${cleanInstance.replace(/-v\d+$/, '')}-v2`;
        console.log(`[Evolution Connect] Instância "${cleanInstance}" travada em 401. Alternando para "${fallbackInst}"...`);
        try {
          await fetch(`${cleanUrl}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': workingKey },
            body: JSON.stringify({ instanceName: fallbackInst, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
            signal: AbortSignal.timeout(8000)
          }).catch(() => {});

          const fbRes = await fetch(`${cleanUrl}/instance/connect/${fallbackInst}`, {
            headers: { 'apikey': workingKey },
            signal: AbortSignal.timeout(8000)
          });
          if (fbRes.ok) {
            const fbData: any = await fbRes.json();
            lastResponse = fbData;
            if (fbData.status === 'open' || fbData.instance?.state === 'open') {
              activeInstance = fallbackInst;
              outcome = 'OPEN';
            } else {
              const fbQr = fbData.base64 || fbData.qrcode?.base64 || fbData.code || fbData.qrcode?.code || fbData.pairingCode;
              if (fbQr) {
                qrPayloadFound = fbQr;
                activeInstance = fallbackInst;
                outcome = 'FOUND';
              }
            }
          }
        } catch (_) {}
      }
    }

    if (outcome === 'OPEN') {
      return res.json({
        success: true,
        connected: true,
        instance: activeInstance,
        message: 'WhatsApp conectado com sucesso!'
      });
    }

    if (qrPayloadFound) {
      return res.json({
        success: true,
        connected: false,
        qrCode: qrPayloadFound,
        instance: activeInstance
      });
    }

    const needsVersionConfig = lastResponse?.count === 0 || lastResponse?.qrcode?.count === 0;

    return res.json({
      success: false,
      needsVersionConfig,
      message: needsVersionConfig
        ? 'Instância anterior travada em 401 no Render. Clique novamente em "Gerar QR Code" ou use o botão "Recriar Instância Limpa".'
        : 'Instância em inicialização no Render. Aguarde alguns instantes.',
      simulatedFallbackQr: `supreme_wa_pairing_code_${activeInstance}_${Date.now()}`
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

    // The webhook destination is the persistent production Vercel endpoint (never temporary .run.app / localhost previews)
    const rawHost = publicAppUrl || `${req.protocol}://${req.get('host')}`;
    const isTempPreview = rawHost.includes('.run.app') || rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
    const appHost = isTempPreview
      ? (cachedStoreConfig.menuLink && !cachedStoreConfig.menuLink.includes('.run.app') ? cachedStoreConfig.menuLink : 'https://sorveteriasupreme.vercel.app')
      : rawHost;
    const secretParam = process.env.WEBHOOK_SECRET ? `?secret=${encodeURIComponent(process.env.WEBHOOK_SECRET)}` : '';
    const webhookDestination = `${appHost.replace(/\/$/, '')}/api/webhook/whatsapp${secretParam}`;

    // Call Evolution API /webhook/set/{instance} with both flat and nested payloads
    const webhookPayload = {
      enabled: true,
      url: webhookDestination,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE'
      ],
      webhook: {
        enabled: true,
        url: webhookDestination,
        byEvents: false,
        base64: false,
        events: [
          'MESSAGES_UPSERT',
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
      let friendlyErr = respText;
      if (/connection closed|closed/i.test(respText)) {
        friendlyErr = 'WhatsApp está desconectado no Render (Connection Closed). Conecte o celular escaneando o QR Code na aba "Conexão & QR Code Real" antes de ativar o bot 24/7.';
      }
      return res.status(setWebhookRes.status).json({
        error: `Erro na Evolution API ao configurar webhook: ${friendlyErr}`
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

// HEALTH / WAKEUP HEARTBEAT & LOGS FOR WEBHOOK
app.get('/api/webhook/whatsapp', async (req: Request, res: Response) => {
  const wantWakeup = req.query.wakeup === '1' || req.query.wakeup === 'true' || req.query.heartbeat === '1' || req.query.heartbeat === 'true';
  let renderStatus: string | undefined;
  let instanceState: string | undefined;

  if (wantWakeup && cachedStoreConfig.evolutionUrl) {
    try {
      const evoBase = cachedStoreConfig.evolutionUrl.trim().replace(/\/+$/, '');
      const fullEvo = evoBase.startsWith('http') ? evoBase : `https://${evoBase}`;
      const pingRes = await fetch(`${fullEvo}/`, { signal: AbortSignal.timeout(12000) });
      renderStatus = pingRes.ok ? 'awake' : `http_${pingRes.status}`;
      if (pingRes.ok && cachedStoreConfig.evolutionInstance) {
        try {
          const stRes = await fetch(`${fullEvo}/instance/connectionState/${cachedStoreConfig.evolutionInstance}`, {
            headers: { apikey: cachedStoreConfig.evolutionToken },
            signal: AbortSignal.timeout(6000)
          });
          if (stRes.ok) {
            const stJson: any = await stRes.json();
            instanceState = stJson?.instance?.state || stJson?.state || undefined;
          }
        } catch {}
      }
    } catch (e: any) {
      renderStatus = `error:${e?.message || 'timeout'}`;
    }
  }

  res.json({
    ok: true,
    service: 'Supreme WhatsApp Webhook (Server)',
    ...(renderStatus ? { renderStatus } : {}),
    ...(instanceState ? { instanceState } : {}),
    recentLogs: recentBotLogs.slice(0, 15)
  });
});

// Auto setup Evolution webhook on startup if BOT_ATIVO === 'true'
async function autoSetupEvolutionWebhook() {
  if (process.env.BOT_ATIVO !== 'true') return;
  try {
    await syncStoreConfigFromDb();
    const cfg = cachedStoreConfig;
    const cleanUrl = (cfg.evolutionUrl || '').trim().replace(/\/+$/, '');
    const cleanInstance = (cfg.evolutionInstance || 'supreme-bot').trim();
    const cleanToken = (cfg.evolutionToken || 'Rmfa1100@').trim();

    if (!cleanUrl || !cleanInstance) {
      console.log('⚠️ [Auto Webhook] Evolution URL ou Instância não configurados.');
      return;
    }

    const webhookDestination = 'https://supreme-whatsapp-server.onrender.com/api/webhook/whatsapp';
    const payload = {
      enabled: true,
      url: webhookDestination,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
      webhook: {
        enabled: true,
        url: webhookDestination,
        byEvents: false,
        base64: false,
        events: ['MESSAGES_UPSERT']
      }
    };

    const res = await fetch(`${cleanUrl}/webhook/set/${cleanInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanToken
      },
      body: JSON.stringify(payload)
    });
    const txt = await res.text();
    if (res.ok) {
      console.log(`✅ [Auto Webhook] Webhook configurado na Evolution API (${cleanInstance}) para ${webhookDestination}. Resposta:`, txt);
    } else {
      console.error(`❌ [Auto Webhook] Falha ao configurar webhook (${res.status}):`, txt);
    }
  } catch (err: any) {
    console.error('❌ [Auto Webhook] Erro ao registrar webhook automaticamente:', err?.message || err);
  }
}

// Centralized robust bot message processing with Firestore transaction, deduplication & 12h cooldown
async function processConversationBotMessage({
  phone,
  pushName,
  incomingText,
  msgId,
  fromMe
}: {
  phone: string;
  pushName: string;
  incomingText: string;
  msgId?: string;
  fromMe?: boolean;
}) {
  if (fromMe) {
    console.log(`[WhatsApp Bot] Telefone: +${phone} | MsgID: ${msgId || 'N/A'} | Decisão: ignorada: fromMe`);
    return { handled: false, reason: 'from-me' };
  }
  if (!phone || phone.length < 8) return { handled: false, reason: 'invalid-phone' };

  if (!incomingText || !incomingText.trim()) {
    console.log(`[WhatsApp Bot] Telefone: +${phone} | MsgID: ${msgId || 'N/A'} | Decisão: ignorada: sem_texto`);
    return { handled: false, reason: 'no-text' };
  }

  if (!adminDb) {
    console.error(`[WhatsApp Bot] erro_transacao: Firebase Admin não inicializado (falta FIREBASE_SERVICE_ACCOUNT_JSON)`);
    return { handled: false, reason: 'erro_transacao' };
  }

  const cleanMsgId = msgId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const msgRef = adminDb.collection('mensagens_processadas').doc(cleanMsgId);
  const convRef = adminDb.collection('conversas_bot').doc(phone);

  let shouldRespond = false;
  let replyText = '';
  let decisionLog = '';

  try {
    await adminDb.runTransaction(async (transaction) => {
      // 1. Check message deduplication
      const msgSnap = await transaction.get(msgRef);
      if (msgSnap.exists) {
        decisionLog = 'ignorada: duplicada';
        return;
      }

      // 2. Check conversation state
      const convSnap = await transaction.get(convRef);
      let convData = convSnap.exists ? (convSnap.data() || {}) : {};

      let botPausado = convData.botPausado === true;
      const updatedAtVal = convData.updatedAt;
      const updatedAtMs = updatedAtVal?.toMillis ? updatedAtVal.toMillis() : (updatedAtVal ? new Date(updatedAtVal).getTime() : 0);
      const now = Date.now();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;

      // Auto unpause after 12 hours without interaction
      if (botPausado && updatedAtMs && now - updatedAtMs > TWELVE_HOURS) {
        botPausado = false;
      }

      if (botPausado) {
        decisionLog = 'ignorada: pausado';
        transaction.set(msgRef, { processedAt: FieldValue.serverTimestamp(), phone, msgId: cleanMsgId, reason: 'bot-paused' });
        return;
      }

      const storeOpen = isStoreCurrentlyOpen();
      const ultimaSaudacaoVal = convData.ultimaSaudacaoEm;
      const ultimaSaudacaoMs = ultimaSaudacaoVal?.toMillis ? ultimaSaudacaoVal.toMillis() : (ultimaSaudacaoVal ? new Date(ultimaSaudacaoVal).getTime() : 0);
      const ultimoAvisoVal = convData.ultimoAvisoFechadoEm;
      const ultimoAvisoFechadoMs = ultimoAvisoVal?.toMillis ? ultimoAvisoVal.toMillis() : (ultimoAvisoVal ? new Date(ultimoAvisoVal).getTime() : 0);

      const cleanText = incomingText.trim().toLowerCase();
      const isGreetingIntent = /^(oi|olá|ola|oii+|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|ajuda|menu inicial)\b/i.test(cleanText);

      let sentGreetingOrClosed = false;

      if (storeOpen) {
        const needsGreeting = !ultimaSaudacaoMs || (now - ultimaSaudacaoMs > TWELVE_HOURS);
        if (needsGreeting || isGreetingIntent) {
          if (!needsGreeting && !isGreetingIntent) {
            decisionLog = 'ignorada: cooldown';
            transaction.set(msgRef, { processedAt: FieldValue.serverTimestamp(), phone, msgId: cleanMsgId, reason: 'cooldown' });
            return;
          }
          replyText = cachedStoreConfig.welcomeMsg.replace('{nome}', pushName);
          sentGreetingOrClosed = true;
          decisionLog = 'enviada: saudação';
        } else {
          replyText = processIncomingMessage(incomingText, pushName, phone);
          decisionLog = 'enviada: resposta_menu';
        }
      } else {
        const needsClosedNotice = !ultimoAvisoFechadoMs || (now - ultimoAvisoFechadoMs > TWELVE_HOURS);
        if (needsClosedNotice || isGreetingIntent) {
          if (!needsClosedNotice && !isGreetingIntent) {
            decisionLog = 'ignorada: cooldown';
            transaction.set(msgRef, { processedAt: FieldValue.serverTimestamp(), phone, msgId: cleanMsgId, reason: 'cooldown' });
            return;
          }
          replyText = cachedStoreConfig.closedMsg.replace('{nome}', pushName).replace('{menu_link}', cachedStoreConfig.menuLink);
          sentGreetingOrClosed = true;
          decisionLog = 'enviada: fechado';
        } else {
          replyText = processIncomingMessage(incomingText, pushName, phone);
          decisionLog = 'enviada: resposta_fechado';
        }
      }

      // Reserve message ID and update conversation state atomically
      transaction.set(msgRef, { processedAt: FieldValue.serverTimestamp(), phone, msgId: cleanMsgId, decision: decisionLog });

      const updatePayload: any = {
        phone,
        updatedAt: FieldValue.serverTimestamp(),
        aguardandoResposta: true,
        ultimaMensagem: incomingText,
        pushName
      };

      if (storeOpen && sentGreetingOrClosed) {
        updatePayload.ultimaSaudacaoEm = FieldValue.serverTimestamp();
        updatePayload.botPausado = true;
      } else if (!storeOpen && sentGreetingOrClosed) {
        updatePayload.ultimoAvisoFechadoEm = FieldValue.serverTimestamp();
        updatePayload.botPausado = true;
      }

      transaction.set(convRef, updatePayload, { merge: true });
      shouldRespond = true;
    });
  } catch (txErr: any) {
    decisionLog = `erro_transacao: ${txErr?.message || txErr}`;
    console.error(`[WhatsApp Bot] ${decisionLog} para +${phone}`);
  }

  console.log(`[WhatsApp Bot] Telefone: +${phone} | MsgID: ${cleanMsgId} | Decisão: ${decisionLog}`);

  if (shouldRespond && replyText && !decisionLog.startsWith('erro_transacao')) {
    try {
      await sendWhatsAppMessage(phone, replyText, cachedStoreConfig);
      addBotLog({
        from: phone,
        pushName,
        incomingText,
        replyText,
        status: 'sent'
      });
    } catch (sendErr: any) {
      console.error(`[WhatsApp Bot] Erro ao enviar mensagem para +${phone}:`, sendErr);
    }
  }

  return { handled: shouldRespond, replyText, decision: decisionLog };
}

// MAIN WEBHOOK RECEIVER: Evolution API calls this on incoming WhatsApp messages
app.all(['/api/webhook/whatsapp', '/api/webhook/whatsapp/:event'], async (req: Request, res: Response) => {
  if (process.env.BOT_ATIVO !== 'true') {
    if (!res.headersSent) {
      return res.status(200).json({ ok: true, ignored: 'bot-ativo-not-true' });
    }
    return;
  }

  if (req.method === 'GET' || req.query?.wakeup === '1') {
    let instanceState = 'open';
    try {
      const fullEvo = (cachedStoreConfig.evolutionUrl || '').trim().replace(/\/+$/, '');
      if (fullEvo && cachedStoreConfig.evolutionInstance) {
        const stRes = await fetch(`${fullEvo}/instance/connectionState/${cachedStoreConfig.evolutionInstance}`, {
          headers: { apikey: cachedStoreConfig.evolutionToken },
          signal: AbortSignal.timeout(4000)
        });
        if (stRes.ok) {
          const stJson: any = await stRes.json();
          instanceState = stJson?.instance?.state || stJson?.state || 'open';
        }
      }
    } catch {}
    return res.status(200).json({ ok: true, instanceState });
  }

  if (!webhookSecretOk(req)) {
    return res.status(401).json({ error: 'Webhook não autorizado' });
  }

  const isAdminTest = String(req.body?.data?.key?.id || '').startsWith('ADMIN_TEST_');

  try {
    const payload = req.body || {};
    const event = String(payload?.event || payload?.type || '').toLowerCase();
    const isSystemEvent = event.includes('connection') || event.includes('qrcode') || event.includes('presence');
    if (isSystemEvent && !isAdminTest) {
      if (!res.headersSent) {
        return res.status(200).json({ received: true, ignored: 'system-event' });
      }
      return;
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData)
      ? rawData[0]
      : (Array.isArray(rawData?.messages) ? rawData.messages[0] : rawData);

    if (!data) {
      if (!res.headersSent) return res.status(200).json({ received: true, ignored: 'no-data' });
      return;
    }

    const fromMe = data?.key?.fromMe === true;
    if (fromMe && !isAdminTest) {
      console.log(`[WhatsApp Bot] MsgID: ${data?.key?.id || 'N/A'} | Decisão: ignorada: fromMe`);
      if (!res.headersSent) return res.status(200).json({ received: true, ignored: 'from-me' });
      return;
    }

    const remoteJid = String(data?.key?.remoteJid || data?.remoteJid || '');
    if (
      !remoteJid ||
      remoteJid.endsWith('@g.us') ||
      remoteJid.endsWith('@newsletter') ||
      remoteJid === 'status@broadcast'
    ) {
      console.log(`[WhatsApp Bot] RemoteJid: ${remoteJid} | Decisão: ignorada: grupo`);
      if (!res.headersSent) return res.status(200).json({ received: true, ignored: 'group-or-broadcast' });
      return;
    }

    const msgId = data?.key?.id;
    const cleanSender = String(
      data?.key?.remoteJidAlt || data?.key?.senderPn || data?.remoteJidAlt || data?.senderPn || remoteJid
    ).split(':')[0].split('@')[0].replace(/\D/g, '');

    const pushName = data?.pushName || 'Cliente';
    const content = unwrapWhatsAppMessage(data?.message || payload?.message || { conversation: 'oi' });
    const incomingText =
      content?.conversation ||
      content?.extendedTextMessage?.text ||
      content?.imageMessage?.caption ||
      content?.videoMessage?.caption ||
      '';

    if (!incomingText || !incomingText.trim()) {
      console.log(`[WhatsApp Bot] Telefone: +${cleanSender} | MsgID: ${msgId || 'N/A'} | Decisão: ignorada: sem_texto`);
      if (!res.headersSent) return res.status(200).json({ received: true, ignored: 'no-text' });
      return;
    }

    if (cachedStoreConfig.botEnabled === false) {
      console.log(`[WhatsApp Bot] Telefone: +${cleanSender} | MsgID: ${msgId || 'N/A'} | Decisão: ignorada: bot_desativado`);
      if (!res.headersSent) return res.status(200).json({ received: true, ignored: 'bot-disabled' });
      return;
    }

    const result = await processConversationBotMessage({
      phone: cleanSender,
      pushName,
      incomingText,
      msgId,
      fromMe
    });

    if (!res.headersSent) {
      return res.status(200).json({
        received: true,
        ...result
      });
    }
  } catch (err: any) {
    console.error('[WhatsApp Bot] Erro no processamento do webhook:', err);
    if (!res.headersSent) {
      return res.status(200).json({
        received: true,
        replied: false,
        status: 500,
        error: err?.message || 'Erro interno no webhook'
      });
    }
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
    // Serve static files in production if dist exists, otherwise expose API health status
    const distDir = path.resolve(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    if (fs.existsSync(distIndex)) {
      app.use(express.static(distDir));
      app.use((_req, res) => {
        res.sendFile(distIndex);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({ ok: true, service: 'Supreme WhatsApp Bot Server', status: nativeStatus });
      });
    }
  }

  await syncStoreConfigFromDb();
  await autoSetupEvolutionWebhook();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Supreme rodando na porta ${PORT}`);
    console.log(`🤖 Webhook WhatsApp pronto em: http://0.0.0.0:${PORT}/api/webhook/whatsapp`);
    if (fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json'))) {
      console.log('🔄 [WhatsApp Native] Sessão salva encontrada em .wa_auth! Reconectando automaticamente...');
      startNativeWhatsApp().catch((e) => console.warn('[WhatsApp Native] Falha ao reconectar:', e?.message));
    } else {
      console.log(`ℹ️ [WhatsApp Native] Nenhuma sessão salva. Provedor: "${cachedStoreConfig.connectionProvider || 'evolution'}".`);
    }
  });
}

startServer();
