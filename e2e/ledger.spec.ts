import { expect, test, type Page } from '@playwright/test';

async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Found a New Post/ }).click();
  await page.getByRole('button', { name: /Choose Your Company/ }).click();
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('the Ledger shows the price board with a shock marker', async ({ page }) => {
  await foundPost(page);

  // Seed observed intel + a live shock straight into the autosave, then resume
  // it — the Ledger reads recorded prices, which a fresh game has none of.
  await page.evaluate(() => {
    const key = 'trading-post-save';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.turn = 5;
    save.locations.river_meet.priceIntel = {
      furs: { price: 8, turnSeen: 4 },
      herbs: { price: 24, turnSeen: 4 },
    };
    save.marketShocks = [
      { locationId: 'river_meet', goodId: 'herbs', mod: 1.9, leadLeft: 0, turnsLeft: 3 },
    ];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: /Continue Saved Game/ }).click();

  await page.getByRole('button', { name: 'Ledger', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'The Ledger' })).toBeVisible();
  const table = page.locator('table.ledger');
  // The live post-price reference row and a discovered market row both render.
  await expect(table).toContainText('The Post — now');
  await expect(table).toContainText('Njaro-Matu');
  // The live herbs shock leaves a marker on that market's cell.
  await expect(table.locator('sup')).toHaveCount(1);
});
