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
  welcomeMsg: `Olá! Seja muito bem-vindo ao assistente automático da *Sorveteria Gourmet Supreme*! 🍨\n\nSou o *Supreme Bot Premium 💜*.\n\nEscolha uma das opções abaixo enviando o número ou digitando sua dúvida:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`,
  menuLink: 'https://sorveteriasupreme.vercel.app',
  menuMsg: `⭐️ *CARDÁPIO DIGITAL SUPREME* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso cardápio online para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\nEnvie *1* para fazer pedido ou *4* para falar com atendente!`,
  supportMsg: `🙋‍♂️ *CONECTANDO À NOSSA EQUIPE*\n\nEntendi! Estou transferindo seu atendimento para a nossa equipe na loja física. Nosso tempo médio de resposta é de menos de 4 minutos!\n\nSe preferir ligar diretamente, use o número comercial:\n👉 *{telefone}*`,
  address: 'Rua Chequer Assis, 195 - ao lado do extra supermercado - Monte Mor/SP',
  openHours: '13:00 às 20:00'
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
    const closeTime = readFsString(fields, 'closeTime') || '20:00';

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
  } catch {
    return cachedConfig || DEFAULT_CONFIG;
  }
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
  const lower = text.toLowerCase();
  return (
    lower.includes('supreme bot premium') ||
    lower.includes('rastreador de pedidos supreme') ||
    lower.includes('localização & horários supreme') ||
    lower.includes('conectando à nossa equipe') ||
    lower.includes('cardápio digital') ||
    lower.includes('escolha uma das opções abaixo enviando o número')
  );
}

function buildBotReply(userText: string, pushName: string, senderKey: string, cfg: StoreBotConfig): string {
  const clean = userText.trim().toLowerCase();
  const isExactOption = clean === '1' || clean === '2' || clean === '3' || clean === '4';
  const lastGreeted = greetedContacts.get(senderKey);
  const isFirstContact = !lastGreeted || Date.now() - lastGreeted > GREET_TTL_MS;
  greetedContacts.set(senderKey, Date.now());

  if ((isFirstContact && !isExactOption) || /^(oi|olá|ola|oii+|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|ajuda|menu inicial)\b/i.test(clean)) {
    return cfg.welcomeMsg.replace('{nome}', pushName);
  }

  if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio') || clean === 'menu') {
    return cfg.menuMsg.replace('{menu_link}', cfg.menuLink).replace('[LINK_CARDAPIO]', cfg.menuLink);
  }

  if (clean === '2' || clean.includes('rastrear') || clean.includes('rastreio') || clean.includes('status') || clean.includes('onde esta') || clean.includes('onde está') || clean.includes('meu pedido') || clean.includes('acompanhar')) {
    return `🔍 *RASTREADOR DE PEDIDOS SUPREME*\n\nOlá, *${pushName}*! Para acompanhar o status do seu pedido em tempo real, acesse:\n👉 ${cfg.menuLink}?track=true\n\nCaso já tenha o código do pedido (ex: #SUP123), digite aqui que verificamos para você!`;
  }

  if (clean === '3' || clean.includes('localizacao') || clean.includes('localização') || clean.includes('onde fica') || clean.includes('endereco') || clean.includes('endereço') || clean.includes('horario') || clean.includes('horário')) {
    return `📍 *LOCALIZAÇÃO & HORÁRIOS SUPREME*\n\n🏠 *Endereço:* ${cfg.address}\n⏰ *Horário de Funcionamento:* ${cfg.openHours}\n💬 *Telefone Comercial:* ${cfg.phone}\n\nVenha nos visitar ou peça online pelo cardápio:\n👉 ${cfg.menuLink}`;
  }

  if (clean === '4' || clean.includes('atendente') || clean.includes('humano') || clean.includes('falar com') || clean.includes('ajuda') || clean.includes('suporte')) {
    return cfg.supportMsg.replace('{telefone}', cfg.phone).replace('[TELEFONE]', cfg.phone);
  }

  return cfg.welcomeMsg.replace('{nome}', pushName);
}

