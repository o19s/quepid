import { test, expect, type Page } from "@playwright/test"
import { playwrightBaseURL } from "./env"

// Smoke coverage for the admin namespace (Admin::AdminController and its
// subclasses): home#index, users#index, announcements#index/#new/#create,
// and the `before_action :require_administrator` gate that denies non-admins.
//
// The suite's default identity (quepid+realisticactivity@o19s.com, wired into
// auth.setup.ts) happens to already be an administrator in this seeded dev
// DB, but admin coverage shouldn't depend on that being true forever — every
// test here logs in explicitly instead of relying on the shared storageState
// identity, the same email/password override pattern auth.setup.ts uses.

const ADMIN_EMAIL = process.env.QUEPID_E2E_ADMIN_EMAIL ?? "quepid+admin@o19s.com"
const ADMIN_PASSWORD = process.env.QUEPID_E2E_ADMIN_PASSWORD ?? "password"

// A real seeded non-admin user in the shared dev DB (not a fixture).
const NON_ADMIN_EMAIL = process.env.QUEPID_E2E_NON_ADMIN_EMAIL ?? "quepid+es@o19s.com"
const NON_ADMIN_PASSWORD = process.env.QUEPID_E2E_NON_ADMIN_PASSWORD ?? "password"

// Notes on allowlist entries this spec creates start with this, so afterAll can
// find and delete any a failed run left behind.
const ALLOWLIST_NOTE_PREFIX = "Playwright allowlist"

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("sessions/new")
  const loginForm = page.locator("form#login")
  await loginForm.locator("#user_email").fill(email)
  await loginForm.locator("#user_password").fill(password)
  await loginForm.locator('input[type="submit"][value="Sign in"]').click()
  await expect(page).not.toHaveURL(/\/sessions\/new/)
}

test.describe("admin namespace", () => {
  test("admin home lists management links for a logged-in administrator", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    await page.goto("admin")
    await expect(page.getByRole("heading", { name: "Admin Settings" })).toBeVisible()
    // "Users" and "Announcements" links appear both in the sidebar nav and in
    // the main content's management cards -- .first() just confirms one is
    // visible rather than asserting anything about which.
    await expect(page.getByRole("link", { name: "Users" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Announcements" }).first()).toBeVisible()
  })

  test("admin users index lists existing users", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    // Filter by the admin's own email via the index's `q` search param so the
    // assertion doesn't depend on pagination/ordering as the seeded user set grows.
    await page.goto(`admin/users?q=${encodeURIComponent(ADMIN_EMAIL)}`)
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

    const rows = page.locator("table tbody tr")
    await expect(rows.first()).toBeVisible()
    await expect(page.locator("table tbody")).toContainText(ADMIN_EMAIL)
  })

  test("admin can create a new announcement", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    await page.goto("admin/announcements")
    await expect(
      page.getByRole("heading", { name: "Quepid Announcements for Users" })
    ).toBeVisible()

    const announcementText = `Playwright announcement ${Date.now()}`

    await page.getByRole("link", { name: "New Quepid Announcement" }).click()
    await expect(page).toHaveURL(/\/admin\/announcements\/new/)

    await page.locator("#announcement_text").fill(announcementText)
    await page.getByRole("button", { name: "Create", exact: true }).click()

    // AnnouncementsController#create redirects to edit_admin_announcement_path on success.
    await expect(page).toHaveURL(/\/admin\/announcements\/\d+\/edit/)
    await expect(page.getByRole("heading", { name: "Edit Quepid Announcement" })).toBeVisible()
    await expect(page.locator("#announcement_text")).toHaveValue(announcementText)

    await page.goto(`admin/announcements?q=${encodeURIComponent(announcementText)}`)
    await expect(page.locator("table tbody tr", { hasText: announcementText })).toBeVisible()
  })

  test("a non-admin user is denied access to the admin namespace", async ({ page }) => {
    await loginAs(page, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)

    await page.goto("admin")

    // Admin::AdminController#require_administrator redirects non-admins to
    // root_path with a notice rather than rendering the admin panel.
    await expect(page).not.toHaveURL(/\/admin/)
    await expect(page.locator("#flash-messages")).toContainText(
      "You must be a Quepid Administrator."
    )
  })

  test("admin can add, edit and delete a proxy allowlist entry", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    const response = await page.goto("admin/proxy_allowlist_entries")
    expect(
      response?.status(),
      "Admin > Proxy Allowlist returned 404: the dev server needs PROXY_ALLOWLIST_ADMIN_MANAGED=true, " +
        "which docker-compose.yml sets for the app service. Recreate the dev server container to pick it up."
    ).not.toBe(404)
    await expect(page.getByRole("heading", { name: "Proxy Allowlist" })).toBeVisible()

    // A unique /32 per run so leftovers from an earlier run can't collide.
    const stamp = Date.now()
    const value = `10.${(stamp >> 16) & 255}.${(stamp >> 8) & 255}.${stamp & 255}/32`
    const editedValue = `10.${(stamp >> 16) & 255}.${(stamp >> 8) & 255}.${(stamp + 1) & 255}/32`
    const note = `${ALLOWLIST_NOTE_PREFIX} ${stamp}`
    const editedNote = `${note} edited`

    await page.getByRole("link", { name: "New Allowlist Entry" }).click()
    await page.locator("#proxy_allowlist_entry_kind").selectOption("network")
    await page.locator("#proxy_allowlist_entry_value").fill(value)
    await page.locator("#proxy_allowlist_entry_note").fill(note)
    await page.getByRole("button", { name: "Create", exact: true }).click()

    await expect(page).toHaveURL(/\/admin\/proxy_allowlist_entries$/)
    const row = page.locator("#managed-entries tbody tr", { hasText: note })
    await expect(row).toContainText(value)
    await expect(row.locator("td").nth(3)).toContainText(ADMIN_EMAIL)

    await row.getByRole("link", { name: "Edit" }).click()
    await expect(page.locator("#proxy_allowlist_entry_kind")).toHaveValue("network")
    await page.locator("#proxy_allowlist_entry_value").fill(editedValue)
    await page.locator("#proxy_allowlist_entry_note").fill(editedNote)
    await page.getByRole("button", { name: "Update", exact: true }).click()

    await expect(page).toHaveURL(/\/admin\/proxy_allowlist_entries$/)
    const editedRow = page.locator("#managed-entries tbody tr", { hasText: editedNote })
    await expect(editedRow).toContainText(editedValue)
    await expect(editedRow.locator("td").nth(4)).toContainText(ADMIN_EMAIL)

    await editedRow.getByRole("button", { name: "Delete" }).click()
    await page
      .locator("#confirmModal")
      .getByRole("button", { name: "Confirm", exact: true })
      .click()
    await expect(page.locator("#managed-entries tbody tr", { hasText: note })).toHaveCount(0)
  })
})

test.afterAll(async ({ browser }) => {
  const page: Page = await browser.newPage({ baseURL: playwrightBaseURL() })
  try {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const response = await page.goto("admin/proxy_allowlist_entries")
    if (response?.status() === 404) return

    const leftovers = page.locator("#managed-entries tbody tr", { hasText: ALLOWLIST_NOTE_PREFIX })
    while ((await leftovers.count()) > 0) {
      const before = await leftovers.count()
      await leftovers.first().getByRole("button", { name: "Delete" }).click()
      await page
        .locator("#confirmModal")
        .getByRole("button", { name: "Confirm", exact: true })
        .click()
      await expect(leftovers).toHaveCount(before - 1)
    }
  } finally {
    await page.close()
  }
})
