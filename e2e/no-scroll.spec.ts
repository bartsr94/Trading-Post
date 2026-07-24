// Enforces Bartosz's hard UI rule: no in-shell screen may scroll — a scrollbar
// hides information, so a view that outgrows the content pane is a bug (split it
// into a new screen instead). We measure at 1280x720, the supported floor; if a
// screen fits there it fits on anything larger. Allow 1px for sub-pixel rounding.
import { expect, test, type Page } from '@playwright/test';

const FLOOR = { width: 1280, height: 720 };
const TOLERANCE = 1;

async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

/** Extra vertical the content pane would need to reveal — 0 means no scroll. */
async function overflow(page: Page): Promise<number> {
  return page.locator('.content').evaluate((el) => el.scrollHeight - el.clientHeight);
}

async function goto(page: Page, name: string): Promise<void> {
  await page.locator('.sidebar nav button', { hasText: new RegExp(`^${name}`) }).click();
}

async function clickMap(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('.spatial-map-svg').boundingBox();
  if (!box) throw new Error('Map has no bounding box');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

const SCREENS = ['Outpost', 'Assignments', 'Characters', 'Buildings', 'Map', 'Market'];

test('no in-shell screen scrolls at the 1280x720 floor', async ({ page }) => {
  await page.setViewportSize(FLOOR);
  await foundPost(page);

  for (const name of SCREENS) {
    await goto(page, name);
    expect(await overflow(page), `${name} screen scrolls`).toBeLessThanOrEqual(TOLERANCE);
  }

  // Outpost with an Idle Hands section revealed (merged in from the old People
  // screen) — releasing a hand grows the dashboard's People column.
  await goto(page, 'Outpost');
  await page
    .locator('.hand-row', { hasText: 'Farmers' })
    .getByRole('button', { name: 'Release' })
    .click();
  expect(await overflow(page), 'Outpost (idle hands revealed) scrolls').toBeLessThanOrEqual(
    TOLERANCE,
  );

  // Map with a node selected expands the detail column.
  await goto(page, 'Map');
  await page.locator('.map-node').first().click();
  expect(await overflow(page), 'Map (node selected) scrolls').toBeLessThanOrEqual(TOLERANCE);

  await page.getByRole('button', { name: /Search near/ }).first().click();
  expect(await overflow(page), 'Map (rumor selected) scrolls').toBeLessThanOrEqual(TOLERANCE);

  await clickMap(page, 0.58, 0.39);
  expect(await overflow(page), 'Map (free target selected) scrolls').toBeLessThanOrEqual(TOLERANCE);
  await page.locator('.map-party-picks input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /Send the Party/ }).click();
  expect(await overflow(page), 'Map (On the Road) scrolls').toBeLessThanOrEqual(TOLERANCE);

  // Market with a destination chosen expands the caravan planner — the tallest
  // reachable state. The fresh game already has visited markets to pick.
  await goto(page, 'Market');
  const destinationSelect = page.getByLabel(/Destination/);
  const options = destinationSelect.locator('option');
  if ((await options.count()) > 1) {
    await destinationSelect.selectOption({ index: 1 });
    expect(await overflow(page), 'Market (destination chosen) scrolls').toBeLessThanOrEqual(
      TOLERANCE,
    );
  }
});
