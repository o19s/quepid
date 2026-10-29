/**
 * Vitest for `app/javascript/` (importmap + Stimulus).
 * Specs live under `test/javascript/`, mirroring `app/javascript/` — not colocated with source.
 *
 * Bare-path imports resolve by directory, like the aliases in `esbuild.config.js`
 * and the `pin_all_from` pins in `config/importmap.rb`. Only vendored packages and
 * test stubs need their own entry.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const appJs = path.resolve(repoRoot, "app/javascript")

// Exercise the same vendored editor modules that both browser page types import.
const editorPackages = [
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/lang-javascript",
  "@codemirror/lang-json",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/state",
  "@codemirror/view",
  "@codemirror/streamparser",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/json",
  "@lezer/lr",
  "@lezer/javascript",
  "@marijn/find-cluster-break",
  "crelt",
  "style-mod",
  "w3c-keyname"
]

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/javascript/**/*.test.js"],
    globals: false,
  },
  resolve: {
    alias: [
      ...editorPackages.map(name => ({
        find: name,
        replacement: path.resolve(repoRoot, `vendor/javascript/${name.replaceAll("/", "--")}.js`)
      })),
      { find: "@hotwired/stimulus", replacement: path.resolve(repoRoot, "test/javascript/support/stimulus_stub.js") },
      { find: "js-cookie", replacement: path.resolve(repoRoot, "vendor/javascript/js-cookie.js") },
      { find: "party-js", replacement: path.resolve(repoRoot, "vendor/javascript/party-js.js") },
      { find: /^(controllers|utils|stores|api|modules)\/(.*)$/, replacement: `${appJs}/$1/$2` },
      { find: /^(core_runtime|quepid_store)$/, replacement: `${appJs}/$1.js` }
    ],
  },
})
