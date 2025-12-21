/**
 * TanStack Query keys for cache management.
 */
export const queryKeys = {
  presentations: ['presentations'] as const,
  presentation: (id: string) => ['presentations', id] as const,
  asset: (presentationId: string, assetId: string) =>
    ['assets', presentationId, assetId] as const,
  config: ['config'] as const,
} as const;
