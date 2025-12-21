import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { WS_URL } from '../config';
import { queryKeys } from '../utils/constants';

interface ContentChangedEvent {
  presentationId: string;
  assetId: string;
  filename: string;
}

// Singleton socket instance
let socket: Socket | null = null;

/**
 * Get or create the Socket.io connection.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

/**
 * Hook for Socket.io connection status.
 */
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return isConnected;
}

/**
 * Hook for joining/leaving a presentation room.
 */
export function usePresentationRoom(presentationId: string | null) {
  useEffect(() => {
    if (!presentationId) return;

    const s = getSocket();
    s.emit('join:presentation', { presentationId });

    return () => {
      s.emit('leave:presentation', { presentationId });
    };
  }, [presentationId]);
}

/**
 * Hook for invalidating queries on Socket.io events.
 */
export function useSocketInvalidation(event: string, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });
    };

    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
  }, [queryClient, event, queryKey]);
}

/**
 * Hook for real-time presentation updates.
 * Handles both content changes (iframe reload) and structure changes (sidebar refresh).
 */
export function usePresentationUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    // Structure changes (file add/remove) - refresh sidebar
    const handleStructureChange = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
    };

    // Legacy event - treat as structure change for backwards compatibility
    const handleLegacyUpdate = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
    };

    s.on('structure:changed', handleStructureChange);
    s.on('presentations:updated', handleLegacyUpdate);

    return () => {
      s.off('structure:changed', handleStructureChange);
      s.off('presentations:updated', handleLegacyUpdate);
    };
  }, [queryClient]);
}

/**
 * Hook for content changes that require iframe reload.
 * Returns a reload key that changes when content is modified.
 * Also invalidates asset query to refresh content from server.
 */
export function useContentChanges(
  presentationId: string | undefined,
  assetId: string | undefined
): number {
  const queryClient = useQueryClient();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!presentationId) return;

    const s = getSocket();

    const handleContentChanged = (event: ContentChangedEvent) => {
      // Check if this change affects the current presentation
      if (event.presentationId !== presentationId) return;

      // Determine if this affects the current view
      const isCurrentAsset = event.assetId === assetId;
      const isSupportingFile = event.filename.endsWith('.css') || event.filename.endsWith('.js');

      if (isCurrentAsset || isSupportingFile) {
        // Invalidate the asset query to get fresh content from server
        if (assetId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.asset(presentationId, assetId),
          });
        }

        // Increment reload key to force iframe refresh
        setReloadKey((prev) => prev + 1);
        console.log(`[FliDeck] Content changed: ${event.filename}, reloading iframe`);
      }
    };

    s.on('content:changed', handleContentChanged);
    return () => {
      s.off('content:changed', handleContentChanged);
    };
  }, [queryClient, presentationId, assetId]);

  return reloadKey;
}

/**
 * Hook for manually triggering a refresh.
 */
export function useRefreshPresentations() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
  }, [queryClient]);
}
