import { webhookSecretOk } from '../_lib/adminAuth';

const PROJECT_ID = 'gen-lang-client-0657249394';
const DATABASE_ID = 'ai-studio-remixsorveterias-394250e3-c97c-4dba-be9b-43921c0168c3';
const FIRESTORE_CONFIG_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_config`;

const greetedContacts = new Map<string, number>();
const processedMsgIds = new Set<string>();
const GREET_TTL_MS = 6 * 60 * 60 * 1000;

interface WebhookLogItem {
  id: string;
  timestamp: string;
  from: string;
  incomingText: string;
  replyText: string;
  status: 'sent' | 'error' | 'ignored';
  details?: string;
}

const recentWebhookLogs: WebhookLogItem[] = [];
function pushWebhookLog(entry: Omit<WebhookLogItem, 'id' | 'timestamp'>) {
  try {
    recentWebhookLogs.unshift({
      ...entry,
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    });
    if (recentWebhookLogs.length > 20) recentWebhookLogs.length = 20;
    console.log(`[Webhook Log] [${entry.status.toUpperCase()}] From: ${entry.from} | In: "${entry.incomingText}" | Details: ${entry.details || ''}`);
  } catch (e) {
    console.error('Error pushing webhook log:', e);
  }
}

interface StoreBotConfig {
  botEnabled: boolean;
  botName: string;
  storeName: string;
  phone: string;
  evolutionUrl: string;
  evolutionInstance: string;
  evolutionToken: string;
  welcomeMsg: string;
  menuMsg: string;
  menuLink: string;
  supportMsg: string;
  address: string;
  openHours: string;
}

const DEFAULT_CONFIG: StoreBotConfig = {
  botEnabled: true,
  botName: 'Supreme Bot Premium 💜',
  storeName: 'Sorveteria Gourmet Supreme',
  phone: '5519974118672',
  evolutionUrl: 'https://supreme-bot-2bm0.onrender.com',
  evolutionInstance: 'supreme-bot',
  evolutionToken: 'Rmfa1100@',
  welcomeMsg: `Olá, *{nome}*! Seja muito bem-vindo ao assistente automático da *Sorveteria Gourmet Supreme*! 🍨\n\n⭐️ *Cardápio & Pedidos Online*:\n👉 {menu_link}\n\n⏰ *Horário de Funcionamento*:\n{open_hours}\n\nEscolha uma das opções abaixo enviando o número:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`,
  menuLink: 'https://sorveteriasupreme.vercel.app',
  menuMsg: `⭐️ *CARDÁPIO DIGITAL SUPREME* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso cardápio online para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\nEnvie *1* para fazer pedido ou *4* para falar com atendente!`,
  supportMsg: `🙋‍♂️ *CONECTANDO À NOSSA EQUIPE*\n\nEntendi! Estou transferindo seu atendimento para a nossa equipe na loja física. Nosso tempo médio de resposta é de menos de 4 minutos!\n\nSe preferir ligar diretamente, use o número comercial:\n👉 *{telefone}*`,
  address: 'Rua Chequer Assis, 195 - ao lado do extra supermercado - Monte Mor/SP',
  openHours: '13:00 às 23:00'
};

let cachedConfig: StoreBotConfig | null = null;
let cachedConfigAt = 0;

function readFsString(fields: any, key: string): string | undefined {
  const val = fields?.[key]?.stringValue;
  return typeof val === 'string' && val.trim() ? val : undefined;
}

function readFsBool(fields: any, key: string): boolean | undefined {
  const val = fields?.[key]?.booleanValue;
  return typeof val === 'boolean' ? val : undefined;
}

async function loadStoreConfigFromFirestore(): Promise<StoreBotConfig> {
  if (cachedConfig && Date.now() - cachedConfigAt < 30000) {
    return cachedConfig;
  }
  try {
    const res = await fetch(FIRESTORE_CONFIG_URL, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return cachedConfig || DEFAULT_CONFIG;
    const json: any = await res.json();
    const fields = json?.fields;
    if (!fields) return cachedConfig || DEFAULT_CONFIG;

    const rawMenuLink = readFsString(fields, 'whatsappBotMenuLink');
    const cleanMenuLink = rawMenuLink && !rawMenuLink.includes('.run.app')
      ? rawMenuLink.trim().replace(/\/+$/, '')
      : DEFAULT_CONFIG.menuLink;

    const openTime = readFsString(fields, 'openTime') || '13:00';
    const closeTime = readFsString(fields, 'closeTime') || '23:00';

    cachedConfig = {
      botEnabled: readFsBool(fields, 'whatsappBotEnabled') !== false,
      botName: readFsString(fields, 'whatsappBotName') || DEFAULT_CONFIG.botName,
      storeName: readFsString(fields, 'name') || DEFAULT_CONFIG.storeName,
      phone: readFsString(fields, 'phone') || DEFAULT_CONFIG.phone,
      evolutionUrl: (readFsString(fields, 'whatsappEvolutionUrl') || DEFAULT_CONFIG.evolutionUrl).trim().replace(/\/+$/, ''),
      evolutionInstance: (readFsString(fields, 'whatsappEvolutionInstance') || DEFAULT_CONFIG.evolutionInstance).trim(),
      evolutionToken: (readFsString(fields, 'whatsappEvolutionToken') || DEFAULT_CONFIG.evolutionToken).trim(),
      welcomeMsg: readFsString(fields, 'whatsappBotWelcomeMessage') || DEFAULT_CONFIG.welcomeMsg,
      menuMsg: readFsString(fields, 'whatsappBotMenuMessage') || DEFAULT_CONFIG.menuMsg,
      menuLink: cleanMenuLink,
      supportMsg: readFsString(fields, 'whatsappBotSupportMessage') || DEFAULT_CONFIG.supportMsg,
      address: readFsString(fields, 'address') || DEFAULT_CONFIG.address,
      openHours: `${openTime} às ${closeTime}`
    };
    cachedConfigAt = Date.now();
    return cachedConfig;
  } catch (err) {
    console.warn('Warning loading store config from Firestore:', err);
    return cachedConfig || DEFAULT_CONFIG;
  }
}

async function checkActiveOrderForCustomer(senderPhone: string, cfg: StoreBotConfig): Promise<string | null> {
  try {
    const cleanSender = String(senderPhone || '').replace(/\D/g, '');
    if (!cleanSender || cleanSender.length < 8) return null;

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/orders`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const json: any = await res.json();
    const docs = json?.documents || [];

    const activeOrder = docs.find((doc: any) => {
      const fields = doc.fields || {};
      const status = fields.status?.stringValue || 'waiting';
      if (status === 'completed' || status === 'cancelled') return false;

      const orderPhone = (
        fields.details?.mapValue?.fields?.whatsapp?.stringValue ||
        fields.whatsapp?.stringValue ||
        fields.details?.mapValue?.fields?.phone?.stringValue ||
        fields.phone?.stringValue ||
        ''
      ).replace(/\D/g, '');

      if (!orderPhone) return false;
      return orderPhone.slice(-8) === cleanSender.slice(-8);
    });

    if (activeOrder) {
      const fields = activeOrder.fields || {};
      const orderId = activeOrder.name.split('/').pop().slice(-6).toUpperCase();
      const status = fields.status?.stringValue || 'waiting';
      const statusMap: Record<string, string> = {
        'waiting': '⌛ Aguardando Confirmação / Fila',
        'preparing': '🥣 Em Preparação na Cozinha',
        'delivering': '🛵 A Caminho para Entrega / Pronto para Retirada'
      };
      const statusText = statusMap[status] || status;
      const total = fields.total?.doubleValue || fields.total?.integerValue || 0;

      return `📦 *STATUS DO SEU PEDIDO ATIVO*\n\nPedido: *#SUP${orderId}*\nStatus: *${statusText}*\nTotal: R$ ${Number(total).toFixed(2)}\n\n🔗 Acompanhe ao vivo: ${cfg.menuLink}?track=true\n\nPrecisa de ajuda? Envie *4* para falar com um atendente.`;
    }
  } catch (err) {
    console.warn('Error checking active order:', err);
  }
  return null;
}

