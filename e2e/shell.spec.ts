import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
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
  await expect(tiles).toHaveCount(6);

  // First pool hero is Berrin; hovering his tile reveals the tooltip.
  const firstTooltip = tiles.first().locator('.hero-tooltip');
  await expect(firstTooltip).toBeHidden();
  await tiles.first().locator('.hero-portrait').hover();
  await expect(firstTooltip).toBeVisible();
  await expect(firstTooltip).toContainText('Berrin');
  await expect(firstTooltip).toContainText('Assigned:');

  // Clicking the portrait opens the existing Hero Sheet modal.
  await tiles.first().locator('.hero-portrait').click();
  await expect(page.locator('.hero-sheet')).toContainText('the Old Sergeant');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.hero-sheet')).toHaveCount(0);
});

test('dispatched heroes are dimmed as away, and the bar keeps all tiles', async ({ page }) => {
  await foundPost(page);

  // Send a one-hero envoy from the Map screen (same flow as diplomacy.spec).
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Njaro-Matu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Njaro-Matu' })).toBeVisible();
  await page.getByLabel('Purpose').selectOption('diplomacy');
  await page.locator('label.pick-row').last().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Send the Party ▸' }).click();

  await expect(page.locator('.hero-tile.away')).toHaveCount(1);
  await expect(page.locator('.hero-tile')).toHaveCount(6);
});
