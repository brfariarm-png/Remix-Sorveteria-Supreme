import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  IceCream, 
  Image, 
  Check, 
  AlertTriangle, 
  Save, 
  RotateCcw, 
  Tag,
  Star,
  Sparkles,
  Sliders,
  X,
  PlusCircle,
  FolderOpen,
  Upload,
  Download
} from 'lucide-react';
import { collection, addDoc, setDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MenuItem, StoreSettings } from '../types';
import { MENU_ITEMS, FLAVOR_OPTIONS, TOPPING_OPTIONS } from '../data';

interface AdminCardapioProps {
  menuItems: MenuItem[];
  onRefreshMenu?: () => void;
  storeSettings?: StoreSettings;
  onUpdateSettings?: (settings: StoreSettings) => Promise<void> | void;
  flavorOptions: any[];
  toppingOptions: any[];
}

export default function AdminCardapio({ 
  menuItems, 
  onRefreshMenu, 
  storeSettings, 
  onUpdateSettings,
  flavorOptions = FLAVOR_OPTIONS,
  toppingOptions = TOPPING_OPTIONS
}: AdminCardapioProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'sizes_prices' | 'flavors_toppings' | 'digital_board'>('products');

  // States for cup sizes base prices editing
  const [price300, setPrice300] = useState<string>(() => String(storeSettings?.cupPrices?.['300ml'] ?? 18));
  const [price400, setPrice400] = useState<string>(() => String(storeSettings?.cupPrices?.['400ml'] ?? 21));
  const [price500, setPrice500] = useState<string>(() => String(storeSettings?.cupPrices?.['500ml'] ?? 25));
  const [price700, setPrice700] = useState<string>(() => String(storeSettings?.cupPrices?.['700ml'] ?? 35));

  const [label300, setLabel300] = useState<string>(() => storeSettings?.cupLabels?.['300ml'] ?? '300ml');
  const [label400, setLabel400] = useState<string>(() => storeSettings?.cupLabels?.['400ml'] ?? '400ml');
  const [label500, setLabel500] = useState<string>(() => storeSettings?.cupLabels?.['500ml'] ?? '500ml');
  const [label700, setLabel700] = useState<string>(() => storeSettings?.cupLabels?.['700ml'] ?? '700ml');

  const [msPrice300, setMsPrice300] = useState<string>(() => String(storeSettings?.milkshakePrices?.['300ml'] ?? 15));
  const [msPrice400, setMsPrice400] = useState<string>(() => String(storeSettings?.milkshakePrices?.['400ml'] ?? 18));
  const [msPrice500, setMsPrice500] = useState<string>(() => String(storeSettings?.milkshakePrices?.['500ml'] ?? 21));
  const [msPrice700, setMsPrice700] = useState<string>(() => String(storeSettings?.milkshakePrices?.['700ml'] ?? 25));

  const [msLabel300, setMsLabel300] = useState<string>(() => storeSettings?.milkshakeLabels?.['300ml'] ?? '300ml');
  const [msLabel400, setMsLabel400] = useState<string>(() => storeSettings?.milkshakeLabels?.['400ml'] ?? '400ml');
  const [msLabel500, setMsLabel500] = useState<string>(() => storeSettings?.milkshakeLabels?.['500ml'] ?? '500ml');
  const [msLabel700, setMsLabel700] = useState<string>(() => storeSettings?.milkshakeLabels?.['700ml'] ?? '700ml');

  const [brPrice400, setBrPrice400] = useState<string>(() => String(storeSettings?.browniePrices?.['400ml'] ?? 22.90));
  const [brPrice500, setBrPrice500] = useState<string>(() => String(storeSettings?.browniePrices?.['500ml'] ?? 28.90));
  const [brPrice700, setBrPrice700] = useState<string>(() => String(storeSettings?.browniePrices?.['700ml'] ?? 34.90));

  const [brLabel400, setBrLabel400] = useState<string>(() => storeSettings?.brownieLabels?.['400ml'] ?? 'Copo Brownie 400ml');
  const [brLabel500, setBrLabel500] = useState<string>(() => storeSettings?.brownieLabels?.['500ml'] ?? 'Caixinha Brownie 500ml');
  const [brLabel700, setBrLabel700] = useState<string>(() => storeSettings?.brownieLabels?.['700ml'] ?? 'Balde Brownie 700ml');

  // Digital Board editable settings states
  const [boardTitle, setBoardTitle] = useState<string>(() => storeSettings?.boardTitle ?? 'Supreme');
  const [boardSubtitle, setBoardSubtitle] = useState<string>(() => storeSettings?.boardSubtitle ?? 'SORVETERIA');
  const [boardSlogan, setBoardSlogan] = useState<string>(() => storeSettings?.boardSlogan ?? 'NÃO É SÓ SORVETE, É EXPERIÊNCIA.');
  const [boardPhone, setBoardPhone] = useState<string>(() => storeSettings?.boardPhone ?? storeSettings?.phone ?? '(19) 97411-8672');
  const [boardInstagram, setBoardInstagram] = useState<string>(() => storeSettings?.boardInstagram ?? storeSettings?.instagram ?? '@sorveteria.supreme');
  const [boardCustomNote, setBoardCustomNote] = useState<string>(() => storeSettings?.boardCustomNote ?? 'PEÇA PELO WHATSAPP!');
  const [boardMsFlavorList, setBoardMsFlavorList] = useState<string>(() => storeSettings?.boardMsFlavorList ?? 'Chocolate, Baunilha, Ninho Trufado, Morango, Morango com Nutella, Banana com Nutella, Iogurte com Frutas Vermelhas');
  const [boardCortesiasList, setBoardCortesiasList] = useState<string>(() => storeSettings?.boardCortesiasList ?? 'Leite condensado, leite em pó, banana, morango e granola');
  const [boardAdicionaisList, setBoardAdicionaisList] = useState<string>(() => storeSettings?.boardAdicionaisList ?? 'Morango R$ 4, Banana R$ 2, Ovomaltine R$ 2, Paçoca R$ 2, Amendoim R$ 2, Nutella R$ 5, Copo trufado Nutella R$ 6, Cereja R$ 5');

  const [savingPrices, setSavingPrices] = useState(false);

  React.useEffect(() => {
    if (storeSettings?.cupPrices) {
      setPrice300(String(storeSettings.cupPrices['300ml']));
      setPrice400(String(storeSettings.cupPrices['400ml']));
      setPrice500(String(storeSettings.cupPrices['500ml']));
      setPrice700(String(storeSettings.cupPrices['700ml']));
    }
    if (storeSettings?.cupLabels) {
      setLabel300(storeSettings.cupLabels['300ml'] || '300ml');
      setLabel400(storeSettings.cupLabels['400ml'] || '400ml');
      setLabel500(storeSettings.cupLabels['500ml'] || '500ml');
      setLabel700(storeSettings.cupLabels['700ml'] || '700ml');
    }
    if (storeSettings?.milkshakePrices) {
      setMsPrice300(String(storeSettings.milkshakePrices['300ml']));
      setMsPrice400(String(storeSettings.milkshakePrices['400ml']));
      setMsPrice500(String(storeSettings.milkshakePrices['500ml']));
      setMsPrice700(String(storeSettings.milkshakePrices['700ml']));
    }
    if (storeSettings?.milkshakeLabels) {
      setMsLabel300(storeSettings.milkshakeLabels['300ml'] || '300ml');
      setMsLabel400(storeSettings.milkshakeLabels['400ml'] || '400ml');
      setMsLabel500(storeSettings.milkshakeLabels['500ml'] || '500ml');
      setMsLabel700(storeSettings.milkshakeLabels['700ml'] || '700ml');
    }
    if (storeSettings?.browniePrices) {
      setBrPrice400(String(storeSettings.browniePrices['400ml']));
      setBrPrice500(String(storeSettings.browniePrices['500ml']));
      setBrPrice700(String(storeSettings.browniePrices['700ml']));
    }
    if (storeSettings?.brownieLabels) {
      setBrLabel400(storeSettings.brownieLabels['400ml'] || 'Copo Brownie 400ml');
      setBrLabel500(storeSettings.brownieLabels['500ml'] || 'Caixinha Brownie 500ml');
      setBrLabel700(storeSettings.brownieLabels['700ml'] || 'Balde Brownie 700ml');
    }
    if (storeSettings) {
      setBoardTitle(storeSettings.boardTitle ?? 'Supreme');
      setBoardSubtitle(storeSettings.boardSubtitle ?? 'SORVETERIA');
      setBoardSlogan(storeSettings.boardSlogan ?? 'NÃO É SÓ SORVETE, É EXPERIÊNCIA.');
      setBoardPhone(storeSettings.boardPhone ?? storeSettings.phone ?? '(19) 97411-8672');
      setBoardInstagram(storeSettings.boardInstagram ?? storeSettings.instagram ?? '@sorveteria.supreme');
      setBoardCustomNote(storeSettings.boardCustomNote ?? 'PEÇA PELO WHATSAPP!');
      setBoardMsFlavorList(storeSettings.boardMsFlavorList ?? 'Chocolate, Baunilha, Ninho Trufado, Morango, Morango com Nutella, Banana com Nutella, Iogurte com Frutas Vermelhas');
      setBoardCortesiasList(storeSettings.boardCortesiasList ?? 'Leite condensado, leite em pó, banana, morango e granola');
      setBoardAdicionaisList(storeSettings.boardAdicionaisList ?? 'Morango R$ 4, Banana R$ 2, Ovomaltine R$ 2, Paçoca R$ 2, Amendoim R$ 2, Nutella R$ 5, Copo trufado Nutella R$ 6, Cereja R$ 5');
    }
  }, [
    storeSettings?.cupPrices, 
    storeSettings?.cupLabels, 
    storeSettings?.milkshakePrices, 
    storeSettings?.milkshakeLabels, 
    storeSettings?.browniePrices, 
    storeSettings?.brownieLabels,
    storeSettings?.boardTitle,
    storeSettings?.boardSubtitle,
    storeSettings?.boardSlogan,
    storeSettings?.boardPhone,
    storeSettings?.boardInstagram,
    storeSettings?.boardCustomNote,
    storeSettings?.boardMsFlavorList,
    storeSettings?.boardCortesiasList,
    storeSettings?.boardAdicionaisList
  ]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenBoardOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [isFullscreenBoardOpen, setIsFullscreenBoardOpen] = useState(false);

  // Dynamic products filtering for the Digital Board (so it stays 100% synced with Menu edits)
  const specialCups = useMemo(() => {
    return menuItems.filter(item => 
      item.id !== 'acai-supreme' && (
        item.category === 'acai' || 
        item.category === 'sundae' || 
        item.category === 'sorvete' ||
        item.name.toLowerCase().includes('copo') ||
        item.name.toLowerCase().includes('trufado') ||
        item.name.toLowerCase().includes('felicidade')
      )
    ).slice(0, 3);
  }, [menuItems]);

  const premiumShakes = useMemo(() => {
    return menuItems.filter(item => 
      item.category === 'milkshake' && 
      item.id !== 'milkshake-gourmet-supreme'
    ).slice(0, 3);
  }, [menuItems]);

  const baldesAndCafes = useMemo(() => {
    return menuItems.filter(item => 
      item.name.toLowerCase().includes('balde') || 
      item.name.toLowerCase().includes('café') || 
      item.name.toLowerCase().includes('coffee') || 
      item.name.toLowerCase().includes('frappuccino') ||
      item.name.toLowerCase().includes('affogato') ||
      item.category === 'bebidas' ||
      item.category === 'combos'
    ).slice(0, 3);
  }, [menuItems]);

  const [search, setSearch] = useState('');

  const exportProductsToCSV = () => {
    try {
      const headers = ['ID_Produto', 'Nome', 'Descricao', 'Preco', 'Categoria', 'Popular', 'Customizavel', 'Modo_Tamanho', 'Preco_Tamanho_Unico'];
      const csvRows = [headers.join(';')];

      menuItems.forEach(item => {
        const row = [
          item.id,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.price.toFixed(2),
          item.category,
          item.popular ? 'Sim' : 'Nao',
          item.customizable ? 'Sim' : 'Nao',
          item.sizeMode || 'multi',
          (item.singleSizePrice ?? 0).toFixed(2)
        ];
        csvRows.push(row.join(';'));
      });

      const csvContent = "\uFEFF" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `produtos_cardapio_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessMsg('✅ Catálogo de produtos exportado para o computador!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao exportar cardápio: ' + err.message);
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  // Temporary Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('0.00');
  const [category, setCategory] = useState<string>('acai');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [tagsString, setTagsString] = useState('');
  const [allowedToppings, setAllowedToppings] = useState<string[]>([]);
  const [allowedFlavors, setAllowedFlavors] = useState<string[]>([]);

  // New size-mode states for customizable products
  const [sizeMode, setSizeMode] = useState<'default' | 'single' | 'custom'>('default');
  const [singleSizeLabel, setSingleSizeLabel] = useState('Tamanho Único');
  const [singleSizePrice, setSingleSizePrice] = useState('15.00');
  const [customSizes, setCustomSizes] = useState<Record<string, { active: boolean; price: number; label: string }>>({
    '300ml': { active: true, price: 18, label: '300ml' },
    '400ml': { active: true, price: 21, label: '400ml' },
    '500ml': { active: true, price: 25, label: '500ml' },
    '700ml': { active: true, price: 35, label: '700ml' },
  });

  // Status/Messages
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // State for Custom Confirmation Modal (to bypass blocked window.confirm in iframe)
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // States for Flavors and Toppings tab management
  const [flavorName, setFlavorName] = useState('');
  const [flavorColor, setFlavorColor] = useState('#e11d48'); // rose-600
  const [flavorCategory, setFlavorCategory] = useState<'acai' | 'sorvete'>('sorvete');
  const [flavorDescription, setFlavorDescription] = useState('');
  
  const [toppingName, setToppingName] = useState('');
  const [toppingPrice, setToppingPrice] = useState('0');
  const [toppingCategory, setToppingCategory] = useState<'calda' | 'fruta' | 'crocante' | 'creme'>('creme');

  const [savingFlvTop, setSavingFlvTop] = useState(false);

  // Compute unique non-standard categories in database
  const uniqueCategories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    const standardValues = ['acai', 'sorvete', 'milkshake', 'sundae', 'combo', 'custom'];
    return Array.from(cats).filter(c => c && !standardValues.includes(c));
  }, [menuItems]);

  const adminFilterCategories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    const standards = ['acai', 'sorvete', 'milkshake', 'sundae', 'combo'];
    const list = [
      { value: 'all', label: 'Todos' },
      { value: 'acai', label: 'Açaí' },
      { value: 'sorvete', label: 'Sorvete' },
      { value: 'milkshake', label: 'Milkshake' },
      { value: 'sundae', label: 'Sundae' },
      { value: 'combo', label: 'Combos' }
    ];
    Array.from(cats).forEach(cat => {
      if (cat && !standards.includes(cat)) {
        list.push({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1)
        });
      }
    });
    return list;
  }, [menuItems]);

  const handleAddFlavor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flavorName.trim()) return;
    setSavingFlvTop(true);
    try {
      const generatedId = 'flavor_' + Date.now();
      const newFlavor = {
        id: generatedId,
        name: flavorName.trim(),
        color: flavorColor,
        category: flavorCategory,
        description: flavorDescription.trim() || 'Sabor adicional do cardápio'
      };
      await setDoc(doc(db, 'flavor_options', generatedId), newFlavor);
      setFlavorName('');
      setFlavorDescription('');
      setSuccessMsg(`🍨 Sabor "${newFlavor.name}" cadastrado com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar sabor no Firestore');
      setTimeout(() => setErrorMsg(''), 2500);
    } finally {
      setSavingFlvTop(false);
    }
  };

  const handleDeleteFlavor = async (id: string, nameFlv: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Sabor',
      message: `Tem certeza que deseja remover o sabor "${nameFlv}"?`,
      onConfirm: async () => {
        setConfirmModal(null);
        setSavingFlvTop(true);
        try {
          await deleteDoc(doc(db, 'flavor_options', id));
          setSuccessMsg(`🗑️ Sabor "${nameFlv}" removido com sucesso!`);
          setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) {
          console.error(err);
          setErrorMsg('Erro ao remover sabor');
          setTimeout(() => setErrorMsg(''), 2500);
        } finally {
          setSavingFlvTop(false);
        }
      }
    });
  };

  const handleAddTopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toppingName.trim()) return;
    setSavingFlvTop(true);
    try {
      const generatedId = 'topping_' + Date.now();
      const newTopping = {
        id: generatedId,
        name: toppingName.trim(),
        price: parseFloat(toppingPrice.replace(',', '.')) || 0,
        category: toppingCategory
      };
      await setDoc(doc(db, 'topping_options', generatedId), newTopping);
      setToppingName('');
      setToppingPrice('0');
      setSuccessMsg(`🍓 Adicional "${newTopping.name}" cadastrado com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar adicional no Firestore');
      setTimeout(() => setErrorMsg(''), 2500);
    } finally {
      setSavingFlvTop(false);
    }
  };

  const handleDeleteTopping = async (id: string, nameTop: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Adicional',
      message: `Tem certeza que deseja remover o adicional "${nameTop}"?`,
      onConfirm: async () => {
        setConfirmModal(null);
        setSavingFlvTop(true);
        try {
          await deleteDoc(doc(db, 'topping_options', id));
          setSuccessMsg(`🗑️ Adicional "${nameTop}" removido com sucesso!`);
          setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) {
          console.error(err);
          setErrorMsg('Erro ao remover adicional');
          setTimeout(() => setErrorMsg(''), 2500);
        } finally {
          setSavingFlvTop(false);
        }
      }
    });
  };

  // Preset images for convenience
  const PRESET_IMAGES = [
    { label: 'Açaí Tradicional', url: '/assets/images/supreme_acai_cup_1781179584520.jpg' },
    { label: 'Milkshake Premium', url: '/assets/images/milkshake_supreme_1781189062620.jpg' },
    { label: 'Taça e Casquinha', url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&q=80&w=600' },
    { label: 'Gelato de Frutas', url: 'https://images.unsplash.com/photo-1567206563066-ec1629859596?auto=format&fit=crop&q=80&w=600' },
  ];

  const handleOpenNew = () => {
    setEditingItem(null);
    setName('');
    setDescription('');
    setPrice('15.00');
    setCategory('acai');
    setCustomCategoryInput('');
    setImageUrl(PRESET_IMAGES[0].url);
    setIsPopular(false);
    setIsCustomizable(true);
    setTagsString('Novidade, Customizável');
    setAllowedToppings(toppingOptions.map(t => t.id));
    setAllowedFlavors(flavorOptions.map(f => f.id));
    setSizeMode('default');
    setSingleSizeLabel('Tamanho Único');
    setSingleSizePrice('15.00');
    setCustomSizes({
      '300ml': { active: true, price: Number(storeSettings?.cupPrices?.['300ml'] ?? 18), label: storeSettings?.cupLabels?.['300ml'] ?? '300ml' },
      '400ml': { active: true, price: Number(storeSettings?.cupPrices?.['400ml'] ?? 21), label: storeSettings?.cupLabels?.['400ml'] ?? '400ml' },
      '500ml': { active: true, price: Number(storeSettings?.cupPrices?.['500ml'] ?? 25), label: storeSettings?.cupLabels?.['500ml'] ?? '500ml' },
      '700ml': { active: true, price: Number(storeSettings?.cupPrices?.['700ml'] ?? 35), label: storeSettings?.cupLabels?.['700ml'] ?? '700ml' },
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(String(item.price));
    setCategory(item.category);
    setCustomCategoryInput('');
    setImageUrl(item.image);
    setIsPopular(!!item.popular);
    setIsCustomizable(!!item.customizable);
    setTagsString(item.tags ? item.tags.join(', ') : '');
    setAllowedToppings(item.allowedToppings !== undefined && item.allowedToppings !== null ? item.allowedToppings : toppingOptions.map(t => t.id));
    setAllowedFlavors(item.allowedFlavors !== undefined && item.allowedFlavors !== null ? item.allowedFlavors : flavorOptions.map(f => f.id));
    setSizeMode((item as any).sizeMode || 'default');
    setSingleSizeLabel((item as any).singleSizeLabel || 'Tamanho Único');
    setSingleSizePrice(String((item as any).singleSizePrice ?? item.price ?? 15.00));
    setCustomSizes((item as any).customSizes || {
      '300ml': { active: true, price: Number(storeSettings?.cupPrices?.['300ml'] ?? 18), label: storeSettings?.cupLabels?.['300ml'] ?? '300ml' },
      '400ml': { active: true, price: Number(storeSettings?.cupPrices?.['400ml'] ?? 21), label: storeSettings?.cupLabels?.['400ml'] ?? '400ml' },
      '500ml': { active: true, price: Number(storeSettings?.cupPrices?.['500ml'] ?? 25), label: storeSettings?.cupLabels?.['500ml'] ?? '500ml' },
      '700ml': { active: true, price: Number(storeSettings?.cupPrices?.['700ml'] ?? 35), label: storeSettings?.cupLabels?.['700ml'] ?? '700ml' },
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErrorMsg('O nome do produto é obrigatório.');
    
    const parsedPrice = parseFloat(String(price).replace(',', '.').trim());
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return setErrorMsg('Por favor, insira um preço válido (use ponto ou vírgula). Para itens customizáveis, você pode colocar 0.');
    }

    if (isCustomizable && sizeMode === 'single') {
      const parsedSinglePrice = parseFloat(String(singleSizePrice).replace(',', '.').trim());
      if (isNaN(parsedSinglePrice) || parsedSinglePrice < 0) {
        return setErrorMsg('Por favor, insira um preço válido para o Tamanho Único.');
      }
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const tags = tagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const parsedId = editingItem ? editingItem.id : 'item-' + Date.now();
    
    const finalCategory = category === 'custom' ? customCategoryInput.trim().toLowerCase() : category;
    if (!finalCategory) {
      setLoading(false);
      return setErrorMsg('Por favor, escolha ou escreva uma categoria para o produto.');
    }

    const payload: any = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      category: finalCategory,
      image: imageUrl.trim() || PRESET_IMAGES[0].url,
      popular: isPopular,
      customizable: isCustomizable,
      allowedToppings: isCustomizable ? allowedToppings : undefined,
      allowedFlavors: isCustomizable ? allowedFlavors : undefined,
      tags: tags.length > 0 ? tags : undefined,
      sizeMode: isCustomizable ? sizeMode : undefined,
      singleSizeLabel: isCustomizable && sizeMode === 'single' ? singleSizeLabel.trim() : undefined,
      singleSizePrice: isCustomizable && sizeMode === 'single' ? parseFloat(String(singleSizePrice).replace(',', '.')) : undefined,
      customSizes: isCustomizable && sizeMode === 'custom' ? customSizes : undefined,
    };

    // If a brand new item, we give it a trailing index order
    if (!editingItem) {
      payload.index = menuItems.length;
    } else {
      // Retain existing index if any
      const oldIndex = (editingItem as any).index;
      if (oldIndex !== undefined) {
        payload.index = oldIndex;
      }
    }

    const parseCurrency = (val: string) => {
      const cleaned = val.replace(',', '.').trim();
      return parseFloat(cleaned);
    };

    try {
      const docRef = doc(db, 'menu_items', parsedId);
      await setDoc(docRef, payload);
      
      // Auto-sync size prices to settings if edited in this modal
      if (isCustomizable && onUpdateSettings && storeSettings) {
        const p300 = parseCurrency(price300);
        const p400 = parseCurrency(price400);
        const p500 = parseCurrency(price500);
        const p700 = parseCurrency(price700);

        const ms300 = parseCurrency(msPrice300);
        const ms400 = parseCurrency(msPrice400);
        const ms500 = parseCurrency(msPrice500);
        const ms700 = parseCurrency(msPrice700);

        const br400 = parseCurrency(brPrice400);
        const br500 = parseCurrency(brPrice500);
        const br700 = parseCurrency(brPrice700);

        if (
          !isNaN(p300) && !isNaN(p400) && !isNaN(p500) && !isNaN(p700) &&
          !isNaN(ms300) && !isNaN(ms400) && !isNaN(ms500) && !isNaN(ms700) &&
          !isNaN(br400) && !isNaN(br500) && !isNaN(br700)
        ) {
          const updatedSettings: StoreSettings = {
            ...storeSettings,
            cupPrices: {
              '300ml': p300,
              '400ml': p400,
              '500ml': p500,
              '700ml': p700
            },
            milkshakePrices: {
              '300ml': ms300,
              '400ml': ms400,
              '500ml': ms500,
              '700ml': ms700
            },
            browniePrices: {
              '400ml': br400,
              '500ml': br500,
              '700ml': br700
            }
          };
          await onUpdateSettings(updatedSettings);
        }
      }

      setSuccessMsg(`🏆 Produto "${name}" salvo com sucesso!`);
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro ao salvar no Firestore: ${msg}`);
      try {
        handleFirestoreError(err, OperationType.WRITE, `menu_items/${parsedId}`);
      } catch (innerErr) {}
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string, itemName: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Produto',
      message: `Tem certeza absoluta de que deseja excluir o produto "${itemName}"? Esta operação é irreversível.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
          await deleteDoc(doc(db, 'menu_items', itemId));
          setSuccessMsg('🗑️ Produto removido com sucesso!');
          setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
          console.error(err);
          setErrorMsg('Não foi possível remover o item.');
          try {
            handleFirestoreError(err, OperationType.DELETE, `menu_items/${itemId}`);
          } catch (innerErr) {}
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setImageUrl(compressedBase64);
          setSuccessMsg('📸 Foto de computador carregada e otimizada!');
          setTimeout(() => setSuccessMsg(''), 3500);
        } else {
          setErrorMsg('Não foi possível otimizar esta foto.');
        }
        setLoading(false);
      };
      
      img.onerror = () => {
        setErrorMsg('Arquivo de imagem inválido ou corrompido.');
        setLoading(false);
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };

    reader.onerror = () => {
      setErrorMsg('Erro ao ler a foto do computador.');
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  // Restore only the missing original/default items without deleting custom items
  const handleRestoreMissingDefaults = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const batch = writeBatch(db);
      
      let addedCount = 0;
      MENU_ITEMS.forEach((defaultItem, idx) => {
        const itemExists = menuItems.some(
          item => item.id === defaultItem.id || item.name.toLowerCase() === defaultItem.name.toLowerCase()
        );
        if (!itemExists) {
          const docRef = doc(db, 'menu_items', defaultItem.id);
          batch.set(docRef, {
            name: defaultItem.name,
            description: defaultItem.description,
            price: defaultItem.price,
            category: defaultItem.category,
            image: defaultItem.image,
            popular: !!defaultItem.popular,
            customizable: !!defaultItem.customizable,
            tags: defaultItem.tags || [],
            index: idx
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await batch.commit();
        setSuccessMsg(`✅ ${addedCount} produtos originais ausentes foram restaurados com sucesso! Seus novos itens foram mantidos.`);
      } else {
        setSuccessMsg('✨ Todos os produtos padrão já estão presentes no cardápio!');
      }
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Failed to restore missing items:', err);
      setErrorMsg(`Falha ao restaurar produtos padrões vinculados: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Re-order and save all items prioritised index in Firebase
  const handleResetToDefault = async () => {
    setConfirmModal({
      show: true,
      title: 'Reinicializar Cardápio',
      message: 'Deseja reinicializar o cardápio inteiro para os valores padrão originais? Quaisquer novos itens adicionados serão sobrescritas.',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
          const batch = writeBatch(db);
          
          // 1. Delete all currently displayed items first
          menuItems.forEach((item) => {
            const docRef = doc(db, 'menu_items', item.id);
            batch.delete(docRef);
          });

          // 2. Re-insert default items
          MENU_ITEMS.forEach((item, idx) => {
            const docRef = doc(db, 'menu_items', item.id);
            batch.set(docRef, {
              name: item.name,
              description: item.description,
              price: item.price,
              category: item.category,
              image: item.image,
              popular: !!item.popular,
              customizable: !!item.customizable,
              tags: item.tags || [],
              index: idx
            });
          });

          await batch.commit();
          setSuccessMsg('✅ Cardápio redefinido com sucesso para os dados padrão!');
          setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
          console.error('Failed to reset menu:', err);
          setErrorMsg(`Falha ao restaurar dados padrões: ${err?.message || err}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSaveCupPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSettings || !storeSettings) {
      setErrorMsg('Configurações indisponíveis ou não inicializadas.');
      return;
    }
    setSavingPrices(true);
    setErrorMsg('');
    setSuccessMsg('');

    const p300 = parseFloat(price300);
    const p400 = parseFloat(price400);
    const p500 = parseFloat(price500);
    const p700 = parseFloat(price700);

    const ms300 = parseFloat(msPrice300);
    const ms400 = parseFloat(msPrice400);
    const ms500 = parseFloat(msPrice500);
    const ms700 = parseFloat(msPrice700);

    const br400 = parseFloat(brPrice400);
    const br500 = parseFloat(brPrice500);
    const br700 = parseFloat(brPrice700);

    if (
      isNaN(p300) || isNaN(p400) || isNaN(p500) || isNaN(p700) ||
      isNaN(ms300) || isNaN(ms400) || isNaN(ms500) || isNaN(ms700) ||
      isNaN(br400) || isNaN(br500) || isNaN(br700)
    ) {
      setErrorMsg('Por favor, insira valores numéricos válidos para todos os tamanhos.');
      setSavingPrices(false);
      return;
    }

    try {
      const updatedSettings: StoreSettings = {
        ...storeSettings,
        cupPrices: {
          '300ml': p300,
          '400ml': p400,
          '500ml': p500,
          '700ml': p700
        },
        cupLabels: {
          '300ml': label300 || '300ml',
          '400ml': label400 || '400ml',
          '500ml': label500 || '500ml',
          '700ml': label700 || '700ml'
        },
        milkshakePrices: {
          '300ml': ms300,
          '400ml': ms400,
          '500ml': ms500,
          '700ml': ms700
        },
        milkshakeLabels: {
          '300ml': msLabel300 || '300ml',
          '400ml': msLabel400 || '400ml',
          '500ml': msLabel500 || '500ml',
          '700ml': msLabel700 || '700ml'
        },
        browniePrices: {
          '400ml': br400,
          '500ml': br500,
          '700ml': br700
        },
        brownieLabels: {
          '400ml': brLabel400 || 'Copo Brownie 400ml',
          '500ml': brLabel500 || 'Caixinha Brownie 500ml',
          '700ml': brLabel700 || 'Balde Brownie 700ml'
        }
      };
      await onUpdateSettings(updatedSettings);
      setSuccessMsg('✨ Valores e nomes dos tamanhos salvos e atualizados com sucesso para todos os clientes!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao salvar preços: ${err?.message || err}`);
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSaveDigitalBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSettings || !storeSettings) {
      setErrorMsg('Configurações indisponíveis ou não inicializadas.');
      return;
    }
    setSavingPrices(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedSettings: StoreSettings = {
        ...storeSettings,
        boardTitle,
        boardSubtitle,
        boardSlogan,
        boardPhone,
        boardInstagram,
        boardCustomNote,
        boardMsFlavorList,
        boardCortesiasList,
        boardAdicionaisList
      };
      await onUpdateSettings(updatedSettings);
      setSuccessMsg('✨ Painel Digital atualizado com sucesso no banco de dados!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao salvar painel digital: ${err?.message || err}`);
    } finally {
      setSavingPrices(false);
    }
  };

  const handleResetCupPricesToDefault = () => {
    setPrice300('18');
    setPrice400('21');
    setPrice500('25');
    setPrice700('35');

    setLabel300('300ml');
    setLabel400('400ml');
    setLabel500('500ml');
    setLabel700('700ml');

    setMsPrice300('15');
    setMsPrice400('18');
    setMsPrice500('21');
    setMsPrice700('25');

    setMsLabel300('300ml');
    setMsLabel400('400ml');
    setMsLabel500('500ml');
    setMsLabel700('700ml');

    setBrPrice400('22.90');
    setBrPrice500('28.90');
    setBrPrice700('34.90');

    setBrLabel400('Copo Brownie 400ml');
    setBrLabel500('Caixinha Brownie 500ml');
    setBrLabel700('Balde Brownie 700ml');
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 text-left space-y-6">
      
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-850 flex items-center gap-2">
            🥣 Controle Flexível do Cardápio
          </h2>
          <p className="text-[11px] text-slate-450 uppercase font-black tracking-wide">
            Adicione, edite preços, detalhes e categorize os produtos reais em tempo de execução
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleResetToDefault}
            className="flex-1 sm:flex-none px-3.5 py-2 hover:bg-slate-200/60 rounded-xl text-slate-500 hover:text-slate-700 transition-colors font-extrabold font-mono text-[10px] uppercase border border-slate-200 cursor-pointer"
          >
            🔄 Restaurar Padrões
          </button>
          <button
            onClick={handleOpenNew}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl shadow-md shadow-rose-100 hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Produto
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total de Itens</p>
          <p className="text-xl font-black text-rose-650">{menuItems.length} itens</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Mais Populares ⭐</p>
          <p className="text-xl font-black text-amber-500">{menuItems.filter(i => i.popular).length} ativos</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Customizáveis 🎚️</p>
          <p className="text-xl font-black text-sky-600">{menuItems.filter(i => i.customizable).length} itens</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Média Geral de Preço</p>
          <p className="text-xl font-black text-emerald-650">
            R$ {(menuItems.reduce((acc, c) => acc + c.price, 0) / (menuItems.length || 1)).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-bold animate-[pulse_1s_infinite]">
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-bold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Segmented Tab Switcher inside Cardapio */}
      <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-2xl gap-1 max-w-2xl">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-white text-rose-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-805'
          }`}
        >
          🥣 Produtos ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab('flavors_toppings')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'flavors_toppings'
              ? 'bg-white text-rose-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-805'
          }`}
        >
          🍧 Sabores & Adicionais
        </button>
        <button
          onClick={() => setActiveTab('sizes_prices')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'sizes_prices'
              ? 'bg-white text-rose-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-805'
          }`}
        >
          📏 Tamanhos & Valores
        </button>
        <button
          onClick={() => setActiveTab('digital_board')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'digital_board'
              ? 'bg-white text-rose-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-805'
          }`}
        >
          📺 Painel Digital 16:9
        </button>
      </div>

      {activeTab === 'flavors_toppings' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Ice Cream / Acai Flavors */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6 flex flex-col">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-805 uppercase tracking-wide flex items-center gap-1.5">
                🍨 Sabores de Sorvete & Açaí
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Gerencie as opções de bases e sabores de sorvete disponíveis para montagem dos copos customizáveis.
              </p>
            </div>

            {/* Add Flavor Form */}
            <form onSubmit={handleAddFlavor} className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3.5">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Adicionar Novo Sabor</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Nome do Sabor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Creme de Avelã, Ninho..."
                    value={flavorName}
                    onChange={(e) => setFlavorName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Categoria</label>
                  <select
                    value={flavorCategory}
                    onChange={(e) => setFlavorCategory(e.target.value as 'sorvete' | 'acai')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs cursor-pointer"
                  >
                    <option value="sorvete">🍨 Sorvete Tradicional</option>
                    <option value="acai">🍇 Açaí Gourmet</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Selecione uma Cor Visual</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {[
                    { hex: '#fef08a', label: 'Amarelo' },
                    { hex: '#e11d48', label: 'Morango' },
                    { hex: '#78350f', label: 'Chocolate' },
                    { hex: '#7c3aed', label: 'Açaí' },
                    { hex: '#059669', label: 'Pistache' },
                    { hex: '#0284c7', label: 'Menta' },
                    { hex: '#fb923c', label: 'Doce de Leite' },
                    { hex: '#ffffff', label: 'Creme' }
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setFlavorColor(preset.hex)}
                      title={preset.label}
                      className={`w-6 h-6 rounded-full border transition-all hover:scale-110 cursor-pointer ${
                        flavorColor === preset.hex ? 'ring-2 ring-offset-1 ring-rose-500 scale-105' : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={flavorColor}
                    onChange={(e) => setFlavorColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0 overflow-hidden"
                  />
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase shrink-0">{flavorColor}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Breve Descrição (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Sorvete artesanal cremoso de Ninho..."
                  value={flavorDescription}
                  onChange={(e) => setFlavorDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={savingFlvTop}
                className="w-full py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {savingFlvTop ? 'Gravando...' : '➕ Adicionar Sabor'}
              </button>
            </form>

            {/* Flavor List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-2 scrollbar-thin">
              {flavorOptions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">
                  Nenhum sabor cadastrado
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {flavorOptions.map((f) => (
                    <div key={f.id} className="p-3 bg-white border border-slate-150 rounded-xl flex justify-between items-center group hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-4.5 h-4.5 rounded-full border border-slate-200 shrink-0 shadow-xs" style={{ backgroundColor: f.color }} />
                        <div className="min-w-0 leading-tight">
                          <span className="font-extrabold text-xs text-slate-800 block truncate">{f.name}</span>
                          <span className="text-[8.5px] uppercase font-black tracking-wide text-rose-500">
                            {f.category === 'acai' ? '🍇 Açaí' : '🍨 Sorvete'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFlavor(f.id, f.name)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-650 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Sabor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Toppings / Adicionais */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6 flex flex-col">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-805 uppercase tracking-wide flex items-center gap-1.5">
                🍓 Toppings, Caldas & Adicionais
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Configure os adicionais pagos e cortesias oferecidas para complementar os copos de açaí, sorvete e milkshakes.
              </p>
            </div>

            {/* Add Topping Form */}
            <form onSubmit={handleAddTopping} className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3.5">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Adicionar Novo Adicional</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Nome do Item</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Leite Ninho em pó, Nutella..."
                    value={toppingName}
                    onChange={(e) => setToppingName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Preço Cobrado</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] font-bold text-slate-400">R$</span>
                    <input
                      type="text"
                      required
                      placeholder="0.00"
                      value={toppingPrice}
                      onChange={(e) => setToppingPrice(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-black uppercase text-slate-450 tracking-wider">Categoria do Adicional</label>
                <select
                  value={toppingCategory}
                  onChange={(e) => setToppingCategory(e.target.value as 'calda' | 'fruta' | 'crocante' | 'creme')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 text-xs cursor-pointer"
                >
                  <option value="creme">🍫 Chocolates, Cremes & Pastas (Nutella, Laka, etc)</option>
                  <option value="calda">🍯 Caldas & Coberturas Líquidas (Leite Condensado, Caramelo)</option>
                  <option value="fruta">🍓 Frutas Picadas & Frescas (Morango, Banana, Kiwi)</option>
                  <option value="crocante">🥜 Crocantes & Cereais (Granola, Paçoca, Ovomaltine)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingFlvTop}
                className="w-full py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {savingFlvTop ? 'Gravando...' : '➕ Adicionar Adicional'}
              </button>
            </form>

            {/* Topping List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-2 scrollbar-thin">
              {toppingOptions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">
                  Nenhum adicional cadastrado
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {toppingOptions.map((t) => (
                    <div key={t.id} className="p-3 bg-white border border-slate-150 rounded-xl flex justify-between items-center hover:border-slate-300 transition-colors">
                      <div className="min-w-0 leading-tight">
                        <span className="font-extrabold text-xs text-slate-800 block truncate">{t.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8.5px] uppercase font-black px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500">
                            {t.category === 'calda' ? 'Caldas' : t.category === 'fruta' ? 'Frutas' : t.category === 'crocante' ? 'Crocantes' : 'Pastas'}
                          </span>
                          <span className="text-[9px] font-mono font-black text-emerald-650">
                            {t.price === 0 ? 'Cortesia' : `R$ ${t.price.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTopping(t.id, t.name)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-650 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Adicional"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'sizes_prices' ? (
        <form onSubmit={handleSaveCupPrices} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-xs space-y-8">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-805 uppercase tracking-wide flex items-center gap-1.5">
              💡 Ajuste de Valores por Categoria de Produto
            </h3>
            <p className="text-[11px] text-slate-450 font-medium leading-relaxed mt-1">
              Configure os valores base cobrados por tamanho para cada categoria de produto customizável. Os clientes verão esses valores atualizados imediatamente no aplicativo ao montarem o pedido.
            </p>
          </div>

          {/* Section 1: Açaí e Sorvete */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-sm">💜</span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-705">Copos de Açaí & Sorvete Customizáveis</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 300ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 300ml)</label>
                  <input
                    type="text"
                    value={label300}
                    onChange={(e) => setLabel300(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="300ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price300}
                      onChange={(e) => setPrice300(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="18.00"
                    />
                  </div>
                </div>
              </div>
              {/* 400ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 400ml)</label>
                  <input
                    type="text"
                    value={label400}
                    onChange={(e) => setLabel400(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="400ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price400}
                      onChange={(e) => setPrice400(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="21.00"
                    />
                  </div>
                </div>
              </div>
              {/* 500ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 500ml)</label>
                  <input
                    type="text"
                    value={label500}
                    onChange={(e) => setLabel500(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="500ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price500}
                      onChange={(e) => setPrice500(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="25.00"
                    />
                  </div>
                </div>
              </div>
              {/* 700ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 700ml)</label>
                  <input
                    type="text"
                    value={label700}
                    onChange={(e) => setLabel700(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="700ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price700}
                      onChange={(e) => setPrice700(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="35.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Milkshakes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-sm">🥤</span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-705">Milkshakes Gourmet Customizáveis</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 300ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 300ml)</label>
                  <input
                    type="text"
                    value={msLabel300}
                    onChange={(e) => setMsLabel300(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="300ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={msPrice300}
                      onChange={(e) => setMsPrice300(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="15.00"
                    />
                  </div>
                </div>
              </div>
              {/* 400ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 400ml)</label>
                  <input
                    type="text"
                    value={msLabel400}
                    onChange={(e) => setMsLabel400(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="400ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={msPrice400}
                      onChange={(e) => setMsPrice400(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="18.00"
                    />
                  </div>
                </div>
              </div>
              {/* 500ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 500ml)</label>
                  <input
                    type="text"
                    value={msLabel500}
                    onChange={(e) => setMsLabel500(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="500ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={msPrice500}
                      onChange={(e) => setMsPrice500(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="21.00"
                    />
                  </div>
                </div>
              </div>
              {/* 700ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: 700ml)</label>
                  <input
                    type="text"
                    value={msLabel700}
                    onChange={(e) => setMsLabel700(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="700ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={msPrice700}
                      onChange={(e) => setMsPrice700(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="25.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Brownie */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-sm">🍫</span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-755">Copos / Caixas / Baldes - Linha Brownie</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 400ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: Copo Brownie 400ml)</label>
                  <input
                    type="text"
                    value={brLabel400}
                    onChange={(e) => setBrLabel400(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="Copo Brownie 400ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={brPrice400}
                      onChange={(e) => setBrPrice400(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="22.90"
                    />
                  </div>
                </div>
              </div>
              {/* 500ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: Caixinha Brownie)</label>
                  <input
                    type="text"
                    value={brLabel500}
                    onChange={(e) => setBrLabel500(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="Caixinha Brownie"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={brPrice500}
                      onChange={(e) => setBrPrice500(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="28.90"
                    />
                  </div>
                </div>
              </div>
              {/* 700ml */}
              <div className="space-y-2 p-3 bg-slate-50/55 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Nome (Ex: Balde Brownie 700ml)</label>
                  <input
                    type="text"
                    value={brLabel700}
                    onChange={(e) => setBrLabel700(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                    placeholder="Balde Brownie 700ml"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Preço Base</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-extrabold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={brPrice700}
                      onChange={(e) => setBrPrice700(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors text-xs"
                      placeholder="34.90"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-50">
            <button
              type="button"
              onClick={handleResetCupPricesToDefault}
              className="px-4 py-2.5 text-[10px] font-extrabold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer uppercase font-mono"
            >
              ↩️ Carregar Valores Padrão (Sugestão)
            </button>

            <button
              type="submit"
              disabled={savingPrices}
              className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-extrabold text-[10px] uppercase tracking-wide shadow-md shadow-rose-100 hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              {savingPrices ? (
                <>Salvando...</>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Salvar Tamanhos & Preços
                </>
              )}
            </button>
          </div>
        </form>
      ) : activeTab === 'digital_board' ? (
        <div className="space-y-6">
          <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl text-left">
            <h3 className="text-sm font-black text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
              📺 Painel de Cardápio Digital 16:9 Editável
            </h3>
            <p className="text-[11px] text-slate-550 leading-relaxed mt-1">
              Gerencie a exibição do seu <strong>Painel Digital de TV</strong> ou <strong>Banners de Promoção (16:9)</strong>.
              Você pode alterar todos os textos, slogan, redes de contato e ver as alterações atualizadas em tempo real no simulador interativo. Os preços do painel são integrados diretamente com os preços dos copos configurados na aba "Tamanhos & Valores".
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Form & High-Res Poster Download (5 Columns) */}
            <div className="xl:col-span-5 space-y-6 text-left">
              
              {/* High-Res AI Generated Banner Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="border-b border-slate-50 pb-2 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      🖼️ Arte do Cardápio Gerada por IA
                    </h4>
                    <p className="text-[10px] text-slate-400">Resolução Ultra-HD 16:9</p>
                  </div>
                  <span className="bg-rose-100 text-rose-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    Alta Resolução
                  </span>
                </div>
                
                <div className="relative group overflow-hidden rounded-xl border border-slate-100">
                  <img
                    src="/src/assets/images/digital_menu_banner_1783440971538.jpg"
                    alt="Cardápio Digital Supremo"
                    className="w-full object-cover aspect-[16/9] hover:scale-102 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href="/src/assets/images/digital_menu_banner_1783440971538.jpg"
                      download="cardapio_supreme_16x9.jpg"
                      className="bg-white hover:bg-rose-50 text-rose-600 p-2 rounded-full shadow-md transition-all cursor-pointer font-bold text-xs flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" /> Baixar
                    </a>
                    <a
                      href="/src/assets/images/digital_menu_banner_1783440971538.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full shadow-md transition-all cursor-pointer font-bold text-xs flex items-center gap-1"
                    >
                      🔍 Ampliar
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <a
                      href="/src/assets/images/digital_menu_banner_1783440971538.jpg"
                      download="cardapio_supreme_16x9.jpg"
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar Imagem
                    </a>
                    <a
                      href="/src/assets/images/digital_menu_banner_1783440971538.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      🖼️ Poster Estático
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFullscreenBoardOpen(true)}
                    className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 hover:shadow-lg cursor-pointer"
                  >
                    📺 Exibir Painel de TV Interativo (Auto-Atualizável)
                  </button>
                </div>
              </div>

              {/* Form Configurator */}
              <form onSubmit={handleSaveDigitalBoard} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-5">
                <div className="border-b border-slate-50 pb-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    ⚙️ Configurações do Menu Board
                  </h4>
                  <p className="text-[10px] text-slate-400">Edite os textos do seu painel digital</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Nome Principal</label>
                    <input
                      type="text"
                      value={boardTitle}
                      onChange={(e) => setBoardTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Subtítulo</label>
                    <input
                      type="text"
                      value={boardSubtitle}
                      onChange={(e) => setBoardSubtitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Slogan da Marca</label>
                  <input
                    type="text"
                    value={boardSlogan}
                    onChange={(e) => setBoardSlogan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">WhatsApp de Atendimento</label>
                    <input
                      type="text"
                      value={boardPhone}
                      onChange={(e) => setBoardPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Instagram</label>
                    <input
                      type="text"
                      value={boardInstagram}
                      onChange={(e) => setBoardInstagram(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Chamada Rodapé</label>
                  <input
                    type="text"
                    value={boardCustomNote}
                    onChange={(e) => setBoardCustomNote(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Sabores de Milkshake (Separados por vírgula)</label>
                  <textarea
                    rows={2}
                    value={boardMsFlavorList}
                    onChange={(e) => setBoardMsFlavorList(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs leading-normal focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Itens Cortesia Açaí (Separados por vírgula)</label>
                  <textarea
                    rows={2}
                    value={boardCortesiasList}
                    onChange={(e) => setBoardCortesiasList(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs leading-normal focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Itens Adicionais Açaí (Separados por vírgula)</label>
                  <textarea
                    rows={3}
                    value={boardAdicionaisList}
                    onChange={(e) => setBoardAdicionaisList(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs leading-normal focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPrices}
                  className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-extrabold text-[10px] uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Alterações do Painel
                </button>
              </form>
            </div>

            {/* Right Column: Live Interactive 16:9 Widescreen Simulator (7 Columns) */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">
                  📺 Simulador em Tempo Real (Widescreen 16:9)
                </span>
                <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1 animate-pulse">
                  ● Atualizando Live
                </span>
              </div>

              {/* 16:9 Aspect Ratio Box */}
              <div className="w-full aspect-[16/9] bg-[#FAF8F5] border border-slate-200/70 rounded-2xl shadow-lg relative p-4 sm:p-5 flex flex-col justify-between overflow-hidden select-none text-slate-800 text-[10px] sm:text-xs">
                {/* Decorative golden curves on borders */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-350/40 rounded-tl-xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-300/40 rounded-tr-xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-300/40 rounded-bl-xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-300/40 rounded-br-xl pointer-events-none" />

                {/* Top Section: Header & Slogan */}
                <div className="flex justify-between items-center border-b border-amber-200/40 pb-2">
                  <div className="flex items-center gap-2">
                    {/* Tiny representation of crown and logo */}
                    <span className="text-rose-500 text-lg">👑</span>
                    <div className="text-left leading-none">
                      <span className="font-sans font-black text-slate-900 tracking-wider text-sm sm:text-base uppercase">
                        {boardTitle}
                      </span>
                      <span className="block text-[8px] sm:text-[9px] text-rose-500 font-extrabold tracking-widest leading-none">
                        — {boardSubtitle} —
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[7px] sm:text-[8px] font-bold text-slate-400">NÃO É SÓ SORVETE,</p>
                    <p className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-wide leading-none">
                      {boardSlogan}
                    </p>
                  </div>
                </div>

                {/* Main Menu Grid Rows */}
                <div className="grid grid-cols-12 gap-3 my-2 flex-1 items-stretch overflow-hidden">
                  
                  {/* Left Column (Açaí & Sabores) (5/12 Columns) */}
                  <div className="col-span-5 flex flex-col justify-between border-r border-slate-100 pr-3 text-left">
                    {/* Açaí Section */}
                    <div>
                      <h5 className="font-black text-rose-600 uppercase text-[9px] tracking-wider mb-1.5 flex items-center gap-1">
                        💜 Copos de Açaí & Sorvete
                      </h5>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="flex justify-between items-center border-b border-dashed border-slate-200/50 pb-0.5">
                          <span className="font-extrabold text-slate-700 text-[9px]">{label300}</span>
                          <span className="font-black text-rose-500 text-[10px]">R$ {price300}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-dashed border-slate-200/50 pb-0.5">
                          <span className="font-extrabold text-slate-700 text-[9px]">{label400}</span>
                          <span className="font-black text-rose-500 text-[10px]">R$ {price400}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-dashed border-slate-200/50 pb-0.5">
                          <span className="font-extrabold text-slate-700 text-[9px]">{label500}</span>
                          <span className="font-black text-rose-500 text-[10px]">R$ {price500}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-dashed border-slate-200/50 pb-0.5">
                          <span className="font-extrabold text-slate-700 text-[9px]">{label700}</span>
                          <span className="font-black text-rose-500 text-[10px]">R$ {price700}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cortesias Section */}
                    <div className="mt-2 bg-rose-50/40 p-1.5 rounded-lg border border-rose-100/30 text-left">
                      <h6 className="font-black text-rose-800 uppercase text-[7px] tracking-widest leading-none mb-1">
                        ✨ CORTESIAS INCLUSAS:
                      </h6>
                      <p className="text-[8px] font-medium leading-relaxed text-slate-600">
                        {boardCortesiasList}
                      </p>
                    </div>

                    {/* Copos Especiais Section */}
                    <div className="mt-2 text-left">
                      <h5 className="font-black text-slate-800 uppercase text-[8px] tracking-wider mb-1 flex items-center gap-1">
                        🍓 Copos Especiais
                      </h5>
                      <div className="space-y-1">
                        {specialCups.length > 0 ? (
                          specialCups.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-[7px] gap-1 pb-0.5 border-b border-dashed border-slate-200/20">
                              <div className="flex items-center gap-1 min-w-0">
                                {item.image && (
                                  <img 
                                    src={item.image} 
                                    alt={item.name} 
                                    className="w-3.5 h-3.5 object-cover rounded-md flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="font-bold text-slate-700 truncate">{item.name}</span>
                              </div>
                              <span className="font-black text-rose-500 flex-shrink-0">R$ {item.price.toFixed(0)}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-[8px]">
                              <span className="font-bold text-slate-600">Copo Trufado Nutella/Amendoim</span>
                              <span className="font-black text-slate-800">R$ 20</span>
                            </div>
                            <div className="flex justify-between items-center text-[8px]">
                              <span className="font-bold text-slate-600">Copo da Felicidade Supremo</span>
                              <span className="font-black text-slate-800">R$ 30</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column (Milk Shakes) (4/12 Columns) */}
                  <div className="col-span-4 flex flex-col justify-between border-r border-slate-100 pr-3 text-left">
                    <div>
                      <div className="bg-rose-500 text-white text-center py-0.5 px-2 rounded-md font-black uppercase text-[8px] tracking-wider mb-1.5">
                        🥤 MILK SHAKES
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-left">
                        <div className="flex justify-between items-center pb-0.5">
                          <span className="font-bold text-slate-600 text-[8px]">{msLabel300}</span>
                          <span className="font-black text-rose-500 text-[9px]">R$ {msPrice300}</span>
                        </div>
                        <div className="flex justify-between items-center pb-0.5">
                          <span className="font-bold text-slate-600 text-[8px]">{msLabel400}</span>
                          <span className="font-black text-rose-500 text-[9px]">R$ {msPrice400}</span>
                        </div>
                        <div className="flex justify-between items-center pb-0.5">
                          <span className="font-bold text-slate-600 text-[8px]">{msLabel500}</span>
                          <span className="font-black text-rose-500 text-[9px]">R$ {msPrice500}</span>
                        </div>
                        <div className="flex justify-between items-center pb-0.5">
                          <span className="font-bold text-slate-600 text-[8px]">{msLabel700}</span>
                          <span className="font-black text-rose-500 text-[9px]">R$ {msPrice700}</span>
                        </div>
                      </div>
                    </div>

                    {/* Flavors Grid List */}
                    <div className="mt-1.5 bg-slate-100/50 p-1 rounded-lg text-left">
                      <span className="text-[6.5px] font-black text-slate-450 uppercase block mb-0.5">
                        SABORES DE SORVETE:
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {boardMsFlavorList.split(',').slice(0, 5).map((flav, idx) => (
                          <span key={idx} className="bg-white px-1 py-0.5 rounded text-[6px] font-bold text-slate-700 border border-slate-100">
                            {flav.trim()}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Premium Shakes Dynamic Section */}
                    {premiumShakes.length > 0 && (
                      <div className="mt-1.5 text-left">
                        <span className="text-[6.5px] font-black text-rose-500 uppercase tracking-wider block mb-0.5">
                          ✨ SHAKES ESPECIAIS:
                        </span>
                        <div className="space-y-0.5">
                          {premiumShakes.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-[6.5px] gap-1 pb-0.5 border-b border-dashed border-slate-200/20">
                              <div className="flex items-center gap-1 min-w-0">
                                {item.image && (
                                  <img 
                                    src={item.image} 
                                    alt={item.name} 
                                    className="w-3 h-3 object-cover rounded-md flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="font-bold text-slate-700 truncate">{item.name}</span>
                              </div>
                              <span className="font-black text-rose-500 flex-shrink-0">R$ {item.price.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column (Buckets, Coffee & Toppings) (3/12 Columns) */}
                  <div className="col-span-3 flex flex-col justify-between text-left">
                    <div>
                      <h5 className="font-black text-amber-600 uppercase text-[8px] tracking-wider mb-1 flex items-center gap-1">
                        🍨 Baldes & Cafés
                      </h5>
                      <div className="space-y-1">
                        {baldesAndCafes.length > 0 ? (
                          baldesAndCafes.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-[7px] gap-1 pb-0.5 border-b border-dashed border-slate-200/20">
                              <div className="flex items-center gap-1 min-w-0">
                                {item.image && (
                                  <img 
                                    src={item.image} 
                                    alt={item.name} 
                                    className="w-3.5 h-3.5 object-cover rounded-md flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="font-bold text-slate-700 truncate">{item.name}</span>
                              </div>
                              <span className="font-black text-amber-600 flex-shrink-0">R$ {item.price.toFixed(0)}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-[8px]">
                              <span className="font-bold text-slate-600">Balde Brownie 700ml</span>
                              <span className="font-black text-amber-600">R$ {brPrice700}</span>
                            </div>
                            <div className="flex justify-between items-center text-[8px]">
                              <span className="font-bold text-slate-600">Doce de Leite 700ml</span>
                              <span className="font-black text-amber-600">R$ 25</span>
                            </div>
                            <div className="flex justify-between items-center text-[8px]">
                              <span className="font-bold text-slate-600">Frappuccino 500ml</span>
                              <span className="font-black text-amber-600">R$ 25</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Custom Adicionais lists */}
                    <div className="mt-2 text-left leading-tight">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        ➕ ADICIONAIS EXTRA:
                      </span>
                      <p className="text-[6.5px] text-slate-500 font-semibold leading-normal">
                        {boardAdicionaisList.split(',').slice(0, 4).map(item => item.trim()).join(' • ')}...
                      </p>
                    </div>
                  </div>

                </div>

                {/* Bottom Section: Contacts & Socials */}
                <div className="flex justify-between items-center border-t border-amber-200/40 pt-2 text-[8px] sm:text-[9px] font-black text-slate-750">
                  <div className="flex items-center gap-1">
                    <span className="bg-emerald-500 text-white p-0.5 rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center">📞</span>
                    <span className="font-mono text-slate-800">{boardCustomNote} — {boardPhone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="bg-rose-500 text-white p-0.5 rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center">📷</span>
                    <span className="text-rose-600">{boardInstagram}</span>
                  </div>
                </div>

              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/20 text-[10px] text-amber-800 leading-normal font-medium text-left">
                <strong>💡 Dica do Visualizador:</strong> Este simulador renderiza fielmente em proporção widescreen 16:9. Você pode deixá-lo aberto em um tablet ou projetá-lo na Smart TV do seu estabelecimento comercial via navegador para funcionar como menu interativo!
              </div>
            </div>

          </div>
        </div>
      ) : (
        <>
          {/* Dynamic recovery banner for users who might have lost default items when writing a custom item */}
          {menuItems.length > 0 && menuItems.length < 8 && (
            <div className="p-4.5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-medium text-slate-750">
              <div className="space-y-1">
                <p className="font-extrabold text-rose-700 flex items-center gap-1.5 text-sm">
                  💡 Sumiram os produtos anteriores padrão?
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Ao cadastrar um item no banco de dados pela primeira vez, os produtos demonstrativos locais podem ter sido ocultados do seu painel. 
                  Clique abaixo para <strong>restaurar e misturar todos os produtos anteriores padrão</strong> de volta sem perder seu novo produto criado!
                </p>
              </div>
              <button
                onClick={handleRestoreMissingDefaults}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-rose-100 transition-all cursor-pointer whitespace-nowrap align-middle"
              >
                {loading ? 'Processando...' : '🔄 Restaurar Produtos Anteriores'}
              </button>
            </div>
          )}

          {/* Grid Filter Tools & Search */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar produto no cardápio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-rose-400 rounded-xl text-xs font-bold text-slate-705 placeholder-slate-400 focus:outline-hidden transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={exportProductsToCSV}
                title="Exportar Cardápio (Excel/CSV)"
                className="px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline text-[9.5px] font-black uppercase tracking-wider">Exportar</span>
              </button>
            </div>

            {/* Categories Bar */}
            <div className="flex bg-slate-200/50 p-1 rounded-xl overflow-x-auto gap-0.5 max-w-full">
              {adminFilterCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategory === cat.value
                      ? 'bg-white text-rose-600 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-805'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Products list visual grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 ">
                <FolderOpen className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-extrabold text-slate-450 uppercase tracking-widest">Nenhum produto correspondente</p>
                <p className="text-[10px] mt-1 text-slate-400">Insira um novo produto usando o botão "Adicionar Produto"</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative group hover:border-rose-100 hover:shadow-md transition-all"
                >
                  {/* Image & Price Tag */}
                  <div className="h-32 bg-slate-100 relative overflow-hidden flex-shrink-0">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-rose-600 text-white px-2.5 py-1 text-[11px] font-black tracking-widest uppercase rounded-lg shadow-sm">
                      R$ {item.price.toFixed(2)}
                    </div>

                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                      <span className="bg-slate-900/90 text-white px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide rounded-md">
                        {item.category === 'acai' ? '💜 Açaí' : 
                         item.category === 'sorvete' ? '🍧 Sorvete' :
                         item.category === 'milkshake' ? '🥤 Shake' : 
                         item.category === 'sundae' ? '🍒 Sundae' : 
                         item.category === 'combo' ? '📦 Combo' : 
                         `📦 ${item.category.charAt(0).toUpperCase() + item.category.slice(1)}`}
                      </span>
                      {item.popular && (
                        <span className="bg-amber-500 text-white px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide rounded-md flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" /> Destaque
                        </span>
                      )}
                      {item.customizable && (
                        <span className="bg-sky-500 text-white px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide rounded-md">
                          🎚️ Customizável
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Block */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-xs tracking-tight line-clamp-1">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
                    </div>

                    {/* Tags inside card item */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="bg-slate-50 text-slate-550 border border-slate-100 text-[8px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                            <Tag className="w-2 h-2" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex gap-2 pt-2 border-t border-slate-50 flex-shrink-0">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="flex-1 py-1.5 hover:bg-slate-100 border border-slate-150 rounded-lg text-slate-600 font-extrabold text-[9px] uppercase tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="py-1.5 px-3 hover:bg-rose-50 border border-rose-100 rounded-lg text-rose-600 font-extrabold text-[9px] uppercase transition-colors cursor-pointer flex items-center justify-center"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Editor Modal for Adding/Editing Item */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-55 overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
            />

            {/* Form modal body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl max-w-lg w-full flex flex-col overflow-hidden shadow-2xl border border-slate-100 relative z-50 font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-rose-50 flex justify-between items-center bg-rose-50/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500 rounded-xl text-white">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      {editingItem ? '✏️ Editar Produto' : '➕ Novo Produto'}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wide">
                      {editingItem ? 'Atualizar campos e preços reais' : 'Cadastrar novo item no cardápio online'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Scroll Body */}
              <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-left text-xs font-bold text-slate-600 max-h-[70vh]">
                
                {/* Product Name */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase text-slate-450 tracking-wide">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Açaí Premium Mix de Frutas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-705 placeholder-slate-400 focus:outline-hidden focus:border-rose-450 transition-colors"
                  />
                </div>

                {/* Category only (Price is managed per size below) */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase text-slate-450 tracking-wide">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (e.target.value !== 'custom') {
                        setCustomCategoryInput('');
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-705 focus:outline-hidden focus:border-rose-450 transition-colors cursor-pointer"
                  >
                    <option value="acai">💜 Açaí</option>
                    <option value="sorvete">🍧 Sorvete</option>
                    <option value="milkshake">🥤 Milkshake</option>
                    <option value="sundae">🍒 Sundae</option>
                    <option value="combo">📦 Combo / Especial</option>
                    
                    {/* Render any custom categories present in the database */}
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>
                        📦 {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                    
                    <option value="custom">✨ Outra Categoria (Criar Nova)...</option>
                  </select>
                </div>

                {category === 'custom' && (
                  <div className="space-y-1 mt-2">
                    <label className="block text-[10px] font-black uppercase text-rose-500 tracking-wide">Escreva o Nome da Nova Categoria</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Bebidas, Sobremesas, Adicionais"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-rose-200 rounded-xl font-bold text-slate-705 placeholder-slate-400 focus:outline-hidden focus:border-rose-450 transition-colors"
                    />
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase text-slate-450 tracking-wide">Descrição Comercial</label>
                  <textarea
                    rows={2}
                    placeholder="Descreva os acompanhamentos de cortesia inclusos, sabores recomendados, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-705 placeholder-slate-400 focus:outline-hidden focus:border-rose-450 transition-colors resize-none"
                  />
                </div>

                {/* Image Selection & pasting */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-450 tracking-wide">Imagem do Produto</label>

                  {/* Local Upload Widget */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="w-16 h-16 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Pré-visualização" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                      <p className="text-[10px] leading-tight text-slate-500 font-medium">
                        Selecione uma foto da pasta do seu computador. Ela será otimizada automaticamente!
                      </p>

                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <label className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 justify-center">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Enviar do Computador</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                        {imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('http') && (
                          <button
                            type="button"
                            onClick={() => setImageUrl(PRESET_IMAGES[0].url)}
                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[10px] uppercase tracking-wide rounded-xl transition-colors cursor-pointer"
                          >
                            Limpar Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative py-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative px-3 bg-white text-[9px] uppercase font-black tracking-widest text-slate-400">Ou use Link / Padrão</span>
                  </div>

                  <input
                    type="text"
                    placeholder="Cole um link de imagem aqui..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[10px] text-slate-600 placeholder-slate-400 focus:outline-hidden focus:border-rose-450 transition-colors"
                  />
                  
                  {/* Preset Quick Images */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className={`p-1.5 border rounded-xl overflow-hidden text-left hover:border-rose-350 cursor-pointer transition-all flex flex-col gap-1 ${
                          imageUrl === preset.url ? 'border-rose-500 bg-rose-50/25 ring-2 ring-rose-200' : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <img src={preset.url} alt="" className="h-10 w-full object-cover rounded-md" referrerPolicy="no-referrer" />
                        <span className="text-[7.5px] font-black uppercase text-center block w-full text-slate-500 truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options Switches (Popular, Customizable) & Tags */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={isPopular}
                      onChange={(e) => setIsPopular(e.target.checked)}
                      className="w-4 h-4 text-rose-500 border-slate-300 rounded-xs focus:ring-rose-400 cursor-pointer"
                    />
                    <div>
                      <span className="block text-[10px] font-bold text-slate-700">Destaque ⭐</span>
                      <span className="text-[8px] text-slate-400 block font-normal leading-tight">Aparece na seção 'Mais Vendido'.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={isCustomizable}
                      onChange={(e) => setIsCustomizable(e.target.checked)}
                      className="w-4 h-4 text-rose-500 border-slate-300 rounded-xs focus:ring-rose-400 cursor-pointer"
                    />
                    <div>
                      <span className="block text-[10px] font-bold text-slate-700">Customizável 🎚️</span>
                      <span className="text-[8px] text-slate-400 block font-normal leading-tight">Escolha de caldas/adicionais e tamanhos.</span>
                    </div>
                  </label>
                </div>

                {isCustomizable && (
                  <div className="space-y-3 bg-slate-50/55 p-3.5 rounded-2xl border border-slate-100 font-sans">
                    <div>
                      <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500 mb-2">🍨 Sabores de Sorvete Permitidos</h4>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setAllowedFlavors(flavorOptions.map(f => f.id))}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8.5px] font-black uppercase hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                        >
                          Marcar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllowedFlavors([])}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8.5px] font-black uppercase hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white">
                        {flavorOptions.map(f => {
                          const isChecked = allowedFlavors.includes(f.id);
                          return (
                            <label key={f.id} className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-50 text-[10px] font-bold text-slate-600">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setAllowedFlavors(allowedFlavors.filter(id => id !== f.id));
                                  } else {
                                    setAllowedFlavors([...allowedFlavors, f.id]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-rose-500 border-slate-300 rounded focus:ring-rose-450 cursor-pointer"
                              />
                              <span className="truncate">{f.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500 mb-2">🍓 Toppings & Adicionais Permitidos</h4>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setAllowedToppings(toppingOptions.map(t => t.id))}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8.5px] font-black uppercase hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                        >
                          Marcar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllowedToppings([])}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8.5px] font-black uppercase hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white">
                        {toppingOptions.map(t => {
                          const isChecked = allowedToppings.includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-50 text-[10px] font-bold text-slate-600">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setAllowedToppings(allowedToppings.filter(id => id !== t.id));
                                  } else {
                                    setAllowedToppings([...allowedToppings, t.id]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-rose-500 border-slate-300 rounded focus:ring-rose-450 cursor-pointer"
                              />
                              <span className="truncate">{t.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preços e Configurações de Tamanhos no Modal */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3.5">
                      <div>
                        <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-705 flex items-center gap-1.5">
                          📐 Configuração de Tamanhos do Copo
                        </h4>
                        <p className="text-[8.5px] text-slate-450 font-normal leading-tight mt-0.5">
                          Escolha se este item segue os tamanhos padrões da categoria, se é um copo de tamanho único ou se tem tamanhos customizados:
                        </p>
                      </div>

                      {/* Size Mode Selector */}
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded-xl">
                        {(['default', 'single', 'custom'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSizeMode(mode)}
                            className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                              sizeMode === mode
                                ? 'bg-white text-rose-500 shadow-xs border border-rose-100/50'
                                : 'text-slate-450 hover:text-slate-600'
                            }`}
                          >
                            {mode === 'default' ? 'Padrão' : mode === 'single' ? 'Tamanho Único' : 'Personalizado'}
                          </button>
                        ))}
                      </div>

                      {/* Render based on sizeMode */}
                      {sizeMode === 'single' ? (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="block text-[8px] uppercase font-bold text-slate-400">Nome do Tamanho Único</label>
                            <input
                              type="text"
                              value={singleSizeLabel}
                              onChange={(e) => setSingleSizeLabel(e.target.value)}
                              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                              placeholder="Ex: Copo Único, 500ml"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[8px] uppercase font-bold text-slate-400">Preço (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={singleSizePrice}
                              onChange={(e) => setSingleSizePrice(e.target.value)}
                              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                              placeholder="18.00"
                            />
                          </div>
                        </div>
                      ) : sizeMode === 'custom' ? (
                        <div className="space-y-2.5 pt-1">
                          <p className="text-[8px] text-slate-450 leading-tight">
                            Ative/desative tamanhos para este copo específico e defina nomes e preços individuais:
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {['300ml', '400ml', '500ml', '700ml'].map((sz) => {
                              const sizeData = customSizes[sz] || { active: true, price: 20, label: sz };
                              return (
                                <div key={sz} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={sizeData.active}
                                      onChange={(e) => {
                                        setCustomSizes((prev) => ({
                                          ...prev,
                                          [sz]: { ...sizeData, active: e.target.checked },
                                        }));
                                      }}
                                      className="w-3.5 h-3.5 text-rose-500 border-slate-300 rounded focus:ring-rose-450"
                                    />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{sz}</span>
                                  </label>
                                  {sizeData.active && (
                                    <div className="flex-1 flex gap-2 ml-auto">
                                      <div className="flex-1">
                                        <input
                                          type="text"
                                          placeholder="Nome exibido"
                                          value={sizeData.label}
                                          onChange={(e) => {
                                            setCustomSizes((prev) => ({
                                              ...prev,
                                              [sz]: { ...sizeData, label: e.target.value },
                                            }));
                                          }}
                                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9.5px] font-bold text-slate-700"
                                        />
                                      </div>
                                      <div className="w-24 relative">
                                        <span className="absolute left-1.5 top-1.5 text-[8px] font-bold text-slate-400">R$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={sizeData.price}
                                          onChange={(e) => {
                                            setCustomSizes((prev) => ({
                                              ...prev,
                                              [sz]: { ...sizeData, price: parseFloat(e.target.value) || 0 },
                                            }));
                                          }}
                                          className="w-full pl-5 pr-1.5 py-1 bg-white border border-slate-200 rounded-lg text-[9.5px] font-bold text-slate-700"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-[8.5px] text-slate-450 leading-normal">
                            Usando as configurações globais de tamanhos e preços para a categoria <span className="font-bold text-rose-500">{(category === 'acai' ? 'Açaí' : category === 'sorvete' ? 'Sorvete' : category === 'milkshake' ? 'Milkshake' : category)}.</span> Todos os copos dessa categoria compartilham esses preços base:
                          </p>
                          {category === 'milkshake' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">300ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={msPrice300}
                                  onChange={(e) => setMsPrice300(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">400ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={msPrice400}
                                  onChange={(e) => setMsPrice400(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">500ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={msPrice500}
                                  onChange={(e) => setMsPrice500(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">700ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={msPrice700}
                                  onChange={(e) => setMsPrice700(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                            </div>
                          ) : (category === 'acai' && name.toLowerCase().includes('brownie')) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">400ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={brPrice400}
                                  onChange={(e) => setBrPrice400(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">500ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={brPrice500}
                                  onChange={(e) => setBrPrice500(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">700ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={brPrice700}
                                  onChange={(e) => setBrPrice700(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">300ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={price300}
                                  onChange={(e) => setPrice300(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">400ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={price400}
                                  onChange={(e) => setPrice400(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">500ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={price500}
                                  onChange={(e) => setPrice500(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] uppercase text-slate-400">700ml</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={price700}
                                  onChange={(e) => setPrice700(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Custom Tags */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase text-slate-450 tracking-wide flex items-center justify-between">
                    <span>Tags Empreendedoras (Separadas por vírgula)</span>
                    <span className="text-[8.5px] text-slate-400 font-normal">Ex: Mais Vendido, Novidade, Gourmet</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Gourmet, Favorito, Saudável"
                    value={tagsString}
                    onChange={(e) => setTagsString(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-705 placeholder-slate-400 focus:outline-hidden focus:border-rose-450 transition-colors"
                  />
                </div>

              </form>

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-50 bg-slate-50/80 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer text-[10px] uppercase font-extrabold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-100 transition-all cursor-pointer text-[10px] uppercase font-extrabold flex items-center gap-1"
                >
                  {loading ? (
                    <span className="animate-pulse">Calculando...</span>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Salvar Produto
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal?.show && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-xl">
                ⚠️
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  {confirmModal.title}
                </h3>
                <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
              <div className="flex gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmModal.onConfirm()}
                  className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] uppercase rounded-xl shadow-md shadow-rose-100 transition-all cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Widescreen Interactive TV Menu Board Overlay */}
      <AnimatePresence>
        {isFullscreenBoardOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[10000] bg-[#FAF8F5] p-8 sm:p-12 flex flex-col justify-between overflow-hidden font-sans select-none text-slate-800"
          >
            {/* Golden curves in corners */}
            <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-amber-300/30 rounded-tl-3xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-24 h-24 border-t-4 border-r-4 border-amber-300/30 rounded-tr-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 border-b-4 border-l-4 border-amber-300/30 rounded-bl-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-amber-300/30 rounded-br-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={() => setIsFullscreenBoardOpen(false)}
              className="absolute top-6 right-6 p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-full shadow-lg transition-all cursor-pointer z-[10010] group"
              title="Pressione ESC para Sair"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Top Bar: Title & Brand slogan */}
            <div className="flex justify-between items-center border-b-2 border-amber-200/50 pb-4">
              <div className="flex items-center gap-4 text-left">
                <span className="text-rose-500 text-4xl sm:text-5xl animate-bounce">👑</span>
                <div className="leading-none">
                  <h1 className="font-sans font-black text-slate-900 tracking-wider text-3xl sm:text-4xl lg:text-5xl uppercase">
                    {boardTitle}
                  </h1>
                  <span className="block text-xs sm:text-sm lg:text-base text-rose-500 font-black tracking-widest uppercase mt-1">
                    — {boardSubtitle} —
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-widest uppercase">NÃO É SÓ SORVETE, É UMA</p>
                <p className="text-base sm:text-lg lg:text-2xl font-black text-rose-600 uppercase tracking-widest leading-none mt-1">
                  {boardSlogan}
                </p>
              </div>
            </div>

            {/* Main Menu Widescreen Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-6 flex-1 items-stretch overflow-hidden">
              
              {/* Left Column (Açaí & Copos Especiais) */}
              <div className="bg-white/45 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between text-left shadow-xs">
                {/* Açaí Section */}
                <div>
                  <h3 className="font-black text-rose-600 uppercase text-xs sm:text-sm lg:text-base tracking-wider mb-3 flex items-center gap-1.5 border-b border-rose-100 pb-1.5">
                    💜 Copos de Açaí & Sorvete
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-rose-50/20 p-2.5 rounded-xl border border-rose-100/10 flex justify-between items-center">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{label300}</span>
                      <span className="font-black text-rose-600 text-sm sm:text-base">R$ {price300}</span>
                    </div>
                    <div className="bg-rose-50/20 p-2.5 rounded-xl border border-rose-100/10 flex justify-between items-center">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{label400}</span>
                      <span className="font-black text-rose-600 text-sm sm:text-base">R$ {price400}</span>
                    </div>
                    <div className="bg-rose-50/20 p-2.5 rounded-xl border border-rose-100/10 flex justify-between items-center">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{label500}</span>
                      <span className="font-black text-rose-600 text-sm sm:text-base">R$ {price500}</span>
                    </div>
                    <div className="bg-rose-50/20 p-2.5 rounded-xl border border-rose-100/10 flex justify-between items-center">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{label700}</span>
                      <span className="font-black text-rose-600 text-sm sm:text-base">R$ {price700}</span>
                    </div>
                  </div>
                </div>

                {/* Cortesias Section */}
                <div className="my-4 bg-rose-50/50 p-3 rounded-xl border border-rose-100/30 text-left">
                  <h4 className="font-black text-rose-800 uppercase text-[9px] sm:text-[10px] tracking-widest mb-1">
                    ✨ CORTESIAS INCLUSAS EM TODOS OS COPOS:
                  </h4>
                  <p className="text-[11px] sm:text-xs font-semibold leading-relaxed text-slate-600">
                    {boardCortesiasList}
                  </p>
                </div>

                {/* Copos Especiais Section */}
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-xs sm:text-sm lg:text-base tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-150 pb-1.5">
                    🍓 Copos Especiais & Taças
                  </h3>
                  <div className="space-y-2">
                    {specialCups.length > 0 ? (
                      specialCups.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 hover:bg-slate-50/50 rounded-xl transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image && (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-9 h-9 object-cover rounded-xl flex-shrink-0 border border-slate-100"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="min-w-0 text-left">
                              <span className="font-extrabold text-slate-800 text-xs block truncate">{item.name}</span>
                              {item.description && (
                                <span className="block text-[9px] sm:text-[10px] text-slate-450 truncate leading-none mt-0.5">{item.description}</span>
                              )}
                            </div>
                          </div>
                          <span className="font-black text-slate-900 text-xs sm:text-sm flex-shrink-0">R$ {item.price.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs p-1">
                          <span className="font-bold text-slate-600">Copo Trufado Nutella/Amendoim</span>
                          <span className="font-black text-slate-800">R$ 20,00</span>
                        </div>
                        <div className="flex justify-between items-center text-xs p-1">
                          <span className="font-bold text-slate-600">Copo da Felicidade Supremo</span>
                          <span className="font-black text-slate-800">R$ 30,00</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Column (Milk Shakes) */}
              <div className="bg-white/45 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between text-left shadow-xs">
                <div>
                  <div className="bg-rose-500 text-white text-center py-1 px-3 rounded-xl font-black uppercase text-xs sm:text-sm tracking-wider mb-3">
                    🥤 MILK SHAKES GOURMET
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-rose-50/10 p-2.5 rounded-xl flex justify-between items-center border border-rose-100/10">
                      <span className="font-bold text-slate-700 text-xs sm:text-sm">{msLabel300}</span>
                      <span className="font-black text-rose-500 text-sm sm:text-base">R$ {msPrice300}</span>
                    </div>
                    <div className="bg-rose-50/10 p-2.5 rounded-xl flex justify-between items-center border border-rose-100/10">
                      <span className="font-bold text-slate-700 text-xs sm:text-sm">{msLabel400}</span>
                      <span className="font-black text-rose-500 text-sm sm:text-base">R$ {msPrice400}</span>
                    </div>
                    <div className="bg-rose-50/10 p-2.5 rounded-xl flex justify-between items-center border border-rose-100/10">
                      <span className="font-bold text-slate-700 text-xs sm:text-sm">{msLabel500}</span>
                      <span className="font-black text-rose-500 text-sm sm:text-base">R$ {msPrice500}</span>
                    </div>
                    <div className="bg-rose-50/10 p-2.5 rounded-xl flex justify-between items-center border border-rose-100/10">
                      <span className="font-bold text-slate-700 text-xs sm:text-sm">{msLabel700}</span>
                      <span className="font-black text-rose-500 text-sm sm:text-base">R$ {msPrice700}</span>
                    </div>
                  </div>
                </div>

                {/* Sabores de Sorvete */}
                <div className="my-4 bg-slate-100/60 p-3.5 rounded-xl border border-slate-150 text-left">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                    🍨 SABORES DE SORVETE DISPONÍVEIS:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {boardMsFlavorList.split(',').map((flav, idx) => (
                      <span key={idx} className="bg-white px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-black text-slate-700 border border-slate-200/50 shadow-xs">
                        {flav.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Premium Shakes */}
                <div>
                  {premiumShakes.length > 0 && (
                    <>
                      <h3 className="font-black text-rose-600 uppercase text-xs sm:text-sm tracking-wider mb-2 flex items-center gap-1.5 border-b border-rose-100 pb-1.5">
                        ✨ Shakes Especiais & Premium
                      </h3>
                      <div className="space-y-2">
                        {premiumShakes.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 hover:bg-slate-50/50 rounded-xl transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.image && (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-9 h-9 object-cover rounded-xl flex-shrink-0 border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div className="min-w-0 text-left">
                                <span className="font-extrabold text-slate-800 text-xs block truncate">{item.name}</span>
                                {item.description && (
                                  <span className="block text-[9px] sm:text-[10px] text-slate-450 truncate leading-none mt-0.5">{item.description}</span>
                                )}
                              </div>
                            </div>
                            <span className="font-black text-rose-500 text-xs sm:text-sm flex-shrink-0">R$ {item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column (Buckets, Coffee & Toppings) */}
              <div className="bg-white/45 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between text-left shadow-xs">
                <div>
                  <h3 className="font-black text-amber-600 uppercase text-xs sm:text-sm lg:text-base tracking-wider mb-2 flex items-center gap-1.5 border-b border-amber-200/50 pb-1.5">
                    🍨 Baldes & Cafés Premium
                  </h3>
                  
                  <div className="space-y-2">
                    {baldesAndCafes.length > 0 ? (
                      baldesAndCafes.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 hover:bg-slate-50/50 rounded-xl transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image && (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-9 h-9 object-cover rounded-xl flex-shrink-0 border border-slate-100"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="min-w-0 text-left">
                              <span className="font-extrabold text-slate-800 text-xs block truncate">{item.name}</span>
                              {item.description && (
                                <span className="block text-[9px] sm:text-[10px] text-slate-450 truncate leading-none mt-0.5">{item.description}</span>
                              )}
                            </div>
                          </div>
                          <span className="font-black text-amber-600 text-xs sm:text-sm flex-shrink-0">R$ {item.price.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs p-1">
                          <span className="font-bold text-slate-600">Balde Brownie 700ml</span>
                          <span className="font-black text-amber-600">R$ {brPrice700}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs p-1">
                          <span className="font-bold text-slate-600">Doce de Leite 700ml</span>
                          <span className="font-black text-amber-600">R$ 25,00</span>
                        </div>
                        <div className="flex justify-between items-center text-xs p-1">
                          <span className="font-bold text-slate-600">Frappuccino 500ml</span>
                          <span className="font-black text-amber-600">R$ 25,00</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Additional Extras */}
                <div className="mt-4 text-left flex-1 flex flex-col justify-end">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 border-t border-slate-150 pt-3">
                    ➕ COMPLEMENTOS & ADICIONAIS EXTRA:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {boardAdicionaisList.split(',').map((item, idx) => (
                      <span key={idx} className="bg-slate-100 px-2.5 py-1 rounded-xl text-[10px] font-bold text-slate-600 border border-slate-200/35">
                        {item.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Section: Socials & Contact */}
            <div className="flex justify-between items-center border-t-2 border-amber-200/50 pt-4 text-xs sm:text-sm lg:text-base font-black text-slate-700">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500 text-white p-1.5 rounded-full text-base w-8 h-8 flex items-center justify-center animate-pulse">📞</span>
                <span className="font-mono text-slate-800">{boardCustomNote} — {boardPhone}</span>
              </div>
              
              <div className="text-[10px] sm:text-xs font-black text-slate-350 tracking-widest uppercase">
                📺 MODO TV ATIVO • PRESSIONE ESC PARA SAIR
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-rose-500 text-white p-1.5 rounded-full text-base w-8 h-8 flex items-center justify-center">📷</span>
                <span className="text-rose-600">{boardInstagram}</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
