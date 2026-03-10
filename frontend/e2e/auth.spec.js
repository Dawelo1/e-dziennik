import { test, expect } from '@playwright/test';
import { disableWebSocket, mockApi, loginThroughUi, expectParentLayout, expectDirectorLayout } from './helpers/mockApi';

test.describe('Auth E2E', () => {
  test('parent login redirects to parent dashboard', async ({ page }) => {
    await disableWebSocket(page);
    await mockApi(page, { role: 'parent' });

    await loginThroughUi(page, { username: 'e2e_parent', password: 'secret123' });

    await expect(page).toHaveURL(/\/dashboard$/);
    await expectParentLayout(page);
  });

  test('director login redirects to director dashboard', async ({ page }) => {
    await disableWebSocket(page);
    await mockApi(page, { role: 'director' });

    await loginThroughUi(page, { username: 'e2e_director', password: 'secret123' });

    await expect(page).toHaveURL(/\/director\/dashboard$/);
    await expectDirectorLayout(page);
    await expect(page.getByText('Pulpit Zarządczy')).toBeVisible();
  });
});
