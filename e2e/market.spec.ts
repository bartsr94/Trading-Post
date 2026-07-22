import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('the Map screen links to Market, focused on the destination it was opened from', async ({ page }) => {
  await foundPost(page);

  // Kalasha-Tora, not Njaro-Matu (the first market in the Caravan dropdown) —
  // proves the Market screen opens with the destination we actually clicked.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Kalasha-Tora', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kalasha-Tora' })).toBeVisible();

  await page.getByRole('button', { name: 'Send caravan →' }).click();

  await expect(page.getByRole('heading', { name: 'Post Market' })).toBeVisible();
  await expect(page.getByLabel('Destination')).toHaveValue('kalasha_tora');
  await expect(page.locator('table.market thead')).toContainText('Kalasha-Tora');
});

test('sends a caravan to a market from the Market screen', async ({ page }) => {
  await foundPost(page);

  await page.getByRole('button', { name: 'Market', exact: true }).click();
  await page.getByLabel('Destination').selectOption('river_meet');

  await page.locator('.pick-row').first().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Send the Caravan ▸' }).click();

  await page.getByRole('button', { name: 'Assignments', exact: false }).click();
  await expect(page.getByText('🐴 Caravan')).toBeVisible();
});
