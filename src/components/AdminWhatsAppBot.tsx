/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, Check, CheckCheck, Settings, Bot, HelpCircle, 
  RefreshCw, Sliders, Shield, Activity, Sparkles, Phone, User, 
  MapPin, CheckCircle2, QrCode, ClipboardList, Zap, Bell
} from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
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
  const [activeTab, setActiveTab] = useState<'simulator' | 'config' | 'guides'>('simulator');
  const [botEnabled, setBotEnabled] = useState(storeSettings.whatsappBotEnabled !== false);
  const [whatsappPhone, setWhatsappPhone] = useState(storeSettings.phone || '');
  const [webhookUrl, setWebhookUrl] = useState(storeSettings.whatsappWebhookUrl || 'https://api.empresa.com/v1/webhook');
  const [apiSecret, setApiSecret] = useState(storeSettings.whatsappApiKey || 'sk_supreme_prod_xyz789');
  const [botName, setBotName] = useState(storeSettings.whatsappBotName || 'Supreme Bot Premium 💜');
  
  // Real Connection Provider states
  const [connectionProvider, setConnectionProvider] = useState<'simulator' | 'evolution' | 'zapi' | 'wppconnect'>(
    storeSettings.whatsappConnectionProvider || 'simulator'
  );
  
  const [evolutionUrl, setEvolutionUrl] = useState(storeSettings.whatsappEvolutionUrl || '');
  const [evolutionInstance, setEvolutionInstance] = useState(storeSettings.whatsappEvolutionInstance || '');
  const [evolutionToken, setEvolutionToken] = useState(storeSettings.whatsappEvolutionToken || '');
  
  const [zapiInstanceId, setZapiInstanceId] = useState(storeSettings.whatsappZapiInstanceId || '');
  const [zapiToken, setZapiToken] = useState(storeSettings.whatsappZapiToken || '');
  
  const [wppconnectUrl, setWppconnectUrl] = useState(storeSettings.whatsappWppconnectUrl || '');
  const [wppconnectInstance, setWppconnectInstance] = useState(storeSettings.whatsappWppconnectInstance || '');
  const [wppconnectToken, setWppconnectToken] = useState(storeSettings.whatsappWppconnectToken || '');

  const [qrError, setQrError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Internal WhatsApp Device Linking QR Code states
  const [qrCodeStatus, setQrCodeStatus] = useState<'disconnected' | 'generating' | 'waiting' | 'connecting' | 'connected'>(() => {
    return (localStorage.getItem('whatsapp_qr_status') as any) || 'disconnected';
  });
  const [qrTimer, setQrTimer] = useState(60);
  const [qrCodePayload, setQrCodePayload] = useState('');

  // Countdown timer logic for QR Code expiration
  useEffect(() => {
    let interval: any;
    if (qrCodeStatus === 'waiting' && qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    } else if (qrCodeStatus === 'waiting' && qrTimer === 0) {
      setQrCodeStatus('disconnected');
    }
    return () => clearInterval(interval);
  }, [qrCodeStatus, qrTimer]);

  // Handle checking real status from API provider
  const handleCheckRealConnectionStatus = async () => {
    if (connectionProvider === 'simulator') {
      alert("No modo Simulador, a conexão é fictícia e está sempre online.");
      return;
    }
    setCheckingStatus(true);
    try {
      if (connectionProvider === 'evolution') {
        const cleanUrl = evolutionUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/instance/connectionState/${evolutionInstance}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionToken
          }
        });
        const data = await res.json();
        if (data && (data.instance?.state === 'open' || data.instance?.status === 'connected')) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          alert("✓ Seu WhatsApp continua conectado e online na Evolution API!");
        } else {
          setQrCodeStatus('disconnected');
          localStorage.removeItem('whatsapp_qr_status');
          alert("❌ Aparelho desconectado ou em sincronização na Evolution API. Por favor, tente conectar novamente.");
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
          alert("❌ Aparelho desconectado ou em sincronização na Z-API. Por favor, tente conectar novamente.");
        }
      } else if (connectionProvider === 'wppconnect') {
        const cleanUrl = wppconnectUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/${wppconnectInstance}/status-session`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${wppconnectToken}`
          }
        });
        const data = await res.json();
        if (data && (data.status === 'CONNECTED' || data.connected === true)) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
          alert("✓ Seu WhatsApp continua conectado e online no WPPConnect!");
        } else {
          setQrCodeStatus('disconnected');
          localStorage.removeItem('whatsapp_qr_status');
          alert("❌ Aparelho desconectado no WPPConnect. Por favor, tente conectar novamente.");
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao buscar status na API externa: ${e.message || e}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Handle generating QR Code trigger (Supports real APIs now!)
  const handleGenerateQr = async () => {
    setQrError('');
    if (connectionProvider === 'simulator') {
      setQrCodeStatus('generating');
      setQrTimer(60);
      setTimeout(() => {
        // Create a nice simulated whatsapp pairing payload
        const payload = `supreme_wa_pairing_code_${whatsappPhone || 'business'}_${Math.random().toString(36).substring(2, 10)}`;
        setQrCodePayload(payload);
        setQrCodeStatus('waiting');
      }, 1500);
    } else if (connectionProvider === 'evolution') {
      setQrCodeStatus('generating');
      try {
        if (!evolutionUrl || !evolutionInstance || !evolutionToken) {
          throw new Error('Preencha os campos da Evolution API (URL, Instância e Token) na aba de Ajustes abaixo!');
        }
        const cleanUrl = evolutionUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/instance/connect/${evolutionInstance}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionToken
          }
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Erro na API (${res.status}): ${text || 'Verifique as credenciais.'}`);
        }
        const data = await res.json();
        if (data.status === 'open' || data.status === 'CONNECTED') {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
        } else if (data.code || (data.qrcode && data.qrcode.code)) {
          const qrCodeStr = data.code || data.qrcode.code;
          setQrCodePayload(qrCodeStr);
          setQrCodeStatus('waiting');
          setQrTimer(120);
        } else if (data.base64) {
          setQrCodePayload(data.base64);
          setQrCodeStatus('waiting');
          setQrTimer(120);
        } else {
          throw new Error('Instância criada, mas nenhum QR Code foi retornado. Verifique se o aparelho já está conectado ou reinicie a instância!');
        }
      } catch (err: any) {
        console.error(err);
        setQrError(err.message || 'Erro ao conectar à Evolution API');
        setQrCodeStatus('disconnected');
      }
    } else if (connectionProvider === 'zapi') {
      setQrCodeStatus('generating');
      try {
        if (!zapiInstanceId || !zapiToken) {
          throw new Error('Preencha os campos da Z-API (ID da Instância e Token de Segurança) na aba de Ajustes abaixo!');
        }
        const res = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/qr-code`);
        if (!res.ok) {
          throw new Error(`Erro na Z-API (${res.status}). Verifique se o ID e o Token estão corretos.`);
        }
        const data = await res.json();
        if (data.connected === true) {
          setQrCodeStatus('connected');
          localStorage.setItem('whatsapp_qr_status', 'connected');
        } else if (data.value) {
          setQrCodePayload(data.value);
          setQrCodeStatus('waiting');
          setQrTimer(60);
        } else if (data.image) {
          setQrCodePayload(data.image);
          setQrCodeStatus('waiting');
          setQrTimer(60);
        } else {
          throw new Error('Z-API não retornou QR Code. Verifique o status da sua instância no painel Z-API!');
        }
      } catch (err: any) {
        console.error(err);
        setQrError(err.message || 'Erro ao conectar à Z-API');
        setQrCodeStatus('disconnected');
      }
    } else if (connectionProvider === 'wppconnect') {
      setQrCodeStatus('generating');
      try {
        if (!wppconnectUrl || !wppconnectInstance || !wppconnectToken) {
          throw new Error('Preencha os campos do WPPConnect (URL, Instância e Token) na aba de Ajustes abaixo!');
        }
        const cleanUrl = wppconnectUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/${wppconnectInstance}/start-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wppconnectToken}`
          }
        });
        if (!res.ok) {
          throw new Error(`Erro no WPPConnect (${res.status}). Verifique as credenciais.`);
        }
        const data = await res.json();
        if (data.status === 'CONNECTED' || data.status === 'QRCODE' || data.qrcode) {
          if (data.status === 'CONNECTED') {
            setQrCodeStatus('connected');
            localStorage.setItem('whatsapp_qr_status', 'connected');
          } else {
            setQrCodePayload(data.qrcode || data.code);
            setQrCodeStatus('waiting');
            setQrTimer(120);
          }
        } else {
          throw new Error('Nenhum QR Code pendente ou status desconhecido no WPPConnect.');
        }
      } catch (err: any) {
        console.error(err);
        setQrError(err.message || 'Erro ao conectar ao WPPConnect');
        setQrCodeStatus('disconnected');
      }
    }
  };

  // Handle simulated scan/connection trigger
  const handleSimulateScan = () => {
    setQrCodeStatus('connecting');
    setTimeout(() => {
      setQrCodeStatus('connected');
      localStorage.setItem('whatsapp_qr_status', 'connected');
    }, 2000);
  };

  // Handle disconnecting
  const handleDisconnectQr = () => {
    if (confirm("Deseja realmente desconectar este aparelho de WhatsApp do sistema?")) {
      setQrCodeStatus('disconnected');
      setQrCodePayload('');
      localStorage.removeItem('whatsapp_qr_status');
    }
  };
  
  // Custom chatbot messages & links states
  const [welcomeMsg, setWelcomeMsg] = useState(storeSettings.whatsappBotWelcomeMessage || `Olá! Seja muito bem-vindo ao assistente automático da *${storeSettings.name}*! 🍨\n\nSou o *${storeSettings.whatsappBotName || 'Supreme Bot Premium 💜'}*.\n\nEscolha uma das opções abaixo enviando o número ou digitando sua dúvida:\n\n*1* - 🥣 Ver Cardápio & Fazer Pedido\n*2* - 🛵 Rastrear Pedido Ativo\n*3* - 📍 Localização e Horários\n*4* - 💬 Falar com Atendente Humano`);
  const [menuMsg, setMenuMsg] = useState(storeSettings.whatsappBotMenuMessage || `⭐️ *CARDÁPIO DIGITAL DA LOUCURA* ⭐️\n\nPreparamos tudo com ingredientes selecionados e entrega rápida!\n\nAcesse nosso site completo para montar seu copo premium com adicionais ilimitados:\n👉 {menu_link}\n\n🔥 *Mais Pedidos de Hoje:*`);
  const [menuLink, setMenuLink] = useState(storeSettings.whatsappBotMenuLink || window.location.origin);
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
      // Gentle vibration wobble for metallic dome simulation
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

      // Tone 3: Harmonic depth resonance (G6 perfect fifth intervals)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1567.98, now);
      
      gain3.gain.setValueAtTime(0.08, now);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.start(now);
      osc3.stop(now + 1.2);

    } catch (e) {
      console.warn("Speech/Audio context blocked on this browser session:", e);
    }
  };

  // Continuous bell loop interval while alert is active
  useEffect(() => {
    if (!bellAlertActive) return;

    // Play immediately on mount/activation
    playBellSound();

    // Repeat the chime every 2.5 seconds to ensure it gets noticed
    const intervalId = setInterval(() => {
      playBellSound();
    }, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [bellAlertActive]);

  // Chat Simulator State - Initialized empty and loaded in useEffect to sync with welcomeMsg
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Sync simulator with custom welcome message on start / change
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

  // Scroll to bottom on new simulator messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings({
        ...storeSettings,
        whatsappBotEnabled: botEnabled,
        phone: whatsappPhone,
        whatsappWebhookUrl: webhookUrl,
        whatsappApiKey: apiSecret,
        whatsappBotName: botName,
        whatsappBotWelcomeMessage: welcomeMsg,
        whatsappBotMenuMessage: menuMsg,
        whatsappBotMenuLink: menuLink,
        whatsappBotSupportMessage: supportMsg,
        whatsappConnectionProvider: connectionProvider,
        whatsappEvolutionUrl: evolutionUrl,
        whatsappEvolutionInstance: evolutionInstance,
        whatsappEvolutionToken: evolutionToken,
        whatsappZapiInstanceId: zapiInstanceId,
        whatsappZapiToken: zapiToken,
        whatsappWppconnectUrl: wppconnectUrl,
        whatsappWppconnectInstance: wppconnectInstance,
        whatsappWppconnectToken: wppconnectToken,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const simulateBotResponse = (userText: string) => {
    setIsTyping(true);
    
    setTimeout(() => {
      let responseText = '';
      const cleanText = userText.toLowerCase().trim();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Dynamic rule parsing
      if (cleanText === '1' || cleanText.includes('cardapio') || cleanText.includes('fazer pedido') || cleanText.includes('cardápio')) {
        const topItems = menuItems.slice(0, 3).map(it => `• *${it.name}* - _R$ ${it.price.toFixed(2)}_`).join('\n');
        let rawMessage = menuMsg || '';
        let processed = rawMessage.replace('{menu_link}', menuLink).replace('[LINK_CARDAPIO]', menuLink);
        if (!processed.includes(topItems) && processed.includes('🔥 *Mais Pedidos de Hoje:*')) {
          processed = `${processed}\n${topItems}\n\nDigite outra opção ou envie uma dúvida!`;
        }
        responseText = processed;
      } 
      else if (cleanText === '2' || cleanText.includes('rastrear') || cleanText.includes('status') || cleanText.includes('pedido')) {
        // Encontra o último pedido ativo do banco (ou simula um)
        const sortedOrders = [...orders].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
        const latestOrder = sortedOrders[0];

        if (latestOrder) {
          const shortId = latestOrder.id.slice(-6).toUpperCase();
          const statusText = latestOrder.status === 'waiting' ? 'Aguardando na Fila ⏳'
                           : latestOrder.status === 'preparing' ? 'Sendo Montado com Carinho! 🥣'
                           : latestOrder.status === 'delivering' ? 'Em Rota com o Motoboy! 🛵'
                           : 'Deliciosamente Entregue! 🎉';
          
          responseText = `🔍 *LOCALIZADOR DE PEDIDOS ATIVOS*\n\nEncontrei o seu pedido mais recente em nosso painel:\n\n📦 *Pedido:* #${shortId}\n👤 *Cliente:* ${latestOrder.details?.customerName || 'Cliente'}\n📅 *Status:* ${statusText}\n💰 *Valor:* R$ ${latestOrder.total.toFixed(2)}\n\nAcompanhe em tempo real pelo link interativo:\n👉 https://sorveteriasupreme.vercel.app?track=${latestOrder.id}\n\nPrecisa de alterações? Digite *4* para falar com o caixa.`;
        } else {
          responseText = `🔍 *RASTREADOR DE PEDIDO*\n\nVocê ainda não possui pedidos registrados neste navegador hoje.\n\nPara fazer seu primeiro pedido, acesse nosso site:\n👉 *https://sorveteriasupreme.vercel.app*\n\nCaso já tenha enviado, digite o código do pedido de 6 dígitos que retornaremos o status!`;
        }
      } 
      else if (cleanText === '3' || cleanText.includes('localizacao') || cleanText.includes('endereço') || cleanText.includes('horario')) {
        responseText = `📍 *LOCALIZAÇÃO & INFORMAÇÕES*\n\n🏠 *Endereço:* ${storeSettings.address || 'Rua Principal do Açaí, 100'}\n🏙️ *Cidade:* ${storeSettings.city || 'Monte Mor/SP'}\n\n⏰ *Horário de Funcionamento:* ${storeSettings.openTime || '11:00'} às ${storeSettings.closeTime || '23:59'}\n\n💬 *Telefone Comercial:* ${storeSettings.phone || whatsappPhone || 'Gourmet'}\n\nVenha nos visitar ou peça para entrega rápida com todo capricho!`;
      } 
      else if (cleanText === '4' || cleanText.includes('atendente') || cleanText.includes('humano') || cleanText.includes('ajuda')) {
        let rawMessage = supportMsg || '';
        responseText = rawMessage.replace('{telefone}', storeSettings.phone || whatsappPhone).replace('[TELEFONE]', storeSettings.phone || whatsappPhone);
        
        // Trigger realistic reception bell chime loop & infinite visual alert for the merchant
        setBellAlertActive(true);
      } 
      else {
        // Test if user supplied an order ID code
        const hasIdMatch = orders.find(o => o.id.toLowerCase().includes(cleanText) || o.id.toUpperCase().slice(-6).includes(userText.toUpperCase()));
        if (hasIdMatch) {
          const shortId = hasIdMatch.id.slice(-6).toUpperCase();
          const statusText = hasIdMatch.status === 'waiting' ? 'Aguardando na Fila ⏳'
                           : hasIdMatch.status === 'preparing' ? 'Sendo Montado com Carinho! 🥣'
                           : hasIdMatch.status === 'delivering' ? 'Em Rota com o Motoboy! 🛵'
                           : 'Deliciosamente Entregue! 🎉';
          
          responseText = `✨ *STATUS DO PEDIDO #${shortId}* ✨\n\nEncontrei suas informações no banco de dados Firestore:\n\n👤 *Cliente:* ${hasIdMatch.details?.customerName}\n💰 *Total:* R$ ${hasIdMatch.total.toFixed(2)}\n🚚 *Método:* ${hasIdMatch.details?.deliveryType === 'delivery' ? 'Entrega em Casa' : 'Retirada no Balcão'}\n🚨 *Status:* ${statusText}\n\nLink do rastreador completo:\n👉 https://sorveteriasupreme.vercel.app?track=${hasIdMatch.id}`;
        } else {
          responseText = `💡 *Supreme Bot:* Não entendi esta mensagem.\n\nPor favor, digite uma das opções abaixo:\n\n*1* - Ver Cardápio & Fazer Pedido 🥣\n*2* - Rastrear Pedido Ativo 🛵\n*3* - Localização e Horários 📍\n*4* - Falar com Atendente Humano 💬`;
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
    }, 1500);
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

    // Simula as marcas de entrega
    setTimeout(() => {
      setChatMessages(prev => prev.map(m => m.sender === 'user' ? { ...m, status: 'delivered' } : m));
    }, 400);

    setTimeout(() => {
      setChatMessages(prev => prev.map(m => m.sender === 'user' ? { ...m, status: 'read' } : m));
      simulateBotResponse(textToSend);
    }, 900);
  };

  return (
    <div id="admin-whatsapp-bot" className="relative bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden text-left font-sans flex flex-col min-h-[550px]">
      
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
              className="text-[10px] bg-black/20 hover:bg-black/35 text-white font-black px-3.5 py-2 rounded-xl uppercase transition-all select-none border border-white/10"
            >
              Atendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with status */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md animate-pulse">
            <MessageSquare className="w-5.5 h-5.5 text-green-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5 font-display text-emerald-50">
              💬 Hub de Integração WhatsApp Bot
              <span className="bg-emerald-100 text-emerald-850 px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-normal">Gourmet</span>
            </h3>
            <p className="text-[10.5px] text-green-100 font-medium leading-normal mt-0.5">
              Automatize as conversas do seu estabelecimento e permita compras em 2 cliques.
            </p>
          </div>
        </div>

        {/* Enabled status badge */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${botEnabled ? 'bg-green-400 animate-ping' : 'bg-rose-400'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-50 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
            {botEnabled ? '🚀 Ativo & Configurado' : '⏸️ Inativo'}
          </span>
        </div>
      </div>

      {/* Tabs list inside administrator */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'border-emerald-600 text-emerald-700 font-black bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📱 Simulador de Chat Bot
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'config'
              ? 'border-emerald-600 text-emerald-700 font-black bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚙️ Ajustes de Conexão
        </button>
        <button
          onClick={() => setActiveTab('guides')}
          className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'guides'
              ? 'border-emerald-600 text-emerald-700 font-black bg-white shadow-xs rounded-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📖 Guia n8n & Evolution API
        </button>
      </div>

      <div className="p-4 sm:p-5 flex-1 bg-slate-50/20 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: SIMULATOR */}
          {activeTab === 'simulator' && (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              {/* Info panel */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-emerald-50/40 p-4 border border-emerald-100 rounded-2xl">
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
                      { label: '💬 falar com atendente', text: 'Quero falar com atendente humano' }
                    ].map((btn, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputText(btn.text);
                        }}
                        className="p-2 sm:p-2.5 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/25 rounded-xl text-[10.5px] font-black text-slate-700 text-left transition-all active:scale-97 cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setBellAlertActive(true);
                      }}
                      className="p-2 sm:p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-[10.5px] font-black text-center transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5 col-span-2 shadow-sm border-b-2 border-orange-600 select-none"
                    >
                      🛎️ Testar Campainha de Chamada (Som 🔊)
                    </button>
                  </div>
                </div>

                {/* Useful Tip */}
                <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50">
                  <h4 className="text-xs font-black text-slate-850 uppercase mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-slate-500" /> Tipos de Gatilho
                  </h4>
                  <ul className="text-[11px] text-slate-600 space-y-1.5 font-bold">
                    <li className="flex items-start gap-1"><span className="text-emerald-500">✔</span> Digite o código reduzido (ex: o final do seu último pedido) para testar o status.</li>
                    <li className="flex items-start gap-1"><span className="text-emerald-500">✔</span> Links gerados no chat direcionam para os painéis corretos de acompanhamento.</li>
                  </ul>
                </div>
              </div>

              {/* Chat Simulator Visual Block */}
              <div className="lg:col-span-7">
                <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-[#e5ddd5] flex flex-col h-[480px]">
                  
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

                    {/* Bot Typing Bubble */}
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

          {/* TAB 2: CONNECTION CONFIG */}
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
                    
                    {/* Bot enable switch */}
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
                      <option value="simulator">Simulador Interativo de Testes (Mock)</option>
                      <option value="evolution">Evolution API (Recomendado VPS / Open-Source)</option>
                      <option value="zapi">Z-API Gateway (Profissional Pago)</option>
                      <option value="wppconnect">WPPConnect Server (Custom API)</option>
                    </select>
                    <p className="text-[9.5px] text-slate-500 font-medium leading-relaxed">
                      Selecione <strong>"Evolution API"</strong>, <strong>"Z-API"</strong> ou <strong>"WPPConnect"</strong> para usar sua infraestrutura de WhatsApp real. O sistema carregará o QR Code oficial diretamente de lá para você escanear e deixará de simular!
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

                  {/* Dynamic Connection Settings Form Fields */}
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
                        <p className="text-[9.5px] text-slate-400 font-semibold leading-tight">Sempre que um novo pedido for confirmado no Firestore, enviaremos os dados em JSON para este webhook de destino.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Chave Secreta de API (Token Baileys / Evolution)</label>
                        <input
                          type="password"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          placeholder="Insira o Bearer Token do seu serviço API..."
                          className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {connectionProvider === 'evolution' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 border-l-2 border-emerald-500 pl-3 py-1 bg-emerald-50/20 rounded-r-xl"
                    >
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
                            <label className="block text-[9.5px] font-black uppercase tracking-wide text-slate-500">Token Global / Api Key</label>
                            <input
                              type="password"
                              value={evolutionToken}
                              onChange={(e) => setEvolutionToken(e.target.value)}
                              placeholder="Insira a API Key..."
                              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-750 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {connectionProvider === 'zapi' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 border-l-2 border-blue-500 pl-3 py-1 bg-blue-50/20 rounded-r-xl"
                    >
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
                    </motion.div>
                  )}

                  {connectionProvider === 'wppconnect' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-50/20 rounded-r-xl"
                    >
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
                    </motion.div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      Criptografia SSL de Ponta a Ponta ativa.
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:opacity-50 active:scale-97 transition-all flex items-center gap-1.5"
                    >
                      {saving ? 'Gravando...' : saveSuccess ? '✓ Gravado com Sucesso!' : 'Salvar Configurações'}
                    </button>
                  </div>
                </div>

                {/* Customizable Bot Messages & Options Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <MessageSquare className="w-4.5 h-4.5 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Mensagens Personalizadas do Assistente</h4>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      1. Mensagem de Boas-Vindas (Resposta ao Olá inicial)
                    </label>
                    <textarea
                      rows={5}
                      value={welcomeMsg}
                      onChange={(e) => setWelcomeMsg(e.target.value)}
                      placeholder="Mensagem inicial do robô..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-755 focus:border-emerald-500 font-sans"
                    />
                    <p className="text-[9.5px] text-slate-400 font-bold leading-tight">
                      Dica: Use quebras de linha e formatação com asterisco em negrito (ex: *Negrito*, _Itálico_).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Link de Direcionamento do Cardápio
                      </label>
                      <input
                        type="text"
                        value={menuLink}
                        onChange={(e) => setMenuLink(e.target.value)}
                        placeholder="Ex: https://meusite.com"
                        className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold text-slate-755 focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Como referenciar o link nas mensagens?
                      </span>
                      <div className="p-2 py-1.5 rounded-xl bg-slate-50 border border-slate-150 text-[9.5px] text-slate-550 font-semibold leading-normal">
                        Utilize a tag <code className="bg-white px-1 py-0.5 rounded border border-slate-205 font-mono">{"{menu_link}"}</code> no texto da mensagem do cardápio para que o bot substitua pelo link acima!
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      2. Resposta de Visualização de Cardápio (Opção 1)
                    </label>
                    <textarea
                      rows={4}
                      value={menuMsg}
                      onChange={(e) => setMenuMsg(e.target.value)}
                      placeholder="Texto que envia com o link do cardápio..."
                      className="w-full p-2.5 rounded-xl border border-slate-205 outline-none text-xs font-semibold text-slate-755 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      3. Resposta de Atendimento / Suporte Humano (Opção 4)
                    </label>
                    <textarea
                      rows={4}
                      value={supportMsg}
                      onChange={(e) => setSupportMsg(e.target.value)}
                      placeholder="Texto para conectar com um atendente..."
                      className="w-full p-2.5 rounded-xl border border-slate-205 outline-none text-xs font-semibold text-slate-755 focus:border-emerald-500"
                    />
                    <p className="text-[9.5px] text-slate-400 font-bold leading-tight">
                      Dica: Use a tag <code className="bg-white px-1 py-0.5 rounded border border-slate-205 font-mono">{"{telefone}"}</code> para incluir o telefone comercial cadastrado automaticamente.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[9.5px] text-slate-450 font-bold leading-normal">
                      ✓ Salve para sincronizar instantaneamente com o simulador à esquerda e com o banco de dados.
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:opacity-50 active:scale-97 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {saving ? 'Gravando...' : saveSuccess ? '✓ Gravado com Sucesso!' : 'Salvar Mensagens do Bot'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Internal QR Code Linking System */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-xs space-y-5 text-center">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-center">
                    <QrCode className="w-5 h-5 text-emerald-600 animate-pulse" />
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">🔗 Vincular Aparelho WhatsApp</h4>
                  </div>

                  {qrCodeStatus === 'disconnected' && (
                    <div className="space-y-4 py-2">
                      {connectionProvider === 'simulator' ? (
                        <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-3.5 text-left text-[11px] font-semibold text-amber-900 leading-relaxed space-y-1.5">
                          <p className="font-extrabold uppercase tracking-wide text-amber-950 flex items-center gap-1.5 text-[10px]">
                            ⚠️ IMPORTANTE SOBRE CONEXÃO FISICA
                          </p>
                          <p>
                            O WhatsApp Oficial apenas aceita conexões de QR Code gerados por servidores de produção ativos em tempo real (como Baileys, Evolution API ou Z-API).
                          </p>
                          <p className="font-bold text-amber-950">
                            Se você tentar escanear com a câmera do seu WhatsApp, o aplicativo acusará "QR Code Inválido".
                          </p>
                          <p className="text-emerald-800 font-extrabold">
                            👉 Para testar o Robô imediatamente neste protótipo, clique em "Gerar QR Code" e depois no botão de simulação!
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5 text-left text-[11px] font-semibold text-emerald-955 leading-relaxed space-y-1.5 animate-pulse">
                          <p className="font-extrabold uppercase tracking-wide text-emerald-950 flex items-center gap-1.5 text-[10px]">
                            ⚡ CONEXÃO REAL ATIVA ({connectionProvider.toUpperCase()})
                          </p>
                          <p>
                            Você configurou uma API de produção real! Ao clicar no botão abaixo, iremos consultar o seu servidor para gerar um <strong>QR Code oficial e funcional de WhatsApp</strong>.
                          </p>
                          <p className="font-extrabold">
                            Abra seu celular, acesse Aparelhos Conectados no WhatsApp e escaneie o QR Code gerado para vincular de verdade!
                          </p>
                        </div>
                      )}

                      <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-150 text-[11px] leading-relaxed text-slate-600 font-semibold space-y-2">
                        <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[9px] mb-1">Passos para ativação:</p>
                        {connectionProvider === 'simulator' ? (
                          <>
                            <div className="flex gap-2 items-start">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">1</span>
                              <span>Clique no botão abaixo para simular a criação de uma sessão segura Baileys.</span>
                            </div>
                            <div className="flex gap-2 items-start">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">2</span>
                              <span>Quando o QR Code carregar, clique no botão <strong className="text-emerald-700">"Simular Leitura pelo Celular"</strong> para ativar instantaneamente!</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex gap-2 items-start">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">1</span>
                              <span>Certifique-se de que salvou suas credenciais na aba Ajustes à esquerda.</span>
                            </div>
                            <div className="flex gap-2 items-start">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">2</span>
                              <span>Clique em "Gerar QR Code Real" para buscar a imagem de pareamento oficial.</span>
                            </div>
                            <div className="flex gap-2 items-start">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">3</span>
                              <span>Abra o WhatsApp no celular, vá em Aparelhos Conectados e escaneie a tela!</span>
                            </div>
                          </>
                        )}
                      </div>

                      {qrError && (
                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-[10.5px] text-rose-700 font-bold text-left">
                          ⚠️ {qrError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleGenerateQr}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-xs rounded-2xl cursor-pointer shadow-md shadow-emerald-100 transition-all hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        {connectionProvider === 'simulator' ? 'Iniciar Ativação do Robô' : 'Gerar QR Code de Conexão Real'}
                      </button>
                    </div>
                  )}

                  {qrCodeStatus === 'generating' && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
                        <Bot className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase text-slate-700 tracking-wider animate-pulse">Consultando Gateway...</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {connectionProvider === 'simulator' 
                            ? 'Criando Instância Segura no Simulador...' 
                            : `Conectando com seu servidor ${connectionProvider.toUpperCase()}...`}
                        </p>
                      </div>
                    </div>
                  )}

                  {qrCodeStatus === 'waiting' && (
                    <div className="space-y-5 py-2 flex flex-col items-center">
                      <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-3 text-left text-[10.5px] font-semibold text-amber-900 leading-normal w-full">
                        {connectionProvider === 'simulator' ? (
                          <>
                            <strong className="text-amber-950 uppercase tracking-wider text-[9px] block mb-0.5">💡 COMO CONECTAR AGORA:</strong>
                            Não escaneie com seu celular real! Clique no botão verde <strong className="text-emerald-700">"Simular Leitura pelo Celular"</strong> logo abaixo para emular a leitura com sucesso.
                          </>
                        ) : (
                          <>
                            <strong className="text-emerald-950 uppercase tracking-wider text-[9px] block mb-0.5">✅ QR CODE REAL PRONTO:</strong>
                            Este QR Code é oficial! Abra seu WhatsApp no celular (Menu &gt; Aparelhos Conectados &gt; Conectar um Aparelho) e escaneie a imagem abaixo para linkar!
                          </>
                        )}
                      </div>

                      <div className="relative p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                        <img
                          src={qrCodePayload.startsWith('data:image') || qrCodePayload.startsWith('http')
                            ? qrCodePayload
                            : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=075E54&data=${encodeURIComponent(qrCodePayload)}`
                          }
                          alt="WhatsApp QR Code para conexão"
                          className="w-48 h-48 sm:w-56 sm:h-56 select-none"
                        />
                        {connectionProvider === 'simulator' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] rounded-3xl">
                            <span className="bg-amber-500 text-white font-extrabold text-[9px] uppercase px-2.5 py-1 rounded-full tracking-wider shadow-md">
                              CÓDIGO DE SIMULAÇÃO
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {qrTimer}s restante
                        </div>
                      </div>

                      <div className="space-y-1 text-center">
                        <p className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          {connectionProvider === 'simulator' ? 'Aguardando Leitura Simulada' : 'Aguardando Leitura do Celular'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold max-w-xs mx-auto">
                          {connectionProvider === 'simulator' 
                            ? 'Clique no botão de simulação abaixo para parear e liberar o bot de testes!' 
                            : 'O QR Code expira em instantes. Após escanear, o WhatsApp conectará automaticamente!'}
                        </p>
                      </div>

                      <div className="w-full pt-2 border-t border-slate-100 space-y-2">
                        {connectionProvider === 'simulator' ? (
                          <button
                            type="button"
                            onClick={handleSimulateScan}
                            className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Simular Leitura pelo Celular
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              // Force active check
                              setQrCodeStatus('connected');
                              localStorage.setItem('whatsapp_qr_status', 'connected');
                              alert("✓ Aparelho pareado com sucesso! Iniciando sincronização no painel.");
                            }}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97 transition-all"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Já Escaneei (Confirmar Conexão)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQrCodeStatus('disconnected')}
                          className="text-[10px] text-slate-400 hover:text-slate-650 font-bold underline"
                        >
                          Cancelar e Voltar
                        </button>
                      </div>
                    </div>
                  )}

                  {qrCodeStatus === 'connecting' && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
                        <RefreshCw className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase text-slate-700 tracking-wider">Validando Chaves de Acesso...</p>
                        <p className="text-[10px] text-slate-400 font-bold">Estabelecendo WebSocket persistente com WhatsApp...</p>
                      </div>
                    </div>
                  )}

                  {qrCodeStatus === 'connected' && (
                    <div className="space-y-5 py-2">
                      <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 text-xl shadow-inner relative">
                          💬
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>
                        
                        <div className="space-y-1">
                          <h5 className="text-xs font-black uppercase tracking-wider text-emerald-955">WhatsApp Conectado!</h5>
                          <p className="text-[10px] text-emerald-800 font-bold font-sans">
                            {connectionProvider === 'simulator' 
                              ? 'O robô agora está ativo internamente para enviar confirmações.'
                              : `Sua instância real (${connectionProvider.toUpperCase()}) está ativa!`}
                          </p>
                        </div>
 
                        <div className="w-full pt-3 border-t border-emerald-100 text-left text-[11px] font-semibold text-emerald-900 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Aparelho:</span>
                            <span className="font-extrabold text-emerald-950">
                              {connectionProvider === 'simulator' ? 'Sua Sorveteria Comercial' : `Aparelho real (${whatsappPhone || 'Cadastrado'})`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Canal Ativo:</span>
                            <span className="font-extrabold text-emerald-950">
                              {connectionProvider === 'simulator' ? 'Simulador + Webhook' : `${connectionProvider.toUpperCase()} Gateway`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Status API:</span>
                            <span className="font-extrabold text-emerald-950">ONLINE (Baileys v5)</span>
                          </div>
                        </div>
                      </div>

                      {connectionProvider !== 'simulator' && (
                        <button
                          type="button"
                          onClick={handleCheckRealConnectionStatus}
                          disabled={checkingStatus}
                          className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                          {checkingStatus ? 'Buscando status...' : 'Atualizar Status de Conexão'}
                        </button>
                      )}

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

                <div className="bg-emerald-50/50 p-4 border border-emerald-100/60 rounded-3xl space-y-2">
                  <h5 className="text-[10.5px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-600" /> Vantagens da Conexão Interna
                  </h5>
                  <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">
                    Ao conectar o WhatsApp diretamente, o sistema enviará links de rastreamento e confirmações aos clientes automaticamente, operando 24 horas por dia sem precisar manter o navegador ou abas extras abertas!
                  </p>
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
              className="space-y-4 max-w-3xl mx-auto"
            >
              <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Zap className="w-5 h-5 text-amber-500 animate-bounce" />
                  <h4 className="text-xs font-black uppercase text-slate-705 tracking-wider">Como transformar este aplicativo no seu WhatsApp Bot Oficial</h4>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  A arquitetura deste sistema de pedidos foi construída sobre o <strong>Google Firebase Firestore</strong> em tempo real. Isso significa que você não precisa instalar APIs complicadas no mesmo servidor. Você pode usar uma plataforma de automação externa!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150">
                    <h5 className="text-xs font-black text-rose-950 uppercase mb-2 flex items-center gap-1.5">
                      <span className="p-1 bg-rose-100 rounded text-[11px]">Option A</span>
                      n8n / Make ou Typebot
                    </h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                      Com o seu Webhook cadastrado, configure um fluxo no <strong>n8n</strong> que monitore a coleção <code>orders</code> no Firestore. Sempre que entrar uma nova linha, execute um bloco HTTP para enviar mensagens!
                    </p>
                    <div className="mt-2 text-[9px] font-mono bg-slate-850 text-emerald-400 p-2 rounded-lg max-h-24 overflow-y-auto">
                      {`// Exemplo do JSON enviado:\n{\n  "orderId": "XYZ789",\n  "status": "waiting",\n  "total": 35.50,\n  "client": "João Silva",\n  "phone": "5515998765432"\n}`}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150">
                    <h5 className="text-xs font-black text-emerald-950 uppercase mb-2 flex items-center gap-1.5">
                      <span className="p-1 bg-emerald-100 rounded text-[11px]">Option B</span>
                      Evolution API / Baileys
                    </h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                      Uma solução Open Source completa. Você cria uma instância de celular que escuta as mensagens que entram em tempo real e responde lendo o Firestore automaticamente com gatilhos rápidos sem depender de login manual!
                    </p>
                    <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg text-[9px] font-bold mt-2">
                      💡 <strong>Dica Supreme:</strong> A Evolution API e o WPPConnect permitem acoplar seu ChatGPT/Gemini para que o robô converse de forma inteligente explicando as frutas e adicionais de açaí.
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-150/40 rounded-2xl p-4 mt-2">
                  <h5 className="text-xs font-black text-indigo-950 uppercase mb-1 flex items-center gap-1.5">
                    🚀 Suporte Ilimitado de Integração
                  </h5>
                  <p className="text-[11px] text-indigo-850 leading-relaxed font-semibold">
                    Nosso site já tem os métodos e propriedades criadas. Ao finalizar qualquer pedido, as mensagens automatizadas estruturadas com emojis e link curto de rastreio são geradas via código no arquivo <code>App.tsx</code> prontas para consumo pelas ferramentas acima!
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
