import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

// Static check of server markup against controller declarations: every
// data-controller, data-action, target, value and outlet in app/views and
// app/helpers must resolve. Attributes built with ERB or Ruby interpolation are
// skipped. Controllers are imported so that inherited and mixed-in targets and
// methods resolve the way Stimulus resolves them.

// Only declarations are read; controllers/application would start Stimulus.
vi.mock("controllers/application", () => ({ application: {} }))

const repoRoot = process.cwd()
const controllerModules = import.meta.glob("../../../app/javascript/controllers/*_controller.js")

function sourceFiles(directory, pattern) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(filePath, pattern)
    return pattern.test(entry.name) ? [filePath] : []
  })
}

const camelize = name => name.replace(/[-_](\w)/g, (_match, letter) => letter.toUpperCase())

// Stimulus unions static targets/values/outlets across the class chain.
function declarations(ControllerClass) {
  const targets = new Set()
  const values = new Set()
  const outlets = new Set()
  const methods = new Set()
  for (let klass = ControllerClass; klass && klass !== Function.prototype; klass = Object.getPrototypeOf(klass)) {
    if (Object.hasOwn(klass, "targets")) klass.targets.forEach(name => targets.add(name))
    if (Object.hasOwn(klass, "values")) Object.keys(klass.values).forEach(name => values.add(name))
    if (Object.hasOwn(klass, "outlets")) klass.outlets.forEach(name => outlets.add(camelize(name)))
    Object.getOwnPropertyNames(klass.prototype ?? {}).forEach(name => methods.add(name))
  }
  return { targets, values, outlets, methods }
}

