import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('the Outpost Overview shows the Concession and re-apportions its land', async ({ page }) => {
  await foundPost(page);
  await page.getByRole('button', { name: 'Outpost', exact: true }).click();

  const peopleColumn = page.locator('.panel', { hasText: 'The People' });
  // A fresh post starts with a founding handful of farmers/guards.
  await expect(peopleColumn).toContainText('4 / 60');

  const concession = page.locator('.concession-strip');
  await expect(concession).toContainText('The Concession');
  await expect(concession).toContainText('10 chains'); // starting Concession size
  await expect(concession).toContainText('supports 60');

  // Cropland starts at 50% of 10 chains = 5 chains.
  await expect(concession).toContainText('5 chains');

  // Re-apportion to 60/20/20 and apply — cropland becomes 6 chains.
  const landInputs = concession.locator('input[type="number"]');
  await landInputs.nth(0).fill('60');
  await landInputs.nth(1).fill('20');
  await landInputs.nth(2).fill('20');
  await concession.getByRole('button', { name: 'Apply' }).click();
  await expect(concession).toContainText('6 chains');
});
