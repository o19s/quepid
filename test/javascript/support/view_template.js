import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Loads a static ERB partial (one whose only ERB is `<%# comments %>`) as HTML,
 * so specs exercise the same `<template>` markup the page ships.
 *
 * @param {string} partialPath repo-relative path, e.g. "app/views/core/_query_list_templates.html.erb"
 * @returns {string}
 */
export function loadViewTemplate(partialPath) {
  const source = readFileSync(path.join(process.cwd(), partialPath), "utf8")
  const html = source.replace(/<%#[\s\S]*?%>/g, "")
  if (html.includes("<%")) throw new Error(`${partialPath} must not contain ERB tags other than comments`)
  return html
}

/**
 * Renders a static partial into a detached container and returns the
 * `<template>` element(s) keyed by their Stimulus target name.
 */
export function viewTemplateTargets(partialPath, identifier) {
  const container = document.createElement("div")
  container.innerHTML = loadViewTemplate(partialPath)
  return Object.fromEntries(
    [...container.querySelectorAll(`template[data-${identifier}-target]`)].map((template) => [
      template.getAttribute(`data-${identifier}-target`),
      template
    ])
  )
}

// Loads a named modal shell; server-rendered attributes are supplied by the
// controller fixture, so this exercises static markup without rendering ERB.
export function loadDynamicModalTemplate(id) {
  const source = readFileSync(path.join(process.cwd(), "app/views/shared/_dynamic_modal_templates.html.erb"), "utf8")
  const container = document.createElement("div")
  container.innerHTML = source.replace(/<%[\s\S]*?%>/g, "")
  return container.querySelector(`template#${id}`).cloneNode(true)
}

export function controllerTargets(element, ControllerClass, identifier) {
  return Object.fromEntries(ControllerClass.targets.map(name => [
    name,
    [...element.querySelectorAll(`[data-${identifier}-target~="${name}"]`)]
  ]))
}
