// main.js - Electron Main Processtion
// This file manages your application windows

const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const mammoth = require('mammoth');
const express = require('express');
const os = require('os');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
// Note: pdf-parse is lazy-loaded only when needed to avoid DOMMatrix errors

// Note: GPU acceleration is REQUIRED for transparent windows on Windows
// Don't disable GPU if you need transparency!

let mainWindow;
let presenterWindow;
let presenterWindowBounds = { width: 1920, height: 1080, x: 100, y: 100 }; // Default bounds
let presenterBeforeFullscreenBounds = null; // Store bounds before fullscreen
let presenterTargetDisplayId = null; // Display id to move presenter to before going fullscreen (null = current)
let suppressFullscreenNotification = false; // True while the move-while-fullscreen dance is running
let presenterIsFullscreen = false; // Source of truth for fullscreen state (Electron's isFullScreen() is flaky on Windows)
let cloudflaredProcess = null; // Spawned cloudflared tunnel subprocess

// Remote control server
let remoteServer = null;
let remoteServerPort = 3001;

// Path for storing persistent data
const userDataPath = app.getPath('userData');
const windowStateFile = path.join(userDataPath, 'window-state.json');

// Load saved window bounds
function loadWindowBounds() {
  try {
    if (fs.existsSync(windowStateFile)) {
      const data = fs.readFileSync(windowStateFile, 'utf8');
      const state = JSON.parse(data);
      if (state.presenterWindow) {
        presenterWindowBounds = state.presenterWindow;
        console.log('Loaded presenter window bounds:', presenterWindowBounds);
      }
      if (typeof state.presenterTargetDisplayId === 'number') {
        presenterTargetDisplayId = state.presenterTargetDisplayId;
        console.log('Loaded presenter target display id:', presenterTargetDisplayId);
      }
    }
  } catch (error) {
    console.error('Failed to load window state:', error);
  }
}

// Save window bounds
function saveWindowBounds() {
  try {
    const state = {
      presenterWindow: presenterWindowBounds,
      presenterTargetDisplayId: presenterTargetDisplayId
    };
    fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2), 'utf8');
    console.log('Saved window state');
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

// Move presenter window to the chosen target display's work area before fullscreen.
// Falls back silently if no target is set or the display is no longer connected.
function moveToTargetDisplayIfNeeded() {
  if (presenterTargetDisplayId == null) return;
  if (!presenterWindow || presenterWindow.isDestroyed()) return;
  const target = screen.getAllDisplays().find(d => d.id === presenterTargetDisplayId);
  if (!target) {
    console.log('Target display not connected, falling back to current monitor');
    return;
  }
  presenterWindow.setBounds(target.workArea);
}

function createMainWindow() {
  // Get the correct preload path - handle ASAR packaging correctly
  let preloadPath;
  if (isDev) {
    preloadPath = path.join(__dirname, 'electron-preload.js');
  } else {
    // In production, get the app path and construct unpacked path
    const appPath = app.getAppPath();
    // If running from ASAR, the preload needs to be in the unpacked folder
    if (appPath.includes('.asar')) {
      // Replace app.asar with app.asar.unpacked in the full path
      const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
      preloadPath = path.join(unpackedPath, 'electron-preload.js');
    } else {
      preloadPath = path.join(appPath, 'electron-preload.js');
    }
  }

  console.log('[MAIN] Creating main window');
  console.log('[MAIN] Preload path:', preloadPath);
  console.log('[MAIN] Preload exists?', fs.existsSync(preloadPath));
  console.log('[MAIN] __dirname:', __dirname);
  console.log('[MAIN] app.getAppPath():', app.getAppPath());
  console.log('[MAIN] isDev:', isDev);

  // Get version from package.json
  const packageJson = require('./package.json');
  const appVersion = packageJson.version;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `Promptly v${appVersion}`,
    show: false, // Don't show until ready to prevent white flash
    backgroundColor: '#1f2937', // Dark gray background matching app theme
    autoHideMenuBar: true, // Hide menu bar (File, Edit, View, etc.)
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  console.log('[MAIN] Main window created');
  
  // Load your React app
  if (isDev) {
    // Development: load from local dev server
    console.log('[MAIN] Loading from dev server: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, 'build', 'index.html');
    console.log('[MAIN] Loading from file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Main window finished loading');
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN] Main window ready to show');
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close presenter window when main window closes
    if (presenterWindow && !presenterWindow.isDestroyed()) {
      presenterWindow.close();
    }
  });
}

