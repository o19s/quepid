// Simplest CodeMirror 6 implementation
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";

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
  }
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
  
  // Create editor with minimal extensions
  const view = new EditorView({
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        lineNumbers(),
        languageExtension,
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
