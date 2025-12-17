import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Vibrant Tones Palette
const VIBRANT_TONES = [
  '#f94144', // Strawberry Red
  '#f3722c', // Pumpkin Spice
  '#f8961e', // Carrot Orange
  '#f9844a', // Atomic Tangerine
  '#f9c74f', // Tuscan Sun
  '#90be6d', // Willow Green
  '#43aa8b', // Seaweed
  '#4d908e', // Dark Cyan
  '#577590', // Blue Slate
  '#277da1', // Cerulean
];

// Provider color mapping (fixed colors for consistency)
const PROVIDER_COLORS: Record<string, string> = {
  agy: '#f3722c', // Pumpkin
  gemini: '#277da1', // Cerulean
  codex: '#f8961e', // Carrot
  vertex: '#577590', // Blue Slate
  iflow: '#f94144', // Strawberry
  qwen: '#f9c74f', // Tuscan
};

// Status colors (from Analytics Cost breakdown) - darker for light theme contrast
export const STATUS_COLORS = {
  success: '#15803d', // Green-700 (was Seaweed #43aa8b)
  degraded: '#b45309', // Amber-700 (was Ochre #e09f3e)
  failed: '#b91c1c', // Red-700 (was Merlot #9e2a2b)
} as const;

export function getModelColor(model: string): string {
  // FNV-1a hash algorithm
  let hash = 0x811c9dc5;
  for (let i = 0; i < model.length; i++) {
    hash ^= model.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Ensure positive index
  return VIBRANT_TONES[(hash >>> 0) % VIBRANT_TONES.length];
}

export function getProviderColor(provider: string): string {
  const normalized = provider.toLowerCase();
  return PROVIDER_COLORS[normalized] || getModelColor(provider);
}