function createPresenterWindow() {
  // Don't create if already exists
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.focus();
    return;
  }

  // Get the correct preload and presenter HTML paths - handle ASAR packaging correctly
  let presenterPreloadPath, presenterPath;
  if (isDev) {
    presenterPreloadPath = path.join(__dirname, 'electron-preload.js');
    presenterPath = path.join(__dirname, 'electron-presenter.html');
  } else {
    // In production, get the app path and construct unpacked path
    const appPath = app.getAppPath();
    // If running from ASAR, the preload needs to be in the unpacked folder
    if (appPath.includes('.asar')) {
      // Replace app.asar with app.asar.unpacked in the full path
      const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
      presenterPreloadPath = path.join(unpackedPath, 'electron-preload.js');
      presenterPath = path.join(unpackedPath, 'electron-presenter.html');
    } else {
      presenterPreloadPath = path.join(appPath, 'electron-preload.js');
      presenterPath = path.join(appPath, 'electron-presenter.html');
    }
  }

  console.log('[PRESENTER] Creating presenter window');
  console.log('[PRESENTER] Preload path:', presenterPreloadPath);
  console.log('[PRESENTER] Presenter HTML path:', presenterPath);
  console.log('[PRESENTER] Preload exists?', fs.existsSync(presenterPreloadPath));
  console.log('[PRESENTER] HTML exists?', fs.existsSync(presenterPath));

  // Validate bounds - ensure window appears on a visible screen
  const displays = screen.getAllDisplays();
  let boundsValid = false;

  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    // Check if window center is within this display
    const windowCenterX = presenterWindowBounds.x + presenterWindowBounds.width / 2;
    const windowCenterY = presenterWindowBounds.y + presenterWindowBounds.height / 2;

    if (windowCenterX >= x && windowCenterX < x + width &&
        windowCenterY >= y && windowCenterY < y + height) {
      boundsValid = true;
      break;
    }
  }

  // If bounds are offscreen, reset to primary display
  if (!boundsValid) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    presenterWindowBounds = {
      width: Math.min(1920, width - 100),
      height: Math.min(1080, height - 100),
      x: 50,
      y: 50
    };
    console.log('[PRESENTER] Bounds were offscreen, reset to primary display:', presenterWindowBounds);
  }

  presenterWindow = new BrowserWindow({
    width: presenterWindowBounds.width,
    height: presenterWindowBounds.height,
    x: presenterWindowBounds.x,
    y: presenterWindowBounds.y,
    show: false, // Don't show until ready
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    movable: true,
    hasShadow: false,
    webPreferences: {
      preload: presenterPreloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: false
    }
  });
  console.log('[PRESENTER] Trying to load presenter from:', presenterPath);
  
  presenterWindow.loadFile(presenterPath).catch(err => {
    console.error('Failed to load presenter window:', err);
    // Fallback: try loading from a URL if file doesn't exist
    console.log('Trying fallback...');
    presenterWindow.loadURL('about:blank');
  });
  
  // Show window only when ready to prevent white flash
  presenterWindow.once('ready-to-show', () => {
    console.log('Presenter window ready to show');
    presenterWindow.setBackgroundColor('#00000000');
    presenterWindow.show();
  });

  presenterWindow.webContents.on('did-finish-load', () => {
    console.log('Presenter window loaded successfully');
    // Ensure background is transparent after load
    presenterWindow.setBackgroundColor('#00000000');
  });

  // OPEN DEVTOOLS FOR DEBUGGING (uncomment if needed)
  // presenterWindow.webContents.openDevTools();
  
  presenterWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Presenter window failed to load:', errorCode, errorDescription);
  });
  
  presenterWindow.on('close', () => {
    // Save bounds before closing (if not in fullscreen)
    if (presenterWindow && !presenterWindow.isDestroyed() && !presenterWindow.isFullScreen()) {
      presenterWindowBounds = presenterWindow.getBounds();
      saveWindowBounds(); // Persist to disk
      console.log('[PRESENTER] Saved bounds on close:', presenterWindowBounds);
    }
  });

  presenterWindow.on('closed', () => {
    presenterWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presenter-window-closed');
    }
  });

  // Save window bounds when resized or moved (but not in fullscreen)
  let boundsUpdateTimeout = null;

  const saveBounds = () => {
    if (boundsUpdateTimeout) {
      clearTimeout(boundsUpdateTimeout);
    }
    boundsUpdateTimeout = setTimeout(() => {
      if (presenterWindow && !presenterWindow.isDestroyed() && !presenterWindow.isFullScreen()) {
        presenterWindowBounds = presenterWindow.getBounds();
        saveWindowBounds(); // Persist to disk
      }
    }, 100); // Debounce bounds saving
  };

  presenterWindow.on('resize', saveBounds);
  presenterWindow.on('move', saveBounds);

  // Listen for fullscreen changes (e.g., from F11 or system shortcuts).
  // Do NOT capture bounds here — this event fires after fullscreen is applied,
  // so getBounds() returns fullscreen bounds. Bounds are captured by the toggle
  // IPC handler before setFullScreen(true), and continuously by the resize/move
  // debounce while not fullscreen.
  presenterWindow.on('enter-full-screen', () => {
    if (!presenterWindow || presenterWindow.isDestroyed()) return;
    presenterIsFullscreen = true;
    if (suppressFullscreenNotification) return;
    presenterWindow.webContents.send('presenter-fullscreen-changed', true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presenter-fullscreen-changed', true);
    }
  });

  presenterWindow.on('leave-full-screen', () => {
    if (!presenterWindow || presenterWindow.isDestroyed()) return;
    presenterIsFullscreen = false;
    // During the move-while-fullscreen dance, skip both the notification and
    // the bounds-restore — the dance sets its own explicit bounds afterward.
    if (suppressFullscreenNotification) return;

    presenterWindow.webContents.send('presenter-fullscreen-changed', false);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presenter-fullscreen-changed', false);
    }
    // Restore bounds: prefer the snapshot taken at toggle time;
    // fall back to last-known non-fullscreen bounds (covers F11 / system shortcut).
    const restoreTo = presenterBeforeFullscreenBounds || presenterWindowBounds;
    if (restoreTo) {
      presenterWindow.setBounds(restoreTo);
    }
    presenterBeforeFullscreenBounds = null;
  });
}

