import { Controller } from "@hotwired/stimulus"

const DEFAULT_EAST_WIDTH = 450
const SLIDER_WIDTH = 6

export default class extends Controller {
  static targets = ["main", "slider", "east"]

  connect() {
    this.eastPaneWidth = DEFAULT_EAST_WIDTH
    this.toggled = false
    this.dragging = false

    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onResize = this._onResize.bind(this)
    this._onToggle = this._onToggle.bind(this)

    window.addEventListener("resize", this._onResize)
    document.addEventListener("toggleEast", this._onToggle)

    this._setupPane()
  }

  disconnect() {
    window.removeEventListener("resize", this._onResize)
    document.removeEventListener("toggleEast", this._onToggle)
    document.removeEventListener("mousemove", this._onMouseMove)
    document.removeEventListener("mouseup", this._onMouseUp)
  }

  // Public Stimulus action for toggling the east pane
  toggle() {
    this.toggled = !this.toggled
    this._setupPane()
  }

  _onToggle() {
    this.toggle()
  }

  _setupPane() {
    if (this.toggled) {
      this._moveEastTo(this.element.offsetWidth - this.eastPaneWidth)
      this.sliderTarget.classList.remove("d-none")
      this.eastTarget.classList.remove("d-none")
      // The CSS base rules (.pane_east, .east-slider) set display:none,
      // so removing d-none alone is not enough — override with inline style.
      this.sliderTarget.style.display = "block"
      this.eastTarget.style.display = "block"
    } else {
      this._moveEastTo(this.element.offsetWidth)
      this.sliderTarget.classList.add("d-none")
      this.eastTarget.classList.add("d-none")
      // Clear inline override so the CSS rule takes effect
      this.sliderTarget.style.display = ""
      this.eastTarget.style.display = ""
    }
  }

  _moveEastTo(x) {
    this.sliderTarget.style.left = x + "px"
    this.eastTarget.style.left = SLIDER_WIDTH + x + "px"
    this.mainTarget.style.width = x + "px"
    this.eastTarget.style.width = this.element.offsetWidth - x + "px"
  }

  // Stimulus action: data-action="mousedown->resizable-pane#grabSlider"
  grabSlider(event) {
    event.preventDefault()
    this.dragging = true
    this.eastTarget.classList.remove("d-none")
    this.eastTarget.style.display = "block"
    document.addEventListener("mousemove", this._onMouseMove)
    document.addEventListener("mouseup", this._onMouseUp)
  }

  _onMouseMove(event) {
    if (!this.dragging) return
    this._moveEastTo(event.clientX)
    this.eastPaneWidth = this.eastTarget.offsetWidth
  }

  _onMouseUp() {
    this.dragging = false
    document.removeEventListener("mousemove", this._onMouseMove)
    document.removeEventListener("mouseup", this._onMouseUp)
  }

  _onResize() {
    if (this.toggled) {
      this._moveEastTo(this.element.offsetWidth - this.eastPaneWidth)
    } else {
      this._moveEastTo(this.element.offsetWidth)
    }
  }
}
