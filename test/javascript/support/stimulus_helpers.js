import { waitFor } from "@testing-library/dom"
import { expect } from "vitest"

/**
 * Resolves when Stimulus has connected the controller for the given element.
 * Prefer this over fixed setTimeouts, which flake on slow runners.
 */
export async function waitForController(application, selector, identifier) {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`Missing element for selector: ${selector}`)
  await waitFor(() => {
    const controller = application.getControllerForElementAndIdentifier(el, identifier)
    expect(controller).not.toBeNull()
  })
}
