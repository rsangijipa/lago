import { expect, test } from '@playwright/test';

test('exposes an interactive keyboard-accessible WebGL pond', async ({ page }) => {
  await page.goto('/');
  const pond = page.getByRole('application', { name: /Lago interativo/ });
  await expect(pond).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await pond.focus();
  await expect(pond).toBeFocused();
  await page.keyboard.press('Space');
});

test('keeps automatic and manual quality profiles available', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-toggle-expand').click();
  await expect(page.locator('#quality-profile')).toHaveValue('auto');
  await page.locator('#quality-profile').selectOption('economy');
  await expect(page.locator('#quality-profile')).toHaveValue('economy');
});
