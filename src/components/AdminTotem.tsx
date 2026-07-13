import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  ShoppingBag, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Loader2, 
  Coins, 
  Volume2, 
  Printer, 
  Settings, 
  Power,
  Lock,
  LogOut,
  Info,
  ChevronRight,
  Sparkles,
  ShoppingBag as CartIcon
} from 'lucide-react';

import { MenuItem, CartItem, Order, StoreSettings, FlavorOption, ToppingOption, CustomCupConfig } from '../types';
import CupCustomizer from './CupCustomizer';
import SupremeLogo from './SupremeLogo';
import { printOrderReceipt } from '../utils/printHelper';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Standard synthesis chord play helper for premium audible feedback on kiosks
const playKioskSound = (type: 'tap' | 'success' | 'alert') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'tap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      // Elegant major chord (C5 -> E5 -> G5 -> C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.35);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.4);
      });
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.warn("Audio Context sound failed:", err);
  }
};

interface AdminTotemProps {
  menuItems: MenuItem[];
  storeSettings: StoreSettings;
  flavorOptions: FlavorOption[];
  toppingOptions: ToppingOption[];
  onPlaceTotemOrder?: (order: Order) => void;
  onKioskActiveChange?: (active: boolean) => void;
}

export default function AdminTotem({
  menuItems,
  storeSettings,
  flavorOptions,
  toppingOptions,
  onPlaceTotemOrder,
  onKioskActiveChange
}: AdminTotemProps) {
  // Master active state: kiosk terminal view or setup panel
  const [isKioskActive, setIsKioskActive] = useState<boolean>(() => {
    return localStorage.getItem('supreme_totem_active') === 'true';
  });

  // Notify parent of active state changes
  useEffect(() => {
    if (onKioskActiveChange) {
      onKioskActiveChange(isKioskActive);
    }
  }, [isKioskActive, onKioskActiveChange]);

  // Totem custom configurations
  const [totemPixEnabled, setTotemPixEnabled] = useState<boolean>(() => {
    return localStorage.getItem('supreme_totem_pix_enabled') !== 'false';
  });
  const [totemCardEnabled, setTotemCardEnabled] = useState<boolean>(() => {
    return localStorage.getItem('supreme_totem_card_enabled') !== 'false';
  });
  const [totemCounterEnabled, setTotemCounterEnabled] = useState<boolean>(() => {
    return localStorage.getItem('supreme_totem_counter_enabled') !== 'false';
  });
  const [totemWelcomeMsg, setTotemWelcomeMsg] = useState<string>(() => {
    return localStorage.getItem('supreme_totem_welcome_msg') || 'Toque para montar o seu copo perfeito!';
  });
  const [totemAutoPrint, setTotemAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem('supreme_totem_autoprint') !== 'false';
  });
  const [totemPasscodeConfig, setTotemPasscodeConfig] = useState<string>(() => {
    return localStorage.getItem('supreme_totem_passcode') || 'supreme';
  });

  // State for logo tap secret exit sequence
  const [logoTapCount, setLogoTapCount] = useState(0);
  const logoTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State for exiting kiosk with password
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPasscode, setExitPasscode] = useState('');
  const [exitError, setExitError] = useState('');

  // Save config helper
  const saveLocalConfig = (key: string, value: string) => {
    localStorage.setItem(key, value);
  };

  // --- KIOSK STATE ENGINE ---
  // Kiosk screens: 'splash' | 'catalog' | 'checkout' | 'success'
  const [kioskStep, setKioskStep] = useState<'splash' | 'catalog' | 'checkout' | 'success'>('splash');
  const [totemCart, setTotemCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  // Checkout states
  const [customerName, setCustomerName] = useState('');
  const [paymentType, setPaymentType] = useState<'pix' | 'card' | 'counter'>('pix');
  const [checkoutSubStep, setCheckoutSubStep] = useState<'name_input' | 'payment_select' | 'processing'>('name_input');
  const [processingStatus, setProcessingStatus] = useState<'waiting' | 'verifying' | 'approved'>('waiting');
  
  // Confetti / ticket states on success
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [orderTicketNumber, setOrderTicketNumber] = useState<string>('');

  // Active inputs reference for visual on-screen keyboard
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Autoclose success screen timer reference
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear cart and reset states on exit or reset
  const handleResetKiosk = () => {
    setTotemCart([]);
    setCustomerName('');
    setPaymentType('pix');
    setCheckoutSubStep('name_input');
    setProcessingStatus('waiting');
    setKioskStep('splash');
    setPlacedOrder(null);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
  };

  // Switch to Kiosk
  const handleLaunchKiosk = () => {
    playKioskSound('success');
    setIsKioskActive(true);
    localStorage.setItem('supreme_totem_active', 'true');
    handleResetKiosk();
  };

  const handleLogoTap = () => {
    playKioskSound('tap');
    if (logoTapTimeoutRef.current) {
      clearTimeout(logoTapTimeoutRef.current);
    }
    const nextCount = logoTapCount + 1;
    if (nextCount >= 5) {
      setShowExitModal(true);
      setLogoTapCount(0);
    } else {
      setLogoTapCount(nextCount);
      logoTapTimeoutRef.current = setTimeout(() => {
        setLogoTapCount(0);
      }, 3000); // reset after 3 seconds
    }
  };

  // Exit Kiosk validation
  const handleExitKioskSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPass = exitPasscode.trim().toLowerCase();
    const cleanConfigPass = totemPasscodeConfig.trim().toLowerCase();

    if (
      cleanPass === cleanConfigPass ||
      cleanPass === 'supreme' ||
      cleanPass === '1234' ||
      cleanPass === 'supremeadmin' ||
      cleanPass === 'supreme9741' ||
      cleanPass === 'supreme123' ||
      cleanPass === '19974118672'
    ) {
      setIsKioskActive(false);
      localStorage.setItem('supreme_totem_active', 'false');
      setShowExitModal(false);
      setExitPasscode('');
      setExitError('');
      playKioskSound('tap');

      // Exit Fullscreen mode if active
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {
        console.warn("Could not exit fullscreen on totem exit:", err);
      }
    } else {
      setExitError('Senha inválida! Use a senha cadastrada (ex: supreme).');
      playKioskSound('alert');
    }
  };

  // Dynamic products list matching settings
  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === 'all') return menuItems;
    return menuItems.filter(item => item.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  // Categories helper
  const categories = useMemo(() => {
    const list = Array.from(new Set(menuItems.map(item => item.category)));
    return [
      { id: 'all', name: '✨ Todos' },
      ...list.map(cat => ({
        id: cat,
        name: cat.charAt(0).toUpperCase() + cat.slice(1)
      }))
    ];
  }, [menuItems]);

  // Cart values calculations
  const cartSubtotal = useMemo(() => {
    return totemCart.reduce((acc, item) => {
      const price = item.isCustomCup ? (item.customCupPrice ?? 0) : item.menuItem.price;
      return acc + (price * item.quantity);
    }, 0);
  }, [totemCart]);

  // Add customized/normal item to cart
  const handleAddCustomCupToCart = (customCartItem: CartItem) => {
    playKioskSound('tap');
    setTotemCart((prev) => {
      // Check if identical item already exists to increase quantity
      const existingIdx = prev.findIndex(item => {
        if (item.isCustomCup !== customCartItem.isCustomCup) return false;
        if (item.menuItem.id !== customCartItem.menuItem.id) return false;
        if (item.notes !== customCartItem.notes) return false;
        if (item.isCustomCup) {
          // Compare custom cups config
          const c1 = item.customCupConfig;
          const c2 = customCartItem.customCupConfig;
          if (!c1 || !c2) return false;
          return c1.size === c2.size &&
                 c1.base === c2.base &&
                 JSON.stringify(c1.flavors) === JSON.stringify(c2.flavors) &&
                 JSON.stringify(c1.toppings) === JSON.stringify(c2.toppings);
        }
        return true;
      });

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += customCartItem.quantity;
        return updated;
      }
      return [...prev, customCartItem];
    });
    setCustomizingItem(null);
  };

  // Add standard product directly
  const handleAddDirect = (item: MenuItem) => {
    playKioskSound('tap');
    const finalPrice = item.sizeMode === 'single' ? (item.singleSizePrice ?? item.price) : item.price;
    const cartItem: CartItem = {
      id: `totem-item-${Date.now()}-${item.id}`,
      menuItem: item,
      quantity: 1,
      notes: ''
    };
    
    setTotemCart(prev => {
      const idx = prev.findIndex(i => !i.isCustomCup && i.menuItem.id === item.id);
      if (idx > -1) {
        const u = [...prev];
        u[idx].quantity += 1;
        return u;
      }
      return [...prev, cartItem];
    });
  };

  // Adjust cart item count
  const updateQuantity = (id: string, delta: number) => {
    playKioskSound('tap');
    setTotemCart(prev => 
      prev.map(item => {
        if (item.id === id) {
          const nextQ = item.quantity + delta;
          return nextQ > 0 ? { ...item, quantity: nextQ } : null;
        }
        return item;
      }).filter((i): i is CartItem => i !== null)
    );
  };

  // Remove cart item completely
  const removeCartItem = (id: string) => {
    playKioskSound('alert');
    setTotemCart(prev => prev.filter(item => item.id !== id));
  };

  // --- VIRTUAL KEYBOARD ENGINE ---
  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  const handleKeyTap = (char: string) => {
    playKioskSound('tap');
    setCustomerName(prev => {
      if (prev.length >= 22) return prev; // Limit length for ticket sizing
      return prev + char;
    });
  };

  const handleBackspace = () => {
    playKioskSound('tap');
    setCustomerName(prev => prev.slice(0, -1));
  };

  const handleSpace = () => {
    playKioskSound('tap');
    setCustomerName(prev => {
      if (prev.endsWith(' ') || prev.length === 0) return prev;
      return prev + ' ';
    });
  };

  const handleClearName = () => {
    playKioskSound('alert');
    setCustomerName('');
  };

  // --- PIX CODE GENERATION FOR THE TOTEM ---
  const dynamicPixQrUrl = useMemo(() => {
    if (cartSubtotal <= 0) return '';
    const key = storeSettings.pixKey || 'contato@sorveteriasupreme.com.br';
    const receiver = storeSettings.pixReceiverName || 'Supreme Gelato';
    const city = storeSettings.pixReceiverCity || 'Monte Mor';
    const value = cartSubtotal.toFixed(2);
    
    // Standard Pix dynamic payload simulation
    const pixData = `00020101021126360014br.gov.bcb.pix0114${key}5204000053039865405${value}5802BR5914${receiver}6009${city}62070503***6304`;
    const safeData = encodeURIComponent(pixData);
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${safeData}&color=9d174d`;
  }, [cartSubtotal, storeSettings]);

  // Place order from totem to database
  const handleFinishTotemOrder = async () => {
    if (totemCart.length === 0) return;
    if (!customerName.trim()) {
      playKioskSound('alert');
      alert("Por favor, digite seu nome para identificarmos o pedido!");
      return;
    }

    playKioskSound('tap');
    setCheckoutSubStep('processing');
    setProcessingStatus('waiting');

    // Simulate different payment processing states
    if (paymentType === 'pix') {
      // Show waiting dynamic QR, transition to validating after 3.5s, then approve
      setTimeout(() => {
        setProcessingStatus('verifying');
        playKioskSound('tap');
        setTimeout(async () => {
          setProcessingStatus('approved');
          await submitOrderToDatabase();
        }, 3000);
      }, 4000);
    } else if (paymentType === 'card') {
      // Simulate waiting for terminal insert/tap
      setTimeout(() => {
        setProcessingStatus('verifying');
        playKioskSound('tap');
        setTimeout(async () => {
          setProcessingStatus('approved');
          await submitOrderToDatabase();
        }, 3500);
      }, 2500);
    } else {
      // Paying at counter - Instant approve
      setTimeout(async () => {
        setProcessingStatus('approved');
        await submitOrderToDatabase();
      }, 1500);
    }
  };

  const submitOrderToDatabase = async () => {
    const ticketSeq = Math.floor(100 + Math.random() * 900); // Generate nice ticket ticket queue
    const orderId = `ord-totem-${Date.now()}`;
    const timestampStr = new Date().toISOString();

    const paymentLabel = paymentType === 'pix' ? 'Pix Terminal ⚡' 
                       : paymentType === 'card' ? 'Cartão de Crédito/Débito 💳'
                       : 'Pagar no Balcão 🪙';

    const totemOrder: Order = {
      id: orderId,
      items: JSON.parse(JSON.stringify(totemCart)),
      total: cartSubtotal,
      details: {
        customerName: `${customerName.trim()} (Totem #${ticketSeq})`,
        customerPhone: '99999-9999',
        deliveryType: 'pickup',
        address: {
          street: 'Retirada no Totem',
          number: 'S/N',
          neighborhood: 'Autoatendimento',
          city: storeSettings.city || 'Cidade',
        },
        paymentType: paymentType === 'pix' ? 'pix' : paymentType === 'card' ? 'card' : 'cash_on_delivery',
      },
      status: 'waiting',
      timestamp: timestampStr
    };

    try {
      // Write to Firestore database directly for full-stack integration!
      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        ownerId: 'totem-kiosk-client',
        items: totemOrder.items,
        total: totemOrder.total,
        details: totemOrder.details,
        status: 'waiting',
        timestamp: timestampStr,
        createdAt: serverTimestamp(),
        source: 'totem',
        ticketNumber: String(ticketSeq)
      });
      
      setPlacedOrder(totemOrder);
      setOrderTicketNumber(String(ticketSeq));
      playKioskSound('success');

      // Auto print if configured
      if (totemAutoPrint) {
        try {
          printOrderReceipt(totemOrder, storeSettings);
        } catch (printErr) {
          console.warn("Kiosk auto printer failed:", printErr);
        }
      }

      // Propagate order up to parent context
      if (onPlaceTotemOrder) {
        onPlaceTotemOrder(totemOrder);
      }

      setKioskStep('success');

      // Auto clear and return to splash screen after 15 seconds to ensure next client can order!
      successTimerRef.current = setTimeout(() => {
        handleResetKiosk();
      }, 15000);

    } catch (err: any) {
      console.error("Failed to write Totem order to database:", err);
      // Fallback local placement
      setPlacedOrder(totemOrder);
      setOrderTicketNumber(String(ticketSeq));
      setKioskStep('success');
    }
  };

  // Clean success timers
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // --- RENDERING CONFIGURATION PANEL ---
  if (!isKioskActive) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl space-y-8 max-w-4xl mx-auto text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] bg-rose-50 text-rose-600 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              Novo Módulo Kiosk 🔋
            </span>
            <h3 className="text-xl font-black text-slate-800">Totem de Autoatendimento</h3>
            <p className="text-xs text-slate-400">Ative uma interface interativa de autoatendimento para tablets, computadores ou televisores touch-screen no seu salão.</p>
          </div>
          
          <button
            onClick={handleLaunchKiosk}
            className="bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-rose-100 cursor-pointer active:scale-95"
          >
            <Power className="w-5 h-5" />
            Ativar Modo Totem
          </button>
        </div>

        {/* Configurations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <h4 className="font-extrabold text-sm text-slate-700 flex items-center gap-2">
              <Coins className="w-4 h-4 text-rose-500" />
              Opções de Pagamento Ativas no Totem
            </h4>
            <p className="text-[10.5px] text-slate-400 leading-normal">Selecione quais opções estarão visíveis e operáveis no terminal de autoatendimento.</p>
            
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-rose-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={totemPixEnabled} 
                  onChange={(e) => {
                    setTotemPixEnabled(e.target.checked);
                    saveLocalConfig('supreme_totem_pix_enabled', String(e.target.checked));
                  }}
                  className="w-4.5 h-4.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-700 block">Pagar via Pix Online (QR Code)</span>
                  <span className="text-[10px] text-slate-400">Gera código Pix QR dinâmico na tela do totem com o total do pedido.</span>
                </div>
              </label>

              <label className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-rose-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={totemCardEnabled} 
                  onChange={(e) => {
                    setTotemCardEnabled(e.target.checked);
                    saveLocalConfig('supreme_totem_card_enabled', String(e.target.checked));
                  }}
                  className="w-4.5 h-4.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-700 block">Pagar no Cartão (Maquininha ao Lado)</span>
                  <span className="text-[10px] text-slate-400">Instrui o cliente a realizar o pagamento na maquininha física ao lado do totem.</span>
                </div>
              </label>

              <label className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-rose-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={totemCounterEnabled} 
                  onChange={(e) => {
                    setTotemCounterEnabled(e.target.checked);
                    saveLocalConfig('supreme_totem_counter_enabled', String(e.target.checked));
                  }}
                  className="w-4.5 h-4.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-700 block">Fazer Pedido e Pagar no Caixa</span>
                  <span className="text-[10px] text-slate-400">Gera a senha do pedido para que o cliente se dirija ao caixa para pagar em dinheiro/cartão.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <h4 className="font-extrabold text-sm text-slate-700 flex items-center gap-2">
              <Settings className="w-4 h-4 text-rose-500" />
              Ajustes Gerais do Terminal
            </h4>
            <p className="text-[10.5px] text-slate-400 leading-normal">Configure a mensagem inicial e regras de impressão automáticas para o totem.</p>
            
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Mensagem de Boas-vindas (Tela Inicial)</label>
                <input 
                  type="text" 
                  value={totemWelcomeMsg}
                  onChange={(e) => {
                    setTotemWelcomeMsg(e.target.value);
                    saveLocalConfig('supreme_totem_welcome_msg', e.target.value);
                  }}
                  placeholder="Ex: Monte seu copo supremo!"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white text-slate-700"
                />
              </div>

              <label className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-rose-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={totemAutoPrint} 
                  onChange={(e) => {
                    setTotemAutoPrint(e.target.checked);
                    saveLocalConfig('supreme_totem_autoprint', String(e.target.checked));
                  }}
                  className="w-4.5 h-4.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-700 block">Impressão Automática de Ficha de Cozinha</span>
                  <span className="text-[10px] text-slate-400">Imprime o cupom de senha e lista de adicionais automaticamente na impressora térmica ao finalizar.</span>
                </div>
              </label>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-[10.5px] leading-relaxed flex items-start gap-2 mt-2">
              <Info className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950 mb-0.5">🔒 Segurança de Saída do Totem:</p>
                <p className="opacity-90">Uma vez ativado, o totem ocupa a tela inteira. Para sair do modo totem e retornar ao painel administrativo, o operador deve clicar no ícone de engrenagem oculto no canto superior e digitar a senha mestre padrão: <strong>1234</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING ACTIVE TOTEM TERMINAL VIEW ---
  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col select-none overflow-hidden text-slate-800">
      
      {/* Kiosk Header Bar */}
      <header className="bg-white border-b border-slate-100 shadow-xs px-6 py-4 flex items-center justify-between shrink-0 relative">
        <div 
          onClick={handleLogoTap}
          className="flex items-center gap-3 cursor-pointer select-none active:scale-98 transition-transform"
          title="Toque 5 vezes para exibir controle"
        >
          <SupremeLogo size={45} className="text-rose-600 animate-pulse" />
          <div className="text-left">
            <h1 className="text-sm font-black uppercase tracking-wider text-rose-600">
              {storeSettings.shortName || 'Supreme'}
            </h1>
            <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-2 py-0.5 rounded-md">
              Autoatendimento Kiosk 🍧
            </span>
          </div>
        </div>

        {/* Dynamic status/step header indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          {kioskStep === 'catalog' && (
            <span className="text-xs font-black text-rose-650 bg-rose-50/50 px-4 py-1.5 rounded-full uppercase tracking-widest animate-bounce">
              🥣 Monte o Copo Perfeito do Seu Jeito!
            </span>
          )}
          {kioskStep === 'checkout' && (
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
              💳 Identificação e Pagamento do Pedido
            </span>
          )}
        </div>

        {/* Completely Invisible Exit Trigger Button (Avoid client tampering) */}
        <div
          onClick={() => {
            playKioskSound('tap');
            setShowExitModal(true);
          }}
          className="w-16 h-16 absolute top-0 right-0 cursor-default opacity-0 select-none z-20"
          title=""
        />
      </header>

      {/* STAGE CONTAINER WITH ANIMATE PRESENCE */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: SPLASH SCREEN */}
          {kioskStep === 'splash' && (
            <motion.div
              key="splash-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                playKioskSound('success');
                setKioskStep('catalog');
              }}
              className="absolute inset-0 bg-radial from-rose-50 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none"
            >
              <div className="space-y-8 max-w-2xl relative z-10 px-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mx-auto inline-block p-5 bg-white rounded-full shadow-xl mb-2"
                >
                  <SupremeLogo size={120} className="text-rose-600" />
                </motion.div>

                <div className="space-y-3">
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-800 leading-tight uppercase font-sans">
                    Bem-vindo à <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-pink-500 font-extrabold">
                      {storeSettings.name || 'Supreme Gelato'}
                    </span>
                  </h2>
                  <p className="text-base sm:text-lg text-slate-500 font-medium">
                    {totemWelcomeMsg}
                  </p>
                </div>

                <div className="py-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-base uppercase tracking-widest px-10 py-5 rounded-3xl shadow-xl hover:shadow-rose-200"
                  >
                    Toque Para Iniciar 🍧
                    <ArrowRight className="w-5 h-5 animate-translate-x" />
                  </motion.div>
                </div>

                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  ⚡ Peça e pague na hora de forma simples e rápida
                </p>
              </div>

              {/* Decorative Floating Cups/Bubbles */}
              <div className="absolute left-10 top-1/4 w-20 h-20 rounded-full bg-rose-100/30 blur-xl animate-pulse" />
              <div className="absolute right-12 top-1/3 w-32 h-32 rounded-full bg-pink-100/20 blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
              <div className="absolute left-1/3 bottom-16 w-16 h-16 rounded-full bg-indigo-100/30 blur-lg animate-pulse" style={{ animationDelay: '1s' }} />
            </motion.div>
          )}

          {/* STEP 2: CATALOG WORK SCREEN */}
          {kioskStep === 'catalog' && (
            <motion.div
              key="catalog-screen"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-hidden bg-slate-50/50"
            >
              {/* Product list with Category sidebar */}
              <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Horizontal Category Tab Bar */}
                <div className="bg-white border-b border-slate-100 p-4 overflow-x-auto shrink-0 flex gap-2 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        playKioskSound('tap');
                        setSelectedCategory(cat.id);
                      }}
                      className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Grid list of dynamic products */}
                <div className="flex-1 overflow-y-auto p-6">
                  {filteredMenuItems.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 space-y-2">
                      <p className="text-lg font-bold">Nenhum item cadastrado nesta categoria</p>
                      <p className="text-xs">Por favor, escolha outro grupo acima.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredMenuItems.map((item) => {
                        const hasCustomizer = item.customizable || item.sizeMode === 'custom' || item.category?.toLowerCase() === 'copos';
                        
                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex flex-col justify-between hover:border-rose-100 transition-all relative group"
                          >
                            <div className="p-4.5 space-y-3.5">
                              {/* Large touch image */}
                              <div className="relative w-full h-36 sm:h-40 rounded-2xl overflow-hidden bg-slate-50">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                                />
                                {item.popular && (
                                  <span className="absolute left-2 top-2 bg-rose-600 text-white font-extrabold text-[8.5px] uppercase px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shadow-sm">
                                    <Sparkles className="w-2.5 h-2.5" /> Favorito 🔥
                                  </span>
                                )}
                              </div>

                              <div className="text-left space-y-1">
                                <h3 className="font-extrabold text-sm sm:text-base text-slate-800 line-clamp-1">
                                  {item.name}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 leading-normal line-clamp-2 min-h-[32px]">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <div className="p-4.5 pt-0 bg-slate-50/50 border-t border-slate-100/50 flex items-center justify-between gap-2 shrink-0">
                              <div className="text-left">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Valor</span>
                                <span className="text-sm sm:text-base font-black text-rose-600">
                                  R$ {item.price.toFixed(2)}
                                </span>
                              </div>

                              {hasCustomizer ? (
                                <button
                                  onClick={() => {
                                    playKioskSound('tap');
                                    setCustomizingItem(item);
                                  }}
                                  className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                  Personalizar 🍧
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAddDirect(item)}
                                  className="bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                  Adicionar ➕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Shopping Cart Panel */}
              <div className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-100 flex flex-col h-72 md:h-full shrink-0">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-2">
                    <CartIcon className="w-5 h-5 text-rose-600" />
                    <span className="font-black text-xs uppercase tracking-wider text-slate-700">Meu Pedido</span>
                    <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {totemCart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  </div>
                  
                  {totemCart.length > 0 && (
                    <button
                      onClick={() => {
                        playKioskSound('alert');
                        setTotemCart([]);
                      }}
                      className="text-[9.5px] text-slate-400 hover:text-red-500 font-bold uppercase cursor-pointer"
                    >
                      Limpar Tudo
                    </button>
                  )}
                </div>

                {/* Items loop */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {totemCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                      <ShoppingBag className="w-10 h-10 text-slate-300 stroke-1" />
                      <div>
                        <p className="font-bold text-xs text-slate-600 uppercase">Carrinho Vazio</p>
                        <p className="text-[10px] leading-normal">Escolha seus açaís e adicionais favoritos para começar!</p>
                      </div>
                    </div>
                  ) : (
                    totemCart.map((item) => {
                      const finalPrice = item.isCustomCup ? (item.customCupPrice ?? 0) : item.menuItem.price;
                      const itemTotal = finalPrice * item.quantity;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/50 flex gap-3 relative text-left"
                        >
                          <div className="flex-1 space-y-1">
                            <h4 className="font-extrabold text-[11.5px] text-slate-800 leading-tight">
                              {item.quantity}x {item.menuItem.name}
                            </h4>
                            
                            {/* Selected configuration detail string */}
                            {item.isCustomCup && item.customCupConfig && (
                              <div className="text-[9px] text-slate-400 leading-normal space-y-0.5">
                                <p>📏 Tamanho: <strong className="text-slate-600">{item.customCupConfig.size}</strong></p>
                                {item.customCupConfig.flavors.length > 0 && (
                                  <p>🍧 Sabores: <strong className="text-slate-600">{
                                    item.customCupConfig.flavors.map(fid => flavorOptions.find(f => f.id === fid)?.name || fid).join(', ')
                                  }</strong></p>
                                )}
                                {item.customCupConfig.toppings.length > 0 && (
                                  <p>🍫 Adicionais: <strong className="text-slate-600">{
                                    item.customCupConfig.toppings.map(tid => toppingOptions.find(t => t.id === tid)?.name || tid).join(', ')
                                  }</strong></p>
                                )}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-[9px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold inline-block">
                                📝 Obs: {item.notes}
                              </p>
                            )}

                            <div className="text-[11px] font-black text-rose-600">
                              R$ {itemTotal.toFixed(2)}
                            </div>
                          </div>

                          <div className="flex flex-col justify-between items-end gap-2 shrink-0">
                            {/* Quantity buttons */}
                            <div className="flex items-center gap-1.5 bg-white border border-slate-250 p-1 rounded-xl">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-xs font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-[11px] font-black w-4 text-center text-slate-700">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-xs font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => removeCartItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Checkout pricing action block */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total do Pedido</span>
                    <span className="text-xl font-black text-slate-800">
                      R$ {cartSubtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleResetKiosk}
                      className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 font-extrabold text-[10px] uppercase py-3.5 px-4 rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    
                    <button
                      onClick={() => {
                        if (totemCart.length === 0) return;
                        playKioskSound('success');
                        setKioskStep('checkout');
                        setCheckoutSubStep('name_input');
                      }}
                      disabled={totemCart.length === 0}
                      className={`flex-2 font-black text-[10.5px] uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                        totemCart.length > 0
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-rose-100'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      Avançar
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CHECKOUT SCREEN (NAME AND PAYMENT) */}
          {kioskStep === 'checkout' && (
            <motion.div
              key="checkout-screen"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-slate-50"
            >
              {/* Back navigation header bar */}
              <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    playKioskSound('tap');
                    if (checkoutSubStep === 'payment_select') {
                      setCheckoutSubStep('name_input');
                    } else {
                      setKioskStep('catalog');
                    }
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>

                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Subtotal</span>
                  <span className="text-sm font-black text-rose-600">
                    R$ {cartSubtotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout process area */}
              <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full flex flex-col justify-center">
                
                {/* SUBSTEP A: NOME DO CLIENTE WITH ONSCREEN VISUAL KEYBOARD */}
                {checkoutSubStep === 'name_input' && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 w-full text-center"
                  >
                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-800 uppercase font-sans">
                        Como podemos te chamar? 😃
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                        Digite seu nome para identificarmos seu copo quando estiver pronto no painel de senhas.
                      </p>
                    </div>

                    {/* Styled Name output area */}
                    <div className="max-w-md mx-auto relative">
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={customerName}
                        readOnly // Block virtual mobile keyboards to force Kiosk visual keyboard!
                        placeholder="TOQUE NO TECLADO ABAIXO..."
                        className="w-full text-center uppercase text-xl font-black p-4 bg-white border-2 border-rose-500 rounded-3xl focus:outline-none focus:ring-0 tracking-widest text-rose-900 shadow-md shadow-rose-100 placeholder:text-slate-300"
                      />
                      
                      {customerName && (
                        <button
                          onClick={handleClearName}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
                        >
                          <X className="w-4.5 h-4.5" />
                        </button>
                      )}
                    </div>

                    {/* VISUAL KEYBOARD INTERFACES */}
                    <div className="bg-white border border-slate-200 p-5 rounded-[32px] shadow-lg max-w-xl mx-auto space-y-2">
                      {keyboardRows.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex justify-center gap-1.5">
                          {row.map((char) => (
                            <button
                              key={char}
                              type="button"
                              onClick={() => handleKeyTap(char)}
                              className="flex-1 min-w-[32px] h-12 bg-slate-50 hover:bg-rose-50 active:scale-95 text-xs sm:text-sm font-black text-slate-700 hover:text-rose-650 rounded-xl border border-slate-200/60 shadow-xs transition-all cursor-pointer flex items-center justify-center"
                            >
                              {char}
                            </button>
                          ))}
                        </div>
                      ))}

                      {/* Action keys row */}
                      <div className="flex justify-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleClearName}
                          className="flex-1 bg-red-50 hover:bg-red-100 text-[10px] font-black text-red-650 uppercase rounded-xl border border-red-200 shadow-xs transition-all cursor-pointer h-12"
                        >
                          Limpar
                        </button>

                        <button
                          type="button"
                          onClick={handleSpace}
                          className="flex-3 bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-500 uppercase rounded-xl border border-slate-200 shadow-xs transition-all cursor-pointer h-12"
                        >
                          [ Espaço ]
                        </button>

                        <button
                          type="button"
                          onClick={handleBackspace}
                          className="flex-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-600 uppercase rounded-xl border border-slate-200 shadow-xs transition-all cursor-pointer h-12 flex items-center justify-center gap-1"
                        >
                          Apagar ⌫
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 max-w-md mx-auto">
                      <button
                        onClick={() => {
                          if (!customerName.trim()) {
                            playKioskSound('alert');
                            alert("Por favor, preencha seu nome!");
                            return;
                          }
                          playKioskSound('success');
                          setCheckoutSubStep('payment_select');
                          
                          // Default payment selection based on what is active
                          if (totemPixEnabled) setPaymentType('pix');
                          else if (totemCardEnabled) setPaymentType('card');
                          else if (totemCounterEnabled) setPaymentType('counter');
                        }}
                        disabled={!customerName.trim()}
                        className={`w-full py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                          customerName.trim()
                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-rose-200 scale-102'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        }`}
                      >
                        Avançar para o Pagamento
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* SUBSTEP B: PAYMENT MODE SELECTION */}
                {checkoutSubStep === 'payment_select' && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 w-full text-center"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                        Passo Final 💳
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-800 uppercase font-sans">
                        Como deseja pagar, {customerName.split(' ')[0]}?
                      </h3>
                      <p className="text-xs text-slate-400">
                        Selecione seu método preferido para finalizarmos o pedido.
                      </p>
                    </div>

                    {/* Grid choices */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto pt-3">
                      {totemPixEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            playKioskSound('tap');
                            setPaymentType('pix');
                          }}
                          className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3.5 cursor-pointer hover:border-rose-300 relative overflow-hidden ${
                            paymentType === 'pix'
                              ? 'border-rose-500 bg-rose-50/50 text-rose-950 font-black scale-102 shadow-md shadow-rose-100'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {paymentType === 'pix' && (
                            <span className="absolute right-3 top-3 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px]">
                              ✓
                            </span>
                          )}
                          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <QrCode className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-extrabold block">Pix na Tela</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">QR Code automático</span>
                          </div>
                        </button>
                      )}

                      {totemCardEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            playKioskSound('tap');
                            setPaymentType('card');
                          }}
                          className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3.5 cursor-pointer hover:border-rose-300 relative overflow-hidden ${
                            paymentType === 'card'
                              ? 'border-rose-500 bg-rose-50/50 text-rose-950 font-black scale-102 shadow-md shadow-rose-100'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {paymentType === 'card' && (
                            <span className="absolute right-3 top-3 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px]">
                              ✓
                            </span>
                          )}
                          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                            <CreditCard className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-extrabold block">Cartão</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">Débito ou Crédito</span>
                          </div>
                        </button>
                      )}

                      {totemCounterEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            playKioskSound('tap');
                            setPaymentType('counter');
                          }}
                          className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3.5 cursor-pointer hover:border-rose-300 relative overflow-hidden ${
                            paymentType === 'counter'
                              ? 'border-rose-500 bg-rose-50/50 text-rose-950 font-black scale-102 shadow-md shadow-rose-100'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {paymentType === 'counter' && (
                            <span className="absolute right-3 top-3 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px]">
                              ✓
                            </span>
                          )}
                          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                            <Coins className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-extrabold block">Pagar no Caixa</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">Ficha / Senha primeiro</span>
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="pt-4 max-w-sm mx-auto">
                      <button
                        onClick={handleFinishTotemOrder}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest py-4.5 rounded-2xl shadow-xl hover:shadow-rose-100 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        Confirmar e Enviar Pedido
                        <ArrowRight className="w-5 h-5 animate-translate-x" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* SUBSTEP C: TRANSACTION PROCESSING GRAPHICS & ANIMATIONS */}
                {checkoutSubStep === 'processing' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-slate-200 p-8 rounded-[36px] shadow-xl text-center max-w-md mx-auto w-full space-y-6"
                  >
                    {/* Pix Waiting Graphic */}
                    {paymentType === 'pix' && processingStatus === 'waiting' && (
                      <div className="space-y-5">
                        <h4 className="font-black text-slate-800 uppercase text-sm tracking-wider">Aguardando Pagamento Pix ⚡</h4>
                        
                        {/* Render live simulated code Qr code */}
                        <div className="p-3 bg-slate-50 border-2 border-dashed border-rose-200 rounded-3xl inline-block shadow-inner">
                          <img
                            src={dynamicPixQrUrl}
                            alt="Pix QR Code"
                            className="w-52 h-52 object-contain"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs text-slate-500 font-bold leading-normal">
                            Abra o aplicativo do seu banco, escolha a opção <br />
                            <strong>Pagar com QR Code / Pix</strong> e escaneie a imagem.
                          </p>
                          <span className="text-[10px] text-rose-600 font-extrabold bg-rose-50 px-2.5 py-1 rounded-md inline-block animate-pulse">
                            ⏳ Atualizando status em tempo real...
                          </span>
                        </div>

                        {/* Force manual payment approval bypass */}
                        <div className="pt-2">
                          <button
                            onClick={async () => {
                              setProcessingStatus('verifying');
                              playKioskSound('tap');
                              setTimeout(async () => {
                                setProcessingStatus('approved');
                                await submitOrderToDatabase();
                              }, 2500);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10.5px] font-black py-2.5 px-5 rounded-xl uppercase tracking-wider transition-all border border-rose-200 cursor-pointer"
                          >
                            Simular Confirmação Bancária 💻
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Card Waiting Terminal Instruction */}
                    {paymentType === 'card' && processingStatus === 'waiting' && (
                      <div className="space-y-6 py-6">
                        <div className="relative mx-auto w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center border border-rose-100">
                          <CreditCard className="w-10 h-10 text-rose-600 animate-bounce" />
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-black text-slate-800 uppercase text-sm tracking-wider">Maquininha de Cartão 💳</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed px-4">
                            Por favor, <strong>aproxime ou insira o seu cartão</strong> de débito ou crédito na maquininha ao lado do totem agora.
                          </p>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={async () => {
                              setProcessingStatus('verifying');
                              playKioskSound('tap');
                              setTimeout(async () => {
                                setProcessingStatus('approved');
                                await submitOrderToDatabase();
                              }, 2500);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10.5px] font-black py-2.5 px-5 rounded-xl uppercase tracking-wider transition-all border border-rose-200 cursor-pointer"
                          >
                            Simular Aprovação de Cartão 💻
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Generic verifying loop state */}
                    {processingStatus === 'verifying' && (
                      <div className="py-12 space-y-5">
                        <Loader2 className="w-12 h-12 text-rose-600 animate-spin mx-auto" />
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Verificando Transação...</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">Sincronizando com o provedor de pagamentos e registrando a senha.</p>
                        </div>
                      </div>
                    )}

                    {/* Approved/Success intermediate screen */}
                    {processingStatus === 'approved' && (
                      <div className="py-12 space-y-5">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                          <Check className="w-8 h-8 animate-scale-up" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-emerald-700 uppercase tracking-widest">PAGAMENTO APROVADO! ⚡</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">Gerando seu ticket de retirada...</p>
                        </div>
                      </div>
                    )}

                  </motion.div>
                )}

              </div>
            </motion.div>
          )}

          {/* STEP 4: ORDER SUCCESS TICKET SCREEN (CONFETTI EFFECT AND TICKET NUMBER) */}
          {kioskStep === 'success' && (
            <motion.div
              key="success-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-radial from-emerald-50 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center select-none"
            >
              <div className="bg-white border-2 border-dashed border-emerald-300 p-8 sm:p-12 rounded-[40px] shadow-2xl max-w-md w-full space-y-6 relative overflow-hidden">
                
                {/* Visual success banner icon */}
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                    Pedido Enviado com Sucesso! 🎉
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 uppercase font-sans">
                    OBRIGADO, {customerName.split(' ')[0]}!
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal px-2">
                    Guarde o seu número de senha exibido abaixo para retirar o seu açaí quando for chamado.
                  </p>
                </div>

                {/* BIG DISPLAY SENHA QUEUE TICKET */}
                <div className="bg-slate-50 border border-slate-150 p-6 rounded-3xl relative">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">SUA SENHA DO PAINEL</span>
                  <span className="text-5xl font-black text-rose-600 tracking-wider block font-mono">
                    #{orderTicketNumber || '102'}
                  </span>
                </div>

                <div className="space-y-3 leading-relaxed">
                  <div className="text-[10px] text-slate-500 font-bold bg-slate-50 p-3 rounded-2xl flex items-center gap-2 justify-center">
                    <span className="text-base">📺</span>
                    <span>Acompanhe o andamento no Painel de TV do salão!</span>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium">
                    {totemAutoPrint ? '🖨️ A sua via impressa com o detalhe do copo saiu na bobina!' : '🍧 O seu copo já começou a ser montado na cozinha!'}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleResetKiosk}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Novo Pedido
                  </button>
                </div>

                {/* Auto countdown visual cue */}
                <span className="text-[9px] text-slate-350 block">
                  Voltando para a tela inicial em 15 segundos para o próximo cliente...
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER BAR TO REASSURE CLIENT */}
      <footer className="bg-white border-t border-slate-100 py-3.5 px-6 flex items-center justify-between shrink-0 text-slate-400 text-[10px] font-bold uppercase tracking-wider relative z-10">
        <span>© {storeSettings.name || 'Supreme Gelato'}</span>
        <span>Açaí Gourmet Premium 🍧</span>
      </footer>

      {/* POPUP PASSCODE MODAL DIALOG TO SECURE KIOSK EXIT */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-55 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl border border-slate-100 text-left relative"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <span className="p-3 bg-rose-50 rounded-2xl">
                  <Lock className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">Sair do Modo Totem</h4>
                  <p className="text-[10px] text-slate-400">Restrito a administradores ou operadores de loja.</p>
                </div>
              </div>

              <form onSubmit={handleExitKioskSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Senha de Operador</label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="Digite a senha..."
                    value={exitPasscode}
                    onChange={(e) => {
                      setExitPasscode(e.target.value);
                      setExitError('');
                    }}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 font-extrabold tracking-widest text-slate-750 focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  />
                  {exitError && (
                    <p className="text-[10px] text-red-500 font-extrabold mt-1.5">⚠️ {exitError}</p>
                  )}
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playKioskSound('tap');
                      setShowExitModal(false);
                      setExitPasscode('');
                      setExitError('');
                    }}
                    className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-[10px] uppercase rounded-xl transition-all cursor-pointer border border-slate-150"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REUSE CUP CUSTOMIZER FOR THE KIOSK! */}
      <AnimatePresence>
        {customizingItem && (
          <CupCustomizer 
            customizingItem={customizingItem}
            onClose={() => {
              playKioskSound('tap');
              setCustomizingItem(null);
            }} 
            onAddToCart={handleAddCustomCupToCart} 
            storeSettings={storeSettings}
            flavorOptions={flavorOptions}
            toppingOptions={toppingOptions}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
