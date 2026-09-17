/**
 * Forces a browser download of in-memory content, replacing the AngularJS
 * export flows' `saveAs(blob, filename)` (FileSaver.js) calls.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers cancel an in-flight download if the object URL is revoked
  // in the same tick as the click (this is why FileSaver.js, which this
  // replaces, deferred its own revoke) — defer ours too.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
