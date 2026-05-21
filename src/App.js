import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Settings, FileText, Download, Upload, Edit2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown, List, ListOrdered, Plus, GripVertical, Trash2, Maximize2, Eye, EyeOff, Monitor, Bold, Italic, Underline, Palette, AlertCircle, Timer, Zap, Scissors, Clock, Type, Droplet, Move, BookOpen, Target, Check, X, FileDown, ArrowUpDown, Crosshair, Gauge } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

export default function App() {
  // Default tutorial script for first-time users
  const getTutorialScript = () => ({
    id: 1,
    name: 'Welcome to Promptly',
    description: 'Learn how to use all the features',
    chapters: [
      {
        id: 1,
        name: 'Welcome',
        content: '<p><strong>Welcome to Promptly!</strong></p><p>This tutorial will guide you through all the features. Each chapter covers a different aspect of the app.</p><p>Press <strong>Space</strong> to start scrolling, or use the <strong>▶ Play</strong> button below.</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 2,
        name: 'Basic Controls',
        content: '<p><strong>Playback Controls:</strong></p><p>• <strong>Space</strong> - Play/Pause</p><p>• <strong>↑↓ Arrows</strong> - Adjust scroll speed</p><p>• <strong>←→ Arrows</strong> - Jump between chapters</p><p>• <strong>Home</strong> - Restart from beginning</p><p>• <strong>Esc</strong> - Exit fullscreen</p><p><br></p><p>You can also use the control buttons in the interface.</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 3,
        name: 'Writing & Editing',
        content: '<p><strong>Rich Text Formatting:</strong></p><p>Select any text and use the toolbar to add <strong>bold</strong>, <em>italic</em>, <u>underline</u>, or <span style="color: #ef4444;">colored text</span>.</p><p><br></p><p><strong>Chapters:</strong></p><p>• Click <strong>+ Add Chapter</strong> to create new sections</p><p>• Drag chapters to reorder them</p><p>• Split chapters by placing cursor and clicking scissors icon</p><p>• Toggle chapter titles on/off</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 4,
        name: 'Presenter Window',
        content: '<p><strong>Separate Presenter Display:</strong></p><p>Click <strong>"Open Presenter Window"</strong> to show your script on a second monitor or teleprompter.</p><p><br></p><p><strong>Presenter Features:</strong></p><p>• Fullscreen mode (F11)</p><p>• Draggable and resizable</p><p>• Timer display</p><p>• Crosshair guide</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 5,
        name: 'Saving & Loading',
        content: '<p><strong>File Management:</strong></p><p>• <strong>Save</strong> (Ctrl+S) - Quick save to current file</p><p>• <strong>Save As</strong> - Save to a new location</p><p>• <strong>Open Script</strong> - Load a .teleprompter file</p><p>• <strong>Auto-save</strong> - Saves automatically every 30 seconds</p><p><br></p><p>Scripts are saved as <strong>.teleprompter</strong> files you can share between computers.</p><p><br></p><p>The app remembers which scripts you had open and reopens them when you restart.</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 6,
        name: 'Settings & Customization',
        content: '<p><strong>Display Settings:</strong></p><p>• Font size, color, and background</p><p>• Line height and margins</p><p>• Crosshair color and position</p><p>• Lead-in/lead-out margins</p><p>• Chapter spacing</p><p><br></p><p><strong>Speed Settings:</strong></p><p>• Reading speed (WPM) for time estimates</p><p>• Scroll speed adjustments</p><p>• Per-chapter custom speeds</p>',
        showTitle: true,
        customSpeed: null
      },
      {
        id: 7,
        name: 'Tips & Tricks',
        content: '<p><strong>Pro Tips:</strong></p><p>• Use the timer to track your performance</p><p>• Set custom speeds for different chapters</p><p>• Use lead-in margin to start with text centered</p><p><br></p><p><strong>Ready to Start?</strong></p><p>Close this tutorial and click <strong>"New Script"</strong> to create your first script, or <strong>"Open Script"</strong> to load an existing one.</p><p><br></p><p>Happy teleprompter!</p>',
        showTitle: true,
        customSpeed: null
      }
    ]
  });

  const [scripts, setScripts] = useState([getTutorialScript()]);
  const [currentScriptId, setCurrentScriptId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualScrollMode, setManualScrollMode] = useState(false); // Jog mode - allows manual scrolling with mouse wheel
  const [spotlightMode, setSpotlightMode] = useState(false); // Mouse spotlight mode - shows cursor position on presenter
  const [presenterRequiredToast, setPresenterRequiredToast] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.5);
  const [activeScrollSpeed, setActiveScrollSpeed] = useState(1.5); // Current speed being used (may differ from scrollSpeed if chapter has custom speed)
  const [scrollPosition, setScrollPosition] = useState(0);
  const [speedIncrement, setSpeedIncrement] = useState(0.1); // How much to change speed with keyboard shortcuts
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  const [remoteServerActive, setRemoteServerActive] = useState(false);
  const [remoteServerUrl, setRemoteServerUrl] = useState('');
  const [remoteTunnelUrl, setRemoteTunnelUrl] = useState(''); // Cloudflare cross-network URL
  const [tunnelActive, setTunnelActive] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrSource, setQrSource] = useState('auto'); // 'auto' = prefer tunnel; 'local' = LAN; 'internet' = tunnel-only
  const [logiPluginStatus, setLogiPluginStatus] = useState({ status: 'pending' });
  const [updateInfo, setUpdateInfo] = useState(null); // { version, releaseNotes } when an update is available
  const [updateProgress, setUpdateProgress] = useState(null); // 0-100 while downloading
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenMonitor, setFullscreenMonitor] = useState(0);
  const [presenterWindow, setPresenterWindow] = useState(null);
  const [presenterWindowDimensions, setPresenterWindowDimensions] = useState({ width: 1920, height: 1080 }); // Track actual presenter window size for 1:1 operator preview
  const [presenterFullscreen, setPresenterFullscreen] = useState(false); // Track if presenter window is in fullscreen mode
  const [displays, setDisplays] = useState([]);
  const [presenterDisplayId, setPresenterDisplayId] = useState(null); // null = "auto / current monitor"
  const [showDisplayDropdown, setShowDisplayDropdown] = useState(false);
  const [operatorPanelWidth, setOperatorPanelWidth] = useState(800); // Track operator panel width for responsive scaling
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [showChapterList, setShowChapterList] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [draggedChapter, setDraggedChapter] = useState(null);
  const [dragOverChapter, setDragOverChapter] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [canDrag, setCanDrag] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(60); // 60% for editor panel (operator preview gets remaining 40%)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [textColor, setTextColor] = useState('#ffffff');
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showSpeedPicker, setShowSpeedPicker] = useState(null);
  const [tempChapterSpeed, setTempChapterSpeed] = useState(null); // Temporary speed value while adjusting
  const [savedSelection, setSavedSelection] = useState(null);
  const [activeFormats, setActiveFormats] = useState({});
  
  // Predefined color palette
  const colorPalette = [
    '#ffffff', '#000000', '#ef4444', '#f97316',
    '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'
  ];
  
  // Common emojis - focused on video/script production
  const commonEmojis = [
    // Camera & Production
    '📷', '🎥', '🎬', '🎦', '📹', '📸', '🎞️', '📺',
    // Actions & Directions
    '👈', '👉', '👆', '👇', '☝️', '👋', '🤝', '👏',
    '🚶', '🏃', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️',
    // Emotions & Reactions
    '😊', '😢', '😡', '😮', '😕', '🤔', '😌', '😎',
    // Communication
    '💬', '🗣️', '📢', '📣', '🔔', '📞', '✉️', '💌',
    // Symbols & Markers
    '❓', '❔', '❗', '❕', '💡', '⭐', '✨', '🔥',
    '✅', '❌', '⚠️', '🚫', '⏸️', '▶️', '⏯️', '⏹️',
    '⏺️', '⏏️', '⏩', '⏪', '⏭️', '⏮️', '🔄', '🔁',
    // Time & Schedule
    '⏰', '⏱️', '⏲️', '🕐', '🕑', '🕒', '📅', '📆',
    // Objects
    '🎤', '🎧', '🔊', '📻', '💼', '📋', '📝', '✏️',
    '📍', '🔖', '🏁', '🎯', '🎪', '🎭', '🎨', '🖼️',
    // Presenter cues — eyes & faces
    '👀', '👁️', '😄', '😁', '😀', '😍', '😘', '😉',
    '🙂', '🥰', '🤩', '🥺', '😱', '🤯', '🤐', '🤫',
    '🤣', '😂',
    // Hands & gestures
    '✋', '🙌', '🙏', '🤲', '💪', '✊', '👊', '✌️',
    // Status & cues
    '🚀', '💯', '🎉', '🌟', '📌',
    // Directional supplements
    '↩️', '↪️', '🔼', '🔽'
  ];
  
  // Settings
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#000000');
  const [lineHeight, setLineHeight] = useState(1.5);
  const [horizontalMargin, setHorizontalMargin] = useState(20);
  const [crosshairColor, setCrosshairColor] = useState('#ff0000');
  const [crosshairLength, setCrosshairLength] = useState(32);
  const [crosshairThickness, setCrosshairThickness] = useState(1);
  const [countdownDuration, setCountdownDuration] = useState(0); // seconds; 0 = disabled
  const [countdownValue, setCountdownValue] = useState(null); // current count, or null when not active
  // Timer display mode in the presenter: 'full' (timer + progress + speed), 'speed' (just speed), 'hidden'
  const [timerDisplayMode, setTimerDisplayMode] = useState('full');
  // Which corner the timer/speed overlay sits in
  const [timerCorner, setTimerCorner] = useState('top-left');
  const [leadInMargin, setLeadInMargin] = useState(40);
  // leadOutMargin removed - bottom padding is always half height to allow last line to reach crosshair
  const [chapterSpacing, setChapterSpacing] = useState(2);
  // Progress tracking (position-based, not time-based)
  const [scrollProgress, setScrollProgress] = useState(0); // 0-100 percentage
  // Legacy timer variables (kept for browser mode compatibility, not used in Electron mode)
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(150); // Average reading speed
  const timerIntervalRef = useRef(null);
  const timerStartTimestampRef = useRef(null); // When the timer conceptually started (adjusted for skips)
  const pausedElapsedRef = useRef(0); // Track elapsed time when paused

  // File persistence states
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scriptFilePaths, setScriptFilePaths] = useState({}); // Map of script ID to file path

  const autoSaveTimerRef = useRef(null);
  const settingsLoadedRef = useRef(false); // Track if settings have been loaded

  // Default keyboard shortcuts
  const defaultShortcuts = {
    playPause: [{ key: ' ', label: 'Space', ctrl: false, shift: false, alt: false }],
    speedUp: [{ key: 'ArrowUp', label: '↑', ctrl: false, shift: false, alt: false }],
    speedDown: [{ key: 'ArrowDown', label: '↓', ctrl: false, shift: false, alt: false }],
    nextChapter: [{ key: 'ArrowRight', label: '→', ctrl: false, shift: false, alt: false }],
    prevChapter: [{ key: 'ArrowLeft', label: '←', ctrl: false, shift: false, alt: false }],
    resetScript: [{ key: 'Home', label: 'Home', ctrl: false, shift: false, alt: false }],
    manualScroll: [{ key: 'j', label: 'J', ctrl: false, shift: false, alt: false }],
    spotlight: [{ key: 's', label: 'S', ctrl: false, shift: false, alt: false }],
  };

  // Custom keyboard shortcuts state
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(defaultShortcuts);
  const [editingShortcut, setEditingShortcut] = useState(null); // { action: 'playPause', index: 0 }
  const [capturedKeys, setCapturedKeys] = useState(null);

  const scrollRef = useRef(null);
  const previewScrollRef = useRef(null); // For operator preview scroll sync
  const operatorPanelRef = useRef(null); // For measuring operator panel width
  const presenterRequiredToastTimeoutRef = useRef(null);
  const operatorSpotlightCircleRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const countdownPauseTimeoutRef = useRef(null);
  const countdownActiveRef = useRef(false); // refs are read live, immune to closure staleness in keyboard handler
  const lastCountdownDurationRef = useRef(3); // remembers the last non-zero countdown value for the toolbar toggle
  const countdownDurationRef = useRef(0); // mirrors countdownDuration state so togglePlayPause sees latest value regardless of closure age
  const isPlayingRef = useRef(false);
  const hasReachedEndRef = useRef(false);
  const presenterWindowRef = useRef(null);
  const manualScrollModeRef = useRef(false);
  const scrollSpeedRef = useRef(1.5);
  const activeScrollSpeedRef = useRef(1.5);
  const presenterWindowScrollRef = useRef(null);
  const previewVideoRef = useRef(null); // For video stream of presenter window
  const previewStreamRef = useRef(null); // Store the MediaStream for cleanup
  const previewCanvasRef = useRef(null); // Canvas for drawing frames
  const captureFrameRef = useRef(null); // RAF handle for frame capture
  const animationRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const scrollPositionRef = useRef(0);
  const lastStateUpdateRef = useRef(0); // For throttling setScrollPosition
  const lastIPCUpdateRef = useRef(0); // For throttling IPC calls
  const targetSpeedRef = useRef(1.5); // Locked-in target speed for smooth transitions
  const lastSpeedChangeChapterRef = useRef(-1); // Track which chapter we last changed speed for

  const currentScript = scripts.find(s => s.id === currentScriptId);

  // Calculate word count for current script
  const calculateWordCount = useMemo(() => {
    if (!currentScript) return 0;
    
    let totalWords = 0;
    currentScript.chapters.forEach(chapter => {
      // Strip HTML tags and count words
      const text = chapter.content.replace(/<[^>]*>/g, ' ').trim();
      const words = text.split(/\s+/).filter(word => word.length > 0);
      totalWords += words.length;
    });
    
    return totalWords;
  }, [currentScript]);

  // Format time helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcut helper functions
  const formatShortcut = (shortcut) => {
    if (!shortcut) return '';
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.label) {
      parts.push(shortcut.label);
    } else if (shortcut.key) {
      parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key);
    }
    return parts.join('+');
  };

  const matchesShortcut = (event, shortcut) => {
    if (!shortcut) return false;
    return (
      event.key === shortcut.key &&
      event.ctrlKey === shortcut.ctrl &&
      event.shiftKey === shortcut.shift &&
      event.altKey === shortcut.alt
    );
  };

  const matchesAnyShortcut = (event, shortcuts) => {
    if (!shortcuts || shortcuts.length === 0) return false;
    return shortcuts.some(shortcut => matchesShortcut(event, shortcut));
  };

  const addShortcutAlternative = (action) => {
    setEditingShortcut({ action, index: keyboardShortcuts[action].length });
    setCapturedKeys(null);
  };

  const removeShortcut = (action, index) => {
    setKeyboardShortcuts(prev => ({
      ...prev,
      [action]: prev[action].filter((_, i) => i !== index)
    }));
  };

  const saveShortcut = (action, index, shortcutData) => {
    setKeyboardShortcuts(prev => {
      const newShortcuts = { ...prev };
      if (index >= newShortcuts[action].length) {
        // Adding new
        newShortcuts[action] = [...newShortcuts[action], shortcutData];
      } else {
        // Replacing existing
        newShortcuts[action] = newShortcuts[action].map((s, i) => i === index ? shortcutData : s);
      }
      return newShortcuts;
    });
    setEditingShortcut(null);
    setCapturedKeys(null);
  };

  const cancelEditingShortcut = () => {
    setEditingShortcut(null);
    setCapturedKeys(null);
  };

  // Rich text formatting functions
  const saveSelection = (chapterId) => {
    const contentDiv = document.getElementById(`chapter-content-${chapterId}`);
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && contentDiv && contentDiv.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      setSavedSelection({
        chapterId: chapterId,
        range: range.cloneRange()
      });
      return true;
    }
    return false;
  };

  // Check what formats are active in the current selection
  const checkActiveFormats = (chapterId) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return {};
    
    const formats = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList')
    };
    
    setActiveFormats(prev => ({
      ...prev,
      [chapterId]: formats
    }));
    
    return formats;
  };

  const restoreSelection = (chapterId) => {
    if (!savedSelection || savedSelection.chapterId !== chapterId) return false;
    
    try {
      const selection = window.getSelection();
      selection.removeAllRanges();
      
      // Clone the range again to avoid mutation issues
      const newRange = savedSelection.range.cloneRange();
      selection.addRange(newRange);
      return true;
    } catch (e) {
      return false;
    }
  };

  const applyFormatting = (chapterId, format, value) => {
    const contentDiv = document.getElementById(`chapter-content-${chapterId}`);
    if (!contentDiv) return;

    // Keep editor focused - selection will stay visible
    contentDiv.focus();
    
    // Apply the formatting directly to current selection
    switch (format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'underline':
        document.execCommand('underline', false, null);
        break;
      case 'color':
        document.execCommand('foreColor', false, value);
        break;
      case 'emoji':
        document.execCommand('insertHTML', false, value);
        break;
      case 'unorderedList':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'orderedList':
        document.execCommand('insertOrderedList', false, null);
        break;
    }
    
    // Update button states
    setTimeout(() => {
      checkActiveFormats(chapterId);
    }, 0);
    
    // Update chapter content
    setTimeout(() => {
      updateChapter(chapterId, 'content', contentDiv.innerHTML);
    }, 10);
  };
  
  const insertEmoji = (chapterId, emoji) => {
    applyFormatting(chapterId, 'emoji', emoji);
    setShowEmojiPicker(null);
  };
  
  const applyColor = (chapterId, color) => {
    applyFormatting(chapterId, 'color', color);
    setShowColorPicker(null); // Auto-hide after selecting color
  };

  const addChapter = () => {
    if (!currentScript) {
      return;
    }
    
    const newChapterId = Math.max(...currentScript.chapters.map(c => c.id), 0) + 1;
    const newChapter = {
      id: newChapterId,
      name: `Chapter ${currentScript.chapters.length + 1}`,
      content: '<p>Enter chapter content here...</p>',
      showTitle: true,
      customSpeed: null
    };
    
    setScripts(prev => prev.map(s => 
      s.id === currentScriptId 
        ? { ...s, chapters: [...s.chapters, newChapter] }
        : s
    ));
  };

  const splitChapterAtCursor = (chapterId) => {
    if (!currentScript) return;

    const contentDiv = document.getElementById(`chapter-content-${chapterId}`);
    if (!contentDiv) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Get the current range
    const range = selection.getRangeAt(0);

    // Check if selection is within the content div
    if (!contentDiv.contains(range.commonAncestorContainer)) return;

    // Create a range that spans from cursor to the end of the content
    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(contentDiv);
    afterRange.setStart(range.endContainer, range.endOffset);

    // Extract the content after the cursor
    const afterFragment = afterRange.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(afterFragment);
    const afterContent = tempDiv.innerHTML.trim() || '<p><br></p>';

    // Create a range for the content before cursor
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(contentDiv);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    // Extract the content before the cursor
    const beforeFragment = beforeRange.cloneContents();
    const tempBeforeDiv = document.createElement('div');
    tempBeforeDiv.appendChild(beforeFragment);
    const beforeContent = tempBeforeDiv.innerHTML.trim() || '<p><br></p>';

    // Clear any pending content to prevent onBlur from overwriting our split
    contentDiv.removeAttribute('data-pending-content');

    // Find the index of the current chapter
    const currentChapterIndex = currentScript.chapters.findIndex(c => c.id === chapterId);
    const currentChapter = currentScript.chapters[currentChapterIndex];

    // Create new chapter with content after cursor
    const newChapterId = Math.max(...currentScript.chapters.map(c => c.id), 0) + 1;
    const newChapter = {
      id: newChapterId,
      name: `${currentChapter.name} (cont.)`,
      content: afterContent,
      showTitle: true,
      customSpeed: currentChapter.customSpeed // Inherit custom speed from parent chapter
    };

    // Update both the current chapter and insert the new chapter in a single state update
    setScripts(prev => prev.map(s => {
      if (s.id !== currentScriptId) return s;

      const chapters = [...s.chapters];
      // Update the current chapter with before content
      chapters[currentChapterIndex] = {
        ...chapters[currentChapterIndex],
        content: beforeContent
      };
      // Insert new chapter after current one
      chapters.splice(currentChapterIndex + 1, 0, newChapter);

      return { ...s, chapters };
    }));

    // Close any open pickers
    setShowColorPicker(null);
    setShowEmojiPicker(null);
  };

  const updateChapter = (chapterId, field, value) => {
    // Removed previewScrollRef - operator view no longer scrolls independently
    setScripts(prev => prev.map(s =>
      s.id === currentScriptId
        ? {
            ...s,
            chapters: s.chapters.map(c =>
              c.id === chapterId ? { ...c, [field]: value } : c
            )
          }
        : s
    ));
  };

  // Handle paste events to strip unwanted formatting (Word, Google Docs, etc.)
  const handlePaste = (e, chapterId) => {
    e.preventDefault();

    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');

    // Get HTML if available (to preserve basic formatting like bold/italic)
    const html = e.clipboardData.getData('text/html');

    if (html) {
      // Create a temporary div to parse and clean the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Remove unwanted elements (scripts, styles, etc.)
      const unwantedElements = tempDiv.querySelectorAll('script, style, meta, link');
      unwantedElements.forEach(el => el.remove());

      // Clean all elements recursively
      const cleanElement = (element) => {
        // Remove all attributes except for style on spans (for color)
        const allowedTags = ['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'P', 'DIV', 'BR'];

        Array.from(element.children).forEach(child => {
          if (!allowedTags.includes(child.tagName)) {
            // Replace non-allowed tags with their content
            const textNode = document.createTextNode(child.textContent);
            child.replaceWith(textNode);
          } else {
            // Clean attributes
            const attrs = Array.from(child.attributes);
            attrs.forEach(attr => {
              if (attr.name === 'style' && child.tagName === 'SPAN') {
                // Only keep color style
                const colorMatch = attr.value.match(/color:\s*([^;]+)/i);
                if (colorMatch) {
                  child.setAttribute('style', `color: ${colorMatch[1]}`);
                } else {
                  child.removeAttribute('style');
                }
              } else {
                child.removeAttribute(attr.name);
              }
            });

            // Remove background colors and other unwanted styles
            if (child.style) {
              const color = child.style.color;
              child.removeAttribute('style');
              if (color && child.tagName === 'SPAN') {
                child.style.color = color;
              } else if (child.tagName === 'SPAN' && !color) {
                // Remove empty spans
                const parent = child.parentNode;
                while (child.firstChild) {
                  parent.insertBefore(child.firstChild, child);
                }
                parent.removeChild(child);
              }
            }

            // Recursively clean children
            cleanElement(child);
          }
        });
      };

      cleanElement(tempDiv);

      // Get cleaned HTML
      let cleanedHTML = tempDiv.innerHTML;

      // Remove any remaining inline styles except color
      cleanedHTML = cleanedHTML.replace(/style="([^"]*)"/g, (match, styles) => {
        const colorMatch = styles.match(/color:\s*([^;]+)/i);
        return colorMatch ? `style="color: ${colorMatch[1]}"` : '';
      });

      // Insert the cleaned HTML at cursor position
      document.execCommand('insertHTML', false, cleanedHTML);
    } else {
      // No HTML available, just insert plain text
      document.execCommand('insertText', false, text);
    }

    // Mark content as pending update
    const contentDiv = document.getElementById(`chapter-content-${chapterId}`);
    if (contentDiv) {
      contentDiv.setAttribute('data-pending-content', contentDiv.innerHTML);
    }
  };

  const toggleChapterTitle = (chapterId) => {
    if (!currentScript) return;
    updateChapter(chapterId, 'showTitle', !currentScript.chapters.find(c => c.id === chapterId).showTitle);
  };

  const deleteChapter = (chapterId) => {
    if (!currentScript) {
      return;
    }

    if (currentScript.chapters.length === 1) {
      alert('Cannot delete the last chapter');
      return;
    }

    const chapterToDelete = currentScript.chapters.find(c => c.id === chapterId);
    if (!chapterToDelete) {
      return;
    }

    setConfirmDialog({
      message: `Are you sure you want to delete "${chapterToDelete.name}"?`,
      onConfirm: () => {
        const updatedChapters = currentScript.chapters.filter(c => c.id !== chapterId);

        setScripts(prevScripts => prevScripts.map(s =>
          s.id === currentScriptId
            ? { ...s, chapters: updatedChapters }
            : s
        ));
        setConfirmDialog(null);
      },
      onCancel: () => {
        setConfirmDialog(null);
      }
    });
  };

  const deleteScript = async (scriptId) => {
    const scriptToDelete = scripts.find(s => s.id === scriptId);
    if (!scriptToDelete) {
      return;
    }

    const filePath = scriptFilePaths[scriptId];
    const fileWarning = filePath ? '\n\nThis will permanently delete the file from your disk!' : '';

    setConfirmDialog({
      message: `Are you sure you want to permanently delete "${scriptToDelete.name}"?${fileWarning}`,
      onConfirm: async () => {
        // Delete the physical file if it exists
        if (filePath && window.electron) {
          try {
            const result = await window.electron.deleteScriptFile(filePath);
            if (!result.success) {
              console.error('Failed to delete file:', result.error);
            }
          } catch (error) {
            console.error('Error deleting file:', error);
          }
        }

        const remainingScripts = scripts.filter(s => s.id !== scriptId);

        // If deleting the last script, create a new blank one
        if (remainingScripts.length === 0) {
          const newId = 1;
          const newScript = {
            id: newId,
            name: 'New Script',
            description: '',
            chapters: [
              { id: 1, name: 'Chapter 1', content: '<p>Start writing your script here...</p>', showTitle: true, customSpeed: null }
            ]
          };
          setScripts([newScript]);
          setCurrentScriptId(newId);
        } else {
          setScripts(remainingScripts);
          if (currentScriptId === scriptId) {
            setCurrentScriptId(remainingScripts[0].id);
          }
        }

        // Remove file path association
        setScriptFilePaths(prev => {
          const newPaths = { ...prev };
          delete newPaths[scriptId];
          return newPaths;
        });

        setConfirmDialog(null);
      },
      onCancel: () => {
        setConfirmDialog(null);
      }
    });
  };

  const addNewScript = () => {
    const newId = Math.max(...scripts.map(s => s.id)) + 1;
    const newScript = {
      id: newId,
      name: `Script ${newId}`,
      description: 'New script description',
      chapters: [
        { id: 1, name: 'Chapter 1', content: '<p>Enter your script content here...</p>', showTitle: true }
      ]
    };
    setScripts(prev => [...prev, newScript]);
    setCurrentScriptId(newId);
  };

  const updateScript = (id, field, value) => {
    setScripts(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const exportScript = () => {
    // Convert HTML to plain text for export
    const content = currentScript.chapters.map(ch => {
      const temp = document.createElement('div');
      temp.innerHTML = ch.content;
      const plainText = temp.textContent || temp.innerText;
      return (ch.showTitle ? `${ch.name}\n\n` : '') + plainText;
    }).join('\n\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentScript.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export script as PDF
  const exportAsPDF = (script) => {
    const targetScript = script || currentScript;
    if (!targetScript) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Add title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(targetScript.name, margin, yPosition);
    yPosition += 10;

    // Add description if exists
    if (targetScript.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      const descLines = doc.splitTextToSize(targetScript.description, maxWidth);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 5 + 5;
    }

    // Add separator line
    doc.setDrawColor(200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Process each chapter
    targetScript.chapters.forEach((chapter, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      // Add chapter title if showTitle is enabled
      if (chapter.showTitle) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(chapter.name, margin, yPosition);
        yPosition += 8;
      }

      // Convert HTML content to plain text
      const temp = document.createElement('div');
      temp.innerHTML = chapter.content;
      const plainText = temp.textContent || temp.innerText || '';

      // Add chapter content
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(plainText.trim(), maxWidth);

      lines.forEach(line => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });

      // Add spacing between chapters
      yPosition += 10;
    });

    // Save the PDF
    doc.save(`${targetScript.name}.pdf`);
  };

  // Export script as a portable, standalone HTML applet
  const exportAsApplet = (script) => {
    const targetScript = script || currentScript;
    if (!targetScript) return;

    // Escape HTML special characters for embedding in JavaScript string
    const escapeForJS = (str) => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e');
    };

    // Build chapters data for embedding
    const chaptersData = targetScript.chapters.map(ch => ({
      id: ch.id,
      name: escapeForJS(ch.name),
      content: escapeForJS(ch.content),
      showTitle: ch.showTitle,
      customSpeed: ch.customSpeed
    }));

    // Calculate horizontal margin in pixels for 1024 width
    const hMarginPx = Math.round((horizontalMargin / 100) * 1024);

    const appletHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1024, height=600, initial-scale=1.0, user-scalable=no">
  <title>${escapeForJS(targetScript.name)} - Teleprompter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html {
      width: 100%;
      height: 100%;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    body {
      width: 1024px;
      height: 600px;
      overflow: hidden;
      font-family: Arial, sans-serif;
      background: #000;
      color: #fff;
      position: relative;
    }
    #app {
      width: 1024px;
      height: 600px;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    #scroll-container {
      flex: 1;
      overflow-y: scroll;
      padding: 300px ${hMarginPx}px 300px ${hMarginPx}px;
      scroll-behavior: auto;
    }
    #scroll-container::-webkit-scrollbar { display: none; }
    #scroll-container { -ms-overflow-style: none; scrollbar-width: none; }
    .chapter { margin-bottom: 3em; }
    .chapter-title {
      font-size: 1.5em;
      font-weight: bold;
      margin-bottom: 0.5em;
      color: #fff;
    }
    .chapter-content {
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      color: ${fontColor};
    }
    #crosshair {
      position: absolute;
      top: 300px;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 100;
    }
    #crosshair-h {
      position: absolute;
      width: 32px;
      height: 2px;
      background: #00ffff;
      left: 50%;
      top: 50%;
      transform: translateX(-50%);
    }
    #crosshair-v {
      position: absolute;
      width: 2px;
      height: 32px;
      background: #00ffff;
      left: 50%;
      top: 50%;
      transform: translateY(-50%);
    }
    #bottom-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.9);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #333;
      z-index: 200;
    }
    #controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #controls button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: background 0.2s;
    }
    #controls button:hover { background: #2563eb; }
    #controls button.active { background: #22c55e; }
    .status-group {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #9ca3af;
    }
    .status-value {
      font-family: monospace;
      font-size: 13px;
      color: #e5e7eb;
      min-width: 45px;
    }
    #shortcuts {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
      color: #6b7280;
    }
    #shortcuts span { display: flex; align-items: center; gap: 4px; }
    #shortcuts kbd {
      background: #374151;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 10px;
      color: #d1d5db;
    }
  </style>
