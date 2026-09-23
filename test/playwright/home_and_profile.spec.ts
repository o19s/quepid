import { test, expect } from '@playwright/test';

// Coverage for the home dashboard (HomeController#show, the root path) and
// the profile page (ProfilesController#show/#update).
//
// signup.spec.ts already covers the dashboard's *empty* state (a brand-new
// user with no cases/books sees the "Welcome to Quepid!" onboarding panel).
// This spec covers the opposite: the default seeded identity
// (quepid+realisticactivity@o19s.com) already owns real cases, so the
// dashboard should render its greeting plus the Cases summary instead.

test.describe('home dashboard', () => {
  test('shows a personalized greeting and the existing-user cases summary', async ({ page }) => {
    await page.goto('/');

    // HomeController#show sets @cases from cases_involved_with, so a user
    // with real cases sees the greeting heading + Cases card, not the
    // "Welcome to Quepid!" onboarding panel signup.spec.ts asserts on.
    await expect(page.getByRole('heading', { name: /Realistic Activity/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome to Quepid!' })).toHaveCount(0);

    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible();
    const rows = page.locator('.card:has(> .card-header:text-is("Cases")) table tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // link_to ... role: 'button' overrides the accessible role, so this is a
    // "button" in the a11y tree even though it renders as an <a>.
    await expect(page.getByRole('button', { name: 'View all Cases' })).toBeVisible();
  });
});

test.describe('profile', () => {
  test('updating the name field persists and shows a success indication', async ({ page }) => {
    await page.goto('profile');
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();

    const nameField = page.locator('#user_name');
    const originalName = await nameField.inputValue();
    const updatedName = `Playwright Profile Update ${Date.now()}`;

    try {
      await nameField.fill(updatedName);
      await page.getByRole('button', { name: 'Update profile', exact: true }).click();

      // ProfilesController#update redirects back to profile_path with a notice on success.
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.locator('#flash')).toContainText('Profile updated successfully.');
      await expect(page.locator('h5.mb-1')).toHaveText(updatedName);
      await expect(page.locator('#user_name')).toHaveValue(updatedName);
    } finally {
      // Restore the original name so this test doesn't permanently rename the
      // shared dev user for the rest of the suite (or other agents' runs).
      await page.locator('#user_name').fill(originalName);
      await page.getByRole('button', { name: 'Update profile', exact: true }).click();
      await expect(page.locator('#flash')).toContainText('Profile updated successfully.');
      await expect(page.locator('#user_name')).toHaveValue(originalName);
    }
  });
});
