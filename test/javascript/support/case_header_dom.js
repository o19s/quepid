/**
 * Puts a server-rendered case header in the DOM for specs.
 *
 * The core case modals read the case name live from that header through `utils/case_header`
 * rather than from a copy on their own trigger, so any spec that opens one and asserts on the
 * name has to provide it. Mirrors the contract in app/views/core/_case_header.html.erb: the
 * `case_header` frame, and the name on `data-case-header-case-name`.
 */
export function mountCaseHeader(caseName) {
  document.querySelector("#case_header")?.remove()

  const frame = document.createElement("turbo-frame")
  frame.id = "case_header"

  const meta = document.createElement("div")
  meta.setAttribute("data-case-header-case-name", caseName)

  // The rendered heading too, so specs exercising a rename see what a user would.
  const display = document.createElement("span")
  display.setAttribute("data-case-rename-target", "caseDisplay")
  display.textContent = caseName
  meta.appendChild(display)

  frame.appendChild(meta)
  document.body.appendChild(frame)
  return frame
}
