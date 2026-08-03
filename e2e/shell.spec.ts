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

test('hero bar shows the company, tooltip on hover, hero sheet on click', async ({ page }) => {
  await foundPost(page);

  await page.getByRole('button', { name: 'Outpost', exact: true }).click();
  await expect(page.locator('.hero-bar').getByRole('button', { name: /Confirm Orders/ })).toBeVisible();

  const tiles = page.locator('.hero-tile');
  await expect(tiles).toHaveCount(7);

  // The POV hero is pinned first; Berrin (first pool hero) is a distinct tile.
  const berrinTile = tiles.filter({ has: page.locator('[aria-label="Berrin"]') });
  const berrinTooltip = berrinTile.locator('.hero-tooltip');
  await expect(berrinTooltip).toBeHidden();
  await berrinTile.locator('.hero-portrait').hover();
  await expect(berrinTooltip).toBeVisible();
  await expect(berrinTooltip).toContainText('Berrin');
  await expect(berrinTooltip).toContainText('Assigned:');

  // Clicking the portrait opens the existing Hero Sheet modal.
  await berrinTile.locator('.hero-portrait').click();
  await expect(page.locator('.hero-sheet')).toContainText('the Old Sergeant');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.hero-sheet')).toHaveCount(0);
});

test('dispatched heroes are dimmed as away, and the bar keeps all tiles', async ({ page }) => {
  await foundPost(page);

  // Send a one-hero explore party from the Map screen.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Njaro-Matu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Njaro-Matu' })).toBeVisible();
  await page.locator('label.pick-row').last().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Send the Party ▸' }).click();

  await expect(page.locator('.hero-tile.away')).toHaveCount(1);
  await expect(page.locator('.hero-tile')).toHaveCount(7);
});