// Core modals also read `data-<identifier>-<name>-value` from the button that
// opened them, via CoreModalControllerBase#triggerValue.
function triggerValues(source) {
  return [...source.matchAll(/\btriggerValue\([^,]+,\s*["'](\w+)["']/g)].map(match => match[1])
}

async function loadControllers() {
  const controllers = new Map()
  for (const [modulePath, load] of Object.entries(controllerModules)) {
    const identifier = path.basename(modulePath, "_controller.js").replace(/_/g, "-")
    const declared = declarations((await load()).default)
    const source = readFileSync(path.join(repoRoot, "app/javascript/controllers", path.basename(modulePath)), "utf8")
    triggerValues(source).forEach(name => declared.values.add(name))
    controllers.set(identifier, declared)
  }
  return controllers
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length
}

// Extracts the body of each `data: { ... }` Ruby hash, balancing braces so
// `#{...}` interpolation doesn't end it early.
function rubyDataHashes(source) {
  const hashes = []
  for (const match of source.matchAll(/\bdata:\s*\{/g)) {
    let depth = 1
    let index = match.index + match[0].length
    while (depth > 0 && index < source.length) {
      if (source[index] === "{") depth += 1
      if (source[index] === "}") depth -= 1
      index += 1
    }
    hashes.push({ body: source.slice(match.index + match[0].length, index - 1), index: match.index })
  }
  return hashes
}

// Yields [attributeSuffix, value, line] for each literal data attribute, where
// attributeSuffix is the part after `data-` in kebab case.
function* dataAttributes(source) {
  for (const match of source.matchAll(/(?<![\w-])data-([\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    yield [match[1], match[3], lineOf(source, match.index)]
  }
  for (const match of source.matchAll(/["']data-([\w-]+)["']\s*(?:=>|:)\s*(["'])(.*?)\2/gs)) {
    yield [match[1], match[3], lineOf(source, match.index)]
  }
  for (const { body, index } of rubyDataHashes(source)) {
    const pairs = [
      ...body.matchAll(/(?<![\w"'])(\w+):\s*(["'])(.*?)\2/gs),
      ...body.matchAll(/["']([\w-]+)["']\s*=>\s*(["'])(.*?)\2/gs)
    ]
    for (const pair of pairs) {
      yield [pair[1].replace(/_/g, "-"), pair[3], lineOf(source, index + pair.index)]
    }
  }
}

const interpolated = value => /<%|#\{/.test(value)

function wiringProblems(source, controllers) {
  const problems = []
  const identifiers = [...controllers.keys()].sort((a, b) => b.length - a.length)
  const owner = prefix => identifiers.find(identifier => prefix.startsWith(`${identifier}-`))

  for (const [attribute, value, line] of dataAttributes(source)) {
    // Bootstrap's data-bs-* attributes aren't Stimulus wiring.
    if (attribute.startsWith("bs-")) continue
    const report = reason => problems.push(`${line}: data-${attribute}="${value}" ${reason}`)

    // Value and outlet attribute names can be checked even when the value is
    // interpolated; controller, action and target values can't.
    if (/-(value|outlet)$/.test(attribute)) {
      const kind = attribute.endsWith("-value") ? "values" : "outlets"
      const prefix = attribute.replace(/-(value|outlet)$/, "")
      const identifier = owner(prefix)
      if (!identifier) {
        report(`— no controller owns this ${kind.slice(0, -1)}`)
        continue
      }
      const name = camelize(prefix.slice(identifier.length + 1))
      if (!controllers.get(identifier)[kind].has(name)) {
        report(`— "${identifier}" declares no ${kind.slice(0, -1)} "${name}"`)
      }
      continue
    }
    if (attribute.endsWith("-target") && !controllers.has(attribute.slice(0, -"-target".length))) {
      report(`— no controller "${attribute.slice(0, -"-target".length)}"`)
      continue
    }
    if (interpolated(value)) continue

    if (attribute === "controller") {
      value.split(/\s+/).filter(Boolean)
        .filter(identifier => !controllers.has(identifier))
        .forEach(identifier => report(`— no controller "${identifier}"`))
    } else if (attribute === "action") {
      for (const descriptor of value.split(/\s+/).filter(Boolean)) {
        const parsed = descriptor.match(/^(?:.+->)?([\w-]+)#(\w+)(?::[\w:!]+)?$/)
        if (!parsed) {
          report(`— malformed descriptor "${descriptor}"`)
        } else if (!controllers.has(parsed[1])) {
          report(`— no controller "${parsed[1]}"`)
        } else if (!controllers.get(parsed[1]).methods.has(parsed[2])) {
          report(`— "${parsed[1]}" has no method "${parsed[2]}"`)
        }
      }
    } else if (attribute.endsWith("-target")) {
      const identifier = attribute.slice(0, -"-target".length)
      value.split(/\s+/).filter(Boolean)
        .filter(name => !controllers.get(identifier).targets.has(name))
        .forEach(name => report(`— "${identifier}" declares no target "${name}"`))
    }
  }
  return problems
}

describe("Stimulus wiring", () => {
  it("resolves every controller, action, target, value and outlet in server markup", async () => {
    const controllers = await loadControllers()
    expect(controllers.size).toBeGreaterThan(50)

    const markupFiles = [
      ...sourceFiles(path.join(repoRoot, "app/views"), /\.erb$/),
      ...sourceFiles(path.join(repoRoot, "app/helpers"), /\.rb$/)
    ]
    const problems = markupFiles.flatMap(filePath =>
      wiringProblems(readFileSync(filePath, "utf8"), controllers)
        .map(problem => `${path.relative(repoRoot, filePath)}:${problem}`)
    )

    expect(problems).toEqual([])
  })

  it("reports unresolved wiring", () => {
    const controllers = new Map([
      ["demo", { targets: new Set(["field"]), values: new Set(["url"]), outlets: new Set(), methods: new Set(["save"]) }]
    ])
    const markup = `
      <div data-controller="demo missing"
           data-action="click->demo#save submit->demo#gone"
           data-demo-target="field stale"
           data-demo-url-value="/x" data-demo-mode-value="<%= mode %>"
           data-demo-target="<%= name %>" data-bs-target="#modal"></div>
      <%= tag.div data: { demo_target: "old", action: "demo#save" } %>`

    expect(wiringProblems(markup, controllers)).toEqual([
      '2: data-controller="demo missing" — no controller "missing"',
      '3: data-action="click->demo#save submit->demo#gone" — "demo" has no method "gone"',
      '4: data-demo-target="field stale" — "demo" declares no target "stale"',
      '5: data-demo-mode-value="<%= mode %>" — "demo" declares no value "mode"',
      '7: data-demo-target="old" — "demo" declares no target "old"'
    ])
  })
})