</head>
<body>
  <div id="app">
    <div id="scroll-container"></div>
    <div id="crosshair">
      <div id="crosshair-h"></div>
      <div id="crosshair-v"></div>
    </div>
    <div id="bottom-bar">
      <div id="controls">
        <button id="play-btn">&#9658; Play</button>
        <button id="reset-btn">&#8634; Reset</button>
      </div>
      <div class="status-group">
        <div class="status-item">
          <span>Speed</span>
          <span class="status-value" id="speed-display">${scrollSpeed.toFixed(1)}x</span>
        </div>
        <div class="status-item">
          <span>Font</span>
          <span class="status-value" id="font-display">${fontSize}px</span>
        </div>
      </div>
      <div id="shortcuts">
        <span><kbd>Space</kbd> Play</span>
        <span><kbd>↑↓</kbd> Speed</span>
        <span><kbd>+−</kbd> Font</span>
        <span><kbd>←→</kbd> Chapter</span>
        <span><kbd>Home</kbd> Reset</span>
        <span><kbd>F11</kbd> Fullscreen</span>
      </div>
    </div>
  </div>
  <script>
    // Embedded script data
    const scriptData = {
      name: "${escapeForJS(targetScript.name)}",
      chapters: [${chaptersData.map(ch => `{
        id: ${ch.id},
        name: "${ch.name}",
        content: "${ch.content}",
        showTitle: ${ch.showTitle},
        customSpeed: ${ch.customSpeed === null ? 'null' : ch.customSpeed}
      }`).join(',')}]
    };

    // Settings from main app
    const lineHeight = ${lineHeight};

    // State
    let isPlaying = false;
    let scrollSpeed = ${scrollSpeed};
    let currentFontSize = ${fontSize};
    let animationId = null;
    let lastTime = 0;
    let scrollPosition = 0; // Track precise position like main app

    // DOM elements
    const scrollContainer = document.getElementById('scroll-container');
    const playBtn = document.getElementById('play-btn');
    const resetBtn = document.getElementById('reset-btn');
    const speedDisplay = document.getElementById('speed-display');
    const fontDisplay = document.getElementById('font-display');

    // Render chapters
    function renderChapters() {
      let html = '';
      scriptData.chapters.forEach((ch, i) => {
        html += '<div class="chapter" id="chapter-' + i + '">';
        if (ch.showTitle) {
          html += '<div class="chapter-title">' + ch.name + '</div>';
        }
        html += '<div class="chapter-content">' + ch.content + '</div>';
        html += '</div>';
      });
      scrollContainer.innerHTML = html;
    }

    // Update font size in all chapter content
    function updateFontSize() {
      document.querySelectorAll('.chapter-content').forEach(el => {
        el.style.fontSize = currentFontSize + 'px';
      });
      fontDisplay.textContent = currentFontSize + 'px';
    }

    // Animation loop - matches main app exactly: scrollSpeed * delta / 16.67
    function animate() {
      if (!isPlaying) return;

      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      // Match main app scroll calculation exactly: scrollSpeed * delta / 16.67
      // This gives pixels per frame, where 16.67ms = 60fps
      // At speed 1.5, this is 1.5 pixels per frame at 60fps = 90 pixels/second
      scrollPosition += (scrollSpeed * delta / 16.67);

      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;

      // Check if reached end
      if (scrollPosition >= maxScroll) {
        scrollPosition = maxScroll;
        scrollContainer.scrollTop = maxScroll;
        pause();
        return;
      }

      // Apply position to scroll container
      scrollContainer.scrollTop = scrollPosition;

      animationId = requestAnimationFrame(animate);
    }

    function play() {
      if (isPlaying) return;
      isPlaying = true;
      lastTime = Date.now();
      // Sync scrollPosition with current scroll in case user manually scrolled
      scrollPosition = scrollContainer.scrollTop;
      playBtn.innerHTML = '&#10074;&#10074; Pause';
      playBtn.classList.add('active');
      animate();
    }

    function pause() {
      isPlaying = false;
      playBtn.innerHTML = '&#9658; Play';
      playBtn.classList.remove('active');
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    function togglePlayPause() {
      if (isPlaying) pause();
      else play();
    }

    function reset() {
      pause();
      scrollPosition = 0;
      scrollContainer.scrollTop = 0;
    }

    function adjustSpeed(delta) {
      scrollSpeed = Math.max(0.1, Math.min(10, scrollSpeed + delta));
      speedDisplay.textContent = scrollSpeed.toFixed(1) + 'x';
    }

    function adjustFontSize(delta) {
      currentFontSize = Math.max(12, Math.min(120, currentFontSize + delta));
      updateFontSize();
    }

    function jumpToChapter(direction) {
      const chapters = document.querySelectorAll('.chapter');
      const containerCenter = scrollContainer.scrollTop + scrollContainer.clientHeight / 2;

      let currentIndex = 0;
      chapters.forEach((ch, i) => {
        if (ch.offsetTop <= containerCenter) currentIndex = i;
      });

      const targetIndex = Math.max(0, Math.min(chapters.length - 1, currentIndex + direction));
      const targetChapter = chapters[targetIndex];

      if (targetChapter) {
        const targetScroll = Math.max(0, targetChapter.offsetTop - scrollContainer.clientHeight / 2);
        scrollPosition = targetScroll;
        scrollContainer.scrollTop = targetScroll;
      }
    }

    // Event listeners
    playBtn.addEventListener('click', togglePlayPause);
    resetBtn.addEventListener('click', reset);

    document.addEventListener('keydown', (e) => {
      // Prevent default for control keys
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', '+', '-', '='].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case ' ':
          togglePlayPause();
          break;
        case 'ArrowUp':
          adjustSpeed(0.1);
          break;
        case 'ArrowDown':
          adjustSpeed(-0.1);
          break;
        case '+':
        case '=':
          adjustFontSize(2);
          break;
        case '-':
          adjustFontSize(-2);
          break;
        case 'ArrowRight':
          jumpToChapter(1);
          break;
        case 'ArrowLeft':
          jumpToChapter(-1);
          break;
        case 'Home':
          reset();
          break;
        case 'F11':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
      }
    });

    // Initialize
    renderChapters();

    // Open in centered popup window
    (function() {
      const targetWidth = 1024;
      const targetHeight = 600;
      const left = Math.round((screen.width - targetWidth) / 2);
      const top = Math.round((screen.height - targetHeight) / 2);

      // Check if we're already in a popup of the right size
      if (window.innerWidth === targetWidth && window.innerHeight === targetHeight) {
        return; // Already correct size
      }

      // Show dialog to open in popup
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;';
      overlay.innerHTML = '<div style="text-align:center;max-width:400px;padding:30px;"><div style="font-size:20px;margin-bottom:15px;">Teleprompter</div><div style="color:#9ca3af;margin-bottom:25px;">Click below to open in the optimal 1024x600 window, centered on your screen.</div><button id="open-popup" style="background:#3b82f6;color:white;border:none;padding:14px 28px;border-radius:8px;cursor:pointer;font-size:16px;margin-bottom:15px;">Open Teleprompter</button><div style="font-size:12px;color:#6b7280;">Or press any key to use current window</div></div>';
      document.body.appendChild(overlay);

      document.getElementById('open-popup').onclick = function() {
        const popup = window.open(location.href, 'teleprompter', 'width=' + targetWidth + ',height=' + targetHeight + ',left=' + left + ',top=' + top + ',menubar=no,toolbar=no,location=no,status=no,resizable=yes');
        if (popup) {
          popup.focus();
          window.close();
        }
      };

      function dismissOverlay(e) {
        if (e.target.id !== 'open-popup') {
          overlay.remove();
          document.removeEventListener('keydown', dismissOverlay);
        }
      }
      document.addEventListener('keydown', dismissOverlay);
    })();
  </script>