// IPC Handlers
ipcMain.on('open-presenter-window', () => {
  createPresenterWindow();
});

ipcMain.on('close-presenter-window', () => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.close();
  }
});

ipcMain.on('update-presenter-content', (event, data) => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.webContents.send('presenter-content-update', data);
  }
});

ipcMain.on('update-presenter-scroll', (event, position) => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.webContents.send('presenter-scroll-update', position);
  }
});

ipcMain.on('update-presenter-spotlight', (event, position) => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.webContents.send('presenter-spotlight-update', position);
  }
});

ipcMain.on('presenter-message', (event, message) => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.webContents.send('presenter-message-received', message);
  }
});

// Forward presenter window dimensions from presenter to main window
ipcMain.on('presenter-dimensions-update', (event, dimensions) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('presenter-dimensions-update', dimensions);
  }
});

ipcMain.on('toggle-presenter-fullscreen', (event, desiredState) => {
  if (!presenterWindow || presenterWindow.isDestroyed()) {
    console.error('toggle-presenter-fullscreen: presenterWindow is null or destroyed');
    return;
  }

  // Renderer is the source of truth (it tracks fullscreen state via
  // presenter-fullscreen-changed events). Only fall back to querying
  // isFullScreen() if the renderer didn't pass a desired state.
  const target = (typeof desiredState === 'boolean')
    ? desiredState
    : !presenterIsFullscreen;

  console.log('toggle-presenter-fullscreen: target =', target);

  if (target) {
    presenterBeforeFullscreenBounds = presenterWindow.getBounds();
    moveToTargetDisplayIfNeeded();
  }
  presenterWindow.setFullScreen(target);
  // The enter-full-screen / leave-full-screen handlers send the
  // presenter-fullscreen-changed notification.
});

ipcMain.on('exit-presenter-fullscreen', () => {
  console.log('========================================');
  console.log('exit-presenter-fullscreen IPC received!');
  console.log('presenterWindow exists?', !!presenterWindow);
  console.log('presenterWindow destroyed?', presenterWindow ? presenterWindow.isDestroyed() : 'N/A');
  console.log('presenterWindow isFullScreen?', presenterWindow && !presenterWindow.isDestroyed() ? presenterWindow.isFullScreen() : 'N/A');

  if (presenterWindow && !presenterWindow.isDestroyed()) {
    const wasFullscreen = presenterWindow.isFullScreen();
    console.log('Was fullscreen (according to Electron):', wasFullscreen);

    // ALWAYS try to exit fullscreen, regardless of what isFullScreen() says
    // On Windows, isFullScreen() sometimes doesn't match the visual state
    console.log('Forcing setFullScreen(false)...');
    presenterWindow.setFullScreen(false);
    console.log('setFullScreen(false) called!');

    presenterWindow.webContents.send('presenter-fullscreen-changed', false);
    // Also notify the main window so it can update its UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presenter-fullscreen-changed', false);
    }
    console.log('Sent presenter-fullscreen-changed event');
  } else {
    console.error('presenterWindow is null or destroyed!');
  }
  console.log('========================================');
});

// Multi-monitor / display selection
ipcMain.handle('get-displays', () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    label: d.label || '',
    bounds: d.bounds,
    workArea: d.workArea,
    size: d.size,
    scaleFactor: d.scaleFactor,
    primary: d.id === primaryId
  }));
});

