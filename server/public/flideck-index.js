/**
 * FliDeck Index Library
 *
 * Optional JavaScript library for custom index.html pages to integrate with FliDeck sidebar.
 * Provides event listening and state synchronization capabilities.
 *
 * Usage:
 * ```html
 * <script src="/flideck-index.js"></script>
 * <script>
 *   FliDeckIndex.init({
 *     mode: 'tabbed',
 *     onReorder: (slides, group) => {
 *       // Re-render your custom content
 *     },
 *     onTabChange: (tabId) => {
 *       // Handle tab change
 *     },
 *     preserveTabState: true
 *   });
 * </script>
 * ```
 */
(function(window) {
  'use strict';

  // State
  let config = {
    mode: 'auto',
    onReorder: null,
    onSlideMove: null,
    onTabChange: null,
    preserveTabState: false,
  };

  let socket = null;
  let currentPresentationId = null;

  /**
   * Initialize FliDeck Index integration
   * @param {Object} options - Configuration options
   * @param {string} [options.mode='auto'] - Display mode: 'flat', 'grouped', 'tabbed', or 'auto'
   * @param {Function} [options.onReorder] - Callback when slides are reordered: (slides, group) => void
   * @param {Function} [options.onSlideMove] - Callback when slide moves to different group: (slideId, fromGroup, toGroup) => void
   * @param {Function} [options.onTabChange] - Callback when active tab changes: (tabId) => void
   * @param {boolean} [options.preserveTabState=false] - Whether to persist tab state in localStorage
   */
  function init(options = {}) {
    config = { ...config, ...options };

    // Extract presentation ID from URL
    const pathParts = window.location.pathname.split('/');
    const presentationIdx = pathParts.indexOf('presentations');
    if (presentationIdx !== -1 && pathParts[presentationIdx + 1]) {
      currentPresentationId = pathParts[presentationIdx + 1];
    }

    // Connect to Socket.io if available
    if (typeof io !== 'undefined') {
      connectSocket();
    } else {
      console.warn('FliDeckIndex: Socket.io not loaded. Real-time updates disabled.');
    }

    // Restore tab state if enabled
    if (config.preserveTabState && currentPresentationId) {
      const savedTab = localStorage.getItem(`flideck:tab:${currentPresentationId}`);
      if (savedTab && config.onTabChange) {
        config.onTabChange(savedTab);
      }
    }

    console.log('FliDeckIndex initialized', { mode: config.mode, presentationId: currentPresentationId });
  }

  /**
   * Connect to Socket.io server
   */
  function connectSocket() {
    const serverUrl = window.location.protocol + '//' + window.location.hostname + ':5201';
    socket = io(serverUrl);

    socket.on('connect', () => {
      console.log('FliDeckIndex: Connected to FliDeck server');
      if (currentPresentationId) {
        socket.emit('join:presentation', { presentationId: currentPresentationId });
      }
    });

    socket.on('disconnect', () => {
      console.log('FliDeckIndex: Disconnected from FliDeck server');
    });

    // Listen for slide reorder events
    socket.on('slides:reordered', (data) => {
      console.log('FliDeckIndex: Slides reordered', data);
      if (config.onReorder) {
        config.onReorder(data.slides, data.group);
      }
    });

    // Listen for slide move events
    socket.on('slide:moved', (data) => {
      console.log('FliDeckIndex: Slide moved', data);
      if (config.onSlideMove) {
        config.onSlideMove(data.slideId, data.fromGroup, data.toGroup);
      }
    });

    // Listen for tab change events
    socket.on('tab:changed', (data) => {
      console.log('FliDeckIndex: Tab changed', data);
      if (config.onTabChange) {
        config.onTabChange(data.tabId);
      }

      // Persist tab state if enabled
      if (config.preserveTabState && currentPresentationId) {
        localStorage.setItem(`flideck:tab:${currentPresentationId}`, data.tabId);
      }
    });

    // Listen for presentation updates
    socket.on('presentations:updated', () => {
      console.log('FliDeckIndex: Presentation updated');
      // Could trigger a refresh or re-fetch
    });
  }

  /**
   * Manually set the active tab (will sync with sidebar if connected)
   * @param {string} tabId - Tab ID to activate
   */
  function setActiveTab(tabId) {
    if (socket && socket.connected) {
      socket.emit('set:tab', { presentationId: currentPresentationId, tabId });
    }

    if (config.onTabChange) {
      config.onTabChange(tabId);
    }

    if (config.preserveTabState && currentPresentationId) {
      localStorage.setItem(`flideck:tab:${currentPresentationId}`, tabId);
    }
  }

  /**
   * Get current presentation ID
   * @returns {string|null} Current presentation ID
   */
  function getPresentationId() {
    return currentPresentationId;
  }

  /**
   * Disconnect from Socket.io server
   */
  function disconnect() {
    if (socket) {
      if (currentPresentationId) {
        socket.emit('leave:presentation', { presentationId: currentPresentationId });
      }
      socket.disconnect();
      socket = null;
    }
  }

  // Export public API
  window.FliDeckIndex = {
    init,
    setActiveTab,
    getPresentationId,
    disconnect,
    version: '1.0.0',
  };

  console.log('FliDeckIndex library loaded (v1.0.0)');

})(window);
