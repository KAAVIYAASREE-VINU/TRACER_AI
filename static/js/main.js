/**
 * TRACER AI v2 - Main Application
 * Phase 2 Stop B - Complete functionality with textContent-only rendering
 */

import {
  EditorView,
  EditorState,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  history,
  historyKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
  defaultKeymap,
  bracketMatching,
  indentOnInput,
  Decoration,
  StateField,
  StateEffect,
  RangeSet,
  ViewPlugin,
  gutter,
  GutterMarker,
  Compartment,
  python,
  placeholder,
  MergeView
} from '/static/vendor/codemirror.bundle.js';

// Global state
window.tracerState = {
  editor: null,
  currentLanguage: new Compartment(),
  currentResult: null,
  currentMode: 'debug',
  activeFinding: null
};

// CodeMirror theme - Linear-grade dark console
const tracerTheme = EditorView.theme({
  '&': {
    color: '#ECECEF',
    backgroundColor: '#0B0B0D',
    height: '100%',
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace"
  },
  '.cm-content': {
    caretColor: '#D6FF3A',
    padding: '16px'
  },
  '.cm-cursor': {
    borderLeftColor: '#D6FF3A',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    background: 'rgba(214, 255, 58, 0.15)'
  },
  '.cm-activeLine': {
    background: '#111114'
  },
  '.cm-gutters': {
    backgroundColor: '#0B0B0D',
    color: '#8A8A94',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.07)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#111114',
    color: '#D6FF3A'
  },
  '.cm-placeholder': {
    color: '#8A8A94',
    fontStyle: 'italic'
  }
}, { dark: true });

// Gutter marker for findings
class FindingGutterMarker extends GutterMarker {
  constructor(severity, findingId) {
    super();
    this.severity = severity;
    this.findingId = findingId;
  }
  
