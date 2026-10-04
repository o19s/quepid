import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Loads a static ERB partial (one whose only ERB is `<%# comments %>`) as HTML,
 * so specs exercise the same `<template>` markup the page ships.
 *
 * @param {string} partialPath repo-relative path, e.g. "app/views/core/_annotation_template.html.erb"
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
