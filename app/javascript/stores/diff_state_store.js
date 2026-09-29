/**
 * Comparison selection state.
 *
 * Snapshot fetching and diff scoring still use the compatibility adapter, but
 * the selected snapshot ids no longer need to live in a framework service.
 */
export class DiffStateStore extends EventTarget {
  constructor() {
    super()
    this.reset()
  }

  reset() {
    this._selections = []
    this._disabled = false
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  enable(selections = []) {
    this._selections = selections.map(String)
    this._disabled = false
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  disable() {
    this._selections = []
    this._disabled = true
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  selections() {
    return this._disabled ? [] : [...this._selections]
  }

  snapshot() {
    return {
      selections: this.selections(),
      disabled: this._disabled
    }
  }
}

export const diffStateStore = new DiffStateStore()
