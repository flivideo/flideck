import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../utils/api';
import { queryKeys } from '../utils/constants';
import { getSocket } from './useSocket';
import type { ConfigResponse } from '@flideck/shared';

/**
 * Hook for fetching current config.
 */
export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => api.get<ConfigResponse>('/api/config'),
  });
}

/**
 * Hook for updating config (presentationsRoot).
 */
export function useUpdateConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (presentationsRoot: string) =>
      api.put<{ presentationsRoot: string }>('/api/config', { presentationsRoot }),
    onSuccess: () => {
      // Invalidate config and presentations queries
      queryClient.invalidateQueries({ queryKey: queryKeys.config });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
    },
  });
}

/**
 * Hook for real-time config updates.
 * Invalidates config and presentation queries when config changes.
 */
export function useConfigUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    const handler = () => {
      // Invalidate config and presentation queries
      queryClient.invalidateQueries({ queryKey: queryKeys.config });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
    };

    s.on('config:changed', handler);
    return () => {
      s.off('config:changed', handler);
    };
  }, [queryClient]);
}
