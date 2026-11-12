const { test, expect } = require('@playwright/test');

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows the login form with labelled fields', async ({ page }) => {
    await expect(page).toHaveTitle(/ChatRooms/);
    await expect(page.getByRole('heading', { name: 'Join a conversation' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toBeVisible();
    await expect(page.getByLabel('Room', { exact: true })).toHaveValue('General');
    await expect(page.getByRole('button', { name: 'Join chat' })).toBeVisible();
  });

  test('empty name shows an inline error and does not navigate', async ({ page }) => {
    await page.getByRole('button', { name: 'Join chat' }).click();
    await expect(page.locator('#name-error')).toHaveText('Display name is required');
    await expect(page.getByLabel('Display name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/$/);
  });

  test('name longer than 30 characters is rejected', async ({ page }) => {
    await page.getByLabel('Display name').fill('a'.repeat(31));
    await page.getByRole('button', { name: 'Join chat' }).click();
    await expect(page.locator('#name-error')).toHaveText(/30 characters or fewer/);
  });

  test('invalid characters in the room are rejected', async ({ page }) => {
    await page.getByLabel('Display name').fill('Alice');
    await page.getByLabel('Room', { exact: true }).fill('<script>');
    await page.getByRole('button', { name: 'Join chat' }).click();
    await expect(page.locator('#room-error')).toHaveText(/can only contain/);
  });

  test('error clears when the user types', async ({ page }) => {
    await page.getByRole('button', { name: 'Join chat' }).click();
    await expect(page.locator('#name-error')).not.toBeEmpty();
    await page.getByLabel('Display name').fill('A');
    await expect(page.locator('#name-error')).toBeEmpty();
  });

  test('room chips fill the room field', async ({ page }) => {
    await page.getByRole('button', { name: '#Tech' }).click();
    await expect(page.getByLabel('Room', { exact: true })).toHaveValue('Tech');
  });

  test('valid input via Enter key saves the session and goes to the chat page', async ({
    page,
  }) => {
    await page.getByLabel('Display name').fill('  Alice  ');
    await page.getByLabel('Room', { exact: true }).fill('Tech');
    await page.getByLabel('Room', { exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/chat\.html$/);
    const session = await page.evaluate(() => sessionStorage.getItem('chatrooms.session'));
    expect(JSON.parse(session)).toEqual({ name: 'Alice', room: 'Tech' });
  });

  test('remembers the last name used', async ({ page }) => {
    await page.getByLabel('Display name').fill('Bob');
    await page.getByRole('button', { name: 'Join chat' }).click();
    await expect(page).toHaveURL(/chat\.html/);
    await page.goto('/');
    await expect(page.getByLabel('Display name')).toHaveValue('Bob');
  });

  test('?room= in the URL pre-fills the room (invite links)', async ({ page }) => {
    await page.goto('/?room=Design');
    await expect(page.getByLabel('Room', { exact: true })).toHaveValue('Design');
  });

  test('is usable with the keyboard only', async ({ page }) => {
    await page.getByLabel('Display name').focus();
    await page.keyboard.type('Keyboard User');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Room', { exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/chat\.html/);
  });

  test('layout fits a 375px mobile screen without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('.login-hero')).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
    const box = await page.locator('.login-card').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 8);
  });
});
