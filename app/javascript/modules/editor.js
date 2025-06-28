// Simplest CodeMirror 6 implementation
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Syntax highlighting theme - CodeMirror 5 default colors
const highlightStyle = HighlightStyle.define([
  // Keywords
  {tag: tags.keyword, color: "#708"},
  
  // Function names
  {tag: tags.function(tags.variableName), color: "#00f"},
  {tag: tags.function(tags.definition(tags.variableName)), color: "#00f"},
  
  // Variable names
  {tag: tags.variableName, color: "#000"},
  {tag: tags.definition(tags.variableName), color: "#00f"},
  
  // Types and class names
  {tag: tags.typeName, color: "#085"},
  {tag: tags.className, color: "#00f"},
  
  // Strings
  {tag: tags.string, color: "#a11"},
  
  // Numbers
  {tag: tags.number, color: "#164"},
  
  // Booleans
  {tag: tags.bool, color: "#708"},
  
  // Comments
  {tag: tags.comment, color: "#a50"},
  {tag: tags.lineComment, color: "#a50"},
  {tag: tags.blockComment, color: "#a50"},
  
  // Operators
  {tag: tags.operator, color: "#000"},
  {tag: tags.compareOperator, color: "#000"},
  {tag: tags.arithmeticOperator, color: "#000"},
  {tag: tags.logicOperator, color: "#000"},
  
  // Punctuation and brackets
  {tag: tags.punctuation, color: "#000"},
  {tag: tags.bracket, color: "#997"},
  {tag: tags.squareBracket, color: "#997"},
  {tag: tags.paren, color: "#997"},
  {tag: tags.brace, color: "#997"},
  
  // JSON specific
  {tag: tags.propertyName, color: "#a11"},
  {tag: tags.separator, color: "#000"},
  
  // Special constructs
  {tag: tags.regexp, color: "#e40"},
  {tag: tags.escape, color: "#f50"},
  {tag: tags.special(tags.string), color: "#f50"},
  
  // Invalid/error highlighting
  {tag: tags.invalid, color: "#f00"},
  
  // Control flow
  {tag: tags.controlKeyword, color: "#708"},
  {tag: tags.operatorKeyword, color: "#708"},
  
  // Definitions
  {tag: tags.definition(tags.function(tags.variableName)), color: "#00f"},
  {tag: tags.definition(tags.propertyName), color: "#00f"},
  
  // Modules and imports
  {tag: tags.moduleKeyword, color: "#708"},
  {tag: tags.namespace, color: "#000"},
  
  // Attributes (for future HTML/XML support)
  {tag: tags.attributeName, color: "#00c"},
  {tag: tags.attributeValue, color: "#a11"},
  
  // Meta information
  {tag: tags.meta, color: "#555"}
]);

