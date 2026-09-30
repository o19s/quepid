import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(filePath) : [filePath]
  })
}

function controllerNamesUsedBy(source) {
  const names = new Set()
  for (const match of source.matchAll(/data-controller\s*=\s*["']([^"']+)["']/g)) {
    match[1].split(/\s+/).filter(Boolean).forEach(name => names.add(name))
  }
  for (const match of source.matchAll(/\bcontroller:\s*["']([^"']+)["']/g)) names.add(match[1])
  return names
}

describe("core Stimulus registration", () => {
  it("registers every controller referenced by the core surface", () => {
    const coreSources = [
      ...sourceFiles(path.join(repoRoot, "app/views/core")),
      path.join(repoRoot, "app/views/layouts/core.html.erb"),
      path.join(repoRoot, "app/javascript/controllers/search_results_template.js")
    ].map(filePath => readFileSync(filePath, "utf8"))

    const used = new Set(coreSources.flatMap(source => [...controllerNamesUsedBy(source)]))
    const registeredSource = readFileSync(path.join(repoRoot, "app/javascript/core_stimulus.js"), "utf8")
    const registered = new Set(
      [...registeredSource.matchAll(/application\.register\(["']([^"']+)["']/g)].map(match => match[1])
    )

    expect([...used].filter(name => !registered.has(name))).toEqual([])
  })
})
