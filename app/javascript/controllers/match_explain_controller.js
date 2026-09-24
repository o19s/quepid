import { Controller } from "@hotwired/stimulus"
import { createBsPopover } from "utils/bs_popover"
import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer, escapeHtml } from "utils/json_explorer"

/**
 * Per-doc "Matches"/"No Match" chip + hot-match bars on the search result row
 * (was the `stackedChart` directive/`HotMatchesCtrl`), the popover it opens
 * (was `matches/matches.html`, reached via the now-deleted Angular
 * `quepidPopoverTemplate` directive) and the two modals reachable from that
 * popover (were the `debug-matches` and `expand-content` components).
 *
 * doc.explain()/doc.hotMatchesOutOf() are still Angular/splainer-search —
 * SearchResultCtrl computes them into `matchExplainData()` and serializes the
 * result onto `data-match-explain-data-value` (same bridge pattern as
 * rating-popover's scale value). This controller owns rendering only.
 *
 * The popover trigger + BS5 popover instance are created once in connect()
 * and kept alive across re-renders (updated via setTitle()/setBody(), same
 * as rating-popover) rather than torn down and rebuilt — maxDocScore (and so
 * every row's `hots`) shifts whenever *any* doc in the query is rated, so a
 * dispose-and-recreate-on-every-render design would close another doc's
 * already-open popover out from under the user mid-interaction.
 */
export default class extends Controller {
  static values = { data: Object }

  connect() {
    this.showAll = false

    const trigger = document.createElement("p")
    trigger.className = "matches-popper"
    trigger.appendChild(document.createElement("span"))
    const info = document.createElement("i")
    info.className = "bi bi-info-circle-fill"
    info.setAttribute("aria-hidden", "true")
    trigger.appendChild(info)
    const bars = document.createElement("div")
    bars.className = "match-explain-bars"
    this.element.replaceChildren(trigger, bars)
    this.triggerEl = this.element.querySelector(".matches-popper")
    this.barsEl = this.element.querySelector(".match-explain-bars")

    this.popoverHandle = createBsPopover(this.triggerEl, {
      mode: "text",
      trigger: "outsideClick",
      placement: "left",
      html: true
    })

    this.render(this.dataValue)
  }

  // Stimulus's ValueObserver runs before connect() (it seeds initial values
  // as part of the same connect pass Controller#connect() is called from),
  // so this can fire once before popoverHandle exists — connect() does that
  // first render itself once dataValue is already in hand. Also guards the
  // opposite ordering: a value change landing after disconnect() (which
  // nulls popoverHandle but leaves triggerEl in place) would otherwise call
  // render() -> this.popoverHandle.setTitle() on null.
  dataValueChanged(value) {
    if (!this.popoverHandle) return
    this.showAll = false
    this.render(value)
  }

  disconnect() {
    if (this.collapseInstance) {
      this.collapseInstance.dispose()
      this.collapseInstance = null
    }
    if (this.popoverHandle) {
      this.popoverHandle.dispose()
      this.popoverHandle = null
    }
  }

  render(data) {
    const hots = data.hots || []

    this.triggerEl.querySelector("span").textContent = hots.length > 0 ? "Matches" : "No Match"
    this.barsEl.replaceChildren(this.renderBars(data, hots))
    this.wireBars(data, hots)

    this.popoverHandle.setTitle(`Relevancy Score: ${escapeHtml(data.docScore)}`)
    this.popoverHandle.setBody(this.popoverBody(data))
  }

  renderBars(data, hots) {
    const fragment = document.createDocumentFragment()
    if (!data.hasChildren) {
      const explanation = document.createElement("div")
      explanation.className = "graph-explain"
      const label = document.createElement("div")
      label.className = "graph-label"
      label.textContent = "no per-term score breakdown for doc"
      explanation.appendChild(label)
      fragment.appendChild(explanation)
      return fragment
    }

    const visible = hots.length <= 3 ? hots : hots.slice(0, 3)
    const rest = hots.length <= 3 ? [] : hots.slice(3)
    const wrapper = document.createElement("div")
    visible.forEach((match) => wrapper.appendChild(this.barElement(match)))
    if (rest.length > 0) {
      const more = document.createElement("div")
      more.className = `collapse${this.showAll ? " show" : ""} match-explain-more`
      rest.forEach((match) => more.appendChild(this.barElement(match)))
      wrapper.appendChild(more)
      const toggle = document.createElement("a")
      toggle.href = "#"
      toggle.className = "match-explain-toggle"
      toggle.style.fontSize = "10px"
      toggle.textContent = `Show ${this.showAll ? "Less" : `${hots.length - 3} More`}`
      wrapper.appendChild(toggle)
    }
    fragment.appendChild(wrapper)
    return fragment
  }

