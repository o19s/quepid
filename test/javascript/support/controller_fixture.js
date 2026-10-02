/**
 * Build a controller for direct method tests using the Stimulus stub.
 * Targets accept one element (or a small fake) or an array for repeated targets.
 * This does not connect the controller or resolve data attributes from markup.
 */
export function buildControllerFixture(ControllerClass, {
  element = document.createElement("div"),
  targets = {},
  values = {},
  overrides = {}
} = {}) {
  const controller = Object.create(ControllerClass.prototype)
  controller.element = element

  for (const [name, target] of Object.entries(targets)) {
    const elements = Array.isArray(target) ? target : target == null ? [] : [target]
    controller[`${name}Target`] = elements[0]
    controller[`${name}Targets`] = elements
    controller[`has${name[0].toUpperCase()}${name.slice(1)}Target`] = elements.length > 0
  }

  for (const [name, value] of Object.entries(values)) {
    controller[`${name}Value`] = value
    controller[`has${name[0].toUpperCase()}${name.slice(1)}Value`] = true
  }

  return Object.assign(controller, overrides)
}