ipcMain.handle('get-presenter-display', () => presenterTargetDisplayId);

ipcMain.on('set-presenter-display', (event, id) => {
  presenterTargetDisplayId = (typeof id === 'number') ? id : null;
  saveWindowBounds();

  // If presenter is already fullscreen, move it to the new monitor now without
  // requiring the user to toggle fullscreen off and on.
  // Use our tracked flag — presenterWindow.isFullScreen() is flaky on Windows.
  if (!presenterWindow || presenterWindow.isDestroyed()) return;
  if (!presenterIsFullscreen) return;
  if (presenterTargetDisplayId == null) return;
  const target = screen.getAllDisplays().find(d => d.id === presenterTargetDisplayId);
  if (!target) return;

  // Compute the window-sized bounds the user will see after they later exit
  // fullscreen: centered in the new display's work area, sized from the
  // pre-fullscreen window (or last-known non-fullscreen bounds as fallback).
  const baseBounds = presenterBeforeFullscreenBounds || presenterWindowBounds;
  const wantedWidth = Math.min(baseBounds.width, target.workArea.width);
  const wantedHeight = Math.min(baseBounds.height, target.workArea.height);
  const nextWindowBounds = {
    x: target.workArea.x + Math.floor((target.workArea.width - wantedWidth) / 2),
    y: target.workArea.y + Math.floor((target.workArea.height - wantedHeight) / 2),
    width: wantedWidth,
    height: wantedHeight
  };

  suppressFullscreenNotification = true;
  presenterWindow.setFullScreen(false);
  setTimeout(() => {
    if (!presenterWindow || presenterWindow.isDestroyed()) {
      suppressFullscreenNotification = false;
      return;
    }
    presenterWindow.setBounds(nextWindowBounds);
    presenterBeforeFullscreenBounds = nextWindowBounds;
    setTimeout(() => {
      if (!presenterWindow || presenterWindow.isDestroyed()) {
        suppressFullscreenNotification = false;
        return;
      }
      presenterWindow.setFullScreen(true);
      setTimeout(() => { suppressFullscreenNotification = false; }, 50);
    }, 50);
  }, 50);
});

// Handle window dragging
ipcMain.on('start-presenter-drag', (event) => {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    const { screen } = require('electron');
    const mousePos = screen.getCursorScreenPoint();
    const windowBounds = presenterWindow.getBounds();

    // Get the display where the window is located to get scale factor
    const display = screen.getDisplayNearestPoint({ x: windowBounds.x, y: windowBounds.y });
    const scaleFactor = display.scaleFactor;

    // Calculate offset from window position to mouse
    const offsetX = mousePos.x - windowBounds.x;
    const offsetY = mousePos.y - windowBounds.y;

    console.log('Start drag - Scale factor:', scaleFactor, 'Offset:', offsetX, offsetY);

    // Send offset and scale factor back to renderer
    event.reply('presenter-drag-offset', { offsetX, offsetY, scaleFactor });
  }
});

ipcMain.on('update-presenter-position', (event, { x, y }) => {
  if (presenterWindow && !presenterWindow.isDestroyed() && !presenterWindow.isFullScreen()) {
    presenterWindow.setPosition(Math.round(x), Math.round(y));
    // Bounds will be saved by move event handler
  }
});

// Move window by delta (more reliable than absolute positioning)
ipcMain.on('move-presenter-window', (event, { deltaX, deltaY }) => {
  if (presenterWindow && !presenterWindow.isDestroyed() && !presenterWindow.isFullScreen()) {
    const { screen } = require('electron');
    const currentBounds = presenterWindow.getBounds();
    let newX = currentBounds.x + Math.round(deltaX);
    let newY = currentBounds.y + Math.round(deltaY);

    // Get all displays
    const displays = screen.getAllDisplays();

    // Find if the new position is within any display
    let isWithinDisplay = false;
    for (const display of displays) {
      const { x, y, width, height } = display.bounds;
      // Check if at least 100px of the window is within this display
      if (newX + currentBounds.width > x + 100 &&
          newX < x + width - 100 &&
          newY + 40 > y && // Keep title bar visible
          newY < y + height - 100) {
        isWithinDisplay = true;
        break;
      }
    }

    // If window would go completely off-screen, don't move it
    if (!isWithinDisplay) {
      console.log('Prevented window from going off-screen');
      return;
    }

    console.log('Moving window by delta:', deltaX, deltaY, 'to:', newX, newY);
    presenterWindow.setBounds({ x: newX, y: newY, width: currentBounds.width, height: currentBounds.height });
  }
});

// Forward keyboard events from presenter to main window
ipcMain.on('presenter-keyboard-event', (event, keyData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('keyboard-from-presenter', keyData);
  }
});

