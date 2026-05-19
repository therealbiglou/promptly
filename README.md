# Promptly

> A professional teleprompter application for content creators, presenters, and professionals.

![Version](https://img.shields.io/badge/version-1.0.158-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-Private-red)

---

## 📖 Overview

**Promptly** is a feature-rich desktop teleprompter application built with React and Electron. It provides a professional dual-window teleprompting experience with extensive customization options, remote control capabilities, and a modern, intuitive interface.

Perfect for:
- 🎥 Video content creators
- 🎤 Presenters and speakers
- 📺 Broadcasters and streamers
- 🎓 Educators and trainers
- 💼 Corporate communications

---

## ✨ Key Features

### 🎬 Professional Teleprompting
- **Dual-window architecture** - Separate control and presenter displays
- **Smooth variable-speed scrolling** (0.1x - 10x)
- **Customizable display settings** - Font, colors, spacing, opacity
- **Mirror options** - Horizontal and vertical flipping for hardware setups
- **Crosshair guide** - Adjustable center-line with custom colors
- **Real-time timer** - Shows elapsed time, estimated duration, and progress

### 📝 Advanced Script Management
- **Multi-chapter organization** - Break scripts into manageable sections
- **Rich text editing** - Bold, italic, underline, colors, and custom formatting
- **Chapter-specific speeds** - Set different scroll speeds per chapter
- **Drag & drop reordering** - Easily reorganize chapters
- **Auto-save** - Never lose your work
- **Import support** - Load scripts from TXT, DOCX, and PDF files

### ⌨️ Fully Customizable Controls
- **Custom keyboard shortcuts** - Assign any key combination to any action
- **Multiple alternatives** - Add several shortcuts for the same function
- **Mouse wheel support** - Use scroll wheel for speed control
- **Adjustable increments** - Configure how much speed changes per keystroke

### 📱 Remote Control
- **Mobile/tablet control** - Control from any device on your network
- **QR code setup** - Easy connection in seconds
- **Touch-optimized UI** - Large, easy-to-press buttons
- **Chapter jumping** - Select chapters directly from your phone
- **Wake lock** - Keeps your phone screen on during use
- **Status monitoring** - Shows when presenter window is active

### 🔄 Automatic Updates
- **Seamless updates** - Get notified when new versions are available
- **Background downloads** - Updates download without interrupting your work
- **Auto-install on exit** - Updates install when you close the app
- **No manual reinstalls** - Never uninstall/reinstall again

---

## 🖥️ System Requirements

- **OS:** Windows 10 or later (64-bit)
- **RAM:** 4GB minimum (8GB recommended)
- **Display:** Multi-monitor setup recommended for presenter view
- **Network:** WiFi connection (for remote control feature)
- **Storage:** ~200MB for installation

---

## 🚀 Installation

1. Download `Promptly Setup 1.0.158.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch Promptly from your desktop or Start menu

**Note:** Starting with v1.0.158, this is the last manual installation you'll need. Future updates install automatically!

---

## 📚 Usage Guide

### Getting Started

#### 1. Create a Script
- Type directly in the editor, or
- Import from TXT, DOCX, or PDF files
- Organize content into chapters using the "Add Chapter" button
- Format text using the toolbar (bold, italic, underline, color)

#### 2. Customize Display Settings
Click the **Settings** tab to adjust:
- **Font size** - Make text larger or smaller
- **Font color** - Choose text color
- **Background** - Set background color and opacity
- **Line height** - Adjust vertical spacing
- **Margins** - Control horizontal spacing
- **Crosshair** - Toggle and customize the guide line

#### 3. Open Presenter Window
- Click **"Open Presenter"** button
- Position the presenter window on your teleprompter screen
- Drag to desired monitor and fullscreen if needed
- The operator panel remains for your control

#### 4. Start Presenting
- Press **Space** to start/pause scrolling
- Use **↑/↓** arrows to adjust speed
- Use **←/→** arrows to skip between chapters
- Press **Home** to reset to beginning
- Press **Escape** to close presenter window

### Setting Up Remote Control

1. Click the **Remote** tab in the main window
2. Click **"Start Remote Server"**
3. A QR code will appear
4. Open your phone's camera and scan the QR code
5. The remote control interface opens in your browser
6. Control Promptly from your phone!

**Remote Features:**
- Play/Pause button
- Speed up/down controls
- Chapter navigation
- Jump to specific chapters
- Reset script

### Customizing Keyboard Shortcuts

1. Click the **Keyboard Shortcuts** tab
2. Click **Edit** next to any action
3. Press your desired key combination
4. Click **Save** or press **Enter**
5. Add alternatives by clicking **"+ Add Alternative"**

**Tip:** Use **Shift+Escape** to cancel while editing a shortcut

---

## 🎛️ Default Keyboard Shortcuts

| Action | Default Shortcut |
|--------|------------------|
| Play/Pause | `Space` |
| Speed Up | `↑` or `+` |
| Speed Down | `↓` or `-` |
| Next Chapter | `→` or `PageDown` |
| Previous Chapter | `←` or `PageUp` |
| Jump to Start | `Home` |
| Jump to End | `End` |
| Close Presenter | `Escape` |
| Reset Script | `Home` |

*All shortcuts are customizable!*

---

## 🏗️ Architecture

### Technology Stack
- **Frontend:** React 18.2 (functional components + hooks)
- **Desktop Framework:** Electron 27.0
- **Styling:** Tailwind CSS 3.4
- **Build Tool:** Create React App 5.0 + electron-builder
- **Server:** Express.js (for remote control)
- **Updates:** electron-updater

### Project Structure
```
promptly/
├── src/
│   └── App.js              # Main React application
├── public/
│   ├── index.html          # React entry point
│   └── icon.ico            # Application icon
├── electron-main.js        # Electron main process
├── electron-preload.js     # IPC bridge (security)
├── electron-presenter.html # Presenter window (standalone)
├── package.json            # Dependencies & build config
└── README.md              # This file
```

### Multi-Window Design
- **Main Window:** Control interface built with React
- **Presenter Window:** Standalone HTML for optimal performance
- **IPC Bridge:** Secure communication via Electron preload script
- **Remote Server:** Express HTTP server for mobile control

---

## 🛠️ Development

### Prerequisites
- Node.js 16+ and npm
- Git (optional)

### Setup Development Environment

```bash
# Clone or navigate to project directory
cd teleprompter-app

# Install dependencies
npm install

# Run in development mode
npm run electron-dev

# Build for production
npm run build
npm run electron-build-win
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start React dev server only |
| `npm run electron-dev` | Run Electron in development mode |
| `npm run electron` | Run built Electron app |
| `npm run build` | Build React app for production |
| `npm run electron-build-win` | Build Windows installer |
| `npm test` | Run React tests |

### Building for Distribution

```bash
# Build Windows installer
npm run electron-build-win

# Output location
# dist/Promptly Setup 1.0.158.exe
```

The build process creates:
- ✅ NSIS installer (`.exe`)
- ✅ Unpacked application (for testing)
- ✅ Update metadata files (`.blockmap`, `latest.yml`)

---

## 📦 Publishing Updates

### Option 1: GitHub Releases (Recommended)

1. **Update version in `package.json`:**
   ```json
   "version": "1.0.159"
   ```

2. **Build the new version:**
   ```bash
   npm run electron-build-win
   ```

3. **Create GitHub Release:**
   - Go to your repository → Releases → "Create a new release"
   - Tag: `v1.0.159`
   - Upload from `dist/`:
     - `Promptly Setup 1.0.159.exe`
     - `Promptly Setup 1.0.159.exe.blockmap`
     - `latest.yml`
   - Publish release

4. **Users automatically get notified** on next app launch!

### Option 2: Custom Server

Upload the three files above to your server at the URL configured in `package.json` under `build.publish.url`.

---

## 🔧 Configuration

### Auto-Update Settings
Located in `electron-main.js`:

```javascript
autoUpdater.autoDownload = false;      // Ask before downloading
autoUpdater.autoInstallOnAppQuit = true; // Install on exit
```

Check for updates:
- 3 seconds after launch
- Every 4 hours while running

### Remote Control Server
Default port: `3001`
Configurable in `electron-main.js` line 23

### Data Storage
Scripts and settings are saved to:
```
%APPDATA%/Promptly/
├── scripts.json       # Saved scripts
└── windowBounds.json  # Window positions
```

---

## 🐛 Troubleshooting

### Presenter window not showing
- Ensure you have multiple monitors or extend display
- Check if window is hidden off-screen (close and reopen)
- Try fullscreen mode (`F11` in presenter window)

### Remote control not connecting
- Ensure both devices are on the same WiFi network
- Check firewall isn't blocking port 3001
- Try restarting the remote server

### Scrolling is choppy
- Close other resource-intensive applications
- Reduce font size or line height
- Disable background opacity

### Updates not working
- Ensure you're running the installed version (not unpacked)
- Check internet connection
- Look for update files in release location

---

## 📝 File Format Support

### Import Formats
- **.txt** - Plain text files
- **.docx** - Microsoft Word documents
- **.pdf** - PDF documents (text extraction)

### Export
- Currently scripts are stored internally
- Future versions will include export functionality

---

## 🤝 Contributing

This is a private project. For bug reports or feature requests, please contact the developer directly.

---

## 📄 License

Copyright © 2024. All rights reserved.
This software is proprietary and not licensed for distribution or modification.

---

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide React](https://lucide.dev/) - Icon library
- [electron-updater](https://www.electron.build/auto-update) - Auto-update system

---

## 📞 Support

For support, bug reports, or feature requests:
- 📧 Email: [your-email@example.com]
- 🐛 Issues: [GitHub Issues link if applicable]
- 💬 Discussions: [Community forum link if applicable]

---

## 🗺️ Roadmap

Future enhancements under consideration:
- [ ] Cloud sync for scripts across devices
- [ ] Native mobile app for remote control
- [ ] Additional export formats (SRT, VTT, etc.)
- [ ] Voice control integration
- [ ] Custom themes and color schemes
- [ ] Script templates library
- [ ] Collaborative editing
- [ ] Teleprompter hardware integration

---

**Made with ❤️ for presenters everywhere**

Version 1.0.158 | Last Updated: 2024
