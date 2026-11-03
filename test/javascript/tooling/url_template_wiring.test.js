import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

// Static check that every server-rendered URL template (`*-url-template-value`
// in app/views) has exactly the placeholders its controller fills, and that
// every template a controller fills is rendered. fillUrlTemplate throws on a
// mismatch at runtime; this catches it before anyone clicks.
//
// A controller fills a template either directly —
//   fillUrlTemplate(this.fooUrlTemplateValue, { CASE_ID: id })
// — or by handing it to a helper with one generic fill, which may add keys:
//   this._url(this.fooUrlTemplateValue, { FORMAT: "json" })
//   _url(template, values) { return fillUrlTemplate(template, { CASE_ID: id, ...values }) }

const repoRoot = process.cwd()
const PLACEHOLDER = /__([A-Z][A-Z0-9_]*?)__/g
const KEY = /\b([A-Z][A-Z0-9_]*)\s*:/g

function sourceFiles(directory, pattern) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(filePath, pattern)
    return pattern.test(entry.name) ? [filePath] : []
  })
}

const kebab = (name) => name.replace(/_/g, "-").replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const names = (source, pattern) => [...source.matchAll(pattern)].map((match) => match[1])
const sorted = (keys) => [...new Set(keys)].sort()

// "<identifier>-<name>-url" → placeholders, from both the `data-…-value="…"`
// attribute and the `data: { …_value: … }` hash forms. Each template sits on one line.
function viewTemplates() {
  const templates = new Map()
  for (const file of sourceFiles(path.join(repoRoot, "app/views"), /\.erb$/)) {
    const relative = path.relative(repoRoot, file)
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const match =
          line.match(/data-([a-z0-9-]+-url)-template-value="(.*)$/) ||
          line.match(/\b([a-z0-9_]+_url)_template_value:\s*(.*)$/)
        if (!match) return
        templates.set(kebab(match[1]), {
          placeholders: sorted(names(match[2], PLACEHOLDER)),
          where: `${relative}:${index + 1}`
        })
      })
  }
  return templates
}

// Every `this.<name>UrlTemplateValue` reference, with the keys filled there.
function controllerFills() {
  const fills = []
  const unresolved = []
  for (const file of sourceFiles(
    path.join(repoRoot, "app/javascript/controllers"),
    /_controller\.js$/
  )) {
    const source = readFileSync(file, "utf8")
    const identifier = path.basename(file, "_controller.js").replace(/_/g, "-")
    const relative = path.relative(repoRoot, file)
    const helperFills = [...source.matchAll(/fillUrlTemplate\(\s*(?!this\.)\w+,\s*\{([^}]*)\}/g)]
    // Skips `this.hasFooUrlTemplateValue` checks and copies onto another element's dataset.
    const reference =
      /(dataset\.\w+\s*=\s*)?(fillUrlTemplate\(\s*)?this\.(?!has[A-Z])(\w+)UrlTemplateValue(?:,\s*\{([^}]*)\})?/g
    for (const match of source.matchAll(reference)) {
      const [, copy, direct, name, literal = ""] = match
      if (copy) continue
      const where = `${relative}:${source.slice(0, match.index).split("\n").length}`
      let keys = names(literal, KEY)
      if (!direct) {
        if (helperFills.length !== 1) {
          unresolved.push(
            `${where} passes ${name}UrlTemplateValue to a helper this test can't trace`
          )
          continue
        }
        keys = [...keys, ...names(helperFills[0][1], KEY)]
      }
      fills.push({ template: `${identifier}-${kebab(name)}-url`, keys: sorted(keys), where })
    }
  }
  return { fills, unresolved }
}

// The fill check above credits any template reference it can't see filled to the
// controller's helper, so a raw `.replaceAll("__CASE_ID__", …)` could pass it.
it("fills URL template placeholders only through fillUrlTemplate", () => {
  const helper = path.join(repoRoot, "app/javascript/utils/url_template.js")
  const placeholderLiteral = /["'`]__[A-Z][A-Z0-9_]*__["'`]/
  const problems = sourceFiles(path.join(repoRoot, "app/javascript"), /\.js$/)
    .filter((file) => file !== helper)
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          placeholderLiteral.test(line)
            ? [`${path.relative(repoRoot, file)}:${index + 1}: ${line.trim()}`]
            : []
        )
    )
  expect(problems).toEqual([])
})

it("fills every server-rendered URL template with exactly its placeholders", () => {
  const templates = viewTemplates()
  const { fills, unresolved } = controllerFills()
  expect(templates.size).toBeGreaterThan(0)
  expect(unresolved).toEqual([])

  const problems = []
  for (const { template, keys, where } of fills) {
    const rendered = templates.get(template)
    if (!rendered) {
      problems.push(`${where} fills ${template}, which no view renders`)
    } else if (rendered.placeholders.join() !== keys.join()) {
      problems.push(
        `${where} fills ${template} with [${keys}] but ${rendered.where} renders [${rendered.placeholders}]`
      )
    }
  }
  const filled = new Set(fills.map(({ template }) => template))
  for (const [template, { where }] of templates) {
    if (!filled.has(template))
      problems.push(`${where} renders ${template}, which no controller fills`)
  }
  expect(problems).toEqual([])
})
