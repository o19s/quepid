import { Controller } from "@hotwired/stimulus"

/**
 * Renders one live search result. Angular still owns the surrounding query
 * state and rating mutations; this controller temporarily reads that scope
 * until the query/document store migration is complete.
 */
export default class extends Controller {
  static targets = ["content"]
  static values = { explainView: String }

  connect() {
    this.handleRatingChange = () => {
      requestAnimationFrame(() => this.refreshRating())
    }
    this.element.addEventListener("rating-popover:rate", this.handleRatingChange)
    this.element.addEventListener("rating-popover:reset", this.handleRatingChange)
    this.initialize()
  }

  initialize() {
    const angularElement = window.angular?.element(this.element)
    this.angularScope = angularElement?.isolateScope?.() || angularElement?.scope?.()
    if (!this.angularScope) {
      this.retryHandle = requestAnimationFrame(() => this.initialize())
      return
    }

    this.angularScope.$watch(() => this.angularScope.doc, () => this.render())

    this.render()
  }

  disconnect() {
    if (this.retryHandle) cancelAnimationFrame(this.retryHandle)
    this.element.removeEventListener("rating-popover:rate", this.handleRatingChange)
    this.element.removeEventListener("rating-popover:reset", this.handleRatingChange)
    this.angularScope = null
  }

  render() {
    if (!this.angularScope || !this.hasContentTarget) return

    const { doc, query } = this.angularScope
    if (!doc || !query) return

    this.contentTarget.replaceChildren(this.renderResult(doc, query))
  }

  refreshRating() {
    if (!this.angularScope) return
    const trigger = this.element.querySelector(".single-rating .btn")
    if (!trigger) return
    const doc = this.angularScope.doc
    const rating = doc.hasRating() ? doc.getRating() : "--"
    trigger.firstChild.textContent = `${rating} `
    const scale = this.angularScope.ratings?.scale || {}
    const color = this.ratingColor(rating, scale)
    trigger.style.backgroundColor = color
  }

  renderResult(doc, query) {
    const row = document.createElement("div")
    row.className = "row"
    row.innerHTML = `
      <div class="col-md-10" style="position: relative">
        <div class="col-ratings"><div class="ratings"></div></div>
        <div class="col-summary d-flex">
          <div class="result-thumb-col flex-shrink-0 text-center me-2 d-none"><img class="img-thumbnail result-thumbnail"></div>
          <div class="result-image-col flex-shrink-0 text-center me-2 d-none"><img class="img-thumbnail result-image"></div>
          <ul class="subfields flex-grow-1"></ul>
        </div>
      </div>
      ${this.explainViewValue === "full" ? '<div class="col-md-2"><div class="stacked-chart-container" data-controller="match-explain"></div></div>' : ""}
    `

    const ratings = row.querySelector(".ratings")
    if (doc.error === undefined) ratings.appendChild(this.ratingControl(doc))

    this.renderImage(row, ".result-thumb-col", ".result-thumbnail", doc.thumb, doc.thumb_options, doc.hasThumb?.())
    this.renderImage(row, ".result-image-col", ".result-image", doc.image, doc.image_options, doc.hasImage?.())

    const fields = row.querySelector(".subfields")
    const title = document.createElement("li")
    title.className = "subTitle"
    const titleLink = document.createElement("a")
    titleLink.href = "#"
    titleLink.textContent = doc.title ?? ""
    titleLink.addEventListener("click", (event) => {
      event.preventDefault()
      this.angularScope.showDoc()
    })
    title.appendChild(titleLink)
    fields.appendChild(title)

    if (doc.error) {
      const error = document.createElement("li")
      error.innerHTML = '<div class="alert alert-danger"><i class="bi bi-exclamation-triangle-fill"></i> This document can\'t be uniquely identified, so Quepid can\'t store ratings for this document. <br><span></span>.</div>'
      this.appendSanitized(error.querySelector("span"), doc.error)
      fields.appendChild(error)
    }

    this.appendFields(fields, doc.embeds, (name, value) => this.embedField(name, value))
    this.appendFields(fields, doc.translations, (name, value) => this.htmlField(name, value, true))
    this.appendFields(fields, doc.unabridgeds, (name, value) => this.htmlField(name, value))

    const snippets = doc.subSnippets("<strong>", "</strong>")
    this.appendFields(fields, snippets, (name, value) => this.snippetField(name, value, doc))

    const rank = document.createElement("li")
    rank.className = "result-rank"
    rank.textContent = `Rank: #${this.element.getAttribute("rank") || ""}`
    fields.appendChild(rank)

    if (this.explainViewValue === "full") {
      const explain = row.querySelector("[data-controller=match-explain]")
      explain.setAttribute("data-match-explain-data-value", JSON.stringify(this.angularScope.matchExplainData()))
    }

    const footer = document.createElement("div")
    if (query.depthOfRating === Number(this.element.getAttribute("rank"))) {
      footer.className = "text-muted text-warning"
      footer.textContent = "Results above are counted in scoring."
    }

    const wrapper = document.createElement("div")
    wrapper.append(row, footer)
    return wrapper
  }

