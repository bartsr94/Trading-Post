import { expect, test, type Page } from '@playwright/test';

// Regression coverage for FAMILY_PHASE_D_SPEC.md §2: a hero-to-hero marriage
// must show up on both spouses' own Hero Sheets after the fact. This was
// silently broken once already — the family graph (spousesOf) and the
// Characters screen's family strip were both correct, but the Hero Sheet
// built its Family section from `dependantsOf` alone, which a hero-to-hero
// union (deliberately) never populates since no Dependant is created for it.

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

/** Turns on cheat mode and opens the Cheat Console. */
async function openCheatConsole(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Cheat mode').check();
  await page.getByRole('button', { name: 'Open Cheat Console' }).click();
  await expect(page.getByRole('heading', { name: 'Cheat Console' })).toBeVisible();
}

test('a hero-to-hero marriage shows the partner on both Hero Sheets, the Characters screen, and the family tree', async ({
  page,
}) => {
  await foundPost(page);
  await openCheatConsole(page);

  // The Family panel's hero-marriage row defaults to the first two eligible
  // heroes — Berrin (p1) and Maela (p2), the founding party's first two.
  await expect(page.getByRole('button', { name: 'Force Hero-Hero Marriage' })).toBeEnabled();
  await page.getByRole('button', { name: 'Force Hero-Hero Marriage' }).click();
  await expect(page.locator('.cc-canvas')).toContainText('weds');
  await page.getByRole('button', { name: 'Close' }).click();

  // Hero Sheet: Berrin's Family section shows Maela as spouse.
  const tiles = page.locator('.hero-tile');
  await tiles.first().locator('.hero-portrait').click();
  await expect(page.locator('.hero-sheet')).toContainText('the Old Sergeant');
  await expect(page.locator('.hero-sheet')).toContainText('Family');
  await expect(page.locator('.hero-sheet .fam-tile')).toContainText('Maela');

  // Clicking the spouse tile jumps straight to Maela's own Hero Sheet, which
  // in turn shows Berrin back.
  await page.locator('.hero-sheet .fam-tile', { hasText: 'Maela' }).click();
  await expect(page.locator('.hero-sheet')).toContainText("the Factor's Daughter");
  await expect(page.locator('.hero-sheet .fam-tile')).toContainText('Berrin');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.hero-sheet')).toHaveCount(0);

  // Characters screen: the family strip also reflects the marriage. Scope by
  // the hero's own `.name` (not just any text in the card) — Maela's own
  // card now also contains the substring "Berrin", as her spouse.
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const berrinCard = page.locator('.char-card').filter({ has: page.locator('.name', { hasText: 'Berrin' }) });
  await expect(berrinCard.locator('.char-family')).toContainText('Maela');

  // The family tree modal shows both spouses linked.
  await berrinCard.getByRole('button', { name: 'Family tree ▸' }).click();
  await expect(page.locator('.ft-modal')).toContainText('Berrin');
  await expect(page.locator('.ft-modal')).toContainText('Maela');
});
