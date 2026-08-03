import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Found a New Post/ }).click();
  await page.getByRole('button', { name: /Choose Your Company/ }).click();
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('benches and re-activates a hero from the Characters screen', async ({ page }) => {
  await foundPost(page);

  // Six pool heroes plus the always-active POV hero start on active duty.
  await expect(page.locator('.hero-bar .hero-tile')).toHaveCount(7);

  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await expect(page.locator('.faction-row')).toContainText('7 / 7');
  await expect(page.locator('.char-card')).toHaveCount(7);

  // Bench a pool hero (Berrin) — the POV hero's own Bench button is disabled.
  const berrinCard = page.locator('.char-card:not(.reserve)').filter({ hasText: 'Berrin' });
  await berrinCard.getByRole('button', { name: 'Bench' }).click();

  await expect(page.locator('.faction-row')).toContainText('6 / 7');
  await expect(page.locator('.char-card.reserve')).toHaveCount(1);
  // The hero bar now shows only the active party.
  await expect(page.locator('.hero-bar .hero-tile')).toHaveCount(6);

  // Bring them back up.
  await page.locator('.char-card.reserve').getByRole('button', { name: 'Activate' }).click();

  await expect(page.locator('.faction-row')).toContainText('7 / 7');
  await expect(page.locator('.char-card.reserve')).toHaveCount(0);
  await expect(page.locator('.hero-bar .hero-tile')).toHaveCount(7);
});
