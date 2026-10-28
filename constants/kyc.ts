import { Ionicons } from '@expo/vector-icons';

export interface TradeCategory {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const TRADE_CATEGORIES: TradeCategory[] = [
  {
    id: 'electrical',
    name: 'Electrical Repairs',
    subtitle: 'Residential & Commercial installations',
    icon: 'flash',
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Pipefitting',
    subtitle: 'Drainage, leaks, pipe repairs & fittings',
    icon: 'water',
  },
  {
    id: 'cleaning',
    name: 'Deep Cleaning & Janitorial',
    subtitle: 'Homes, offices & post-construction clean',
    icon: 'sparkles',
  },
  // {
  //   id: 'ac_repair',
  //   name: 'AC & Refrigeration',
  //   subtitle: 'Servicing, gas refill & installations',
  //   icon: 'snow',
  // },
  {
    id: 'carpentry',
    name: 'Carpentry & Woodwork',
    subtitle: 'Furniture, roofing, cabinets & framing',
    icon: 'hammer',
  },
  // {
  //   id: 'painting',
  //   name: 'Painting & Decoration',
  //   subtitle: 'Interior, exterior, POP & screeding',
  //   icon: 'color-palette',
  // },
  {
    id: 'cooking',
    name: 'Catering & Cooking',
    subtitle: 'Private chef, meal prep & event catering',
    icon: 'restaurant',
  },
  {
    id: 'laundry',
    name: 'Laundry & Dry Cleaning',
    subtitle: 'Washing, ironing & garment care',
    icon: 'shirt',
  },
  // {
  //   id: 'mechanic',
  //   name: 'Auto Mechanic & Diagnostics',
  //   subtitle: 'Engine, brakes, suspension & electrical',
  //   icon: 'car',
  // },
  // {
  //   id: 'moving',
  //   name: 'Moving & Delivery',
  //   subtitle: 'Relocation, heavy lifting & haulage',
  //   icon: 'cube',
  // },
];

export interface DocTypeOption {
  id: string;
  title: string;
  subtitle: string;
  expectedLength: number;
  label: string;
  placeholder: string;
}

export const DOC_TYPES: DocTypeOption[] = [
  {
    id: 'nin',
    title: 'National ID (NIN)',
    subtitle: 'Instant lookup',
    expectedLength: 11,
    label: 'Enter 11-digit NIN or BVN',
    placeholder: '22345678901',
  },
  {
    id: 'bvn',
    title: 'Bank Verif. (BVN)',
    subtitle: 'Instant lookup',
    expectedLength: 11,
    label: 'Enter 11-digit NIN or BVN',
    placeholder: '22345678901',
  },
  {
    id: 'drivers',
    title: "Driver's License",
    subtitle: 'Smart card OCR',
    expectedLength: 12,
    label: "Enter Driver's License Number",
    placeholder: 'AAA00000AA00',
  },
  {
    id: 'voters',
    title: "Voter's Card (VIN)",
    subtitle: 'PVC validation',
    expectedLength: 19,
    label: 'Enter 19-digit VIN',
    placeholder: '90F5B00000000000000',
  },
];

export const tradeName = (id?: string) => TRADE_CATEGORIES.find((t) => t.id === id)?.name;
export const docTitle = (id?: string) => DOC_TYPES.find((d) => d.id === id)?.title;
