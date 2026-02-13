import { apiClient } from './client';

export interface PublicConfig {
  healthScore: {
    healthyThreshold: number;
    warningThreshold: number;
    criticalThreshold: number;
    defaultScore: number;
    excludedCheckTypes: string[];
  };
}

// Default values (fallback if API fails)
export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  healthScore: {
    healthyThreshold: 80,
    warningThreshold: 60,
    criticalThreshold: 30,
    defaultScore: 50,
    excludedCheckTypes: ['CUSTOM', 'LOG_MONITORING', 'FILESYSTEM_INTEGRITY'],
  },
};

let cachedConfig: PublicConfig | null = null;

export async function fetchPublicConfig(): Promise<PublicConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const response = await apiClient.get('/config/public');
    cachedConfig = response.data.data;
    return cachedConfig!;
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}

export function getPublicConfig(): PublicConfig {
  return cachedConfig || DEFAULT_PUBLIC_CONFIG;
}
