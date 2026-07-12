/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Chamada de Senhas para TV e Controle do Atendente
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Volume2, VolumeX, Play, RotateCcw, Check, Clock, 
  User, Shield, Plus, Minus, Send, List, Bell, AlertTriangle, ExternalLink
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Order } from '../types';

interface AdminPainelTVProps {
  orders: Order[];
  storeSettings: any;
}

interface CalledSenha {
  password: string;
  name: string;
  timestamp: any;
}

export default function AdminPainelTV({ orders, storeSettings }: AdminPainelTVProps) {
  // Tabs: 'control' (operator screen) or 'tv' (TV screen display mode)
  const [viewMode, setViewMode] = useState<'control' | 'tv'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'tv') return 'tv';
    }
    return 'control';
  });
  
  // Real-time Called Password State (Synced via Firestore settings/called_senha)
  const [activePassword, setActivePassword] = useState<string>('01');
  const [activeName, setActiveName] = useState<string>('Cliente Balcão');
  const [lastCalledTime, setLastCalledTime] = useState<number>(Date.now());
  const [senhaHistory, setSenhaHistory] = useState<CalledSenha[]>([]);

  // Local TV settings
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true);
  const [chimeVolume, setChimeVolume] = useState<number>(0.8);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Manual calling form states
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');

  const previousTimeRef = useRef<number>(Date.now());

  // Real-time Firestore sync
  useEffect(() => {
    // Listen to called password document
    const docRef = doc(db, 'settings', 'called_senha');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActivePassword(data.currentPassword || '01');
        setActiveName(data.currentName || 'Cliente');
        setSenhaHistory(data.history || []);
        
        const newTime = data.lastCalled ? (data.lastCalled.toMillis ? data.lastCalled.toMillis() : data.lastCalled) : Date.now();
        
        // If the timestamp changed and is newer, trigger TV Alert (Chime & Voice synthesis)
        if (newTime > previousTimeRef.current) {
          previousTimeRef.current = newTime;
          setLastCalledTime(newTime);
          triggerTVAlert(data.currentPassword || '01', data.currentName || 'Cliente');
        }
      } else {
        // Initialize default document in firestore if not exists
        try {
          setDoc(docRef, {
            currentPassword: '01',
            currentName: 'Cliente Balcão',
            lastCalled: Date.now(),
            history: [
              { password: '01', name: 'Cliente Balcão', timestamp: Date.now() }
            ]
          });
        } catch (e) {
          console.warn("Firestore offline - utilizando fallback local para o painel de senhas.");
        }
      }
    }, (error) => {
      console.warn("Firestore error on painel de TV:", error);
    });

    return () => unsubscribe();
  }, []);

  // Play synthetic "Ding Dong" audio chime
  const playChime = () => {
    if (!chimeEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // First Note
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain1.gain.setValueAtTime(chimeVolume, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      
      // Second Note
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440.00, audioCtx.currentTime + 0.35); // A4
      gain2.gain.setValueAtTime(0, audioCtx.currentTime);
      gain2.gain.setValueAtTime(chimeVolume, audioCtx.currentTime + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.8);
      osc2.start(audioCtx.currentTime + 0.35);
      osc2.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("Falha ao tocar sino sintético:", e);
    }
  };

  // Speak password via Browser speech synthesis (Text-to-Speech)
  const speakPassword = (password: string, name: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop current speech
      
      const cleanName = name && name !== 'Não informado' && name !== 'Cliente Balcão' ? name : '';
      const text = cleanName 
        ? `Senha número, ${password}. Cliente, ${cleanName}. Favor retirar o pedido no balcão.`
        : `Senha número, ${password}. Favor retirar o pedido no balcão.`;
        
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95; // Slightly slower for clear TV resonance
      utterance.pitch = 1.0;
      
      // Select appropriate Brazilian voice if available
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
      if (ptVoice) {
        utterance.voice = ptVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  // Flash background on new call
  const triggerTVAlert = (password: string, name: string) => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 2500); // flash for 2.5 seconds
    
    // Play chime immediately, then speak password after a short delay
    playChime();
    setTimeout(() => {
      speakPassword(password, name);
    }, 850);
  };

  // Call / trigger a password in Firestore
  const handleCallPassword = async (passwordNum: string, nameText: string) => {
    if (!passwordNum) return;
    
    const cleanPass = passwordNum.trim().toUpperCase();
    const cleanName = (nameText || 'Cliente Balcão').trim();
    
    // Create new history list (limit to 5 last)
    const newHistoryItem = {
      password: cleanPass,
      name: cleanName,
      timestamp: Date.now()
    };
    
    const filteredHistory = [
      newHistoryItem,
      ...senhaHistory.filter(item => item.password !== cleanPass)
    ].slice(0, 5);

    try {
      const docRef = doc(db, 'settings', 'called_senha');
      await setDoc(docRef, {
        currentPassword: cleanPass,
        currentName: cleanName,
        lastCalled: Date.now(),
        history: filteredHistory
      });
    } catch (e) {
      // Fallback local if firebase fails
      setActivePassword(cleanPass);
      setActiveName(cleanName);
      setSenhaHistory(filteredHistory);
      triggerTVAlert(cleanPass, cleanName);
    }
  };

  // Helper to derive a clean ticket number or password from order
  const getOrderSenhaNumber = (order: Order, index: number) => {
    // If order has a specific code or we use last 3 digits of timestamp/ID
    const rawTime = order.timestamp ? new Date(order.timestamp).getTime() : Date.now();
    const orderIndex = String((index % 99) + 1).padStart(2, '0');
    return orderIndex;
  };

  // Open standalone view in another tab
  const handleOpenTVTab = () => {
    // This will open the same page but instruct the application to launch TV Mode directly.
    const url = window.location.origin + '?mode=tv';
    window.open(url, 'supreme_tv_screen');
  };

  return (
    <div className="w-full bg-slate-50 rounded-3xl border border-slate-150 p-5 min-h-[500px]">
      
      {/* Top Header Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
            <Tv className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Painel Integrado de Senha para TV</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Sincronização instantânea na Smart TV via HDMI/Navegador</p>
          </div>
        </div>

        <div className="flex bg-slate-200/60 p-1 rounded-xl gap-1 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('control')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === 'control'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🕹️ Painel de Chamada
          </button>
          <button
            onClick={() => setViewMode('tv')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === 'tv'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📺 Modo Exibição TV
          </button>
        </div>
      </div>

      {/* 1. OPERATOR CONTROL VIEW */}
      {viewMode === 'control' && (
        <div className="grid lg:grid-cols-12 gap-5 text-slate-800">
          
          {/* Left Column: Manual Dialer & Active TV Status */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Quick Manual Call Box */}
            <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Bell className="w-4 h-4 text-rose-500 animate-bounce" />
                <h4 className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Chamar Senha Manual</h4>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Número da Senha</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="EX: 42"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg font-mono font-black p-2.5 rounded-xl border border-slate-205 focus:ring-1 focus:ring-rose-500 outline-none text-slate-750"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Nome do Cliente (Opcional)</label>
                  <input
                    type="text"
                    placeholder="EX: Bruno"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-205 focus:ring-1 focus:ring-rose-500 outline-none font-bold text-slate-750"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!manualPassword) {
                      alert("Digite o número da senha para chamar.");
                      return;
                    }
                    handleCallPassword(manualPassword, manualName);
                    setManualPassword('');
                    setManualName('');
                  }}
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer shadow-md shadow-rose-100 transition-all flex items-center justify-center gap-1.5 active:scale-97"
                >
                  <Send className="w-3.5 h-3.5" />
                  Chamar na TV Agora
                </button>
              </div>
            </div>

            {/* Active Display Status Box */}
            <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-3 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Status Atual na TV</span>
                <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">SINCRO ATIVO</span>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="bg-slate-900 border-2 border-slate-750 rounded-xl p-3 text-center min-w-[70px]">
                  <span className="block text-[7px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1">Senha</span>
                  <span className="font-mono text-2xl font-black text-emerald-400">{activePassword}</span>
                </div>
                <div>
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide">Cliente Atendido</span>
                  <span className="text-xs font-black text-slate-700 leading-tight block">{activeName}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenTVTab}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir Painel da TV (Nova Aba)
              </button>
              <p className="text-[8.5px] text-slate-400 leading-normal text-center">💡 Coloque a tela da nova aba na TV de sua loja usando um cabo HDMI ou via Smart TV!</p>
            </div>

          </div>

          {/* Right Column: Active Store Orders list for quick call */}
          <div className="lg:col-span-8 flex flex-col bg-white rounded-3xl border border-slate-150 shadow-xs p-5 text-left">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
              <div>
                <h4 className="text-[11px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <List className="w-4 h-4 text-indigo-500" />
                  Pedidos do Dia • Chamar com 1 Clique
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Clique para enviar o pedido diretamente para o painel de senhas</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[9px] text-slate-500 font-bold uppercase">Aguardando/Preparo</span>
              </div>
            </div>

            {/* Orders list */}
            <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
              {orders.filter(o => o.status === 'waiting' || o.status === 'preparing').length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhum pedido em fila ativa no momento</p>
                  <p className="text-[10px] font-semibold text-slate-300">Lance pedidos no PDV para listar aqui!</p>
                </div>
              ) : (
                orders.filter(o => o.status === 'waiting' || o.status === 'preparing').map((order, index) => {
                  const sNum = getOrderSenhaNumber(order, index);
                  const name = order.details?.customerName || 'Cliente Balcão';
                  const isPreparing = order.status === 'preparing';

                  return (
                    <div 
                      key={order.id} 
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-indigo-200 rounded-2xl flex items-center justify-between transition-all gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-150 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[7px] text-indigo-500 font-extrabold uppercase leading-none mb-0.5">Senha</span>
                          <span className="font-mono text-sm font-black text-indigo-800 leading-none">{sNum}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-700">{name}</span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isPreparing ? 'bg-amber-100 text-amber-800 border border-amber-200/50' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {isPreparing ? 'Preparo' : 'Fila'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono font-bold block mt-0.5">
                            Ref: {order.id.slice(-6).toUpperCase()} • {order.items.reduce((acc, i) => acc + i.quantity, 0)} itens • R$ {order.total.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCallPassword(sNum, name)}
                        className="py-1.5 px-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-extrabold uppercase text-[9px] tracking-wider rounded-xl cursor-pointer transition-all active:scale-97 flex items-center gap-1.5 shadow-sm"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Chamar na TV
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Simulated Voice Test */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl">
              <div className="text-left">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Teste de Alto-Falante</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Fale uma frase de teste no navegador local para testar o áudio:</span>
              </div>
              <button
                onClick={() => {
                  speakPassword("42", "Felipe");
                }}
                className="py-1.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-extrabold uppercase rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                📢 Falar Teste local
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. TV SCREEN DISPLAY MODE */}
      {viewMode === 'tv' && (
        <div className={`rounded-3xl border-4 ${isFlashing ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-200'} p-6 sm:p-10 transition-all duration-300 text-center relative overflow-hidden min-h-[580px] flex flex-col justify-between select-none`}>
          
          {/* TV Top Header with Live Info */}
          <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍦</span>
              <div className="text-left">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">SORVETERIA SUPREME</h2>
                <p className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest">Painel de Senhas Oficial</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Sound Controls directly on the screen for Smart TVs */}
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${ttsEnabled ? 'text-emerald-400' : 'text-slate-400'}`}
                  title="Vocalizador de Voz (TTS)"
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setChimeEnabled(!chimeEnabled)}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${chimeEnabled ? 'text-emerald-400' : 'text-slate-400'}`}
                  title="Sinal Sonoro"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>

              <div className="font-mono text-xs font-black bg-white/10 px-3 py-1.5 rounded-xl text-white">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Main Display Body */}
          <div className="grid lg:grid-cols-12 gap-8 my-auto py-6 items-center">
            
            {/* Giant Active Password Box */}
            <div className="lg:col-span-8 flex flex-col justify-center items-center space-y-4">
              <div className="bg-white/5 backdrop-blur-xs rounded-3xl p-6 sm:p-10 border border-white/10 w-full shadow-2xl flex flex-col items-center">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400 animate-pulse">
                  ÚLTIMA CHAMADA
                </span>
                
                {/* Active Ticket Number */}
                <h1 className="font-mono text-7xl sm:text-9xl font-black text-white tracking-wide my-4 select-none drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)] animate-bounce">
                  {activePassword}
                </h1>

                {/* Client Name */}
                <div className="bg-white/10 px-6 py-2.5 rounded-2xl border border-white/5 max-w-md">
                  <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Cliente</span>
                  <span className="text-xl sm:text-2xl font-black text-white">{activeName}</span>
                </div>
              </div>
            </div>

            {/* History of Called Passwords (Right Rail) */}
            <div className="lg:col-span-4 bg-black/20 rounded-3xl border border-white/5 p-5 text-left flex flex-col justify-start space-y-4 h-full min-h-[300px]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 border-b border-white/10 pb-2">
                ⏱️ Senhas Anteriores
              </h3>

              <div className="space-y-3">
                {senhaHistory.slice(1, 5).length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    Sem histórico de chamadas
                  </div>
                ) : (
                  senhaHistory.slice(1, 5).map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center">
                          <span className="font-mono text-xs font-black text-emerald-400">{item.password}</span>
                        </div>
                        <div>
                          <span className="block text-[7px] text-slate-400 font-extrabold uppercase">Cliente</span>
                          <span className="text-[11px] font-black text-white leading-none">{item.name}</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-extrabold text-slate-500 uppercase">Chamado</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Footer Promotion Slide/Message */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between mt-4 text-left gap-2.5">
            <div>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Agradecemos a Preferência!</span>
              <p className="text-[10px] text-slate-300 font-bold">Por favor, retire sua colher e guardanapos no balcão de atendimento.</p>
            </div>
            <div className="text-[11px] font-bold text-slate-400 bg-white/10 px-4 py-1.5 rounded-full border border-white/5">
              🍦 Saboreie nossa Receita GOURMET!
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
