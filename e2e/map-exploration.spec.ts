import { expect, test, type Page } from '@playwright/test';

async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
}

async function clickMap(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('.spatial-map-svg').boundingBox();
  if (!box) throw new Error('Map has no bounding box');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

test('illustrated map exposes exact places, approximate rumors, and free targets', async ({ page }) => {
  await foundPost(page);

  await expect(page.locator('.spatial-map-svg image')).toHaveAttribute('href', /ashmark_map/);
  await expect(page.getByRole('button', { name: 'Njaro-Matu', exact: true })).toBeVisible();
  const shackle = page.getByRole('button', { name: 'Shackle Station', exact: true });
  await expect(shackle.locator('.map-node-hit')).toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
  await expect(shackle.locator('circle').nth(1)).toHaveCSS('fill', 'rgba(29, 25, 20, 0.9)');
  await shackle.click();
  await expect(page.getByRole('heading', { name: 'Shackle Station' })).toBeVisible();
  const ashcircleRumor = page.getByRole('button', { name: 'Search near The Ashcircle' });
  await expect(ashcircleRumor).toBeVisible();
  await ashcircleRumor.click();
  await expect(page.getByRole('heading', { name: 'Explore the Ashmark' })).toBeVisible();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.map-toolbar')).toContainText('1.5');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.map-toolbar')).toContainText('1.0');

  // Western interior is still checkpoint-locked on a fresh game.
  await clickMap(page, 0.25, 0.4);
  await expect(page.locator('.map-coordinate-readout')).toHaveText(/^x 0\.\d{4} · y 0\.\d{4}$/);
  await expect(page.getByText('This country lies beyond your known routes.')).toBeVisible();

  // Reachable eastern/charter country accepts an arbitrary point.
  await clickMap(page, 0.58, 0.39);
  await expect(page.getByText(/Target: the charter corridor/)).toBeVisible();
  await page.getByLabel('Pace').selectOption('fast');
  await page.locator('.map-party-picks input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Send the Party ▸' }).click();
  await expect(page.getByRole('heading', { name: 'On the Road' })).toBeVisible();
  await expect(page.locator('.road-row')).toHaveCount(1);
});
