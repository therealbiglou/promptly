# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a professional teleprompter desktop application built with React and Electron. It features a control interface (main window) and a separate presenter window for displaying scrolling text to talent/presenters.

## Tech Stack

- **Frontend**: React 18.2 with functional components and hooks
- **Desktop**: Electron 27.0 (multi-window architecture)
- **Styling**: Tailwind CSS 3.4 with custom configurations
- **Build**: Create React App 5.0 (react-scripts)
- **Testing**: Jest + React Testing Library

## Development Commands

### Running the Application

```bash
# Start React dev server only
npm start

# Run Electron in development mode (starts React dev server + Electron)
npm run electron-dev

# Run pre-built Electron app
npm run electron
```

### Building

```bash
# Build React app for production
npm run build

# Build Electron distributables
npm run electron-build           # All platforms
npm run electron-build-win       # Windows only
npm run electron-build-mac       # macOS only
npm run electron-build-linux     # Linux only
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run single test file
npm test -- <filename>
```

## Architecture

### Multi-Window Electron Structure

The app uses a dual-window architecture managed through Electron IPC:

1. **Main Window** (`electron-main.js` + React app in `src/`)
   - Control interface with script editor, settings, and playback controls
   - Manages all application state
   - Communicates with presenter window via IPC

2. **Presenter Window** (`electron-presenter.html`)
   - Standalone HTML file (no React)
   - Transparent, frameless window for displaying scrolling text
   - Receives content and scroll updates from main window
   - Displays timer overlay and crosshair

3. **IPC Bridge** (`electron-preload.js`)
   - Secure context bridge between main/renderer processes
   - Exposes controlled Electron APIs to React app via `window.electron`

### Key IPC Channels

- `open-presenter-window` / `close-presenter-window` - Window lifecycle
- `update-presenter-content` - Send script content, styling, settings to presenter
- `update-presenter-scroll` - Sync scroll position between windows
- `presenter-window-closed` - Notify main window when presenter closes

### React Application Structure

The entire React app is in `src/App.js` (single-file architecture):

- **State Management**: ~50 useState hooks manage all application state
- **Chapters System**: Scripts contain multiple chapters with individual content, titles, and custom speeds
- **Rich Text Editor**: ContentEditable divs with execCommand for bold/italic/underline/color formatting
- **Scroll Animation**: requestAnimationFrame-based smooth scrolling with variable speed
- **Timer System**: Tracks elapsed time and estimates total duration based on word count and WPM
- **Drag-and-Drop**: Reorder chapters within scripts
- **Resizable Panels**: Sidebar and preview width adjustable by dragging

### Important State Variables

- `scripts` - Array of script objects with chapters
- `currentScriptId` - Active script being edited/displayed
- `isPlaying` - Playback state
- `scrollSpeed` / `activeScrollSpeed` - Base speed and current effective speed (may differ per chapter)
- `fontSize`, `fontColor`, `bgColor`, `lineHeight` - Display settings
- `flipHorizontal/Vertical` - Mirror settings for operator/presenter
- `elapsedTime`, `estimatedDuration` - Timer values

### Data Structure

```javascript
script = {
  id: number,
  name: string,
  description: string,
  chapters: [
    {
      id: number,
      name: string,
      content: string,  // HTML content with rich text formatting
      showTitle: boolean,
      customSpeed: number | null  // Override global speed for this chapter
    }
  ]
}
```

## Development Notes

### Electron Main Entry Point

The main entry in `package.json` points to `electron-main.js`, but there's also a `public/electron.js` file. The active main process file is `electron-main.js` at the root.

### Dev vs Production Loading

- **Development**: Main window loads `http://localhost:3000` (React dev server)
- **Production**: Main window loads `build/index.html` (built React app)

The presenter window always loads from `electron-presenter.html` file.

### ContentEditable Rich Text

The app uses native browser ContentEditable with `document.execCommand()` for formatting. When working with the editor:

- Selection must be saved/restored when clicking toolbar buttons
- Content is stored as HTML strings in chapter.content
- Format state is tracked per chapter in `activeFormats` object
- Color picker and emoji picker are custom implementations

### Scroll Synchronization

Three scroll containers must stay in sync during playback:
1. Operator preview (`previewScrollRef`)
2. Operator fullscreen (`scrollRef`)
3. Presenter window (via IPC `update-presenter-scroll`)

All use refs and update in the same animation frame for smooth synchronization.

### Chapter Speed Overrides

Each chapter can have a `customSpeed` that overrides the global `scrollSpeed`. The `activeScrollSpeed` state reflects which speed is currently active during playback. Speed changes trigger UI updates in the presenter window timer.

### Background Opacity

The `bgOpacity` setting (0-100%) is converted to RGBA format before sending to the presenter window to enable transparency effects over video feeds.

## Common Tasks

### Adding a New Setting

1. Add useState hook for the setting value
2. Add UI control in the settings panel (search for `showSettings`)
3. Include the setting in `updatePresenterContent()` data payload
4. Update presenter window rendering in `electron-presenter.html`

### Modifying IPC Communication

1. Add/update handler in `electron-main.js` (ipcMain.on)
2. Expose method in `electron-preload.js` (contextBridge.exposeInMainWorld)
3. Call from React via `window.electron.*`
4. Handle in presenter window JavaScript if needed

### Testing Electron Features

- Use `npm run electron-dev` to get both DevTools windows
- Check Electron console in terminal for main process logs
- Check DevTools in each window for renderer process logs

## Build Configuration

Electron Builder settings in `package.json`:
- App ID: `com.teleprompter.app`
- Product name: `Teleprompter Pro`
- Targets: NSIS (Windows), DMG (macOS), AppImage (Linux)
- Icons should be placed in `public/` directory
