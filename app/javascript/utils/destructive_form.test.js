import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { submitDestructiveForm } from "./destructive_form"

function setCsrfToken(token) {
  document.head.innerHTML = token ? `<meta name="csrf-token" content="${token}">` : ""
}

describe("submitDestructiveForm", () => {
  beforeEach(() => {
    setCsrfToken("test-token")
  })

  afterEach(() => {
    document.body.innerHTML = ""
    document.head.innerHTML = ""
  })

  it("does nothing when no url is given", () => {
    submitDestructiveForm(undefined, "delete")

    expect(document.body.querySelector("form")).toBeNull()
  })

  it("builds a hidden POST form with the CSRF token and a _method override for non-post methods", () => {
    let submitted = false
    const originalSubmit = HTMLFormElement.prototype.submit
    HTMLFormElement.prototype.submit = function () {
      submitted = true
    }

    submitDestructiveForm("/cases/5", "delete")

    const form = document.body.querySelector("form")
    expect(form).not.toBeNull()
    expect(form.method).toBe("post")
    expect(form.action).toContain("/cases/5")
    expect(form.querySelector('input[name="authenticity_token"]').value).toBe("test-token")
    expect(form.querySelector('input[name="_method"]').value).toBe("delete")
    expect(submitted).toBe(true)

    HTMLFormElement.prototype.submit = originalSubmit
  })

  it("omits the _method override for a plain post", () => {
    HTMLFormElement.prototype.submit = () => {}

    submitDestructiveForm("/cases/5/archive", "post")

    const form = document.body.querySelector("form")
    expect(form.querySelector('input[name="_method"]')).toBeNull()
  })

  it("skips the authenticity_token input when no CSRF meta tag is present", () => {
    setCsrfToken(null)
    HTMLFormElement.prototype.submit = () => {}

    submitDestructiveForm("/cases/5", "delete")

    const form = document.body.querySelector("form")
    expect(form.querySelector('input[name="authenticity_token"]')).toBeNull()
  })
})
