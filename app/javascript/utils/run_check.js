import { apiFetch } from "api/fetch"
import { setButtonLoading } from "utils/button_loading"
import { element } from "utils/dom"

// The scaffolding shared by every "Check connection" button: loading state, the POST itself, and
// a uniform error alert. Only how a successful result renders differs between forms, so that part
// is the caller's onSuccess(result, checkResultTarget).
export async function runCheck(checkUrl, formData, { checkResultTarget, checkButtonTarget, onSuccess }) {
  setButtonLoading(checkButtonTarget, true)
  checkResultTarget.replaceChildren()

  try {
    const response = await apiFetch(checkUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)

    onSuccess(result, checkResultTarget)
  } catch (error) {
    checkResultTarget.replaceChildren(
      element("div", { className: "alert alert-danger small mb-0", text: error.message })
    )
  } finally {
    setButtonLoading(checkButtonTarget, false)
  }
}