// Basic styles for the editor
const basicStyles = EditorView.theme({
  "&": {
    border: "1px solid #ddd",
    fontSize: "14px"
  },
  ".cm-content": {
    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    lineHeight: "1.5"
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
  },
  // Selection highlighting
  ".cm-selectionBackground": {
    backgroundColor: "#d4edda !important"
  },
  // Current line highlighting
  ".cm-activeLine": {
    backgroundColor: "#f8f9fa"
  },
  // Search match highlighting
  ".cm-searchMatch": {
    backgroundColor: "#fff3cd",
    border: "1px solid #ffeaa7"
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "#ffc107"
  },
  // Focused editor
  "&.cm-focused": {
    outline: "2px solid #007bff",
    outlineOffset: "-2px"
  },
  // Read-only editor styling
  "&.cm-readonly": {
    backgroundColor: "#f8f9fa",
    cursor: "default"
  },
  "&.cm-readonly .cm-content": {
    backgroundColor: "#f8f9fa"
  },
  "&.cm-readonly .cm-gutters": {
    backgroundColor: "#e9ecef"
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
 */
export function fromTextArea(textarea, options = {}) {
  // Create wrapper div
  const wrapper = document.createElement('div');
  textarea.parentNode.insertBefore(wrapper, textarea);
  textarea.style.display = 'none';
  
  // Choose language extension based on mode
  let languageExtension = null;
  let isJsonMode = false;
  if (options.mode === 'javascript') {
    languageExtension = javascript();
  } else if (options.mode === 'application/json' || options.mode === 'json') {
    languageExtension = json();
    isJsonMode = true;
  } else {
    // Default to JavaScript
    languageExtension = javascript();
  }
  
  // Choose appropriate linter
  let linterExtension = null;
  if (options.mode === 'javascript') {
    linterExtension = javascriptLinter;
  } else if (options.mode === 'application/json' || options.mode === 'json') {
    linterExtension = jsonLinter;
  } else {
    linterExtension = javascriptLinter; // Default to JavaScript linter
  }
  
  // Create editor with minimal extensions including linting
  const extensions = [
    lineNumbers(),
    lintGutter(),
    languageExtension,
    linterExtension,
    syntaxHighlighting(highlightStyle),
    basicStyles,
    // Additional enhancements
    EditorView.lineWrapping,
    EditorState.tabSize.of(2)
  ];
  
  // Add readOnly extension if specified
  if (options.readOnly) {
    extensions.push(EditorView.editable.of(false));
  }
  
  const view = new EditorView({
    state: EditorState.create({
      doc: textarea.value,
      extensions: extensions
    }),
    parent: wrapper
  });
  
  // Apply size options if provided
  if (options.height) {
    view.dom.style.height = typeof options.height === 'number' ? `${options.height}px` : options.height;
  }
  if (options.width) {
    view.dom.style.width = typeof options.width === 'number' ? `${options.width}px` : options.width;
  }
  
  // Apply readOnly option if provided
  if (options.readOnly) {
    view.dom.classList.add('cm-readonly');
  }
  
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
    formatJSON: () => {
      const currentValue = view.state.doc.toString();
      try {
        // Skip empty content
        if (!currentValue.trim()) return true;
        
        // Parse and stringify with pretty formatting (2 space indentation)
        const formatted = JSON.stringify(JSON.parse(currentValue), null, 2);
        
        // Only update if the formatted content is different
        if (formatted !== currentValue) {
          // Update editor content
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: formatted
            }
          });
        }
        return true;
      } catch (e) {
        console.error("JSON formatting failed:", e);
        return false;
      }
    }
  };
  
  // Store editor reference on textarea
  textarea.editor = editor;
  
  // Update textarea before form submission
  if (textarea.form) {
    textarea.form.addEventListener('submit', () => {
      textarea.value = editor.getValue();
    });
  }
  
  // Automatically format JSON content if in JSON mode
  if (isJsonMode && textarea.value.trim()) {
    try {
      // Only format if it's valid JSON
      JSON.parse(textarea.value);
      // Format after a small delay to ensure editor is fully initialized
      setTimeout(() => editor.formatJSON(), 0);
    } catch (e) {
      // If invalid JSON, don't attempt to format
      console.log("Initial JSON content is invalid, skipping auto-formatting");
    }
  }
  
  return editor;
}

// Helper function to simplify initialization
export function whenReady(callback) {
  function checkReady() {
    if (typeof CodeMirror === 'undefined') {
      setTimeout(checkReady, 100);
      return;
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }
  
  checkReady();
}

// Helper function to format JSON string (internal use)
function formatJSON(json) {
  try {
    // Skip empty content
    if (!json || !json.trim()) return json;
    
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch (e) {
    console.error("JSON formatting failed:", e);
    return json;
  }
}

// Setup global CodeMirror object for compatibility
export function setupGlobalCodeMirror() {
  console.log('Setting up global CodeMirror object');
  window.CodeMirror = {
    fromTextArea,
    whenReady,
    formatJSON
  };
  console.log('CodeMirror setup complete:', typeof window.CodeMirror);
}
