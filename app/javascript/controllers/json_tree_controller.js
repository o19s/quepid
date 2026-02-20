import { Controller } from '@hotwired/stimulus';

// Collapsible JSON tree view. Replaces <pre> elements with interactive trees.
// Usage: <div data-controller="json-tree"><pre data-json-tree-target="source">{"key":"val"}</pre></div>
export default class extends Controller {
  static targets = ['source'];

  connect() {
    this._boundToggleClick = this._handleToggleClick.bind(this);
    this.element.addEventListener('click', this._boundToggleClick);
    this.sourceTargets.forEach((pre) => this._renderTree(pre));
  }

  disconnect() {
    this.element.removeEventListener('click', this._boundToggleClick);
  }

  _handleToggleClick(event) {
    const toggle = event.target.closest('.json-tree-toggle');
    if (!toggle) return;
    const container = toggle.parentElement;
    if (!container || container.children.length < 5) return;
    const count = container.children[2];
    const inner = container.children[3];
    const closingBracket = container.children[4];
    const isOpen = inner.style.display !== 'none';
    inner.style.display = isOpen ? 'none' : 'block';
    closingBracket.style.display = isOpen ? 'none' : 'block';
    count.style.display = isOpen ? 'inline' : 'none';
    toggle.textContent = isOpen ? '▶' : '▼';
  }

  _renderTree(pre) {
    const text = pre.textContent;
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
      return; // fall back to plain <pre>
    }

    const tree = document.createElement('div');
    tree.className = 'json-tree';
    tree.appendChild(this._buildNode(data, true));
    pre.style.display = 'none';
    pre.insertAdjacentElement('afterend', tree);
  }

  _buildNode(value, expanded = false) {
    if (value === null) return this._primitive('null', 'json-tree-null');
    if (typeof value === 'boolean') return this._primitive(String(value), 'json-tree-boolean');
    if (typeof value === 'number') return this._primitive(String(value), 'json-tree-number');
    if (typeof value === 'string')
      return this._primitive(`"${this._escapeStr(value)}"`, 'json-tree-string');

    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
    const container = document.createElement('div');

    if (entries.length === 0) {
      container.textContent = isArray ? '[]' : '{}';
      return container;
    }

    const toggle = document.createElement('span');
    toggle.className = 'json-tree-toggle';
    toggle.textContent = expanded ? '▼' : '▶';
    toggle.style.cursor = 'pointer';
    toggle.style.userSelect = 'none';
    container.appendChild(toggle);

    const bracket = document.createElement('span');
    bracket.textContent = isArray ? ' [' : ' {';
    container.appendChild(bracket);

    const count = document.createElement('span');
    count.className = 'json-tree-count';
    count.textContent = ` ${entries.length} ${isArray ? 'items' : 'keys'} `;
    count.style.display = expanded ? 'none' : 'inline';
    container.appendChild(count);

    const inner = document.createElement('div');
    inner.style.paddingLeft = '1.2em';
    inner.style.display = expanded ? 'block' : 'none';

    entries.forEach(([key, val], idx) => {
      const row = document.createElement('div');
      if (!isArray) {
        const keySpan = document.createElement('span');
        keySpan.className = 'json-tree-key';
        keySpan.textContent = `"${this._escapeStr(String(key))}"`;
        row.appendChild(keySpan);
        row.appendChild(document.createTextNode(': '));
      }
      row.appendChild(this._buildNode(val, false));
      if (idx < entries.length - 1) {
        row.appendChild(document.createTextNode(','));
      }
      inner.appendChild(row);
    });

    container.appendChild(inner);

    const closingBracket = document.createElement('div');
    closingBracket.textContent = isArray ? ']' : '}';
    closingBracket.style.display = expanded ? 'block' : 'none';
    container.appendChild(closingBracket);

    return container;
  }

  _primitive(text, className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }

  _escapeStr(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}
