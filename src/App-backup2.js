import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Settings, FileText, Download, Upload, Edit2, ChevronLeft, ChevronRight, List, Plus, GripVertical, Trash2, Maximize2, Eye, EyeOff, Monitor, Bold, Italic, Underline, Palette, AlertCircle, Timer, Zap, Scissors, Clock, Type, Droplet, Move, BookOpen, Target } from 'lucide-react';

export default function App() {
  const [scripts, setScripts] = useState([
    { 
      id: 1, 
      name: 'Sample Script', 
      description: 'A demo script to get started',
      chapters: [
        { id: 1, name: 'Introduction', content: '<p>Welcome to the teleprompter!</p><p>This is a sample script with <strong>rich text</strong> support.</p>', showTitle: true, customSpeed: null },
        { id: 2, name: 'Features', content: '<p>You can now use <strong>bold</strong>, <em>italic</em>, and <u>underline</u>.</p><p>Press Space to play/pause.</p>', showTitle: true, customSpeed: null },
        { id: 3, name: 'Chapters', content: '<p>Chapters help you <span style="color: #4ade80;">organize</span> long scripts.</p><p>Enjoy creating your content!</p>', showTitle: true, customSpeed: null }
      ]
    }
  ]);
  const [currentScriptId, setCurrentScriptId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2.0);
  const [activeScrollSpeed, setActiveScrollSpeed] = useState(2.0); // Current speed being used (may differ from scrollSpeed if chapter has custom speed)
  const [scrollPosition, setScrollPosition] = useState(0);
  const [speedIncrement, setSpeedIncrement] = useState(0.1); // How much to change speed with keyboard shortcuts
  const [showSettings, setShowSettings] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenMonitor, setFullscreenMonitor] = useState(0);
  const [presenterWindow, setPresenterWindow] = useState(null);
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [showChapterList, setShowChapterList] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [draggedChapter, setDraggedChapter] = useState(null);
  const [dragOverChapter, setDragOverChapter] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [canDrag, setCanDrag] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [previewWidth, setPreviewWidth] = useState(67);
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
    '📍', '🔖', '🏁', '🎯', '🎪', '🎭', '🎨', '🖼️'
  ];
  
  // Settings
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#000000');
  const [lineHeight, setLineHeight] = useState(1.5);
  const [horizontalMargin, setHorizontalMargin] = useState(20);
  const [crosshairColor, setCrosshairColor] = useState('#ff0000');
  const [leadInMargin, setLeadInMargin] = useState(40);
  const [leadOutMargin, setLeadOutMargin] = useState(60);
  const [chapterSpacing, setChapterSpacing] = useState(2);
  
  // Advanced Display Options
  const [bgOpacity, setBgOpacity] = useState(100); // 0-100%
  const [flipHorizontalOperator, setFlipHorizontalOperator] = useState(false);
  const [flipVerticalOperator, setFlipVerticalOperator] = useState(false);
  const [flipHorizontalPresenter, setFlipHorizontalPresenter] = useState(false);
  const [flipVerticalPresenter, setFlipVerticalPresenter] = useState(false);
  
  // Timer states
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(150); // Average reading speed
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  
  const scrollRef = useRef(null);
  const previewScrollRef = useRef(null);
  const presenterWindowScrollRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const scrollPositionRef = useRef(0);

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

  // Calculate estimated duration based on word count and WPM
  useEffect(() => {
    if (calculateWordCount > 0) {
      const minutes = calculateWordCount / wordsPerMinute;
      setEstimatedDuration(minutes * 60); // Convert to seconds
    }
  }, [calculateWordCount, wordsPerMinute]);

  // Format time helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      underline: document.queryCommandState('underline')
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
      console.log('Could not restore selection:', e);
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
  };

  const addChapter = () => {
    if (!currentScript) {
      console.log("No current script!");
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
    
    // Delete content after cursor from the current chapter
    afterRange.deleteContents();
    
    // Get the updated content of the current chapter (before cursor)
    const beforeContent = contentDiv.innerHTML.trim() || '<p><br></p>';
    
    // Update the current chapter with content before cursor
    updateChapter(chapterId, 'content', beforeContent);
    
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
    
    // Insert the new chapter right after the current one
    setScripts(prev => prev.map(s => {
      if (s.id !== currentScriptId) return s;
      
      const chapters = [...s.chapters];
      chapters.splice(currentChapterIndex + 1, 0, newChapter);
      
      return { ...s, chapters };
    }));
    
    // Close any open pickers
    setShowColorPicker(null);
    setShowEmojiPicker(null);
  };

  const updateChapter = (chapterId, field, value) => {
    if (previewScrollRef.current && !isPlaying) {
      scrollPositionRef.current = previewScrollRef.current.scrollTop;
    }
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

  const toggleChapterTitle = (chapterId) => {
    if (!currentScript) return;
    if (previewScrollRef.current && !isPlaying) {
      scrollPositionRef.current = previewScrollRef.current.scrollTop;
    }
    updateChapter(chapterId, 'showTitle', !currentScript.chapters.find(c => c.id === chapterId).showTitle);
  };

  const deleteChapter = (chapterId) => {
    console.log("Delete chapter called with ID:", chapterId);
    
    if (!currentScript) {
      console.log("No current script!");
      return;
    }
    
    if (currentScript.chapters.length === 1) {
      alert('Cannot delete the last chapter');
      return;
    }
    
    const chapterToDelete = currentScript.chapters.find(c => c.id === chapterId);
    if (!chapterToDelete) {
      console.log("Chapter not found!");
      return;
    }
    
    setConfirmDialog({
      message: `Are you sure you want to delete "${chapterToDelete.name}"?`,
      onConfirm: () => {
        console.log("Deleting chapter...");
        const updatedChapters = currentScript.chapters.filter(c => c.id !== chapterId);
        console.log("Remaining chapters:", updatedChapters.length);
        
        setScripts(prevScripts => prevScripts.map(s => 
          s.id === currentScriptId 
            ? { ...s, chapters: updatedChapters }
            : s
        ));
        setConfirmDialog(null);
      },
      onCancel: () => {
        console.log("Delete cancelled by user");
        setConfirmDialog(null);
      }
    });
  };

  const deleteScript = (scriptId) => {
    console.log("Delete script called with ID:", scriptId);
    
    if (scripts.length === 1) {
      alert('Cannot delete the last script');
      return;
    }
    
    const scriptToDelete = scripts.find(s => s.id === scriptId);
    if (!scriptToDelete) {
      console.log("Script not found!");
      return;
    }
    
    setConfirmDialog({
      message: `Are you sure you want to delete "${scriptToDelete.name}"?`,
      onConfirm: () => {
        console.log("Deleting script...");
        const remainingScripts = scripts.filter(s => s.id !== scriptId);
        console.log("Remaining scripts:", remainingScripts.length);
        
        setScripts(remainingScripts);
        
        if (currentScriptId === scriptId) {
          setCurrentScriptId(remainingScripts[0].id);
        }
        setConfirmDialog(null);
      },
      onCancel: () => {
        console.log("Delete cancelled by user");
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

  // Calculate chapter positions - memoized to prevent recalculation
  const chapterPositions = useMemo(() => {
    if (!currentScript?.chapters) return [];
    
    let currentPos = 0;
    return currentScript.chapters.map((chapter, index) => {
      // Create temporary div to measure content height
      const temp = document.createElement('div');
      temp.innerHTML = chapter.content;
      temp.style.fontSize = `${fontSize}px`;
      temp.style.lineHeight = `${lineHeight}`;
      temp.style.fontFamily = 'Arial, sans-serif';
      temp.style.whiteSpace = 'pre-wrap';
      temp.style.position = 'absolute';
      temp.style.visibility = 'hidden';
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
  }, [currentScript?.chapters, fontSize, lineHeight, chapterSpacing]);

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

      // Determine current chapter based on scroll position
      const currentChapter = chapterPositions.find((ch, index) => {
        const nextChapter = chapterPositions[index + 1];
        return scrollPositionRef.current >= ch.position && 
               (!nextChapter || scrollPositionRef.current < nextChapter.position);
      });

      // Calculate target speed (use chapter custom speed if set, otherwise master speed)
      let targetSpeed = scrollSpeed;
      if (currentChapter && currentChapter.customSpeed !== undefined && currentChapter.customSpeed !== null) {
        targetSpeed = currentChapter.customSpeed;
      }

      // Smooth transition to target speed (lerp)
      const speedTransitionRate = 0.1; // Higher = faster transition
      const newActiveSpeed = activeScrollSpeed + (targetSpeed - activeScrollSpeed) * speedTransitionRate;
      setActiveScrollSpeed(newActiveSpeed);

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
          if (previewScrollRef.current) {
            previewScrollRef.current.scrollTop = maxScroll;
          }
          if (presenterWindow) {
            if (presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
              window.electron.updatePresenterScroll(maxScroll);
            } else if (presenterWindowScrollRef.current) {
              presenterWindowScrollRef.current.scrollTop = maxScroll;
            }
          }
          return;
        }
      }
      
      if (previewScrollRef.current) {
        const maxScroll = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
        if (newPos >= maxScroll) {
          setIsPlaying(false);
          setHasReachedEnd(true);
          scrollPositionRef.current = maxScroll;
          setScrollPosition(maxScroll);
          previewScrollRef.current.scrollTop = maxScroll;
          if (scrollRef.current) {
            scrollRef.current.scrollTop = maxScroll;
          }
          if (presenterWindow) {
            if (presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
              window.electron.updatePresenterScroll(maxScroll);
            } else if (presenterWindowScrollRef.current) {
              presenterWindowScrollRef.current.scrollTop = maxScroll;
            }
          }
          return;
        }
      }

      scrollPositionRef.current = newPos;
      setScrollPosition(newPos);
      
      // Sync both scrolls
      if (scrollRef.current) {
        scrollRef.current.scrollTop = newPos;
      }
      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTop = newPos;
      }
      if (presenterWindow) {
        if (presenterWindow.isElectron && window.electron && window.electron.updatePresenterScroll) {
          window.electron.updatePresenterScroll(newPos);
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
  }, [isPlaying, scrollSpeed, activeScrollSpeed, showFullscreen, chapterPositions]);

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

  // Timer effect - tracks elapsed time while playing
  useEffect(() => {
    if (isPlaying) {
      // Start timer
      startTimeRef.current = Date.now() - (elapsedTime * 1000);
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setElapsedTime(elapsed);
      }, 100); // Update every 100ms for smooth display
    } else {
      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isPlaying]);

  // Reset timer when script changes or position resets to 0
  useEffect(() => {
    if (scrollPositionRef.current === 0 || scrollPosition === 0) {
      setElapsedTime(0);
      startTimeRef.current = null;
    }
  }, [scrollPosition, currentScriptId]);

  // Maintain scroll position when content changes
  useEffect(() => {
    if (!isPlaying && previewScrollRef.current && scrollPositionRef.current > 0) {
      const savedScroll = scrollPositionRef.current;
      requestAnimationFrame(() => {
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = savedScroll;
        }
      });
    }
  });

  // Sync scroll position - force scroll update on every render
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollPosition;
      }
      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTop = scrollPosition;
      }
    });
  }, [scrollPosition]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColorPicker !== null || showEmojiPicker !== null || showSpeedPicker !== null) {
        const target = e.target;
        const isInsidePicker = target.closest('.color-picker-panel') || target.closest('.emoji-picker-panel') || target.closest('.speed-picker-panel');
        const isPickerButton = target.closest('.picker-button');
        
        if (!isInsidePicker && !isPickerButton) {
          setShowColorPicker(null);
          setShowEmojiPicker(null);
          setShowSpeedPicker(null);
          setTempChapterSpeed(null); // Clear temp speed when closing
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showEmojiPicker, showSpeedPicker]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setScrollSpeed(prev => Math.min(prev + speedIncrement, 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setScrollSpeed(prev => Math.max(prev - speedIncrement, 0.1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          jumpToPreviousChapter();
          break;
        case 'ArrowRight':
          e.preventDefault();
          jumpToNextChapter();
          break;
        case 'Home':
          e.preventDefault();
          scrollPositionRef.current = 0;
          setScrollPosition(0);
          setIsPlaying(false);
          setHasReachedEnd(false);
          break;
        case 'Escape':
          if (showFullscreen) {
            e.preventDefault();
            setShowFullscreen(false);
            setIsPlaying(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFullscreen, hasReachedEnd, chapterPositions, speedIncrement]);

  const jumpToNextChapter = () => {
    const currentChapterIndex = chapterPositions.findIndex(ch => ch.position > scrollPositionRef.current);
    if (currentChapterIndex !== -1) {
      const newPos = chapterPositions[currentChapterIndex].position;
      scrollPositionRef.current = newPos;
      setScrollPosition(newPos);
      setHasReachedEnd(false);
    }
  };

  const jumpToPreviousChapter = () => {
    const currentChapterIndex = chapterPositions.findIndex(ch => ch.position >= scrollPositionRef.current - 10);
    if (currentChapterIndex > 0) {
      const newPos = chapterPositions[currentChapterIndex - 1].position;
      scrollPositionRef.current = newPos;
      setScrollPosition(newPos);
      setHasReachedEnd(false);
    } else if (chapterPositions.length > 0) {
      scrollPositionRef.current = 0;
      setScrollPosition(0);
      setHasReachedEnd(false);
    }
  };

  const jumpToChapter = (chapterIndex) => {
    if (chapterIndex >= 0 && chapterIndex < chapterPositions.length) {
      const newPos = chapterPositions[chapterIndex].position;
      scrollPositionRef.current = newPos;
      setScrollPosition(newPos);
      setHasReachedEnd(false);
      setShowChapterList(false);
    }
  };

  const togglePlayPause = () => {
    if (hasReachedEnd) {
      scrollPositionRef.current = 0;
      setScrollPosition(0);
      setHasReachedEnd(false);
      setElapsedTime(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
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
      'TeleprompterPresenter', 
      'width=1920,height=1080,left=100,top=100,menubar=no,toolbar=no,location=no,status=no'
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
            <title>Teleprompter Presenter</title>
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
            </style>
          </head>
          <body>
            <div id="presenter-root"></div>
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
      });
      
      return unsubscribe;
    }
  }, []);

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
		  const hexToRgba = (hex, opacity) => {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
		  };

		  window.electron.updatePresenterContent({
			chapters: currentScript?.chapters || [],
			fontSize,
			fontColor,
			bgColor,
			bgOpacity,
			bgColorRgba: hexToRgba(bgColor, bgOpacity),
			lineHeight,
			horizontalMargin,
			leadInMargin,
			leadOutMargin,
			chapterSpacing,
			crosshairColor,
			flipHorizontal: flipHorizontalPresenter,
			flipVertical: flipVerticalPresenter,
			elapsedTime,
			estimatedDuration,
			scrollSpeed
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

      // Convert bgColor to rgba with opacity
      const hexToRgba = (hex, opacity) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
      };

      const transform = `scaleX(${flipHorizontalPresenter ? -1 : 1}) scaleY(${flipVerticalPresenter ? -1 : 1})`;
      
      presenterRoot.innerHTML = `
        <div style="width: 100%; height: 100%; background-color: ${hexToRgba(bgColor, bgOpacity)}; position: relative;">
          <div id="presenter-scroll" class="scrollbar-hide" style="
            height: 100%;
            overflow-y: scroll;
            padding-left: ${horizontalMargin}%;
            padding-right: ${horizontalMargin}%;
            padding-top: ${leadInMargin}vh;
            padding-bottom: ${leadOutMargin}vh;
            transform: ${transform};
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
  }, [presenterWindow, currentScript, fontSize, fontColor, bgColor, bgOpacity, lineHeight, 
      horizontalMargin, leadInMargin, leadOutMargin, chapterSpacing, crosshairColor, 
      flipHorizontalPresenter, flipVerticalPresenter, elapsedTime, estimatedDuration, scrollSpeed]);

  // Update timer in presenter window
  useEffect(() => {
    if (!presenterWindow || presenterWindow.closed) return;

    const elapsedEl = presenterWindow.document.getElementById('elapsed-time');
    const totalEl = presenterWindow.document.getElementById('total-time');
    const progressEl = presenterWindow.document.getElementById('progress-bar');
    const speedEl = presenterWindow.document.getElementById('speed-display');

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

  const PrompterContent = React.memo(({ scrollRefProp, scale = 1, flipHorizontal = false, flipVertical = false }) => {
    const transform = `scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`;
    
    return (
      <div
        ref={scrollRefProp}
        className="h-full overflow-y-scroll scrollbar-hide"
        style={{
          paddingLeft: `${horizontalMargin}%`,
          paddingRight: `${horizontalMargin}%`,
          paddingTop: `${leadInMargin}vh`,
          paddingBottom: `${leadOutMargin}vh`,
          transform: transform,
        }}
      >
      {currentScript?.chapters.map((chapter, index) => (
        <div key={chapter.id} style={{ marginBottom: `${fontSize * lineHeight * chapterSpacing}px` }}>
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
            style={{
              fontSize: `${fontSize * scale}px`,
              color: fontColor,
              lineHeight: lineHeight,
              fontFamily: 'Arial, sans-serif',
            }}
            dangerouslySetInnerHTML={{ 
              __html: chapter.content.replace(
                /font-size:\s*0\.8em/g, 
                `font-size: ${fontSize * 0.8 * scale}px`
              )
            }}
          />
        </div>
      ))}
    </div>
    );
  });

  const FullscreenView = () => {
    // Convert bgColor to rgba with opacity
    const hexToRgba = (hex, opacity) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    };
    
    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: hexToRgba(bgColor, bgOpacity) }}>
        <PrompterContent 
          scrollRefProp={scrollRef} 
          flipHorizontal={flipHorizontalPresenter}
          flipVertical={flipVerticalPresenter}
        />
      
      {/* Center crosshair */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative">
          <div 
            className="absolute w-8 h-px left-1/2 top-1/2 -translate-x-1/2"
            style={{ backgroundColor: crosshairColor }}
          ></div>
          <div 
            className="absolute h-8 w-px left-1/2 top-1/2 -translate-y-1/2"
            style={{ backgroundColor: crosshairColor }}
          ></div>
        </div>
      </div>

      {/* Timer overlay - top left */}
      <div className="absolute top-4 left-4 bg-black/70 px-4 py-3 rounded-lg border border-gray-600">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Elapsed</div>
            <div className="text-2xl font-mono font-bold text-blue-400">
              {formatTime(elapsedTime)}
            </div>
          </div>
          <div className="text-gray-500">/</div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Est. Total</div>
            <div className="text-lg font-mono text-gray-300">
              {formatTime(estimatedDuration)}
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden w-48">
          <div 
            className="absolute h-full bg-blue-500 transition-all duration-300"
            style={{ 
              width: `${estimatedDuration > 0 ? Math.min((elapsedTime / estimatedDuration) * 100, 100) : 0}%` 
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
      {/* Sidebar */}
      <div className="bg-gray-800 border-r border-gray-700 flex flex-col relative" style={{ width: `${sidebarWidth}px` }}>
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold mb-4">Teleprompter</h1>
          <button
            onClick={addNewScript}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center gap-2"
          >
            <FileText size={16} />
            New Script
          </button>
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
                    <div className="font-semibold">{script.name}</div>
                    <div className="text-sm text-gray-300">{script.description}</div>
                  </div>
                )}
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
              </div>
              {scripts.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteScript(script.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 mt-2"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-700 space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="file"
              accept=".txt"
              onChange={importScript}
              className="hidden"
              id="import-file"
            />
            <label
              htmlFor="import-file"
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload size={16} />
              Import .txt
            </label>
          </label>
          <button
            onClick={exportScript}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export .txt
          </button>
        </div>
        
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
          onMouseDown={() => setIsResizingSidebar(true)}
        />
      </div>

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
                    
                    <div className="w-px h-6 bg-gray-600"></div>
                    
                    <div className="relative">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowColorPicker(showColorPicker === chapter.id ? null : chapter.id);
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
                          setShowEmojiPicker(showEmojiPicker === chapter.id ? null : chapter.id);
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
            {/* Timer Display */}
            <div className="mb-3 p-3 bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">Elapsed:</div>
                  <div className="text-2xl font-mono font-bold text-blue-400">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">Estimated:</div>
                  <div className="text-lg font-mono text-gray-300">
                    {formatTime(estimatedDuration)}
                  </div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-blue-500 transition-all duration-300"
                  style={{ 
                    width: `${estimatedDuration > 0 ? Math.min((elapsedTime / estimatedDuration) * 100, 100) : 0}%` 
                  }}
                />
              </div>
              
              {/* Word count and stats */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{calculateWordCount} words</span>
                <span>{wordsPerMinute} WPM</span>
                <span>
                  {elapsedTime > 0 && calculateWordCount > 0 
                    ? `${Math.round((calculateWordCount / elapsedTime) * 60)} actual WPM`
                    : 'Not started'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={togglePlayPause}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                style={{ minWidth: '120px' }}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                <span>{hasReachedEnd ? 'Replay' : isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={() => {
                  scrollPositionRef.current = 0;
                  setScrollPosition(0);
                  setIsPlaying(false);
                  setHasReachedEnd(false);
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                title="Reset script to beginning"
              >
                Reset
              </button>

              {currentScript?.chapters.length > 1 && (
                <button
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2"
                  style={{ minWidth: '155px' }}
                >
                  <List size={20} />
                  <span>Chapters ({currentScript.chapters.length})</span>
                </button>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
              >
                <Settings size={20} />
                Settings
              </button>

              <div className="flex-1"></div>

              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span>Speed: {scrollSpeed.toFixed(1)}x</span>
                  {isPlaying && Math.abs(activeScrollSpeed - scrollSpeed) > 0.05 && (
                    <span className="text-orange-400 flex items-center gap-1">
                      <Timer size={14} />
                      {activeScrollSpeed.toFixed(1)}x
                    </span>
                  )}
                </div>
                <div className="text-gray-400">↑↓ to adjust</div>
              </div>
            </div>

            {showChapterList && currentScript?.chapters.length > 1 && (
              <div className="mb-4 p-4 bg-gray-700 rounded-lg">
                <h3 className="font-bold mb-2">Jump to Chapter:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {currentScript.chapters.map((chapter, index) => (
                    <button
                      key={chapter.id}
                      onClick={() => jumpToChapter(index)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-left"
                    >
                      {index + 1}. {chapter.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSettings && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg mb-4">
                {/* Timer & Speed Settings */}
                <div className="col-span-3 border-b border-gray-600 pb-4 mb-2">
                  <h3 className="font-bold text-sm mb-3 text-blue-400 flex items-center gap-2">
                    <Clock size={16} />
                    Timer & Speed Controls
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-2">Reading Speed: {wordsPerMinute} WPM</label>
                      <input
                        type="range"
                        min="100"
                        max="250"
                        step="10"
                        value={wordsPerMinute}
                        onChange={(e) => setWordsPerMinute(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-400 mt-1">For estimated time calculation</div>
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">Scroll Speed: {scrollSpeed.toFixed(1)}x</label>
                      <input
                        type="range"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={scrollSpeed}
                        onChange={(e) => setScrollSpeed(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-400 mt-1">0.1x increments</div>
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
                  <label className="block text-sm mb-2">Lead-Out: {leadOutMargin}vh</label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={leadOutMargin}
                    onChange={(e) => setLeadOutMargin(Number(e.target.value))}
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

                <div>
                  <label className="block text-sm mb-2">Crosshair Color</label>
                  <input
                    type="color"
                    value={crosshairColor}
                    onChange={(e) => setCrosshairColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                
                {/* Advanced Display Options */}
                <div className="col-span-3 border-t border-gray-600 pt-4 mt-4">
                  <h3 className="font-bold text-sm mb-3 text-purple-400 flex items-center gap-2">
                    <Droplet size={16} />
                    Advanced Display Options
                  </h3>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Background Opacity: {bgOpacity}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    {bgOpacity === 0 ? 'Fully transparent background' : bgOpacity === 100 ? 'Fully opaque' : 'Semi-transparent overlay'}
                  </div>
                  <div className="text-xs text-yellow-400 mt-1">
                    ⚠️ Note: Browser windows cannot show desktop behind them. For true transparency, see TRANSPARENCY_INFO.md
                  </div>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm mb-3 font-semibold text-blue-300 flex items-center gap-2">
                    <Monitor size={14} />
                    Operator View (Preview)
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFlipHorizontalOperator(!flipHorizontalOperator)}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                        flipHorizontalOperator 
                          ? 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-400' 
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-gray-500'
                      }`}
                    >
                      <span className="inline-block w-4">{flipHorizontalOperator ? '✓' : ''}</span> Flip Horizontal
                    </button>
                    <button
                      onClick={() => setFlipVerticalOperator(!flipVerticalOperator)}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                        flipVerticalOperator 
                          ? 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-400' 
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-gray-500'
                      }`}
                    >
                      <span className="inline-block w-4">{flipVerticalOperator ? '✓' : ''}</span> Flip Vertical
                    </button>
                  </div>
                </div>
                
                <div className="col-span-3">
                  <label className="block text-sm mb-3 font-semibold text-green-300 flex items-center gap-2">
                    <Target size={14} />
                    Presenter View (Fullscreen)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFlipHorizontalPresenter(!flipHorizontalPresenter)}
                      className={`px-3 py-2 rounded text-sm transition-colors ${
                        flipHorizontalPresenter 
                          ? 'bg-green-600 hover:bg-green-700 border-2 border-green-400' 
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-gray-500'
                      }`}
                    >
                      <span className="inline-block w-4">{flipHorizontalPresenter ? '✓' : ''}</span> Flip Horizontal
                    </button>
                    <button
                      onClick={() => setFlipVerticalPresenter(!flipVerticalPresenter)}
                      className={`px-3 py-2 rounded text-sm transition-colors ${
                        flipVerticalPresenter 
                          ? 'bg-green-600 hover:bg-green-700 border-2 border-green-400' 
                          : 'bg-gray-600 hover:bg-gray-500 border-2 border-gray-500'
                      }`}
                    >
                      <span className="inline-block w-4">{flipVerticalPresenter ? '✓' : ''}</span> Flip Vertical
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    💡 Tip: Use horizontal flip for teleprompter mirrors
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-400 space-y-1">
              <div>Keyboard Shortcuts:</div>
              <div className="grid grid-cols-3 gap-2">
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">Space</kbd> Play/Pause</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">↑↓</kbd> Adjust Speed (±{speedIncrement.toFixed(1)}x)</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">←→</kbd> Jump Chapters</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">Home</kbd> Restart Script</div>
                <div><kbd className="px-2 py-1 bg-gray-700 rounded">Esc</kbd> Exit Fullscreen</div>
              </div>
            </div>
          </div>
          
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={() => setIsResizingPreview(true)}
          />
        </div>

        {/* Preview Side */}
        <div className="flex flex-col bg-gray-800" style={{ width: `${100 - previewWidth}%` }}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-bold">Presenter Preview</h2>
            <div className="flex gap-2">
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
                {presenterWindow && !presenterWindow.closed ? 'Window Open ✓' : 'Separate Window'}
              </button>
              <button
                onClick={() => setShowFullscreen(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-2"
                title="Go fullscreen in this window"
              >
                <Maximize2 size={16} />
                Fullscreen
              </button>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {/* Pattern background to show transparency */}
            <div className="absolute inset-0" style={{
              backgroundImage: `
                repeating-conic-gradient(#444 0% 25%, #333 0% 50%) 
                50% / 20px 20px
              `
            }}></div>
            
            {/* Transparent background overlay */}
            <div className="absolute inset-0" style={{ 
              backgroundColor: `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgOpacity / 100})`
            }}></div>
            
            <div key="preview-content" className="h-full relative z-10">
              <PrompterContent 
                scrollRefProp={previewScrollRef} 
                scale={0.4} 
                flipHorizontal={flipHorizontalOperator}
                flipVertical={flipVerticalOperator}
              />
            </div>
            
            {/* Center crosshair */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              <div className="relative">
                <div 
                  className="absolute w-6 h-px left-1/2 top-1/2 -translate-x-1/2"
                  style={{ backgroundColor: crosshairColor }}
                ></div>
                <div 
                  className="absolute h-6 w-px left-1/2 top-1/2 -translate-y-1/2"
                  style={{ backgroundColor: crosshairColor }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen View */}
      {showFullscreen && <FullscreenView />}
      
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