  toDOM() {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin: 4px auto;
      cursor: pointer;
      background: ${this.severity === 'critical' ? '#FF5A4E' : this.severity === 'warning' ? '#FFB020' : '#7DD3C8'};
    `;
    dot.onclick = () => {
      focusFinding(this.findingId);
    };
    return dot;
  }
}

// Gutter extension
const findingGutter = gutter({
  class: 'cm-finding-gutter',
  markers: v => v.state.field(gutterMarkers, false) || RangeSet.empty,
  initialSpacer: () => new FindingGutterMarker('info', '')
});

const gutterMarkers = StateField.define({
  create: () => RangeSet.empty,
  update: (markers, tr) => {
    for (let effect of tr.effects) {
      if (effect.is(setGutterMarkersEffect)) {
        return effect.value;
      }
    }
    return markers;
  }
});

const setGutterMarkersEffect = StateEffect.define();

// Highlight decoration for findings
const highlightMark = Decoration.mark({
  class: 'cm-finding-highlight'
});

const highlightField = StateField.define({
  create: () => Decoration.none,
  update: (decorations, tr) => {
    for (let effect of tr.effects) {
      if (effect.is(setHighlightEffect)) {
        return effect.value;
      }
    }
    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f)
});

const setHighlightEffect = StateEffect.define();

// Highlight theme
const highlightTheme = EditorView.baseTheme({
  '.cm-finding-highlight': {
    backgroundColor: 'rgba(214, 255, 58, 0.15)',
    animation: 'fadeHighlight 2s forwards'
  },
  '@keyframes fadeHighlight': {
    '0%': { backgroundColor: 'rgba(214, 255, 58, 0.25)' },
    '100%': { backgroundColor: 'rgba(214, 255, 58, 0.08)' }
  }
});

// Initialize CodeMirror editor
function initEditor() {
  const container = document.getElementById('editorContainer');
  if (!container) {
    console.error('Editor container not found');
    return;
  }
  
  const startState = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      bracketMatching(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      tracerTheme,
      highlightTheme,
      placeholder('Paste your code here, upload a file, or try an example below...'),
      window.tracerState.currentLanguage.of(python()),
      findingGutter,
      gutterMarkers,
      highlightField,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          updateStatusBar();
          // Clear gutter markers if user edits after analysis
          if (window.tracerState.currentResult) {
            clearGutterMarkers();
          }
        }
      })
    ]
  });
  
  window.tracerState.editor = new EditorView({
    state: startState,
    parent: container
  });
  
  updateStatusBar();
  console.log('✓ Editor initialized');
}

// Update status bar (counts real content only, placeholder ignored)
function updateStatusBar() {
  const editor = window.tracerState.editor;
  if (!editor) return;
  
  const doc = editor.state.doc;
  const text = doc.toString();
  const lines = doc.lines;
  const chars = text.length;
  
  const linesEl = document.getElementById('statusLines');
  const charsEl = document.getElementById('statusChars');
  const langEl = document.getElementById('statusLanguage');
  
  if (linesEl) linesEl.textContent = `${lines} lines`;
  if (charsEl) charsEl.textContent = `${chars} chars`;
  
  // Auto-detect language (matches backend logic)
  let lang = 'Python';
  if (text.includes('#include') && (text.includes('printf') || text.includes('scanf'))) {
    lang = 'C';
  } else if (text.includes('#include') || text.includes('std::') || text.includes('cout') || text.includes('cin')) {
    lang = 'C++';
  } else if (text.includes('def ') || text.includes('import ') || text.includes('from ')) {
    lang = 'Python';
  } else if (text.includes('function') || text.includes('const ') || text.includes('let ') || text.includes('console.log')) {
    lang = 'JavaScript';
  } else if (text.includes('public class')) {
    lang = 'Java';
  } else if (text.toUpperCase().includes('SELECT ') || text.toUpperCase().includes('FROM ')) {
    lang = 'SQL';
  }
  
  if (langEl) langEl.textContent = lang;
}

// Set editor content
function setEditorContent(content) {
  const editor = window.tracerState.editor;
  if (!editor) return;
  
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: content }
  });
}

// Get editor content
function getEditorContent() {
  const editor = window.tracerState.editor;
  return editor ? editor.state.doc.toString() : '';
}

// Clear gutter markers
function clearGutterMarkers() {
  const editor = window.tracerState.editor;
  if (!editor) return;
  
  editor.dispatch({
    effects: setGutterMarkersEffect.of(RangeSet.empty)
  });
}

// Set gutter markers from findings
function setGutterMarkers(findings) {
  const editor = window.tracerState.editor;
  if (!editor) return;
  
  try {
    const ranges = [];
    
    for (const f of findings) {
      // Clamp line numbers to doc bounds
      const line = Math.max(1, Math.min(f.line_start, editor.state.doc.lines));
      const lineObj = editor.state.doc.line(line);
      const marker = new FindingGutterMarker(f.severity, f.id);
      ranges.push(marker.range(lineObj.from));
    }
    
    // Sort by position and build RangeSet
    ranges.sort((a, b) => a.from - b.from);
    const rangeSet = RangeSet.of(ranges, true);
    
    editor.dispatch({
      effects: setGutterMarkersEffect.of(rangeSet)
    });
  } catch (error) {
    console.error('Error setting gutter markers:', error);
    // Fall back to empty on error
    editor.dispatch({
      effects: setGutterMarkersEffect.of(RangeSet.empty)
    });
  }
}

// Scroll to and highlight finding in editor
function scrollToFinding(finding) {
  const editor = window.tracerState.editor;
  if (!editor) return;
  
  const start = Math.max(1, Math.min(finding.line_start, editor.state.doc.lines));
  const end = Math.max(start, Math.min(finding.line_end, editor.state.doc.lines));
  
  const startLine = editor.state.doc.line(start);
  const endLine = editor.state.doc.line(end);
  const startPos = startLine.from;
  const endPos = endLine.to;
  
  // Scroll and highlight
  editor.dispatch({
    selection: { anchor: startPos },
    effects: [
      EditorView.scrollIntoView(startPos, { y: 'center' }),
      setHighlightEffect.of(Decoration.set([highlightMark.range(startPos, endPos)]))
    ]
  });
  
  // Clear highlight after 2 seconds
  setTimeout(() => {
    if (window.tracerState.editor) {
      window.tracerState.editor.dispatch({
        effects: setHighlightEffect.of(Decoration.none)
      });
    }
  }, 2000);
}

// Focus finding in report and scroll editor
function focusFinding(findingId) {
  const findingEl = document.querySelector(`[data-finding-id="${findingId}"]`);
  if (!findingEl) return;
  
  // Remove active class from all findings
  document.querySelectorAll('.finding').forEach(el => el.classList.remove('active'));
  findingEl.classList.add('active');
  
  // Scroll finding into view
  findingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  // Update state and scroll editor
  const finding = window.tracerState.currentResult?.findings?.find(f => f.id === findingId);
  if (finding) {
    window.tracerState.activeFinding = findingId;
    scrollToFinding(finding);
  }
}

// Mode switcher buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    
    // Update active state
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    
    // Update mode
    window.tracerState.currentMode = btn.dataset.mode;
  });
});

// Upload button
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');

if (uploadBtn && fileInput) {
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = event => {
      setEditorContent(event.target.result);
      showEmptyState();
      clearGutterMarkers();
    };
    reader.readAsText(file);
  });
}

// Example code snippets
const examples = {
  python: `def calculate_average(numbers):
    total = sum(numbers)
    return total / len(numbers)

# Bug: doesn't handle empty list
result = calculate_average([])
print(result)`,
  
  javascript: `function fetchUserData(userId) {
    const response = fetch('/api/users/' + userId);
    return response.json();
}

// Bug: missing await, improper concatenation
const user = fetchUserData(userInput);
console.log(user);`,
  
  c: `#include <stdio.h>

int main() {
    int numbers[5];
    for (int i = 0; i <= 5; i++) {
        numbers[i] = i * 2;
    }
    return 0;
}

// Bug: array out of bounds`
};

// Example chips
document.querySelectorAll('.example-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.example;
    if (examples[lang]) {
      setEditorContent(examples[lang]);
      showEmptyState();
      clearGutterMarkers();
    }
  });
});

