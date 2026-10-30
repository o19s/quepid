import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import existing from "./playwright.config"

// Large-case memory/load benchmark (large_case.perf.spec.ts). Kept out of the behavioral suite:
// traces and per-test screenshots retain memory and add timing noise, so this runs without them.
export default defineConfig({
  ...existing,
  reporter: [["list"]],
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "perf",
      dependencies: ["setup"],
      testMatch: /\.perf\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: path.join(__dirname, ".auth", "user.json"),
        trace: "off",
        screenshot: "off",
        video: "off"
      }
    }
  ]
})
