/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cardápio Digital para TV com Modo Exibição de Tela Cheia 16:9 (Otimizado para Smart TV)
 */

import React, { useState, useEffect } from 'react';
import { 
  Tv, Clock, Search, ExternalLink, Utensils, Flame, ArrowLeft
} from 'lucide-react';
import { MenuItem } from '../types';
import { MENU_ITEMS } from '../data';
import LazyImage from './LazyImage';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface AdminPainelTVProps {
  orders?: any[];
  storeSettings?: any;
}

export default function AdminPainelTV({ storeSettings }: AdminPainelTVProps) {
  const [viewMode, setViewMode] = useState<'control' | 'tv'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'tv_menu' || params.get('mode') === 'tv') return 'tv';
    }
    return 'control';
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load menu items from Firestore with localStorage cache
  useEffect(() => {
    async function loadMenu() {
      try {
        const cached = localStorage.getItem('supreme_menu_items');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMenuItems(parsed);
          }
        }
        const snap = await getDocs(collection(db, 'menu_items'));
        if (!snap.empty) {
          const list: MenuItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
          setMenuItems(list);
          localStorage.setItem('supreme_menu_items', JSON.stringify(list));
        }
      } catch (err) {
        console.warn('Could not load menu from firestore for TV cardapio:', err);
      }
    }
    loadMenu();
  }, []);

  const categories = [
    { id: 'all', name: '✨ Todos os Produtos' },
    { id: 'acai', name: '🥣 Açaí Gourmet' },
    { id: 'milkshake', name: '🥤 Milkshakes' },
    { id: 'copos_especiais', name: '🍨 Copos Especiais' },
    { id: 'milkshake_especiais', name: '🍫 Especiais Supreme' }
  ];

  const filteredItems = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory || (selectedCategory === 'acai' && item.category?.includes('acai'));
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenTVTab = () => {
    const url = window.location.origin + '?mode=tv_menu';
    window.open(url, 'supreme_tv_menu');
  };

  // If in standalone TV Mode, render full-screen 16:9 optimized TV presentation
  if (viewMode === 'tv') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 text-white overflow-y-auto p-6 sm:p-10 flex flex-col justify-between select-none">
        {/* TV Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🍨</span>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">SORVETERIA GOURMET SUPREME</h1>
              <p className="text-xs text-rose-400 font-extrabold uppercase tracking-widest">Cardápio Digital Oficial • Exibição em TV</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="font-mono text-xl font-black bg-white/10 px-6 py-2.5 rounded-2xl text-emerald-400 border border-white/10 shadow-lg">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>

            <button
              onClick={() => setViewMode('control')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase rounded-xl border border-white/10 cursor-pointer flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
            </button>
          </div>
        </div>

        {/* Categories Bar in TV Mode */}
        <div className="flex items-center justify-center gap-3 mb-8 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/30 scale-105'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Full TV Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 my-auto text-left pb-8">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between group transform hover:-translate-y-1 transition-all duration-300"
            >
              <div>
                <div className="relative h-56 w-full overflow-hidden bg-slate-950">
                  <LazyImage 
                    src={item.image || '/assets/images/supreme_acai_cup_1781179584520.jpg'} 
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90" />
                  
                  <div className="absolute bottom-4 right-4 bg-rose-600 text-white font-mono font-black text-lg px-4 py-2 rounded-2xl shadow-2xl border border-rose-400/40">
                    R$ {item.price.toFixed(2).replace('.', ',')}
                  </div>

                  {item.popular && (
                    <span className="absolute top-4 left-4 bg-amber-500 text-slate-950 font-black text-[10px] uppercase px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-lg">
                      <Flame className="w-3.5 h-3.5 fill-slate-950" /> Mais Pedido
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <h3 className="text-xl font-black text-white leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="px-6 pb-6 pt-0 flex flex-wrap gap-2">
                  {item.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-black uppercase bg-white/5 text-rose-300 px-2.5 py-1 rounded-xl border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* TV Footer Ticker */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between text-slate-300 text-sm gap-3 mt-auto">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <strong className="text-white">Monte seu copo premium com adicionais ilimitados!</strong>
          </div>
          <div className="text-rose-400 font-extrabold uppercase tracking-wider text-xs">
            Acesse pelo celular ou peça no balcão 🍨
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 sm:p-8 min-h-[600px] shadow-2xl">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-5 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <Tv className="w-6 h-6 animate-pulse" />
          </span>
          <div className="text-left">
            <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
              Cardápio Digital para TV <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">ATIVO</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Exibição completa de produtos com imagens, descrições e preços</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            type="button"
            onClick={() => setViewMode('tv')}
            className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center gap-2 shadow-lg transition-all active:scale-97"
          >
            <Tv className="w-4 h-4" />
            Entrar no Modo Exibição TV (Tela Cheia)
          </button>

          <button
            type="button"
            onClick={handleOpenTVTab}
            className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
            title="Abrir em Nova Aba"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category filter tabs & search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Menu Grid Display */}
      {filteredItems.length === 0 ? (
        <div className="py-20 text-center text-slate-400 space-y-2">
          <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs font-black uppercase tracking-wider">Nenhum produto encontrado nesta categoria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className="bg-slate-800/80 border border-slate-700/80 rounded-3xl overflow-hidden shadow-xl hover:border-rose-500/50 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                  <LazyImage 
                    src={item.image || '/assets/images/supreme_acai_cup_1781179584520.jpg'} 
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                  
                  <div className="absolute bottom-3 right-3 bg-rose-600 text-white font-mono font-black text-sm px-3 py-1.5 rounded-2xl shadow-lg border border-rose-400/30">
                    R$ {item.price.toFixed(2).replace('.', ',')}
                  </div>

                  {item.popular && (
                    <span className="absolute top-3 left-3 bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md">
                      <Flame className="w-3 h-3 fill-slate-950" /> Mais Pedido
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-2">
                  <h4 className="text-base font-black text-white group-hover:text-rose-400 transition-colors leading-tight">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="px-5 pb-5 pt-0 flex flex-wrap gap-1.5">
                  {item.tags.map((tag, idx) => (
                    <span key={idx} className="text-[9px] font-black uppercase bg-white/5 text-rose-300 px-2 py-0.5 rounded-lg border border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-slate-400 text-xs gap-3">
        <div className="flex items-center gap-2">
          <span>🍨</span>
          <strong className="text-white">Sorveteria Supreme</strong> • Cardápio Digital Oficial para Exibição em TV
        </div>
        <p className="text-[10px] text-slate-400 font-semibold">
          Atualizado em tempo real com o painel do administrador.
        </p>
      </div>

    </div>
  );
}
