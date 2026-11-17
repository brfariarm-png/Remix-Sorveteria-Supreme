import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

type SupportRequest = {
  id: string;
  phone: string;
  name: string;
  message: string;
  createdMs: number;
};

/**
 * Alerta de "cliente chamando atendente" (opção 4 do bot de WhatsApp).
 * Toca um toque de telefone em loop e mostra uma faixa vermelha no topo do painel
 * até o administrador clicar em "Atender" ou "Marcar como atendido".
 * Deve ser exibido SOMENTE para o administrador.
 */
export default function SupportCallAlert() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [silenced, setSilenced] = useState<string[]>([]);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const [, forceTick] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);

  // Escuta só os chamados abertos (consulta pequena: gasta pouquíssimas leituras)
  useEffect(() => {
    const q = query(collection(db, 'support_requests'), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupportRequest[] = snap.docs.map((d) => {
          const data: any = d.data();
          const created = data?.createdAt;
          const createdMs =
            typeof created?.toMillis === 'function' ? created.toMillis() : Date.parse(String(created || '')) || Date.now();
          return {
            id: d.id,
            phone: String(data?.phone || ''),
            name: String(data?.name || 'Cliente'),
            message: String(data?.message || ''),
            createdMs
          };
        });
        list.sort((a, b) => a.createdMs - b.createdMs);
        setRequests(list);
      },
      () => {
        // Sem permissão ou sem internet: não derruba o painel
      }
    );
    return () => unsub();
  }, []);

  const ringing = requests.some((r) => !silenced.includes(r.id));

  // Toque contínuo enquanto houver chamado aberto e não silenciado
  useEffect(() => {
    if (!ringing) return;

    const AudioContextClass: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContextClass();
      } catch {
        return;
      }
    }

    const unlock = () => {
      ctxRef.current?.resume().then(() => setNeedsSoundTap(false)).catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const ringOnce = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx.state !== 'running') {
        setNeedsSoundTap(true);
        return;
      }
      setNeedsSoundTap(false);
      const t0 = ctx.currentTime;
      // Toque de telefone: dois "brrr" (440 Hz + 480 Hz)
      [0, 0.6].forEach((offset) => {
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t0 + offset);
          gain.gain.linearRampToValueAtTime(0.3, t0 + offset + 0.04);
          gain.gain.setValueAtTime(0.3, t0 + offset + 0.42);
          gain.gain.linearRampToValueAtTime(0, t0 + offset + 0.48);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0 + offset);
          osc.stop(t0 + offset + 0.5);
        });
      });
      try {
        navigator.vibrate?.([300, 150, 300]);
      } catch {
        // ignorado
      }
    };

    ringOnce();
    const ringTimer = window.setInterval(ringOnce, 3500);

    // Título da aba piscando
    const originalTitle = document.title;
    let flag = false;
    const titleTimer = window.setInterval(() => {
      flag = !flag;
      document.title = flag ? '📞 CLIENTE CHAMANDO!' : originalTitle;
    }, 900);

    // Atualiza o "há X min" da faixa
    const clockTimer = window.setInterval(() => forceTick((n) => n + 1), 30000);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.clearInterval(ringTimer);
      window.clearInterval(titleTimer);
      window.clearInterval(clockTimer);
      document.title = originalTitle;
    };
  }, [ringing]);

  const markAnswered = async (r: SupportRequest) => {
    setSilenced((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
    setRequests((prev) => prev.filter((x) => x.id !== r.id));
    try {
      await updateDoc(doc(db, 'support_requests', r.id), {
        status: 'answered',
        answeredAt: new Date().toISOString()
      });
    } catch {
      // Se não conseguir gravar, ao menos some da tela neste aparelho
    }
  };

  const openWhatsApp = (r: SupportRequest) => {
    const digits = r.phone.replace(/\D/g, '');
    if (digits) window.open(`https://wa.me/${digits}`, '_blank', 'noopener');
    void markAnswered(r);
  };

  const silenceAll = () => setSilenced(requests.map((r) => r.id));

  if (requests.length === 0) return null;

  const first = requests[0];
  const minutes = Math.max(0, Math.round((Date.now() - first.createdMs) / 60000));
  const extra = requests.length - 1;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[3000] bg-red-600 text-white shadow-2xl border-b-4 border-red-900"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-3xl animate-bounce" aria-hidden="true">📞</span>
          <div className="min-w-0">
            <p className="font-black uppercase tracking-wide text-sm md:text-base">
              Cliente chamando atendente{extra > 0 ? ` (+${extra} na fila)` : ''}
            </p>
            <p className="text-sm truncate">
              {first.name} · {first.phone || 'sem número'} · há {minutes} min
            </p>
            {needsSoundTap && (
              <p className="text-xs font-bold bg-white/20 rounded px-2 py-0.5 mt-1 inline-block">
                Toque em qualquer lugar da tela para ativar o som
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openWhatsApp(first)}
            className="bg-white text-red-700 font-black text-sm px-4 py-2 rounded-lg hover:bg-red-50"
          >
            Atender no WhatsApp
          </button>
          <button
            type="button"
            onClick={() => void markAnswered(first)}
            className="bg-red-800 text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-red-900"
          >
            Marcar como atendido
          </button>
          {ringing && (
            <button
              type="button"
              onClick={silenceAll}
              className="bg-transparent border border-white/70 text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-white/10"
            >
              🔇 Silenciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
