// Simplest CodeMirror 6 implementation
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";

// Basic styles for the editor
const basicStyles = EditorView.theme({
  "&": {
    border: "1px solid #ddd",
    fontSize: "14px"
  },
  ".cm-content": {
    fontFamily: "monospace"
  },
  ".cm-gutters": {
    borderRight: "1px solid #ddd",
    backgroundColor: "#f7f7f7"
  },
  ".cm-lint-marker": {
    width: "16px",
    height: "16px"
  },
  ".cm-lint-marker-error": {
    content: "🔴"
  },
  ".cm-lint-marker-warning": {
    content: "⚠️"
  }
});

// JavaScript linter function
const javascriptLinter = linter(view => {
  const diagnostics = [];
  const code = view.state.doc.toString();
  
  try {
    // Basic syntax check using Function constructor
    new Function(code);
  } catch (error) {
    // Parse error location from error message
    const match = error.message.match(/line (\d+)/i);
    const line = match ? parseInt(match[1]) - 1 : 0;
    const pos = view.state.doc.line(Math.min(line + 1, view.state.doc.lines)).from;
    
    diagnostics.push({
      from: pos,
      to: pos + 1,
      severity: "error",
      message: error.message,
      source: "javascript"
    });
  }
  
  // Basic lint checks
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    const pos = view.state.doc.line(index + 1).from;
    
    // Check for console.log (warning)
    if (line.includes('console.log')) {
      const start = pos + line.indexOf('console.log');
      diagnostics.push({
        from: start,
        to: start + 11,
        severity: "warning",
        message: "Consider removing console.log before production",
        source: "javascript"
      });
    }
    
    // Check for missing semicolons (warning)
    const trimmed = line.trim();
    if (trimmed && 
        !trimmed.endsWith(';') && 
        !trimmed.endsWith('{') && 
        !trimmed.endsWith('}') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.includes('if (') &&
        !trimmed.includes('for (') &&
        !trimmed.includes('while (') &&
        !trimmed.includes('function ')) {
      diagnostics.push({
        from: pos + line.length - 1,
        to: pos + line.length,
        severity: "warning",
        message: "Missing semicolon",
        source: "javascript"
      });
    }
  });
  
  return diagnostics;
});

// JSON linter function
const jsonLinter = linter(view => {
  const diagnostics = [];
  const code = view.state.doc.toString().trim();
  
  if (!code) return diagnostics;
  
  try {
    JSON.parse(code);
  } catch (error) {
    // Try to extract position from error message
    let pos = 0;
    const match = error.message.match(/position (\d+)/i);
    if (match) {
      pos = parseInt(match[1]);
    }
    
    diagnostics.push({
      from: Math.min(pos, view.state.doc.length),
      to: Math.min(pos + 1, view.state.doc.length),
      severity: "error",
      message: error.message,
      source: "json"
    });
  }
  
  return diagnostics;
});

/**
 * Create a CodeMirror editor from a textarea
 * Minimal implementation compatible with the original _form.html.erb usage
 */
export function fromTextArea(textarea, options = {}) {
  // Create wrapper div
  const wrapper = document.createElement('div');
  textarea.parentNode.insertBefore(wrapper, textarea);
  textarea.style.display = 'none';
  
  // Choose language extension based on mode
  let languageExtension;
  if (options.mode === 'javascript') {
    languageExtension = javascript();
  } else if (options.mode === 'application/json' || options.mode === 'json') {
    languageExtension = json();
  } else {
    // Default to JavaScript
    languageExtension = javascript();
  }
  
  // Choose appropriate linter
  let linterExtension;
  if (options.mode === 'javascript') {
    linterExtension = javascriptLinter;
  } else if (options.mode === 'application/json' || options.mode === 'json') {
    linterExtension = jsonLinter;
  } else {
    linterExtension = javascriptLinter; // Default to JavaScript linter
  }
  
  // Create editor with minimal extensions including linting
  const view = new EditorView({
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        lineNumbers(),
        lintGutter(),
        languageExtension,
        linterExtension,
        basicStyles
      ]
    }),
    parent: wrapper
  });
  
  // Simple API matching what's used in the form
  const editor = {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value || ""
        }
      });
    },
    setSize: (width, height) => {
      if (height) {
        view.dom.style.height = typeof height === 'number' ? `${height}px` : height;
      }
      if (width) {
        view.dom.style.width = typeof width === 'number' ? `${width}px` : width;
      }
    },
    // Mock methods for compatibility with the form script
    on: () => {},
    clearGutter: () => {},
    setGutterMarker: () => {}
  };
  
  // Store editor reference on textarea
  textarea.editor = editor;
  
  // Update textarea before form submission
  if (textarea.form) {
    textarea.form.addEventListener('submit', () => {
      textarea.value = editor.getValue();
    });
  }
  

  
  return editor;
}

// Setup global CodeMirror object for compatibility
export function setupGlobalCodeMirror() {
  window.CodeMirror = {
    fromTextArea,
    // Add compatibility stubs
    Pos: () => ({ line: 0, ch: 0 }),
    signal: () => {}
  };
}