</body>
</html>`;

    // Download the applet
    const blob = new Blob([appletHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetScript.name} - Teleprompter.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importScript = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      // Convert plain text to HTML paragraphs
      const htmlContent = content.split('\n\n').map(para => 
        para.trim() ? `<p>${para.replace(/\n/g, '<br>')}</p>` : ''
      ).filter(p => p).join('');
      
      const newId = Math.max(...scripts.map(s => s.id)) + 1;
      
      const newScript = {
        id: newId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        description: 'Imported script',
        chapters: [
          { id: 1, name: 'Chapter 1', content: htmlContent || '<p>Enter your script content here...</p>', showTitle: true }
        ]
      };
      setScripts(prev => [...prev, newScript]);
      setCurrentScriptId(newId);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ============================================
  // File Persistence Functions
  // ============================================

  // Convert script to .teleprompter file format
  const scriptToFileFormat = (script) => {
    return JSON.stringify({
      version: '1.0',
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        appVersion: '1.0.0'
      },
      script: {
        name: script.name,
        description: script.description || '',
        chapters: script.chapters.map(ch => ({
          id: ch.id,
          name: ch.name,
          content: ch.content,
          showTitle: ch.showTitle !== undefined ? ch.showTitle : true,
          customSpeed: ch.customSpeed || null
        }))
      }
    }, null, 2);
  };

  // Sanitize HTML content by removing background colors and highlighting
  const sanitizeContent = (html) => {
    if (!html) return '';
    return html
      .replace(/background-color:\s*[^;]+;?/gi, '')
      .replace(/background:\s*[^;]+;?/gi, '')
      .replace(/<mark[^>]*>/gi, '')
      .replace(/<\/mark>/gi, '');
  };

  // Parse .teleprompter file format
  const parseFileFormat = (content) => {
    try {
      const data = JSON.parse(content);

      // Validate format
      if (!data.version || !data.script) {
        throw new Error('Invalid file format');
      }

      return {
        name: data.script.name,
        description: data.script.description || '',
        chapters: data.script.chapters.map(ch => ({
          id: ch.id,
          name: ch.name,
          content: sanitizeContent(ch.content),
          showTitle: ch.showTitle !== undefined ? ch.showTitle : true,
          customSpeed: ch.customSpeed || null
        }))
      };
    } catch (error) {
      console.error('Error parsing script file:', error);
      throw new Error('Failed to parse script file');
    }
  };

  // Save current script to file
  const saveCurrentScript = async () => {
    if (!window.electron) return;

    try {
      setIsSaving(true);

      if (!currentFilePath) {
        // No file path - show save dialog
        return await saveCurrentScriptAs();
      }

      const fileContent = scriptToFileFormat(currentScript);
      const result = await window.electron.saveScriptFile(currentFilePath, fileContent);

      if (result.success) {
        setHasUnsavedChanges(false);
      } else {
        console.error('Error saving script:', result.error);
        alert('Failed to save script: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving script:', error);
      alert('Failed to save script');
    } finally {
      setIsSaving(false);
    }
  };

  // Save As - prompt for file location
  const saveCurrentScriptAs = async () => {
    if (!window.electron) return;

    try {
      setIsSaving(true);

      const result = await window.electron.saveScriptDialog(currentScript.name + '.teleprompter');

      if (result.canceled) {
        setIsSaving(false);
        return;
      }

      const fileContent = scriptToFileFormat(currentScript);
      const saveResult = await window.electron.saveScriptFile(result.filePath, fileContent);

      if (saveResult.success) {
        setCurrentFilePath(result.filePath);
        setHasUnsavedChanges(false);

        // Save the file path association
        setScriptFilePaths(prev => ({
          ...prev,
          [currentScript.id]: result.filePath
        }));
      } else {
        console.error('Error saving script:', saveResult.error);
        alert('Failed to save script: ' + saveResult.error);
      }
    } catch (error) {
      console.error('Error in save dialog:', error);
      alert('Failed to save script');
    } finally {
      setIsSaving(false);
    }
  };

  // Load script from file
  const loadScriptFromFile = async (filePath) => {
    if (!window.electron) return;

    try {
      const result = await window.electron.loadScriptFile(filePath);

      if (!result.success) {
        alert('Failed to load script: ' + result.error);
        return;
      }

      const scriptData = parseFileFormat(result.content);
      const newId = Math.max(0, ...scripts.map(s => s.id)) + 1;

      const newScript = {
        id: newId,
        ...scriptData
      };

      setScripts(prev => [...prev, newScript]);
      setCurrentScriptId(newId);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);

      // Save the file path association
      setScriptFilePaths(prev => ({
        ...prev,
        [newId]: filePath
      }));

    } catch (error) {
      console.error('Error loading script:', error);
      alert('Failed to load script: ' + error.message);
    }
  };

  // Open file dialog and load script
  const openScriptFile = async () => {
    if (!window.electron) return;

    try {
      const result = await window.electron.openScriptDialog();

      if (result.canceled) return;

      await loadScriptFromFile(result.filePath);
    } catch (error) {
      console.error('Error opening script:', error);
      alert('Failed to open script');
    }
  };

  // Import from .txt, .docx, .pdf
  const importFromFile = async () => {
    if (!window.electron) return;

    try {
      const result = await window.electron.importFileDialog();
      if (result.canceled) return;

      const filePath = result.filePath;
      const importResult = await window.electron.importFile(filePath);

      if (!importResult.success) {
        alert('Failed to import file: ' + importResult.error);
        return;
      }

      // Convert text to HTML paragraphs (split by double line breaks)
      const paragraphs = importResult.text
        .split(/\n\n+/)
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('');

      const newId = Math.max(0, ...scripts.map(s => s.id)) + 1;
      const newScript = {
        id: newId,
        name: importResult.fileName || 'Imported Script',
        description: 'Imported from ' + filePath.split(/[/\\]/).pop(),
        chapters: [
          {
            id: 1,
            name: 'Chapter 1',
            content: paragraphs || '<p>No content found</p>',
            showTitle: true,
            customSpeed: null
          }
        ]
      };

      setScripts(prev => [...prev, newScript]);
      setCurrentScriptId(newId);
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Failed to import file');
    }
  };

  // Close script (remove from app but don't delete file)
  const closeScript = (scriptId) => {
    const remainingScripts = scripts.filter(s => s.id !== scriptId);

    // If closing the last script, create a new blank one
    if (remainingScripts.length === 0) {
      const newId = 1;
      const newScript = {
        id: newId,
        name: 'New Script',
        description: '',
        chapters: [
          { id: 1, name: 'Chapter 1', content: '<p>Start writing your script here...</p>', showTitle: true, customSpeed: null }
        ]
      };
      setScripts([newScript]);
      setCurrentScriptId(newId);
    } else {
      setScripts(remainingScripts);

      // If closing the current script, switch to another one
      if (currentScriptId === scriptId) {
        setCurrentScriptId(remainingScripts[0].id);
      }
    }

    // Remove file path association
    setScriptFilePaths(prev => {
      const newPaths = { ...prev };
      delete newPaths[scriptId];
      return newPaths;
    });
  };

  // Calculate chapter positions - memoized to prevent recalculation
  const chapterPositions = useMemo(() => {
    if (!currentScript?.chapters) return [];

    // Use actual presenter window width for accurate height calculation
    const containerWidth = presenterWindowDimensions.width;

    // Chapters start at position 0 because paddingTop handles the lead-in offset
    let currentPos = 0;
    return currentScript.chapters.map((chapter, index) => {
      // Create temporary div to measure content height with exact scroll container width
      const temp = document.createElement('div');
      temp.innerHTML = chapter.content;
      temp.style.fontSize = `${fontSize}px`;
      temp.style.lineHeight = `${lineHeight}`;
      temp.style.fontFamily = 'Arial, sans-serif';
      temp.style.whiteSpace = 'pre-wrap';
      temp.style.position = 'absolute';
      temp.style.visibility = 'hidden';
      temp.style.width = `${containerWidth}px`; // Use actual presenter window width
      temp.style.paddingLeft = `${horizontalMargin}%`; // Match actual horizontal padding
      temp.style.paddingRight = `${horizontalMargin}%`;
      temp.style.boxSizing = 'border-box'; // Include padding in width calculation
      document.body.appendChild(temp);

      const chapterHeight = temp.offsetHeight || (fontSize * lineHeight * 3); // Fallback
      document.body.removeChild(temp);

      // Add chapter title height if visible
      const titleHeight = chapter.showTitle ? fontSize * 1.5 * lineHeight : 0;
      const position = currentPos;
      currentPos += titleHeight + chapterHeight + (fontSize * lineHeight * chapterSpacing);

      return {
        ...chapter,
        position,
        height: titleHeight + chapterHeight
      };
    });
  }, [currentScript?.chapters, fontSize, lineHeight, chapterSpacing, horizontalMargin, presenterWindowDimensions.width]);

  // Reset current chapter index when script changes
  useEffect(() => {
    setCurrentChapterIndex(0);
  }, [currentScriptId]);

  // Calculate estimated duration based on scroll speed and content height
  // Takes into account custom chapter speeds
  useEffect(() => {
    if (scrollRef.current && scrollSpeed > 0 && chapterPositions.length > 0) {
      let totalDuration = 0;

      // Calculate duration for each chapter based on its speed
      for (let i = 0; i < chapterPositions.length; i++) {
        const chapter = chapterPositions[i];
        const nextChapter = chapterPositions[i + 1];

        // Distance from this chapter to next (or to end of content)
        const chapterDistance = nextChapter
          ? (nextChapter.position - chapter.position)
          : (scrollRef.current.scrollHeight - scrollRef.current.clientHeight - chapter.position);

        // Use chapter's custom speed or global speed
        const chapterSpeed = (chapter.customSpeed !== null && chapter.customSpeed !== undefined)
          ? chapter.customSpeed
          : scrollSpeed;

        // scrollSpeed is pixels per frame (at 60fps), so pixels per second = speed * 60
        const pixelsPerSecond = chapterSpeed * 60;
        const chapterDuration = chapterDistance / pixelsPerSecond;

        totalDuration += chapterDuration;
      }

      setEstimatedDuration(totalDuration);
    }
  }, [scrollSpeed, currentScript, presenterWindowDimensions, chapterPositions]);

  // Auto-scroll animation - with per-chapter speed support
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = Date.now(); // Reset time when pausing
      return;
    }

    const animate = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Check if scroll position is approaching any chapter's START position
      // Uses CONTENT-BASED scroll positions (like chapter jumping), not screen positions
      // This is truly window-size independent
      if (scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight;
        const currentScrollPos = scrollPositionRef.current;

        // Find the target visual position (same as jumpToChapter uses)
        const chapter0Element = scrollRef.current.querySelector('#chapter-0');
        let targetVisualPosition = containerHeight / 2; // Default to center

        if (chapter0Element) {
          const chapter0OffsetTop = chapter0Element.offsetTop;
          const chapter0TargetScroll = Math.max(0, chapter0OffsetTop - (containerHeight / 2));
          targetVisualPosition = chapter0OffsetTop - chapter0TargetScroll;
        }

        // Check each chapter
        for (let i = 0; i < chapterPositions.length; i++) {
          const chapterElement = scrollRef.current.querySelector(`#chapter-${i}`);
          if (chapterElement) {
            const chapter = currentScript?.chapters[i];

            // Get content position of chapter's first text line
            let textContentPosition = chapterElement.offsetTop;

            // Add title offset if chapter has a title
            if (chapter && chapter.showTitle) {
              const titleFullHeight = fontSize * 1.5 * lineHeight;
              const titleMargin = fontSize * lineHeight;
              textContentPosition += titleFullHeight + titleMargin;
            }

            // Add first line height to get to the actual visible text
            const firstLineHeight = fontSize * lineHeight;
            textContentPosition += firstLineHeight;

            // Calculate what scroll position would put this text at the target visual position
            const scrollPosForTarget = Math.max(0, textContentPosition - targetVisualPosition);

            // Trigger BEFORE reaching target - calculate lead based on line height
            // This ensures consistent trigger point regardless of font size or window size
            const lineHeightPx = fontSize * lineHeight;
            const leadLines = 1; // Trigger 1 line before the chapter reaches center
            const leadDistance = lineHeightPx * leadLines;
            const triggerScrollPos = scrollPosForTarget - leadDistance;

            // Trigger when we've reached or passed the trigger point, but haven't reached target yet
            if (currentScrollPos >= triggerScrollPos && currentScrollPos < scrollPosForTarget && lastSpeedChangeChapterRef.current !== i) {
              const targetChapter = chapterPositions[i];
              if (targetChapter) {
                lastSpeedChangeChapterRef.current = i;

                if (targetChapter.customSpeed !== undefined && targetChapter.customSpeed !== null) {
                  targetSpeedRef.current = targetChapter.customSpeed;
                } else {
                  targetSpeedRef.current = scrollSpeedRef.current;
                }
                break;
              }
            }
          }
        }
      }

      // Nearly instant transition to the locked-in target speed.
      // Reads via refs so dial-driven scrollSpeed changes don't cancel & restart
      // the animation loop (which would zero out the per-frame delta).
      const speedTransitionRate = 0.8;
      const currentActive = activeScrollSpeedRef.current;
      const newActiveSpeed = currentActive + (targetSpeedRef.current - currentActive) * speedTransitionRate;

      if (Math.abs(newActiveSpeed - currentActive) > 0.01) {
        activeScrollSpeedRef.current = newActiveSpeed;
        setActiveScrollSpeed(newActiveSpeed);
      }

      const newPos = scrollPositionRef.current + (newActiveSpeed * delta / 16.67);
      
      // Update both views simultaneously
      if (scrollRef.current) {
        const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        if (newPos >= maxScroll) {
          setIsPlaying(false);
          setHasReachedEnd(true);
          scrollPositionRef.current = maxScroll;
          setScrollPosition(maxScroll);
          scrollRef.current.scrollTop = maxScroll;
          if (presenterWindow) {
            if (presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
              window.electron.updatePresenterScroll({ position: maxScroll, percentage: 1.0 });
            } else if (presenterWindowScrollRef.current) {
              presenterWindowScrollRef.current.scrollTop = maxScroll;
            }
          }
          return;
        }
      }

      scrollPositionRef.current = newPos;

      // Throttle state updates - only update every ~100ms to reduce re-renders
      const timeSinceLastUpdate = now - (lastStateUpdateRef.current || 0);
      if (timeSinceLastUpdate > 100) {
        setScrollPosition(newPos);

        // Calculate and update scroll progress percentage
        const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        const progress = maxScroll > 0 ? Math.min((newPos / maxScroll) * 100, 100) : 0;
        setScrollProgress(progress);

        // Update elapsed time based on real wall-clock time
        // This ensures smooth, real-time progression regardless of scroll speed
        if (timerStartTimestampRef.current !== null) {
          const totalElapsed = (Date.now() - timerStartTimestampRef.current) / 1000;
          // Use Math.floor for smooth whole-second display
          const flooredElapsed = Math.floor(totalElapsed);
          // Safeguard: don't show negative time
          setElapsedTime(Math.max(0, flooredElapsed));
        }

        lastStateUpdateRef.current = now;
      }

      // Update fullscreen scroll
      if (scrollRef.current) {
        scrollRef.current.scrollTop = newPos;
      }

      // Update preview scroll - calculate proportional position based on preview's scroll height
      if (previewScrollRef.current && scrollRef.current) {
        const mainMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        const previewMaxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
        const scrollPercentage = mainMaxScroll > 0 ? newPos / mainMaxScroll : 0;
        previewScrollRef.current.scrollTop = scrollPercentage * previewMaxScroll;
      }

      // Update presenter window scroll (no throttle for smooth scrolling).
      // Presenter runs its own local RAF and interpolates between rebases —
      // we send playing + speed so it can extrapolate forward smoothly
      // between IPC arrivals.
      if (presenterWindow) {
        if (presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
          const refEl = scrollRef.current;
          const maxScroll = refEl ? refEl.scrollHeight - refEl.clientHeight : 1;
          const percentage = maxScroll > 0 ? newPos / maxScroll : 0;
          window.electron.updatePresenterScroll({
            position: newPos,
            percentage,
            playing: true,
            speed: newActiveSpeed
          });
        } else if (presenterWindowScrollRef.current) {
          presenterWindowScrollRef.current.scrollTop = newPos;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, showFullscreen, chapterPositions]);

  // Sync preview scroll position when pausing
  useEffect(() => {
    if (isPlaying) return; // Only sync when paused

    // Sync preview to current scroll position
    if (previewScrollRef.current && scrollRef.current) {
      const currentPosition = scrollPositionRef.current;
      const mainMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      const previewMaxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
      const scrollPercentage = mainMaxScroll > 0 ? currentPosition / mainMaxScroll : 0;
      previewScrollRef.current.scrollTop = scrollPercentage * previewMaxScroll;
    }
  }, [isPlaying]);

  // Sync activeScrollSpeed when user manually changes scrollSpeed
  // Update activeScrollSpeed when scrollSpeed changes (unless current chapter has custom speed)
  useEffect(() => {
    // Determine current chapter based on actual DOM scroll position
    const currentChapterIndex = getCurrentChapterIndex();
    const currentChapter = chapterPositions[currentChapterIndex];

    // Only update activeScrollSpeed and target if current chapter doesn't have custom speed
    if (!currentChapter || currentChapter.customSpeed === undefined || currentChapter.customSpeed === null) {
      activeScrollSpeedRef.current = scrollSpeed;
      targetSpeedRef.current = scrollSpeed;
      setActiveScrollSpeed(scrollSpeed);
    }
  }, [scrollSpeed, chapterPositions]);

  // Handle timer start/pause for real-time elapsed time tracking
  useEffect(() => {
    if (isPlaying) {
      // Starting/resuming playback
      if (timerStartTimestampRef.current === null) {
        // Starting fresh - set timer to start from current elapsed time
        timerStartTimestampRef.current = Date.now() - (pausedElapsedRef.current * 1000);
      }
      // If timer is already running, don't reset it (avoids issues when isPlaying changes while playing)
    } else {
      // Pausing playback - save the current elapsed time
      if (timerStartTimestampRef.current !== null) {
        const currentElapsed = (Date.now() - timerStartTimestampRef.current) / 1000;
        pausedElapsedRef.current = Math.floor(currentElapsed);
        setElapsedTime(pausedElapsedRef.current);
        timerStartTimestampRef.current = null;
      }
    }
  }, [isPlaying]);

  // Reset timer display when at position 0 (paused state)
  useEffect(() => {
    if (!isPlaying && scrollPositionRef.current < 5) {
      // At the beginning while paused - ensure timer shows 0
      if (elapsedTime !== 0 || pausedElapsedRef.current !== 0) {
        setElapsedTime(0);
        pausedElapsedRef.current = 0;
        timerStartTimestampRef.current = null;
      }
    }
  }, [scrollPosition, isPlaying, elapsedTime]);

  // Initialize chapter content without resetting cursor
  useEffect(() => {
    if (!currentScript) return;
    
    currentScript.chapters.forEach(chapter => {
      const contentDiv = document.getElementById(`chapter-content-${chapter.id}`);
      if (contentDiv) {
        // Only set innerHTML if the element is empty or doesn't match
        // This prevents cursor resets during typing
        if (contentDiv.innerHTML !== chapter.content && !contentDiv.hasAttribute('data-pending-content')) {
          // Save cursor position
          const selection = window.getSelection();
          const hadFocus = document.activeElement === contentDiv;
          let savedRange = null;
          
          if (hadFocus && selection.rangeCount > 0) {
            try {
              savedRange = selection.getRangeAt(0).cloneRange();
            } catch (e) {
              // Ignore if range is invalid
            }
          }
          
          // Update content
          contentDiv.innerHTML = chapter.content;
          
          // Restore cursor position if it had focus
          if (hadFocus && savedRange) {
            try {
              selection.removeAllRanges();
              selection.addRange(savedRange);
              contentDiv.focus();
            } catch (e) {
              // If restoration fails, just focus the element
              contentDiv.focus();
            }
          }
        }
      }
    });
  }, [currentScript?.chapters]);

  // Timer is now handled in the animation loop and pause/resume useEffect
  // (Legacy timer code removed)

  // Sync scroll position - force scroll update on every render
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollPosition;
      }

      // Mirror to the visible operator preview (scaled). Without this, paths
      // that only update scrollPosition state (jog, jump-to-chapter, reset)
      // would leave the preview frozen while the presenter and hidden ref
      // both scroll correctly.
      if (previewScrollRef.current && scrollRef.current) {
        const mainMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        const previewMaxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
        const scrollPercentage = mainMaxScroll > 0 ? scrollPosition / mainMaxScroll : 0;
        previewScrollRef.current.scrollTop = scrollPercentage * previewMaxScroll;
      }

      // Push to presenter — include playing/speed so the presenter's local
      // animation can extrapolate between rebases. When paused/manual scroll
      // the presenter just holds at the position we send.
      if (presenterWindow && presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
        const maxScroll = scrollRef.current
          ? scrollRef.current.scrollHeight - scrollRef.current.clientHeight
          : 1;
        const percentage = maxScroll > 0 ? scrollPosition / maxScroll : 0;
        window.electron.updatePresenterScroll({
          position: scrollPosition,
          percentage,
          playing: isPlayingRef.current,
          speed: isPlayingRef.current ? activeScrollSpeedRef.current : 0
        });
      }
    });
  }, [scrollPosition, presenterWindow]);

  // Load display list and chosen target id from main process; refresh on display changes.
  useEffect(() => {
    if (!window.electron?.getDisplays) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [list, current] = await Promise.all([
          window.electron.getDisplays(),
          window.electron.getPresenterDisplay()
        ]);
        if (cancelled) return;
        setDisplays(list || []);
        setPresenterDisplayId(typeof current === 'number' ? current : null);
      } catch (err) {
        console.error('Failed to load displays:', err);
      }
    };
    refresh();
    const unsub = window.electron.onDisplaysChanged
      ? window.electron.onDisplaysChanged(refresh)
      : null;
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  // Close the display picker on outside click.
  useEffect(() => {
    if (!showDisplayDropdown) return;
    const handle = (e) => {
      if (!e.target.closest('.display-picker')) {
        setShowDisplayDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showDisplayDropdown]);

  // Close pickers when clicking outside.
  //
  // Two subtleties this handler addresses:
  //  1. The contentEditable editor calls e.stopPropagation() on mousedown, which
  //     blocks the bubble phase from reaching document. We use the CAPTURE phase
  //     instead so editor clicks still close any open picker.
  //  2. We must NOT close on clicks of the picker trigger button or inside the
  //     panel itself — the trigger's own onMouseDown handles toggle, and inside
  //     clicks (e.g. color swatches) need to work.
  useEffect(() => {
    const anyOpen = showColorPicker !== null || showEmojiPicker !== null || showSpeedPicker !== null;
    if (!anyOpen) return;

    const handle = (e) => {
      const target = e.target;
      if (
        target.closest('.color-picker-panel') ||
        target.closest('.emoji-picker-panel') ||
        target.closest('.speed-picker-panel') ||
        target.closest('.picker-button')
      ) {
        return;
      }
      setShowColorPicker(null);
      setShowEmojiPicker(null);
      setShowSpeedPicker(null);
      setTempChapterSpeed(null);
    };

    document.addEventListener('mousedown', handle, true);
    return () => document.removeEventListener('mousedown', handle, true);
  }, [showColorPicker, showEmojiPicker, showSpeedPicker]);

  const showPresenterRequiredToast = () => {
    setPresenterRequiredToast(true);
    if (presenterRequiredToastTimeoutRef.current) {
      clearTimeout(presenterRequiredToastTimeoutRef.current);
    }
    presenterRequiredToastTimeoutRef.current = setTimeout(() => {
      setPresenterRequiredToast(false);
      presenterRequiredToastTimeoutRef.current = null;
    }, 3000);
  };

  // Use the ref so callers from long-lived effects (remote/IPC handlers with
  // [] deps) see the current presenter-window state, not a stale closure.
  const toggleManualScroll = () => {
    const pw = presenterWindowRef.current;
    if (!pw || pw.closed) {
      showPresenterRequiredToast();
      return;
    }
    setManualScrollMode(prev => {
      if (!prev) setIsPlaying(false);
      return !prev;
    });
  };

  const toggleSpotlight = () => {
    const pw = presenterWindowRef.current;
    if (!pw || pw.closed) {
      showPresenterRequiredToast();
      return;
    }
    setSpotlightMode(prev => {
      const newMode = !prev;
      if (!newMode && window.electron?.updatePresenterSpotlight) {
        window.electron.updatePresenterSpotlight(null);
      }
      return newMode;
    });
  };

  useEffect(() => {
    return () => {
      if (presenterRequiredToastTimeoutRef.current) {
        clearTimeout(presenterRequiredToastTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (window.electron && currentScript) {
          saveCurrentScript();
        }
        return;
      }

      // Don't trigger shortcuts if user is typing in an input field or content editable area
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.target.isContentEditable || e.target.closest('[contenteditable="true"]')) return;

      // Check custom shortcuts
      if (matchesAnyShortcut(e, keyboardShortcuts.playPause)) {
        e.preventDefault();
        togglePlayPause();
      } else if (matchesAnyShortcut(e, keyboardShortcuts.speedUp)) {
        e.preventDefault();
        setScrollSpeed(prev => Math.min(prev + speedIncrement, 10));
      } else if (matchesAnyShortcut(e, keyboardShortcuts.speedDown)) {
        e.preventDefault();
        setScrollSpeed(prev => Math.max(prev - speedIncrement, -10));
      } else if (matchesAnyShortcut(e, keyboardShortcuts.prevChapter)) {
        e.preventDefault();
        jumpToPreviousChapter();
      } else if (matchesAnyShortcut(e, keyboardShortcuts.nextChapter)) {
        e.preventDefault();
        jumpToNextChapter();
      } else if (matchesAnyShortcut(e, keyboardShortcuts.resetScript)) {
        e.preventDefault();
        cancelCountdown();
        scrollPositionRef.current = 0;
        setScrollPosition(0);
        setIsPlaying(false);
        setHasReachedEnd(false);
        // Reset timer when jumping to start
        setElapsedTime(0);
        pausedElapsedRef.current = 0;
        timerStartTimestampRef.current = null;
      } else if (matchesAnyShortcut(e, keyboardShortcuts.manualScroll)) {
        e.preventDefault();
        toggleManualScroll();
      } else if (matchesAnyShortcut(e, keyboardShortcuts.spotlight)) {
        e.preventDefault();
        toggleSpotlight();
      } else if (e.key === 'Escape' && showFullscreen) {
        e.preventDefault();
        setShowFullscreen(false);
        setIsPlaying(false);
      }
    };

    const handleWheel = (e) => {
      // Don't trigger if editing
      if (editingShortcut) return;

      // Don't trigger if scrolling in specific areas
      if (e.target.closest('.overflow-y-auto')) return;

      const direction = e.deltaY < 0 ? 'Up' : 'Down';
      const wheelEvent = {
        key: `Wheel${direction}`,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      };

      // Check custom shortcuts
      if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.playPause)) {
        e.preventDefault();
        togglePlayPause();
      } else if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.speedUp)) {
        e.preventDefault();
        setScrollSpeed(prev => Math.min(prev + speedIncrement, 10));
      } else if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.speedDown)) {
        e.preventDefault();
        setScrollSpeed(prev => Math.max(prev - speedIncrement, -10));
      } else if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.prevChapter)) {
        e.preventDefault();
        jumpToPreviousChapter();
      } else if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.nextChapter)) {
        e.preventDefault();
        jumpToNextChapter();
      } else if (matchesAnyShortcut(wheelEvent, keyboardShortcuts.resetScript)) {
        e.preventDefault();
        scrollPositionRef.current = 0;
        setScrollPosition(0);
        setIsPlaying(false);
        setHasReachedEnd(false);
        // Reset timer when jumping to start
        setElapsedTime(0);
        pausedElapsedRef.current = 0;
        timerStartTimestampRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [showFullscreen, hasReachedEnd, chapterPositions, speedIncrement, keyboardShortcuts, editingShortcut]);

  // Capture keyboard shortcuts when editing
  useEffect(() => {
    if (!editingShortcut) return;

    const handleCaptureKey = (e) => {
      // Allow Shift+Escape to cancel (so plain Escape can be used as a shortcut)
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        cancelEditingShortcut();
        return;
      }

      // Prevent default for all other keys during capture
      e.preventDefault();
      e.stopPropagation();

      // Capture the key combination
      const keyLabel = e.key === ' ' ? 'Space' :
                      e.key === 'Escape' ? 'Esc' :
                      e.key.length === 1 ? e.key.toUpperCase() :
                      e.key;

      const captured = {
        key: e.key,
        label: keyLabel,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey
      };

      setCapturedKeys(captured);
    };

    const handleCaptureWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY < 0 ? 'Up' : 'Down';
      const keyLabel = `Wheel${direction}`;

      const captured = {
        key: `Wheel${direction}`,
        label: keyLabel,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey
      };

      setCapturedKeys(captured);
    };

    // Add with capture phase to intercept before other handlers
    window.addEventListener('keydown', handleCaptureKey, true);
    window.addEventListener('wheel', handleCaptureWheel, true);
    return () => {
      window.removeEventListener('keydown', handleCaptureKey, true);
      window.removeEventListener('wheel', handleCaptureWheel, true);
    };
  }, [editingShortcut]);

  // Listen for keyboard events from presenter window
  useEffect(() => {
    if (!window.electron || !window.electron.onKeyboardFromPresenter) return;

    const unsubscribe = window.electron.onKeyboardFromPresenter((keyData) => {
      // Create a synthetic event to match against shortcuts
      const syntheticEvent = {
        key: keyData.key,
        ctrlKey: keyData.ctrlKey || false,
        shiftKey: keyData.shiftKey || false,
        altKey: keyData.altKey || false
      };

      // Check custom shortcuts
      if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.playPause)) {
        togglePlayPause();
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.speedUp)) {
        setScrollSpeed(prev => Math.min(prev + speedIncrement, 10));
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.speedDown)) {
        setScrollSpeed(prev => Math.max(prev - speedIncrement, -10));
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.prevChapter)) {
        jumpToPreviousChapter();
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.nextChapter)) {
        jumpToNextChapter();
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.resetScript)) {
        cancelCountdown();
        scrollPositionRef.current = 0;
        setScrollPosition(0);
        setIsPlaying(false);
        setHasReachedEnd(false);
        // Reset timer when jumping to start
        setElapsedTime(0);
        pausedElapsedRef.current = 0;
        timerStartTimestampRef.current = null;
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.manualScroll)) {
        toggleManualScroll();
      } else if (matchesAnyShortcut(syntheticEvent, keyboardShortcuts.spotlight)) {
        toggleSpotlight();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showFullscreen, hasReachedEnd, chapterPositions, speedIncrement, keyboardShortcuts, presenterWindow, countdownDuration]);

  // Listen for presenter window dimension updates for 1:1 operator preview
  useEffect(() => {
    if (!window.electron || !window.electron.onPresenterDimensionsUpdate) return;

    const unsubscribe = window.electron.onPresenterDimensionsUpdate((dimensions) => {

      // Before updating dimensions, calculate the current scroll percentage
      // so we can maintain position when content reflows
      let scrollPercentage = 0;
      if (scrollRef.current) {
        const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        if (maxScroll > 0) {
          scrollPercentage = scrollPositionRef.current / maxScroll;
        }
      }

      setPresenterWindowDimensions(dimensions);

      // After dimensions update (and content reflows), restore the scroll percentage
      // Use setTimeout to ensure the DOM has updated with new dimensions
      setTimeout(() => {
        if (scrollRef.current) {
          const newMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
          const newScrollPos = scrollPercentage * newMaxScroll;

          scrollRef.current.scrollTop = newScrollPos;
          scrollPositionRef.current = newScrollPos;
          setScrollPosition(newScrollPos);

          if (previewScrollRef.current) {
            previewScrollRef.current.scrollTop = newScrollPos;
          }

          if (window.electron && window.electron.updatePresenterScroll) {
            window.electron.updatePresenterScroll(newScrollPos);
          }
        }
      }, 0);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Listen for presenter window fullscreen state changes
  useEffect(() => {
    if (!window.electron || !window.electron.onPresenterFullscreenChange) return;

    const unsubscribe = window.electron.onPresenterFullscreenChange((isFullscreen) => {
      setPresenterFullscreen(isFullscreen);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Measure operator panel width for responsive scaling
  useEffect(() => {
    const updatePanelWidth = () => {
      if (operatorPanelRef.current) {
        setOperatorPanelWidth(operatorPanelRef.current.clientWidth);
      }
    };

    // Initial measurement with slight delay to ensure DOM has rendered
    const timer = setTimeout(updatePanelWidth, 100);

    window.addEventListener('resize', updatePanelWidth);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePanelWidth);
    };
  }, [previewWidth, presenterWindow]); // Re-measure when preview width changes or presenter window opens/closes

  // Load open scripts from localStorage on startup
  useEffect(() => {
    const loadSavedScripts = async () => {
      if (!window.electron) return;

      try {
        const savedPaths = localStorage.getItem('openScriptPaths');

        // First time user - keep tutorial script
        if (!savedPaths) {
          return;
        }

        const filePaths = JSON.parse(savedPaths);

        // If there are saved scripts, load them
        if (filePaths.length > 0) {
          // Clear default scripts
          setScripts([]);

          // Load each saved script
          const loadedScripts = [];
          const pathMap = {};
          let nextId = 1;

          for (const filePath of filePaths) {
            try {
              const result = await window.electron.loadScriptFile(filePath);
              if (result.success) {
                const scriptData = parseFileFormat(result.content);
                const script = {
                  id: nextId,
                  ...scriptData
                };
                loadedScripts.push(script);
                pathMap[nextId] = filePath;
                nextId++;
              }
            } catch (error) {
              console.error('Error loading script from:', filePath, error);
            }
          }

          if (loadedScripts.length > 0) {
            setScripts(loadedScripts);
            setCurrentScriptId(loadedScripts[0].id);
            setScriptFilePaths(pathMap);
            setCurrentFilePath(pathMap[loadedScripts[0].id]);
          } else {
            // No scripts could be loaded, show tutorial
            setScripts([getTutorialScript()]);
            setCurrentScriptId(1);
          }
        } else {
          // Empty saved paths - show tutorial
          setScripts([getTutorialScript()]);
          setCurrentScriptId(1);
        }
      } catch (error) {
        console.error('Error loading saved scripts:', error);
        // On error, show tutorial
        setScripts([getTutorialScript()]);
        setCurrentScriptId(1);
      }
    };

    loadSavedScripts();
  }, []);

  // Mark as unsaved when script changes
  useEffect(() => {
    if (currentScript && currentFilePath) {
      setHasUnsavedChanges(true);
    }
  }, [currentScript]);

  // Auto-save every 30 seconds if there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges || !currentFilePath) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentScript();
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, currentFilePath, currentScript]);

  // Persist open script paths to localStorage whenever they change
  useEffect(() => {
    if (!window.electron) return;

    const filePaths = Object.values(scriptFilePaths).filter(Boolean);
    if (filePaths.length > 0) {
      localStorage.setItem('openScriptPaths', JSON.stringify(filePaths));

    }
  }, [scriptFilePaths]);

  // Load settings from localStorage on startup
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);


        // Restore all settings
        if (settings.fontSize !== undefined) setFontSize(settings.fontSize);
        if (settings.fontColor !== undefined) setFontColor(settings.fontColor);
        if (settings.bgColor !== undefined) setBgColor(settings.bgColor);
        if (settings.lineHeight !== undefined) setLineHeight(settings.lineHeight);
        if (settings.horizontalMargin !== undefined) setHorizontalMargin(settings.horizontalMargin);
        if (settings.crosshairColor !== undefined) setCrosshairColor(settings.crosshairColor);
        if (settings.crosshairLength !== undefined) setCrosshairLength(settings.crosshairLength);
        if (settings.crosshairThickness !== undefined) setCrosshairThickness(settings.crosshairThickness);
        if (settings.countdownDuration !== undefined) setCountdownDuration(settings.countdownDuration);
        if (settings.sidebarCollapsed !== undefined) setSidebarCollapsed(settings.sidebarCollapsed);
        if (settings.timerDisplayMode !== undefined) {
          setTimerDisplayMode(settings.timerDisplayMode);
        } else if (settings.showTimerSpeed !== undefined) {
          // Migrate legacy boolean setting
          setTimerDisplayMode(settings.showTimerSpeed ? 'full' : 'hidden');
        }
        if (settings.timerCorner !== undefined) setTimerCorner(settings.timerCorner);
        if (settings.leadInMargin !== undefined) setLeadInMargin(settings.leadInMargin);
        if (settings.chapterSpacing !== undefined) setChapterSpacing(settings.chapterSpacing);
        if (settings.wordsPerMinute !== undefined) setWordsPerMinute(settings.wordsPerMinute);
        if (settings.scrollSpeed !== undefined) setScrollSpeed(settings.scrollSpeed);
        if (settings.speedIncrement !== undefined) setSpeedIncrement(settings.speedIncrement);
        if (settings.keyboardShortcuts !== undefined) {
          // Merge saved shortcuts with defaults to ensure new shortcuts are available
          setKeyboardShortcuts(prev => ({ ...prev, ...settings.keyboardShortcuts }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    // Mark settings as loaded after a brief delay to ensure all state updates are complete
    setTimeout(() => {
      settingsLoadedRef.current = true;

    }, 100);
  }, []);

  // Save settings to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    // Don't save during initial load
    if (!settingsLoadedRef.current) {
      return;
    }

    const settings = {
      fontSize,
      fontColor,
      bgColor,
      lineHeight,
      horizontalMargin,
      crosshairColor,
      crosshairLength,
      crosshairThickness,
      countdownDuration,
      timerDisplayMode,
      timerCorner,
      sidebarCollapsed,
      leadInMargin,
      chapterSpacing,
      wordsPerMinute,
      scrollSpeed,
      speedIncrement,
      keyboardShortcuts
    };

    localStorage.setItem('appSettings', JSON.stringify(settings));

  }, [
    fontSize,
    fontColor,
    bgColor,
    lineHeight,
    horizontalMargin,
    crosshairColor,
    crosshairLength,
    crosshairThickness,
    countdownDuration,
    timerDisplayMode,
    timerCorner,
    sidebarCollapsed,
    leadInMargin,
    chapterSpacing,
    wordsPerMinute,
    scrollSpeed,
    speedIncrement,
    keyboardShortcuts
  ]);

  // Update current file path when switching scripts
  useEffect(() => {
    if (currentScriptId && scriptFilePaths[currentScriptId]) {
      setCurrentFilePath(scriptFilePaths[currentScriptId]);
    } else {
      setCurrentFilePath(null);
    }
  }, [currentScriptId, scriptFilePaths]);

  // Drag-and-drop support for files
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!window.electron) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      const filePath = file.path;
      const ext = filePath.split('.').pop().toLowerCase();



      try {
        if (ext === 'teleprompter') {
          // Load .teleprompter file
          await loadScriptFromFile(filePath);
        } else if (['txt', 'docx', 'pdf'].includes(ext)) {
          // Import other formats
          const importResult = await window.electron.importFile(filePath);

          if (!importResult.success) {
            alert('Failed to import file: ' + importResult.error);
            return;
          }

          // Convert text to HTML paragraphs
          const paragraphs = importResult.text
            .split(/\n\n+/)
            .map(para => para.trim())
            .filter(para => para.length > 0)
            .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join('');

          const newId = Math.max(0, ...scripts.map(s => s.id)) + 1;
          const newScript = {
            id: newId,
            name: importResult.fileName || 'Imported Script',
            description: 'Imported from ' + file.name,
            chapters: [
              {
                id: 1,
                name: 'Chapter 1',
                content: paragraphs || '<p>No content found</p>',
                showTitle: true,
                customSpeed: null
              }
            ]
          };

          setScripts(prev => [...prev, newScript]);
          setCurrentScriptId(newId);

        } else {
          alert('Unsupported file type. Please drop a .teleprompter, .txt, .docx, or .pdf file.');
        }
      } catch (error) {
        console.error('Error handling dropped file:', error);
        alert('Failed to open file');
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [scripts, scriptFilePaths]);

  // Helper function to sync preview scroll with main scroll position
  const syncPreviewScroll = () => {
    if (previewScrollRef.current && scrollRef.current) {
      const currentPosition = scrollPositionRef.current;
      const mainMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      const previewMaxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
      const scrollPercentage = mainMaxScroll > 0 ? currentPosition / mainMaxScroll : 0;
      previewScrollRef.current.scrollTop = scrollPercentage * previewMaxScroll;
    }
  };

  // Get current chapter index based on scroll position
  const getCurrentChapterIndex = () => {
    const currentPos = scrollPositionRef.current;

    if (scrollRef.current) {
      const containerHeight = scrollRef.current.clientHeight;
      const centerOffset = containerHeight / 2;

      // Since chapters are positioned at center, the scroll position for a chapter
      // is (chapterTop - centerOffset). We need to find which chapter we're closest to.
      for (let i = chapterPositions.length - 1; i >= 0; i--) {
        const chapterEl = scrollRef.current.querySelector(`#chapter-${i}`);
        if (chapterEl) {
          const chapterTop = chapterEl.offsetTop;
          const chapterScrollPos = chapterTop - centerOffset;

          // If we're at or past this chapter's scroll position (with tolerance)
          if (currentPos >= chapterScrollPos - 100) {
            return i;
          }
        }
      }
    }
    return 0;
  };

  const jumpToNextChapter = () => {
    setIsPlaying(false); // Auto-pause when skipping chapters

    // Find which chapter the crosshair is currently IN, then jump to the next one
    // A chapter is "current" if its start position is at or before the crosshair
    const currentPos = scrollPositionRef.current;

    if (scrollRef.current) {
      const containerHeight = scrollRef.current.clientHeight;
      const centerOffset = containerHeight / 2;

      // Find the current chapter (highest index whose start is at or before current position)
      // We're only "in" a chapter once the crosshair has PASSED its start position
      let currentChapter = 0;
      for (let i = 0; i < chapterPositions.length; i++) {
        const chapterEl = scrollRef.current.querySelector(`#chapter-${i}`);
        if (chapterEl) {
          const chapterTop = chapterEl.offsetTop;
          const chapterScrollPos = chapterTop - centerOffset;

          // Only count as "in" this chapter if we've scrolled past its start (crosshair below chapter start)
          if (chapterScrollPos < currentPos) {
            currentChapter = i;
          }
        }
      }

      // Jump to the next chapter if it exists
      if (currentChapter < chapterPositions.length - 1) {
        jumpToChapter(currentChapter + 1);
      }
    }
  };

  const jumpToPreviousChapter = () => {
    setIsPlaying(false); // Auto-pause when skipping chapters
    const currentIndex = getCurrentChapterIndex();

    // Calculate the scroll position at the start of the current chapter
    let chapterStartPos = 0;
    if (scrollRef.current) {
      const chapterElement = scrollRef.current.querySelector(`#chapter-${currentIndex}`);
      if (chapterElement) {
        const chapterTop = chapterElement.offsetTop;
        const containerHeight = scrollRef.current.clientHeight;
        const centerOffset = containerHeight / 2;

        // Get the visual position where Chapter 0 appears
        const chapter0Element = scrollRef.current.querySelector('#chapter-0');
        let targetVisualPosition = centerOffset;
        if (chapter0Element) {
          const chapter0OffsetTop = chapter0Element.offsetTop;
          const chapter0TargetScroll = Math.max(0, chapter0OffsetTop - centerOffset);
          targetVisualPosition = chapter0OffsetTop - chapter0TargetScroll;
        }

        chapterStartPos = Math.max(0, chapterTop - targetVisualPosition);
      }
    }

    // Check if we're at or near the start of the current chapter (within 5 pixels)
    const isAtChapterStart = scrollPositionRef.current <= chapterStartPos + 5;

    if (isAtChapterStart && currentIndex > 0) {
      // At chapter start, go to previous chapter
      jumpToChapter(currentIndex - 1);
    } else {
      // Not at chapter start, go to start of current chapter
      jumpToChapter(currentIndex);
    }
  };

  // Helper function to calculate elapsed time based on scroll position
  // Accounts for different chapter speeds
  const calculateElapsedTimeFromPosition = (scrollPosition) => {
    if (!scrollRef.current || chapterPositions.length === 0) return 0;

    let calculatedElapsed = 0;

    // Find which chapter we're at with this scroll position
    let currentChapterIdx = 0;
    for (let i = 0; i < chapterPositions.length; i++) {
      const nextChapter = chapterPositions[i + 1];
      if (!nextChapter || scrollPosition < nextChapter.position) {
        currentChapterIdx = i;
        break;
      }
    }

    // Calculate time spent in previous chapters (fully traversed)
    for (let i = 0; i < currentChapterIdx; i++) {
      const chapter = chapterPositions[i];
      const nextChapter = chapterPositions[i + 1];
      const chapterDistance = nextChapter
        ? (nextChapter.position - chapter.position)
        : (scrollRef.current.scrollHeight - scrollRef.current.clientHeight - chapter.position);

      const chapterSpeed = (chapter.customSpeed !== null && chapter.customSpeed !== undefined)
        ? chapter.customSpeed
        : scrollSpeed;

      const pixelsPerSecond = chapterSpeed * 60;
      calculatedElapsed += chapterDistance / pixelsPerSecond;
    }

    // Calculate time spent in current chapter (partial)
    if (currentChapterIdx >= 0) {
      const currentChapterData = chapterPositions[currentChapterIdx];
      const distanceInCurrentChapter = Math.max(0, scrollPosition - currentChapterData.position);

      const chapterSpeed = (currentChapterData.customSpeed !== null && currentChapterData.customSpeed !== undefined)
        ? currentChapterData.customSpeed
        : scrollSpeed;

      const pixelsPerSecond = chapterSpeed * 60;
      calculatedElapsed += distanceInCurrentChapter / pixelsPerSecond;
    }

    return calculatedElapsed;
  };

  const jumpToChapter = (chapterIndex) => {
    if (chapterIndex >= 0 && chapterIndex < chapterPositions.length) {
      setHasReachedEnd(false);
      setShowChapterList(false);
      setCurrentChapterIndex(chapterIndex);



      // Find the actual chapter element in the DOM
      if (!scrollRef.current) {
        console.error('[DEBUG] scrollRef not available');
        return;
      }

      const chapterElement = scrollRef.current.querySelector(`#chapter-${chapterIndex}`);
      if (!chapterElement) {
        console.error('[DEBUG] Could not find chapter element #chapter-' + chapterIndex);
        return;
      }

      // Get the actual DOM position of the chapter element
      const chapterTop = chapterElement.offsetTop;
      const containerHeight = scrollRef.current.clientHeight;
      const centerOffset = containerHeight / 2;

      // Find the visual position where Chapter 0 appears (since it may not be able to scroll negative)
      const chapter0Element = scrollRef.current.querySelector('#chapter-0');
      let targetVisualPosition = centerOffset; // Default to center

      if (chapter0Element) {
        const chapter0OffsetTop = chapter0Element.offsetTop;
        const chapter0TargetScroll = Math.max(0, chapter0OffsetTop - centerOffset);
        targetVisualPosition = chapter0OffsetTop - chapter0TargetScroll;
        // This is the actual pixel position from top where Chapter 0 appears
      }

      // Position this chapter at the same visual position as Chapter 0
      const targetScrollPosition = Math.max(0, chapterTop - targetVisualPosition);



      // Update all scroll containers to this position
      scrollPositionRef.current = targetScrollPosition;
      setScrollPosition(targetScrollPosition);

      if (scrollRef.current) {
        scrollRef.current.scrollTop = targetScrollPosition;
      }

      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTop = targetScrollPosition;
      }

      // Calculate and update scroll progress when jumping to chapter
      if (scrollRef.current) {
        const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        const progress = maxScroll > 0 ? Math.min((targetScrollPosition / maxScroll) * 100, 100) : 0;
        setScrollProgress(progress);

        // Calculate elapsed time based on the new scroll position
        const calculatedElapsed = calculateElapsedTimeFromPosition(targetScrollPosition);

        // Update timer state to reflect the new position
        // Floor to whole seconds for consistent display
        const flooredElapsed = Math.floor(calculatedElapsed);

        // Always update both ref and state when skipping to avoid race conditions
        pausedElapsedRef.current = flooredElapsed;
        setElapsedTime(flooredElapsed);

        // Adjust timer start timestamp - if playing, timer will continue from new position
        // If paused, this will be used when resuming
        if (timerStartTimestampRef.current !== null) {
          // Timer is running - adjust it to match new position
          timerStartTimestampRef.current = Date.now() - (flooredElapsed * 1000);
        }
      }

      // Tell presenter window to scroll to the exact same position for pixel-perfect sync
      if (presenterWindow && window.electron) {
        window.electron.updatePresenterScroll(targetScrollPosition);
      }
    }
  };

  // Navigate to previous chapter - goes to chapter start first, then previous chapter
  const navigateToPreviousChapter = () => {
    setIsPlaying(false); // Auto-pause when skipping chapters
    const currentIndex = getCurrentChapterIndex();

    // Calculate the scroll position at the start of the current chapter
    let chapterStartPos = 0;
    if (scrollRef.current) {
      const chapterElement = scrollRef.current.querySelector(`#chapter-${currentIndex}`);
      if (chapterElement) {
        const chapterTop = chapterElement.offsetTop;
        const containerHeight = scrollRef.current.clientHeight;
        const centerOffset = containerHeight / 2;

        // Get the visual position where Chapter 0 appears
        const chapter0Element = scrollRef.current.querySelector('#chapter-0');
        let targetVisualPosition = centerOffset;
        if (chapter0Element) {
          const chapter0OffsetTop = chapter0Element.offsetTop;
          const chapter0TargetScroll = Math.max(0, chapter0OffsetTop - centerOffset);
          targetVisualPosition = chapter0OffsetTop - chapter0TargetScroll;
        }

        chapterStartPos = Math.max(0, chapterTop - targetVisualPosition);
      }
    }

    // Check if we're at or near the start of the current chapter (within 5 pixels)
    const isAtChapterStart = scrollPositionRef.current <= chapterStartPos + 5;

    if (isAtChapterStart && currentIndex > 0) {
      // At chapter start, go to previous chapter
      jumpToChapter(currentIndex - 1);
    } else {
      // Not at chapter start, go to start of current chapter
      jumpToChapter(currentIndex);
    }
  };

  // Navigate to next chapter - simple cycle
  const navigateToNextChapter = () => {
    setIsPlaying(false); // Auto-pause when skipping chapters

    // Find which chapter the crosshair is currently IN, then jump to the next one
    const currentPos = scrollPositionRef.current;

    if (scrollRef.current) {
      const containerHeight = scrollRef.current.clientHeight;
      const centerOffset = containerHeight / 2;

      // Find the current chapter (highest index whose start is at or before current position)
      // We're only "in" a chapter once the crosshair has PASSED its start position
      let currentChapter = 0;
      for (let i = 0; i < chapterPositions.length; i++) {
        const chapterEl = scrollRef.current.querySelector(`#chapter-${i}`);
        if (chapterEl) {
          const chapterTop = chapterEl.offsetTop;
          const chapterScrollPos = chapterTop - centerOffset;

          // Only count as "in" this chapter if we've scrolled past its start
          if (chapterScrollPos < currentPos) {
            currentChapter = i;
          }
        }
      }

      // Jump to the next chapter if it exists
      if (currentChapter < chapterPositions.length - 1) {
        jumpToChapter(currentChapter + 1);
      }
    }
  };

  // Handle manual scroll in operator preview (jog mode)
  const handleManualScroll = (deltaY) => {
    if (!scrollRef.current) return;

    const scrollAmount = deltaY * 0.5; // Adjust sensitivity
    const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
    const newPos = Math.max(0, Math.min(scrollPositionRef.current + scrollAmount, maxScroll));

    // Update scroll position
    scrollPositionRef.current = newPos;
    setScrollPosition(newPos);
    setHasReachedEnd(newPos >= maxScroll - 5);

    // Update all scroll containers
    if (scrollRef.current) {
      scrollRef.current.scrollTop = newPos;
    }
    if (previewScrollRef.current) {
      const mainMaxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      const previewMaxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
      const scrollPercentage = mainMaxScroll > 0 ? newPos / mainMaxScroll : 0;
      previewScrollRef.current.scrollTop = scrollPercentage * previewMaxScroll;
    }

    // Update scroll progress
    const progress = maxScroll > 0 ? Math.min((newPos / maxScroll) * 100, 100) : 0;
    setScrollProgress(progress);

    // Calculate and update elapsed time based on scroll position
    const calculatedElapsed = calculateElapsedTimeFromPosition(newPos);
    const flooredElapsed = Math.floor(calculatedElapsed);
    pausedElapsedRef.current = flooredElapsed;
    setElapsedTime(flooredElapsed);

    // Sync to presenter window
    if (presenterWindow && window.electron) {
      window.electron.updatePresenterScroll(newPos);
    }
  };

  const cancelCountdown = () => {
    countdownActiveRef.current = false;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (countdownPauseTimeoutRef.current) {
      clearTimeout(countdownPauseTimeoutRef.current);
      countdownPauseTimeoutRef.current = null;
    }
    setCountdownValue(null);
    if (window.electron?.updatePresenterCountdown) {
      window.electron.updatePresenterCountdown(null);
    }
  };

  const startCountdown = (onComplete) => {
    cancelCountdown();
    countdownActiveRef.current = true;
    let remaining = countdownDurationRef.current;
    setCountdownValue(remaining);
    if (window.electron?.updatePresenterCountdown) {
      window.electron.updatePresenterCountdown(remaining);
    }
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownValue(remaining);
        if (window.electron?.updatePresenterCountdown) {
          window.electron.updatePresenterCountdown(remaining);
        }
      } else {
        // Countdown numbers are done — hide overlay, then wait one full second
        // before starting playback so there's breathing room for the presenter.
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        countdownActiveRef.current = false; // ticking phase over; pause-timeout phase begins
        setCountdownValue(null);
        if (window.electron?.updatePresenterCountdown) {
          window.electron.updatePresenterCountdown(null);
        }
        countdownPauseTimeoutRef.current = setTimeout(() => {
          countdownPauseTimeoutRef.current = null;
          onComplete();
        }, 1000);
      }
    }, 1000);
  };

  const togglePlayPause = () => {
    // Mid-countdown or mid-pause: clicking again aborts and stays paused.
    // Reads refs only — no state closure values — so it's immune to stale closures
    // from any caller (keyboard handler, button click, remote command, IPC forward).
    if (countdownActiveRef.current || countdownPauseTimeoutRef.current) {
      cancelCountdown();
      setIsPlaying(false);
      return;
    }

    if (hasReachedEndRef.current) {
      scrollPositionRef.current = 0;
      setScrollPosition(0);
      setHasReachedEnd(false);
      pausedElapsedRef.current = 0;
      timerStartTimestampRef.current = null;
      setElapsedTime(0);
      lastSpeedChangeChapterRef.current = -1;
      setIsPlaying(true);
      return;
    }

    if (!isPlayingRef.current) {
      lastSpeedChangeChapterRef.current = -1;
      if (countdownDurationRef.current > 0) {
        startCountdown(() => setIsPlaying(true));
        return;
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // Keep refs in sync with state so all togglePlayPause callers read the latest values.
  useEffect(() => { countdownDurationRef.current = countdownDuration; }, [countdownDuration]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { hasReachedEndRef.current = hasReachedEnd; }, [hasReachedEnd]);
  useEffect(() => { presenterWindowRef.current = presenterWindow; }, [presenterWindow]);
  useEffect(() => { manualScrollModeRef.current = manualScrollMode; }, [manualScrollMode]);
  useEffect(() => { scrollSpeedRef.current = scrollSpeed; }, [scrollSpeed]);
  useEffect(() => { activeScrollSpeedRef.current = activeScrollSpeed; }, [activeScrollSpeed]);

  // When playback stops/starts, push a fresh animation state to the presenter
  // so its local RAF loop knows to start/stop interpolating. Per-frame pushes
  // only happen during play, so this useEffect covers the start/stop edges.
  useEffect(() => {
    if (!presenterWindow || presenterWindow.closed || !presenterWindow.isElectron) return;
    if (!window.electron?.updatePresenterScroll) return;
    const refEl = scrollRef.current;
    const maxScroll = refEl ? refEl.scrollHeight - refEl.clientHeight : 1;
    const pos = scrollPositionRef.current;
    const percentage = maxScroll > 0 ? pos / maxScroll : 0;
    window.electron.updatePresenterScroll({
      position: pos,
      percentage,
      playing: isPlaying,
      speed: isPlaying ? activeScrollSpeedRef.current : 0
    });
  }, [isPlaying, presenterWindow]);

  // Cleanup countdown timers on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (countdownPauseTimeoutRef.current) clearTimeout(countdownPauseTimeoutRef.current);
    };
  }, []);

  // Remote control functions
  const startRemoteServer = async () => {
    if (!window.electron || !window.electron.startRemoteServer) {
      console.error('Remote server not available in this environment');
      return;
    }

    try {
      const result = await window.electron.startRemoteServer();
      if (!result.success) {
        console.error('Failed to start remote server:', result.error);
        alert('Failed to start remote server: ' + result.error);
      }
      // Server started event will be received via IPC and update state
    } catch (error) {
      console.error('Error starting remote server:', error);
      alert('Error starting remote server: ' + error.message);
    }
  };

  const stopRemoteServer = async () => {
    if (!window.electron || !window.electron.stopRemoteServer) {
      console.error('Remote server not available in this environment');
      return;
    }

    try {
      const result = await window.electron.stopRemoteServer();
      if (!result.success) {
        console.error('Failed to stop remote server:', result.error);
      }
      // Server stopped event will be received via IPC and update state
    } catch (error) {
      console.error('Error stopping remote server:', error);
    }
  };

  const openPresenterWindow = () => {
    // Close any existing presenter window
    if (presenterWindow) {
      if (presenterWindow.isElectron && window.electron && window.electron.closePresenterWindow) {
        window.electron.closePresenterWindow();
      } else if (!presenterWindow.closed) {
        presenterWindow.close();
      }
    }

    // Close fullscreen mode if open
    setShowFullscreen(false);

    // Reset timer when opening presenter window
    setElapsedTime(0);
    pausedElapsedRef.current = 0;
    timerStartTimestampRef.current = null;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Check if running in Electron
    if (window.electron && window.electron.openPresenterWindow) {
      // Use Electron IPC to open a transparent window
      window.electron.openPresenterWindow();
      // The actual window reference will be managed by Electron's main process
      setPresenterWindow({ closed: false, isElectron: true });
      return;
    }
    
    // Fallback to regular browser popup (non-transparent)
    const newWindow = window.open(
      'about:blank', 
      'PromptlyPresenter', 
      'width=1280,height=720,left=50,top=50,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
    
    if (!newWindow) {
      alert('Unable to open presenter window. Please allow popups for this site.');
      return;
    }
    
    if (newWindow) {
      setPresenterWindow(newWindow);
      
      // Write the HTML structure
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Promptly Presenter</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                overflow: hidden;
                font-family: Arial, sans-serif;
                background: transparent;
              }
              
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
              
              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              
              #presenter-root {
                width: 100vw;
                height: 100vh;
                position: relative;
              }
              
              #presenter-scroll {
                width: 100%;
                height: 100%;
                overflow-y: scroll;
              }
              
              .crosshair-container {
                position: absolute;
                inset: 0;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-center;
                z-index: 50;
              }
              
              .crosshair-h {
                position: absolute;
                width: 32px;
                height: 1px;
                left: 50%;
                top: 50%;
                transform: translateX(-50%);
              }
              
              .crosshair-v {
                position: absolute;
                height: 32px;
                width: 1px;
                left: 50%;
                top: 50%;
                transform: translateY(-50%);
              }
              
              .timer-overlay {
                position: absolute;
                top: 16px;
                left: 16px;
                background: rgba(0, 0, 0, 0.7);
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid #4b5563;
                z-index: 40;
              }
              
              .timer-flex {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 8px;
              }
              
              .timer-section {
                text-align: center;
              }
              
              .timer-label {
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 4px;
              }
              
              .timer-elapsed {
                font-size: 24px;
                font-family: monospace;
                font-weight: bold;
                color: #60a5fa;
              }
              
              .timer-total {
                font-size: 18px;
                font-family: monospace;
                color: #d1d5db;
              }
              
              .timer-divider {
                color: #6b7280;
              }
              
              .progress-bar {
                position: relative;
                height: 6px;
                background: #374151;
                border-radius: 9999px;
                overflow: hidden;
                width: 192px;
              }
              
              .progress-fill {
                position: absolute;
                height: 100%;
                background: #3b82f6;
                transition: width 0.3s;
              }
              
              .speed-indicator {
                font-size: 12px;
                color: #9ca3af;
                margin-top: 8px;
                text-align: center;
              }
              
              .exit-hint {
                position: absolute;
                top: 16px;
                right: 16px;
                color: white;
                font-size: 14px;
                background: rgba(0, 0, 0, 0.5);
                padding: 8px 12px;
                border-radius: 4px;
              }
              
              #window-controls {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 50px;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                z-index: 9999;
                border-bottom: 2px solid #444;
                user-select: none;
              }
              
              #window-controls.hidden {
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
              }
              
              #window-controls:hover {
                opacity: 1 !important;
                pointer-events: all !important;
              }
              
              .window-title {
                color: white;
                font-size: 13px;
                font-weight: 500;
                flex: 1;
              }
              
              .window-buttons {
                display: flex;
                gap: 8px;
              }
              
              .window-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                transition: all 0.2s;
              }
              
              .window-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
              }
              
              .window-btn.close {
                background: rgba(239, 68, 68, 0.8);
                border-color: rgba(239, 68, 68, 1);
              }
              
              .window-btn.close:hover {
                background: rgba(220, 38, 38, 0.9);
              }
              
              .window-btn.fullscreen {
                background: rgba(34, 197, 94, 0.8);
                border-color: rgba(34, 197, 94, 1);
              }
              
              .window-btn.fullscreen:hover {
                background: rgba(22, 163, 74, 0.9);
              }
            </style>
          </head>
          <body>
            <div id="window-controls">
              <div class="window-title">📺 Promptly Presenter Window - Resize/Move window, then press F11 for fullscreen on this monitor</div>
              <div class="window-buttons">
                <button class="window-btn fullscreen" onclick="toggleFullscreen()">⛶ Fullscreen (F11)</button>
                <button class="window-btn close" onclick="window.close()">✕ Close</button>
              </div>
            </div>
            <div id="presenter-root"></div>
            <script>
              // Get references to parent window functions
              let parentWindow = window.opener;
              
              // Fullscreen toggle
              function toggleFullscreen() {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(err => {
                    console.error('Error attempting to enable fullscreen:', err);
                  });
                } else {
                  document.exitFullscreen();
                }
              }
              
              // Hide/show controls based on fullscreen state
              document.addEventListener('fullscreenchange', () => {
                const controls = document.getElementById('window-controls');
                if (document.fullscreenElement) {
                  controls.classList.add('hidden');
                } else {
                  controls.classList.remove('hidden');
                }
              });
              
              // Keyboard shortcuts - match main app functionality
              document.addEventListener('keydown', (e) => {
                // F11 for fullscreen
                if (e.key === 'F11') {
                  e.preventDefault();
                  toggleFullscreen();
                  return;
                }
                
                // ESC to exit fullscreen
                if (e.key === 'Escape' && document.fullscreenElement) {
                  document.exitFullscreen();
                  return;
                }
                
                // Don't process other shortcuts if typing in input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                // Forward keyboard events to parent window for control synchronization
                if (parentWindow && !parentWindow.closed) {
                  try {
                    // Space - Play/Pause (send message to parent)
                    if (e.key === ' ') {
                      e.preventDefault();
                      // Parent window will handle play/pause state
                      return;
                    }
                    
                    // Arrow keys for speed and chapter navigation
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
                        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      // Parent window will handle these
                      return;
                    }
                    
                    // Home to restart
                    if (e.key === 'Home') {
                      e.preventDefault();
                      // Parent window will handle restart
                      return;
                    }
                  } catch (err) {
                    console.error('Error communicating with parent window:', err);
                  }
                }
              });
            </script>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  // Listen for Electron presenter window closed event
  useEffect(() => {
    if (window.electron && window.electron.onPresenterWindowClosed) {
      const unsubscribe = window.electron.onPresenterWindowClosed(() => {
        setPresenterWindow(null);
        presenterWindowScrollRef.current = null;
        // Pause scrolling when presenter window closes
        setIsPlaying(false);
        // Reset fullscreen state when presenter window closes
        setPresenterFullscreen(false);
        // Stop video stream when presenter window closes
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(track => track.stop());
          previewStreamRef.current = null;
        }
      });

      return unsubscribe;
    }
  }, []);

  // Listen for remote server events
  useEffect(() => {
    if (!window.electron) return;

    const unsubscribers = [];

    // Listen for server started
    if (window.electron.onRemoteServerStarted) {
      const unsubscribe = window.electron.onRemoteServerStarted((data) => {
        setRemoteServerActive(true);
        // Support legacy {url} payload as well as new {localUrl, tunnelUrl}
        setRemoteServerUrl(data.localUrl || data.url || '');
        setRemoteTunnelUrl(data.tunnelUrl || '');
      });
      unsubscribers.push(unsubscribe);
    }

    // Listen for the Cloudflare tunnel finishing setup (arrives after server-started)
    if (window.electron.onRemoteTunnelReady) {
      const unsubscribe = window.electron.onRemoteTunnelReady((data) => {
        const url = data?.tunnelUrl || '';
        setRemoteTunnelUrl(url);
        if (url) setTunnelActive(true);
      });
      unsubscribers.push(unsubscribe);
    }

    // Listen for the tunnel being stopped (local server keeps running)
    if (window.electron.onRemoteTunnelStopped) {
      const unsubscribe = window.electron.onRemoteTunnelStopped(() => {
        setTunnelActive(false);
        setRemoteTunnelUrl('');
      });
      unsubscribers.push(unsubscribe);
    }

    // Listen for server stopped (legacy path; the new model never stops the local server)
    if (window.electron.onRemoteServerStopped) {
      const unsubscribe = window.electron.onRemoteServerStopped(() => {
        setRemoteServerActive(false);
        setRemoteServerUrl('');
        setRemoteTunnelUrl('');
        setTunnelActive(false);
      });
      unsubscribers.push(unsubscribe);
    }

    // Listen for remote commands
    if (window.electron.onRemoteCommand) {
      const unsubscribe = window.electron.onRemoteCommand((data) => {
        const command = typeof data === 'string' ? data : data.command;
        const value = typeof data === 'object' ? data.value : undefined;

        console.log('Remote command received:', command, 'value:', value);

        switch (command) {
          case 'play-pause':
            togglePlayPause();
            break;
          case 'speed-up':
            // Use the value from remote if provided, otherwise use local speedIncrement
            const incrementUp = value !== undefined ? value : speedIncrement;
            setScrollSpeed(prev => Math.min(prev + incrementUp, 10));
            break;
          case 'speed-down':
            // Use the value from remote if provided, otherwise use local speedIncrement
            const incrementDown = value !== undefined ? value : speedIncrement;
            setScrollSpeed(prev => Math.max(prev - incrementDown, -10));
            break;
          case 'next-chapter':
            jumpToNextChapter();
            break;
          case 'prev-chapter':
            jumpToPreviousChapter();
            break;
          case 'jump-to-chapter':
            if (value !== undefined && value >= 0 && value < chapterPositions.length) {
              jumpToChapter(value);
            }
            break;
          case 'toggle-countdown':
            // Read via ref — the remote command effect has [] deps so the
            // closure-captured countdownDuration is stuck at the initial value.
            if (countdownDurationRef.current > 0) {
              lastCountdownDurationRef.current = countdownDurationRef.current;
              setCountdownDuration(0);
            } else {
              setCountdownDuration(lastCountdownDurationRef.current || 3);
            }
            break;
          case 'toggle-timer-speed':
            setTimerDisplayMode(prev => prev === 'full' ? 'speed' : prev === 'speed' ? 'hidden' : 'full');
            break;
          case 'speed-adjust': {
            // Tick-based speed adjustment from the Logi dial. Each tick = ±0.1x.
            const ticks = Number(value) || 0;
            setScrollSpeed(prev => Math.min(10, Math.max(-10, prev + ticks * 0.1)));
            break;
          }
          case 'set-speed': {
            const target = Number(value);
            if (Number.isFinite(target)) {
              setScrollSpeed(Math.min(10, Math.max(-10, target)));
            }
            break;
          }
          case 'jog': {
            // Pixel-delta manual scroll — only honored while manual-scroll mode
            // is active. Silently ignored otherwise so the dial roller doesn't
            // override normal playback.
            if (!manualScrollModeRef.current) break;
            const px = Number(value) || 0;
            if (px !== 0 && scrollRef.current) {
              const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
              const next = Math.min(maxScroll, Math.max(0, scrollPositionRef.current + px));
              scrollPositionRef.current = next;
              setScrollPosition(next);
            }
            break;
          }
          case 'open-presenter':
            openPresenterWindow();
            break;
          case 'toggle-fullscreen':
            if (window.electron?.togglePresenterFullscreen) {
              window.electron.togglePresenterFullscreen(!presenterFullscreen);
            }
            break;
          case 'toggle-manual-scroll':
            toggleManualScroll();
            break;
          case 'toggle-spotlight':
            toggleSpotlight();
            break;
          case 'cycle-timer':
            setTimerDisplayMode(prev => prev === 'full' ? 'speed' : prev === 'speed' ? 'hidden' : 'full');
            break;
          case 'reset':
            cancelCountdown();
            scrollPositionRef.current = 0;
            setScrollPosition(0);
            setIsPlaying(false);
            setHasReachedEnd(false);
            setElapsedTime(0);
            pausedElapsedRef.current = 0;
            timerStartTimestampRef.current = null;
            break;
          default:
            console.warn('Unknown remote command:', command);
        }
      });
      unsubscribers.push(unsubscribe);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub());
    };
  }, []);

  // Generate QR code based on the user's QR source preference.
  // 'auto' prefers the cross-network tunnel URL, falling back to LAN.
  // 'local' always uses the LAN URL.
  // 'internet' always uses the tunnel URL (empty if not ready).
  useEffect(() => {
    let preferred = '';
    if (qrSource === 'local') {
      preferred = remoteServerUrl;
    } else if (qrSource === 'internet') {
      preferred = remoteTunnelUrl;
    } else {
      preferred = remoteTunnelUrl || remoteServerUrl;
    }
    if (preferred) {
      QRCode.toDataURL(preferred, { width: 256, margin: 2 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Error generating QR code:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [remoteServerUrl, remoteTunnelUrl, qrSource]);

  // Auto-updater subscriptions
  useEffect(() => {
    if (!window.electron) return;
    const subs = [];
    if (window.electron.onUpdateAvailable) {
      subs.push(window.electron.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setUpdateDownloaded(false);
        setUpdateProgress(null);
        setUpdateDismissed(false);
      }));
    }
    if (window.electron.onUpdateProgress) {
      subs.push(window.electron.onUpdateProgress((p) => {
        setUpdateProgress(typeof p?.percent === 'number' ? p.percent : null);
      }));
    }
    if (window.electron.onUpdateDownloaded) {
      subs.push(window.electron.onUpdateDownloaded((info) => {
        setUpdateDownloaded(true);
        setUpdateProgress(100);
        if (info?.version) setUpdateInfo(prev => prev || info);
      }));
    }
    return () => subs.forEach(unsub => unsub && unsub());
  }, []);

  // Expose settings to remote control interface
  useEffect(() => {
    window.getRemoteSettings = () => {
      return {
        speedIncrement: speedIncrement,
        countdownDuration: countdownDuration,
        timerDisplayMode: timerDisplayMode
      };
    };

    return () => {
      delete window.getRemoteSettings;
    };
  }, [speedIncrement, countdownDuration, timerDisplayMode]);

  // Expose chapters to remote control interface
  useEffect(() => {
    window.getRemoteChapters = () => {
      if (!currentScript || !currentScript.chapters) return [];
      return currentScript.chapters.map(ch => ({
        name: ch.name,
        id: ch.id
      }));
    };

    return () => {
      delete window.getRemoteChapters;
    };
  }, [currentScript]);

  // Expose presenter status to remote control interface
  useEffect(() => {
    window.getPresenterStatus = () => {
      return {
        isOpen: presenterWindow !== null && (!presenterWindow.closed || presenterWindow.isElectron)
      };
    };

    return () => {
      delete window.getPresenterStatus;
    };
  }, [presenterWindow]);

  // Live state for the remote (polled at 1s) — current chapter, speed, playing flag.
  useEffect(() => {
    window.getRemoteState = () => {
      return {
        currentChapterIndex: currentChapterIndex,
        speed: activeScrollSpeed,
        isPlaying: isPlaying
      };
    };
    return () => { delete window.getRemoteState; };
  }, [currentChapterIndex, activeScrollSpeed, isPlaying]);

  // Logi plugin install status (set by electron-main on launch and on reinstall)
  useEffect(() => {
    if (!window.electron?.onLogiPluginStatus) return;
    let cancelled = false;
    window.electron.getLogiPluginStatus?.().then(s => { if (!cancelled && s) setLogiPluginStatus(s); }).catch(() => {});
    const unsub = window.electron.onLogiPluginStatus(s => setLogiPluginStatus(s));
    return () => { cancelled = true; if (unsub) unsub(); };
  }, []);

  // Push state to any connected Logi plugin clients (pushed, not polled).
  useEffect(() => {
    if (!window.electron?.pushPluginState) return;
    window.electron.pushPluginState({
      isPlaying: isPlaying,
      speed: activeScrollSpeed,
      chapterIndex: currentChapterIndex,
      totalChapters: currentScript?.chapters?.length || 0,
      isCountingDown: countdownValue !== null,
      hasReachedEnd: hasReachedEnd
    });
  }, [isPlaying, activeScrollSpeed, currentChapterIndex, currentScript, countdownValue, hasReachedEnd]);


  // Note: previewScrollRef is now updated directly in the animation loop (line 1048-1050)
  // for smooth scrolling without jitter

  // Cleanup presenter window on unmount
  useEffect(() => {
    return () => {
      if (presenterWindow && !presenterWindow.closed && !presenterWindow.isElectron) {
        presenterWindow.close();
      }
    };
  }, [presenterWindow]);

  // Check if presenter window is still open periodically
  useEffect(() => {
    if (!presenterWindow) return;

    const checkInterval = setInterval(() => {
      if (presenterWindow.closed) {
        setPresenterWindow(null);
        presenterWindowScrollRef.current = null;
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [presenterWindow]);

  // Update presenter window content when it exists
	useEffect(() => {
	  if (!presenterWindow) return;
	  
	  // Handle Electron presenter window
	  if (presenterWindow.isElectron) {
		if (window.electron && window.electron.updatePresenterContent) {
		  window.electron.updatePresenterContent({
			chapters: currentScript?.chapters || [],
			fontSize,
			fontColor,
			bgColor,
			lineHeight,
			horizontalMargin,
			leadInMargin,
			chapterSpacing,
			crosshairColor,
			crosshairLength,
			crosshairThickness,
			timerDisplayMode,
			timerCorner,
			presenterWidth: presenterWindowDimensions.width,
			presenterHeight: presenterWindowDimensions.height,
			scrollProgress: scrollProgress,
			scrollSpeed: activeScrollSpeed,
			elapsedTime: elapsedTime,
			estimatedDuration: estimatedDuration
		  });
		}
		return;  // ← MAKE SURE THIS RETURN IS HERE
	  }
	  
	  // Only run browser code if NOT Electron
	  if (!presenterWindow.document) return;  // ← ADD THIS SAFETY CHECK
	  if (presenterWindow.closed) {
		setPresenterWindow(null);
		presenterWindowScrollRef.current = null;
		return;
	  }

	  const updatePresenterContent = () => {
		const presenterRoot = presenterWindow.document.getElementById('presenter-root');
		if (!presenterRoot) return;

      presenterRoot.innerHTML = `
        <div style="width: 100%; height: 100%; background-color: ${bgColor}; position: relative;">
          <div id="presenter-scroll" class="scrollbar-hide" style="
            height: 100%;
            overflow-y: scroll;
            padding-left: ${horizontalMargin}%;
            padding-right: ${horizontalMargin}%;
            padding-top: 50vh; /* Half height to reach center */
            padding-bottom: 50vh; /* Half height so last line reaches center */
          ">
            ${currentScript?.chapters.map((chapter, index) => `
              <div style="margin-bottom: ${fontSize * lineHeight * chapterSpacing}px;">
                ${chapter.showTitle ? `
                  <div style="
                    font-size: ${fontSize * 1.5}px;
                    color: ${fontColor};
                    font-weight: bold;
                    line-height: ${lineHeight};
                    font-family: Arial, sans-serif;
                    margin-bottom: ${fontSize * lineHeight}px;
                  ">
                    ${chapter.name}
                  </div>
                ` : ''}
                <div style="
                  font-size: ${fontSize}px;
                  color: ${fontColor};
                  line-height: ${lineHeight};
                  font-family: Arial, sans-serif;
                ">
                  ${chapter.content.replace(/font-size:\s*0\.8em/g, `font-size: ${fontSize * 0.8}px`)}
                </div>
              </div>
            `).join('')}
          </div>
          
          <!-- Crosshair -->
          <div class="crosshair-container">
            <div>
              <div class="crosshair-h" style="background-color: ${crosshairColor};"></div>
              <div class="crosshair-v" style="background-color: ${crosshairColor};"></div>
            </div>
          </div>
          
          <!-- Timer overlay -->
          <div class="timer-overlay">
            <div class="timer-flex">
              <div class="timer-section">
                <div class="timer-label">Elapsed</div>
                <div class="timer-elapsed" id="elapsed-time">${formatTime(elapsedTime)}</div>
              </div>
              <div class="timer-divider">/</div>
              <div class="timer-section">
                <div class="timer-label">Est. Total</div>
                <div class="timer-total" id="total-time">${formatTime(estimatedDuration)}</div>
              </div>
            </div>
            
            <div class="progress-bar">
              <div class="progress-fill" id="progress-bar" style="width: ${estimatedDuration > 0 ? Math.min((elapsedTime / estimatedDuration) * 100, 100) : 0}%;"></div>
            </div>
            
            <div class="speed-indicator">
              Speed: <span id="speed-display">${scrollSpeed.toFixed(1)}</span>x
            </div>
          </div>
          
          <div class="exit-hint">
            Close window to exit presenter view
          </div>
        </div>
      `;

      // Get reference to scroll element
      const scrollEl = presenterWindow.document.getElementById('presenter-scroll');
      if (scrollEl) {
        presenterWindowScrollRef.current = scrollEl;
        // Sync scroll position
        scrollEl.scrollTop = scrollPosition;
      }
    };

    updatePresenterContent();
  }, [presenterWindow, currentScript, fontSize, fontColor, bgColor, lineHeight,
      horizontalMargin, leadInMargin, chapterSpacing, crosshairColor, crosshairLength,
      crosshairThickness, timerDisplayMode, timerCorner]);
      // NOTE: scrollProgress, scrollSpeed, activeScrollSpeed, elapsedTime, estimatedDuration
      // intentionally NOT in deps — those fast-changing values are pushed via the
      // lightweight update-presenter-timer IPC below so we don't rebuild the
      // chapter HTML on every dial tick.

  // Lightweight timer/speed/progress push to the presenter window.
  useEffect(() => {
    if (!presenterWindow || presenterWindow.closed) return;
    if (!presenterWindow.isElectron) return; // browser-mode handled by the next useEffect
    if (!window.electron?.updatePresenterTimer) return;
    window.electron.updatePresenterTimer({
      scrollProgress,
      scrollSpeed: activeScrollSpeed,
      elapsedTime,
      estimatedDuration
    });
  }, [presenterWindow, scrollProgress, activeScrollSpeed, elapsedTime, estimatedDuration]);

  // Update timer in presenter window
  useEffect(() => {
    if (!presenterWindow || presenterWindow.closed || presenterWindow.isElectron) return;

    const presenterWindowDoc = presenterWindow.document;
    if (!presenterWindowDoc) return;

    const elapsedEl = presenterWindowDoc.getElementById('elapsed-time');
    const totalEl = presenterWindowDoc.getElementById('total-time');
    const progressEl = presenterWindowDoc.getElementById('progress-bar');
    const speedEl = presenterWindowDoc.getElementById('speed-display');

    if (elapsedEl) elapsedEl.textContent = formatTime(elapsedTime);
    if (totalEl) totalEl.textContent = formatTime(estimatedDuration);
    if (progressEl) {
      progressEl.style.width = `${estimatedDuration > 0 ? Math.min((elapsedTime / estimatedDuration) * 100, 100) : 0}%`;
    }
    if (speedEl) speedEl.textContent = scrollSpeed.toFixed(1);
  }, [presenterWindow, elapsedTime, estimatedDuration, scrollSpeed]);

  const handleGripMouseDown = (chapterId) => {
    setCanDrag(chapterId);
  };

  const handleDragStart = (e, chapterId) => {
    if (canDrag !== chapterId) {
      e.preventDefault();
      return;
    }
    
    setDraggedChapter(chapterId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e) => {
    setDraggedChapter(null);
    setDragOverChapter(null);
    setDragOverIndex(null);
    setCanDrag(false);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedChapter !== null) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedChapter === null || !currentScript) return;

    const chapters = [...currentScript.chapters];
    const draggedIndex = chapters.findIndex(c => c.id === draggedChapter);
    
    if (draggedIndex === -1) return;

    const [removed] = chapters.splice(draggedIndex, 1);
    
    let adjustedDropIndex = dropIndex;
    if (draggedIndex < dropIndex) {
      adjustedDropIndex--;
    }
    
    chapters.splice(adjustedDropIndex, 0, removed);
    
    setScripts(prev => prev.map(s => 
      s.id === currentScriptId 
        ? { ...s, chapters }
        : s
    ));
    
    setDraggedChapter(null);
    setDragOverChapter(null);
    setDragOverIndex(null);
    setCanDrag(false);
  };

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isResizingPreview) {
        const containerWidth = window.innerWidth - sidebarWidth;
        const previewX = e.clientX - sidebarWidth;
        const editorPercent = Math.max(50, Math.min(80, (previewX / containerWidth) * 100));
        setPreviewWidth(editorPercent);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingPreview(false);
    };

    if (isResizingSidebar || isResizingPreview) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingSidebar, isResizingPreview, sidebarWidth]);

  // PrompterContent must keep a stable identity across renders. Defining a new
  // React.memo wrapper on every App render makes React see a "different
  // component type" each time → it unmounts/remounts the subtree → the DOM
  // (and its scrollTop) is destroyed and rebuilt. That manifests as the
  // preview briefly jumping to position 0 whenever App re-renders rapidly
  // (e.g. while the Logi dial is sending dozens of speed-adjust ticks/sec).
  //
  // useMemo with the display-affecting deps keeps the identity stable through
  // dial spins (scrollSpeed isn't in the deps), and re-creates the component
  // only when the visual layout/content actually needs to change.
  const PrompterContent = useMemo(() => React.memo(({ scrollRefProp, scale = 1, isPreview = false }) => {
    // For preview, restore scroll position when component renders/re-renders
    // This prevents the snap-to-start issue when playback is paused
    useEffect(() => {
      if (isPreview && scrollRefProp.current && scrollPositionRef.current !== undefined) {
        scrollRefProp.current.scrollTop = scrollPositionRef.current;
      }
    });

    // Calculate padding in pixels based on presenter window dimensions for consistency
    const getPreviewPadding = () => {
      // For containers that match presenter dimensions, use pixel values
      // so padding is identical regardless of where the container is rendered
      const halfHeight = presenterWindowDimensions.height / 2;
      const leadInPx = (leadInMargin / 100) * presenterWindowDimensions.height;

      // Top padding = half height (to reach center) + leadInMargin (to position below center)
      // This makes ALL chapters start leadInMargin distance below the crosshair
      const paddingTopPx = halfHeight + leadInPx;

      // Bottom padding = more than half height so last line scrolls past the crosshair
      const paddingBottomPx = halfHeight + (fontSize * lineHeight * 5); // Extra 5 lines of space

      const paddingLeftPx = (horizontalMargin / 100) * presenterWindowDimensions.width;
      const paddingRightPx = (horizontalMargin / 100) * presenterWindowDimensions.width;

      return {
        paddingLeft: `${paddingLeftPx}px`,
        paddingRight: `${paddingRightPx}px`,
        paddingTop: `${paddingTopPx}px`,
        paddingBottom: `${paddingBottomPx}px`,
      };
    };

    return (
        <div
          ref={scrollRefProp}
          className="overflow-y-scroll scrollbar-hide prompter-content"
          style={{
            height: isPreview ? `${presenterWindowDimensions.height}px` : '100%',
            width: isPreview ? `${presenterWindowDimensions.width}px` : '100%',
            ...getPreviewPadding(),
          }}
        >
      {currentScript?.chapters.map((chapter, index) => (
        <div key={chapter.id} data-chapter-index={index} id={`chapter-${index}`} style={{ marginBottom: `${fontSize * lineHeight * chapterSpacing}px` }}>
          {chapter.showTitle && (
            <div
              style={{
                fontSize: `${fontSize * 1.5 * scale}px`,
                color: fontColor,
                fontWeight: 'bold',
                lineHeight: lineHeight,
                fontFamily: 'Arial, sans-serif',
                marginBottom: `${fontSize * lineHeight * scale}px`
              }}
            >
              {chapter.name}
            </div>
          )}
          <div
            className="prompter-content"
            style={{
              fontSize: `${fontSize * scale}px`,
              color: fontColor,
              lineHeight: lineHeight,
              fontFamily: 'Arial, sans-serif',
            }}
            dangerouslySetInnerHTML={{
              __html: chapter.content
                .replace(/font-size:\s*0\.8em/g, `font-size: ${fontSize * 0.8 * scale}px`)
                .replace(/background-color:\s*[^;]+;?/gi, '')
                .replace(/background:\s*[^;]+;?/gi, '')
                .replace(/<mark[^>]*>/gi, '')
                .replace(/<\/mark>/gi, '')
            }}
          />
        </div>
      ))}
        </div>
    );
  }), [currentScript, fontSize, fontColor, lineHeight, chapterSpacing, horizontalMargin, leadInMargin, presenterWindowDimensions]);

  // Operator Preview - 1:1 scaled replica of presenter window content
  const renderOperatorPreview = () => {
    // Check if presenter window is open
    const isPresenterOpen = presenterWindow && !presenterWindow.closed;

    if (!isPresenterOpen) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Monitor size={48} className="mx-auto mb-2 opacity-50" />
            <div>Presenter window not open</div>
          </div>
        </div>
      );
    }

    // Calculate scale to fit actual presenter window content into preview area
    // Use real presenter window dimensions for true 1:1 representation
    const presenterWidth = presenterWindowDimensions.width;
    const presenterHeight = presenterWindowDimensions.height;

    // Calculate responsive scale to fit operator panel width (with 20px padding)
    const availableWidth = operatorPanelWidth - 40; // Leave 20px padding on each side
    const scaleByWidth = availableWidth / presenterWidth;
    const previewScale = Math.min(scaleByWidth, 1.0); // Never scale above 100%

    // Handle mouse move for spotlight mode
    const handleSpotlightMove = (e) => {
      if (!spotlightMode) return;

      const wrapper = e.currentTarget;
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Mirror the presenter's red circle on the operator preview (in scaled-preview coords)
      if (operatorSpotlightCircleRef.current) {
        operatorSpotlightCircleRef.current.style.display = 'block';
        operatorSpotlightCircleRef.current.style.left = x + 'px';
        operatorSpotlightCircleRef.current.style.top = y + 'px';
      }

      // Send spotlight position to presenter window in presenter-coordinate space
      if (window.electron?.updatePresenterSpotlight) {
        const actualX = x / previewScale;
        const actualY = y / previewScale;
        window.electron.updatePresenterSpotlight({ x: actualX, y: actualY });
      }
    };

    // Handle mouse leave to hide spotlight
    const handleSpotlightLeave = () => {
      if (operatorSpotlightCircleRef.current) {
        operatorSpotlightCircleRef.current.style.display = 'none';
      }
      if (spotlightMode && window.electron?.updatePresenterSpotlight) {
        window.electron.updatePresenterSpotlight(null);
      }
    };

    const operatorCircleDiameter = 80 * previewScale;

    return (
      <div
        ref={operatorPanelRef}
        className="h-full w-full flex items-center justify-center bg-gray-700"
        style={{
          cursor: manualScrollMode ? 'ns-resize' : (spotlightMode ? 'crosshair' : 'default')
        }}
        onWheel={manualScrollMode ? (e) => {
          e.preventDefault();
          handleManualScroll(e.deltaY);
        } : undefined}
      >
        {/* Stacked active-mode indicators (presenter is open when these can be true) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
          {manualScrollMode && (
            <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
              SCROLL MODE (J to exit)
            </div>
          )}
          {spotlightMode && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              SPOTLIGHT MODE (S to exit)
            </div>
          )}
        </div>
        {/* Wrapper that constrains to scaled dimensions */}
        <div
          style={{
            width: `${presenterWidth * previewScale}px`,
            height: `${presenterHeight * previewScale}px`,
            position: 'relative',
            overflow: 'hidden',
            border: manualScrollMode ? '2px solid #eab308' : (spotlightMode ? '2px solid #ef4444' : 'none')
          }}
          onMouseMove={spotlightMode ? handleSpotlightMove : undefined}
          onMouseLeave={spotlightMode ? handleSpotlightLeave : undefined}
        >
          {/* Operator-side spotlight circle (mirrors presenter, scaled to preview) */}
          {spotlightMode && (
            <div
              ref={operatorSpotlightCircleRef}
              style={{
                position: 'absolute',
                width: `${operatorCircleDiameter}px`,
                height: `${operatorCircleDiameter}px`,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.5)',
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
                display: 'none'
              }}
            />
          )}
          {/* Inner container at full size, then scaled */}
          <div
            style={{
              width: `${presenterWidth}px`,
              height: `${presenterHeight}px`,
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundColor: bgColor,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left'
            }}
          >
            {/* Render the same content as presenter window */}
            <PrompterContent scrollRefProp={previewScrollRef} isPreview={true} />

            {/* Crosshair - always shown */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ backgroundColor: crosshairColor, width: `${crosshairLength}px`, height: `${crosshairThickness}px` }}
                ></div>
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ backgroundColor: crosshairColor, width: `${crosshairThickness}px`, height: `${crosshairLength}px` }}
                ></div>
              </div>
            </div>
            {/* Countdown overlay (operator preview) */}
            {countdownValue !== null && (
              <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                <div
                  style={{
                    fontSize: `${presenterHeight * 0.25}px`,
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: '0 0 20px rgba(0,0,0,0.6)',
                    fontWeight: 700,
                    lineHeight: 1,
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  {countdownValue}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const FullscreenView = () => {
    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: bgColor }}>
        <PrompterContent
          scrollRefProp={scrollRef}
        />

      {/* Center crosshair */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ backgroundColor: crosshairColor, width: `${crosshairLength}px`, height: `${crosshairThickness}px` }}
          ></div>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ backgroundColor: crosshairColor, width: `${crosshairThickness}px`, height: `${crosshairLength}px` }}
          ></div>
        </div>
      </div>

      {/* Timer overlay - top left */}
      <div className="absolute top-4 left-4 bg-black/70 px-4 py-3 rounded-lg border border-gray-600">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Progress</div>
            <div className="text-2xl font-mono font-bold text-blue-400">
              {Math.round(scrollProgress)}%
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden w-48">
          <div
            className="absolute h-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${scrollProgress}%`
            }}
          />
        </div>
        
        {/* Speed indicator */}
        <div className="text-xs text-gray-400 mt-2 text-center">
          Speed: {scrollSpeed.toFixed(1)}x
        </div>
      </div>

      <div className="absolute top-4 right-4 text-white text-sm bg-black/50 px-3 py-2 rounded">
        Press ESC to exit fullscreen
      </div>
    </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Restore default list styles inside ContentEditable + prompter output — Tailwind preflight strips them */}
      <style>{`
        [id^="chapter-content-"] ul, .prompter-content ul, .prompter-content-presenter ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        [id^="chapter-content-"] ol, .prompter-content ol, .prompter-content-presenter ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        [id^="chapter-content-"] li, .prompter-content li, .prompter-content-presenter li { margin: 0.2em 0; }
      `}</style>
      {/* Sidebar */}
      {sidebarCollapsed ? (
        <div className="bg-gray-800 border-r border-gray-700 flex flex-col items-center py-3" style={{ width: '40px' }}>
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="p-2 hover:bg-gray-700 rounded"
            title="Show script list"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : (
      <div className="bg-gray-800 border-r border-gray-700 flex flex-col relative" style={{ width: `${sidebarWidth}px` }}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4 gap-2">
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1 hover:bg-gray-700 rounded"
              title="Hide script list"
            >
              <ChevronLeft size={16} />
            </button>
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-400">● Unsaved</span>
            )}
          </div>

          {/* Main actions */}
          <div className="space-y-2">
            <button
              onClick={addNewScript}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              New Script
            </button>

            {/* Save/Load buttons */}
            {window.electron && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={saveCurrentScript}
                  disabled={isSaving || !currentFilePath}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center justify-center gap-1 text-sm"
                  title="Save (Ctrl+S)"
                >
                  <Download size={14} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={saveCurrentScriptAs}
                  disabled={isSaving}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded flex items-center justify-center gap-1 text-sm"
                  title="Save As..."
                >
                  <Download size={14} />
                  Save As
                </button>
              </div>
            )}

            {window.electron && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openScriptFile}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded flex items-center justify-center gap-1 text-sm"
                  title="Open .teleprompter file"
                >
                  <Upload size={14} />
                  Open
                </button>
                <button
                  onClick={importFromFile}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center gap-1 text-sm"
                  title="Import from .txt, .docx, or .pdf"
                >
                  <FileText size={14} />
                  Import
                </button>
              </div>
            )}

            {window.electron && (
              <div className="mt-2 text-xs text-gray-400 text-center">
                Or drag files here
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {scripts.map(script => (
            <div
              key={script.id}
              className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
                currentScriptId === script.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              onClick={() => setCurrentScriptId(script.id)}
            >
              <div className="flex items-start gap-2">
                {editingScriptId === script.id ? (
                  <div className="flex-1 script-edit-container" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={script.name}
                      onChange={(e) => updateScript(script.id, 'name', e.target.value)}
                      onBlur={(e) => {
                        // Only close if not moving to the description field
                        setTimeout(() => {
                          const activeEl = document.activeElement;
                          const isStillEditing = activeEl && activeEl.closest('.script-edit-container');
                          if (!isStillEditing) {
                            setEditingScriptId(null);
                          }
                        }, 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // Move to description field
                          const descInput = e.target.parentElement.querySelector('input[placeholder="Description..."]');
                          if (descInput) descInput.focus();
                        }
                      }}
                      autoFocus
                      className="w-full bg-gray-900 px-2 py-1 rounded mb-1 outline-none text-white"
                    />
                    <input
                      type="text"
                      value={script.description}
                      onChange={(e) => updateScript(script.id, 'description', e.target.value)}
                      onBlur={(e) => {
                        // Only close if not moving to the name field
                        setTimeout(() => {
                          const activeEl = document.activeElement;
                          const isStillEditing = activeEl && activeEl.closest('.script-edit-container');
                          if (!isStillEditing) {
                            setEditingScriptId(null);
                          }
                        }, 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setEditingScriptId(null);
                        }
                      }}
                      className="w-full bg-gray-900 px-2 py-1 rounded text-sm text-gray-300 outline-none"
                      placeholder="Description..."
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{script.name}</div>
                      {scriptFilePaths[script.id] && (
                        <span className="text-xs text-green-400" title={scriptFilePaths[script.id]}>💾</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300">{script.description}</div>
                  </div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingScriptId(script.id);
                    }}
                    className="text-gray-400 hover:text-white"
                    title="Edit name and description"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportAsApplet(script);
                    }}
                    className="text-gray-400 hover:text-green-400"
                    title="Export as portable applet"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportAsPDF(script);
                    }}
                    className="text-gray-400 hover:text-blue-400"
                    title="Export as PDF"
                  >
                    <FileDown size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeScript(script.id);
                    }}
                    className="text-gray-400 hover:text-red-400"
                    title="Close script (doesn't delete file)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteScript(script.id);
                }}
                className="text-xs text-red-400 hover:text-red-300 mt-2"
              >
                Delete Script Permanently
              </button>
            </div>
          ))}
        </div>

        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
          onMouseDown={() => setIsResizingSidebar(true)}
        />
      </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor Side */}
        <div className="flex flex-col border-r border-gray-700 relative" style={{ width: `${previewWidth}%` }}>
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4 max-w-4xl">
              {currentScript?.chapters.map((chapter, index) => (
                <React.Fragment key={chapter.id}>
                  {/* Drop zone before */}
                  {dragOverIndex === index && draggedChapter !== chapter.id && (
                    <div 
                      className="h-1 bg-blue-500 rounded-full mx-4"
                      style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
                    />
                  )}
                  
                  <div
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, chapter.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`bg-gray-800 rounded-lg p-4 border-2 ${
                      draggedChapter === chapter.id ? 'border-blue-500 opacity-50' : 'border-gray-700'
                    }`}
                  >
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      onMouseDown={() => handleGripMouseDown(chapter.id)}
                      className="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-white p-1 hover:bg-gray-600 rounded transition-colors"
                      title="Drag to reorder"
                    >
                      <GripVertical size={20} />
                    </div>
                    <input
                      type="text"
                      value={chapter.name}
                      onChange={(e) => updateChapter(chapter.id, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-gray-700 px-3 py-2 rounded font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      placeholder="Chapter name"
                    />
                    
                    {/* Custom Speed Control */}
                    <div className="relative group">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (chapter.customSpeed === null || chapter.customSpeed === undefined) {
                            // Just open picker with temporary value, don't commit yet
                            setTempChapterSpeed({ chapterId: chapter.id, speed: scrollSpeed });
                            setShowSpeedPicker(chapter.id);
                          } else {
                            // Toggle picker if already has custom speed
                            setShowSpeedPicker(showSpeedPicker === chapter.id ? null : chapter.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          // Right-click to disable custom speed
                          e.preventDefault();
                          e.stopPropagation();
                          updateChapter(chapter.id, 'customSpeed', null);
                          setShowSpeedPicker(null);
                          setTempChapterSpeed(null);
                        }}
                        className={`p-2 flex items-center gap-1 rounded transition-colors picker-button ${
                          chapter.customSpeed !== null && chapter.customSpeed !== undefined
                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                            : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                        }`}
                        title={chapter.customSpeed !== null && chapter.customSpeed !== undefined 
                          ? `Custom speed: ${chapter.customSpeed.toFixed(1)}x (right-click to use master speed)` 
                          : 'Click to set custom speed for this chapter'}
                      >
                        <Timer size={16} />
                        {chapter.customSpeed !== null && chapter.customSpeed !== undefined && (
                          <span className="text-xs font-bold">{chapter.customSpeed.toFixed(1)}x</span>
                        )}
                      </button>
                      
                      {/* Speed adjustment popup */}
                      {showSpeedPicker === chapter.id && (
                        <div className="speed-picker-panel absolute top-full right-0 mt-1 bg-gray-800 border-2 border-orange-500 rounded-lg p-4 shadow-xl z-50"
                             style={{ width: '260px' }}
                             onClick={(e) => e.stopPropagation()}>
                          <div className="text-xs text-gray-400 mb-2">Chapter Speed</div>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={
                              chapter.customSpeed !== null && chapter.customSpeed !== undefined
                                ? chapter.customSpeed
                                : tempChapterSpeed?.chapterId === chapter.id 
                                  ? tempChapterSpeed.speed 
                                  : scrollSpeed
                            }
                            onChange={(e) => {
                              const newSpeed = Number(e.target.value);
                              if (chapter.customSpeed === null || chapter.customSpeed === undefined) {
                                // First adjustment - activate custom speed
                                updateChapter(chapter.id, 'customSpeed', newSpeed);
                                setTempChapterSpeed(null);
                              } else {
                                // Already has custom speed, just update it
                                updateChapter(chapter.id, 'customSpeed', newSpeed);
                              }
                            }}
                            className="w-full"
                          />
                          <div className="text-sm text-center mt-2 font-bold text-orange-400">
                            {chapter.customSpeed !== null && chapter.customSpeed !== undefined
                              ? chapter.customSpeed.toFixed(1)
                              : tempChapterSpeed?.chapterId === chapter.id 
                                ? tempChapterSpeed.speed.toFixed(1)
                                : scrollSpeed.toFixed(1)}x
                          </div>
                          <div className="text-xs text-gray-400 text-center mt-1 mb-3">
                            Master: {scrollSpeed.toFixed(1)}x
                          </div>
                          
                          {/* Remove custom speed button - only show if custom speed is active */}
                          {chapter.customSpeed !== null && chapter.customSpeed !== undefined && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateChapter(chapter.id, 'customSpeed', null);
                                setShowSpeedPicker(null);
                                setTempChapterSpeed(null);
                              }}
                              className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                              title="Remove custom speed and use master speed"
                            >
                              <Trash2 size={18} />
                              <span>Use Master Speed</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChapterTitle(chapter.id);
                      }}
                      className={`p-2 ${chapter.showTitle ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500 hover:text-gray-400'}`}
                      title={chapter.showTitle ? 'Hide chapter title' : 'Show chapter title'}
                    >
                      {chapter.showTitle ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChapter(chapter.id);
                      }}
                      className="text-red-400 hover:text-red-300 p-2"
                      title="Delete chapter"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {/* Rich Text Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-gray-700 rounded relative">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(chapter.id, 'bold');
                      }}
                      className={`p-2 hover:bg-gray-600 rounded transition-colors ${
                        activeFormats[chapter.id]?.bold ? 'bg-blue-600 text-white' : ''
                      }`}
                      title="Bold (Ctrl+B)"
                      type="button"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(chapter.id, 'italic');
                      }}
                      className={`p-2 hover:bg-gray-600 rounded transition-colors ${
                        activeFormats[chapter.id]?.italic ? 'bg-blue-600 text-white' : ''
                      }`}
                      title="Italic (Ctrl+I)"
                      type="button"
                    >
                      <Italic size={16} />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(chapter.id, 'underline');
                      }}
                      className={`p-2 hover:bg-gray-600 rounded transition-colors ${
                        activeFormats[chapter.id]?.underline ? 'bg-blue-600 text-white' : ''
                      }`}
                      title="Underline (Ctrl+U)"
                      type="button"
                    >
                      <Underline size={16} />
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(chapter.id, 'unorderedList');
                      }}
                      className={`p-2 hover:bg-gray-600 rounded transition-colors ${
                        activeFormats[chapter.id]?.unorderedList ? 'bg-blue-600 text-white' : ''
                      }`}
                      title="Bullet list"
                      type="button"
                    >
                      <List size={16} />
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(chapter.id, 'orderedList');
                      }}
                      className={`p-2 hover:bg-gray-600 rounded transition-colors ${
                        activeFormats[chapter.id]?.orderedList ? 'bg-blue-600 text-white' : ''
                      }`}
                      title="Numbered list"
                      type="button"
                    >
                      <ListOrdered size={16} />
                    </button>

                    <div className="w-px h-6 bg-gray-600"></div>
                    
                    <div className="relative">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const next = showColorPicker === chapter.id ? null : chapter.id;
                          setShowEmojiPicker(null);
                          setShowSpeedPicker(null);
                          setShowColorPicker(next);
                        }}
                        className="p-2 hover:bg-gray-600 rounded flex items-center gap-1 picker-button"
                        title="Text color"
                        type="button"
                      >
                        <Palette size={16} />
                      </button>
                      
                      {showColorPicker === chapter.id && (
                        <div className="color-picker-panel absolute top-full left-0 mt-1 bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl z-50">
                          <div className="text-xs text-gray-400 mb-3">Quick Colors</div>
                          <div className="grid grid-cols-4 gap-3 mb-4">
                            {colorPalette.map(color => (
                              <button
                                key={color}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  applyColor(chapter.id, color);
                                }}
                                className="w-12 h-12 rounded-lg border-2 border-gray-600 hover:border-white hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                title={color}
                                type="button"
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-3 pt-3 border-t border-gray-600">
                            <div className="text-xs text-gray-400">Custom:</div>
                            <input
                              type="color"
                              value={textColor}
                              onChange={(e) => setTextColor(e.target.value)}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-600"
                            />
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applyColor(chapter.id, textColor);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm flex-1"
                              type="button"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-px h-6 bg-gray-600"></div>
                    
                    <div className="relative">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const next = showEmojiPicker === chapter.id ? null : chapter.id;
                          setShowColorPicker(null);
                          setShowSpeedPicker(null);
                          setShowEmojiPicker(next);
                        }}
                        className="px-3 py-2 hover:bg-gray-600 rounded text-sm flex items-center gap-1 picker-button"
                        title="Insert emoji"
                        type="button"
                      >
                        😀 Emoji
                      </button>
                      
                      {showEmojiPicker === chapter.id && (
                        <div className="emoji-picker-panel absolute top-full left-0 mt-1 bg-gray-800 border-2 border-gray-600 rounded-lg p-3 shadow-xl z-50 max-h-96 overflow-y-auto" style={{ width: '320px' }}>
                          <div className="text-xs text-gray-400 mb-3">Click to insert</div>
                          <div className="grid grid-cols-8 gap-2">
                            {commonEmojis.map((emoji, idx) => (
                              <button
                                key={idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  insertEmoji(chapter.id, emoji);
                                }}
                                className="w-9 h-9 hover:bg-gray-600 rounded text-xl flex items-center justify-center hover:scale-125 transition-transform"
                                type="button"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-px h-6 bg-gray-600"></div>
                    
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        splitChapterAtCursor(chapter.id);
                      }}
                      className="px-3 py-2 hover:bg-gray-600 rounded text-sm flex items-center gap-2 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/50"
                      title="Split chapter at cursor - moves remaining text to new chapter"
                      type="button"
                    >
                      <Scissors size={16} />
                      Split Chapter
                    </button>
                  </div>
                  
                  <div
                    id={`chapter-content-${chapter.id}`}
                    contentEditable
                    suppressContentEditableWarning
                    onPaste={(e) => handlePaste(e, chapter.id)}
                    onInput={(e) => {
                      // Don't update state immediately to prevent cursor reset
                      // Just store the content in a data attribute temporarily
                      e.currentTarget.setAttribute('data-pending-content', e.currentTarget.innerHTML);
                    }}
                    onBlur={(e) => {
                      // Update state when user leaves the field
                      const pendingContent = e.currentTarget.getAttribute('data-pending-content');
                      if (pendingContent) {
                        updateChapter(chapter.id, 'content', pendingContent);
                        e.currentTarget.removeAttribute('data-pending-content');
                      }
                    }}
                    onMouseUp={(e) => {
                      // Only save if we're not clicking a button
                      if (e.target.closest('button')) return;
                      saveSelection(chapter.id);
                      checkActiveFormats(chapter.id);
                    }}
                    onKeyDown={(e) => {
                      // Pressing Enter on an empty list item exits the list
                      // (the user typically presses Enter twice — first creates
                      // an empty <li>, second exits via this branch).
                      if (e.key === 'Enter' && !e.shiftKey) {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount) {
                          const node = sel.getRangeAt(0).startContainer;
                          const el = node.nodeType === 1 ? node : node.parentElement;
                          const li = el?.closest('li');
                          if (li && li.textContent.trim() === '') {
                            e.preventDefault();
                            // Outdent twice — once removes the empty <li>, once exits the list
                            document.execCommand('outdent', false, null);
                            setTimeout(() => {
                              updateChapter(chapter.id, 'content', e.currentTarget.innerHTML);
                              checkActiveFormats(chapter.id);
                            }, 0);
                          }
                        }
                      }
                    }}
                    onKeyUp={(e) => {
                      // Save on arrow keys and other navigation
                      saveSelection(chapter.id);
                      checkActiveFormats(chapter.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-gray-700 text-white p-3 rounded outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] overflow-auto"
                    key={`chapter-${chapter.id}`}
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      lineHeight: '1.6'
                    }}
                  >
                    {/* Content is set via ref below to avoid cursor reset */}
                  </div>
                </div>

                {/* Drop zone after last */}
                {index === currentScript.chapters.length - 1 && dragOverIndex === index + 1 && (
                  <div 
                    className="h-1 bg-blue-500 rounded-full mx-4"
                    style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
                    onDragOver={(e) => handleDragOver(e, index + 1)}
                    onDrop={(e) => handleDrop(e, index + 1)}
                  />
                )}
              </React.Fragment>
              ))}
              
              <button
                onClick={addChapter}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center gap-2 border-2 border-dashed border-gray-600"
              >
                <Plus size={20} />
                Add Chapter
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            {/* Tab-style buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSettings(!showSettings); setShowKeyboardShortcuts(false); setShowRemote(false); }}
                className={`flex-1 px-6 py-3 flex items-center justify-center gap-2 transition-colors ${
                  showSettings
                    ? 'bg-gray-700 rounded-t-lg'
                    : 'bg-gray-800 hover:bg-gray-700 rounded-lg mb-3'
                }`}
              >
                <Settings size={20} />
                Settings
                {showSettings ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <button
                onClick={() => { setShowKeyboardShortcuts(!showKeyboardShortcuts); setShowSettings(false); setShowRemote(false); }}
                className={`flex-1 px-6 py-3 flex items-center justify-center gap-2 transition-colors ${
                  showKeyboardShortcuts
                    ? 'bg-gray-700 rounded-t-lg'
                    : 'bg-gray-800 hover:bg-gray-700 rounded-lg mb-3'
                }`}
              >
                <Settings size={20} />
                Keyboard
                {showKeyboardShortcuts ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <button
                onClick={() => { setShowRemote(!showRemote); setShowSettings(false); setShowKeyboardShortcuts(false); }}
                className={`flex-1 px-6 py-3 flex items-center justify-center gap-2 transition-colors ${
                  showRemote
                    ? 'bg-gray-700 rounded-t-lg'
                    : 'bg-gray-800 hover:bg-gray-700 rounded-lg mb-3'
                }`}
              >
                <Monitor size={20} />
                Remote
                {showRemote ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>

            {showSettings && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-700 rounded-b-lg rounded-tr-lg mb-4 overflow-y-auto max-h-[60vh]">
                {/* Timer & Speed Settings */}
                <div className="col-span-3 border-b border-gray-600 pb-4 mb-2">
                  <h3 className="font-bold text-sm mb-3 text-blue-400 flex items-center gap-2">
                    <Clock size={16} />
                    Timer & Speed Controls
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2">Master Scroll Speed: {scrollSpeed < 0 ? `◀ ${Math.abs(scrollSpeed).toFixed(1)}x` : `${scrollSpeed.toFixed(1)}x`}</label>
                      <input
                        type="range"
                        min="-10"
                        max="10"
                        step="0.1"
                        value={scrollSpeed}
                        onChange={(e) => setScrollSpeed(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-400 mt-1">0.1x increments. Negative = scroll backward.</div>
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">Keyboard Adjust: {speedIncrement.toFixed(1)}x</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={speedIncrement}
                        onChange={(e) => setSpeedIncrement(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-400 mt-1">↑↓ arrow key step size</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2">Presenter timer overlay</label>
                      <div className="inline-flex rounded-lg overflow-hidden border border-gray-600 text-xs">
                        {['full', 'speed', 'hidden'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setTimerDisplayMode(opt)}
                            className={`px-3 py-2 ${timerDisplayMode === opt ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}
                          >
                            {opt === 'full' ? 'Full' : opt === 'speed' ? 'Speed only' : 'Hidden'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm mb-2">Overlay corner</label>
                      <select
                        value={timerCorner}
                        onChange={(e) => setTimerCorner(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="top-left">Top left</option>
                        <option value="top-right">Top right</option>
                        <option value="bottom-left">Bottom left</option>
                        <option value="bottom-right">Bottom right</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm mb-2">
                      Delayed start: <span className="text-purple-400">{countdownDuration === 0 ? 'Off' : `${countdownDuration}s`}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={countdownDuration}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (v > 0) lastCountdownDurationRef.current = v;
                        setCountdownDuration(v);
                      }}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">Counts down on operator + presenter, then waits 1s before scrolling. 0 disables.</div>
                  </div>
                </div>

                {/* Display Settings */}
                <div className="col-span-3 border-b border-gray-600 pb-2 mb-2">
                  <h3 className="font-bold text-sm mb-3 text-green-400 flex items-center gap-2">
                    <Type size={16} />
                    Display Settings
                  </h3>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Font Size: {fontSize}px</label>
                  <input
                    type="range"
                    min="24"
                    max="120"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Line Height: {lineHeight.toFixed(1)}</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">H. Margin: {horizontalMargin}%</label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={horizontalMargin}
                    onChange={(e) => setHorizontalMargin(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Lead-In: {leadInMargin}vh</label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={leadInMargin}
                    onChange={(e) => setLeadInMargin(Number(e.target.value))}
                    className="w-full"
                  />
                </div>


                <div>
                  <label className="block text-sm mb-2">Chapter Spacing: {chapterSpacing.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={chapterSpacing}
                    onChange={(e) => setChapterSpacing(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Empty div to push color pickers to next row */}
                <div></div>

                <div>
                  <label className="block text-sm mb-2">Font Color</label>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Background Color</label>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-sm mb-2">Crosshair</label>
                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Color</div>
                      <input
                        type="color"
                        value={crosshairColor}
                        onChange={(e) => setCrosshairColor(e.target.value)}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Length: <span className="text-purple-400">{crosshairLength}px</span></div>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        step="1"
                        value={crosshairLength}
                        onChange={(e) => setCrosshairLength(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Thickness: <span className="text-purple-400">{crosshairThickness}px</span></div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={crosshairThickness}
                        onChange={(e) => setCrosshairThickness(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {showKeyboardShortcuts && (
              <div className="p-4 bg-gray-700 rounded-b-lg rounded-tr-lg mb-4 overflow-y-auto max-h-[60vh] space-y-3">
                {Object.entries({
                  playPause: 'Play/Pause',
                  speedUp: 'Speed Up',
                  speedDown: 'Speed Down',
                  nextChapter: 'Next Chapter',
                  prevChapter: 'Previous Chapter',
                  resetScript: 'Reset Script',
                  manualScroll: 'Manual Scroll Mode',
                  spotlight: 'Mouse Spotlight'
                }).map(([action, label]) => (
                  <div key={action}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-purple-400">{label}</span>
                      <button
                        onClick={() => addShortcutAlternative(action)}
                        className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-1"
                        title="Add Alternative"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    {keyboardShortcuts[action].map((shortcut, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        {editingShortcut?.action === action && editingShortcut?.index === idx ? (
                          <>
                            <kbd className="px-3 py-2 bg-yellow-600 rounded text-sm flex-1 text-center font-semibold">
                              {capturedKeys ? formatShortcut(capturedKeys) : 'Press keys...'}
                            </kbd>
                            <button onClick={() => saveShortcut(action, idx, capturedKeys)} disabled={!capturedKeys} className="p-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50" title="Save">
                              <Check size={16} />
                            </button>
                            <button onClick={cancelEditingShortcut} className="p-2 bg-red-600 hover:bg-red-700 rounded" title="Cancel">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <kbd className="px-3 py-2 bg-gray-800 rounded text-sm flex-1 font-semibold">{formatShortcut(shortcut)}</kbd>
                            <button onClick={() => { setEditingShortcut({ action, index: idx }); setCapturedKeys(null); }} className="p-2 hover:bg-gray-600 rounded" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            {keyboardShortcuts[action].length > 1 && (
                              <button onClick={() => removeShortcut(action, idx)} className="p-2 hover:bg-gray-600 rounded text-red-400" title="Remove">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {editingShortcut?.action === action && editingShortcut?.index === keyboardShortcuts[action].length && (
                      <div className="flex items-center gap-2 mb-2">
                        <kbd className="px-3 py-2 bg-yellow-600 rounded text-sm flex-1 text-center font-semibold">
                          {capturedKeys ? formatShortcut(capturedKeys) : 'Press keys...'}
                        </kbd>
                        <button onClick={() => saveShortcut(action, editingShortcut.index, capturedKeys)} disabled={!capturedKeys} className="p-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50" title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={cancelEditingShortcut} className="p-2 bg-red-600 hover:bg-red-700 rounded" title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showRemote && (
              <div className="p-4 bg-gray-700 rounded-b-lg rounded-tr-lg mb-4 overflow-y-auto max-h-[60vh] space-y-4">
                <h3 className="text-lg font-bold text-purple-400">Remote Control</h3>

                {/* Logi MX Creative Console plugin status — always visible */}
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Logi MX Creative Console plugin</div>
                  {logiPluginStatus.status === 'pending' && (
                    <div className="text-xs text-gray-500">Checking…</div>
                  )}
                  {logiPluginStatus.status === 'installing' && (
                    <div className="text-xs text-blue-400">Installing…</div>
                  )}
                  {logiPluginStatus.status === 'installed' && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="text-green-400">● Installed</span>
                        {logiPluginStatus.version ? <span className="text-gray-400"> (v{logiPluginStatus.version})</span> : null}
                        {logiPluginStatus.optionsPlusDetected === false && (
                          <div className="text-xs text-yellow-300 mt-1">Logi Options+ not detected — plugin will activate once you install it.</div>
                        )}
                      </div>
                      <button
                        onClick={() => window.electron?.reinstallLogiPlugin?.()}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded shrink-0"
                      >
                        Reinstall
                      </button>
                    </div>
                  )}
                  {logiPluginStatus.status === 'dev-linked' && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-yellow-400">● Linked from source (dev mode){logiPluginStatus.version ? ` (v${logiPluginStatus.version})` : ''}</div>
                      <button
                        onClick={() => window.electron?.reinstallLogiPlugin?.()}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded shrink-0"
                        title="Replace the dev junction with the bundled copy"
                      >
                        Install bundled
                      </button>
                    </div>
                  )}
                  {logiPluginStatus.status === 'error' && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-red-400 flex-1">Install failed: {logiPluginStatus.error || 'unknown error'}</div>
                      <button
                        onClick={() => window.electron?.reinstallLogiPlugin?.()}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    The local remote server runs while Promptly is open so the Logi plugin and any phone on the same Wi-Fi network can connect. Enable internet access to also reach Promptly from a different network via a Cloudflare tunnel.
                  </p>

                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Local network (same Wi-Fi)</div>
                    <div className="text-xs text-white font-mono bg-gray-900 p-2 rounded break-all mb-3">
                      {remoteServerUrl || 'Starting…'}
                    </div>

                    <div className="text-xs text-gray-400 mb-1">
                      Internet (cross-network) {tunnelActive ? (remoteTunnelUrl ? '' : '— starting…') : '— disabled'}
                    </div>
                    <div className="text-xs text-white font-mono bg-gray-900 p-2 rounded break-all">
                      {tunnelActive ? (remoteTunnelUrl || 'Waiting for Cloudflare tunnel…') : 'Click "Enable Internet Access" to start a tunnel'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">QR points to</div>
                    <div className="inline-flex rounded-lg overflow-hidden border border-gray-600 text-xs">
                      {[
                        { v: 'auto', label: 'Auto' },
                        { v: 'internet', label: 'Internet' },
                        { v: 'local', label: 'Local' }
                      ].map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setQrSource(opt.v)}
                          className={`px-3 py-1.5 ${qrSource === opt.v ? 'bg-purple-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {qrCodeDataUrl ? (
                    <div className="bg-white p-4 rounded-lg flex flex-col items-center justify-center">
                      <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
                      <div className="text-xs text-gray-700 mt-2">
                        {qrSource === 'local' ? 'QR points to local URL'
                          : qrSource === 'internet' ? 'QR points to the internet URL'
                          : remoteTunnelUrl ? 'QR points to the internet URL (auto)' : 'QR points to local URL (auto)'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-900 p-4 rounded-lg text-center text-xs text-gray-400">
                      {qrSource === 'internet' && !tunnelActive ? 'Enable Internet Access to generate a public URL.'
                        : qrSource === 'internet' ? 'Waiting for Cloudflare tunnel…'
                        : 'No URL available'}
                    </div>
                  )}

                  <button
                    onClick={tunnelActive ? stopRemoteServer : startRemoteServer}
                    className={`w-full px-6 py-3 rounded-lg font-semibold ${tunnelActive ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {tunnelActive ? 'Disable Internet Access' : 'Enable Internet Access'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={() => setIsResizingPreview(true)}
          />
        </div>

        {/* Preview Side */}
        <div className="flex flex-col bg-gray-800" style={{ width: `${100 - previewWidth}%` }}>
          <div className="p-3 border-b border-gray-700 flex flex-col gap-2">
            {/* Top row: window controls, left aligned */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={openPresenterWindow}
                className={`px-4 py-2 rounded flex items-center gap-2 ${
                  presenterWindow && !presenterWindow.closed
                    ? 'bg-blue-500 hover:bg-blue-600 ring-2 ring-blue-300'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title={presenterWindow && !presenterWindow.closed
                  ? "Presenter window is open - click to refresh"
                  : "Open presenter in separate window"}
              >
                <Monitor size={16} />
                {presenterWindow && !presenterWindow.closed ? 'Window Open ✓' : 'Open Presenter Window'}
              </button>

              {presenterWindow && !presenterWindow.closed && (
                <button
                  onClick={() => {
                    if (window.electron?.togglePresenterFullscreen) {
                      window.electron.togglePresenterFullscreen(!presenterFullscreen);
                    }
                  }}
                  className={`px-4 py-2 rounded flex items-center gap-2 ${
                    presenterFullscreen
                      ? 'bg-purple-500 hover:bg-purple-600 ring-2 ring-purple-300'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                  title={presenterFullscreen ? "Exit fullscreen on presenter window" : "Enter fullscreen on presenter window"}
                >
                  <Maximize2 size={16} />
                  {presenterFullscreen ? 'Full Screen ✓' : 'Full Screen'}
                </button>
              )}

              {presenterWindow && !presenterWindow.closed && displays.length > 1 && (() => {
                const selected = displays.find(d => d.id === presenterDisplayId);
                const formatLabel = (d, i) => {
                  const w = d.size?.width ?? d.bounds?.width;
                  const h = d.size?.height ?? d.bounds?.height;
                  const prefix = d.label ? `${d.label} — ` : '';
                  const suffix = d.primary ? ' — Primary' : '';
                  return `${prefix}Monitor ${i + 1} (${w}×${h})${suffix}`;
                };
                const triggerText = selected
                  ? `Monitor ${displays.findIndex(d => d.id === selected.id) + 1}`
                  : 'Auto';
                return (
                  <div className="relative display-picker">
                    <button
                      onClick={() => setShowDisplayDropdown(v => !v)}
                      className="px-3 py-2 rounded flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-sm"
                      title="Choose which monitor the presenter fullscreens to"
                    >
                      <Monitor size={14} />
                      {triggerText}
                      <ChevronDown size={14} />
                    </button>
                    {showDisplayDropdown && (
                      <div className="absolute top-full left-0 mt-2 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50" style={{ minWidth: '240px' }}>
                        <button
                          onClick={() => {
                            window.electron?.setPresenterDisplay?.(null);
                            setPresenterDisplayId(null);
                            setShowDisplayDropdown(false);
                          }}
                          className={`w-full px-3 py-2 hover:bg-gray-600 text-left border-b border-gray-600 text-sm ${presenterDisplayId === null ? 'bg-purple-600/40 font-semibold' : ''}`}
                        >
                          Auto (current monitor)
                        </button>
                        {displays.map((d, i) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              window.electron?.setPresenterDisplay?.(d.id);
                              setPresenterDisplayId(d.id);
                              setShowDisplayDropdown(false);
                            }}
                            className={`w-full px-3 py-2 hover:bg-gray-600 text-left border-b border-gray-600 last:border-b-0 text-sm ${presenterDisplayId === d.id ? 'bg-purple-600/40 font-semibold' : ''}`}
                          >
                            {formatLabel(d, i)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Bottom row: playback + modes, left aligned */}
            <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={togglePlayPause}
              disabled={!presenterWindow || presenterWindow.closed}
              className={`p-2 rounded-lg ${
                !presenterWindow || presenterWindow.closed
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              title={!presenterWindow || presenterWindow.closed ? 'Open presenter window to play' : hasReachedEnd ? 'Replay' : isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <button
              onClick={() => {
                cancelCountdown();
                scrollPositionRef.current = 0;
                setScrollPosition(0);
                setIsPlaying(false);
                setHasReachedEnd(false);
              }}
              disabled={!presenterWindow || presenterWindow.closed}
              className={`p-2 rounded-lg ${
                !presenterWindow || presenterWindow.closed
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={!presenterWindow || presenterWindow.closed ? 'Open presenter window to reset' : 'Reset script to beginning'}
            >
              <ChevronsLeft size={20} />
            </button>

            <button
              onClick={navigateToPreviousChapter}
              disabled={!presenterWindow || presenterWindow.closed || (getCurrentChapterIndex() === 0 && scrollPositionRef.current <= (chapterPositions[0]?.position || 0) + 5)}
              className={`p-2 rounded-lg ${
                !presenterWindow || presenterWindow.closed || (getCurrentChapterIndex() === 0 && scrollPositionRef.current <= (chapterPositions[0]?.position || 0) + 5)
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={!presenterWindow || presenterWindow.closed ? 'Open presenter window to navigate' : (getCurrentChapterIndex() === 0 && scrollPositionRef.current <= (chapterPositions[0]?.position || 0) + 5) ? 'Already at beginning' : 'Previous chapter'}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={navigateToNextChapter}
              disabled={!presenterWindow || presenterWindow.closed || getCurrentChapterIndex() >= chapterPositions.length - 1}
              className={`p-2 rounded-lg ${
                !presenterWindow || presenterWindow.closed || getCurrentChapterIndex() >= chapterPositions.length - 1
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={!presenterWindow || presenterWindow.closed ? 'Open presenter window to navigate' : getCurrentChapterIndex() >= chapterPositions.length - 1 ? 'Already at last chapter' : 'Next chapter'}
            >
              <ChevronRight size={20} />
            </button>

            {currentScript?.chapters.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                  title={`Chapters (${currentScript.chapters.length})`}
                >
                  <List size={20} />
                </button>

                {showChapterList && (
                  <div className="absolute top-full left-0 mt-2 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                    {currentScript.chapters.map((chapter, index) => {
                      const isCurrentChapter = getCurrentChapterIndex() === index;
                      return (
                        <button
                          key={chapter.id}
                          onClick={() => {
                            jumpToChapter(index);
                            setShowChapterList(false);
                          }}
                          className={`w-full px-3 py-2 hover:bg-gray-600 text-left flex items-center gap-2 border-b border-gray-600 last:border-b-0 ${
                            isCurrentChapter ? 'bg-purple-600/40 font-semibold' : ''
                          }`}
                        >
                          <span className="text-gray-400 text-sm">{index + 1}.</span>
                          <span className="flex-1 truncate">{chapter.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={toggleManualScroll}
              className={`p-2 rounded-lg ${
                manualScrollMode
                  ? 'bg-yellow-500 hover:bg-yellow-600 ring-2 ring-yellow-300 text-black'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={
                !presenterWindow || presenterWindow.closed
                  ? 'Manual scroll mode — requires presenter window'
                  : manualScrollMode ? 'Exit manual scroll mode (J)' : 'Manual scroll mode (J)'
              }
            >
              <ArrowUpDown size={20} />
            </button>

            <button
              onClick={toggleSpotlight}
              className={`p-2 rounded-lg ${
                spotlightMode
                  ? 'bg-red-500 hover:bg-red-600 ring-2 ring-red-300 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={
                !presenterWindow || presenterWindow.closed
                  ? 'Mouse spotlight — requires presenter window'
                  : spotlightMode ? 'Exit mouse spotlight (S)' : 'Mouse spotlight (S)'
              }
            >
              <Crosshair size={20} />
            </button>

            <button
              onClick={() => {
                if (countdownDuration > 0) {
                  lastCountdownDurationRef.current = countdownDuration;
                  setCountdownDuration(0);
                } else {
                  setCountdownDuration(lastCountdownDurationRef.current || 3);
                }
              }}
              className={`p-2 rounded-lg ${
                countdownDuration > 0
                  ? 'bg-blue-500 hover:bg-blue-600 ring-2 ring-blue-300'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={countdownDuration > 0
                ? `Delayed start: ${countdownDuration}s — click to disable`
                : 'Delayed start: off — click to enable'}
            >
              <Timer size={20} />
            </button>

            <button
              onClick={() => setTimerDisplayMode(prev => prev === 'full' ? 'speed' : prev === 'speed' ? 'hidden' : 'full')}
              className={`p-2 rounded-lg ${
                timerDisplayMode !== 'hidden'
                  ? 'bg-blue-500 hover:bg-blue-600 ring-2 ring-blue-300'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={
                timerDisplayMode === 'full' ? 'Presenter: full timer — click for speed-only'
                  : timerDisplayMode === 'speed' ? 'Presenter: speed only — click to hide'
                  : 'Presenter: hidden — click to show full timer'
              }
            >
              {timerDisplayMode === 'full' ? <Clock size={20} />
                : timerDisplayMode === 'speed' ? <Gauge size={20} />
                : <EyeOff size={20} />}
            </button>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden bg-gray-700">
            {presenterRequiredToast && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 pointer-events-none">
                <AlertCircle size={14} /> Open the presenter window to use this mode
              </div>
            )}
            <div key="preview-content" className="h-full relative z-10">
              {renderOperatorPreview()}
            </div>
          </div>
          <div className="p-3 border-t border-gray-700 bg-gray-800 flex-shrink-0 h-14 overflow-hidden">
            <div className="flex items-center justify-between gap-4 h-full">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs text-gray-400">Elapsed:</span>
                  <span className="text-lg font-mono font-bold text-blue-400">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs text-gray-400">Est:</span>
                  <span className="text-sm font-mono text-gray-300">
                    {(() => {
                      const speedForEstimate = isPlaying ? activeScrollSpeed : scrollSpeed;
                      if (speedForEstimate <= 0 || !isFinite(estimatedDuration) || estimatedDuration < 0) return '—';
                      return formatTime(estimatedDuration);
                    })()}
                  </span>
                </div>
                <div className="h-1.5 w-32 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${estimatedDuration > 0 ? Math.min((elapsedTime / estimatedDuration) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-sm whitespace-nowrap">
                <span className="text-gray-400">Speed:</span>{' '}
                <span className="font-semibold inline-block min-w-[3.5em] text-right">
                  {(() => {
                    const s = isPlaying ? activeScrollSpeed : scrollSpeed;
                    return s < 0 ? `◀ ${Math.abs(s).toFixed(1)}x` : `${s.toFixed(1)}x`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden scroll reference - always rendered to track scroll position */}
      {/* Must match presenter window dimensions for accurate offsetTop calculations */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0', width: `${presenterWindowDimensions.width}px`, height: `${presenterWindowDimensions.height}px`, visibility: 'hidden', pointerEvents: 'none' }}>
        <PrompterContent scrollRefProp={scrollRef} />
      </div>

      {/* Fullscreen View */}
      {showFullscreen && <FullscreenView />}

      {/* Update available / downloading / ready-to-install toast (bottom-right) */}
      {updateInfo && !updateDismissed && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 border-2 border-purple-500 rounded-lg shadow-2xl p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <Download size={20} className="text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              {updateDownloaded ? (
                <>
                  <div className="font-semibold mb-1">Promptly {updateInfo.version} ready</div>
                  <div className="text-xs text-gray-400 mb-3">Restart to apply the update.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.electron?.quitAndInstallUpdate?.()}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
                    >
                      Restart now
                    </button>
                    <button
                      onClick={() => setUpdateDismissed(true)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Later
                    </button>
                  </div>
                </>
              ) : updateProgress !== null ? (
                <>
                  <div className="font-semibold mb-1">Downloading Promptly {updateInfo.version}</div>
                  <div className="h-1.5 bg-gray-700 rounded overflow-hidden mb-1">
                    <div className="h-full bg-purple-500 transition-all" style={{ width: `${updateProgress}%` }} />
                  </div>
                  <div className="text-xs text-gray-400">{Math.round(updateProgress)}%</div>
                </>
              ) : (
                <>
                  <div className="font-semibold mb-1">Promptly {updateInfo.version} is available</div>
                  <div className="text-xs text-gray-400 mb-3">An update was published on GitHub.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        window.electron?.downloadUpdate?.();
                        setUpdateProgress(0);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => setUpdateDismissed(true)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md border-2 border-gray-600">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6 text-gray-300">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}