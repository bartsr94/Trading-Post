import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('hiring a resident adds a hand to the pool on the Post screen', async ({ page }) => {
  await foundPost(page);
  await page.getByRole('button', { name: /Post/ }).first().click();

  const panel = page.locator('.panel', { hasText: "The Post's People" });
  await expect(panel).toContainText('No one has settled here yet');

  // Hire a farmer (20 of the starting 200 silver).
  await panel.getByRole('button', { name: 'Hire (20)' }).click();

  // The pool now shows one hand against the tier-1 cap, with upkeep lines.
  await expect(panel).not.toContainText('No one has settled here yet');
  await expect(panel).toContainText('1 / 4');
  await expect(panel).toContainText('grain / turn');
});
