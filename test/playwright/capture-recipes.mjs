import { chromium, expect } from "@playwright/test"

import { captureRecipes } from "./capture-registry.mjs"

export async function captureAdminHome(image, progress, environment = process.env) {
  return captureAdminScreen("14.2/home", "Admin Home", image, progress, environment, async (page) => {
    await page.goto("admin")
    await expect(page.getByRole("heading", { name: "Admin Settings", exact: true })).toBeVisible()
    for (const title of ["Managing Quepid", "Analytics", "Background Jobs & Performance Monitoring"]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
    }
    for (const title of ["Users", "Announcements", "SQL Analytics", "Job Manager", "Websocket Tester", "Rails Pulse"]) {
      await expect(page.locator(".card").getByRole("link", { name: title, exact: true })).toBeVisible()
    }
  })
}

export async function captureAdminUsersEmpty(image, progress, environment = process.env) {
  return captureAdminScreen("14.3/empty", "User Management empty search", image, progress, environment, async (page) => {
    await page.goto("admin/users")
    await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible()
    const search = captureRecipes["14.3/empty"].search
    await page.getByPlaceholder("Filter by email or name").fill(search)
    await page.locator("#button-addon2").click()
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === search)
    await expect(page.getByPlaceholder("Filter by email or name")).toHaveValue(search)
    await expect(page.getByRole("alert")).toHaveText("Create your first user by clicking on the New User button above.")
    await expect(page.locator("main table tbody tr")).toHaveCount(0)
    for (const title of ["Username", "Name", "Signed Up", "Marketing", "Number of Logins", "Administrator?"]) {
      await expect(page.getByRole("columnheader", { name: title, exact: true })).toBeVisible()
    }
  })
}

export const captureImplementations = {
  "admin-home": captureAdminHome,
  "admin-users-empty": captureAdminUsersEmpty
}

async function captureAdminScreen(screenId, label, image, progress, environment, prepare) {
  const mount = environment.RAILS_RELATIVE_URL_ROOT || ""
  const baseURL = `http://localhost:3000/${mount.replace(/^\/+|\/+$/g, "")}${mount ? "/" : ""}`
  const email = environment.QUEPID_E2E_ADMIN_EMAIL || "quepid+admin@o19s.com"
  const password = environment.QUEPID_E2E_ADMIN_PASSWORD || "password"
  const recipe = captureRecipes[screenId]
  const browser = await chromium.launch()
  let timeout
  try {
    const replay = async () => {
      const context = await browser.newContext({ baseURL, viewport: recipe.viewport })
      const page = await context.newPage()
      page.setDefaultTimeout(20000)
      progress(`Preparing ${label}…`)
      await page.goto("sessions/new")
      const form = page.locator("form#login")
      await form.locator("#user_email").fill(email)
      await form.locator("#user_password").fill(password)
      await form.locator('input[type="submit"][value="Sign in"]').click()
      try {
        await expect(page).not.toHaveURL(/\/sessions\/new/)
      } catch {
        throw new Error("Admin sign-in failed. Check QUEPID_E2E_ADMIN_EMAIL and QUEPID_E2E_ADMIN_PASSWORD in the app container.")
      }
      await prepare(page)
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
        window.scrollTo(0, 0)
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      progress(`Capturing ${label}…`)
      await page.screenshot({ path: image, fullPage: recipe.fullPage, animations: "disabled", caret: "hide" })
      return { recipe: recipe.id, recipeVersion: recipe.version, viewport: recipe.viewport, fullPage: recipe.fullPage, accountRole: "administrator", target: baseURL, scroll: { x: 0, y: 0 }, ...(recipe.search ? { search: recipe.search } : {}) }
    }
    return await Promise.race([
      replay(),
      new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error(`${label} capture timed out; retry after checking the app`)), 120000) })
    ])
  } catch (error) {
    throw new Error(error.message.replaceAll(email, "[admin account]").replaceAll(password, "[password]"))
  } finally {
    clearTimeout(timeout)
    await browser.close()
  }
}
