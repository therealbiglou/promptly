// preload.js - Electron Preload Script
// This file creates a secure bridge between your React app and Electron's main process

console.log('[PRELOAD] Script started loading');

const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] Electron modules loaded');

contextBridge.exposeInMainWorld('electron', {
  // Open the transparent presenter window
  openPresenterWindow: () => {
    ipcRenderer.send('open-presenter-window');
  },
  
  // Close the presenter window
  closePresenterWindow: () => {
    ipcRenderer.send('close-presenter-window');
  },
  
  // Send content updates to the presenter window
  updatePresenterContent: (data) => {
    ipcRenderer.send('update-presenter-content', data);
  },
  
  // Send scroll position updates to the presenter window
  updatePresenterScroll: (position) => {
    ipcRenderer.send('update-presenter-scroll', position);
  },

  // Send spotlight position updates to the presenter window
  updatePresenterSpotlight: (position) => {
    ipcRenderer.send('update-presenter-spotlight', position);
  },

  // Send countdown value (number or null) to the presenter window
  updatePresenterCountdown: (value) => {
    ipcRenderer.send('update-presenter-countdown', value);
  },

  // Push current Promptly state to the Logi plugin clients (via main process)
  pushPluginState: (state) => {
    ipcRenderer.send('plugin-state-push', state);
  },

  // Logi Plugin Service plugin install status
  getLogiPluginStatus: () => ipcRenderer.invoke('logi-plugin-status'),
  reinstallLogiPlugin: () => ipcRenderer.send('logi-plugin-reinstall'),
  onLogiPluginStatus: (callback) => {
    const subscription = (event, status) => callback(status);
    ipcRenderer.on('logi-plugin-status', subscription);
    return () => ipcRenderer.removeListener('logi-plugin-status', subscription);
  },

  // For the presenter window: listen for countdown updates
  onPresenterCountdownUpdate: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('presenter-countdown-update', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-countdown-update', subscription);
    };
  },


  // Send generic message to presenter window
  sendPresenterMessage: (message) => {
    ipcRenderer.send('presenter-message', message);
  },
  
  // Listen for when the presenter window is closed
  onPresenterWindowClosed: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('presenter-window-closed', subscription);
    
    // Return unsubscribe function for cleanup
    return () => {
      ipcRenderer.removeListener('presenter-window-closed', subscription);
    };
  },
  
  // For the presenter window: listen for content updates
  onPresenterContentUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('presenter-content-update', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-content-update', subscription);
    };
  },
  
  // For the presenter window: listen for scroll updates
  onPresenterScrollUpdate: (callback) => {
    const subscription = (event, position) => callback(position);
    ipcRenderer.on('presenter-scroll-update', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-scroll-update', subscription);
    };
  },

  // For the presenter window: listen for spotlight position updates
  onPresenterSpotlightUpdate: (callback) => {
    const subscription = (event, position) => callback(position);
    ipcRenderer.on('presenter-spotlight-update', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-spotlight-update', subscription);
    };
  },

  // For the presenter window: listen for generic messages
  onPresenterMessage: (callback) => {
    const subscription = (event, message) => callback(message);
    ipcRenderer.on('presenter-message-received', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-message-received', subscription);
    };
  },

  // Toggle fullscreen mode for presenter window. desiredState is optional;
  // when provided, main process uses it directly instead of querying isFullScreen()
  // (which is unreliable on Windows).
  togglePresenterFullscreen: (desiredState) => {
    ipcRenderer.send('toggle-presenter-fullscreen', desiredState);
  },

  // Multi-monitor support
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getPresenterDisplay: () => ipcRenderer.invoke('get-presenter-display'),
  setPresenterDisplay: (id) => {
    ipcRenderer.send('set-presenter-display', id);
  },
  onDisplaysChanged: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('displays-changed', subscription);
    return () => {
      ipcRenderer.removeListener('displays-changed', subscription);
    };
  },

  // Exit fullscreen mode for presenter window
  exitPresenterFullscreen: () => {
    ipcRenderer.send('exit-presenter-fullscreen');
  },

  // For the presenter window: listen for fullscreen state changes
  onPresenterFullscreenChange: (callback) => {
    const subscription = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('presenter-fullscreen-changed', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-fullscreen-changed', subscription);
    };
  },

  // Start window drag
  startPresenterDrag: () => {
    ipcRenderer.send('start-presenter-drag');
  },

  // Update window position during drag
  updatePresenterPosition: (x, y) => {
    ipcRenderer.send('update-presenter-position', { x, y });
  },

  // Move window by delta (for more reliable dragging)
  movePresenterWindow: (deltaX, deltaY) => {
    ipcRenderer.send('move-presenter-window', { deltaX, deltaY });
  },

  // Listen for drag offset
  onPresenterDragOffset: (callback) => {
    const subscription = (event, offset) => callback(offset);
    ipcRenderer.on('presenter-drag-offset', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-drag-offset', subscription);
    };
  },

  // Send keyboard events from presenter to main window
  sendPresenterKeyboardEvent: (keyData) => {
    ipcRenderer.send('presenter-keyboard-event', keyData);
  },

  // Listen for keyboard events forwarded from presenter window
  onKeyboardFromPresenter: (callback) => {
    const subscription = (event, keyData) => callback(keyData);
    ipcRenderer.on('keyboard-from-presenter', subscription);
    return () => {
      ipcRenderer.removeListener('keyboard-from-presenter', subscription);
    };
  },

  // ============================================
  // File System Operations for Scripts
  // ============================================

  // Save script to file
  saveScriptFile: (filePath, content) => {
    return ipcRenderer.invoke('save-script-file', { filePath, content });
  },

  // Load script from file
  loadScriptFile: (filePath) => {
    return ipcRenderer.invoke('load-script-file', filePath);
  },

  // Read directory contents
  readDirectory: (dirPath) => {
    return ipcRenderer.invoke('read-directory', dirPath);
  },

  // Choose scripts folder
  chooseScriptsFolder: () => {
    return ipcRenderer.invoke('choose-scripts-folder');
  },

  // Save As dialog
  saveScriptDialog: (defaultName) => {
    return ipcRenderer.invoke('save-script-dialog', defaultName);
  },

  // Open file dialog
  openScriptDialog: () => {
    return ipcRenderer.invoke('open-script-dialog');
  },

  // Import file dialog
  importFileDialog: () => {
    return ipcRenderer.invoke('import-file-dialog');
  },

  // Delete script file
  deleteScriptFile: (filePath) => {
    return ipcRenderer.invoke('delete-script-file', filePath);
  },

  // Get app paths
  getAppPaths: () => {
    return ipcRenderer.invoke('get-app-paths');
  },

  // Import file (handles .txt, .docx, .pdf)
  importFile: (filePath) => {
    return ipcRenderer.invoke('import-file', filePath);
  },

  // Capture presenter window frame
  capturePresenterFrame: () => {
    return ipcRenderer.invoke('capture-presenter-frame');
  },

  // Get presenter window ID for video stream capture
  getPresenterWindowId: () => {
    return ipcRenderer.invoke('get-presenter-window-id');
  },

  // Get available desktop capture sources (for streaming presenter window)
  getDesktopSources: (options) => {
    return ipcRenderer.invoke('get-desktop-sources', options);
  },

  // Send presenter window dimensions to main window
  sendPresenterDimensions: (dimensions) => {
    ipcRenderer.send('presenter-dimensions-update', dimensions);
  },

  // Listen for presenter window dimensions updates (in main window)
  onPresenterDimensionsUpdate: (callback) => {
    const subscription = (event, dimensions) => callback(dimensions);
    ipcRenderer.on('presenter-dimensions-update', subscription);
    return () => {
      ipcRenderer.removeListener('presenter-dimensions-update', subscription);
    };
  },

  // ============================================
  // Remote Control Server
  // ============================================

  // Start remote control server
  startRemoteServer: () => {
    return ipcRenderer.invoke('start-remote-server');
  },

  // Stop remote control server
  stopRemoteServer: () => {
    return ipcRenderer.invoke('stop-remote-server');
  },

  // Listen for remote server started event
  onRemoteServerStarted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('remote-server-started', subscription);
    return () => {
      ipcRenderer.removeListener('remote-server-started', subscription);
    };
  },

  // Listen for Cloudflare tunnel becoming ready (cross-network URL).
  onRemoteTunnelReady: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('remote-server-tunnel-ready', subscription);
    return () => {
      ipcRenderer.removeListener('remote-server-tunnel-ready', subscription);
    };
  },

  // Listen for the Cloudflare tunnel being stopped (user clicked Stop).
  onRemoteTunnelStopped: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('remote-tunnel-stopped', subscription);
    return () => {
      ipcRenderer.removeListener('remote-tunnel-stopped', subscription);
    };
  },

  // Auto-updater
  onUpdateAvailable: (callback) => {
    const subscription = (event, info) => callback(info);
    ipcRenderer.on('update-available', subscription);
    return () => ipcRenderer.removeListener('update-available', subscription);
  },
  onUpdateProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('update-download-progress', subscription);
    return () => ipcRenderer.removeListener('update-download-progress', subscription);
  },
  onUpdateDownloaded: (callback) => {
    const subscription = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', subscription);
    return () => ipcRenderer.removeListener('update-downloaded', subscription);
  },
  downloadUpdate: () => ipcRenderer.send('update-download'),
  quitAndInstallUpdate: () => ipcRenderer.send('update-quit-and-install'),

  // Listen for remote server stopped event
  onRemoteServerStopped: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('remote-server-stopped', subscription);
    return () => {
      ipcRenderer.removeListener('remote-server-stopped', subscription);
    };
  },

  // Listen for remote commands from mobile device
  onRemoteCommand: (callback) => {
    const subscription = (event, command) => callback(command);
    ipcRenderer.on('remote-command', subscription);
    return () => {
      ipcRenderer.removeListener('remote-command', subscription);
    };
  }
});

console.log('[PRELOAD] window.electron exposed successfully');
console.log('[PRELOAD] Preload script completed');
