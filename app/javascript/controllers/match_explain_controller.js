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

    this.element.innerHTML = `
      <p class="matches-popper"><span></span><i class="bi bi-info-circle-fill" aria-hidden="true"></i></p>
      <div class="match-explain-bars"></div>
    `
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
    this.barsEl.innerHTML = this.barsHtml(data, hots)
    this.wireBars(data, hots)

    this.popoverHandle.setTitle(`Relevancy Score: ${escapeHtml(data.docScore)}`)
    this.popoverHandle.setBody(this.popoverBody(data))
  }

  barsHtml(data, hots) {
    if (!data.hasChildren) {
      return `
        <div class="graph-explain">
          <div class="graph-label">no per-term score breakdown for doc</div>
        </div>
      `
    }

    const visible = hots.length <= 3 ? hots : hots.slice(0, 3)
    const rest = hots.length <= 3 ? [] : hots.slice(3)

    let html = `<div>${visible.map((match) => this.barHtml(match)).join("")}`
    if (rest.length > 0) {
      const moreClass = this.showAll ? "collapse show" : "collapse"
      html += `<div class="${moreClass} match-explain-more">${rest.map((match) => this.barHtml(match)).join("")}</div>`
      html += `<a href="#" class="match-explain-toggle" style="font-size: 10px">Show ${this.showAll ? "Less" : `${hots.length - 3} More`}</a>`
    }
    html += "</div>"
    return html
  }

  barHtml(match) {
    const pct = Number(match.percentage) || 0
    const clamped = pct > 100 ? 100 : pct < 0 ? 0 : pct
    return `
      <div class="graph-explain">
        <div class="graph-label">${escapeHtml(match.description)}</div>
        <div class="progress">
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${clamped}"
            style="width: ${clamped}%"
          ></div>
        </div>
      </div>
    `
  }

  wireBars(data, hots) {
    if (this.collapseInstance) {
      this.collapseInstance.dispose()
      this.collapseInstance = null
    }

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
    const explanationHtml = data.hasChildren
      ? escapeHtml(data.explainToStr)
      : escapeHtml(data.explainAsJson)

    body.innerHTML = `
      <div class="doc-score-explanation">
        <pre>${explanationHtml}</pre>
      </div>
      <div class="actions">
        <a
          href="#"
          class="btn btn-outline-secondary match-explain-debug ${data.hasChildren ? "" : "disabled"}"
          aria-disabled="${!data.hasChildren}"
        >Debug</a>
        <a href="#" class="btn btn-outline-secondary match-explain-expand">
          Expand
          <i class="bi bi-arrows-angle-expand" aria-hidden="true"></i>
        </a>
      </div>
    `

    body.querySelector(".match-explain-debug").addEventListener("click", (event) => {
      event.preventDefault()
      if (!data.hasChildren) return
      this.openDebugModal(data)
    })

    body.querySelector(".match-explain-expand").addEventListener("click", (event) => {
      event.preventDefault()
      this.openExpandModal(data)
    })

    return body
  }

  openDebugModal(data) {
    const modal = openDynamicModal({
      html: `
        <div class="doc-detailed-explain">
          <h3>Debug Explain for <em>${escapeHtml(data.docTitle)}</em> (id:${escapeHtml(data.docId)})</h3>
          <div class="match-explain-json"></div>
        </div>
      `,
      size: "lg",
      windowClass: "doc-detailed-explain-modal"
    })
    renderJsonExplorer(modal.element.querySelector(".match-explain-json"), data.explainRawStr, { collapsed: false })
  }

  openExpandModal(data) {
    const explanationHtml = data.hasChildren
      ? escapeHtml(data.explainToStr)
      : escapeHtml(data.explainAsJson)

    openDynamicModal({
      html: `
        <div class="col-sm-12 pt-4 pb-4 px-4">
          <h1>Relevancy Score: ${escapeHtml(data.docScore)}</h1>
          <div><pre>${explanationHtml}</pre></div>
        </div>
      `,
      windowClass: "full-screen-modal"
    })
  }
}
