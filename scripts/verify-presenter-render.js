// Smoke test: execute electron-presenter.html's real scripts under jsdom and
// confirm the presenter renders script text (catches scope/ReferenceError bugs
// that blank the presenter) and that the timer/REC corner stack is wired.
// Run: node scripts/verify-presenter-render.js
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { console.log('jsdom not installed — skipping presenter render check'); process.exit(0); }

const html = fs.readFileSync(path.join(__dirname, '..', 'electron-presenter.html'), 'utf8');
const electronStub = new Proxy({}, { get() { return () => () => {}; } });

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) { window.electron = electronStub; },
});
const { window } = dom;

setTimeout(() => {
  try {
    if (typeof window.applyLiveviewTransform !== 'function') throw new Error('applyLiveviewTransform not in scope');
    if (typeof window.updatePresenterContent !== 'function') throw new Error('updatePresenterContent not defined');

    window.updatePresenterContent({
      chapters: [{ content: '<p>VERIFY_RENDER_OK</p>', showTitle: false, name: 'C1' }],
      fontSize: 40, lineHeight: 1.5, chapterSpacing: 1,
      fontColor: '#fff', bgColor: 'transparent',
      flipHorizontal: true, flipVertical: false,
      leadInMargin: 50, leadOutMargin: 50,
      timerDisplayMode: 'speed', timerCorner: 'bottom-right',
    });

    const doc = window.document;
    const inner = (doc.getElementById('presenter-scroll') || {}).innerHTML || '';
    if (!inner.includes('VERIFY_RENDER_OK')) throw new Error('presenter did not render chapter text');

    const stack = doc.getElementById('corner-stack');
    if (!stack) throw new Error('#corner-stack missing');
    if (!stack.classList.contains('corner-bottom-right')) throw new Error('corner class not applied to corner-stack');
    const rec = doc.getElementById('rec-indicator');
    if (!rec || rec.parentElement.id !== 'corner-stack') throw new Error('rec-indicator not nested in corner-stack');

    console.log('PRESENTER RENDER PASSED — text renders, corner-stack wired, rec tally nested');
    process.exit(0);
  } catch (e) {
    console.error('PRESENTER RENDER FAILED:', e.message);
    process.exit(1);
  }
}, 400);
