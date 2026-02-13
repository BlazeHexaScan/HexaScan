import { useQuery } from '@tanstack/react-query';
import { fetchPublicConfig, PublicConfig, DEFAULT_PUBLIC_CONFIG } from '../api/publicConfig';

export function usePublicConfig() {
  return useQuery<PublicConfig>({
    queryKey: ['publicConfig'],
    queryFn: fetchPublicConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    placeholderData: DEFAULT_PUBLIC_CONFIG,
  });
}