// Trace Code button
const traceBtn = document.getElementById('traceBtn');
if (traceBtn) {
  traceBtn.addEventListener('click', () => {
    runAnalysis();
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  // Cmd/Ctrl+Enter to run analysis
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    runAnalysis();
  }
  
  // Escape to clear active finding
  if (e.key === 'Escape') {
    document.querySelectorAll('.finding').forEach(el => el.classList.remove('active'));
    window.tracerState.activeFinding = null;
  }
  
  // Arrow keys to navigate findings
  if (window.tracerState.currentResult?.findings?.length) {
    const findings = window.tracerState.currentResult.findings;
    const currentIdx = findings.findIndex(f => f.id === window.tracerState.activeFinding);
    
    if (e.key === 'ArrowDown' && currentIdx >= -1 && currentIdx < findings.length - 1) {
      e.preventDefault();
      focusFinding(findings[currentIdx + 1].id);
    }
    
    if (e.key === 'ArrowUp' && currentIdx > 0) {
      e.preventDefault();
      focusFinding(findings[currentIdx - 1].id);
    }
  }
});

// Run analysis via API
async function runAnalysis() {
  const code = getEditorContent().trim();
  const mode = window.tracerState.currentMode;
  
  // Validation: empty code
  if (!code) {
    showErrorState('EMPTY', 'No code provided. Please paste or upload code to analyze.');
    return;
  }
  
  // Validation: too large (>15000 chars)
  if (code.length > 15000) {
    showErrorState('TOO_LARGE', `Code exceeds the 15,000 character limit. Current size: ${code.length.toLocaleString()} characters.`);
    return;
  }
  
  // Show staged loading indicator
  showLoadingState();
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: 'auto', mode })
    });
    
    if (!response.ok) {
      // HTTP error
      const result = await response.json().catch(() => null);
      const errorCode = result?.code || 'HTTP_ERROR';
      const errorMessage = result?.message || `Server returned ${response.status} ${response.statusText}`;
      showErrorState(errorCode, errorMessage);
      return;
    }
    
    const result = await response.json();
    
    if (!result.success) {
      showErrorState(result.code || 'ERROR', result.message || 'Analysis failed.');
      return;
    }
    
    // Store and display result (result is already top-level, no .data wrapper)
    window.tracerState.currentResult = result;
    displayResult(result);
    
  } catch (error) {
    console.error('Network error:', error);
    showErrorState('NETWORK_ERROR', 'Failed to connect to the server. Please check your connection and try again.');
  }
}

