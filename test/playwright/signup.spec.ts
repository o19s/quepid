import { test, expect } from '@playwright/test';

// Coverage for the email sign-up flow (Users::SignupsController#create). The sign-up
// form renders on the same page as sign-in (app/views/sessions/new.html.erb, #signup
// form) and posts to users_signup_path.
//
// This creates real new users in the shared dev DB, mirroring how other seeded-data
// specs in this suite already behave — emails are scoped with a recognizable prefix.

function uniqueEmail(): string {
  return `playwright-test-signup-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

const PASSWORD = 'Playwright-Test-Password-1';

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

test.describe('sign up', () => {
  test('submitting a valid new account creates the user and logs them in', async ({ page }) => {
    const email = uniqueEmail();

    await fillAndSubmitSignup(page, 'Playwright Test User', email);

    // SignupsController#create sets session[:current_user_id] and redirects to root_path
    // (home#show), landing the new user on their (empty) dashboard, greeted by name.
    await expect(page).not.toHaveURL(/\/sessions\/new/);
    await expect(page.getByRole('heading', { name: /Playwright Test User/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome to Quepid!' })).toBeVisible();
  });

  test('submitting a duplicate email re-renders the form with an error', async ({ page }) => {
    const email = uniqueEmail();

    // First signup succeeds and establishes the email in the DB.
    await fillAndSubmitSignup(page, 'Playwright Duplicate Seed', email);
    await expect(page).not.toHaveURL(/\/sessions\/new/);

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
