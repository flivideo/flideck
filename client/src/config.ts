/**
 * Application configuration.
 * Uses environment variables with sensible defaults for development.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5201';
export const WS_URL = import.meta.env.VITE_WS_URL || API_URL;