// Capture presenter window frame
ipcMain.handle('capture-presenter-frame', async (event) => {
  try {
    if (presenterWindow && !presenterWindow.isDestroyed()) {
      const image = await presenterWindow.webContents.capturePage();
      return {
        success: true,
        dataURL: image.toDataURL(),
        size: image.getSize()
      };
    }
    return { success: false, error: 'Presenter window not available' };
  } catch (error) {
    console.error('Error capturing presenter frame:', error);
    return { success: false, error: error.message };
  }
});

// Get presenter window ID for screen capture
ipcMain.handle('get-presenter-window-id', async (event) => {
  try {
    if (presenterWindow && !presenterWindow.isDestroyed()) {
      const id = presenterWindow.getMediaSourceId();
      return { success: true, id };
    }
    return { success: false, error: 'Presenter window not available' };
  } catch (error) {
    console.error('Error getting presenter window ID:', error);
    return { success: false, error: error.message };
  }
});

// Get desktop sources for screen capture (desktopCapturer)
ipcMain.handle('get-desktop-sources', async (event, options) => {
  try {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources(options);
    return sources;
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    throw error;
  }
});

// ============================================
// File System Operations for Scripts
// ============================================

// Save script to file
ipcMain.handle('save-script-file', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving script:', error);
    return { success: false, error: error.message };
  }
});

// Load script from file
ipcMain.handle('load-script-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error loading script:', error);
    return { success: false, error: error.message };
  }
});

// Read directory contents
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: true, files: [] };
    }
    const files = fs.readdirSync(dirPath);
    const scriptFiles = files
      .filter(file => file.endsWith('.teleprompter'))
      .map(file => ({
        name: file,
        path: path.join(dirPath, file),
        stats: fs.statSync(path.join(dirPath, file))
      }));
    return { success: true, files: scriptFiles };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error.message };
  }
});

// Choose folder dialog
ipcMain.handle('choose-scripts-folder', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Scripts Folder'
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    console.error('Error choosing folder:', error);
    return { success: false, error: error.message };
  }
});

