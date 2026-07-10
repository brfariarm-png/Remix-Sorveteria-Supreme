/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  tags?: string[];
  popular?: boolean;
  customizable?: boolean;
  allowedToppings?: string[];
  allowedFlavors?: string[];
  
  // Custom size configuration fields
  sizeMode?: 'default' | 'single' | 'custom';
  singleSizeLabel?: string;
  singleSizePrice?: number;
  customSizes?: Record<string, { active: boolean; price: number; label: string }>;
}

export interface ToppingOption {
  id: string;
  name: string;
  price: number; // 0 if free/included
  category: 'calda' | 'fruta' | 'crocante' | 'creme';
}

export interface FlavorOption {
  id: string;
  name: string;
  color: string; // Tailwind class background color or hex code
  secondaryColor?: string; // For nice gradient rendering
  category: 'acai' | 'sorvete';
  description: string;
}

export interface CustomCupConfig {
  size: string;
  base: 'acai' | 'sorvete' | 'casadinho'; // casadinho = açaí + sorvete
  flavors: string[]; // flavor IDs
  toppings: string[]; // topping IDs
  needSpoon?: boolean;
}
export const CUP_PRICES = {
  '300ml': 18,
  '400ml': 21,
  '500ml': 25,
  '700ml': 35
} as const;

export interface CartItem {
  id: string; // unique item instance ID
  menuItem: MenuItem;
  quantity: number;
  isCustomCup?: boolean;
  customCupConfig?: CustomCupConfig;
  customCupPrice?: number;
  notes?: string;
  needSpoon?: boolean;
}

export type OrderStatus = 'waiting' | 'preparing' | 'delivering' | 'completed';

export type PaymentType = 'pix' | 'card' | 'cash_on_delivery' | 'card_on_delivery';

export interface CheckoutDetails {
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    reference?: string;
    cep?: string;
  };
  paymentType: PaymentType;
  cardDetails?: {
    number: string;
    name: string;
    expiry: string;
    cvv: string;
  };
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  details: CheckoutDetails;
  status: OrderStatus;
  timestamp: string;
  archived?: boolean;
}

export interface StoreSettings {
  name: string;
  shortName: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  statusOverride: 'auto' | 'open' | 'closed';
  printerPaperWidth: '58mm' | '80mm';
  printerNumCopies: number;
  printerFontSize: number;
  printerFontType: 'monospace' | 'sans-serif' | 'serif';
  printerShowAddress: boolean;
  printerHeaderMessage: string;
  printerFooterMessage: string;
  instagram?: string;
  customDomain?: string;
  deliveryFees: { 
    neighborhood: string; 
    fee: number; 
    exactCep?: string;
    cepStart?: string;
    cepEnd?: string;
  }[];
  
  // Payment Configs
  pixKey?: string;
  pixReceiverName?: string;
  pixReceiverCity?: string;
  pixKeyType?: string;
  paymentPixEnabled?: boolean;
  paymentCardEnabled?: boolean;
  paymentCashDeliveryEnabled?: boolean;
  paymentCardDeliveryEnabled?: boolean;

  // PagSeguro configuration
  pagseguroEnabled?: boolean;
  pagseguroEmail?: string;
  pagseguroToken?: string;
  pagseguroEnvironment?: 'sandbox' | 'production';

  // Customizable WhatsApp Bot properties
  whatsappBotWelcomeMessage?: string;
  whatsappBotMenuMessage?: string;
  whatsappBotSupportMessage?: string;
  whatsappBotMenuLink?: string;

  // Custom cup sizes editable base prices
  cupPrices?: {
    '300ml': number;
    '400ml': number;
    '500ml': number;
    '700ml': number;
  };
  cupLabels?: {
    '300ml': string;
    '400ml': string;
    '500ml': string;
    '700ml': string;
  };
  milkshakePrices?: {
    '300ml': number;
    '400ml': number;
    '500ml': number;
    '700ml': number;
  };
  milkshakeLabels?: {
    '300ml': string;
    '400ml': string;
    '500ml': string;
    '700ml': string;
  };
  browniePrices?: {
    '400ml': number;
    '500ml': number;
    '700ml': number;
  };
  brownieLabels?: {
    '400ml': string;
    '505ml'?: string; // Let's keep it safe
    '500ml': string;
    '700ml': string;
  };

  // 16:9 Digital Menu Board Editable Properties
  boardTitle?: string;
  boardSubtitle?: string;
  boardSlogan?: string;
  boardPhone?: string;
  boardInstagram?: string;
  boardCustomNote?: string;
  boardMsFlavorList?: string;
  boardCortesiasList?: string;
  boardAdicionaisList?: string;
  useAiBoardBackground?: boolean;
}

