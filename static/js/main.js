/**
 * TRACER AI v2 - Main Application
 * Using bundled CodeMirror (no CDN dependencies)
 */

import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  EditorState,
  Compartment,
  defaultKeymap,
  history,
  historyKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
  python,
  javascript,
  java,
  cpp,
  sql
} from '/static/vendor/codemirror.bundle.js';

// Custom theme using design tokens
const tracerTheme = EditorView.theme({
  '&': {
    color: '#EDE6D6',
    backgroundColor: '#0E0D0B',
    height: '100%',
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace"
  },
  '.cm-content': {
    caretColor: '#D6FF3A',
    padding: '16px 0'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#D6FF3A',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#2B2721'
  },
  '.cm-activeLine': {
    backgroundColor: '#151310'
  },
  '.cm-gutters': {
    backgroundColor: '#0E0D0B',
    color: '#8D8574',
    border: 'none',
    borderRight: '1px solid #2B2721',
    paddingRight: '8px'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#151310',
    color: '#D6FF3A'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px',
    minWidth: '32px',
    textAlign: 'right'
  },
  '.cm-line': {
    padding: '0 0 0 8px'
  },
  '.cm-foldGutter': {
    width: '16px'
  }
}, { dark: true });

// Syntax highlighting theme using design tokens
const tracerHighlightStyle = syntaxHighlighting(defaultHighlightStyle);

// Store editor globally
window.tracerEditor = null;
window.tracerLanguages = { python, javascript, java, cpp, sql };
window.currentLanguage = new Compartment();

// Placeholder text for empty editor
const placeholderText = `# TRACER AI - Code Analysis Tool

# Paste your code here, upload a file, or try an example below

def example():
    pass
`;

// Basic extensions
const basicExtensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  history(),
  foldGutter(),
  drawSelection(),
  rectangularSelection(),
  crosshairCursor(),
  bracketMatching(),
  indentOnInput(),
  tracerHighlightStyle,
  keymap.of([...defaultKeymap, ...historyKeymap]),
  EditorView.lineWrapping,
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      updateStatus();
    }
  })
];

// Initialize editor
function initEditor() {
  const container = document.getElementById('editorContainer');
  
  if (!container) {
    console.error('Editor container not found');
    return;
  }

  try {
    const startState = EditorState.create({
      doc: placeholderText,
      extensions: [
        ...basicExtensions,
        window.currentLanguage.of(python()),
        tracerTheme
      ]
    });

    const editor = new EditorView({
      state: startState,
      parent: container
    });

    window.tracerEditor = editor;
    updateStatus();
    
    console.log('✓ CodeMirror editor initialized successfully');
    console.log('✓ Line numbers visible:', document.querySelector('.cm-lineNumbers') !== null);
    console.log('✓ Cursor visible:', document.querySelector('.cm-cursor') !== null);
  } catch (error) {
    console.error('Failed to initialize editor:', error);
    throw error;
  }
}

// Update status bar
function updateStatus() {
  if (!window.tracerEditor) return;
  
  const doc = window.tracerEditor.state.doc;
  const text = doc.toString();
  const lines = doc.lines;
  const chars = text.length;
  
  const statusLines = document.getElementById('statusLines');
  const statusChars = document.getElementById('statusChars');
  const statusLanguage = document.getElementById('statusLanguage');
  
  if (statusLines) statusLines.textContent = `${lines} lines`;
  if (statusChars) statusChars.textContent = `${chars} chars`;
  
  // Update language based on content heuristics
  let detectedLang = 'Python';
  if (text.includes('function ') || text.includes('const ') || text.includes('let ')) {
    detectedLang = 'JavaScript';
  } else if (text.includes('public class') || text.includes('public static void')) {
    detectedLang = 'Java';
  } else if (text.includes('SELECT ') || text.includes('FROM ')) {
    detectedLang = 'SQL';
  } else if (text.includes('#include') || text.includes('std::')) {
    detectedLang = 'C++';
  }
  
  if (statusLanguage) statusLanguage.textContent = detectedLang;
}

// Set editor content
function setEditorContent(content) {
  if (!window.tracerEditor) return;
  
  const transaction = window.tracerEditor.state.update({
    changes: {
      from: 0,
      to: window.tracerEditor.state.doc.length,
      insert: content
    }
  });
  window.tracerEditor.dispatch(transaction);
  updateStatus();
}

// Mode switcher
function initModeSwitch() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Don't switch if disabled
      if (btn.classList.contains('disabled')) return;
      
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    });
  });
}

// Upload button
function initUpload() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  
  if (!uploadBtn || !fileInput) return;
  
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditorContent(event.target.result);
    };
    reader.readAsText(file);
  });
}

// Trace button (placeholder for Stop B)
function initTraceButton() {
  const traceBtn = document.getElementById('traceBtn');
  if (!traceBtn) return;
  
  traceBtn.addEventListener('click', () => {
    const statusMessage = document.getElementById('statusMessage');
    const verdict = document.getElementById('verdict');
    
    if (statusMessage) statusMessage.textContent = 'Tracing...';
    if (verdict) verdict.textContent = 'Analysis in progress...';
    
    // Actual API call will be implemented in Stop B
    setTimeout(() => {
      if (statusMessage) statusMessage.textContent = 'Ready';
      if (verdict) verdict.textContent = '—';
    }, 1000);
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

// Example buttons
function initExamples() {
  document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.example;
      if (examples[lang]) {
        setEditorContent(examples[lang]);
      }
    });
  });
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + Enter to trace
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const traceBtn = document.getElementById('traceBtn');
      if (traceBtn) traceBtn.click();
    }
    
    // Escape to clear focus
    if (e.key === 'Escape') {
      document.activeElement.blur();
    }
  });
}

// Initialize everything when DOM is ready
function init() {
  console.log('Initializing TRACER AI...');
  try {
    initEditor();
    initModeSwitch();
    initUpload();
    initTraceButton();
    initExamples();
    initKeyboardShortcuts();
    console.log('✓ Initialization complete');
    console.log('✓ Please verify: editor shows line numbers, syntax colors, cursor, accepts typing');
  } catch (error) {
    console.error('✗ Initialization failed:', error);
    throw error;
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