// Show staged loading indicator
function showLoadingState() {
  const stages = ['Reading', 'Static check', 'Tracing', 'Verifying', 'Done'];
  let currentStage = 0;
  
  const container = document.getElementById('reportContent');
  container.textContent = ''; // Clear using textContent
  
  // Create loading structure using DOM methods only
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-state';
  
  // Progress stages
  const stagesDiv = document.createElement('div');
  stagesDiv.className = 'progress-stages';
  
  stages.forEach((stageName, idx) => {
    const stageDiv = document.createElement('div');
    stageDiv.className = 'stage';
    stageDiv.dataset.stage = idx;
    stageDiv.textContent = stageName;
    stagesDiv.appendChild(stageDiv);
  });
  
  loadingDiv.appendChild(stagesDiv);
  
  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressFill.style.width = '0%';
  progressBar.appendChild(progressFill);
  loadingDiv.appendChild(progressBar);
  
  // Skeleton findings
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton skeleton-finding';
    loadingDiv.appendChild(skeleton);
  }
  
  container.appendChild(loadingDiv);
  
  // Update verdict
  const verdictEl = document.getElementById('verdict');
  if (verdictEl) verdictEl.textContent = 'Analyzing...';
  
  // Animate stages
  const interval = setInterval(() => {
    if (currentStage >= stages.length) {
      clearInterval(interval);
      return;
    }
    
    const stageEl = stagesDiv.querySelector(`[data-stage="${currentStage}"]`);
    if (stageEl) stageEl.classList.add('active');
    
    const progress = ((currentStage + 1) / stages.length) * 100;
    progressFill.style.width = `${progress}%`;
    
    currentStage++;
  }, 400);
  
  window.tracerLoadingInterval = interval;
}

// Display analysis result
function displayResult(data) {
  try {
    // Clear loading interval
    if (window.tracerLoadingInterval) {
      clearInterval(window.tracerLoadingInterval);
      window.tracerLoadingInterval = null;
    }
    
    // Build verdict headline if missing
    let verdictHeadline = '—';
    if (data.verdict && data.verdict.headline) {
      verdictHeadline = data.verdict.headline;
    } else if (data.findings && data.findings.length > 0) {
      // Client-side headline from findings counts
      const counts = { critical: 0, warning: 0, info: 0 };
      data.findings.forEach(f => {
        if (counts.hasOwnProperty(f.severity)) {
          counts[f.severity]++;
        }
      });
      const total = data.findings.length;
      const parts = [];
      if (total > 0) parts.push(`${total} finding${total === 1 ? '' : 's'}`);
      if (counts.critical > 0) parts.push(`${counts.critical} critical`);
      verdictHeadline = parts.join('. ') + '.';
    } else {
      verdictHeadline = 'No issues found.';
    }
    
    // Update verdict headline
    const verdictEl = document.getElementById('verdict');
    if (verdictEl) verdictEl.textContent = verdictHeadline;
    
    // Update verification badge
    updateVerificationBadge(data.meta?.verification);
    
    // Render content based on mode
    const container = document.getElementById('reportContent');
    container.textContent = ''; // Clear
    
    const mode = window.tracerState.currentMode;
    
    if (mode === 'debug') {
      // Debug mode: Findings + Fix tab
      renderDebugMode(container, data);
    } else {
      // Review mode: Findings + Security + Performance + Practices
      renderReviewMode(container, data);
    }
    
    // Set gutter markers
    if (data.findings?.length) {
      setGutterMarkers(data.findings);
    }
  } catch (error) {
    console.error('Error displaying result:', error);
    showRenderError();
  }
}

