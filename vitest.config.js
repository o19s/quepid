import fs from "node:fs"
import path from "path"
import { defineConfig } from "vitest/config"

/** Map `modules/foo` imports to `app/javascript/modules/foo.js` (matches importmap pins). */
function modulesImportAliases(rootDir) {
  const modulesDir = path.join(rootDir, "app/javascript/modules")
  const alias = {}
  if (!fs.existsSync(modulesDir)) return alias
  for (const file of fs.readdirSync(modulesDir)) {
    if (!file.endsWith(".js")) continue
    const name = file.slice(0, -".js".length)
    alias[`modules/${name}`] = path.join(modulesDir, file)
  }
  return alias
}

export default defineConfig({
  resolve: {
    alias: {
      ...modulesImportAliases(__dirname),
      "splainer-search": path.join(__dirname, "vendor/javascript/splainer-search.js"),
      sortablejs: path.join(__dirname, "vendor/javascript/sortablejs.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/javascript/**/*.test.js"],
  },
})
