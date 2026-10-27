import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(filePath) : [filePath]
  })
}

function controllerNamesUsedBy(source) {
  const names = new Set()
  for (const match of source.matchAll(/data-controller\s*=\s*["']([^"']+)["']/g)) {
    match[1]
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => names.add(name))
  }
  for (const match of source.matchAll(/\bcontroller:\s*["']([^"']+)["']/g)) {
    match[1]
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => names.add(name))
  }
  return names
}

describe("core Stimulus registration", () => {
  it("registers every controller referenced by the core surface", () => {
    // Core modals and the dynamic-modal templates live in app/views/shared but
    // only render on the case page.
    const sharedCoreViews = readdirSync(path.join(repoRoot, "app/views/shared"))
      .filter(
        (name) =>
          /^_.+_core_modal\.html\.erb$/.test(name) || name === "_dynamic_modal_templates.html.erb"
      )
      .map((name) => path.join(repoRoot, "app/views/shared", name))
    expect(sharedCoreViews.length).toBeGreaterThan(1)

    const coreSources = [
      ...sourceFiles(path.join(repoRoot, "app/views/core")),
      ...sharedCoreViews,
      path.join(repoRoot, "app/views/layouts/_case_head.html.erb"),
      path.join(repoRoot, "app/views/layouts/_case_workspace.html.erb")
    ].map((filePath) => readFileSync(filePath, "utf8"))

    // The layout delegates body attributes to the helper. Inspect its core return
    // rather than treating the management body's controllers as core markup.
    const layout = readFileSync(
      path.join(repoRoot, "app/views/layouts/application.html.erb"),
      "utf8"
    )
    expect(layout).toMatch(/layout_body_attributes\(case_page: case_page,/)
    const helper = readFileSync(path.join(repoRoot, "app/helpers/application_helper.rb"), "utf8")
    const caseBodyAttributes = helper.match(/^ {4}\{ data: \{([\s\S]*?)^ {4}\} \}/m)?.[1]
    expect(caseBodyAttributes).toMatch(/\bcontroller:/)
    coreSources.push(caseBodyAttributes)

    const used = new Set(coreSources.flatMap((source) => [...controllerNamesUsedBy(source)]))
    const registeredSource = readFileSync(
      path.join(repoRoot, "app/javascript/core_stimulus.js"),
      "utf8"
    )
    const registered = new Set(
      [...registeredSource.matchAll(/application\.register\(["']([^"']+)["']/g)].map(
        (match) => match[1]
      )
    )

    expect([...used].filter((name) => !registered.has(name))).toEqual([])
  })
})
