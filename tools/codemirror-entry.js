/**
 * CodeMirror 6 Bundle Entry Point
 * Exports exactly what TRACER AI needs
 */

// Core
export { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, rectangularSelection, crosshairCursor } from '@codemirror/view';
export { EditorState, Compartment } from '@codemirror/state';
export { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
export { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';

// Language support
export { python } from '@codemirror/lang-python';
export { javascript } from '@codemirror/lang-javascript';
export { java } from '@codemirror/lang-java';
export { cpp } from '@codemirror/lang-cpp';
export { sql } from '@codemirror/lang-sql';

// Merge view (for diff in Stop B)
export { MergeView } from '@codemirror/merge';