// Render findings list using textContent only
function renderFindings(container, findings) {
  if (findings.length === 0) {
    // Empty state
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const emptyTitle = document.createElement('div');
    emptyTitle.className = 'empty-state-title';
    emptyTitle.textContent = 'No issues found';
    
    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = 'Your code looks good! No critical issues detected.';
    
    emptyDiv.appendChild(emptyTitle);
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }
  
  // Findings list
  const listDiv = document.createElement('div');
  listDiv.className = 'findings-list';
  
  findings.forEach((f, idx) => {
    const findingDiv = document.createElement('div');
    findingDiv.className = 'finding';
    findingDiv.dataset.findingId = f.id;
    findingDiv.style.animationDelay = `${idx * 60}ms`;
    
    // Finding number
    const numDiv = document.createElement('div');
    numDiv.className = 'finding-number';
    numDiv.textContent = String(idx + 1).padStart(2, '0');
    
    // Finding content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'finding-content';
    
    // Meta row
    const metaDiv = document.createElement('div');
    metaDiv.className = 'finding-meta';
    
    const severityTag = document.createElement('span');
    severityTag.className = `severity-tag ${f.severity}`;
    severityTag.textContent = f.severity;
    
    const lineChip = document.createElement('span');
    lineChip.className = 'line-chip';
    lineChip.textContent = f.line_start === f.line_end ? `L${f.line_start}` : `L${f.line_start}-${f.line_end}`;
    
    const confidenceDot = document.createElement('span');
    confidenceDot.className = 'confidence-dot';
    confidenceDot.textContent = '●';
    confidenceDot.style.color = f.confidence === 'high' ? 'var(--ok)' : f.confidence === 'medium' ? 'var(--warn)' : 'var(--muted)';
    
    metaDiv.appendChild(severityTag);
    metaDiv.appendChild(lineChip);
    metaDiv.appendChild(confidenceDot);
    
    // Title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'finding-title';
    titleDiv.textContent = f.title;
    
    // Root cause
    const rootDiv = document.createElement('div');
    rootDiv.className = 'finding-detail';
    const rootLabel = document.createElement('strong');
    rootLabel.textContent = 'Root cause: ';
    rootDiv.appendChild(rootLabel);
    rootDiv.appendChild(document.createTextNode(f.root_cause));
    
    // Fix hint
    const fixDiv = document.createElement('div');
    fixDiv.className = 'finding-detail';
    const fixLabel = document.createElement('strong');
    fixLabel.textContent = 'Fix: ';
    fixDiv.appendChild(fixLabel);
    fixDiv.appendChild(document.createTextNode(f.fix_hint));
    
    contentDiv.appendChild(metaDiv);
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(rootDiv);
    contentDiv.appendChild(fixDiv);
    
    findingDiv.appendChild(numDiv);
    findingDiv.appendChild(contentDiv);
    
    // Click handler
    findingDiv.addEventListener('click', () => {
      focusFinding(f.id);
    });
    
    listDiv.appendChild(findingDiv);
  });
  
  container.appendChild(listDiv);
}

// Render debug mode with tabs (Findings + Fix)
function renderDebugMode(container, data) {
  // Create tabs
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'report-tabs';
  
  const findingsTabBtn = document.createElement('button');
  findingsTabBtn.className = 'tab-btn active';
  findingsTabBtn.textContent = 'Findings';
  findingsTabBtn.dataset.tab = 'findings';
  
  const fixTabBtn = document.createElement('button');
  fixTabBtn.className = 'tab-btn';
  fixTabBtn.textContent = 'Fix';
  fixTabBtn.dataset.tab = 'fix';
  
  tabsDiv.appendChild(findingsTabBtn);
  tabsDiv.appendChild(fixTabBtn);
  container.appendChild(tabsDiv);
  
  // Findings panel
  const findingsPanel = document.createElement('div');
  findingsPanel.className = 'tab-panel active';
  findingsPanel.id = 'tab-findings';
  renderFindings(findingsPanel, data.findings || []);
  container.appendChild(findingsPanel);
  
  // Fix panel
  const fixPanel = document.createElement('div');
  fixPanel.className = 'tab-panel';
  fixPanel.id = 'tab-fix';
  renderFixTab(fixPanel, data);
  container.appendChild(fixPanel);
  
  // Tab switching
  findingsTabBtn.addEventListener('click', () => {
    findingsTabBtn.classList.add('active');
    fixTabBtn.classList.remove('active');
    findingsPanel.classList.add('active');
    fixPanel.classList.remove('active');
  });
  
  fixTabBtn.addEventListener('click', () => {
    fixTabBtn.classList.add('active');
    findingsTabBtn.classList.remove('active');
    fixPanel.classList.add('active');
    findingsPanel.classList.remove('active');
  });
}