  barElement(match) {
    const pct = Number(match.percentage) || 0
    const clamped = pct > 100 ? 100 : pct < 0 ? 0 : pct
    const bar = document.createElement("div")
    bar.className = "graph-explain match-explain-bar"
    const label = document.createElement("div")
    label.className = "graph-label"
    label.textContent = match.description || ""
    const progress = document.createElement("div")
    progress.className = "progress"
    const progressBar = document.createElement("div")
    progressBar.className = "progress-bar"
    progressBar.setAttribute("role", "progressbar")
    progressBar.setAttribute("aria-valuemin", "0")
    progressBar.setAttribute("aria-valuemax", "100")
    progressBar.setAttribute("aria-valuenow", String(clamped))
    progressBar.style.width = `${clamped}%`
    progress.appendChild(progressBar)
    bar.append(label, progress)
    return bar
  }

  wireBars(data, hots) {
    if (this.collapseInstance) {
      this.collapseInstance.dispose()
      this.collapseInstance = null
    }

    this.barsEl.querySelectorAll(".match-explain-bar").forEach((bar) => {
      bar.addEventListener("click", () => this.openDebugModal(data))
    })

    const toggle = this.barsEl.querySelector(".match-explain-toggle")
    if (!toggle) return

    const moreEl = this.barsEl.querySelector(".match-explain-more")
    const Collapse = window.bootstrap && window.bootstrap.Collapse
    this.collapseInstance = Collapse ? new Collapse(moreEl, { toggle: false }) : null

    toggle.addEventListener("click", (event) => {
      event.preventDefault()
      this.showAll = !this.showAll
      toggle.textContent = `Show ${this.showAll ? "Less" : `${hots.length - 3} More`}`
      if (this.showAll) this.collapseInstance?.show()
      else this.collapseInstance?.hide()
    })
  }

  popoverBody(data) {
    const body = document.createElement("div")
    const explanation = document.createElement("div")
    explanation.className = "doc-score-explanation"
    const pre = document.createElement("pre")
    pre.textContent = data.hasChildren ? data.explainToStr : data.explainAsJson
    explanation.appendChild(pre)
    const actions = document.createElement("div")
    actions.className = "actions"
    const debug = document.createElement("a")
    debug.href = "#"
    debug.className = "btn btn-outline-secondary match-explain-debug"
    debug.textContent = "Debug"
    debug.setAttribute("aria-disabled", String(!data.hasChildren))
    if (!data.hasChildren) debug.classList.add("disabled")
    const expand = document.createElement("a")
    expand.href = "#"
    expand.className = "btn btn-outline-secondary match-explain-expand"
    expand.append("Expand ")
    const expandIcon = document.createElement("i")
    expandIcon.className = "bi bi-arrows-angle-expand"
    expandIcon.setAttribute("aria-hidden", "true")
    expand.appendChild(expandIcon)
    actions.append(debug, expand)
    body.append(explanation, actions)

    debug.addEventListener("click", (event) => {
      event.preventDefault()
      if (!data.hasChildren) return
      this.openDebugModal(data)
    })

    expand.addEventListener("click", (event) => {
      event.preventDefault()
      this.openExpandModal(data)
    })

    return body
  }

  openDebugModal(data) {
    const modal = openDynamicModal({
      templateId: "match-explain-debug-modal-template",
      size: "lg",
      windowClass: "doc-detailed-explain-modal"
    })
    modal.element.querySelector("[data-modal-target='title']").textContent = data.docTitle
    modal.element.querySelector("[data-modal-target='docId']").textContent = data.docId
    renderJsonExplorer(modal.element.querySelector("[data-modal-target='json']"), data.explainRawStr, { collapsed: true })
  }

  openExpandModal(data) {
    const modal = openDynamicModal({
      templateId: "match-explain-expand-modal-template",
      windowClass: "full-screen-modal"
    })
    modal.element.querySelector("[data-modal-target='score']").textContent = data.docScore
    modal.element.querySelector("[data-modal-target='explanation']").textContent = data.hasChildren ? data.explainToStr : data.explainAsJson
  }
}
