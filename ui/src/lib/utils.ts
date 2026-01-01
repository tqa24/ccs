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
  kiro: '#4d908e', // Dark Cyan (AWS-inspired)
  copilot: '#43aa8b', // Seaweed (GitHub-inspired)
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

/**
 * Sort models with Claude models first, then alphabetically
 * Prioritizes: Claude > Gemini > GPT > Other (alphabetically)
 */
export function sortModelsByPriority<T extends { name: string; displayName?: string }>(
  models: T[]
): T[] {
  const getPriority = (model: T): number => {
    const name = (model.displayName || model.name).toLowerCase();
    if (name.includes('claude')) return 0;
    if (name.includes('gemini')) return 1;
    if (name.includes('gpt')) return 2;
    return 3;
  };

  return [...models].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    // Same priority: sort alphabetically by display name
    const nameA = (a.displayName || a.name).toLowerCase();
    const nameB = (b.displayName || b.name).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Format reset time as relative time (e.g., "in 2h 30m")
 */
export function formatResetTime(resetTime: string | null): string | null {
  if (!resetTime) return null;
  try {
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return 'soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  } catch {
    return null;
  }
}

/**
 * Get earliest reset time from models array
 */
export function getEarliestResetTime<T extends { resetTime: string | null }>(
  models: T[]
): string | null {
  return models.reduce(
    (earliest, m) => {
      if (!m.resetTime) return earliest;
      if (!earliest) return m.resetTime;
      return new Date(m.resetTime) < new Date(earliest) ? m.resetTime : earliest;
    },
    null as string | null
  );
}

/**
 * Calculate the minimum quota percentage from Claude models (primary usage).
 * Falls back to minimum of all models if no Claude models exist.
 * Returns null if no valid models or quota data.
 */
export function getMinClaudeQuota<
  T extends { name: string; displayName?: string; percentage: number },
>(models: T[]): number | null {
  if (models.length === 0) return null;

  const claudeModels = models.filter((m) => {
    const name = (m.displayName || m.name || '').toLowerCase();
    return name.includes('claude');
  });

  const targetModels = claudeModels.length > 0 ? claudeModels : models;
  const percentages = targetModels
    .map((m) => m.percentage)
    .filter((p) => typeof p === 'number' && isFinite(p));

  if (percentages.length === 0) return null;
  return Math.min(...percentages);
}