// Render review mode with tabs (Findings + Security + Performance + Practices)
function renderReviewMode(container, data) {
  // Create tabs
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'report-tabs';
  
  const tabs = [
    { id: 'findings', label: 'Findings' },
    { id: 'security', label: 'Security' },
    { id: 'performance', label: 'Performance' },
    { id: 'practices', label: 'Practices' }
  ];
  
  tabs.forEach((tab, idx) => {
    const btn = document.createElement('button');
    btn.className = idx === 0 ? 'tab-btn active' : 'tab-btn';
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    tabsDiv.appendChild(btn);
  });
  
  container.appendChild(tabsDiv);
  
  // Findings panel
  const findingsPanel = document.createElement('div');
  findingsPanel.className = 'tab-panel active';
  findingsPanel.id = 'tab-findings';
  renderFindings(findingsPanel, data.findings || []);
  container.appendChild(findingsPanel);
  
  // Security panel
  const securityPanel = document.createElement('div');
  securityPanel.className = 'tab-panel';
  securityPanel.id = 'tab-security';
  renderSecurityTab(securityPanel, data.security || []);
  container.appendChild(securityPanel);
  
  // Performance panel
  const perfPanel = document.createElement('div');
  perfPanel.className = 'tab-panel';
  perfPanel.id = 'tab-performance';
  renderPerformanceTab(perfPanel, data.performance || []);
  container.appendChild(perfPanel);
  
  // Practices panel
  const practicesPanel = document.createElement('div');
  practicesPanel.className = 'tab-panel';
  practicesPanel.id = 'tab-practices';
  renderPracticesTab(practicesPanel, data.practices || []);
  container.appendChild(practicesPanel);
  
  // Tab switching
  const tabButtons = tabsDiv.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const targetPanel = container.querySelector(`#tab-${btn.dataset.tab}`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
}

// Render Security tab
function renderSecurityTab(container, items) {
  if (!items || items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = 'Nothing flagged.';
    
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'section-content';
  
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'section-item';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-item-title';
    titleDiv.textContent = item.issue || '';
    
    const riskDiv = document.createElement('div');
    riskDiv.className = 'section-item-text';
    const riskLabel = document.createElement('strong');
    riskLabel.textContent = 'Risk: ';
    riskDiv.appendChild(riskLabel);
    riskDiv.appendChild(document.createTextNode(item.risk || ''));
    
    const solutionDiv = document.createElement('div');
    solutionDiv.className = 'section-item-text';
    const solutionLabel = document.createElement('strong');
    solutionLabel.textContent = 'Solution: ';
    solutionDiv.appendChild(solutionLabel);
    solutionDiv.appendChild(document.createTextNode(item.solution || ''));
    
    itemDiv.appendChild(titleDiv);
    itemDiv.appendChild(riskDiv);
    itemDiv.appendChild(solutionDiv);
    contentDiv.appendChild(itemDiv);
  });
  
  container.appendChild(contentDiv);
}

// Render Performance tab
function renderPerformanceTab(container, items) {
  if (!items || items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = 'Nothing flagged.';
    
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'section-content';
  
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'section-item';
    
    // Items can be strings or objects
    if (typeof item === 'string') {
      const textDiv = document.createElement('div');
      textDiv.className = 'section-item-text';
      textDiv.textContent = item;
      itemDiv.appendChild(textDiv);
    } else if (item && typeof item === 'object') {
      if (item.issue) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-item-title';
        titleDiv.textContent = item.issue;
        itemDiv.appendChild(titleDiv);
      }
      if (item.improvement) {
        const textDiv = document.createElement('div');
        textDiv.className = 'section-item-text';
        textDiv.textContent = item.improvement;
        itemDiv.appendChild(textDiv);
      }
    }
    
    contentDiv.appendChild(itemDiv);
  });
  
  container.appendChild(contentDiv);
}

