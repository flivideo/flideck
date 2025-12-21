import { watch, type FSWatcher } from 'chokidar';
import type { Server } from 'socket.io';

/**
 * Change event data passed to callbacks and Socket.io events.
 */
export interface ChangeEventData {
  eventType: string;
  filePath: string;
}

/**
 * Configuration for a file system watcher.
 */
export interface WatchConfig {
  /** Unique name for this watcher */
  name: string;
  /** Path or glob pattern to watch */
  path: string;
  /** Socket.io event to emit on changes */
  event: string;
  /** Debounce time in milliseconds (default: 300) */
  debounceMs?: number;
  /** Optional Socket.io room for scoped broadcasts */
  room?: string;
  /** Optional server-side callback when files change */
  onChangeCallback?: (data: ChangeEventData) => void | Promise<void>;
}

/**
 * Centralized file system watcher manager.
 * Handles debounced change detection and Socket.io event emission.
 */
export class WatcherManager {
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private callbacks = new Map<string, (data: ChangeEventData) => void | Promise<void>>();

  constructor(private io: Server) {}

  /**
   * Start watching a path for changes.
   * Emits Socket.io events when files change (debounced).
   * Optionally calls a server-side callback.
   */
  watch(config: WatchConfig): void {
    const { name, path, event, debounceMs = 300, room, onChangeCallback } = config;

    if (this.watchers.has(name)) {
      console.log(`Watcher "${name}" already exists, skipping`);
      return;
    }

    // Store callback if provided
    if (onChangeCallback) {
      this.callbacks.set(name, onChangeCallback);
    }

    const watcher = watch(path, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../, // Ignore hidden files
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    watcher.on('all', (eventType, filePath) => {
      this.debounceEmit(name, event, debounceMs, room, { eventType, filePath });
    });

    watcher.on('error', (error) => {
      console.error(`Watcher "${name}" error:`, error);
    });

    this.watchers.set(name, watcher);
    console.log(`Started watcher "${name}" on ${path}`);
  }

  /**
   * Debounced event emission to prevent rapid-fire updates.
   * Also calls the server-side callback if registered.
   */
  private debounceEmit(
    name: string,
    event: string,
    ms: number,
    room?: string,
    data?: ChangeEventData
  ): void {
    const timerKey = `${name}:${event}`;
    const existing = this.debounceTimers.get(timerKey);

    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(
      timerKey,
      setTimeout(async () => {
        // Emit to Socket.io clients
        if (room) {
          this.io.to(room).emit(event, data);
        } else {
          this.io.emit(event, data);
        }

        // Call server-side callback if registered
        const callback = this.callbacks.get(name);
        if (callback && data) {
          try {
            await callback(data);
          } catch (error) {
            console.error(`Callback error for watcher "${name}":`, error);
          }
        }

        this.debounceTimers.delete(timerKey);
      }, ms)
    );
  }

  /**
   * Stop a specific watcher by name.
   */
  stop(name: string): void {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.close();
      this.watchers.delete(name);
      this.callbacks.delete(name);
      console.log(`Stopped watcher "${name}"`);
    }
  }

  /**
   * Stop all active watchers.
   */
  stopAll(): void {
    for (const [name] of this.watchers) {
      this.stop(name);
    }
  }

  /**
   * Gracefully shutdown the watcher manager.
   * Clears all timers and closes all watchers.
   */
  shutdown(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    this.stopAll();
    console.log('WatcherManager shutdown complete');
  }

  /**
   * Get list of active watcher names.
   */
  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }
}
