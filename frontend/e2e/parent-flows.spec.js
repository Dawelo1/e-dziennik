import { test, expect } from '@playwright/test';
import { disableWebSocket, mockApi, setToken, expectParentLayout } from './helpers/mockApi';

test.describe('Parent critical flows', () => {
  test.beforeEach(async ({ page }) => {
    await disableWebSocket(page);
    await setToken(page, 'e2e-token');
    await mockApi(page, {
      role: 'parent',
      messages: [
        {
          id: 1,
          sender: 201,
          sender_name: 'Dyrektor',
          receiver: 101,
          receiver_name: 'Parent',
          body: 'Dzień dobry',
          subject: 'Czat',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    });
  });

  test('parent can open messages and send a chat message', async ({ page }) => {
    await page.goto('/messages');
    await expectParentLayout(page);

    await expect(page.getByText('Dyrekcja Przedszkola')).toBeVisible();
    await page.getByPlaceholder('Napisz wiadomość...').fill('Test wiadomości E2E');
    await page.locator('.chat-input-area button[type="submit"]').click();

    await expect(page.getByText('Test wiadomości E2E')).toBeVisible();
  });

  test('parent can save new email in settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Ustawienia Konta' })).toBeVisible();

    await page.getByPlaceholder('Nowy Email').fill('nowy@email.test');
    await page.getByRole('button', { name: 'Zapisz Email' }).click();

    await expect(page.getByText('Dane kontaktowe zostały zapisane.')).toBeVisible();
  });

  test('parent cannot access director panel route', async ({ page }) => {
    await page.goto('/director/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expectParentLayout(page);
  });

  test('parent can open attendance screen', async ({ page }) => {
    await page.goto('/attendance');

    await expect(page.getByText('Zgłoś Nieobecność')).toBeVisible();
    await expect(page.getByText('Kliknij w dzień roboczy, aby zgłosić nieobecność.')).toBeVisible();
  });
});
