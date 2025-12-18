import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { queryKeys } from '../utils/constants';
import type { Presentation, Asset } from '@flideck/shared';

/**
 * Hook for fetching all presentations.
 */
export function usePresentations() {
  return useQuery({
    queryKey: queryKeys.presentations,
    queryFn: () => api.get<Presentation[]>('/api/presentations'),
  });
}

/**
 * Hook for fetching a single presentation.
 */
export function usePresentation(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.presentation(id) : ['presentations', 'none'],
    queryFn: () => api.get<Presentation>(`/api/presentations/${id}`),
    enabled: !!id,
  });
}

/**
 * Hook for fetching asset content.
 */
export function useAsset(presentationId: string | undefined, assetId: string | undefined) {
  return useQuery({
    queryKey:
      presentationId && assetId
        ? queryKeys.asset(presentationId, assetId)
        : ['assets', 'none'],
    queryFn: () =>
      api.get<{ content: string; asset: Asset }>(
        `/api/assets/${presentationId}/${assetId}`
      ),
    enabled: !!presentationId && !!assetId,
  });
}

/**
 * Hook for manually refreshing presentations.
 */
export function useRefreshPresentations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<Presentation[]>('/api/presentations/refresh'),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.presentations, data);
    },
  });
}
