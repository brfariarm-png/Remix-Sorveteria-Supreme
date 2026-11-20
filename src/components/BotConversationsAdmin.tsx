import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

interface Conversation {
  id: string;
  telefone: string;
  botPausado: boolean;
  pausadoEm?: string | null;
  ultimaSaudacaoEm?: string | null;
  ultimoAvisoFechadoEm?: string | null;
  pushName?: string;
  ultimaMensagem?: string;
  updatedAt?: string | null;
}

export function BotConversationsAdmin() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionLoadingPhone, setActionLoadingPhone] = useState<string | null>(null);
  const [backendUrl] = useState<string>('https://supreme-whatsapp-server.onrender.com');

  const fetchConversations = async (isRetry = false) => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário administrador não autenticado.');
      }
      const token = await user.getIdToken(true);

      const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/bot/conversas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: AbortSignal.timeout(65000)
      });

      if (!res.ok) {
        throw new Error(`Erro ao carregar conversas (HTTP ${res.status})`);
      }

      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      console.error('Erro ao buscar conversas:', err);
      if (!isRetry) {
        // Retry once after 3 seconds in case Render server was sleeping
        setTimeout(() => fetchConversations(true), 3000);
        return;
      }
      setError(err.message || 'Falha ao conectar com o servidor do bot no Render. O servidor pode estar dormindo, tente novamente em alguns instantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleTogglePause = async (telefone: string, isCurrentlyPaused: boolean) => {
    setActionLoadingPhone(telefone);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Não autenticado');
      const token = await user.getIdToken(true);
      const endpoint = isCurrentlyPaused ? 'retomar' : 'pausar';

      const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/bot/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ telefone }),
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}`);
      }

      // Optimistic update
      setConversations(prev => prev.map(c => {
        if (c.telefone === telefone || c.id === telefone) {
          return {
            ...c,
            botPausado: !isCurrentlyPaused,
            pausadoEm: !isCurrentlyPaused ? new Date().toISOString() : null,
            ultimaSaudacaoEm: isCurrentlyPaused ? null : c.ultimaSaudacaoEm,
            ultimoAvisoFechadoEm: isCurrentlyPaused ? null : c.ultimoAvisoFechadoEm
          };
        }
        return c;
      }));
    } catch (err: any) {
      alert(`Erro ao alterar estado do bot: ${err.message || err}`);
    } finally {
      setActionLoadingPhone(null);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return `+${cleaned}`;
  };

  const filteredConversations = conversations.filter(c => 
    c.telefone.includes(searchTerm) || (c.pushName && c.pushName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-left">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🤖</span> Conversas do Bot do WhatsApp
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle interativo das conversas gerenciadas pelo servidor no Render (<code>{backendUrl}</code>).
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar por telefone ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 w-full md:w-64 transition-all"
          />
          <button
            onClick={() => fetchConversations()}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <span>🔄</span> Atualizar
          </button>
        </div>
      </div>

      {/* Loading state with wake-up notice */}
      {loading && (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-xs text-center space-y-3">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-700">Carregando conversas do servidor...</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Nota: O servidor gratuito no Render pode levar até 1 minuto para acordar na primeira requisição. Por favor, aguarde.
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>⚠️</span> Erro de Conexão com o Servidor
          </div>
          <p className="text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => fetchConversations()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Conversations List */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Cliente ({filteredConversations.length})</span>
            <span>Ações & Status</span>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Nenhuma conversa registrada no Firestore ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((conv) => {
                const isPaused = conv.botPausado === true;
                const isActionLoading = actionLoadingPhone === conv.telefone;

                return (
                  <div key={conv.id || conv.telefone} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-slate-900">
                          {formatPhone(conv.telefone)}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          isPaused 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isPaused ? '🤖 Bot Pausado' : '🟢 Bot Ativo'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {conv.pushName && (
                          <span>👤 <strong>{conv.pushName}</strong></span>
                        )}
                        {conv.ultimaMensagem && (
                          <span className="text-slate-600 truncate max-w-xs">💬 "{conv.ultimaMensagem}"</span>
                        )}
                        {conv.pausadoEm && isPaused && (
                          <span className="text-amber-600 text-[11px]">Pausado em: {new Date(conv.pausadoEm).toLocaleString('pt-BR')}</span>
                        )}
                        {conv.updatedAt && (
                          <span className="text-slate-400 text-[11px]">Última atividade: {new Date(conv.updatedAt).toLocaleString('pt-BR')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleTogglePause(conv.telefone, isPaused)}
                        disabled={isActionLoading}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                          isPaused
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                      >
                        {isActionLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : isPaused ? (
                          <span>▶️ Retomar bot</span>
                        ) : (
                          <span>⏸️ Pausar bot</span>
                        )}
                      </button>

                      <a
                        href={`https://wa.me/${conv.telefone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>💬</span> Abrir WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
