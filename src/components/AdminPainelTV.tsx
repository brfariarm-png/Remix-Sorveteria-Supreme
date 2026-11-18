/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cardápio Digital para TV • Modo Apresentação (Imagem em tamanho original e nome, sem valores)
 */

import React, { useState, useEffect } from 'react';
import { 
  Tv, ExternalLink, ArrowLeft, Play, Pause, ChevronLeft, ChevronRight, Flame
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
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
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
    { id: 'all', name: '✨ Todos' },
    { id: 'acai', name: '🥣 Açaí' },
    { id: 'milkshake', name: '🥤 Milkshakes' },
    { id: 'copos_especiais', name: '🍨 Copos Especiais' }
  ];

  const rawFiltered = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory || (selectedCategory === 'acai' && item.category?.includes('acai'));
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });
  const filteredItems = rawFiltered.length > 0 ? rawFiltered : (menuItems.length > 0 ? menuItems : MENU_ITEMS);

  // Auto-advance slideshow in TV mode
  useEffect(() => {
    if (viewMode !== 'tv' || !isPlaying || filteredItems.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
    }, 4500); // 4.5 seconds per item

    return () => clearInterval(interval);
  }, [viewMode, isPlaying, filteredItems.length]);

  const handleOpenTVTab = () => {
    const url = window.location.origin + '?mode=tv_menu';
    window.open(url, 'supreme_tv_menu');
  };

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || menuItems[0];

  // If in standalone TV Mode, render Fullscreen Presentation with original image size and NO prices
  if (viewMode === 'tv') {
    return (
      <div 
        style={{ backgroundColor: '#020617', color: '#ffffff', opacity: 1 }}
        className="fixed inset-0 z-[9999] bg-slate-950 text-white overflow-hidden flex flex-col justify-between select-none"
      >
        
        {/* TV Header */}
        <div className="flex items-center justify-between px-8 py-5 bg-gradient-to-b from-slate-950/90 to-transparent z-20 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🍨</span>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">SORVETERIA GOURMET SUPREME</h1>
              <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Cardápio Digital • Exibição em TV</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase rounded-xl border border-white/10 cursor-pointer flex items-center gap-2 transition-all shadow-lg"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pausar' : 'Reproduzir'}
            </button>

            <div className="font-mono text-lg font-black bg-white/10 px-5 py-2 rounded-xl text-emerald-400 border border-white/10 shadow-lg">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>

            <button
              onClick={() => setViewMode('control')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase rounded-xl border border-white/10 cursor-pointer flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Sair da TV
            </button>
          </div>
        </div>

        {/* Center Main Presentation: Original Image Size & Name (NO prices) */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-hidden">
          
          {filteredItems.length === 0 ? (
            <div className="text-center text-slate-400">
              <p className="text-xl font-bold">Nenhum produto encontrado nesta categoria.</p>
            </div>
          ) : (
            <div className="relative w-full max-w-5xl h-[72vh] flex flex-col items-center justify-center">
              
              {/* Image in Original Proportion (object-contain) */}
              <div className="relative w-full h-[58vh] flex items-center justify-center rounded-3xl overflow-hidden bg-black/40 border-2 border-white/10 shadow-2xl group p-4">
                <img 
                  key={currentItem?.id}
                  src={currentItem?.image || '/assets/images/supreme_acai_cup_1781179584520.jpg'} 
                  alt={currentItem?.name}
                  loading="eager"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full w-auto h-auto object-contain animate-fade-in transition-all duration-700 drop-shadow-2xl"
                />

                {currentItem?.popular && (
                  <span className="absolute top-4 left-4 bg-amber-500 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-2xl">
                    <Flame className="w-4 h-4 fill-slate-950" /> Destaque Supreme
                  </span>
                )}
              </div>

              {/* Giant Product Name */}
              <div className="mt-6 text-center space-y-1.5 z-10">
                <h2 className="text-3xl sm:text-5xl font-black text-white tracking-wide drop-shadow-lg">
                  {currentItem?.name}
                </h2>
              </div>

              {/* Manual Left/Right Navigation Arrows */}
              <button 
                onClick={() => setCurrentIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)}
                className="absolute left-[-20px] sm:left-[-40px] top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/25 rounded-full text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-2xl"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={() => setCurrentIndex((prev) => (prev + 1) % filteredItems.length)}
                className="absolute right-[-20px] sm:right-[-40px] top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/25 rounded-full text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-2xl"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          )}
        </div>

        {/* TV Bottom Footer Indicator */}
        <div className="flex items-center justify-between px-8 py-4 bg-slate-900 border-t border-white/10 text-slate-400 text-xs shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white font-bold">Apresentação Automática Ativa</span>
          </div>

          <div className="flex items-center gap-2">
            {filteredItems.map((_, idx) => (
              <span 
                key={idx} 
                className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-rose-500' : 'w-2 bg-white/20'}`} 
              />
            ))}
          </div>

          <div className="text-rose-400 font-extrabold uppercase tracking-wider">
            Item {currentIndex + 1} de {filteredItems.length}
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
            <p className="text-[10px] text-slate-400 font-bold uppercase">Modo Apresentação (Apenas imagem em tamanho original e nome)</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            type="button"
            onClick={() => setViewMode('tv')}
            className="py-2.5 px-5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer flex items-center gap-2 shadow-lg transition-all active:scale-97"
          >
            <Tv className="w-4 h-4" />
            Iniciar Modo Apresentação TV (Tela Cheia)
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

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
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

      {/* Admin Preview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {filteredItems.map((item, idx) => (
          <div 
            key={item.id}
            onClick={() => {
              setCurrentIndex(idx);
              setViewMode('tv');
            }}
            className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg hover:border-rose-500 transition-all cursor-pointer group p-3 flex flex-col items-center text-center"
          >
            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-900 mb-3">
              <LazyImage src={item.image || ''} alt={item.name} className="w-full h-full object-contain" />
            </div>
            <h4 className="text-xs font-black text-white group-hover:text-rose-400 transition-colors leading-tight mb-1">
              {item.name}
            </h4>
            <span className="text-slate-400 text-[10px] font-bold">Sem preço na TV</span>
          </div>
        ))}
      </div>

    </div>
  );
}