  ratingControl(doc) {
    const container = document.createElement("div")
    container.className = "single-rating"
    container.dataset.controller = "rating-popover"
    container.dataset.ratingPopoverScaleValue = JSON.stringify(this.angularScope.ratings?.scale || {})

    const trigger = document.createElement("span")
    trigger.className = "btn"
    const rating = doc.hasRating() ? doc.getRating() : "--"
    trigger.textContent = `${rating} `
    const icon = document.createElement("i")
    icon.className = "bi bi-caret-down-fill"
    icon.setAttribute("aria-hidden", "true")
    trigger.appendChild(icon)
    const scale = this.angularScope.ratings?.scale || {}
    trigger.style.backgroundColor = this.ratingColor(rating, scale)
    container.appendChild(trigger)
    return container
  }

  renderImage(row, wrapperSelector, imageSelector, value, options, visible) {
    if (!visible) return
    const wrapper = row.querySelector(wrapperSelector)
    const image = row.querySelector(imageSelector)
    image.src = `${options?.prefix || ""}${value}`
    image.alt = ""
    wrapper.classList.remove("d-none")
  }

  ratingColor(rating, scale) {
    const style = window.quepidSearch?.scoring?.ratingBackgroundColor?.({ rating, scale })
    return style?.["background-color"] || scale[rating]?.color || ""
  }

  appendFields(parent, values, renderer) {
    Object.entries(values || {}).forEach(([name, value]) => parent.appendChild(renderer(name, value)))
  }

  fieldLabel(name) {
    const label = document.createElement("span")
    label.className = "subLabel"
    label.textContent = `${name}:`
    return label
  }

  embedField(name, value) {
    const item = document.createElement("li")
    item.append(this.fieldLabel(name))
    const media = document.createElement("span")
    const source = String(value ?? "")
    const extension = source.split("?")[0].split(".").pop()?.toLowerCase()
    if (["mp3", "wav", "ogg"].includes(extension)) {
      const audio = document.createElement("audio")
      audio.controls = true
      audio.src = source
      media.appendChild(audio)
    } else if (["mp4", "webm"].includes(extension)) {
      const video = document.createElement("video")
      video.controls = true
      video.src = source
      media.appendChild(video)
    } else if (["jpg", "jpeg", "gif", "png"].includes(extension)) {
      const image = document.createElement("img")
      image.src = source
      image.alt = ""
      media.appendChild(image)
    } else {
      media.textContent = source
    }
    item.appendChild(media)
    return item
  }

  htmlField(name, value, translation = false) {
    const item = document.createElement("li")
    item.append(this.fieldLabel(name))
    const content = document.createElement("span")
    this.appendSanitized(content, value)
    item.appendChild(content)
    if (translation) {
      const link = document.createElement("a")
      link.href = `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(value ?? "")}`
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      link.appendChild(Object.assign(document.createElement("img"), { src: "images/google-translate.png", width: 16, height: 16 }))
      item.appendChild(link)
    }
    return item
  }

  snippetField(name, value, doc) {
    const item = this.htmlField(name, value)
    const rawValue = this.angularScope.resolveFieldValue(name)
    const text = String(rawValue ?? "")
    const content = item.lastElementChild
    if (typeof rawValue === "object") {
      content.replaceChildren()
      content.dataset.controller = "json-explorer"
      content.dataset.jsonExplorerJsonValue = JSON.stringify(rawValue)
    } else if (/^\s*https?:/.test(text)) {
      content.replaceChildren()
      const link = document.createElement("a")
      link.href = text
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      link.textContent = text
      content.appendChild(link)
    }
    return item
  }

  appendSanitized(element, value, prefix = "") {
    const injector = window.angular?.element(document.body).injector?.()
    const sanitize = injector?.get?.("$sanitize")
    element.innerHTML = `${prefix}${sanitize ? sanitize(String(value ?? "")) : String(value ?? "")}`
  }
}
