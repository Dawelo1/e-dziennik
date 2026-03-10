import { test, expect } from '@playwright/test';
import { disableWebSocket, mockApi, setToken, expectDirectorLayout } from './helpers/mockApi';

test.describe('Director critical flows', () => {
  test.beforeEach(async ({ page }) => {
    await disableWebSocket(page);
    await setToken(page, 'e2e-token');
    await mockApi(page, { role: 'director' });
  });

  test('director can open dashboard and see stats cards', async ({ page }) => {
    await page.goto('/director/dashboard');

    await expectDirectorLayout(page);
    await expect(page.getByText('Pulpit Zarządczy')).toBeVisible();
    await expect(page.getByText('Nowych Wiadomości')).toBeVisible();
  });

  test('director can open users and open add-user modal', async ({ page }) => {
    await page.goto('/director/users');

    await expect(page.getByText('Zarządzanie Użytkownikami')).toBeVisible();
    await page.getByRole('button', { name: 'Dodaj Użytkownika' }).click();
    await expect(page.getByText('Dodaj Nowego Użytkownika')).toBeVisible();
  });

  test('director can open messages view', async ({ page }) => {
    await page.goto('/director/messages');

    await expect(page.getByRole('heading', { name: 'Wiadomości' })).toBeVisible();
    await expect(page.getByPlaceholder('Szukaj rodzica...')).toBeVisible();
  });
});
