import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';

// Coverage for the email sign-up flow (Users::SignupsController#create). The sign-up
// form renders on the same page as sign-in (app/views/sessions/new.html.erb, #signup
// form) and posts to users_signup_path.
//
// This creates real new users in the shared dev DB, mirroring how other seeded-data
// specs in this suite already behave — emails are scoped with a recognizable prefix.
// They're deleted in afterAll below (see the comment there for why that matters).

function uniqueEmail(): string {
  return `playwright-test-signup-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

const PASSWORD = 'Playwright-Test-Password-1';

const ADMIN_EMAIL = process.env.QUEPID_E2E_ADMIN_EMAIL ?? 'quepid+admin@o19s.com';
const ADMIN_PASSWORD = process.env.QUEPID_E2E_ADMIN_PASSWORD ?? 'password';

// ids of users created by this file's tests, collected so afterAll can delete them.
const createdUserIds: number[] = [];

async function fillAndSubmitSignup(page: import('@playwright/test').Page, name: string, email: string): Promise<void> {
  await page.goto('sessions/new');
  // sessions/new.html.erb builds this form via `form_for(@user, ..., id: 'signup', ...)`,
  // but form_for's top-level `id:` option is not an HTML attribute (unlike form_with, which
  // the sign-in form on the same page uses for its `id: 'login'`) — the rendered id falls back
  // to Rails' default `new_user`.
  const signupForm = page.locator('form#new_user');
  await signupForm.locator('#user_name').fill(name);
  await signupForm.locator('#user_email').fill(email);
  await signupForm.locator('#user_password').fill(PASSWORD);
  await signupForm.locator('#user_password_confirmation').fill(PASSWORD);
  await signupForm.locator('input[type="submit"][value="Sign up"]').click();
}

// Records the id of the just-signed-up (and now logged-in) user via
// Api::V1::CurrentUserController#show, so afterAll can delete it by id.
async function recordCurrentUserId(page: Page): Promise<void> {
  const response = await page.request.get('api/users/current', {
    headers: { Accept: 'application/json' }
  });
  expect(response.ok()).toBeTruthy();
  const { id } = await response.json();
  createdUserIds.push(id);
}

/**
 * signup.spec.ts used to create these users with no teardown, so every suite run
 * left another "Playwright Test User" row behind in the shared dev DB permanently.
 * That's the same leak teams.spec.ts hit with team rows (see its afterAll comment) —
 * it can silently change what other specs see (e.g. admin.spec.ts's user list/search,
 * or any future user-count assertion). Delete each created user once this file's
 * tests are done, however they ended.
 */
test.afterAll(async ({ browser }) => {
  if (createdUserIds.length === 0) return;

  const page: Page = await browser.newPage({ baseURL: playwrightBaseURL() });
  try {
    await page.goto('sessions/new');
    const loginForm = page.locator('form#login');
    await loginForm.locator('#user_email').fill(ADMIN_EMAIL);
    await loginForm.locator('#user_password').fill(ADMIN_PASSWORD);
    await loginForm.locator('input[type="submit"][value="Sign in"]').click();
    await expect(page).not.toHaveURL(/\/sessions\/new/);

    const csrf = await page.evaluate(() =>
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
    );

    for (const id of createdUserIds) {
      const response = await page.request.delete(`admin/users/${id}`, {
        headers: { Accept: 'application/json', 'X-CSRF-Token': csrf }
      });
      // Assert like every other cleanup in this suite: a silent failure here would
      // let these exact users leak right back in on the next run with no signal.
      expect(response.ok()).toBeTruthy();
    }
  } finally {
    await page.close();
  }
});

test.describe('sign up', () => {
  test('submitting a valid new account creates the user and logs them in', async ({ page }) => {
    const email = uniqueEmail();

    await fillAndSubmitSignup(page, 'Playwright Test User', email);

    // SignupsController#create sets session[:current_user_id] and redirects to root_path
    // (home#show), landing the new user on their (empty) dashboard, greeted by name.
    await expect(page).not.toHaveURL(/\/sessions\/new/);
    await expect(page.getByRole('heading', { name: /Playwright Test User/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome to Quepid!' })).toBeVisible();

    await recordCurrentUserId(page);
  });

  test('submitting a duplicate email re-renders the form with an error', async ({ page }) => {
    const email = uniqueEmail();

    // First signup succeeds and establishes the email in the DB.
    await fillAndSubmitSignup(page, 'Playwright Duplicate Seed', email);
    await expect(page).not.toHaveURL(/\/sessions\/new/);
    await recordCurrentUserId(page);

    // Sign out, then attempt to sign up again with the same email address.
    await page.goto('logout');

    await fillAndSubmitSignup(page, 'Playwright Duplicate Attempt', email);

    // Failed create renders the `sessions/new` template in place (no redirect), so the
    // URL stays on the POST target (users_signup_path -> /users/signup) rather than
    // navigating back to /sessions/new.
    await expect(page).toHaveURL(/\/users\/signup$/);
    await expect(page.locator('#error_explanation')).toContainText(/email/i);
  });
});