// Render Practices tab
function renderPracticesTab(container, items) {
  if (!items || items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = 'Nothing flagged.';
    
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'section-content';
  
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'section-item';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'section-item-text';
    
    // Items can be strings or objects
    if (typeof item === 'string') {
      textDiv.textContent = item;
    } else if (item && typeof item === 'object') {
      // Try common properties
      textDiv.textContent = item.practice || item.suggestion || item.text || JSON.stringify(item);
    } else {
      textDiv.textContent = String(item);
    }
    
    itemDiv.appendChild(textDiv);
    contentDiv.appendChild(itemDiv);
  });
  
  container.appendChild(contentDiv);
}
function renderFixTab(container, data) {
  if (!data.fixed_code) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const emptyText = document.createElement('p');
    emptyText.className = 'empty-state-text';
    emptyText.textContent = 'No fix provided.';
    
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }
  
  // Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'diff-actions';
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(data.fixed_code).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn';
  downloadBtn.textContent = 'Download';
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([data.fixed_code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fixed_code.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
  
  actionsDiv.appendChild(copyBtn);
  actionsDiv.appendChild(downloadBtn);
  container.appendChild(actionsDiv);
  
  // Diff container
  const diffContainer = document.createElement('div');
  diffContainer.className = 'diff-container';
  diffContainer.id = 'diffContainer';
  container.appendChild(diffContainer);
  
  // Create MergeView
  const originalCode = getEditorContent();
  
  new MergeView({
    a: {
      doc: originalCode,
      extensions: [
        EditorView.editable.of(false),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.theme({
          '&': { fontSize: '14px', fontFamily: "'JetBrains Mono', monospace" },
          '.cm-gutters': { backgroundColor: '#0B0B0D', color: '#8A8A94', border: 'none' }
        }, { dark: true })
      ]
    },
    b: {
      doc: data.fixed_code,
      extensions: [
        EditorView.editable.of(false),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.theme({
          '&': { fontSize: '14px', fontFamily: "'JetBrains Mono', monospace" },
          '.cm-gutters': { backgroundColor: '#0B0B0D', color: '#8A8A94', border: 'none' }
        }, { dark: true })
      ]
    },
    parent: diffContainer
  });
}

// Update verification badge
function updateVerificationBadge(verification) {
  const badge = document.querySelector('.verification-badge');
  if (!badge || !verification) return;
  
  badge.className = 'verification-badge';
  
  // 3 states: ok (passed), warn (repaired), muted (not verified)
  if (verification.passed === true) {
    badge.classList.add('ok');
    badge.textContent = '✓ ' + (verification.detail || 'Parses cleanly');
    badge.dataset.popover = 'Code parsed successfully without errors.';
  } else if (verification.checked && verification.passed === false) {
    badge.classList.add('warn');
    badge.textContent = '⚠ ' + (verification.detail || 'Repaired once');
    badge.dataset.popover = 'Fix required syntax repairs to be valid.';
  } else {
    badge.classList.add('muted');
    badge.textContent = verification.detail || 'Not verified';
    badge.dataset.popover = 'No verification performed.';
  }
}

// Show verification popover on hover
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.querySelector('.verification-badge');
  if (!badge) return;
  
  let popover = null;
  
  badge.addEventListener('mouseenter', () => {
    const text = badge.dataset.popover;
    if (!text) return;
    
    popover = document.createElement('div');
    popover.className = 'verification-popover';
    popover.textContent = text;
    document.body.appendChild(popover);
    
    const rect = badge.getBoundingClientRect();
    popover.style.left = rect.left + rect.width / 2 + 'px';
    popover.style.top = rect.top - 8 + 'px';
  });
  
  badge.addEventListener('mouseleave', () => {
    if (popover) {
      popover.remove();
      popover = null;
    }
  });
});