function unwrapMessage(msgContent: any): any {
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
    } else {
      break;
    }
  }
  return current;
}

function isBotGeneratedEcho(text: string): boolean {
  const lower = String(text || '').toLowerCase();
  return (
    lower.includes('supreme bot premium') ||
    lower.includes('rastreador de pedidos supreme') ||
    lower.includes('localização & horários supreme') ||
    lower.includes('conectando à nossa equipe') ||
    lower.includes('cardápio digital') ||
    lower.includes('status do seu pedido ativo') ||
    lower.includes('escolha uma das opções abaixo enviando o número')
  );
}

async function buildBotReply(userText: string, pushName: string, senderPhone: string, cfg: StoreBotConfig): Promise<string> {
  const clean = String(userText || '').trim().toLowerCase();

  if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean === 'menu') {
    return cfg.menuMsg.replace('{menu_link}', cfg.menuLink).replace('[LINK_CARDAPIO]', cfg.menuLink);
  }

  if (clean === '2' || clean.includes('rastrear') || clean.includes('rastreio') || clean.includes('status') || clean.includes('onde esta') || clean.includes('onde está') || clean.includes('meu pedido') || clean.includes('acompanhar')) {
    const activeOrderReply = await checkActiveOrderForCustomer(senderPhone, cfg);
    if (activeOrderReply) return activeOrderReply;
    return `🔍 *RASTREADOR DE PEDIDOS SUPREME*\n\nOlá, *${pushName}*! Não encontramos pedidos ativos no momento para o seu número.\n\nAcesse nosso cardápio para pedir:\n👉 ${cfg.menuLink}`;
  }

  if (clean === '3' || clean.includes('localizacao') || clean.includes('localização') || clean.includes('onde fica') || clean.includes('endereco') || clean.includes('endereço') || clean.includes('horario') || clean.includes('horário')) {
    return `📍 *LOCALIZAÇÃO & HORÁRIOS SUPREME*\n\n🏠 *Endereço:* ${cfg.address}\n⏰ *Horário de Funcionamento:* ${cfg.openHours}\n💬 *Telefone Comercial:* ${cfg.phone}\n\nVenha nos visitar ou peça online pelo cardápio:\n👉 ${cfg.menuLink}`;
  }

  if (clean === '4' || clean.includes('atendente') || clean.includes('humano') || clean.includes('falar com') || clean.includes('ajuda') || clean.includes('suporte')) {
    return cfg.supportMsg.replace('{telefone}', cfg.phone).replace('[TELEFONE]', cfg.phone);
  }

  const activeOrderReply = await checkActiveOrderForCustomer(senderPhone, cfg);
  if (activeOrderReply && (clean.includes('pedido') || clean.includes('entrega') || clean.includes('demora'))) {
    return activeOrderReply;
  }

  return cfg.welcomeMsg
    .replace('{nome}', pushName)
    .replace('{menu_link}', cfg.menuLink)
    .replace('{open_hours}', cfg.openHours);
}

function normalizeToBrPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function normalizeBrVariants(digits: string): string[] {
  const norm = normalizeToBrPhone(digits);
  const list: string[] = [norm];
  if (norm.startsWith('55') && norm.length === 13 && norm[4] === '9') {
    list.push(`55${norm.slice(2, 4)}${norm.slice(5)}`);
  } else if (norm.startsWith('55') && norm.length === 12) {
    list.push(`55${norm.slice(2, 4)}9${norm.slice(4)}`);
  }
  return Array.from(new Set(list));
}

function buildSendCandidates(key: any, data: any): { targets: string[]; displaySender: string } {
  const pnFields = [
    key?.remoteJidAlt,
    key?.senderPn,
    key?.participantAlt,
    data?.remoteJidAlt,
    data?.senderPn,
    key?.remoteJid
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const targets: string[] = [];
  let displaySender = '';

  for (const jid of pnFields) {
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || !jid.includes('@')) {
      const digits = jid.split(':')[0].split('@')[0].replace(/\D/g, '');
      if (digits.length >= 10) {
        const norm = normalizeToBrPhone(digits);
        if (!displaySender) displaySender = norm;
        for (const variant of normalizeBrVariants(norm)) {
          if (!targets.includes(variant)) targets.push(variant);
        }
      }
    }
  }

  const rawRemote = String(key?.remoteJid || '').trim();
  if (rawRemote) {
    const rawDigits = rawRemote.split(':')[0].split('@')[0].replace(/\D/g, '');
    if (!displaySender) {
      displaySender = rawDigits.length >= 10 ? normalizeToBrPhone(rawDigits) : rawRemote;
    }
    const normDigits = rawDigits.length >= 10 ? normalizeToBrPhone(rawDigits) : rawRemote;
    if (!targets.includes(normDigits)) targets.push(normDigits);
  }

  return { targets, displaySender };
}

