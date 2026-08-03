import { expect, test, type Page } from '@playwright/test';

// Regression coverage for EVENT_CAST_PORTRAITS_SPEC.md (folded into
// GAME_FEATURES.md §13): the Event Panel overlays one portrait chip per
// hero the event is actually about — the bound hero always, plus a second
// chip once a chain populates `vars.partnerId` (the hero-to-hero marriage
// chain in familyEvents.ts is the one shipped case of that today).

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

/** Turns on cheat mode and opens the Cheat Console. */
async function openCheatConsole(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Cheat mode').check();
  await page.getByRole('button', { name: 'Open Cheat Console' }).click();
  await expect(page.getByRole('heading', { name: 'Cheat Console' })).toBeVisible();
}

/** Force-fires an event on the given hero via the console's Force Event section. */
async function forceEvent(page: Page, eventTitle: string, heroName: string): Promise<void> {
  const panel = page.locator('.panel', { hasText: 'Force Event' });
  await panel.locator('select').first().selectOption({ label: eventTitle });
  await panel.locator('select').nth(1).selectOption({ label: heroName });
  await panel.getByRole('button', { name: 'Fire Now' }).click();
}

test('a single-hero event shows exactly one cast portrait, named for the bound hero', async ({ page }) => {
  await foundPost(page);
  await openCheatConsole(page);

  // ForceEventSection closes the console itself once the force succeeds.
  await forceEvent(page, 'Two Hearts at the Post', 'Berrin');

  await expect(page.locator('.event-panel')).toBeVisible();
  await expect(page.locator('.event-cast-chip')).toHaveCount(1);
  await expect(page.locator('.event-cast-name')).toHaveText('Berrin');
});

test('a hero-to-hero chain shows both participants once a partner is picked', async ({ page }) => {
  await foundPost(page);
  await openCheatConsole(page);

  await forceEvent(page, 'Two Hearts at the Post', 'Berrin');

  // "Let it be known." runs pickPartner + continueChain straight into
  // family_party_spark_ask, whose body text names the partner pickPartner
  // chose (random, so not asserted by name up front — read back from the
  // prose instead of hardcoding a specific hero).
  await page.locator('.choice-list button', { hasText: 'Let it be known.' }).click();
  await page.getByRole('button', { name: 'Continue ▸' }).click();

  await expect(page.getByRole('heading', { name: 'The Question' })).toBeVisible();
  const bodyText = await page.locator('.event-body .text').innerText();
  const partnerName = bodyText.match(/^Berrin finds (\w+)/)?.[1];
  expect(partnerName, `expected the body text to name a partner: "${bodyText}"`).toBeTruthy();

  await expect(page.locator('.event-cast-chip')).toHaveCount(2);
  await expect(page.locator('.event-cast-name').nth(0)).toHaveText('Berrin');
  await expect(page.locator('.event-cast-name').nth(1)).toHaveText(partnerName!);
});
