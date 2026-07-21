import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

/** Clicks through whatever events fire this turn with the first available choice. */
async function resolvePendingEvents(page: Page): Promise<void> {
  while ((await page.locator('.event-panel').count()) > 0) {
    await page.locator('.choice-list button:not([disabled])').first().click();
    await page.getByRole('button', { name: 'Continue ▸' }).click();
  }
}

test('Diplomacy assignment hosts the Company factor and moves standing', async ({ page }) => {
  await foundPost(page);

  await page.getByRole('button', { name: 'Diplomacy', exact: true }).first().click();
  await page.getByRole('button', { name: /Confirm Orders/ }).click();

  await resolvePendingEvents(page);

  await expect(page.locator('.report-lines')).toContainText("hosts the Company's factor");
  await page.getByRole('button', { name: /Begin Next Turn/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
});

test('sends an envoy to a faction seat from the Map screen', async ({ page }) => {
  await foundPost(page);

  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Njaro-Matu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Njaro-Matu' })).toBeVisible();
  await page.getByLabel('Purpose').selectOption('diplomacy');

  await page.locator('label.pick-row').last().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Send the Party ▸' }).click();

  await page.getByRole('button', { name: 'Assignments', exact: false }).click();
  await expect(page.getByText('🤝 Envoy')).toBeVisible();
});
