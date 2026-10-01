import { Controller } from "@hotwired/stimulus"

const DEFAULT_EAST_PANE_WIDTH = 450

export default class extends Controller {
  static targets = ["east", "main", "slider"]

  connect() {
    this.toggled = false
    this.eastPaneWidth = DEFAULT_EAST_PANE_WIDTH
    this.onMouseUp = this.releaseSlider.bind(this)

    this.refreshElements()
  }

  disconnect() {
    this.releaseSlider()
    document.removeEventListener("mouseup", this.onMouseUp)
  }

  refreshElements() {
    this.container = this.element
    this.east = this.hasEastTarget ? this.eastTarget : null
    this.main = this.hasMainTarget ? this.mainTarget : null
    this.slider = this.hasSliderTarget ? this.sliderTarget : null

    if (!this.container || !this.east || !this.main || !this.slider) return

    this.slider.onmousedown = this.grabSlider.bind(this)
    document.addEventListener("mouseup", this.onMouseUp)

    if (this.container.offsetWidth === 0) {
      window.setTimeout(() => this.refreshElements(), 200)
      return
    }

    this.setupPane()
  }

  toggle() {
    this.toggled = !this.toggled
    this.setupPane()
  }

  setupPane() {
    if (!this.container || !this.east || !this.main || !this.slider) return

    if (this.toggled) {
      this.slider.onmousedown = this.grabSlider.bind(this)
      this.east.style.display = "block"
      this.moveEastTo(this.container.offsetWidth - DEFAULT_EAST_PANE_WIDTH)
      this.slider.style.display = "block"
    } else {
      this.slider.onmousedown = null
      this.slider.style.display = "none"
      this.east.style.display = "none"
      this.moveEastTo(this.container.offsetWidth)
    }
  }

  grabSlider() {
    this.onDrag = this.drag.bind(this)
    document.addEventListener("mousemove", this.onDrag)
    this.east.style.display = "block"
    return false
  }

  releaseSlider() {
    if (!this.onDrag) return
    document.removeEventListener("mousemove", this.onDrag)
    this.onDrag = null
  }

  drag(event) {
    this.moveEastTo(event.clientX)
    this.eastPaneWidth = this.east.offsetWidth
  }

  resize() {
    if (!this.container) return
    this.moveEastTo(this.toggled ? this.container.offsetWidth - this.eastPaneWidth : this.container.offsetWidth)
  }

  moveEastTo(x) {
    if (!this.container || !this.east || !this.main || !this.slider) return

    this.slider.style.left = `${x}px`
    this.east.style.left = `${6 + x}px`
    this.main.style.width = `${x}px`
    this.east.style.width = `${this.container.offsetWidth - x}px`
  }
}
