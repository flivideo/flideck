import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { WS_URL } from '../config';
import { queryKeys } from '../utils/constants';

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
 * Invalidates presentation queries when files change.
 */
export function usePresentationUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    const handler = () => {
      // Invalidate all presentation-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations });
    };

    s.on('presentations:updated', handler);
    return () => {
      s.off('presentations:updated', handler);
    };
  }, [queryClient]);
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
