/**
 * Reads the case name the server-rendered case header is currently showing.
 *
 * The header (app/views/core/_case_header.html.erb) lives in a Turbo Frame and is the single
 * source of truth for the case name on the core case page: a rename re-renders that frame, and
 * an Angular-originated rename patches it. The case-action toolbar sits outside the frame, so
 * reading the name here at the moment a modal opens is what keeps modal titles and export
 * filenames current, without copying the name onto every trigger and keeping those copies in
 * step afterwards.
 *
 * This reads the header's own `data-case-header-case-name` attribute rather than scraping the
 * rendered heading. The heading's element is a Stimulus target belonging to `case-rename`, which
 * is that controller's private business and free to be renamed; the data attribute is the
 * header's deliberate, public contract with the rest of the page. It also avoids depending on how
 * the partial happens to indent its text.
 *
 * Returns "" when the header is absent, which is what the callers already fall back to.
 */
const HEADER_FRAME_ID = "case_header"
const CASE_NAME_ATTRIBUTE = "data-case-header-case-name"

export function caseNameFromHeader() {
  const meta = document.querySelector(`#${HEADER_FRAME_ID} [${CASE_NAME_ATTRIBUTE}]`)

  return meta?.getAttribute(CASE_NAME_ATTRIBUTE) ?? ""
}