// Save As dialog
ipcMain.handle('save-script-dialog', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Script',
      defaultPath: defaultName || 'Untitled Script.teleprompter',
      filters: [
        { name: 'Teleprompter Scripts', extensions: ['teleprompter'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error in save dialog:', error);
    return { success: false, error: error.message };
  }
});

// Open file dialog
ipcMain.handle('open-script-dialog', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Script',
      filters: [
        { name: 'Teleprompter Scripts', extensions: ['teleprompter'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('Error in open dialog:', error);
    return { success: false, error: error.message };
  }
});

// Import file dialog
ipcMain.handle('import-file-dialog', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Script',
      filters: [
        { name: 'Supported Formats', extensions: ['txt', 'docx', 'pdf'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('Error in import dialog:', error);
    return { success: false, error: error.message };
  }
});

// Delete file
ipcMain.handle('delete-script-file', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

// Get app paths
ipcMain.handle('get-app-paths', async (event) => {
  return {
    userData: app.getPath('userData'),
    documents: app.getPath('documents')
  };
});

// Import file (handles .txt, .docx, .pdf)
ipcMain.handle('import-file', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    if (ext === '.txt') {
      // Read plain text
      text = fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.docx') {
      // Extract text from Word document
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (ext === '.pdf') {
      // Extract text from PDF (lazy-load pdf-parse to avoid startup errors)
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else {
      return { success: false, error: 'Unsupported file type' };
    }

    return { success: true, text, fileName: path.basename(filePath, ext) };
  } catch (error) {
    console.error('Error importing file:', error);
    return { success: false, error: error.message };
  }
});

// Remote control server functions
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startRemoteServer() {
  if (remoteServer) {
    return { success: false, error: 'Server already running' };
  }

  const appExpress = express();
  appExpress.use(express.json());

  // Serve the mobile control interface
  appExpress.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>Promptly Remote</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #1f2937;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 20px;
            color: #e5e7eb;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            color: white;
          }
          .controls {
            display: flex;
            flex-direction: column;
            gap: 15px;
            max-width: 500px;
            margin: 0 auto;
            width: 100%;
          }
          button {
            padding: 30px;
            font-size: 20px;
            font-weight: 600;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            touch-action: manipulation;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            min-height: 70px;
          }
          button:active { transform: scale(0.97); opacity: 0.8; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }

          .play-pause {
            background: #10b981;
            color: white;
            font-size: 26px;
            padding: 40px;
            min-height: 90px;
          }
          .play-pause:active { background: #059669; }

          .speed-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .speed-controls button {
            background: #6366f1;
            color: white;
          }
          .speed-controls button:active { background: #4f46e5; }

          .chapter-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .chapter-controls button {
            background: #374151;
            color: white;
          }
          .chapter-controls button:active { background: #1f2937; }

          .chapter-select {
            width: 100%;
            padding: 20px;
            font-size: 18px;
            font-weight: 600;
            border: 2px solid #8b5cf6;
            border-radius: 12px;
            background: #374151;
            color: white;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }
          .chapter-select:focus {
            outline: none;
            border-color: #a78bfa;
          }

          .reset {
            background: #ef4444;
            color: white;
          }
          .reset:active { background: #dc2626; }

          .icon {
            font-size: 24px;
            font-style: normal;
          }

          .status {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: #9ca3af;
            padding: 10px;
            background: #374151;
            border-radius: 8px;
          }
          .status.success { color: #10b981; }
          .status.error { color: #ef4444; }

          .volume-hint {
            text-align: center;
            margin-top: 15px;
            font-size: 12px;
            color: #6b7280;
            padding: 8px;
            background: #374151;
            border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <h1>Promptly Remote</h1>

        <div id="no-presenter-message" style="display: none; text-align: center; padding: 40px 20px;">
          <p style="font-size: 18px; color: #9ca3af; margin-bottom: 20px;">Presenter window not opened</p>
          <p style="font-size: 14px; color: #6b7280;">Please open the presenter window in the app to use remote controls.</p>
        </div>

        <div class="controls" id="controls">
          <select class="chapter-select" id="chapter-select" onchange="jumpToChapter(this.value)">
            <option value="">Select a chapter...</option>
          </select>

          <button class="play-pause" onclick="sendCommand('play-pause')">
            <span class="icon">▶</span>
            <span>Play / Pause</span>
          </button>

          <div class="speed-controls">
            <button onclick="sendCommand('speed-up', currentSpeedIncrement)">
              <span class="icon">▲</span>
              <span>Speed Up</span>
            </button>
            <button onclick="sendCommand('speed-down', currentSpeedIncrement)">
              <span class="icon">▼</span>
              <span>Speed Down</span>
            </button>
          </div>

          <div class="chapter-controls">
            <button onclick="sendCommand('prev-chapter')">
              <span class="icon">◀</span>
              <span>Previous</span>
            </button>
            <button onclick="sendCommand('next-chapter')">
              <span class="icon">▶</span>
              <span>Next</span>
            </button>
          </div>

          <button class="reset" onclick="sendCommand('reset')">
            <span class="icon">↺</span>
            <span>Reset Script</span>
          </button>
        </div>
        <div class="status" id="status">Connected</div>

        <script>
          let currentSpeedIncrement = 0.1; // Default value
          let chapters = [];

          // Fetch current settings from main app
          async function fetchSettings() {
            try {
              const response = await fetch('/settings');
              const settings = await response.json();
              if (settings.speedIncrement !== undefined) {
                currentSpeedIncrement = settings.speedIncrement;
                console.log('Speed increment set to:', currentSpeedIncrement);
              }
            } catch (error) {
              console.error('Failed to fetch settings:', error);
            }
          }

          // Fetch chapter list from main app
          async function fetchChapters() {
            try {
              const response = await fetch('/chapters');
              chapters = await response.json();
              updateChapterSelect();
            } catch (error) {
              console.error('Failed to fetch chapters:', error);
            }
          }

          // Update chapter select dropdown
          function updateChapterSelect() {
            const select = document.getElementById('chapter-select');
            select.innerHTML = '<option value="">Select a chapter...</option>';
            chapters.forEach((chapter, index) => {
              const option = document.createElement('option');
              option.value = index;
              option.textContent = chapter.name;
              select.appendChild(option);
            });
          }

          // Jump to specific chapter
          function jumpToChapter(index) {
            if (index !== '') {
              sendCommand('jump-to-chapter', parseInt(index));
              // Reset select
              document.getElementById('chapter-select').value = '';
            }
          }

          // Check presenter window status
          async function checkPresenterStatus() {
            try {
              const response = await fetch('/presenter-status');
              const status = await response.json();

              const controls = document.getElementById('controls');
              const noPresenterMsg = document.getElementById('no-presenter-message');

              if (status.isOpen) {
                controls.style.display = 'flex';
                noPresenterMsg.style.display = 'none';
              } else {
                controls.style.display = 'none';
                noPresenterMsg.style.display = 'block';
              }
            } catch (error) {
              console.error('Failed to check presenter status:', error);
            }
          }

          // Fetch settings, chapters, and status on load and periodically
          fetchSettings();
          fetchChapters();
          checkPresenterStatus();
          setInterval(fetchSettings, 5000); // Update every 5 seconds
          setInterval(fetchChapters, 10000); // Update every 10 seconds
          setInterval(checkPresenterStatus, 3000); // Update every 3 seconds

          // Keep screen awake using Wake Lock API
          let wakeLock = null;
          async function requestWakeLock() {
            try {
              if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock activated');

                // Re-acquire wake lock when page becomes visible again
                wakeLock.addEventListener('release', () => {
                  console.log('Screen wake lock released');
                });
              }
            } catch (err) {
              console.error('Wake lock error:', err);
            }
          }

          // Request wake lock on load and when page becomes visible
          requestWakeLock();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              requestWakeLock();
            }
          });

          // Try multiple approaches for volume button detection

          // Approach 1: Standard keyboard events
          document.addEventListener('keydown', (e) => {
            if (e.key === 'VolumeUp' || e.keyCode === 175) {
              e.preventDefault();
              sendCommand('speed-up', currentSpeedIncrement);
            } else if (e.key === 'VolumeDown' || e.keyCode === 174) {
              e.preventDefault();
              sendCommand('speed-down', currentSpeedIncrement);
            }
          });

          // Approach 2: Media Session API (works on some devices)
          if ('mediaSession' in navigator) {
            // Create a silent audio element to enable media session
            const audio = new Audio();
            audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            audio.loop = true;

            // Set minimal metadata
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'Promptly Remote',
              artist: 'Teleprompter Control',
            });

            // Map media controls to speed
            navigator.mediaSession.setActionHandler('seekforward', () => {
              sendCommand('speed-up', currentSpeedIncrement);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
              sendCommand('speed-down', currentSpeedIncrement);
            });
            navigator.mediaSession.setActionHandler('play', () => {
              sendCommand('play-pause');
            });
            navigator.mediaSession.setActionHandler('pause', () => {
              sendCommand('play-pause');
            });

            // Start silent playback on first user interaction
            document.addEventListener('click', () => {
              audio.play().catch(() => {});
            }, { once: true });
          }

          async function sendCommand(command, value) {
            const statusEl = document.getElementById('status');
            statusEl.className = 'status';

            try {
              const payload = { command };
              if (value !== undefined) {
                payload.value = value;
              }

              const response = await fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await response.json();

              if (data.success) {
                statusEl.textContent = '✓ Command sent';
                statusEl.className = 'status success';
              } else {
                statusEl.textContent = '✗ Failed';
                statusEl.className = 'status error';
              }

              setTimeout(() => {
                statusEl.textContent = 'Connected';
                statusEl.className = 'status';
              }, 1000);
            } catch (error) {
              statusEl.textContent = '✗ Connection error';
              statusEl.className = 'status error';
            }
          }

          // Disable button briefly after press
          document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function() {
              this.disabled = true;
              setTimeout(() => this.disabled = false, 300);
            });
          });
        </script>
      </body>
      </html>
    `);
  });

  // Get current settings (like speedIncrement)
  appExpress.get('/settings', (req, res) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript('window.getRemoteSettings ? window.getRemoteSettings() : {}')
        .then(settings => {
          res.json(settings);
        })
        .catch(error => {
          console.error('Error getting settings:', error);
          res.status(500).json({ error: 'Failed to get settings' });
        });
    } else {
      res.status(500).json({ error: 'Main window not available' });
    }
  });

  // Get chapter list
  appExpress.get('/chapters', (req, res) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript('window.getRemoteChapters ? window.getRemoteChapters() : []')
        .then(chapters => {
          res.json(chapters);
        })
        .catch(error => {
          console.error('Error getting chapters:', error);
          res.status(500).json({ error: 'Failed to get chapters' });
        });
    } else {
      res.status(500).json({ error: 'Main window not available' });
    }
  });

  // Get presenter window status
  appExpress.get('/presenter-status', (req, res) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript('window.getPresenterStatus ? window.getPresenterStatus() : { isOpen: false }')
        .then(status => {
          res.json(status);
        })
        .catch(error => {
          console.error('Error getting presenter status:', error);
          res.status(500).json({ error: 'Failed to get status' });
        });
    } else {
      res.status(500).json({ error: 'Main window not available' });
    }
  });

  // Handle commands from mobile
  appExpress.post('/command', (req, res) => {
    const { command, value } = req.body;
    console.log('Remote command received:', command, value);

    // Send command to main window with optional value
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remote-command', { command, value });
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Main window not available' });
    }
  });

  try {
    remoteServer = appExpress.listen(remoteServerPort, '0.0.0.0', () => {
      const localIP = getLocalIPAddress();
      const localUrl = `http://${localIP}:${remoteServerPort}`;
      console.log(`Remote server started on ${localUrl}`);

      // Notify renderer immediately with the LAN URL; tunnel URL arrives later.
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-server-started', { localUrl, tunnelUrl: null });
      }

      // Start a Cloudflare Tunnel so phones on other networks can reach the server.
      startCloudflaredTunnel(remoteServerPort);
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to start remote server:', error);
    return { success: false, error: error.message };
  }
}

