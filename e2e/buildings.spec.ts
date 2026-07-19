import { expect, test, type Page } from '@playwright/test';

/** Picks the first 6 heroes and founds the post, landing on the Assignments screen. */
async function foundPost(page: Page): Promise<void> {
  await page.goto('/');
  const cards = page.locator('.hero-card');
  for (let i = 0; i < 6; i++) await cards.nth(i).click();
  await page.getByRole('button', { name: /Found the Post/ }).click();
  await expect(page.getByRole('button', { name: /Confirm Orders/ })).toBeVisible();
}

test('starts a construction project and unlocks the Build assignment', async ({ page }) => {
  await foundPost(page);

  // Build is not assignable until a project exists.
  const firstRow = page.locator('.assign-row').first();
  await expect(firstRow.getByRole('button', { name: 'Build', exact: true })).toBeDisabled();

  // Open the Post screen and break ground on the Storehouse.
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Buildings/ })).toBeVisible();
  const storehouse = page.locator('.build-option', {
    has: page.getByText('Storehouse', { exact: true }),
  });
  await storehouse.getByRole('button', { name: 'Build' }).click();

  // The active project shows with zero progress.
  await expect(page.locator('.construction-active')).toContainText('Storehouse');
  await expect(page.locator('.construction-active')).toContainText('0 / 4');

  // Back on Assignments, Build is now assignable — put a hero on it.
  await page.getByRole('button', { name: /Assignments/ }).click();
  const buildBtn = page
    .locator('.assign-row')
    .first()
    .getByRole('button', { name: 'Build', exact: true });
  await expect(buildBtn).toBeEnabled();
  await buildBtn.click();
  await expect(buildBtn).toHaveClass(/active/);

  // Cancelling the project (auto-accept the confirm) clears the slot.
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.locator('.construction-active').getByRole('button', { name: /Cancel Project/ }).click();
  await expect(page.locator('.construction-active')).toHaveCount(0);
});
