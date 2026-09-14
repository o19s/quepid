import { test, expect, type Page } from '@playwright/test';

// Smoke coverage for the admin namespace (Admin::AdminController and its
// subclasses): home#index, users#index, announcements#index/#new/#create,
// and the `before_action :require_administrator` gate that denies non-admins.
//
// The suite's default identity (quepid+realisticactivity@o19s.com, wired into
// auth.setup.ts) happens to already be an administrator in this seeded dev
// DB, but admin coverage shouldn't depend on that being true forever — every
// test here logs in explicitly instead of relying on the shared storageState
// identity, the same email/password override pattern auth.setup.ts uses.

const ADMIN_EMAIL = process.env.QUEPID_E2E_ADMIN_EMAIL ?? 'quepid+admin@o19s.com';
const ADMIN_PASSWORD = process.env.QUEPID_E2E_ADMIN_PASSWORD ?? 'password';

// A real seeded non-admin user in the shared dev DB (not a fixture).
const NON_ADMIN_EMAIL = process.env.QUEPID_E2E_NON_ADMIN_EMAIL ?? 'quepid+es@o19s.com';
const NON_ADMIN_PASSWORD = process.env.QUEPID_E2E_NON_ADMIN_PASSWORD ?? 'password';

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('sessions/new');
  const loginForm = page.locator('form#login');
  await loginForm.locator('#user_email').fill(email);
  await loginForm.locator('#user_password').fill(password);
  await loginForm.locator('input[type="submit"][value="Sign in"]').click();
  await expect(page).not.toHaveURL(/\/sessions\/new/);
}

test.describe('admin namespace', () => {
  test('admin home lists management links for a logged-in administrator', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('admin');
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Announcements' })).toBeVisible();
  });

  test('admin users index lists existing users', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Filter by the admin's own email via the index's `q` search param so the
    // assertion doesn't depend on pagination/ordering as the seeded user set grows.
    await page.goto(`admin/users?q=${encodeURIComponent(ADMIN_EMAIL)}`);
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('table tbody')).toContainText(ADMIN_EMAIL);
  });

  test('admin can create a new announcement', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('admin/announcements');
    await expect(page.getByRole('heading', { name: 'Quepid Announcements for Users' })).toBeVisible();

    const announcementText = `Playwright announcement ${Date.now()}`;

    await page.getByRole('link', { name: 'New Quepid Announcement' }).click();
    await expect(page).toHaveURL(/\/admin\/announcements\/new/);

    await page.locator('#announcement_text').fill(announcementText);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // AnnouncementsController#create redirects to edit_admin_announcement_path on success.
    await expect(page).toHaveURL(/\/admin\/announcements\/\d+\/edit/);
    await expect(page.getByRole('heading', { name: 'Edit Quepid Announcement' })).toBeVisible();
    await expect(page.locator('#announcement_text')).toHaveValue(announcementText);

    await page.goto(`admin/announcements?q=${encodeURIComponent(announcementText)}`);
    await expect(page.locator('table tbody tr', { hasText: announcementText })).toBeVisible();
  });

  test('a non-admin user is denied access to the admin namespace', async ({ page }) => {
    await loginAs(page, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD);

    await page.goto('admin');

    // Admin::AdminController#require_administrator redirects non-admins to
    // root_path with a notice rather than rendering the admin panel.
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.locator('#flash')).toContainText('You must be a Quepid Administrator.');
  });
});