async function sendWithRetry(evolutionUrl: string, instanceName: string, apiKey: string, target: string, text: string, maxRetries = 3): Promise<{ ok: boolean; status: number; result: string }> {
  let lastStatus = 500;
  let lastResult = '';
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const rawNum = target ? String(target).split('@')[0].replace(/\D/g, '') : '';
      const cleanTarget = normalizeToBrPhone(rawNum);
      if (!cleanTarget || cleanTarget.length < 10) {
        throw new Error(`Número de telefone inválido para envio: ${target}`);
      }

      const sendRes = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: cleanTarget,
          text,
          delay: 0,
          linkPreview: false
        }),
        signal: AbortSignal.timeout(18000)
      });
      const status = sendRes.status;
      const result = await sendRes.text();
      if (sendRes.ok) {
        return { ok: true, status, result };
      }
      lastStatus = status;
      lastResult = result;
      if (status >= 400 && status < 500 && status !== 429) {
        break;
      }
    } catch (err: any) {
      lastStatus = 504;
      lastResult = err?.message || 'Timeout/Network error';
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { ok: false, status: lastStatus, result: lastResult };
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET or POST.' });
    }

    if (!webhookSecretOk(req)) {
      return res.status(401).json({ ok: false, error: 'Webhook não autorizado' });
    }

    if (req.method === 'GET') {
      const query = req.query || {};
      const wantWakeup = query.wakeup === '1' || query.wakeup === 'true' || query.heartbeat === '1' || query.heartbeat === 'true';
      let renderStatus: string | undefined;
      let instanceState: string | undefined;
      if (wantWakeup) {
        try {
          const cfg = await loadStoreConfigFromFirestore();
          const evoBase = (cfg.evolutionUrl || DEFAULT_CONFIG.evolutionUrl).trim().replace(/\/+$/, '');
          const fullEvo = evoBase.startsWith('http') ? evoBase : `https://${evoBase}`;
          const pingRes = await fetch(`${fullEvo}/`, { signal: AbortSignal.timeout(12000) });
          renderStatus = pingRes.ok ? 'awake' : `http_${pingRes.status}`;
          if (pingRes.ok) {
            try {
              const stateRes = await fetch(`${fullEvo}/instance/connectionState/${cfg.evolutionInstance}`, {
                headers: { apikey: cfg.evolutionToken },
                signal: AbortSignal.timeout(6000)
              });
              if (stateRes.ok) {
                const stateJson: any = await stateRes.json();
                instanceState = stateJson?.instance?.state || stateJson?.state || undefined;
              }
            } catch {
              // Non-fatal
            }
          }
        } catch (e: any) {
          renderStatus = `error:${e?.message || 'timeout'}`;
        }
      }
      return res.status(200).json({
        ok: true,
        service: 'Supreme WhatsApp Webhook (Vercel)',
        clientUrl: 'https://sorveteriasupreme.vercel.app',
        ...(renderStatus ? { renderStatus } : {}),
        ...(instanceState ? { instanceState } : {}),
        recentLogs: recentWebhookLogs.slice(0, 15)
      });
    }

    // POST request processing with robust Buffer / string body parsing
    let payload = req.body || {};
    if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString('utf8'));
      } catch {
        payload = {};
      }
    } else if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    const event = String(payload?.event || payload?.type || '').toLowerCase();
    const msgType = String(payload?.type || payload?.data?.type || '').toLowerCase();

    if (msgType.includes('append') || event.includes('append')) {
      return res.status(200).json({ ok: true, received: true, ignored: 'append-event' });
    }

    if (!event.includes('messages.upsert') && !event.includes('messages_upsert')) {
      if (event && event !== 'ping.test') {
        pushWebhookLog({
          from: String(payload?.instance || 'Evolution'),
          incomingText: `Evento: ${event}`,
          replyText: '',
          status: 'ignored',
          details: 'Evento ignorado (apenas messages.upsert dispara resposta)'
        });
      }
      return res.status(200).json({ ok: true, received: true, ignored: 'non-upsert-event', event });
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData)
      ? rawData[0]
      : (Array.isArray(rawData?.messages) ? rawData.messages[0] : rawData);
    const key = data?.key || payload?.key;
    if (!data || !key) {
      pushWebhookLog({
        from: 'Evolution',
        incomingText: 'messages.upsert sem key',
        replyText: '',
        status: 'ignored',
        details: 'Payload recebido sem key'
      });
      return res.status(200).json({ ok: true, received: true, ignored: 'empty-key' });
    }

    const remoteJid = String(key.remoteJid || '');
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast') {
      pushWebhookLog({
        from: remoteJid || 'Desconhecido',
        incomingText: 'Mensagem de grupo/status',
        replyText: '',
        status: 'ignored',
        details: 'Grupos e status são ignorados'
      });
      return res.status(200).json({ ok: true, received: true, ignored: 'group-or-broadcast' });
    }

    const cfg = await loadStoreConfigFromFirestore();

    const payloadSenderDigits = String(payload?.sender || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const configPhoneDigits = cfg.phone.replace(/\D/g, '');
    const remoteAltDigits = String(key.remoteJidAlt || key.senderPn || key.participantAlt || key.participant || data?.remoteJidAlt || data?.senderPn || '')
      .split(':')[0]
      .split('@')[0]
      .replace(/\D/g, '');
    const remoteBaseDigits = remoteJid.split(':')[0].split('@')[0].replace(/\D/g, '');

    const isSelfChat = Boolean(
      key.fromMe && (
        (payloadSenderDigits && (remoteBaseDigits === payloadSenderDigits || remoteAltDigits === payloadSenderDigits)) ||
        (configPhoneDigits && (remoteBaseDigits.endsWith(configPhoneDigits.slice(-8)) || remoteAltDigits.endsWith(configPhoneDigits.slice(-8))))
      )
    );

    const content = unwrapMessage(data?.message);
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

    const hasMedia = Boolean(
      content?.imageMessage ||
      content?.videoMessage ||
      content?.audioMessage ||
      content?.stickerMessage ||
      content?.documentMessage
    );

    const effectiveText = incomingText.trim() || (hasMedia && !key.fromMe ? 'Oi' : '');

    if (key.fromMe && !isSelfChat) {
      pushWebhookLog({
        from: remoteAltDigits || remoteBaseDigits || remoteJid,
        incomingText: effectiveText || '(sem texto)',
        replyText: '',
        status: 'ignored',
        details: `fromMe=true (enviada pelo próprio aparelho ${remoteJid}).`
      });
      return res.status(200).json({ ok: true, received: true, ignored: 'fromMe-outbound' });
    }

    const msgId = key.id;
    if (msgId) {
      if (processedMsgIds.has(msgId)) {
        return res.status(200).json({ ok: true, received: true, ignored: 'duplicate' });
      }
      processedMsgIds.add(msgId);
      if (processedMsgIds.size > 500) {
        const first = processedMsgIds.values().next().value;
        if (first) processedMsgIds.delete(first);
      }
    }

    if (!effectiveText) {
      pushWebhookLog({
        from: remoteAltDigits || remoteBaseDigits || remoteJid,
        incomingText: '(sem texto legível)',
        replyText: '',
        status: 'ignored',
        details: 'Mensagem sem texto'
      });
      return res.status(200).json({ ok: true, received: true, ignored: 'no-text' });
    }

    if (key.fromMe && isBotGeneratedEcho(effectiveText)) {
      return res.status(200).json({ ok: true, received: true, ignored: 'self-echo-prevented' });
    }

    if (!cfg.botEnabled) {
      pushWebhookLog({
        from: remoteBaseDigits || remoteJid,
        incomingText: effectiveText,
        replyText: '',
        status: 'ignored',
        details: 'Bot pausado'
      });
      return res.status(200).json({ ok: true, received: true, ignored: 'bot-disabled' });
    }

    const pushName = String(data?.pushName || 'Cliente');
    const { targets, displaySender } = buildSendCandidates(key, data);
    const replyText = await buildBotReply(effectiveText, pushName, displaySender || remoteJid, cfg);

    const baseEvoUrl = (cfg.evolutionUrl || String(payload?.server_url || '')).trim().replace(/\/+$/, '');
    const evolutionUrl = baseEvoUrl.startsWith('http') ? baseEvoUrl : `https://${baseEvoUrl}`;
    const instanceName = String(payload?.instance || cfg.evolutionInstance || 'supreme-bot').trim();
    const apiKeys = Array.from(new Set([
      cfg.evolutionToken,
      typeof payload?.apikey === 'string' ? payload.apikey.trim() : ''
    ].filter(Boolean)));

    let finalOk = false;
    let finalStatus = 0;
    let finalResult = '';
    let usedTarget = targets[0] || remoteJid;

    for (const target of targets) {
      for (const apiKey of apiKeys) {
        const retryRes = await sendWithRetry(evolutionUrl, instanceName, apiKey, target, replyText, 3);
        finalStatus = retryRes.status;
        finalResult = retryRes.result;
        usedTarget = target;
        if (retryRes.ok) {
          finalOk = true;
          break;
        }
        if (retryRes.status !== 401 && retryRes.status !== 403) {
          break;
        }
      }
      if (finalOk) break;
    }

    pushWebhookLog({
      from: displaySender || usedTarget,
      incomingText: effectiveText,
      replyText: finalOk ? replyText : '',
      status: finalOk ? 'sent' : 'error',
      details: finalOk ? `Respondido para ${usedTarget}` : `HTTP ${finalStatus}: ${finalResult.slice(0, 220)}`
    });

    return res.status(200).json({
      ok: true,
      received: true,
      replied: finalOk,
      to: usedTarget,
      status: finalStatus,
      result: finalResult.slice(0, 300)
    });
  } catch (err: any) {
    console.error('[Webhook Fatal Error]:', err);
    pushWebhookLog({
      from: 'Webhook',
      incomingText: 'Erro fatal ao processar evento',
      replyText: '',
      status: 'error',
      details: err?.message || String(err)
    });
    return res.status(200).json({
      ok: false,
      received: true,
      error: err?.message || 'Webhook processing error'
    });
  }
}