// Show empty state (initial)
function showEmptyState() {
  const container = document.getElementById('reportContent');
  container.textContent = ''; // Clear
  
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'empty-state';
  
  const emptyTitle = document.createElement('div');
  emptyTitle.className = 'empty-state-title';
  emptyTitle.textContent = 'No analysis yet';
  
  const emptyText = document.createElement('p');
  emptyText.className = 'empty-state-text';
  const textNode1 = document.createTextNode('Paste or upload source code, then click ');
  const strongNode = document.createElement('strong');
  strongNode.textContent = 'Trace Code';
  const textNode2 = document.createTextNode(' to begin analysis.');
  emptyText.appendChild(textNode1);
  emptyText.appendChild(strongNode);
  emptyText.appendChild(textNode2);
  
  emptyDiv.appendChild(emptyTitle);
  emptyDiv.appendChild(emptyText);
  container.appendChild(emptyDiv);
  
  // Reset verdict
  const verdictEl = document.getElementById('verdict');
  if (verdictEl) verdictEl.textContent = '—';
  
  // Reset verification badge
  const badge = document.querySelector('.verification-badge');
  if (badge) {
    badge.className = 'verification-badge muted';
    badge.textContent = 'Ready';
  }
}

// Show error state
function showErrorState(code, message) {
  const container = document.getElementById('reportContent');
  container.textContent = ''; // Clear
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-state';
  
  // Map error codes to friendly titles and icons
  const errorMap = {
    'EMPTY': { icon: '∅', title: 'No Code Provided' },
    'TOO_LARGE': { icon: '⚠', title: 'Code Too Large' },
    'RATE_LIMITED': { icon: '⏱', title: 'Rate Limited' },
    'LLM_UNAVAILABLE': { icon: '⚡', title: 'Service Unavailable' },
    'BAD_OUTPUT': { icon: '⚠', title: 'Analysis Failed' },
    'NETWORK_ERROR': { icon: '📡', title: 'Network Error' },
    'HTTP_ERROR': { icon: '⚠', title: 'Server Error' }
  };
  
  const errorInfo = errorMap[code] || { icon: '⚠', title: 'Error' };
  
  const errorIcon = document.createElement('div');
  errorIcon.className = 'error-icon';
  errorIcon.textContent = errorInfo.icon;
  
  const errorTitle = document.createElement('div');
  errorTitle.className = 'error-title';
  errorTitle.textContent = errorInfo.title;
  
  const errorMsg = document.createElement('p');
  errorMsg.className = 'error-message';
  errorMsg.textContent = message;
  
  errorDiv.appendChild(errorIcon);
  errorDiv.appendChild(errorTitle);
  errorDiv.appendChild(errorMsg);
  
  // Add retry button for recoverable errors
  if (['NETWORK_ERROR', 'LLM_UNAVAILABLE', 'BAD_OUTPUT', 'HTTP_ERROR'].includes(code)) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      runAnalysis();
    });
    errorDiv.appendChild(retryBtn);
  }
  
  container.appendChild(errorDiv);
  
  // Update verdict
  const verdictEl = document.getElementById('verdict');
  if (verdictEl) verdictEl.textContent = 'Error';
}

// Show render error (separate from API errors)
function showRenderError() {
  const container = document.getElementById('reportContent');
  container.textContent = ''; // Clear
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-state';
  
  const errorIcon = document.createElement('div');
  errorIcon.className = 'error-icon';
  errorIcon.textContent = '⚠';
  
  const errorTitle = document.createElement('div');
  errorTitle.className = 'error-title';
  errorTitle.textContent = 'Display Error';
  
  const errorMsg = document.createElement('p');
  errorMsg.className = 'error-message';
  errorMsg.textContent = 'Something went wrong displaying the report. Check the console for details.';
  
  errorDiv.appendChild(errorIcon);
  errorDiv.appendChild(errorTitle);
  errorDiv.appendChild(errorMsg);
  container.appendChild(errorDiv);
  
  // Update verdict
  const verdictEl = document.getElementById('verdict');
  if (verdictEl) verdictEl.textContent = 'Error';
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    showEmptyState();
  });
} else {
  initEditor();
  showEmptyState();
}

console.log('✓ TRACER AI v2 initialized');
