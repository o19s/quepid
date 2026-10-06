import { Controller } from "@hotwired/stimulus"
import { sanitizeSnippetHtml } from "utils/html"
import { ratingBackgroundColor } from "utils/scoring"

/**
 * Renders one document snapshot. Search, rating mutations, and detailed
 * document commands remain outside this renderer behind the parent controller.
 */
export default class extends Controller {
  static targets = ["content"]
  static values = { explainView: String, version: Number }

  connect() {
    this.render()
  }

  // search-results bumps the version when this document or its query context changed.
  versionValueChanged(version) {
    if (this.renderedVersion !== undefined && this.renderedVersion !== version) this.render()
  }

  disconnect() {
    // The parent search-results controller owns mutation listeners.
  }

  render() {
    if (!this.hasContentTarget || !this.documentSnapshot) return
    this.renderedDocument = this.documentSnapshot
    this.renderedVersion = this.versionValue
    this.contentTarget.replaceChildren(this.renderResult(this.documentSnapshot, this.querySnapshot))
  }

  get documentSnapshot() {
    return this.element.__searchResultDocument
  }

  get querySnapshot() {
    return this.element.__searchResultQuery || {}
  }

  renderResult(doc, query) {
    // The row skeleton is the ERB `<template id="search-result-template">` in
    // core/_query_list_templates.html.erb.
    const row = document.getElementById("search-result-template").content.firstElementChild.cloneNode(true)
    const slot = name => row.querySelector(`[data-slot="${name}"]`)
    const showExplain = this.explainViewValue === "full" && doc.matchExplain
    if (!showExplain) slot("matchExplainColumn").remove()

    if (doc.error === undefined) slot("ratings").appendChild(this.ratingControl(doc, query.ratingScale || {}))

    this.renderImage(slot("thumbColumn"), slot("thumb"), doc.thumb, doc.thumb_options, doc.hasThumb)
    this.renderImage(slot("imageColumn"), slot("image"), doc.image, doc.image_options, doc.hasImage)

    const fields = slot("fields")
    const title = document.createElement("li")
    title.className = "subTitle"
    const titleLink = document.createElement("a")
    titleLink.href = "#"
    titleLink.textContent = doc.title ?? ""
    titleLink.dataset.action = "search-result#showDocument"
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

    this.appendFields(fields, doc.snippets, (name, value) => this.snippetField(name, value, doc))

    const rank = document.createElement("li")
    rank.className = "result-rank"
    rank.textContent = `Rank: #${this.element.getAttribute("rank") || ""}`
    fields.appendChild(rank)

    if (showExplain) slot("matchExplain").setAttribute("data-match-explain-data-value", JSON.stringify(doc.matchExplain))

    const footer = document.createElement("div")
    if (query.depthOfRating === Number(this.element.getAttribute("rank"))) {
      footer.className = "text-muted text-warning"
      footer.textContent = "Results above are counted in scoring."
    }

    const wrapper = document.createElement("div")
    wrapper.append(row, footer)
    return wrapper
  }

  showDocument(event) {
    event.preventDefault()
    this.element.dispatchEvent(new CustomEvent("search-result:show-document", {
      bubbles: true,
      detail: { docId: this.renderedDocument.id }
    }))
  }

  ratingControl(doc, scale) {
    const rating = doc.rating ?? "--"
    return createRatingControl(rating, scale)
  }

  renderImage(wrapper, image, value, options, visible) {
    if (!visible) return
    image.src = `${options?.prefix || ""}${value}`
    image.alt = ""
    wrapper.classList.remove("d-none")
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
    item.append(this.fieldLabel(name), " ")
    const media = document.createElement("span")
    const source = String(value ?? "")
    const extension = source.split("?")[0].split(".").pop()?.toLowerCase()
    if (["mp3", "wav", "ogg"].includes(extension)) {
      const audio = document.createElement("audio")
      audio.className = "media-embed"
      audio.controls = true
      audio.src = source
      media.appendChild(audio)
    } else if (["mp4", "webm"].includes(extension)) {
      const video = document.createElement("video")
      video.className = "media-embed"
      video.controls = true
      video.src = source
      media.appendChild(video)
    } else if (["jpg", "jpeg", "gif", "png"].includes(extension)) {
      const image = document.createElement("img")
      image.className = "media-embed"
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
    item.append(this.fieldLabel(name), " ")
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
    const rawValue = this.resolveFieldValue(doc.rawFields, name)
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

  resolveFieldValue(raw, fieldName) {
    if (Object.prototype.hasOwnProperty.call(raw || {}, fieldName)) return raw[fieldName]
    return fieldName.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), raw)
  }

  appendSanitized(element, value, prefix = "") {
    element.innerHTML = `${prefix}${sanitizeSnippetHtml(value)}`
  }
}

export function createRatingControl(rating, scale) {
  const container = document.createElement("div")
  container.className = "single-rating"
  container.dataset.controller = "rating-popover"
  container.dataset.ratingPopoverScaleValue = JSON.stringify(scale)

  const trigger = document.createElement("button")
  trigger.type = "button"
  trigger.className = "btn"
  trigger.textContent = rating === "--" ? "Unrated " : `${rating} `
  trigger.setAttribute("aria-label", rating === "--" ? "Rate document: Unrated" : `Change rating: ${rating}`)
  trigger.style.backgroundColor = ratingColor(rating, scale)

  const icon = document.createElement("i")
  icon.className = "bi bi-caret-down-fill"
  icon.setAttribute("aria-hidden", "true")
  trigger.appendChild(icon)
  container.appendChild(trigger)
  return container
}

function ratingColor(rating, scale) {
  return ratingBackgroundColor({ rating, scale })["background-color"]
}
