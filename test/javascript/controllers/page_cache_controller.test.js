import { afterEach, expect, it, vi } from "vitest"
import PageCacheController from "controllers/page_cache_controller"
import { buildControllerFixture } from "../support/controller_fixture"

afterEach(() => vi.unstubAllGlobals())

it("removes Bootstrap overlays and restores the body before cloning a page", () => {
  const modalHide = vi.fn()
  const dropdownHide = vi.fn()
  window.bootstrap = { Modal: { getInstance: () => ({ hide: modalHide }) }, Dropdown: { getInstance: () => ({ hide: dropdownHide }) } }
  const element = document.createElement("body")
  element.classList.add("modal-open")
  element.style.overflow = "hidden"
  element.style.paddingRight = "15px"
  element.innerHTML = '<div class="modal show" aria-modal="true" role="dialog"></div><button class="dropdown-toggle"></button><div class="modal-backdrop"></div><div class="tooltip"></div><div class="popover"></div>'
  const controller = buildControllerFixture(PageCacheController, { element })
  controller.prepare()
  expect(modalHide).toHaveBeenCalledOnce()
  expect(dropdownHide).toHaveBeenCalledOnce()
  expect(element.querySelectorAll('.modal-backdrop, .tooltip, .popover').length).toBe(0)
  expect(element.querySelector('.modal').style.display).toBe("none")
  expect(element.classList.contains("modal-open")).toBe(false)
  expect(element.style.overflow).toBe("")
})
