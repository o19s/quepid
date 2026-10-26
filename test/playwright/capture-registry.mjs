export const captureRecipes = {
  "14.2/home": {
    id: "admin-home",
    version: 1,
    scenario: "14.2",
    state: "home",
    viewport: { width: 1440, height: 1000 },
    fullPage: false,
    paths: [
      "test/playwright/capture-registry.mjs",
      "test/playwright/capture-recipes.mjs",
      "test/playwright/capture-screenshot.mjs"
    ]
  },
  "14.3/empty": {
    id: "admin-users-empty",
    version: 1,
    scenario: "14.3",
    state: "empty",
    viewport: { width: 1440, height: 1000 },
    fullPage: false,
    search: "screenshot-no-such-user-20261010",
    paths: [
      "test/playwright/capture-registry.mjs",
      "test/playwright/capture-recipes.mjs",
      "test/playwright/capture-screenshot.mjs"
    ]
  }
}
