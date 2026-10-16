import { Controller } from "@hotwired/stimulus"
import { createBsPopover } from "utils/bs_popover"
import { openDynamicModal } from "utils/dynamic_modal"
import { escapeHtml } from "utils/html"

/**
 * Per-doc "Matches"/"No Match" chip + hot-match bars on the search result row,
 * the popover it opens, and the two modals reachable from that popover
 * (debug matches and expanded content).
 *
 * doc.explain()/doc.hotMatchesOutOf() are still provided by splainer-search —
 * the query document store computes the plain `matchExplain` snapshot and
 * this controller owns rendering only.
 *
 * The popover trigger + BS5 popover instance are created once in connect()
 * and kept alive across re-renders (updated via setTitle()/setBody(), same
 * as rating-popover) rather than torn down and rebuilt — maxDocScore (and so
 * every row's `hots`) shifts whenever *any* doc in the query is rated, so a
 * dispose-and-recreate-on-every-render design would close another doc's
 * already-open popover out from under the user mid-interaction.
 */
export default class extends Controller {
  static targets = ["trigger", "label", "bars"]
  static values = { data: Object }

  connect() {
    this.showAll = false

    // The chip and bars shell is server-rendered in core/query_list/_search_result_template.
    this.popoverHandle = createBsPopover(this.triggerTarget, {
      trigger: "outside-click",
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
  // nulls popoverHandle but leaves the trigger in place) would otherwise call
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
    this.renderedData = data

    this.labelTarget.textContent = hots.length > 0 ? "Matches" : "No Match"
    this.barsTarget.replaceChildren(this.renderBars(data, hots))
    this.wireBars()

    this.popoverHandle.setTitle(`Relevancy Score: ${escapeHtml(data.docScore)}`)
    this.popoverHandle.setBody(this.popoverBody(data))
  }

  renderBars(data, hots) {
    const fragment = document.createDocumentFragment()
    if (!data.hasChildren) {
      fragment.appendChild(cloneTemplate("match-explain-no-breakdown-template"))
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
      const toggle = cloneTemplate("match-explain-toggle-template")
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
    bar.dataset.action = "click->match-explain#openBarDebug"
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

  wireBars() {
    if (this.collapseInstance) {
      this.collapseInstance.dispose()
      this.collapseInstance = null
    }

    const moreEl = this.barsTarget.querySelector(".match-explain-more")
    if (!moreEl) return

    const Collapse = window.bootstrap && window.bootstrap.Collapse
    this.collapseInstance = Collapse ? new Collapse(moreEl, { toggle: false }) : null
  }

  openBarDebug() {
    this.openDebugModal(this.renderedData)
  }

  toggleMore(event) {
    event.preventDefault()
    const hots = this.renderedData.hots || []
    this.showAll = !this.showAll
    event.currentTarget.textContent = `Show ${this.showAll ? "Less" : `${hots.length - 3} More`}`
    if (this.showAll) this.collapseInstance?.show()
    else this.collapseInstance?.hide()
  }

  popoverBody(data) {
    const body = cloneTemplate("match-explain-popover-template")
    body.querySelector("pre").textContent = data.hasChildren ? data.explainToStr : data.explainAsJson
    const debug = body.querySelector(".match-explain-debug")
    debug.disabled = !data.hasChildren
    const expand = body.querySelector(".match-explain-expand")

    // Bootstrap renders popover content under document.body, outside this
    // controller's scope, so these buttons cannot use data-action.
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
      ariaLabelledBy: "match-explain-debug-modal-title",
      size: "fullscreen",
      windowClass: "full-screen-modal"
    })
    modal.element.querySelector("[data-controller='match-explain-modal']").matchExplainData = data
  }

  openExpandModal(data) {
    const modal = openDynamicModal({
      templateId: "match-explain-expand-modal-template",
      ariaLabelledBy: "match-explain-expand-modal-title",
      size: "fullscreen",
      windowClass: "full-screen-modal"
    })
    modal.element.querySelector("[data-controller='match-explain-modal']").matchExplainData = data
  }
}

function cloneTemplate(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true)
}