// Spawn cloudflared as a "quick tunnel" — no account or auth required.
// Reads the trycloudflare.com URL from stdout/stderr and forwards it to the
// renderer via remote-server-tunnel-ready.
function startCloudflaredTunnel(port) {
  stopCloudflaredTunnel(); // belt-and-suspenders

  const binPath = isDev
    ? path.join(__dirname, 'vendor', 'cloudflared', 'cloudflared.exe')
    : path.join(process.resourcesPath, 'cloudflared', 'cloudflared.exe');

  if (!fs.existsSync(binPath)) {
    console.warn(`[cloudflared] binary missing at ${binPath} — skipping tunnel`);
    return;
  }

  try {
    cloudflaredProcess = spawn(binPath, [
      'tunnel',
      '--url', `http://localhost:${port}`,
      '--no-autoupdate'
    ], { windowsHide: true });
  } catch (err) {
    console.error('[cloudflared] spawn failed:', err);
    cloudflaredProcess = null;
    return;
  }

  let tunnelReported = false;
  const urlRe = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
  const handleChunk = (buf) => {
    if (tunnelReported) return;
    const text = buf.toString();
    const m = text.match(urlRe);
    if (m && mainWindow && !mainWindow.isDestroyed()) {
      tunnelReported = true;
      console.log(`[cloudflared] tunnel ready: ${m[0]}`);
      mainWindow.webContents.send('remote-server-tunnel-ready', { tunnelUrl: m[0] });
    }
  };
  cloudflaredProcess.stdout.on('data', handleChunk);
  cloudflaredProcess.stderr.on('data', handleChunk); // cloudflared logs the URL via stderr
  cloudflaredProcess.on('exit', (code) => {
    console.log(`[cloudflared] exited with code ${code}`);
    cloudflaredProcess = null;
    if (!tunnelReported && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remote-server-tunnel-ready', { tunnelUrl: null });
    }
  });
  cloudflaredProcess.on('error', (err) => {
    console.error('[cloudflared] process error:', err);
  });
}

