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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (Number(process.env.PORT) || 8080) : 3000;

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
  menuLink: 'https://sorveteriasupreme.vercel.app',
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
        menuLink: (data.whatsappBotMenuLink && !String(data.whatsappBotMenuLink).includes('.run.app'))
          ? String(data.whatsappBotMenuLink).trim().replace(/\/+$/, '')
          : cachedStoreConfig.menuLink,
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

// Track contacts greeted recently (key: sender digits/jid -> timestamp ms) so first message ALWAYS triggers Welcome Message
const greetedContacts = new Map<string, number>();
const GREET_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Determine response text based on incoming message
function processIncomingMessage(userText: string, pushName: string = 'Cliente', senderKey?: string) {
  const clean = userText.trim().toLowerCase();
  const cfg = cachedStoreConfig;

  const isExactOption = clean === '1' || clean === '2' || clean === '3' || clean === '4';
  const lastGreeted = senderKey ? greetedContacts.get(senderKey) : undefined;
  const isFirstContact = senderKey ? (!lastGreeted || Date.now() - lastGreeted > GREET_TTL_MS) : false;

  if (senderKey) {
    greetedContacts.set(senderKey, Date.now());
  }

  // First contact (any text except exact menu digit 1/2/3/4) OR explicit greeting => ALWAYS send Welcome Message!
  if ((isFirstContact && !isExactOption) || /^(oi|olá|ola|oii+|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|ajuda|menu inicial)\b/i.test(clean)) {
    return cfg.welcomeMsg.replace('{nome}', pushName);
  }

  // 1. Menu
  if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean === 'menu') {
    const raw = cfg.menuMsg.replace('{menu_link}', cfg.menuLink).replace('[LINK_CARDAPIO]', cfg.menuLink);
    return raw;
  }

  // 2. Track Order (only explicit tracking words, not "fazer pedido")
  if (clean === '2' || clean.includes('rastrear') || clean.includes('rastreio') || clean.includes('status') || clean.includes('onde esta') || clean.includes('onde está') || clean.includes('meu pedido') || clean.includes('acompanhar')) {
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
      console.log(`[WhatsApp Native] Evento messages.upsert recebido (type=${type}, qtd=${messages.length})`);
      for (const msg of messages) {
        try {
          const msgId = msg.key.id;
          if (msgId && (sentBotMessageIds.has(msgId) || repliedInboundMsgIds.has(msgId))) continue;
          if (!msg.message) {
            console.log(`[WhatsApp Native] Mensagem sem payload (stub=${msg.messageStubType || 'none'}, jid=${msg.key.remoteJid})`);
            continue;
          }

          const remoteJid = msg.key.remoteJid || '';
          if (
            !remoteJid ||
            remoteJid.endsWith('@g.us') ||
            remoteJid.endsWith('@newsletter') ||
            remoteJid === 'status@broadcast'
          ) {
            continue;
          }

          const remoteJidAlt = (msg.key as any)?.remoteJidAlt as string | undefined;
          const senderPn = (msg.key as any)?.senderPn as string | undefined;
          const cleanSender = (remoteJidAlt || senderPn || remoteJid).split(':')[0].split('@')[0];
          const ownNum = (sock.user?.id || state.creds?.me?.id || '').split(':')[0].split('@')[0];
          const ownLid = (sock.user?.lid || (state.creds?.me as any)?.lid || '').split(':')[0].split('@')[0];
          const remoteBase = remoteJid.split(':')[0].split('@')[0];
          const isSelfChat = Boolean(
            (remoteBase && (remoteBase === ownNum || remoteBase === ownLid)) ||
            (cleanSender && cleanSender === ownNum)
          );

          // Skip initial history-sync append bursts in first 8s after connect, but NEVER drop live 'notify' messages due to clock skew
          if (type === 'append' && !isSelfChat && nativeConnectedAtMs > 0 && Date.now() - nativeConnectedAtMs < 8000) {
            continue;
          }

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

          const hasCustomerMedia = Boolean(
            content?.imageMessage ||
            content?.videoMessage ||
            content?.audioMessage ||
            content?.stickerMessage ||
            content?.documentMessage ||
            content?.locationMessage ||
            content?.contactMessage
          );

          const effectiveText = incomingText.trim() || (hasCustomerMedia && !msg.key.fromMe ? 'Oi' : '');
          if (!effectiveText) continue;

          if (cachedStoreConfig.botEnabled === false) {
            console.log(`[WhatsApp Native] Robô pausado nas configurações; ignorando mensagem de +${cleanSender}.`);
            continue;
          }

          if (msgId) {
            repliedInboundMsgIds.add(msgId);
            if (repliedInboundMsgIds.size > 500) {
              const first = repliedInboundMsgIds.values().next().value;
              if (first) repliedInboundMsgIds.delete(first);
            }
          }

          const pushName = msg.pushName || 'Cliente';
          console.log(`[WhatsApp Native] (${type}) Mensagem recebida de ${remoteJid} (+${cleanSender}, ${pushName}): "${effectiveText}"`);

          const replyText = processIncomingMessage(effectiveText, pushName, cleanSender || remoteJid);

          // For @lid accounts, prefer PN JID (remoteJidAlt / senderPn) when available, then fallback to remoteJid
          const replyTargets = remoteJid.endsWith('@lid')
            ? [remoteJidAlt, senderPn, remoteJid]
            : [remoteJid, remoteJidAlt, senderPn];
          const uniqueTargets = Array.from(new Set(replyTargets.filter((t): t is string => Boolean(t))));

          let sent: any = null;
          let lastSendErr: any = null;
          let sentToJid = uniqueTargets[0];
          for (const targetJid of uniqueTargets) {
            try {
              sent = await sock.sendMessage(targetJid, { text: replyText });
              sentToJid = targetJid;
              break;
            } catch (targetErr) {
              lastSendErr = targetErr;
            }
          }
          if (!sent) {
            throw lastSendErr || new Error('Falha ao entregar resposta ao destinatário.');
          }
          trackSentMessageId(sent?.key?.id, sent?.message);

          console.log(`[WhatsApp Native] Resposta automática enviada para ${sentToJid}`);
          addBotLog({
            from: cleanSender,
            pushName,
            incomingText: effectiveText,
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
    trackSentMessageId(result?.key?.id, result?.message);
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
      const err: any = new Error(`Evolution API erro ${res.status}: ${responseText}`);
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

// MAIN WEBHOOK RECEIVER: Evolution API calls this on incoming WhatsApp messages (supports webhookByEvents subpath too)
app.post(['/api/webhook/whatsapp', '/api/webhook/whatsapp/:event'], async (req: Request, res: Response) => {
  if (!webhookSecretOk(req)) {
    return res.status(401).json({ error: 'Webhook não autorizado' });
  }
  const isAdminTest = String(req.body?.data?.key?.id || '').startsWith('ADMIN_TEST_');
  const finishEarly = (ignored: string) => {
    if (isAdminTest && !res.headersSent) {
      res.status(200).json({ received: true, replied: false, ignored });
    }
  };
  // Always acknowledge live Evolution webhooks immediately with 200 OK so Evolution API doesn't retry
  if (!isAdminTest) {
    res.status(200).json({ received: true });
  }

  try {
    const payload = req.body;
    const event = String(payload?.event || payload?.type || '').toLowerCase();

    // Check if it's messages.upsert
    if (!event.includes('messages.upsert') && !event.includes('messages_upsert')) {
      return finishEarly('non-upsert-event');
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData)
      ? rawData[0]
      : (Array.isArray(rawData?.messages) ? rawData.messages[0] : rawData);
    if (!data) return finishEarly('empty-data');

    const key = data?.key;
    const remoteJid = String(key?.remoteJid || '');
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast') {
      return finishEarly('group-or-broadcast');
    }

    const senderDigits = String(payload?.sender || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const remoteAlt = String(key?.remoteJidAlt || key?.senderPn || key?.participantAlt || data?.remoteJidAlt || data?.senderPn || '');
    const cleanAltDigits = remoteAlt.split(':')[0].split('@')[0].replace(/\D/g, '');
    const cleanRemoteDigits = remoteJid.split(':')[0].split('@')[0].replace(/\D/g, '');
    const isSelfChat = Boolean(
      key?.fromMe &&
      senderDigits &&
      (cleanRemoteDigits === senderDigits || cleanAltDigits === senderDigits)
    );

    if (key?.fromMe && !isSelfChat) {
      return finishEarly('fromMe-outbound');
    }

    const cleanSender = cleanAltDigits.length >= 10 ? cleanAltDigits : (cleanRemoteDigits.length >= 10 && !remoteJid.endsWith('@lid') ? cleanRemoteDigits : remoteJid);
    const pushName = data?.pushName || 'Cliente';

    // Extract text from message payload across Baileys variations
    const content = unwrapWhatsAppMessage(data?.message);
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

    if (!incomingText.trim()) {
      return finishEarly('no-text');
    }

    if (key?.fromMe && /supreme bot premium|rastreador de pedidos supreme|localização & horários supreme|conectando à nossa equipe/i.test(incomingText)) {
      return finishEarly('self-echo-prevented');
    }

    console.log(`[WhatsApp Bot] Mensagem recebida de +${cleanSender} (${pushName}): "${incomingText}"`);

    // Ensure config is fresh
    if (!cachedStoreConfig.evolutionUrl || !cachedStoreConfig.evolutionToken) {
      await syncStoreConfigFromDb();
    }

    // Generate the bot response (welcome message + options)
    const replyText = processIncomingMessage(incomingText, pushName, cleanSender);

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
      if (isAdminTest) {
        return res.status(200).json({ received: true, replied: true, to: cleanSender, status: 200, result: 'OK' });
      }
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
      if (isAdminTest) {
        return res.status(200).json({
          received: true,
          replied: false,
          to: cleanSender,
          status: sendErr?.status || 504,
          result: sendErr.message || String(sendErr)
        });
      }
    }
  } catch (err: any) {
    console.error('[WhatsApp Bot] Erro no processamento do webhook:', err);
    if (isAdminTest && !res.headersSent) {
      return res.status(200).json({ received: true, replied: false, status: 500, error: err?.message || 'Erro interno' });
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
