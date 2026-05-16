import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const authFile = path.join(__dirname, '.auth', 'user.json');
const email = process.env.QUEPID_E2E_EMAIL ?? 'quepid+realisticactivity@o19s.com';
const password = process.env.QUEPID_E2E_PASSWORD ?? 'password';

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/sessions/new');
  // The page renders both the sign-in (#login) and sign-up (#new_user) forms,
  // each with a #user_email / #user_password input. Scope to the login form.
  const loginForm = page.locator('form#login');
  await loginForm.locator('#user_email').fill(email);
  await loginForm.locator('#user_password').fill(password);
  await loginForm.locator('input[type="submit"][value="Sign in"]').click();

  await expect(page).not.toHaveURL(/\/sessions\/new/);
  await page.context().storageState({ path: authFile });
});