function stopCloudflaredTunnel() {
  if (!cloudflaredProcess) return;
  try {
    cloudflaredProcess.kill();
  } catch (err) {
    console.error('[cloudflared] kill failed:', err);
  }
  cloudflaredProcess = null;
}

function stopRemoteServer() {
  if (!remoteServer) {
    return { success: false, error: 'Server not running' };
  }

  stopCloudflaredTunnel();

  remoteServer.close(() => {
    console.log('Remote server stopped');
    remoteServer = null;

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remote-server-stopped');
    }
  });

  return { success: true };
}

// IPC handlers for remote control
ipcMain.handle('start-remote-server', async () => {
  return startRemoteServer();
});

ipcMain.handle('stop-remote-server', async () => {
  return stopRemoteServer();
});

// Ensure GPU is enabled for transparency (especially on Windows)
// These command line switches MUST be set before app.whenReady()
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-compositing', false);

// App lifecycle
app.whenReady().then(() => {
  loadWindowBounds(); // Load saved window positions
  createMainWindow();

  // Notify the renderer whenever the display configuration changes so the
  // monitor-picker dropdown can refresh.
  const notifyDisplaysChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('displays-changed');
    }
  };
  screen.on('display-added', notifyDisplaysChanged);
  screen.on('display-removed', notifyDisplaysChanged);
  screen.on('display-metrics-changed', notifyDisplaysChanged);

  // Auto-update via GitHub Releases (publish provider configured in package.json).
  // Skipped in dev. The repo must be public for anonymous reads; otherwise the
  // 404 is logged but the rest of the app keeps working.
  if (!isDev) {
    setupAutoUpdater();
  }
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  const forward = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('update-available', (info) => {
    forward('update-available', { version: info.version, releaseNotes: info.releaseNotes });
  });
  autoUpdater.on('download-progress', (progress) => {
    forward('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    forward('update-downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    console.error('[autoUpdater] error:', err && err.message);
  });

  // Initial check 3 seconds after launch, then every 4 hours.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => console.error('[autoUpdater] initial check failed:', err && err.message));
  }, 3000);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => console.error('[autoUpdater] periodic check failed:', err && err.message));
  }, 4 * 60 * 60 * 1000);
}

ipcMain.on('update-download', () => {
  autoUpdater.downloadUpdate().catch(err => console.error('[autoUpdater] download failed:', err && err.message));
});

ipcMain.on('update-quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

app.on('before-quit', () => {
  stopCloudflaredTunnel();
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, recreate window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Optional: Handle app updates, protocols, etc.
