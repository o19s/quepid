import { expect, it } from "vitest"
import KrakenController from "controllers/kraken_controller"
import { buildControllerFixture } from "../support/controller_fixture"

it("shows and dismisses the overlay and removes its finished animation", () => {
  const controller = buildControllerFixture(KrakenController)
  const image = document.createElement("img")
  controller.element.append(image)
  controller.connect()
  expect(controller.element.style.display).toBe("block")
  controller.close()
  expect(controller.element.style.display).toBe("none")
  controller.removeImage({ target: image })
  expect(controller.element.children.length).toBe(0)
})
