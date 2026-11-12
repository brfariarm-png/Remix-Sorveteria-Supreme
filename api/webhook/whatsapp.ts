const PROJECT_ID = 'gen-lang-client-0657249394';
const DATABASE_ID = 'ai-studio-remixsorveterias-394250e3-c97c-4dba-be9b-43921c0168c3';
const FIRESTORE_CONFIG_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_config`;

const greetedContacts = new Map<string, number>();
const processedMsgIds = new Set<string>();
const GREET_TTL_MS = 6 * 60 * 60 * 1000;

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

function readFsString(fields: any, key: string): string | undefined {
  const val = fields?.[key]?.stringValue;
  return typeof val === 'string' && val.trim() ? val : undefined;
}

function readFsBool(fields: any, key: string): boolean | undefined {
  const val = fields?.[key]?.booleanValue;
  return typeof val === 'boolean' ? val : undefined;
}

async function loadStoreConfigFromFirestore(): Promise<StoreBotConfig> {
  try {
    const res = await fetch(FIRESTORE_CONFIG_URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return DEFAULT_CONFIG;
    const json: any = await res.json();
    const fields = json?.fields;
    if (!fields) return DEFAULT_CONFIG;

    const rawMenuLink = readFsString(fields, 'whatsappBotMenuLink');
    const cleanMenuLink = rawMenuLink && !rawMenuLink.includes('.run.app')
      ? rawMenuLink.trim().replace(/\/+$/, '')
      : DEFAULT_CONFIG.menuLink;

    const openTime = readFsString(fields, 'openTime') || '13:00';
    const closeTime = readFsString(fields, 'closeTime') || '20:00';

    return {
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
  } catch {
    return DEFAULT_CONFIG;
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
      clientUrl: 'https://sorveteriasupreme.vercel.app'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = String(payload?.event || payload?.type || '').toLowerCase();

    if (!event.includes('messages.upsert') && !event.includes('message')) {
      return res.status(200).json({ received: true, ignored: 'non-message-event' });
    }

    const rawData = payload?.data;
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    const key = data?.key;
    if (!data || !key || key.fromMe) {
      return res.status(200).json({ received: true, ignored: 'empty-or-fromMe' });
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

    const remoteJid = String(key.remoteJid || '');
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast') {
      return res.status(200).json({ received: true, ignored: 'group-or-broadcast' });
    }

    const targetJid = String(key.remoteJidAlt || key.senderPn || remoteJid);
    const cleanSender = targetJid.split(':')[0].split('@')[0].replace(/\D/g, '');
    const pushName = String(data?.pushName || 'Cliente');

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

    const effectiveText = incomingText.trim() || (hasMedia ? 'Oi' : '');
    if (!effectiveText) {
      return res.status(200).json({ received: true, ignored: 'no-text' });
    }

    const cfg = await loadStoreConfigFromFirestore();
    if (!cfg.botEnabled) {
      return res.status(200).json({ received: true, ignored: 'bot-disabled' });
    }

    const replyText = buildBotReply(effectiveText, pushName, cleanSender || remoteJid, cfg);
    const evolutionUrl = cfg.evolutionUrl.startsWith('http') ? cfg.evolutionUrl : `https://${cfg.evolutionUrl}`;
    const sendTarget = cleanSender.length >= 10 ? cleanSender : targetJid;

    const sendRes = await fetch(`${evolutionUrl}/message/sendText/${cfg.evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.evolutionToken
      },
      body: JSON.stringify({
        number: sendTarget,
        text: replyText
      }),
      signal: AbortSignal.timeout(8000)
    });

    const sendResult = await sendRes.text();
    return res.status(200).json({
      received: true,
      replied: sendRes.ok,
      to: sendTarget,
      status: sendRes.status,
      result: sendResult.slice(0, 300)
    });
  } catch (err: any) {
    return res.status(200).json({
      received: true,
      error: err?.message || 'Webhook processing error'
    });
  }
}
