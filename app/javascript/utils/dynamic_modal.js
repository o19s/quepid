/**
 * Clone a one-off modal shell; its Stimulus controller owns Bootstrap lifecycle.
 *
 * @param {{ html: string, size?: "sm"|"lg"|"xl", windowClass?: string, ariaLabelledBy?: string }} options
 * @returns {{ element: Element, dispose: () => void }}
 */
export function openDynamicModal({ html, templateId, size, windowClass, ariaLabelledBy } = {}) {
  const wrapper = document.createElement("div")
  wrapper.dataset.controller = "dynamic-modal"
  wrapper.className = ["modal", "fade", windowClass].filter(Boolean).join(" ")
  wrapper.setAttribute("tabindex", "-1")
  wrapper.setAttribute("role", "dialog")
  if (ariaLabelledBy) wrapper.setAttribute("aria-labelledby", ariaLabelledBy)

  const sizeClass = size ? `modal-${size}` : ""
  const dialog = document.createElement("div")
  dialog.className = ["modal-dialog", sizeClass].filter(Boolean).join(" ")
  dialog.setAttribute("role", "document")
  const content = document.createElement("div")
  content.className = "modal-content"
  if (templateId) {
    const template = document.getElementById(templateId)
    if (!template) return null
    content.append(template.content.cloneNode(true))
  } else if (html) {
    content.innerHTML = html
  }
  dialog.appendChild(content)
  wrapper.appendChild(dialog)
  document.body.appendChild(wrapper)

  // Stimulus owns showing and teardown. Callers populate the cloned shell
  // synchronously before its controller connects.
  function dispose() {
    wrapper.dynamicModalCloseRequested = true
    wrapper.dispatchEvent(new Event("dynamic-modal:close"))
  }

  return { element: wrapper, dispose }
}