function normalizeBrVariants(digits: string): string[] {
  const list: string[] = [];
  if (!digits) return list;
  list.push(digits);
  // Toggle Brazilian 9th digit if number starts with 55 + 2-digit DDD
  if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
    list.push(`55${digits.slice(2, 4)}${digits.slice(5)}`);
  } else if (digits.startsWith('55') && digits.length === 12) {
    list.push(`55${digits.slice(2, 4)}9${digits.slice(4)}`);
  }
  return list;
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
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')) {
      const digits = jid.split(':')[0].split('@')[0].replace(/\D/g, '');
      if (digits.length >= 10) {
        if (!displaySender) displaySender = digits;
        for (const variant of normalizeBrVariants(digits)) {
          if (!targets.includes(variant)) targets.push(variant);
        }
      }
    }
  }

  const rawRemote = String(key?.remoteJid || '').trim();
  if (rawRemote) {
    if (!displaySender) {
      displaySender = rawRemote.split(':')[0].split('@')[0].replace(/\D/g, '') || rawRemote;
    }
    if (!targets.includes(rawRemote)) {
      targets.push(rawRemote);
    }
  }

  return { targets, displaySender };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'Supreme WhatsApp Webhook (Vercel)',
      clientUrl: 'https://sorveteriasupreme.vercel.app',
      recentLogs: recentWebhookLogs.slice(0, 15)
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = String(payload?.event || payload?.type || '').toLowerCase();

    // Only react to incoming messages.upsert events (ignore send.message / connection.update)
    if (!event.includes('messages.upsert') && !event.includes('messages_upsert')) {
      return res.status(200).json({ received: true, ignored: 'non-upsert-event', event });
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData)
      ? rawData[0]
      : (Array.isArray(rawData?.messages) ? rawData.messages[0] : rawData);
    const key = data?.key;
    if (!data || !key) {
      return res.status(200).json({ received: true, ignored: 'empty-key' });
    }

    const remoteJid = String(key.remoteJid || '');
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast') {
      return res.status(200).json({ received: true, ignored: 'group-or-broadcast' });
    }

    const cfg = await loadStoreConfigFromFirestore();

    const payloadSenderDigits = String(payload?.sender || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const configPhoneDigits = cfg.phone.replace(/\D/g, '');
    const remoteAltDigits = String(key.remoteJidAlt || key.senderPn || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const remoteBaseDigits = remoteJid.split(':')[0].split('@')[0].replace(/\D/g, '');

    const isSelfChat = Boolean(
      key.fromMe && (
        (payloadSenderDigits && (remoteBaseDigits === payloadSenderDigits || remoteAltDigits === payloadSenderDigits)) ||
        (configPhoneDigits && (remoteBaseDigits.endsWith(configPhoneDigits.slice(-8)) || remoteAltDigits.endsWith(configPhoneDigits.slice(-8))))
      )
    );

    if (key.fromMe && !isSelfChat) {
      return res.status(200).json({ received: true, ignored: 'fromMe-outbound' });
    }

    const msgId = key.id;
    if (msgId) {
      if (processedMsgIds.has(msgId)) {
        return res.status(200).json({ received: true, ignored: 'duplicate' });
      }
      processedMsgIds.add(msgId);
      if (processedMsgIds.size > 500) {
        const first = processedMsgIds.values().next().value;
        if (first) processedMsgIds.delete(first);
      }
    }

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
    if (!effectiveText) {
      return res.status(200).json({ received: true, ignored: 'no-text' });
    }

    // Prevent echo loop in self-chat tests
    if (key.fromMe && isBotGeneratedEcho(effectiveText)) {
      return res.status(200).json({ received: true, ignored: 'self-echo-prevented' });
    }

    if (!cfg.botEnabled) {
      pushWebhookLog({
        from: remoteBaseDigits || remoteJid,
        incomingText: effectiveText,
        replyText: '',
        status: 'ignored',
        details: 'Bot pausado nas configurações'
      });
      return res.status(200).json({ received: true, ignored: 'bot-disabled' });
    }

    const pushName = String(data?.pushName || 'Cliente');
    const { targets, displaySender } = buildSendCandidates(key, data);
    const replyText = buildBotReply(effectiveText, pushName, displaySender || remoteJid, cfg);

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
        try {
          const sendRes = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey
            },
            body: JSON.stringify({
              number: target,
              text: replyText
            }),
            signal: AbortSignal.timeout(5500)
          });

          finalStatus = sendRes.status;
          finalResult = await sendRes.text();
          usedTarget = target;

          if (sendRes.ok) {
            finalOk = true;
            break;
          }
          // Retry with next apiKey only on 401/403
          if (sendRes.status !== 401 && sendRes.status !== 403) {
            break;
          }
        } catch (fetchErr: any) {
          finalStatus = 504;
          finalResult = fetchErr?.message || 'Timeout/erro ao contatar Evolution API';
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
      details: finalOk ? `Respondido para ${usedTarget}` : `HTTP ${finalStatus}: ${finalResult.slice(0, 160)}`
    });

    return res.status(200).json({
      received: true,
      replied: finalOk,
      to: usedTarget,
      status: finalStatus,
      result: finalResult.slice(0, 300)
    });
  } catch (err: any) {
    pushWebhookLog({
      from: 'Webhook',
      incomingText: 'Erro ao processar evento',
      replyText: '',
      status: 'error',
      details: err?.message || 'Webhook processing error'
    });
    return res.status(200).json({
      received: true,
      error: err?.message || 'Webhook processing error'
    });
  }
}
