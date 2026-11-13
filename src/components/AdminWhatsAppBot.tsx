/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, Check, CheckCheck, Settings, Bot, HelpCircle, 
  RefreshCw, Sliders, Shield, Activity, Sparkles, Phone, User, 
  MapPin, CheckCircle2, QrCode, ClipboardList, Zap, Bell,
  Play, Pause, ArrowRight, ExternalLink, Terminal, AlertCircle, Radio
} from 'lucide-react';
import { Order, MenuItem } from '../types';

interface AdminWhatsAppBotProps {
  storeSettings: any;
  onUpdateSettings: (updated: any) => Promise<void>;
  menuItems: MenuItem[];
  orders: Order[];
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  status: 'sent' | 'delivered' | 'read';
}

export default function AdminWhatsAppBot({ storeSettings, onUpdateSettings, menuItems, orders }: AdminWhatsAppBotProps) {
  const [activeTab, setActiveTab] = useState<'quickrun' | 'simulator' | 'config' | 'guides'>('quickrun');
  const [botEnabled, setBotEnabled] = useState(storeSettings.whatsappBotEnabled !== false);
  const [whatsappPhone, setWhatsappPhone] = useState(storeSettings.phone || '');
  const [webhookUrl, setWebhookUrl] = useState(
    (storeSettings.whatsappWebhookUrl && !String(storeSettings.whatsappWebhookUrl).includes('api.empresa.com'))
      ? storeSettings.whatsappWebhookUrl
      : 'https://sorveteriasupreme.vercel.app/api/webhook/whatsapp'
  );
  const [apiSecret, setApiSecret] = useState(storeSettings.whatsappApiKey || 'sk_supreme_prod_xyz789');
  const [botName, setBotName] = useState(storeSettings.whatsappBotName || 'Supreme Bot Premium 💜');
  
  // Real Connection Provider states
  const [connectionProvider, setConnectionProvider] = useState<'native' | 'simulator' | 'evolution' | 'zapi' | 'wppconnect'>(
    storeSettings.whatsappConnectionProvider || 'simulator'
  );
  
  const [evolutionUrl, setEvolutionUrl] = useState(storeSettings.whatsappEvolutionUrl || 'https://supreme-bot-2bm0.onrender.com');
  const [evolutionInstance, setEvolutionInstance] = useState(storeSettings.whatsappEvolutionInstance || 'supreme-bot');
  const [evolutionToken, setEvolutionToken] = useState(storeSettings.whatsappEvolutionToken || 'Rmfa1100@');
  
  const [zapiInstanceId, setZapiInstanceId] = useState(storeSettings.whatsappZapiInstanceId || '');
  const [zapiToken, setZapiToken] = useState(storeSettings.whatsappZapiToken || '');
  
  const [wppconnectUrl, setWppconnectUrl] = useState(storeSettings.whatsappWppconnectUrl || '');
  const [wppconnectInstance, setWppconnectInstance] = useState(storeSettings.whatsappWppconnectInstance || '');
  const [wppconnectToken, setWppconnectToken] = useState(storeSettings.whatsappWppconnectToken || '');
  const [customBackendUrl, setCustomBackendUrl] = useState(storeSettings.whatsappBackendUrl || '');
  const [hasLocalBackend, setHasLocalBackend] = useState<boolean>(() => {
    if (storeSettings.whatsappBackendUrl?.trim()) return true;
    if (typeof window === 'undefined') return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.includes('ais-dev-') || h.includes('ais-pre-');
  });

  useEffect(() => {
    if (storeSettings.whatsappBackendUrl !== undefined) {
      setCustomBackendUrl(storeSettings.whatsappBackendUrl || '');
      if (storeSettings.whatsappBackendUrl.trim()) {
        setHasLocalBackend(true);
      }
    }
  }, [storeSettings.whatsappBackendUrl]);

  const getApiUrl = (route: string) => {
    const raw = (customBackendUrl || '').trim().replace(/\/+$/, '');
    if (!raw) return route;
    const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    return `${base}${route}`;
  };

  const [qrError, setQrError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [creatingInstanceManual, setCreatingInstanceManual] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [qrProgressMsg, setQrProgressMsg] = useState('');
  const [activatingWebhook, setActivatingWebhook] = useState(false);
  const [webhookActiveResult, setWebhookActiveResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
  const [simulatingCustomerMsg, setSimulatingCustomerMsg] = useState(false);
  const [testCustomerText, setTestCustomerText] = useState('Olá! Gostaria de fazer um pedido');
  const [simulatedReply, setSimulatedReply] = useState<string | null>(null);

  // Diagnostic states from server-side test
  const [evolutionDiagnostic, setEvolutionDiagnostic] = useState<{
    success?: boolean;
    evolutionOnline?: boolean;
    evolutionVersion?: string;
    evolutionUrl?: string;
    instanceName?: string;
    tokenValid?: boolean;
    instanceExists?: boolean;
    instanceState?: string;
    isPaired?: boolean;
    ownerJid?: string | null;
    webhookActive?: boolean;
    webhookUrl?: string | null;
    nativeStatus?: string;
    nativeIsPaired?: boolean;
    nativeOwnerJid?: string | null;
  } | null>(null);
  const [nativeOwnerJid, setNativeOwnerJid] = useState<string | null>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const [copiedVersionVar, setCopiedVersionVar] = useState(false);
  const [copiedVersionVal, setCopiedVersionVal] = useState(false);
  const [pairingCodeInputNumber, setPairingCodeInputNumber] = useState(storeSettings.phone || '5519974118672');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);

  const getEffectiveEvolutionCreds = () => {
    let url = (evolutionUrl || storeSettings.whatsappEvolutionUrl || 'https://supreme-bot-2bm0.onrender.com').trim().replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    const instance = (evolutionInstance || storeSettings.whatsappEvolutionInstance || 'supreme-bot').trim() || 'supreme-bot';
    const token = (evolutionToken || storeSettings.whatsappEvolutionToken || 'Rmfa1100@').trim() || 'Rmfa1100@';
    return { url, instance, token };
  };

  const getPublicWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
    const isTempHost = !origin || origin.includes('.run.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
    const base = isTempHost ? getClientBaseUrl() : origin;
    return `${base}/api/webhook/whatsapp`;
  };

  const directEvolutionSetupWebhook = async (overrideInstance?: string) => {
    const { url, instance, token } = getEffectiveEvolutionCreds();
    const targetInst = (overrideInstance || instance || 'supreme-bot').trim();
    const webhookDestination = getPublicWebhookUrl();
    const webhookPayload = {
      enabled: true,
      url: webhookDestination,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      webhook: {
        enabled: true,
        url: webhookDestination,
        byEvents: false,
        base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
      }
    };
    const res = await fetch(`${url}/webhook/set/${targetInst}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: JSON.stringify(webhookPayload)
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Erro ao ativar webhook no Render (${res.status}): ${errTxt}`);
    }
    return webhookDestination;
  };

  const runDirectEvolutionDiagnostic = async () => {
    const { url, instance, token } = getEffectiveEvolutionCreds();
    let online = false;
    let version = '';
    try {
      const r = await fetch(`${url}/`);
      if (r.ok) {
        const j = await r.json();
        online = true;
        version = j.version || '';
      }
    } catch (_) {}

    let instanceExists = false;
    let instanceState = 'close';
    let isPaired = false;
    let ownerJid: string | null = null;
    let tokenValid = false;
    try {
      const r = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: token } });
      if (r.ok) {
        tokenValid = true;
        const list = await r.json();
        const found = (Array.isArray(list) ? list : []).find((i: any) => i.name === instance || i.instance?.instanceName === instance);
        if (found) {
          instanceExists = true;
          instanceState = found.connectionStatus || found.instance?.status || 'close';
          ownerJid = found.ownerJid || null;
          isPaired = Boolean(ownerJid) || instanceState === 'open';
        }
      }
    } catch (_) {}

    try {
      const sr = await fetch(`${url}/instance/connectionState/${instance}`, { headers: { apikey: token } });
      if (sr.ok) {
        const sd = await sr.json();
        const st = sd?.instance?.state || sd?.state;
        if (st === 'open' || st === 'CONNECTED') {
          isPaired = true;
          instanceState = 'open';
        } else if (st) {
          isPaired = false;
          instanceState = st;
        }
      }
    } catch (_) {}

    let webhookActive = false;
    let webhookUrlFound: string | null = null;
    try {
      const wr = await fetch(`${url}/webhook/find/${instance}`, { headers: { apikey: token } });
      if (wr.ok) {
        const wd = await wr.json();
        webhookActive = wd?.enabled === true || wd?.webhook?.enabled === true;
        webhookUrlFound = wd?.url || wd?.webhook?.url || null;
      }
    } catch (_) {}

    return {
      success: true,
      evolutionOnline: online,
      evolutionVersion: version,
      evolutionUrl: url,
      instanceName: instance,
      tokenValid,
      instanceExists,
      instanceState,
      isPaired,
      ownerJid,
      webhookActive,
      webhookUrl: webhookUrlFound,
      nativeStatus: isPaired ? 'connected' : 'disconnected',
      nativeIsPaired: isPaired,
      nativeOwnerJid: ownerJid ? ownerJid.split(':')[0].split('@')[0] : null
    };
  };

  // Function to load diagnostic
  const loadDiagnostic = async () => {
    setLoadingDiagnostic(true);
    try {
      const res = await fetch(getApiUrl('/api/evolution/diagnostic'));
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        setHasLocalBackend(true);
        const data = await res.json();
        if (data.success) {
          setEvolutionDiagnostic(data);
          setNativeOwnerJid(data.nativeOwnerJid || null);
          if (connectionProvider === 'native') {
            if (data.nativeIsPaired) {
              setQrCodeStatus('connected');
              setPairingCodeResult(null);
              localStorage.setItem('whatsapp_qr_status', 'connected');
            } else {
              setQrCodeStatus(prev => (prev === 'waiting' || prev === 'generating' ? prev : 'disconnected'));
              if (!data.nativeIsPaired) {
                localStorage.removeItem('whatsapp_qr_status');
              }
            }
          } else if (connectionProvider === 'evolution') {
            if (data.isPaired) {
              setQrCodeStatus('connected');
              localStorage.setItem('whatsapp_qr_status', 'connected');
            } else {
              setQrCodeStatus(prev => (prev === 'waiting' || prev === 'generating' ? prev : 'disconnected'));
              localStorage.removeItem('whatsapp_qr_status');
            }
          }
          return;
        }
      }

      // Running on static host (e.g. Vercel sorveteriasupreme.vercel.app) -> use direct Render Evolution HTTPS
      setHasLocalBackend(false);
      const directData = await runDirectEvolutionDiagnostic();
      setEvolutionDiagnostic(directData);
      setNativeOwnerJid(directData.nativeOwnerJid || null);
      if (directData.isPaired) {
        setQrCodeStatus('connected');
        setPairingCodeResult(null);
        localStorage.setItem('whatsapp_qr_status', 'connected');
      } else {
        setQrCodeStatus(prev => (prev === 'waiting' || prev === 'generating' ? prev : 'disconnected'));
        localStorage.removeItem('whatsapp_qr_status');
      }
    } catch (e) {
      console.warn('Diagnostic fetch error:', e);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  useEffect(() => {
    loadDiagnostic();
  }, [connectionProvider, storeSettings.whatsappBackendUrl]);

  // Internal WhatsApp Device Linking QR Code states
  const [qrCodeStatus, setQrCodeStatus] = useState<'disconnected' | 'generating' | 'waiting' | 'connecting' | 'connected'>('disconnected');
  const [qrTimer, setQrTimer] = useState(60);
  const [qrCodePayload, setQrCodePayload] = useState('');

  // Live Test Dispatch States
  const [testPhone, setTestPhone] = useState(() => {
    const raw = (storeSettings.phone || '5519974118672').replace(/\D/g, '');
    return raw.length === 10 || raw.length === 11 ? `55${raw}` : raw || '5519974118672';
  });
  const [testTemplate, setTestTemplate] = useState<'welcome' | 'menu' | 'status' | 'custom'>('menu');
  const [testCustomMessage, setTestCustomMessage] = useState('Olá! Este é um teste oficial de disparo do Supreme Bot.');
  const [testDispatchLoading, setTestDispatchLoading] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [serverLogs, setServerLogs] = useState<Array<{ id: string; timestamp: string; from: string; incomingText: string; replyText: string; status: string; details?: string }>>([]);
  const [testLogs, setTestLogs] = useState<Array<{ id: string; time: string; text: string; type: 'success' | 'info' | 'error' }>>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text: '🤖 Sistema WhatsApp Bot iniciado e pronto para execução.',
      type: 'info'
    }
  ]);

  const refreshServerLogs = async () => {
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/native/status'));
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        setHasLocalBackend(true);
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.recentLogs)) {
            setServerLogs(data.recentLogs);
          }
          if (data.ownerJid) {
            setNativeOwnerJid(data.ownerJid);
          }
          if (connectionProvider === 'native' && data.isPaired) {
            setQrCodeStatus('connected');
          }
        }
        return;
      }

      // Vercel / external host: poll Render Evolution state + Vercel webhook logs
      setHasLocalBackend(false);
      const { url, instance, token } = getEffectiveEvolutionCreds();
      const sr = await fetch(`${url}/instance/connectionState/${instance}`, { headers: { apikey: token } });
      if (sr.ok) {
        const sd = await sr.json();
        const st = sd?.instance?.state || sd?.state;
        if (st === 'open' || st === 'CONNECTED') {
          setQrCodeStatus('connected');
        }
      }
      try {
        const whRes = await fetch('/api/webhook/whatsapp');
        if (whRes.ok && whRes.headers.get('content-type')?.includes('application/json')) {
          const whData = await whRes.json();
          if (Array.isArray(whData.recentLogs) && whData.recentLogs.length > 0) {
            setServerLogs(whData.recentLogs);
          }
        }
      } catch (_) {}
    } catch (_) {}
  };

  useEffect(() => {
    refreshServerLogs();
    const timer = setInterval(refreshServerLogs, 5000);
    return () => clearInterval(timer);
  }, [connectionProvider, storeSettings.whatsappBackendUrl]);

  // Countdown timer logic for QR Code expiration
  useEffect(() => {
    let interval: any;
    if (qrCodeStatus === 'waiting' && qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    } else if (qrCodeStatus === 'waiting' && qrTimer === 0) {
      setQrCodeStatus('disconnected');
      setPairingCodeResult(null);
    }
    return () => clearInterval(interval);
  }, [qrCodeStatus, qrTimer]);

  // Automatic polling while waiting for QR / Pairing Code scan
  useEffect(() => {
    if (qrCodeStatus !== 'waiting') return;
    if (connectionProvider !== 'native' && connectionProvider !== 'evolution') return;

    const pollInterval = setInterval(async () => {
      try {
        if (hasLocalBackend && connectionProvider === 'native') {
          const res = await fetch(getApiUrl('/api/whatsapp/native/status'));
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            if (data.isPaired) {
              setNativeOwnerJid(data.ownerJid || null);
              setQrCodeStatus('connected');
              setPairingCodeResult(null);
              setQrCodePayload('');
              localStorage.setItem('whatsapp_qr_status', 'connected');
              playBellSound();
              loadDiagnostic();
            } else if (data.qrDataUrl && !pairingCodeResult) {
              setQrCodePayload(prev => (prev !== data.qrDataUrl ? data.qrDataUrl : prev));
            }
            return;
          }
        }

        if (hasLocalBackend && connectionProvider === 'evolution') {
          const res = await fetch(getApiUrl('/api/evolution/diagnostic'));
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            if (data.isPaired) {
              setEvolutionDiagnostic(data);
              setQrCodeStatus('connected');
              localStorage.setItem('whatsapp_qr_status', 'connected');
              playBellSound();
            }
            return;
          }
        }

        // Direct Render polling (used on https://sorveteriasupreme.vercel.app)
        const directData = await runDirectEvolutionDiagnostic();
        if (directData.isPaired) {
          setEvolutionDiagnostic(directData);
          setNativeOwnerJid(directData.nativeOwnerJid || null);
          setQrCodeStatus('connected');
          setPairingCodeResult(null);
          localStorage.setItem('whatsapp_qr_status', 'connected');
          directEvolutionSetupWebhook().catch(() => {});
          playBellSound();
        }
      } catch (_) {}
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [qrCodeStatus, connectionProvider, pairingCodeResult, hasLocalBackend, evolutionInstance]);

  // Custom chatbot messages & links states
  const [welcomeMsg, setWelcomeMsg] = useState(storeSettings.whatsappBotWelcomeMessage || `Olá! Seja muito bem-vindo ao assistente automático da *${storeSettings.name}*! 🍨\n\nSou o *${storeSettings.whatsappBotName || 'Supreme Bot Premium 💜'}*.\n\nEscolha uma das opções abaixo enviando o número ou digitando sua dúvida:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`);
  const [menuMsg, setMenuMsg] = useState(storeSettings.whatsappBotMenuMessage || `⭐️ *CARDÁPIO DIGITAL DA LOUCURA* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso site completo para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\n🔥 *Mais Pedidos de Hoje:*`);
  const [menuLink, setMenuLink] = useState(
    (storeSettings.whatsappBotMenuLink && !storeSettings.whatsappBotMenuLink.includes('.run.app'))
      ? storeSettings.whatsappBotMenuLink
      : 'https://sorveteriasupreme.vercel.app'
  );
  const getClientBaseUrl = () => {
    const raw = (menuLink || storeSettings.whatsappBotMenuLink || storeSettings.customDomain || 'https://sorveteriasupreme.vercel.app').trim().replace(/\/+$/, '');
    if (!raw || raw.includes('.run.app')) return 'https://sorveteriasupreme.vercel.app';
    return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  };
  const [supportMsg, setSupportMsg] = useState(storeSettings.whatsappBotSupportMessage || `🙋‍♂️ *CONECTANDO À NOSSA EQUIPE*\n\nEntendi! Estou transferindo seu atendimento para os nossos atendentes humanos na loja física. Nosso tempo médio de resposta é de menos de 4 minutos!\n\nSe preferir ligar diretamente, use o número comercial:\n👉 *{telefone}*`);

  // Settings saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reception bell chime sound & active state for Option 4 alerts
  const [bellAlertActive, setBellAlertActive] = useState(false);

  const playBellSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Tone 1: Resonant crystal strike (C6 pure chime)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.50, now);
      osc1.frequency.exponentialRampToValueAtTime(1054, now + 0.05);
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15);

      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 1.8);

      // Tone 2: Ultra bright sharp overtone (C7 high pitch)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2093.00, now);
      
      gain2.gain.setValueAtTime(0.12, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn("Speech/Audio context blocked on this browser session:", e);
    }
  };

  useEffect(() => {
    if (!bellAlertActive) return;
    playBellSound();
    const intervalId = setInterval(() => {
      playBellSound();
    }, 2500);
    return () => clearInterval(intervalId);
  }, [bellAlertActive]);

  // Chat Simulator State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setChatMessages([
      {
        id: '1',
        sender: 'bot',
        text: welcomeMsg,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      }
    ]);
  }, [welcomeMsg]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const handleSaveSettings = async (override?: any) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload = {
        ...storeSettings,
        whatsappBotEnabled: override?.whatsappBotEnabled !== undefined ? override.whatsappBotEnabled : botEnabled,
        phone: whatsappPhone,
        whatsappWebhookUrl: webhookUrl,
        whatsappApiKey: apiSecret,
        whatsappBotName: botName,
        whatsappBotWelcomeMessage: welcomeMsg,
        whatsappBotMenuMessage: menuMsg,
        whatsappBotMenuLink: menuLink,
        whatsappBotSupportMessage: supportMsg,
        whatsappConnectionProvider: override?.whatsappConnectionProvider || connectionProvider,
        whatsappBackendUrl: customBackendUrl.trim().replace(/\/+$/, ''),
        whatsappEvolutionUrl: evolutionUrl,
        whatsappEvolutionInstance: evolutionInstance,
        whatsappEvolutionToken: evolutionToken,
        whatsappZapiInstanceId: zapiInstanceId,
        whatsappZapiToken: zapiToken,
        whatsappWppconnectUrl: wppconnectUrl,
        whatsappWppconnectInstance: wppconnectInstance,
        whatsappWppconnectToken: wppconnectToken,
      };
      await onUpdateSettings(payload);
      
      // Sync to backend bot server
      fetch(getApiUrl('/api/bot/sync-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botEnabled: override?.whatsappBotEnabled !== undefined ? override.whatsappBotEnabled : botEnabled,
          botName,
          storeName: storeSettings.name || 'Sorveteria Supreme',
          phone: whatsappPhone,
          evolutionUrl,
          evolutionInstance,
          evolutionToken,
          welcomeMsg,
          menuLink,
          menuMsg,
          supportMsg,
          address: storeSettings.address || '',
          openHours: `${storeSettings.openTime || '11:00'} às ${storeSettings.closeTime || '23:59'}`
        })
      }).catch(() => {});

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Activate 24/7 Webhook on Evolution API with 1-click (or enable Native Direct Bot)
  const handleActivateWebhookAutoBot = async () => {
    setActivatingWebhook(true);
    setWebhookActiveResult(null);
    try {
      if (hasLocalBackend && connectionProvider === 'native') {
        await handleSaveSettings({ whatsappBotEnabled: true, whatsappConnectionProvider: 'native' });
        const statusRes = await fetch(getApiUrl('/api/whatsapp/native/status'));
        if (statusRes.ok && statusRes.headers.get('content-type')?.includes('application/json')) {
          const statusData = await statusRes.json();
          if (statusData.isPaired) {
            setNativeOwnerJid(statusData.ownerJid || null);
            setQrCodeStatus('connected');
            setWebhookActiveResult({
              success: true,
              message: `Robô Automático Ativo no WhatsApp Direto (+${statusData.ownerJid || 'conectado'})!`
            });
          } else {
            setWebhookActiveResult({
              success: false,
              message: 'Motor Direto salvo e ativado, mas falta escanear o QR Code na aba "Conexão & QR Code Real".'
            });
            setActiveTab('config');
          }
          return;
        }
      }

      if (!hasLocalBackend) {
        const destUrl = await directEvolutionSetupWebhook();
        await handleSaveSettings({ whatsappBotEnabled: true, whatsappConnectionProvider: 'evolution' });
        setConnectionProvider('evolution');
        setWebhookActiveResult({
          success: true,
          message: 'Robô Automático 24/7 Ativado com Sucesso no WhatsApp!',
          url: destUrl
        });
        loadDiagnostic();
        return;
      }

      const { url, instance, token } = getEffectiveEvolutionCreds();
      const res = await fetch(getApiUrl('/api/bot/setup-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evolutionUrl: url,
          evolutionInstance: instance,
          evolutionToken: token,
          publicAppUrl: getPublicWebhookUrl().replace(/\/api\/webhook\/whatsapp$/, '')
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao configurar webhook');
      }
      setWebhookActiveResult({
        success: true,
        message: 'Robô Automático 24/7 Ativado com Sucesso no WhatsApp!',
        url: data.webhookUrl
      });
    } catch (e: any) {
      setWebhookActiveResult({
        success: false,
        message: e.message || 'Erro ao ativar'
      });
    } finally {
      setActivatingWebhook(false);
    }
  };

  // Check Webhook / Bot Status
  const [checkingWebhookStatus, setCheckingWebhookStatus] = useState(false);
  const handleCheckWebhookStatus = async () => {
    setCheckingWebhookStatus(true);
    try {
      if (hasLocalBackend && connectionProvider === 'native') {
        const res = await fetch(getApiUrl('/api/whatsapp/native/status'));
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.isPaired) {
            setNativeOwnerJid(data.ownerJid || null);
            setQrCodeStatus('connected');
            setWebhookActiveResult({
              success: true,
              message: `WhatsApp Direto Conectado (+${data.ownerJid || 'pareado'}) e respondendo mensagens automaticamente!`
            });
          } else {
            setWebhookActiveResult({
              success: false,
              message: 'WhatsApp Direto ainda não pareado. Gere e escaneie o QR Code na aba "Conexão & QR Code Real".'
            });
          }
          await refreshServerLogs();
          return;
        }
      }

      if (!hasLocalBackend) {
        const { url, instance, token } = getEffectiveEvolutionCreds();
        const wr = await fetch(`${url}/webhook/find/${instance}`, { headers: { apikey: token } });
        const wd = await wr.json();
        const active = wd?.enabled === true || wd?.webhook?.enabled === true;
        const wUrl = wd?.url || wd?.webhook?.url || null;
        if (active) {
          setWebhookActiveResult({
            success: true,
            message: 'Webhook Ativo e Operando no WhatsApp!',
            url: wUrl
          });
        } else {
          setWebhookActiveResult({
            success: false,
            message: 'Webhook ainda não está ativado na Evolution API. Clique no botão Ativar Robô 24h.'
          });
        }
        return;
      }

      const { url, instance, token } = getEffectiveEvolutionCreds();
      const res = await fetch(getApiUrl('/api/bot/check-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evolutionUrl: url,
          evolutionInstance: instance,
          evolutionToken: token
        })
      });
      const data = await res.json();
      if (data.active) {
        setWebhookActiveResult({
          success: true,
          message: 'Webhook Ativo e Operando no WhatsApp!',
          url: data.webhookUrl
        });
      } else {
        setWebhookActiveResult({
          success: false,
          message: 'Webhook ainda não está ativado na Evolution API.'
        });
      }
    } catch (e: any) {
      setWebhookActiveResult({
        success: false,
        message: `Erro ao checar status: ${e.message}`
      });
    } finally {
      setCheckingWebhookStatus(false);
    }
  };

  const [testingLiveWebhook, setTestingLiveWebhook] = useState(false);
  const handleTestLiveWebhookEndpoint = async () => {
    setTestingLiveWebhook(true);
    setWebhookActiveResult(null);
    try {
      await fetch(getApiUrl('/api/webhook/whatsapp?wakeup=1')).catch(() => {});
      const cleanTestNum = (testPhone || storeSettings.phone || '5519974118672').replace(/\D/g, '');
      const formattedNum = (cleanTestNum.length === 10 || cleanTestNum.length === 11) ? `55${cleanTestNum}` : cleanTestNum;
      const res = await fetch(getApiUrl('/api/webhook/whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'messages.upsert',
          instance: evolutionInstance || 'supreme-bot',
          data: {
            key: {
              remoteJid: `${formattedNum}@s.whatsapp.net`,
              fromMe: false,
              id: `ADMIN_TEST_${Date.now()}`
            },
            pushName: 'Teste Admin',
            message: { conversation: 'oi' }
          }
        })
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson) {
        throw new Error(`Endpoint retornou HTTP ${res.status} sem JSON (verifique deploy na Vercel).`);
      }
      const data = await res.json();
      await refreshServerLogs();
      if (data.replied) {
        setWebhookActiveResult({
          success: true,
          message: `✅ Teste Real Concluído! O Webhook recebeu "oi" e enviou as boas-vindas para +${data.to || formattedNum} pela Evolution API!`
        });
      } else {
        setWebhookActiveResult({
          success: false,
          message: `⚠️ Webhook respondeu HTTP ${data.status || res.status}: ${data.result || data.ignored || data.error || 'Não foi possível enviar pela Evolution API.'}`
        });
      }
    } catch (e: any) {
      setWebhookActiveResult({
        success: false,
        message: `Erro ao testar webhook: ${e.message}`
      });
    } finally {
      setTestingLiveWebhook(false);
    }
  };

  // Simulate customer sending message to bot
  const handleSimulateCustomerMessage = async (textToSimulate?: string) => {
    const text = textToSimulate || testCustomerText;
    if (!text.trim()) return;
    setSimulatingCustomerMsg(true);
    setSimulatedReply(null);
    try {
      const res = await fetch(getApiUrl('/api/bot/simulate-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          pushName: 'Cliente Teste',
          phone: testPhone
        })
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.replyText) {
          setSimulatedReply(data.replyText);
          return;
        }
      }
      // Fallback for static Vercel host
      const clean = text.trim().toLowerCase();
      if (clean === '1' || clean.includes('cardapio') || clean.includes('cardápio')) {
        setSimulatedReply(menuMsg.replace('{menu_link}', menuLink).replace('[LINK_CARDAPIO]', menuLink));
      } else if (clean === '2' || clean.includes('rastrear') || clean.includes('pedido')) {
        setSimulatedReply(`🔍 *RASTREADOR DE PEDIDOS SUPREME*\n\nAcompanhe seu pedido ao vivo em:\n👉 ${menuLink}?track=true`);
      } else if (clean === '3' || clean.includes('horario') || clean.includes('horário') || clean.includes('endereco') || clean.includes('endereço')) {
        setSimulatedReply(`📍 *LOCALIZAÇÃO & HORÁRIOS SUPREME*\n\n🏠 ${storeSettings.address}\n⏰ ${storeSettings.openTime || '13:00'} às ${storeSettings.closeTime || '21:00'}`);
      } else if (clean === '4' || clean.includes('atendente') || clean.includes('humano')) {
        setSimulatedReply(supportMsg.replace('{telefone}', whatsappPhone).replace('[TELEFONE]', whatsappPhone));
      } else {
        setSimulatedReply(welcomeMsg.replace('{nome}', 'Cliente Teste'));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setSimulatingCustomerMsg(false);
    }
  };

  // One-Click "Colocar Bot para Rodar"
  const handleOneClickRun = async () => {
    setBotEnabled(true);
    if (connectionProvider === 'simulator') {
      setQrCodeStatus('connected');
      localStorage.setItem('whatsapp_qr_status', 'connected');
    } else if (connectionProvider === 'native') {
      try {
        const res = await fetch(getApiUrl('/api/whatsapp/native/status'));
        const data = await res.json();
        if (data.isPaired) {
          setNativeOwnerJid(data.ownerJid || null);
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
        }
      } catch (_) {}
    }

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTestLogs(prev => [
      {
        id: `run-${Date.now()}`,
        time: timeStr,
        text: '🚀 BOT COLOCADO PARA RODAR COM SUCESSO! Escuta e respostas automáticas ativadas.',
        type: 'success'
      },
      ...prev
    ]);

    await handleSaveSettings({ whatsappBotEnabled: true });
    if (connectionProvider === 'evolution' && evolutionUrl) {
      handleActivateWebhookAutoBot().catch(() => {});
    }
    playBellSound();
  };

  // Handle Pause
  const handlePauseBot = async () => {
    setBotEnabled(false);
    setQrCodeStatus('disconnected');
    localStorage.removeItem('whatsapp_qr_status');
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTestLogs(prev => [
      {
        id: `pause-${Date.now()}`,
        time: timeStr,
        text: '⏸️ O Bot do WhatsApp foi pausado pelo administrador.',
        type: 'info'
      },
      ...prev
    ]);
    await handleSaveSettings({ whatsappBotEnabled: false });
  };

  // Build message text for test
  const getTestMessageText = () => {
    if (testTemplate === 'welcome') {
      return welcomeMsg;
    }
    if (testTemplate === 'menu') {
      const topItems = menuItems.slice(0, 3).map(it => `• *${it.name}* - _R$ ${it.price.toFixed(2)}_`).join('\n');
      return `🍨 *CARDÁPIO SUPREME GOURMET* 🍨\n\nConfira nosso cardápio completo e monte seu copo online:\n👉 ${menuLink}\n\n*Destaques do Dia:*\n${topItems}\n\nEnvie 1 para fazer pedido ou 4 para falar com atendente!`;
    }
    if (testTemplate === 'status') {
      const latest = orders[0];
      const shortId = latest ? latest.id.slice(-6).toUpperCase() : 'SUP789';
      return `📦 *ATUALIZAÇÃO DO PEDIDO #${shortId}*\n\nSeu pedido está *Sendo Montado com Carinho!* 🥣\n\nAcompanhe em tempo real:\n👉 ${getClientBaseUrl()}?track=${latest ? latest.id : 'demo'}\n\nTempo estimado: 15-25 minutos.`;
    }
    return testCustomMessage;
  };

  // Test Real Message Dispatch
  const handleSendTestMessage = async () => {
    setDispatchFeedback(null);
    const rawDigits = testPhone.replace(/\D/g, '').replace(/^0+/, '');
    const cleanNumber = (rawDigits.length === 10 || rawDigits.length === 11) ? `55${rawDigits}` : rawDigits;
    if (!cleanNumber || cleanNumber.length < 10) {
      setDispatchFeedback({
        type: 'error',
        message: 'Informe um número válido com DDD (ex: 5519998765432 ou 19998765432).'
      });
      return;
    }

    const messageText = getTestMessageText();
    setTestDispatchLoading(true);
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      if (hasLocalBackend && connectionProvider === 'native') {
        const res = await fetch(getApiUrl('/api/whatsapp/send-message'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanNumber,
            message: messageText
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `Erro HTTP ${res.status}`);
        }
        const resolvedJid = data?.result?.jid ? ` (${data.result.jid.split('@')[0]})` : '';
        setTestLogs(prev => [
          {
            id: `msg-${Date.now()}`,
            time: timeStr,
            text: `✓ Mensagem enviada via Conexão Direta para +${cleanNumber}${resolvedJid}!`,
            type: 'success'
          },
          ...prev
        ]);
        setDispatchFeedback({
          type: 'success',
          message: `✓ Mensagem enviada pelo WhatsApp para +${cleanNumber}${resolvedJid}!`
        });
        refreshServerLogs();
      }
      else if (connectionProvider === 'evolution' || (!hasLocalBackend && connectionProvider === 'native')) {
        const { url: cleanUrl, instance: cleanInst, token: cleanTok } = getEffectiveEvolutionCreds();
        const res = await fetch(`${cleanUrl}/message/sendText/${cleanInst}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': cleanTok
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: messageText
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Erro HTTP ${res.status}`);
        }
        setTestLogs(prev => [
          {
            id: `msg-${Date.now()}`,
            time: timeStr,
            text: `✓ Mensagem enviada via Evolution API para +${cleanNumber} com sucesso!`,
            type: 'success'
          },
          ...prev
        ]);
        setDispatchFeedback({
          type: 'success',
          message: `✓ Mensagem enviada via Evolution API para +${cleanNumber}!`
        });
      } 
      else if (connectionProvider === 'zapi') {
        if (!zapiInstanceId || !zapiToken) {
          throw new Error('Configure o ID e Token da Z-API na aba "Conexão & QR Code".');
        }
        const res = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiToken
          },
          body: JSON.stringify({
            phone: cleanNumber,
            message: messageText
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `Erro HTTP ${res.status}`);
        }
        setTestLogs(prev => [
          {
            id: `msg-${Date.now()}`,
            time: timeStr,
            text: `✓ Mensagem enviada via Z-API para +${cleanNumber} com sucesso!`,
            type: 'success'
          },
          ...prev
        ]);
        setDispatchFeedback({
          type: 'success',
          message: `✓ Mensagem enviada via Z-API para +${cleanNumber}!`
        });
      }
      else if (connectionProvider === 'wppconnect') {
        if (!wppconnectUrl || !wppconnectInstance || !wppconnectToken) {
          throw new Error('Configure a URL, Instância e Token do WPPConnect na aba "Conexão & QR Code".');
        }
        const cleanUrl = wppconnectUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/${wppconnectInstance}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wppconnectToken}`
          },
          body: JSON.stringify({
            phone: cleanNumber,
            message: messageText
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Erro HTTP ${res.status}`);
        }
        setTestLogs(prev => [
          {
            id: `msg-${Date.now()}`,
            time: timeStr,
            text: `✓ Mensagem enviada via WPPConnect para +${cleanNumber} com sucesso!`,
            type: 'success'
          },
          ...prev
        ]);
        setDispatchFeedback({
          type: 'success',
          message: `✓ Mensagem enviada via WPPConnect para +${cleanNumber}!`
        });
      }
      else {
        // If native WhatsApp is actually paired on the server even while UI is on simulator, use it!
        const nativeRes = await fetch(getApiUrl('/api/whatsapp/native/status')).then(r => r.json()).catch(() => null);
        if (nativeRes?.isPaired) {
          const res = await fetch(getApiUrl('/api/whatsapp/send-message'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: cleanNumber, message: messageText })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || `Erro HTTP ${res.status}`);
          }
          setTestLogs(prev => [
            {
              id: `msg-${Date.now()}`,
              time: timeStr,
              text: `✓ Mensagem enviada pelo WhatsApp conectado para +${cleanNumber}!`,
              type: 'success'
            },
            ...prev
          ]);
          setDispatchFeedback({
            type: 'success',
            message: `✓ Mensagem enviada pelo WhatsApp conectado para +${cleanNumber}!`
          });
          refreshServerLogs();
          return;
        }

        // Simulator mode: simulate the dispatch
        playBellSound();
        setTestLogs(prev => [
          {
            id: `sim-${Date.now()}`,
            time: timeStr,
            text: `[SIMULADOR] Disparo para +${cleanNumber} simulado! Para enviar no WhatsApp real, conecte na aba "Conexão & QR Code Real".`,
            type: 'info'
          },
          ...prev
        ]);
        setDispatchFeedback({
          type: 'error',
          message: 'Canal está em "Simulador". Mude para "Conexão Direta no Sistema" na aba Conexão & QR Code para enviar mensagens reais!'
        });
      }
    } catch (err: any) {
      console.error(err);
      setTestLogs(prev => [
        {
          id: `err-${Date.now()}`,
          time: timeStr,
          text: `❌ Falha no disparo: ${err.message || err}`,
          type: 'error'
        },
        ...prev
      ]);
      setDispatchFeedback({
        type: 'error',
        message: `Falha ao enviar: ${err.message || err}`
      });
    } finally {
      setTestDispatchLoading(false);
    }
  };

  // Open Direct WhatsApp with formatted message
  const handleOpenDirectWhatsApp = () => {
    const cleanNumber = testPhone.replace(/\D/g, '');
    const messageText = getTestMessageText();
    const url = `https://wa.me/${cleanNumber ? cleanNumber : storeSettings.phone.replace(/\D/g, '')}?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  // Test Webhook Trigger
  const handleTestWebhook = async () => {
    const rawUrl = (webhookUrl || '').trim();
    const isPlaceholder = !rawUrl || rawUrl.includes('api.empresa.com');
    const targetUrl = isPlaceholder ? getApiUrl('/api/webhook/whatsapp') : rawUrl;
    if (isPlaceholder) {
      setWebhookUrl(getPublicWebhookUrl());
    }
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isOwnBotWebhook = targetUrl.includes('/api/webhook/whatsapp');
    const cleanTestNum = (testPhone || storeSettings.phone || '5519974118672').replace(/\D/g, '');
    const formattedNum = (cleanTestNum.length === 10 || cleanTestNum.length === 11) ? `55${cleanTestNum}` : cleanTestNum;

    try {
      const samplePayload = isOwnBotWebhook
        ? {
            event: 'messages.upsert',
            instance: evolutionInstance || 'supreme-loja',
            data: {
              key: {
                remoteJid: `${formattedNum}@s.whatsapp.net`,
                fromMe: false,
                id: `ADMIN_TEST_${Date.now()}`
              },
              pushName: orders[0]?.details?.customerName || 'Cliente Teste',
              message: { conversation: 'oi' }
            }
          }
        : {
            event: 'order.created',
            storeName: storeSettings.name,
            orderId: orders[0]?.id || 'DEMO-123456',
            customer: {
              name: orders[0]?.details?.customerName || 'Cliente Exemplo',
              phone: testPhone
            },
            total: orders[0]?.total || 32.50,
            status: 'waiting',
            timestamp: new Date().toISOString()
          };

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload)
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json().catch(() => null) : null;

      if (!res.ok || (data && data.replied === false && data.status && data.status >= 400)) {
        const errDetail = data?.result || data?.error || data?.ignored || `HTTP ${data?.status || res.status}`;
        throw new Error(errDetail);
      }

      const okMsg = data?.replied
        ? `✓ Webhook respondeu e enviou mensagem para +${data.to || formattedNum} (HTTP ${res.status})`
        : `✓ Webhook disparado com sucesso! Resposta HTTP: ${res.status}`;

      setTestLogs(prev => [
        {
          id: `webhook-${Date.now()}`,
          time: timeStr,
          text: okMsg,
          type: 'success'
        },
        ...prev
      ]);
      setDispatchFeedback({ type: 'success', message: okMsg });
      refreshServerLogs().catch(() => {});
    } catch (e: any) {
      const errMsg = `Erro ao disparar webhook: ${e.message || e}`;
      setTestLogs(prev => [
        {
          id: `wh-err-${Date.now()}`,
          time: timeStr,
          text: `⚠️ ${errMsg}`,
          type: 'error'
        },
        ...prev
      ]);
      setDispatchFeedback({ type: 'error', message: errMsg });
    }
  };

  // Handle checking real status from API provider
  const handleCheckRealConnectionStatus = async () => {
    if (connectionProvider === 'simulator') {
      alert("No modo Simulador, a conexão está sempre 100% online e operante no navegador.");
      return;
    }
    setCheckingStatus(true);
    try {
      if (hasLocalBackend && connectionProvider === 'native') {
        const res = await fetch(getApiUrl('/api/whatsapp/native/status'));
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (res.ok && isJson) {
          const data = await res.json();
          if (data.isPaired) {
            setNativeOwnerJid(data.ownerJid || null);
            setQrCodeStatus('connected');
            setPairingCodeResult(null);
            localStorage.setItem('whatsapp_qr_status', 'connected');
            loadDiagnostic();
            alert(`✓ Seu WhatsApp está conectado e online (+${data.ownerJid || 'pareado'})!`);
          } else {
            setQrCodeStatus('disconnected');
            localStorage.removeItem('whatsapp_qr_status');
            loadDiagnostic();
            alert('❌ Aparelho ainda não pareado na Conexão Direta. Escaneie o QR Code gerado.');
          }
        } else {
          setQrCodeStatus('disconnected');
          alert('❌ Servidor Bot Direto não respondeu neste domínio. Configure a URL do Servidor Bot Externo ou use Evolution API.');
        }
      } else if (connectionProvider === 'evolution' || (!hasLocalBackend && connectionProvider === 'native')) {
        const { url: cleanUrl, instance: cleanInst, token: cleanTok } = getEffectiveEvolutionCreds();
        const res = await fetch(`${cleanUrl}/instance/connectionState/${cleanInst}`, {
          method: 'GET',
          headers: { 'apikey': cleanTok }
        });
        const data = await res.json();
        if (data && (data.instance?.state === 'open' || data.instance?.status === 'connected')) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          directEvolutionSetupWebhook().catch(() => {});
          loadDiagnostic();
          alert("✓ Seu WhatsApp está conectado e online na Evolution API!");
        } else {
          setQrCodeStatus('disconnected');
          localStorage.removeItem('whatsapp_qr_status');
          alert("❌ Aparelho ainda não conectou. Escaneie o QR Code no WhatsApp do celular e tente novamente.");
        }
      } else if (connectionProvider === 'zapi') {
        const res = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`);
        const data = await res.json();
        if (data && (data.connected === true || data.instanceStatus === 'CONNECTED')) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          alert("✓ Seu WhatsApp continua conectado e online na Z-API!");
        } else {
          setQrCodeStatus('disconnected');
          localStorage.removeItem('whatsapp_qr_status');
          alert("❌ Aparelho desconectado ou em sincronização na Z-API.");
        }
      } else if (connectionProvider === 'wppconnect') {
        const cleanUrl = wppconnectUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/${wppconnectInstance}/status-session`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${wppconnectToken}` }
        });
        const data = await res.json();
        if (data && (data.status === 'CONNECTED' || data.connected === true)) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          alert("✓ Seu WhatsApp continua conectado e online no WPPConnect!");
        } else {
          setQrCodeStatus('disconnected');
          localStorage.removeItem('whatsapp_qr_status');
          alert("❌ Aparelho desconectado no WPPConnect.");
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao buscar status na API externa: ${e.message || e}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Diagnostic Test for Evolution API on Render
  const handleTestRenderConnection = async () => {
    setTestingServer(true);
    setDiagnosticResult(null);
    try {
      if (!evolutionUrl) {
        throw new Error('Preencha o campo "URL Base do Servidor" primeiro.');
      }
      let cleanUrl = evolutionUrl.trim().replace(/\/$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }

      const candidateKeys = [
        evolutionToken.trim(),
        storeSettings.whatsappEvolutionToken?.trim(),
        'Rmfa1100@',
        '429683C4C977415CAAFCCE10F7D57E11',
        'supreme2026'
      ].filter(Boolean);

      let keySuccess = '';
      let fetchInstancesRes: any = null;
      let lastErrText = '';

      for (const k of candidateKeys) {
        try {
          const res = await fetch(`${cleanUrl}/instance/fetchInstances`, {
            method: 'GET',
            headers: { 'apikey': k }
          });
          if (res.ok) {
            keySuccess = k;
            fetchInstancesRes = await res.json();
            break;
          } else {
            const txt = await res.text();
            lastErrText = `Status ${res.status}: ${txt}`;
          }
        } catch (fetchErr: any) {
          lastErrText = fetchErr.message || 'Falha de conexão com o Render';
        }
      }

      if (keySuccess) {
        if (keySuccess !== evolutionToken.trim()) {
          setEvolutionToken(keySuccess);
        }
        const instances = Array.isArray(fetchInstancesRes) ? fetchInstancesRes : (fetchInstancesRes?.data || []);
        const names = instances.map((it: any) => it.name || it.instanceName || it.instance?.instanceName).filter(Boolean);
        const hasSupreme = names.includes((evolutionInstance || 'supreme-bot').trim());

        setDiagnosticResult({
          success: true,
          message: `Servidor Evolution API Online e Autenticado! (${instances.length} instância(s) encontrada(s))`,
          details: `Instâncias no banco: ${names.length > 0 ? names.join(', ') : 'Nenhuma criada ainda'}. ${hasSupreme ? '✓ A instância supreme-bot já existe e está pronta!' : 'ℹ️ A instância supreme-bot precisa ser criada. Clique em "Criar Instância supreme-bot" abaixo!'}`
        });
      } else {
        // Test root ping
        let rootReachable = false;
        try {
          const rootRes = await fetch(`${cleanUrl}/`);
          rootReachable = rootRes.status === 200 || rootRes.status === 404;
        } catch (_) {}

        if (rootReachable) {
          setDiagnosticResult({
            success: false,
            message: 'Servidor Render respondeu, mas a API Key não foi aceita.',
            details: 'No Render > Environment: adicione a variável AUTHENTICATION_API_KEY com valor "supreme2026" (ou use a chave padrão 429683C4C977415CAAFCCE10F7D57E11).'
          });
        } else {
          setDiagnosticResult({
            success: false,
            message: 'Não foi possível alcançar o servidor no Render.',
            details: `O Render gratuito pode estar inicializando/acordando (aguarde cerca de 40s) ou a URL está incorreta. Detalhe: ${lastErrText}`
          });
        }
      }
    } catch (e: any) {
      setDiagnosticResult({
        success: false,
        message: 'Falha no teste de conexão',
        details: e.message || String(e)
      });
    } finally {
      setTestingServer(false);
    }
  };

  // Manual explicit instance creation
  const handleManualCreateInstance = async () => {
    setCreatingInstanceManual(true);
    setQrError('');
    try {
      if (!evolutionUrl) {
        throw new Error('Informe a URL da Evolution API.');
      }
      let cleanUrl = evolutionUrl.trim().replace(/\/$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      const cleanInstance = (evolutionInstance || 'supreme-bot').trim();
      const tokenToUse = evolutionToken.trim() || storeSettings.whatsappEvolutionToken?.trim() || 'Rmfa1100@';

      // Clean up previous broken instance first
      try {
        await fetch(`${cleanUrl}/instance/delete/${cleanInstance}`, {
          method: 'DELETE',
          headers: { 'apikey': tokenToUse }
        });
        await new Promise(r => setTimeout(r, 1500));
      } catch (_) {}

      const createRes = await fetch(`${cleanUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': tokenToUse
        },
        body: JSON.stringify({
          instanceName: cleanInstance,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      const createText = await createRes.text();
      let createData: any = null;
      try { createData = JSON.parse(createText); } catch (_) {}

      if (createRes.ok || (createData && (createData.message?.includes('already in use') || createData.message?.includes('already exists')))) {
        const qr = createData?.qrcode?.base64 || createData?.qrcode?.code || createData?.base64 || createData?.code;
        if (qr) {
          setQrCodePayload(qr);
          setQrCodeStatus('waiting');
          setQrTimer(120);
          alert(`✓ Instância "${cleanInstance}" criada com sucesso e QR Code pronto para escanear!`);
        } else {
          // Immediately generate QR code with polling
          await handleGenerateQr();
        }
      } else {
        const detail = Array.isArray(createData?.response?.message) ? createData.response.message.join(', ') : (createData?.message || createText);
        throw new Error(`Erro ao criar instância (${createRes.status}): ${detail}`);
      }
    } catch (e: any) {
      alert(`Falha: ${e.message}`);
      setQrError(e.message);
    } finally {
      setCreatingInstanceManual(false);
    }
  };

  const connectDirectViaRenderEvolution = async (pairingPhone?: string) => {
    const { url: cleanUrl, instance: cleanInst, token: cleanTok } = getEffectiveEvolutionCreds();

    // 1. Check current state
    try {
      const stateRes = await fetch(`${cleanUrl}/instance/connectionState/${cleanInst}`, {
        headers: { apikey: cleanTok }
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const st = stateData?.instance?.state || stateData?.state;
        if (st === 'open' || st === 'CONNECTED') {
          directEvolutionSetupWebhook().catch(() => {});
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          loadDiagnostic();
          return;
        }
      }
    } catch (_) {}

    // 2. Ensure instance exists
    try {
      await fetch(`${cleanUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cleanTok },
        body: JSON.stringify({
          instanceName: cleanInst,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
    } catch (_) {}

    // 3. Request QR Code / Pairing Code directly from Render (with auto-recovery if stale session returns count:0)
    const cleanPhone = (pairingPhone || '').replace(/\D/g, '');
    const querySuffix = cleanPhone.length >= 10 ? `?number=${cleanPhone}` : '';
    let qrFound: string | null = null;
    let pairingFound: string | null = null;
    let lastData: any = null;

    const tryPollConnect = async (maxTries: number) => {
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        const connRes = await fetch(`${cleanUrl}/instance/connect/${cleanInst}${querySuffix}`, {
          headers: { apikey: cleanTok }
        });
        const data = await connRes.json();
        lastData = data;
        if (data?.status === 'open' || data?.instance?.state === 'open') {
          return 'OPEN' as const;
        }
        if (data?.pairingCode) {
          pairingFound = data.pairingCode;
          return 'FOUND' as const;
        }
        const qr = data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode?.code;
        if (qr) {
          qrFound = qr;
          return 'FOUND' as const;
        }
        if (attempt < maxTries) await new Promise(r => setTimeout(r, 1400));
      }
      return 'EMPTY' as const;
    };

    let activeInst = cleanInst;
    let pollOutcome = await tryPollConnect(2);
    if (pollOutcome === 'EMPTY') {
      // Stale/corrupted Baileys session (401 lock) loops with count:0 -> flush cleanly with short timeouts
      setQrProgressMsg('Sessão anterior travada (401) no Render. Limpando para gerar novo QR Code...');
      try {
        await fetch(`${cleanUrl}/instance/logout/${cleanInst}`, {
          method: 'DELETE',
          headers: { apikey: cleanTok },
          signal: AbortSignal.timeout(5000)
        });
        await new Promise(r => setTimeout(r, 1000));
      } catch (_) {}
      pollOutcome = await tryPollConnect(1);

      if (pollOutcome === 'EMPTY') {
        try {
          await fetch(`${cleanUrl}/instance/delete/${cleanInst}`, {
            method: 'DELETE',
            headers: { apikey: cleanTok },
            signal: AbortSignal.timeout(5000)
          });
          await new Promise(r => setTimeout(r, 1200));
          const recreateRes = await fetch(`${cleanUrl}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: cleanTok },
            body: JSON.stringify({
              instanceName: cleanInst,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS'
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (recreateRes.ok) {
            const recreated = await recreateRes.json();
            const createdQr = recreated?.qrcode?.base64 || recreated?.qrcode?.code || recreated?.base64 || recreated?.code;
            if (createdQr && !querySuffix) {
              qrFound = createdQr;
              pollOutcome = 'FOUND';
            }
          }
        } catch (_) {}

        if (pollOutcome === 'EMPTY') {
          pollOutcome = await tryPollConnect(2);
        }
      }

      // If Evolution v2.3.x refuses to delete/reset the 401-locked instance, auto-provision a clean active instance
      if (pollOutcome === 'EMPTY') {
        const fallbackInst = cleanInst === 'supreme-bot' ? 'supreme-loja' : `${cleanInst.replace(/-v\d+$/, '')}-v2`;
        setQrProgressMsg(`Instância "${cleanInst}" travada no Render. Ativando instância limpa "${fallbackInst}"...`);
        try {
          await fetch(`${cleanUrl}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: cleanTok },
            body: JSON.stringify({
              instanceName: fallbackInst,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS'
            }),
            signal: AbortSignal.timeout(8000)
          }).catch(() => {});

          const fbConn = await fetch(`${cleanUrl}/instance/connect/${fallbackInst}${querySuffix}`, {
            headers: { apikey: cleanTok },
            signal: AbortSignal.timeout(8000)
          });
          if (fbConn.ok) {
            const fbData = await fbConn.json();
            lastData = fbData;
            if (fbData?.status === 'open' || fbData?.instance?.state === 'open') {
              activeInst = fallbackInst;
              pollOutcome = 'OPEN';
            } else if (fbData?.pairingCode) {
              pairingFound = fbData.pairingCode;
              activeInst = fallbackInst;
              pollOutcome = 'FOUND';
            } else {
              const fbQr = fbData?.base64 || fbData?.qrcode?.base64 || fbData?.code || fbData?.qrcode?.code;
              if (fbQr) {
                qrFound = fbQr;
                activeInst = fallbackInst;
                pollOutcome = 'FOUND';
              }
            }
          }
        } catch (_) {}

        if (activeInst !== cleanInst) {
          setEvolutionInstance(activeInst);
          await onUpdateSettings({ whatsappEvolutionInstance: activeInst }).catch(() => {});
        }
      }
    }

    if (pollOutcome === 'OPEN') {
      directEvolutionSetupWebhook(activeInst).catch(() => {});
      setQrCodeStatus('connected');
      localStorage.setItem('whatsapp_qr_status', 'connected');
      loadDiagnostic();
      return;
    }

    // Configure Vercel webhook on Render automatically so messages reply 24/7 once scanned
    directEvolutionSetupWebhook(activeInst).catch(() => {});

    if (pairingFound) {
      setPairingCodeResult(pairingFound);
      setQrCodePayload('');
      setQrCodeStatus('waiting');
      setQrTimer(120);
      return;
    }
    if (qrFound) {
      setPairingCodeResult(null);
      setQrCodePayload(qrFound);
      setQrCodeStatus('waiting');
      setQrTimer(120);
      return;
    }
    throw new Error(lastData?.message || 'Não foi possível gerar o QR Code no servidor Render. Tente clicar em "Recriar Instância Limpa" ou aguarde 20s.');
  };

  // Request 8-digit pairing code directly via Native WhatsApp Web (Baileys) or Render QR on Vercel
  const handleRequestNativePairingCode = async () => {
    setQrError('');
    setRequestingPairingCode(true);
    setPairingCodeResult(null);
    setQrCodeStatus('generating');
    setQrProgressMsg(hasLocalBackend ? 'Gerando código de 8 dígitos direto no WhatsApp...' : 'Conectando ao servidor Render para gerar pareamento...');
    try {
      if (!hasLocalBackend) {
        await connectDirectViaRenderEvolution(pairingCodeInputNumber);
        return;
      }

      await fetch(getApiUrl('/api/bot/sync-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName,
          storeName: storeSettings.name || 'Sorveteria Supreme',
          phone: whatsappPhone,
          welcomeMsg,
          menuLink,
          menuMsg,
          supportMsg,
          address: storeSettings.address || '',
          openHours: `${storeSettings.openTime || '11:00'} às ${storeSettings.closeTime || '23:59'}`
        })
      }).catch(() => {});

      const res = await fetch(getApiUrl('/api/whatsapp/native/pairing-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingCodeInputNumber })
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson) {
        setHasLocalBackend(false);
        await connectDirectViaRenderEvolution(pairingCodeInputNumber);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar código de pareamento');
      }
      if (data.connected) {
        setNativeOwnerJid(data.ownerJid || null);
        setQrCodeStatus('connected');
        localStorage.setItem('whatsapp_qr_status', 'connected');
        return;
      }
      if (data.pairingCode) {
        setPairingCodeResult(data.pairingCode);
        setQrCodePayload('');
        setQrCodeStatus('waiting');
        setQrTimer(120);
        return;
      }
      throw new Error(data.error || 'Código não retornado. Tente gerar o QR Code.');
    } catch (err: any) {
      setQrError(err.message || 'Erro ao solicitar código por número');
      setQrCodeStatus('disconnected');
    } finally {
      setRequestingPairingCode(false);
    }
  };

  // One-click switch from broken Render Evolution API to Direct Native QR Code (or Direct Render QR on Vercel)
  const handleSwitchToNativeAndConnect = async () => {
    setQrError('');
    setPairingCodeResult(null);
    setQrCodeStatus('generating');
    if (!hasLocalBackend) {
      setConnectionProvider('evolution');
      setQrProgressMsg('Conectando ao servidor Render 24h e gerando QR Code...');
      await handleSaveSettings({ whatsappConnectionProvider: 'evolution' });
      try {
        await connectDirectViaRenderEvolution();
      } catch (err: any) {
        setQrError(err.message || 'Erro ao gerar QR Code no Render');
        setQrCodeStatus('disconnected');
      }
      return;
    }

    setConnectionProvider('native');
    setQrProgressMsg('Ativando conexão direta no servidor e gerando QR Code...');
    await handleSaveSettings({ whatsappConnectionProvider: 'native' });
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/native/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFresh: true })
      });
      const data = await res.json();
      if (data.connected) {
        setNativeOwnerJid(data.ownerJid || null);
        setQrCodeStatus('connected');
        localStorage.setItem('whatsapp_qr_status', 'connected');
        loadDiagnostic();
        return;
      }
      if (data.qrCode) {
        setQrCodePayload(data.qrCode);
        setQrCodeStatus('waiting');
        setQrTimer(120);
        return;
      }
      throw new Error(data.error || 'Não foi possível gerar o QR Code direto.');
    } catch (err: any) {
      setQrError(err.message || 'Erro ao gerar QR Code direto');
      setQrCodeStatus('disconnected');
    }
  };

  // Handle generating QR Code trigger
  const handleGenerateQr = async () => {
    setQrError('');
    setPairingCodeResult(null);
    if (!hasLocalBackend && (connectionProvider === 'native' || connectionProvider === 'evolution')) {
      setQrCodeStatus('generating');
      setQrProgressMsg('Conectando ao servidor Render 24h e gerando QR Code...');
      try {
        await connectDirectViaRenderEvolution();
      } catch (err: any) {
        setQrError(err.message || 'Erro ao conectar à Evolution API');
        setQrCodeStatus('disconnected');
      }
      return;
    }

    if (connectionProvider === 'native') {
      setQrCodeStatus('generating');
      setQrProgressMsg('Gerando QR Code oficial direto do WhatsApp Web...');
      try {
        await fetch(getApiUrl('/api/bot/sync-config'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botName,
            storeName: storeSettings.name || 'Sorveteria Supreme',
            phone: whatsappPhone,
            welcomeMsg,
            menuLink,
            menuMsg,
            supportMsg,
            address: storeSettings.address || '',
            openHours: `${storeSettings.openTime || '11:00'} às ${storeSettings.closeTime || '23:59'}`
          })
        }).catch(() => {});

        const res = await fetch(getApiUrl('/api/whatsapp/native/connect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceFresh: true })
        });
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (!isJson) {
          setHasLocalBackend(false);
          setQrProgressMsg('Conectando ao servidor Render 24h e gerando QR Code...');
          await connectDirectViaRenderEvolution();
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erro ao iniciar conexão direta');
        }
        if (data.connected) {
          setNativeOwnerJid(data.ownerJid || null);
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          loadDiagnostic();
          alert('✓ Seu WhatsApp já está conectado e online!');
          return;
        }
        if (data.qrCode) {
          setQrCodePayload(data.qrCode);
          setQrCodeStatus('waiting');
          setQrTimer(120);
          return;
        }
        throw new Error(data.error || 'QR Code não retornado. Tente novamente.');
      } catch (err: any) {
        setQrError(err.message || 'Erro ao gerar QR Code direto');
        setQrCodeStatus('disconnected');
      }
    } else if (connectionProvider === 'simulator') {
      setQrCodeStatus('generating');
      setQrTimer(60);
      setTimeout(() => {
        const payload = `supreme_wa_pairing_code_${whatsappPhone || 'business'}_${Math.random().toString(36).substring(2, 10)}`;
        setQrCodePayload(payload);
        setQrCodeStatus('waiting');
      }, 1200);
    } else if (connectionProvider === 'evolution') {
      setQrCodeStatus('generating');
      setQrProgressMsg('Conectando ao servidor Evolution API...');
      try {
        const { url: cleanUrl, instance: cleanInst, token: cleanTok } = getEffectiveEvolutionCreds();
        const res = await fetch(getApiUrl('/api/evolution/connect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evolutionUrl: cleanUrl,
            evolutionInstance: cleanInst,
            evolutionToken: cleanTok
          })
        });
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (!isJson) {
          setHasLocalBackend(false);
          await connectDirectViaRenderEvolution();
          return;
        }

        const data = await res.json();

        if (data.connected) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          alert('✓ Seu WhatsApp já está conectado e online no servidor!');
          return;
        }

        if (data.instance && data.instance !== cleanInst) {
          setEvolutionInstance(data.instance);
          await onUpdateSettings({ whatsappEvolutionInstance: data.instance }).catch(() => {});
        }

        if (data.qrCode) {
          setQrCodePayload(data.qrCode);
          setQrCodeStatus('waiting');
          setQrTimer(120);
          return;
        }

        throw new Error(data.message || data.error || 'Nenhum QR Code retornado pelo servidor.');
      } catch (err: any) {
        setQrError(err.message || 'Erro ao conectar à Evolution API');
        setQrCodeStatus('disconnected');
      }
    } else if (connectionProvider === 'zapi') {
      setQrCodeStatus('generating');
      try {
        if (!zapiInstanceId || !zapiToken) {
          throw new Error('Preencha os campos da Z-API (ID e Token) na aba de Ajustes!');
        }
        const res = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/qr-code`);
        const data = await res.json();
        if (data.connected === true) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
        } else if (data.value || data.image) {
          setQrCodePayload(data.value || data.image);
          setQrCodeStatus('waiting');
          setQrTimer(60);
        } else {
          throw new Error('Z-API não retornou QR Code.');
        }
      } catch (err: any) {
        setQrError(err.message || 'Erro ao conectar à Z-API');
        setQrCodeStatus('disconnected');
      }
    } else if (connectionProvider === 'wppconnect') {
      setQrCodeStatus('generating');
      try {
        if (!wppconnectUrl || !wppconnectInstance || !wppconnectToken) {
          throw new Error('Preencha os campos do WPPConnect na aba de Ajustes!');
        }
        const cleanUrl = wppconnectUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/${wppconnectInstance}/start-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wppconnectToken}`
          }
        });
        const data = await res.json();
        if (data.status === 'CONNECTED') {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
        } else if (data.qrcode || data.code) {
          setQrCodePayload(data.qrcode || data.code);
          setQrCodeStatus('waiting');
          setQrTimer(120);
        } else {
          throw new Error('WPPConnect não retornou QR Code.');
        }
      } catch (err: any) {
        setQrError(err.message || 'Erro ao conectar ao WPPConnect');
        setQrCodeStatus('disconnected');
      }
    }
  };

  const handleSimulateScan = () => {
    setQrCodeStatus('connecting');
    setTimeout(() => {
      setQrCodeStatus('connected');
      localStorage.setItem('whatsapp_qr_status', 'connected');
    }, 1500);
  };

  const handleForceFreshQrReset = async () => {
    setQrError('');
    setPairingCodeResult(null);
    setQrCodePayload('');
    setQrCodeStatus('generating');
    setActiveTab('config');
    setQrProgressMsg('Encerrando sessão fantasma e gerando novo QR Code limpo...');

    try {
      if (hasLocalBackend && connectionProvider === 'native') {
        await fetch(getApiUrl('/api/whatsapp/native/disconnect'), { method: 'POST' }).catch(() => {});
        setNativeOwnerJid(null);
        localStorage.removeItem('whatsapp_qr_status');
        await handleGenerateQr();
        return;
      }

      const { url, instance, token } = getEffectiveEvolutionCreds();
      await fetch(`${url}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { apikey: token },
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
      await fetch(`${url}/instance/delete/${instance}`, {
        method: 'DELETE',
        headers: { apikey: token },
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});

      setNativeOwnerJid(null);
      localStorage.removeItem('whatsapp_qr_status');
      await new Promise(r => setTimeout(r, 1200));

      if (hasLocalBackend) {
        await handleGenerateQr();
      } else {
        await connectDirectViaRenderEvolution();
      }
      loadDiagnostic();
    } catch (err: any) {
      setQrError(err?.message || 'Erro ao forçar novo QR Code');
      setQrCodeStatus('disconnected');
    }
  };

  const handleDisconnectQr = async () => {
    if (hasLocalBackend && connectionProvider === 'native') {
      await fetch(getApiUrl('/api/whatsapp/native/disconnect'), { method: 'POST' }).catch(() => {});
      setNativeOwnerJid(null);
      setPairingCodeResult(null);
    } else if (!hasLocalBackend || connectionProvider === 'evolution') {
      const { url, instance, token } = getEffectiveEvolutionCreds();
      await fetch(`${url}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { apikey: token },
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
      setNativeOwnerJid(null);
    }
    setQrCodeStatus('disconnected');
    setQrCodePayload('');
    localStorage.removeItem('whatsapp_qr_status');
    loadDiagnostic();
  };

  const simulateBotResponse = (userText: string) => {
    setIsTyping(true);
    setTimeout(() => {
      let responseText = '';
      const cleanText = userText.toLowerCase().trim();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (cleanText === '1' || cleanText.includes('cardapio') || cleanText.includes('fazer pedido') || cleanText.includes('cardápio')) {
        const topItems = menuItems.slice(0, 3).map(it => `• *${it.name}* - _R$ ${it.price.toFixed(2)}_`).join('\n');
        let rawMessage = menuMsg || '';
        let processed = rawMessage.replace('{menu_link}', menuLink).replace('[LINK_CARDAPIO]', menuLink);
        if (!processed.includes(topItems) && processed.includes('🔥 *Mais Pedidos de Hoje:*')) {
          processed = `${processed}\n${topItems}\n\nDigite outra opção ou envie sua dúvida!`;
        }
        responseText = processed;
      } 
      else if (cleanText === '2' || cleanText.includes('rastrear') || cleanText.includes('status') || cleanText.includes('pedido')) {
        const sortedOrders = [...orders].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
        const latestOrder = sortedOrders[0];

        if (latestOrder) {
          const shortId = latestOrder.id.slice(-6).toUpperCase();
          const statusText = latestOrder.status === 'waiting' ? 'Aguardando na Fila ⏳'
                           : latestOrder.status === 'preparing' ? 'Sendo Montado com Carinho! 🥣'
                           : latestOrder.status === 'delivering' ? 'Em Rota com o Motoboy! 🛵'
                           : 'Deliciosamente Entregue! 🎉';
          
          responseText = `🔍 *LOCALIZADOR DE PEDIDOS ATIVOS*\n\nEncontrei o seu pedido mais recente em nosso painel:\n\n📦 *Pedido:* #${shortId}\n👤 *Cliente:* ${latestOrder.details?.customerName || 'Cliente'}\n📅 *Status:* ${statusText}\n💰 *Valor:* R$ ${latestOrder.total.toFixed(2)}\n\nAcompanhe em tempo real pelo link interativo:\n👉 ${getClientBaseUrl()}?track=${latestOrder.id}\n\nPrecisa de alterações? Digite *4* para falar com o caixa.`;
        } else {
          responseText = `🔍 *RASTREADOR DE PEDIDO*\n\nVocê ainda não possui pedidos registrados neste navegador hoje.\n\nPara fazer seu primeiro pedido, acesse nosso site:\n👉 *${getClientBaseUrl()}*\n\nCaso já tenha enviado, digite o código do pedido de 6 dígitos que retornaremos o status!`;
        }
      } 
      else if (cleanText === '3' || cleanText.includes('localizacao') || cleanText.includes('endereço') || cleanText.includes('horario')) {
        responseText = `📍 *LOCALIZAÇÃO & INFORMAÇÕES*\n\n🏠 *Endereço:* ${storeSettings.address || 'Rua Principal do Açaí, 100'}\n🏙️ *Cidade:* ${storeSettings.city || 'Monte Mor/SP'}\n\n⏰ *Horário de Funcionamento:* ${storeSettings.openTime || '11:00'} às ${storeSettings.closeTime || '23:59'}\n\n💬 *Telefone Comercial:* ${storeSettings.phone || whatsappPhone || 'Gourmet'}\n\nVenha nos visitar ou peça para entrega rápida com todo capricho!`;
      } 
      else if (cleanText === '4' || cleanText.includes('atendente') || cleanText.includes('humano') || cleanText.includes('ajuda')) {
        let rawMessage = supportMsg || '';
        responseText = rawMessage.replace('{telefone}', storeSettings.phone || whatsappPhone).replace('[TELEFONE]', storeSettings.phone || whatsappPhone);
        setBellAlertActive(true);
      } 
      else {
        const hasIdMatch = orders.find(o => o.id.toLowerCase().includes(cleanText) || o.id.toUpperCase().slice(-6).includes(userText.toUpperCase()));
        if (hasIdMatch) {
          const shortId = hasIdMatch.id.slice(-6).toUpperCase();
          const statusText = hasIdMatch.status === 'waiting' ? 'Aguardando na Fila ⏳'
                           : hasIdMatch.status === 'preparing' ? 'Sendo Montado com Carinho! 🥣'
                           : hasIdMatch.status === 'delivering' ? 'Em Rota com o Motoboy! 🛵'
                           : 'Deliciosamente Entregue! 🎉';
          
          responseText = `✨ *STATUS DO PEDIDO #${shortId}* ✨\n\nEncontrei suas informações no banco de dados Firestore:\n\n👤 *Cliente:* ${hasIdMatch.details?.customerName}\n💰 *Total:* R$ ${hasIdMatch.total.toFixed(2)}\n🚚 *Método:* ${hasIdMatch.details?.deliveryType === 'delivery' ? 'Entrega em Casa' : 'Retirada no Balcão'}\n🚨 *Status:* ${statusText}\n\nLink do rastreador completo:\n👉 ${getClientBaseUrl()}?track=${hasIdMatch.id}`;
        } else {
          responseText = `💡 *${botName}:* Não entendi esta mensagem.\n\nPor favor, digite uma das opções abaixo:\n\n*1* - Ver Cardápio & Fazer Pedido 🥣\n*2* - Rastrear Pedido Ativo 🛵\n*3* - Localização e Horários 📍\n*4* - Falar com Atendente Humano 💬`;
        }
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: responseText,
          time: timeStr,
          status: 'read'
        }
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        time: timeStr,
        status: 'sent'
      }
    ]);

    setTimeout(() => {
      setChatMessages(prev => prev.map(m => m.sender === 'user' ? { ...m, status: 'delivered' } : m));
    }, 300);

    setTimeout(() => {
      setChatMessages(prev => prev.map(m => m.sender === 'user' ? { ...m, status: 'read' } : m));
      simulateBotResponse(textToSend);
    }, 700);
  };

  const isRunning = botEnabled && qrCodeStatus === 'connected';

  return (
    <div id="admin-whatsapp-bot" className="relative bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden text-left font-sans flex flex-col min-h-[580px]">
      
      {/* Visual Chime/Bell Notification Overlay */}
      <AnimatePresence>
        {bellAlertActive && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] sm:w-[480px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-2xl p-4 shadow-[0_10px_35px_-5px_rgba(230,120,40,0.5)] border border-amber-400 flex items-center justify-between gap-4 mt-16"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/25 text-xl relative overflow-hidden">
                <Bell className="w-5.5 h-5.5 text-white animate-bounce" />
                <span className="absolute inset-0 bg-white/10 rounded-full animate-ping" />
              </div>
              <div className="text-left">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-amber-100 flex items-center gap-1">
                  🛎️ Campainha do Balcão Ativada!
                </h5>
                <p className="text-xs font-extrabold font-sans leading-relaxed text-white">
                  O cliente selecionou a *Opção 4* e solicitou contato humano!
                </p>
                <span className="text-[9px] bg-black/15 px-1.5 py-0.5 rounded font-bold text-amber-50">
                  Som de Notificação tocado no navegador 🔊
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setBellAlertActive(false)}
              className="text-[10px] bg-black/20 hover:bg-black/35 text-white font-black px-3.5 py-2 rounded-xl uppercase transition-all select-none border border-white/10 cursor-pointer"
            >
              Atendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with live status */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-emerald-600/40">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-md shadow-inner relative">
            <Bot className="w-6 h-6 text-emerald-200 animate-pulse" />
            <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-emerald-800 ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider font-display text-white">
                {botName}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                isRunning 
                  ? 'bg-emerald-400/25 text-emerald-200 border border-emerald-300/30' 
                  : 'bg-rose-400/25 text-rose-200 border border-rose-300/30'
              }`}>
                {isRunning ? '🟢 ONLINE & RODANDO' : '🔴 PAUSADO'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-100 font-medium leading-normal mt-0.5">
              Canal: <strong className="text-white uppercase">{connectionProvider}</strong> • Responde Cardápio, Rastreamento e Chamadas de Balcão.
            </p>
          </div>
        </div>

        {/* Action Header Button */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleOneClickRun}
              className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Colocar para Rodar Agora
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePauseBot}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              Pausar Robô
            </button>
          )}
        </div>
      </div>

      {/* Tabs list inside administrator */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('quickrun')}
          className={`flex-1 min-w-[140px] py-3 text-center text-[10.5px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'quickrun'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚡ Colocar para Rodar & Testes
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 min-w-[130px] py-3 text-center text-[10.5px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📱 Simulador de Chat
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 min-w-[140px] py-3 text-center text-[10.5px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'config'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚙️ Conexão & QR Code Real
        </button>
        <button
          onClick={() => setActiveTab('guides')}
          className={`flex-1 min-w-[130px] py-3 text-center text-[10.5px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'guides'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📖 Guia 24h & Como Funciona
        </button>
      </div>

      <div className="p-4 sm:p-6 flex-1 bg-slate-50/30 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* TAB 0: QUICK RUN & DISPATCH TESTER */}
          {activeTab === 'quickrun' && (
            <motion.div
              key="quickrun"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6 max-w-5xl mx-auto"
            >
              {/* Running Status Card */}
              <div className={`p-5 rounded-3xl border transition-all ${
                isRunning 
                  ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border-emerald-200' 
                  : 'bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border-amber-200'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      isRunning ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {isRunning ? <CheckCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6 animate-pulse" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        {isRunning 
                          ? '✅ O Bot do WhatsApp está Ativo e Rodando!' 
                          : '⚠️ O Bot do WhatsApp está Pausado ou Desconectado'}
                      </h4>
                      <p className="text-[11.5px] text-slate-600 leading-relaxed font-medium mt-0.5">
                        {isRunning 
                          ? `Canal Ativo: ${connectionProvider.toUpperCase()} • Respondendo clientes, links de pedidos e alertas sonoros do balcão.`
                          : 'Clique no botão abaixo para ativar a execução imediata do robô na sua sorveteria!'}
                      </p>
                    </div>
                  </div>

                  {!isRunning ? (
                    <button
                      type="button"
                      onClick={handleOneClickRun}
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Colocar para Rodar Agora
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('simulator')}
                        className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-[11px] uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        Abrir Simulador
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('config')}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Conectar Aparelho Real
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Automatic Customer Welcome & Menu Auto-Reply Card */}
              <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl border border-emerald-700/60 shadow-md space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
                        🤖 Resposta Automática 24h: Boas-Vindas & Menu
                      </h4>
                      <p className="text-[11px] text-emerald-200/90 font-medium">
                        Quando o cliente manda qualquer mensagem no WhatsApp, ele recebe as boas-vindas e as opções instantaneamente!
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckWebhookStatus}
                      disabled={checkingWebhookStatus}
                      className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/15 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Verifica se o Webhook está ativo na Evolution API"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingWebhookStatus ? 'animate-spin' : ''}`} />
                      {checkingWebhookStatus ? 'Verificando...' : '🔍 Checar Status'}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestLiveWebhookEndpoint}
                      disabled={testingLiveWebhook}
                      className="px-3.5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-cyan-400/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Dispara um 'oi' simulado direto no Webhook para testar a entrega real no WhatsApp"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingLiveWebhook ? 'animate-pulse' : ''}`} />
                      {testingLiveWebhook ? 'Testando...' : '🧪 Testar Webhook Real'}
                    </button>
                    <button
                      type="button"
                      onClick={handleActivateWebhookAutoBot}
                      disabled={activatingWebhook}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                    >
                      <Zap className={`w-4 h-4 fill-current ${activatingWebhook ? 'animate-spin' : ''}`} />
                      {activatingWebhook ? 'Ativando Webhook...' : '⚡ Ativar Robô no WhatsApp'}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl px-3.5 py-2.5 text-[11px] text-amber-100 leading-relaxed">
                  <strong>Dica importante para testar:</strong> envie <strong>"oi"</strong> a partir de <strong>outro número de celular</strong> (um segundo WhatsApp). Mensagens enviadas pelo próprio celular conectado podem ser marcadas pelo WhatsApp como <code>fromMe</code> e aparecem nos logs em tempo real abaixo.
                </div>

                {webhookActiveResult && (
                  <div className={`p-3.5 rounded-2xl text-xs border ${
                    webhookActiveResult.success
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-150'
                  }`}>
                    <div className="font-extrabold flex items-center gap-1.5 mb-0.5">
                      {webhookActiveResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <AlertCircle className="w-4 h-4 text-rose-300" />}
                      {webhookActiveResult.message}
                    </div>
                    {webhookActiveResult.url && (
                      <p className="text-[10px] text-emerald-200/80 font-mono mt-1">
                        Endpoint ativo: {webhookActiveResult.url}
                      </p>
                    )}
                  </div>
                )}

                {/* Explanatory Flow */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-[9.5px] font-black uppercase text-emerald-400 block mb-1">Passo 1: Cliente Escreve</span>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      O cliente envia "Oi", "Boa tarde" ou qualquer dúvida para o seu WhatsApp.
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-[9.5px] font-black uppercase text-teal-300 block mb-1">Passo 2: Boas-Vindas</span>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      O robô envia a saudação oficial + as 4 opções numeradas na hora.
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-[9.5px] font-black uppercase text-cyan-300 block mb-1">Passo 3: Cliente Escolhe</span>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      O cliente responde 1 (Cardápio), 2 (Rastrear), 3 (Horários) ou 4 (Atendente).
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-[9.5px] font-black uppercase text-amber-300 block mb-1">Passo 4: Execução</span>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      O link do cardápio ou rastreio é entregue, ou toca a campainha física!
                    </p>
                  </div>
                </div>

                {/* Live Simulation Tester Box */}
                <div className="bg-black/30 p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Testar Resposta Automática (Simular Mensagem do Cliente)
                    </span>
                    <span className="text-[9px] text-slate-400">Sem gastar créditos ou enviar para celular</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={testCustomerText}
                      onChange={(e) => setTestCustomerText(e.target.value)}
                      placeholder="Ex: Olá, quero ver o cardápio"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold text-white placeholder-slate-400 outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleSimulateCustomerMessage()}
                      disabled={simulatingCustomerMsg || !testCustomerText.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                    >
                      {simulatingCustomerMsg ? 'Processando...' : 'Testar Resposta'}
                    </button>
                  </div>

                  {/* Quick option buttons for testing */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase mr-1">Atalhos de Teste:</span>
                    {[
                      { label: '"Oi"', text: 'Oi, tudo bem?' },
                      { label: '"1" (Cardápio)', text: '1' },
                      { label: '"2" (Rastrear)', text: '2' },
                      { label: '"3" (Horários)', text: '3' },
                      { label: '"4" (Atendente)', text: '4' }
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          setTestCustomerText(btn.text);
                          handleSimulateCustomerMessage(btn.text);
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-semibold rounded-lg border border-white/10 cursor-pointer transition-all"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Simulated Reply Preview */}
                  {simulatedReply && (
                    <div className="mt-3 p-3.5 bg-[#005c4b]/80 border border-emerald-500/40 rounded-xl text-left">
                      <div className="text-[9.5px] font-black uppercase text-emerald-200 mb-1 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                        O que o cliente receberá no WhatsApp:
                      </div>
                      <p className="text-xs text-white whitespace-pre-wrap font-sans leading-relaxed">
                        {simulatedReply}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid: Live Message Dispatch Tester + Console Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left column: Live Dispatch Form */}
                <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-150 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4.5 h-4.5 text-amber-500" />
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        🧪 Testar Disparo Real de Mensagem
                      </h4>
                    </div>
                    <span className="text-[9.5px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Canal: {connectionProvider}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Envie uma mensagem instantânea para o seu próprio WhatsApp para verificar a formatação, links e resposta automática do robô.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-600 mb-1">
                        Número de Telefone Destino (com DDD e Código do País 55)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="Ex: 5519998765432"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-800 focus:border-emerald-500"
                        />
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-semibold mt-1 block">
                        Exemplo Monte Mor / Campinas: 5519987654321
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-600 mb-1.5">
                        Modelo de Mensagem para Teste
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'welcome', label: '👋 Boas-Vindas Padrão' },
                          { id: 'menu', label: '🥣 Cardápio Digital Completo' },
                          { id: 'status', label: '📦 Atualização de Pedido' },
                          { id: 'custom', label: '✏️ Texto Personalizado' }
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => setTestTemplate(tpl.id as any)}
                            className={`p-2.5 rounded-xl text-[10.5px] font-black text-left transition-all border cursor-pointer ${
                              testTemplate === tpl.id 
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {testTemplate === 'custom' && (
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wide text-slate-600 mb-1">
                          Mensagem Personalizada
                        </label>
                        <textarea
                          rows={3}
                          value={testCustomMessage}
                          onChange={(e) => setTestCustomMessage(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-800 focus:border-emerald-500"
                        />
                      </div>
                    )}

                    {/* Preview box */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Prévia da mensagem que será enviada:
                      </span>
                      <p className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                        {getTestMessageText()}
                      </p>
                    </div>

                    {/* Inline Dispatch Feedback */}
                    {dispatchFeedback && (
                      <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                        dispatchFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {dispatchFeedback.type === 'success'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{dispatchFeedback.message}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleSendTestMessage}
                        disabled={testDispatchLoading}
                        className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                      >
                        {testDispatchLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Disparando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Disparar via Gateway ({connectionProvider})
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenDirectWhatsApp}
                        className="py-3 bg-slate-850 hover:bg-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        title="Abre o WhatsApp no seu navegador ou celular com essa mensagem pronta"
                      >
                        <ExternalLink className="w-4 h-4 text-emerald-400" />
                        Abrir no Meu WhatsApp
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleTestWebhook}
                        className="text-[10.5px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5 text-amber-500" />
                        Testar Webhook (Simular Pedido Firestore)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBellAlertActive(true);
                        }}
                        className="text-[10.5px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Testar Campainha 🔔
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right column: Execution Logs & Status */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-900 text-slate-100 p-5 rounded-3xl border border-slate-800 shadow-sm flex flex-col h-full min-h-[380px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                          Console de Execução em Tempo Real
                        </h5>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[11px] pr-1 max-h-[320px]">
                      {serverLogs.map((slog) => (
                        <div
                          key={slog.id}
                          className={`p-2.5 rounded-xl border leading-relaxed ${
                            slog.status === 'error'
                              ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                              : 'bg-teal-950/40 border-teal-800/50 text-teal-200'
                          }`}
                        >
                          <div className="text-[9px] text-slate-400 font-bold mb-0.5">
                            [{slog.timestamp}] +{slog.from} • {slog.status === 'error' ? 'ERRO' : 'WHATSAPP'}
                          </div>
                          <div className="font-sans text-[11px]">
                            <strong>{slog.incomingText}:</strong> {slog.details || slog.replyText.slice(0, 120)}
                          </div>
                        </div>
                      ))}
                      {testLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-2.5 rounded-xl border leading-relaxed ${
                            log.type === 'success'
                              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                              : log.type === 'error'
                              ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                              : 'bg-slate-800/60 border-slate-700/50 text-slate-300'
                          }`}
                        >
                          <div className="text-[9px] text-slate-400 font-bold mb-0.5">[{log.time}]</div>
                          <div>{log.text}</div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                      <span>Provedor: {connectionProvider.toUpperCase()}</span>
                      <button
                        type="button"
                        onClick={() => setTestLogs([])}
                        className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                      >
                        Limpar Console
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 1: SIMULATOR */}
          {activeTab === 'simulator' && (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-2xl">
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Simulação Interativa Sincronizada
                  </h4>
                  <p className="text-xs text-emerald-900 leading-relaxed font-semibold">
                    Teste as mensagens automáticas que seus clientes receberão no WhatsApp!
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-normal mt-2">
                    Digite perguntas reais sobre o cardápio ou digite códigos de pedidos de teste do painel para ver como o bot consulta dados Firestore em tempo real!
                  </p>
                </div>

                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ações de Resposta Rápida</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '👋 Enviar Oi', text: 'Olá!' },
                      { label: '🥣 Pedir Cardápio', text: 'Quero fazer um pedido' },
                      { label: '🛵 Rastrear Pedido', text: 'Rastrear meu pedido ativo' },
                      { label: '💬 Falar com Atendente', text: 'Quero falar com atendente humano' }
                    ].map((btn, index) => (
                      <button
                        key={index}
                        onClick={() => setInputText(btn.text)}
                        className="p-2 sm:p-2.5 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/25 rounded-xl text-[10.5px] font-black text-slate-700 text-left transition-all active:scale-97 cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setBellAlertActive(true)}
                      className="p-2 sm:p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-[10.5px] font-black text-center transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5 col-span-2 shadow-sm border-b-2 border-orange-600 select-none"
                    >
                      🛎️ Testar Campainha de Chamada (Som 🔊)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50">
                  <h4 className="text-xs font-black text-slate-850 uppercase mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-slate-500" /> Dicas de Funcionamento
                  </h4>
                  <ul className="text-[11px] text-slate-600 space-y-1.5 font-bold">
                    <li className="flex items-start gap-1"><span className="text-emerald-500">✔</span> Opção 1 envia o link direto do cardápio digital Supreme.</li>
                    <li className="flex items-start gap-1"><span className="text-emerald-500">✔</span> Opção 2 consulta o último pedido feito no banco Firestore.</li>
                    <li className="flex items-start gap-1"><span className="text-emerald-500">✔</span> Opção 4 toca a campainha acústica de balcão e exibe o alerta visual!</li>
                  </ul>
                </div>
              </div>

              {/* Chat Simulator Visual Block */}
              <div className="lg:col-span-7">
                <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-[#e5ddd5] flex flex-col h-[490px]">
                  
                  {/* Whatsapp Chat Header */}
                  <div className="bg-[#075e54] p-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-200/80 text-[#075e54] flex items-center justify-center font-bold text-sm shadow-inner relative">
                        🍨
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#075e54] rounded-full" />
                      </div>
                      <div>
                        <p className="text-xs font-black tracking-wide">{botName}</p>
                        <p className="text-[9.5px] text-emerald-100">online e respondendo instantaneamente</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-black tracking-wider text-[8.5px] uppercase border border-white/5">Bot</span>
                    </div>
                  </div>

                  {/* Messaging Feed Screen */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-opacity-40">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-xs text-xs relative leading-relaxed font-medium whitespace-pre-wrap ${
                          msg.sender === 'user'
                            ? 'bg-[#dcf8c6] text-slate-900 self-end rounded-tr-none'
                            : 'bg-white text-slate-900 self-start rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                        <div className="flex items-center justify-end gap-1 text-[8px] text-slate-450 mt-1.5 text-right select-none">
                          <span>{msg.time}</span>
                          {msg.sender === 'user' && (
                            <span>
                              {msg.status === 'sent' && <Check className="w-3 h-3 text-slate-400" />}
                              {msg.status === 'delivered' && <CheckCheck className="w-3 h-3 text-slate-400" />}
                              {msg.status === 'read' && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="bg-white text-slate-900 self-start rounded-2xl rounded-tl-none px-3 py-2 shadow-xs max-w-[85%] flex items-center gap-1.5">
                        <span className="text-[10px] text-emerald-600 font-extrabold animate-pulse">digitando resposta...</span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendMessage} className="bg-[#f0f0f0] p-2.5 border-t border-slate-200 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Mande uma mensagem para o bot..."
                      className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-semibold rounded-2xl text-slate-850 placeholder-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="w-10 h-10 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-400 cursor-pointer"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CONFIG & REAL QR CODE */}
          {activeTab === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto items-start"
            >
              {/* Left Column: Basic Connection Settings and Custom Messages */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4.5 h-4.5 text-emerald-600" />
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Ajustes Básicos de Integração</h4>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status do Bot</span>
                      <input
                        type="checkbox"
                        checked={botEnabled}
                        onChange={(e) => setBotEnabled(e.target.checked)}
                        className="w-4 h-4 text-emerald-600"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-150/80">
                    <label className="block text-[10.5px] font-black uppercase tracking-wide text-slate-700 flex items-center gap-1">
                      <span>⚡ Canal de Conexão WhatsApp</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">Real / Produção</span>
                    </label>
                    <select
                      value={connectionProvider}
                      onChange={(e: any) => setConnectionProvider(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none text-xs font-bold text-slate-750 focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="native">⚡ Conexão Direta no Sistema (QR Code Instantâneo — Sem Render)</option>
                      <option value="simulator">Simulador Interativo de Testes (Mock)</option>
                      <option value="evolution">Evolution API (Servidor Externo / Render)</option>
                      <option value="zapi">Z-API Gateway (Profissional Pago)</option>
                      <option value="wppconnect">WPPConnect Server (Custom API)</option>
                    </select>
                    <p className="text-[9.5px] text-slate-500 font-medium leading-relaxed">
                      Use <strong>"Conexão Direta no Sistema"</strong> para gerar o QR Code oficial na hora sem depender do Render, ou selecione <strong>"Evolution API"</strong> / <strong>"Z-API"</strong> / <strong>"WPPConnect"</strong> se preferir usar servidor externo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Nome do Robô / Bot</label>
                      <input
                        type="text"
                        value={botName}
                        onChange={(e) => setBotName(e.target.value)}
                        placeholder="Ex: Supreme Bot 💜"
                        className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-750 focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">WhatsApp Comercial</label>
                      <input
                        type="text"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="Ex: 5515998765432"
                        className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-750 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Provider Settings */}
                  {connectionProvider === 'native' && (
                    <div className="space-y-3 border-l-2 border-emerald-500 pl-3 py-2 bg-emerald-50/40 rounded-r-xl">
                      <h5 className="text-[11px] font-black text-emerald-950 uppercase">Motor WhatsApp Web Integrado</h5>
                      <p className="text-[10.5px] text-emerald-900 font-medium leading-relaxed">
                        Conecta diretamente no WhatsApp sem precisar da Evolution API. Clique em <strong>"Gerar QR Code Oficial"</strong> no painel ao lado para escanear com seu celular e ativar respostas automáticas imediatamente.
                      </p>
                      <div className="space-y-1 pt-1">
                        <label className="block text-[9.5px] font-black uppercase tracking-wide text-emerald-900">
                          URL do Servidor Bot Externo (para conectar na Vercel 24h)
                        </label>
                        <input
                          type="url"
                          value={customBackendUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomBackendUrl(val);
                            if (val.trim()) setHasLocalBackend(true);
                          }}
                          placeholder="Ex: https://sorveteria-supreme-bot.onrender.com (opcional)"
                          className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                        />
                        <p className="text-[9px] text-emerald-800 leading-tight font-medium">
                          Deixe em branco no Google AI Studio. Se usar pelo site Vercel, publique este projeto no Render (<code className="bg-emerald-100 px-1 rounded">npm start</code>) e cole a URL acima para usar este mesmo motor na Vercel.
                        </p>
                      </div>
                    </div>
                  )}

                  {connectionProvider === 'simulator' && (
                    <>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">URL do Webhook (Gatilho) no n8n / Make</label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://suaprimeiraurln8n.com/webhooks/whatsapp"
                          className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {connectionProvider === 'evolution' && (
                    <div className="space-y-4 border-l-2 border-emerald-500 pl-3 py-1 bg-emerald-50/20 rounded-r-xl">
                      <h5 className="text-[11px] font-black text-emerald-950 uppercase">Configuração da Evolution API</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">URL Base do Servidor (API URL)</label>
                          <input
                            type="url"
                            value={evolutionUrl}
                            onChange={(e) => setEvolutionUrl(e.target.value)}
                            placeholder="Ex: https://api.evolution-api.com"
                            className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Nome da Instância</label>
                            <input
                              type="text"
                              value={evolutionInstance}
                              onChange={(e) => setEvolutionInstance(e.target.value)}
                              placeholder="Ex: supreme-bot"
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-750 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Token Global / Api Key</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setEvolutionToken('Rmfa1100@');
                                }}
                                className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                title="Preenche sua chave configurada no Render"
                              >
                                Usar Minha Chave (Rmfa1100@)
                              </button>
                            </div>
                            <input
                              type="password"
                              value={evolutionToken}
                              onChange={(e) => setEvolutionToken(e.target.value)}
                              placeholder="Rmfa1100@"
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                            />
                            <p className="text-[9px] text-slate-500 mt-1 leading-tight">
                              Chave definida na variável <code className="bg-slate-150 px-1 rounded">AUTHENTICATION_API_KEY</code> do seu Render.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {connectionProvider === 'zapi' && (
                    <div className="space-y-4 border-l-2 border-blue-500 pl-3 py-1 bg-blue-50/20 rounded-r-xl">
                      <h5 className="text-[11px] font-black text-blue-950 uppercase">Configuração do Gateway Z-API</h5>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">ID da Instância (Instance ID)</label>
                            <input
                              type="text"
                              value={zapiInstanceId}
                              onChange={(e) => setZapiInstanceId(e.target.value)}
                              placeholder="Ex: 3B8C19D836..."
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Token da Instância (Security Token)</label>
                            <input
                              type="password"
                              value={zapiToken}
                              onChange={(e) => setZapiToken(e.target.value)}
                              placeholder="Insira o Token..."
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {connectionProvider === 'wppconnect' && (
                    <div className="space-y-4 border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-50/20 rounded-r-xl">
                      <h5 className="text-[11px] font-black text-indigo-950 uppercase">Configuração do WPPConnect Server</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">URL do Servidor WPPConnect</label>
                          <input
                            type="url"
                            value={wppconnectUrl}
                            onChange={(e) => setWppconnectUrl(e.target.value)}
                            placeholder="Ex: https://meuwppconnect.com"
                            className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-indigo-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Nome da Instância / Session</label>
                            <input
                              type="text"
                              value={wppconnectInstance}
                              onChange={(e) => setWppconnectInstance(e.target.value)}
                              placeholder="Ex: sessao-supreme"
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-750 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Token JWT de Autenticação</label>
                            <input
                              type="password"
                              value={wppconnectToken}
                              onChange={(e) => setWppconnectToken(e.target.value)}
                              placeholder="Insira o Token JWT..."
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      Criptografia SSL de Ponta a Ponta ativa.
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleSaveSettings()}
                      disabled={saving}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:opacity-50 active:scale-97 transition-all flex items-center gap-1.5"
                    >
                      {saving ? 'Gravando...' : saveSuccess ? '✓ Gravado com Sucesso!' : 'Salvar Configurações'}
                    </button>
                  </div>
                </div>

                {/* Customizable Bot Messages */}
                <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <MessageSquare className="w-4.5 h-4.5 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Mensagens Personalizadas do Assistente</h4>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      1. Mensagem de Boas-Vindas
                    </label>
                    <textarea
                      rows={4}
                      value={welcomeMsg}
                      onChange={(e) => setWelcomeMsg(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-750 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Link do Cardápio Digital ({`{menu_link}`})
                    </label>
                    <input
                      type="text"
                      placeholder="https://sorveteriasupreme.vercel.app"
                      value={menuLink}
                      onChange={(e) => setMenuLink(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-750 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      2. Resposta de Visualização de Cardápio (Opção 1)
                    </label>
                    <textarea
                      rows={3}
                      value={menuMsg}
                      onChange={(e) => setMenuMsg(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-750 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      3. Resposta de Atendimento / Suporte Humano (Opção 4)
                    </label>
                    <textarea
                      rows={3}
                      value={supportMsg}
                      onChange={(e) => setSupportMsg(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-750 focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveSettings()}
                      disabled={saving}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:opacity-50 active:scale-97 transition-all flex items-center gap-1.5"
                    >
                      {saving ? 'Gravando...' : saveSuccess ? '✓ Gravado com Sucesso!' : 'Salvar Mensagens do Bot'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: QR Code Pairing */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-xs space-y-5 text-center">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-center">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">🔗 Vincular Aparelho WhatsApp</h4>
                  </div>

                  {/* Live Diagnostic Status Bar */}
                  {(connectionProvider === 'evolution' || connectionProvider === 'native') && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Status em Tempo Real:</span>
                        <button
                          type="button"
                          onClick={loadDiagnostic}
                          disabled={loadingDiagnostic}
                          className="text-[9px] font-black uppercase text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingDiagnostic ? 'animate-spin' : ''}`} />
                          Atualizar
                        </button>
                      </div>

                      {hasLocalBackend && connectionProvider === 'native' ? (
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                          <div className="p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                            <span className="text-slate-500">Motor Direto:</span>
                            <span className="text-emerald-600">Online ✅</span>
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                            <span className="text-slate-500">Auto-Resposta:</span>
                            <span className="text-emerald-600">Ativa ✅</span>
                          </div>
                          <div className="col-span-2 p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                            <span className="text-slate-500">Pareamento Celular:</span>
                            <span className={evolutionDiagnostic?.nativeIsPaired || nativeOwnerJid ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>
                              {evolutionDiagnostic?.nativeIsPaired || nativeOwnerJid
                                ? `Pareado (+${nativeOwnerJid || evolutionDiagnostic?.nativeOwnerJid || 'Conectado'}) 🟢`
                                : "Não Pareado (Escaneie o QR Code) 🔴"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                            <div className="p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                              <span className="text-slate-500">Servidor Render:</span>
                              <span className={evolutionDiagnostic?.evolutionOnline ? "text-emerald-600" : "text-amber-600"}>
                                {evolutionDiagnostic?.evolutionOnline
                                  ? `Online (${evolutionDiagnostic.evolutionVersion ? `v${evolutionDiagnostic.evolutionVersion}` : 'Ativo'})`
                                  : "Conectando..."}
                              </span>
                            </div>
                            <div className="p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                              <span className="text-slate-500">Webhook 24h:</span>
                              <span className={evolutionDiagnostic?.webhookActive ? "text-emerald-600" : "text-amber-600"}>
                                {evolutionDiagnostic?.webhookActive ? "Ativo ✅" : "Pendente"}
                              </span>
                            </div>
                            <div className="col-span-2 p-1.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between">
                              <span className="text-slate-500">Pareamento Celular:</span>
                              <span className={evolutionDiagnostic?.isPaired ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>
                                {evolutionDiagnostic?.isPaired ? `Pareado (+${evolutionDiagnostic.ownerJid}) 🟢` : "Não Pareado (Sem Celular Conectado) 🔴"}
                              </span>
                            </div>
                          </div>

                          {!evolutionDiagnostic?.isPaired && evolutionDiagnostic?.evolutionOnline && evolutionDiagnostic?.evolutionVersion?.startsWith('2.1') && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-950 font-semibold leading-relaxed">
                              ⚠️ <strong>Por que escaneia o QR Code e não conclui?</strong> O seu Render está rodando a imagem antiga <strong>Evolution API v{evolutionDiagnostic.evolutionVersion}</strong>, que trava em <em>"Conectando"</em> com o WhatsApp atual. Troque a imagem no Render para <code className="bg-amber-100 px-1 rounded">evoapicloud/evolution-api:latest</code> (ou suba este repositório no Render com <code className="bg-amber-100 px-1 rounded">npm start</code> e cole a URL em Conexão Direta).
                            </div>
                          )}

                          {evolutionDiagnostic?.isPaired ? (
                            <button
                              type="button"
                              onClick={handleForceFreshQrReset}
                              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Celular Desconectado? Forçar Novo QR Code
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSwitchToNativeAndConnect}
                              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              {hasLocalBackend
                                ? '⚡ Conectar Agora com QR Code Direto (Sem Render)'
                                : '⚡ Gerar QR Code Agora no Site (Render + Webhook 24h)'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {qrCodeStatus === 'disconnected' && (
                    <div className="space-y-4 py-2">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-[11px] leading-relaxed text-slate-600 font-semibold space-y-2 text-left">
                        <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[9px] mb-1">Como Funciona:</p>
                        <p>1. No modo <strong>Conexão Direta</strong>, clique em <strong>"Gerar QR Code Oficial"</strong> para escanear com seu WhatsApp (*Aparelhos Conectados*) na hora, sem depender do Render.</p>
                        <p>2. No modo <strong>Evolution API</strong>, o sistema busca o QR Code diretamente do seu servidor Render.</p>
                      </div>

                      {/* Render CONFIG_SESSION_PHONE_VERSION Solution Card */}
                      {connectionProvider === 'evolution' && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-250 p-4 rounded-2xl text-left space-y-2.5 shadow-xs">
                          <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                            <span className="text-base">💡</span>
                            <span>Por que o QR Code retornou vazio no Render?</span>
                          </div>
                          <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                            Se quiser usar o Render (ou prefira clicar no botão verde acima para gerar o QR direto aqui), adicione 1 variável no seu Render:
                          </p>

                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200 text-[10px]">
                              <span className="text-slate-600 font-mono font-bold">CONFIG_SESSION_PHONE_VERSION</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText('CONFIG_SESSION_PHONE_VERSION');
                                  setCopiedVersionVar(true);
                                  setTimeout(() => setCopiedVersionVar(false), 2000);
                                }}
                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-sans font-extrabold text-[9px] uppercase cursor-pointer"
                              >
                                {copiedVersionVar ? '✓ Copiado!' : 'Copiar Nome'}
                              </button>
                            </div>

                            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200 text-[10px]">
                              <span className="text-emerald-700 font-mono font-bold">2.3000.1043857760</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText('2.3000.1043857760');
                                  setCopiedVersionVal(true);
                                  setTimeout(() => setCopiedVersionVal(false), 2000);
                                }}
                                className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md font-sans font-extrabold text-[9px] uppercase cursor-pointer"
                              >
                                {copiedVersionVal ? '✓ Copiado!' : 'Copiar Valor'}
                              </button>
                            </div>
                          </div>

                          <div className="text-[10px] text-amber-800 font-semibold space-y-1 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/80">
                            <p className="font-bold text-amber-950">Passo a passo no Render (1 minuto):</p>
                            <p>1. Acesse o <strong>Render.com</strong> &gt; Clique no seu Web Service <code>supreme-bot-2bm0</code></p>
                            <p>2. Clique na aba <strong>Environment</strong> &gt; <strong>Add Environment Variable</strong></p>
                            <p>3. Cole o Nome e o Valor acima e clique em <strong>Save Changes</strong>.</p>
                            <p>4. Aguarde ~45 segundos para o Render reiniciar e clique em <strong>"Gerar QR Code Oficial"</strong> abaixo!</p>
                          </div>
                        </div>
                      )}

                      {diagnosticResult && (
                        <div className={`p-3.5 rounded-2xl border text-left text-xs ${
                          diagnosticResult.success 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}>
                          <div className="font-black flex items-center gap-1.5 mb-1">
                            {diagnosticResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                            {diagnosticResult.message}
                          </div>
                          {diagnosticResult.details && (
                            <p className="text-[11px] leading-relaxed opacity-90 font-medium">
                              {diagnosticResult.details}
                            </p>
                          )}
                        </div>
                      )}

                      {qrError && (
                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-[10.5px] text-rose-700 font-bold text-left space-y-2">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>⚠️ {qrError}</span>
                          </div>
                          {qrError.includes('CONFIG_VERSION') ? (
                            <div className="space-y-2 pt-1 border-t border-rose-200/50">
                              <p className="text-[10px] text-slate-700 font-medium leading-relaxed">
                                💡 <strong>Dica rápida:</strong> Clique no botão abaixo para usar a <strong>Conexão Direta no Sistema</strong> e escanear o QR Code na hora sem esperar o Render, ou atualize <code>CONFIG_SESSION_PHONE_VERSION</code> = <code>2.3000.1043857760</code> no Render.
                              </p>
                              <button
                                type="button"
                                onClick={handleSwitchToNativeAndConnect}
                                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>⚡ Gerar QR Code Direto Agora (Sem Render)</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setQrCodeStatus('connected');
                                localStorage.setItem('whatsapp_qr_status', 'connected');
                                setQrError('');
                              }}
                              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9.5px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all text-center"
                            >
                              Conectar em Modo Simulado / Teste
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleGenerateQr}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-xs rounded-2xl cursor-pointer shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2 active:scale-98"
                      >
                        <QrCode className="w-4 h-4" />
                        {connectionProvider === 'simulator' ? 'Iniciar Pareamento no Simulador' : 'Gerar QR Code Oficial'}
                      </button>

                      {connectionProvider === 'native' && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2">
                          <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-600">
                            📱 Ou conectar sem câmera (Código de 8 dígitos):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pairingCodeInputNumber}
                              onChange={(e) => setPairingCodeInputNumber(e.target.value)}
                              placeholder="5519999999999"
                              className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white outline-none text-xs font-mono font-bold text-slate-800 focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={handleRequestNativePairingCode}
                              disabled={requestingPairingCode}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl cursor-pointer disabled:opacity-50"
                            >
                              {requestingPairingCode ? 'Gerando...' : 'Gerar Código'}
                            </button>
                          </div>
                        </div>
                      )}

                      {connectionProvider === 'evolution' && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleTestRenderConnection}
                            disabled={testingServer}
                            className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${testingServer ? 'animate-spin' : ''}`} />
                            {testingServer ? 'Testando...' : '🔍 Testar Servidor'}
                          </button>
                          <button
                            type="button"
                            onClick={handleManualCreateInstance}
                            disabled={creatingInstanceManual}
                            className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 text-emerald-600" />
                            {creatingInstanceManual ? 'Criando...' : '🛠️ Recriar Instância'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {qrCodeStatus === 'generating' && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
                        <Bot className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                      </div>
                      <p className="text-xs font-black uppercase text-slate-700 tracking-wider animate-pulse text-center px-4">
                        {qrProgressMsg || 'Consultando Servidor...'}
                      </p>
                    </div>
                  )}

                  {qrCodeStatus === 'waiting' && (
                    <div className="space-y-5 py-2 flex flex-col items-center">
                      {pairingCodeResult ? (
                        <div className="w-full p-5 bg-emerald-50 border-2 border-emerald-200 rounded-3xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Código de Pareamento</span>
                            <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                              {qrTimer}s restante
                            </span>
                          </div>
                          <div className="py-3 px-4 bg-white rounded-2xl border border-emerald-200 text-2xl sm:text-3xl font-mono font-black tracking-[0.2em] text-emerald-950 select-all">
                            {pairingCodeResult}
                          </div>
                          <p className="text-[10.5px] text-emerald-900 font-semibold leading-relaxed text-left">
                            No celular: abra o <strong>WhatsApp</strong> &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar aparelho</strong> &gt; toque em <strong>Conectar com número de telefone</strong> e digite o código acima.
                          </p>
                        </div>
                      ) : (
                        <div className="relative p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                          <img
                            src={qrCodePayload.startsWith('data:image') || qrCodePayload.startsWith('http')
                              ? qrCodePayload
                              : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=075E54&data=${encodeURIComponent(qrCodePayload)}`
                            }
                            alt="WhatsApp QR Code"
                            className="w-48 h-48 sm:w-56 sm:h-56 select-none"
                          />
                          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {qrTimer}s restante
                          </div>
                        </div>
                      )}

                      <div className="w-full pt-2 border-t border-slate-100 space-y-2">
                        {connectionProvider === 'simulator' ? (
                          <button
                            type="button"
                            onClick={handleSimulateScan}
                            className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Simular Leitura pelo Celular
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleCheckRealConnectionStatus}
                            disabled={checkingStatus}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97 disabled:opacity-50"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {checkingStatus ? 'Verificando Conexão...' : 'Já Escaneei (Verificar Conexão)'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setQrCodeStatus('disconnected');
                            setPairingCodeResult(null);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-650 font-bold underline"
                        >
                          Cancelar e Voltar
                        </button>
                      </div>
                    </div>
                  )}

                  {qrCodeStatus === 'connecting' && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
                      <p className="text-xs font-black uppercase text-slate-700 tracking-wider">Validando Sessão...</p>
                    </div>
                  )}

                  {qrCodeStatus === 'connected' && (
                    <div className="space-y-4 py-2">
                      <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 text-xl shadow-inner relative">
                          💬
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>
                        
                        <div className="space-y-1">
                          <h5 className="text-xs font-black uppercase tracking-wider text-emerald-950">Aparelho Conectado!</h5>
                          <p className="text-[10px] text-emerald-800 font-bold">
                            O WhatsApp está online e pronto para responder.
                          </p>
                        </div>
 
                        <div className="w-full pt-3 border-t border-emerald-150 text-left text-[11px] font-semibold text-emerald-900 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Canal:</span>
                            <span className="font-extrabold text-emerald-950 uppercase">{connectionProvider}</span>
                          </div>
                          {(nativeOwnerJid || evolutionDiagnostic?.ownerJid) && (
                            <div className="flex justify-between">
                              <span className="text-emerald-700">Número Conectado:</span>
                              <span className="font-extrabold text-emerald-950">+{nativeOwnerJid || evolutionDiagnostic?.ownerJid}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Status:</span>
                            <span className="font-extrabold text-emerald-950">ONLINE 🟢</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (nativeOwnerJid) setTestPhone(nativeOwnerJid);
                            setActiveTab('quickrun');
                          }}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Testar Envio de Mensagem Agora
                        </button>
                      </div>

                      {connectionProvider !== 'simulator' && (
                        <button
                          type="button"
                          onClick={handleCheckRealConnectionStatus}
                          disabled={checkingStatus}
                          className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                          {checkingStatus ? 'Buscando...' : 'Atualizar Status da Conexão'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleForceFreshQrReset}
                        className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Celular Desconectado? Gerar Novo QR Code
                      </button>

                      <button
                        type="button"
                        onClick={handleDisconnectQr}
                        className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                      >
                        Desconectar Aparelho
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: GUIDES */}
          {activeTab === 'guides' && (
            <motion.div
              key="guides"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6 max-w-4xl mx-auto"
            >
              {/* Highlight Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 rounded-3xl text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                    24 Horas Online na Nuvem ☁️
                  </span>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    Como deixar o WhatsApp Bot respondendo 24h sem precisar de computador ligado?
                  </h4>
                  <p className="text-xs text-emerald-100 font-medium leading-relaxed max-w-2xl">
                    Para responder clientes de madrugada ou quando o computador do caixa estiver desligado, basta conectar seu WhatsApp a um gateway na nuvem. O WhatsApp oficial mantém a sessão ativa 24h por dia!
                  </p>
                </div>
              </div>

              {/* Steps Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Method 1: Z-API */}
                <div className="bg-white p-5 rounded-3xl border-2 border-purple-200 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Recomendado • Mais Rápido
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                        1
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-purple-950">
                          Z-API Gateway (Nuvem Brasileira)
                        </h5>
                        <p className="text-[10.5px] text-purple-800 font-bold">
                          Configurado em 3 minutos • Sem mexer em servidor
                        </p>
                      </div>
                    </div>

                    <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100 text-[11px] text-purple-950 font-medium leading-relaxed space-y-2">
                      <p><strong>Passo 1:</strong> Acesse o site <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" className="text-purple-700 underline font-extrabold">z-api.io</a> e crie uma conta (possui teste grátis).</p>
                      <p><strong>Passo 2:</strong> No painel da Z-API, clique em <strong>"Criar Instância"</strong> (dê o nome de <em>Sorveteria Supreme</em>).</p>
                      <p><strong>Passo 3:</strong> Copie o <strong>ID da Instância</strong> e o <strong>Token de Segurança</strong>.</p>
                      <p><strong>Passo 4:</strong> Cole aqui no painel e clique em <strong>"Gerar QR Code Oficial"</strong> para escanear com seu celular.</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <a
                      href="https://z-api.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-[10.5px] font-black uppercase text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Site Z-API.io
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setConnectionProvider('zapi');
                        setActiveTab('config');
                      }}
                      className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10.5px] font-black uppercase text-center shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Configurar Z-API Aqui ⚡
                    </button>
                  </div>
                </div>

                {/* Method 2: Evolution API */}
                <div className="bg-white p-5 rounded-3xl border-2 border-emerald-200 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    100% Gratuito & Open Source
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
                        2
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                          Evolution API (VPS / Docker)
                        </h5>
                        <p className="text-[10.5px] text-emerald-800 font-bold">
                          Gratuito para sempre • Baileys oficial
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 text-[11px] text-emerald-950 font-medium leading-relaxed space-y-2">
                      <p><strong>Passo 1:</strong> A <strong>Evolution API</strong> é 100% gratuita e de código aberto (sem mensalidade).</p>
                      <p><strong>Passo 2 (Onde rodar grátis 24h):</strong> Crie uma conta gratuita no <a href="https://render.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-extrabold">Render.com</a> ou <a href="https://koyeb.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-extrabold">Koyeb.com</a> (ambos têm planos gratuitos para Web Services/Docker).</p>
                      <p><strong>Passo 3:</strong> Suba a imagem Docker pública oficial: <code>docker.io/evoapicloud/evolution-api:v2.1.1</code> e defina sua chave <code>AUTHENTICATION_API_KEY</code>.</p>
                      <p><strong>Passo 4:</strong> Cole a URL gerada aqui no painel e gere o QR Code oficial.</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <a
                      href="https://github.com/EvolutionAPI/evolution-api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[10.5px] font-black uppercase text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      GitHub Evolution API
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setConnectionProvider('evolution');
                        setActiveTab('config');
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-black uppercase text-center shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Configurar Evolution ⚡
                    </button>
                  </div>
                </div>

              </div>

              {/* Step-by-step Render.com Tutorial Card */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-500/30">
                      ☁️
                    </div>
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider text-slate-150">
                        Tutorial Completo: Como Criar a Evolution API no Render.com (Grátis)
                      </h5>
                      <p className="text-[10px] text-slate-400">
                        Tempo estimado: 3 a 5 minutos • Custo: R$ 0,00
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://dashboard.render.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir Render.com
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-[11px] font-sans">
                  <div className="space-y-2.5 bg-slate-850/80 p-4 rounded-2xl border border-slate-800">
                    <p className="font-extrabold text-emerald-400 uppercase text-[10px]">
                      Passo 1: Criar Banco PostgreSQL Gratuito no Render
                    </p>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      A Evolution v2 precisa de um banco de dados PostgreSQL para salvar as sessões e QR Codes. O Render oferece banco grátis:
                    </p>
                    <ol className="space-y-1.5 text-slate-300 list-decimal list-inside leading-relaxed text-[10.5px]">
                      <li>No topo do painel do Render, clique em <strong className="text-white">+ New</strong> &gt; <strong className="text-purple-400">PostgreSQL</strong>.</li>
                      <li>Name: <code className="text-purple-300 font-mono">evolution-db</code>.</li>
                      <li>Instance Type: marque <strong className="text-emerald-400">Free ($0/month)</strong>.</li>
                      <li>Clique em <strong className="text-white">Create Database</strong>.</li>
                      <li>Na página do banco recém-criado, copie o campo <strong className="text-amber-300">Internal Database URL</strong> (começa com <code>postgres://...</code>).</li>
                    </ol>
                  </div>

                  <div className="space-y-2.5 bg-slate-850/80 p-4 rounded-2xl border border-slate-800">
                    <p className="font-extrabold text-emerald-400 uppercase text-[10px]">
                      Passo 2: Configurar o Web Service da Evolution API
                    </p>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      Agora no seu Web Service da Evolution API, vá na aba <strong className="text-white">Environment</strong> e defina:
                    </p>
                    <div className="space-y-1.5 font-mono text-[9px]">
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="text-purple-300 font-bold">DATABASE_ENABLED</span> = <span className="text-emerald-300">true</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="text-purple-300 font-bold">DATABASE_PROVIDER</span> = <span className="text-emerald-300">postgresql</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="text-purple-300 font-bold">DATABASE_CONNECTION_URI</span> = <span className="text-amber-300">cole a Internal Database URL do Passo 1</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="text-purple-300 font-bold">AUTHENTICATION_API_KEY</span> = <span className="text-emerald-300">sua_senha_secreta</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="text-purple-300 font-bold">SERVER_PORT</span> = <span className="text-emerald-300">8080</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-[9.5px] pt-1">
                      Salve as alterações. O Render reiniciará e ficará verde (<strong className="text-emerald-400">Live</strong>)!
                    </p>
                  </div>
                </div>
              </div>

              {/* 100% Free Solutions Comparison */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-green-500/10 p-5 rounded-3xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎁</span>
                  <h5 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
                    Quer rodar 100% Grátis sem gastar nada? Aqui estão as 3 melhores opções:
                  </h5>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-150 shadow-xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      1. Mais Simples (Custo 0)
                    </span>
                    <h6 className="text-[11px] font-black text-slate-800">Tablet / Celular Antigo no Wi-Fi</h6>
                    <p className="text-[10.5px] text-slate-600 leading-normal font-medium">
                      Deixe um celular ou tablet antigo da loja conectado no Wi-Fi com a página do painel aberta. Ele recebe os pedidos e responde sem custo algum!
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-150 shadow-xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      2. Nuvem Grátis 24h
                    </span>
                    <h6 className="text-[11px] font-black text-slate-800">Evolution no Render / Koyeb</h6>
                    <p className="text-[10.5px] text-slate-600 leading-normal font-medium">
                      O software Evolution API é código aberto gratuito. Hospedando no plano Free tier do <em>Render</em> ou <em>Koyeb</em>, roda 24h com custo R$ 0,00.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-150 shadow-xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      3. Oficial da Meta
                    </span>
                    <h6 className="text-[11px] font-black text-slate-800">Meta Cloud API (1.000/mês grátis)</h6>
                    <p className="text-[10.5px] text-slate-600 leading-normal font-medium">
                      A Meta (dona do WhatsApp) oferece 1.000 conversas mensais gratuitas para empresas através do portal oficial <em>Meta for Developers</em>.
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ & Important Explanations */}
              <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-xs space-y-4">
                <h5 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4.5 h-4.5 text-slate-500" />
                  Dúvidas Frequentes sobre Funcionamento 24h
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-[11px] text-slate-600 leading-relaxed font-medium">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-150">
                    <p className="font-extrabold text-slate-800 uppercase text-[10px] mb-1">
                      ❓ Preciso deixar o computador ou navegador ligado?
                    </p>
                    <p>
                      <strong>Não!</strong> Quando você conecta seu número à Z-API ou à Evolution API na nuvem, o servidor em nuvem gerencia a conexão WebSocket do WhatsApp 24h por dia. Mesmo com o PC desligado, os clientes continuam recebendo respostas e o cardápio.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-150">
                    <p className="font-extrabold text-slate-800 uppercase text-[10px] mb-1">
                      ❓ Meu celular precisa estar com internet o tempo todo?
                    </p>
                    <p>
                      Com o recurso de <strong>Aparelhos Conectados (Multi-Device)</strong> do WhatsApp moderno, o WhatsApp Web/API funciona de forma autônoma nos servidores em nuvem, mesmo se seu celular estiver desligado ou sem bateria por até 14 dias!
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-150">
                    <p className="font-extrabold text-slate-800 uppercase text-[10px] mb-1">
                      ❓ Como os pedidos entram no painel da loja?
                    </p>
                    <p>
                      Quando o cliente clica no link enviado pelo robô (Opção 1), ele monta o açaí e finaliza a compra online. O pedido é gravado no Google Firebase Firestore e toca a campainha no painel do caixa instantaneamente!
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-150">
                    <p className="font-extrabold text-slate-800 uppercase text-[10px] mb-1">
                      ❓ Posso testar sem contratar nada agora?
                    </p>
                    <p>
                      <strong>Sim!</strong> O modo <em>Simulador</em> já está ativo e você pode testar todas as respostas na aba <strong>Simulador de Chat</strong> e disparar mensagens prontas para o seu WhatsApp no botão <strong>"Abrir no Meu WhatsApp"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
