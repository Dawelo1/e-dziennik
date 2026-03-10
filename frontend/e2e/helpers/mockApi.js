import { expect } from '@playwright/test';

export async function disableWebSocket(page) {
  await page.addInitScript(() => {
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        setTimeout(() => {
          if (this.onopen) this.onopen({ type: 'open' });
        }, 0);
      }

      send() {}

      close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ type: 'close' });
      }

      addEventListener() {}

      removeEventListener() {}
    }

    window.WebSocket = MockWebSocket;
  });
}

export async function setToken(page, token = 'e2e-token') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('token', value);
  }, token);
}

export async function mockApi(page, options = {}) {
  const role = options.role || 'parent';
  const state = {
    attendance: options.attendance || [],
    messages: options.messages || [],
  };

  const users = {
    parent: {
      id: 101,
      username: 'e2e_parent',
      first_name: 'E2E',
      last_name: 'Parent',
      email: 'e2e_parent@example.com',
      is_parent: true,
      is_director: false,
      child_groups: ['Smerfy'],
      avatar: null,
      avatar_url: null,
    },
    director: {
      id: 201,
      username: 'e2e_director',
      first_name: 'E2E',
      last_name: 'Director',
      email: 'e2e_director@example.com',
      is_parent: false,
      is_director: true,
      child_groups: [],
      avatar: null,
      avatar_url: null,
    },
  };

  const me = role === 'director' ? users.director : users.parent;

  await page.route('http://127.0.0.1:8000/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    const json = (data, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

    if (path === '/api-token-auth/' && method === 'POST') {
      const isDirector = role === 'director';
      return json({ token: 'e2e-token', is_director: isDirector });
    }

    if (path === '/api/users/me/' && method === 'GET') {
      return json(me);
    }

    if (path === '/api/users/notifications/summary/' && method === 'GET') {
      return json({ schedule: 0, gallery: 0, calendar: 0, payments: 0 });
    }

    if (path === '/api/users/director-status/' && method === 'GET') {
      return json({ is_online: true, avatar: null });
    }

    if (path === '/api/newsfeed/' && method === 'GET') {
      return json([]);
    }

    if (path === '/api/calendar/activities/' && method === 'GET') {
      return json([]);
    }

    if (path === '/api/payments/' && method === 'GET') {
      return json([]);
    }

    if (path === '/api/users/logout/' && method === 'POST') {
      return json({ message: 'ok' });
    }

    if (path === '/api/children/' && method === 'GET') {
      return json([
        {
          id: 301,
          first_name: 'Jan',
          last_name: 'Nowak',
          medical_info: '',
          group: 1,
          parents: [me.id],
        },
      ]);
    }

    if (path === '/api/calendar/closures/' && method === 'GET') {
      return json([]);
    }

    if (path === '/api/attendance/' && method === 'GET') {
      return json(state.attendance);
    }

    if (path === '/api/attendance/' && method === 'POST') {
      const body = request.postDataJSON();
      const created = {
        id: 900 + state.attendance.length,
        child: body.child,
        status: 'absent',
        date: body.date,
        created_at: new Date().toISOString(),
      };
      state.attendance.push(created);
      return json(created, 201);
    }

    if (path.startsWith('/api/attendance/') && method === 'DELETE') {
      return route.fulfill({ status: 204 });
    }

    if (path === '/api/communication/messages/' && method === 'GET') {
      return json(state.messages);
    }

    if (path === '/api/communication/messages/' && method === 'POST') {
      const body = request.postDataJSON();
      const created = {
        id: 1000 + state.messages.length,
        sender: me.id,
        sender_name: me.username,
        receiver: role === 'director' ? (body.receiver || 101) : 201,
        receiver_name: role === 'director' ? 'e2e_parent' : 'e2e_director',
        body: body.body,
        subject: body.subject || 'Czat',
        is_read: false,
        created_at: new Date().toISOString(),
      };
      state.messages.push(created);
      return json(created, 201);
    }

    if (path === '/api/communication/messages/mark_conversation_read/' && method === 'POST') {
      return json({ status: 'marked', updated_count: 0 });
    }

    if (path === '/api/users/manage/' && method === 'GET') {
      return json([
        {
          id: 101,
          username: 'e2e_parent',
          first_name: 'E2E',
          last_name: 'Parent',
          email: 'e2e_parent@example.com',
          phone_number: '+48123123123',
          is_parent: true,
          is_director: false,
        },
      ]);
    }

    if (path === '/api/users/manage/generate-credentials/' && method === 'GET') {
      return json({ username: 'p12345m', password: 'Generated123!' });
    }

    if (path === '/api/director/stats/' && method === 'GET') {
      return json({ unread_messages: 1, absent_today: 0, present_today: 10, total_children: 10 });
    }

    if (path === '/api/groups/' && method === 'GET') {
      return json([{ id: 1, name: 'Smerfy', teachers_info: 'Ala' }]);
    }

    if (path === '/api/users/me/' && method === 'PATCH') {
      return json({ ...me, ...request.postDataJSON() });
    }

    if (path === '/api/users/change-password/' && method === 'PUT') {
      return json({ detail: 'Hasło zostało zmienione.' });
    }

    return json({});
  });
}

export async function loginThroughUi(page, { username = 'test', password = 'test123' } = {}) {
  await page.goto('/');
  await page.getByPlaceholder('LOGIN / E-MAIL').fill(username);
  await page.getByPlaceholder('HASŁO').fill(password);
  await page.getByRole('button', { name: 'ZALOGUJ SIĘ' }).click();
}

export async function expectParentLayout(page) {
  await expect(page.getByText('Główna').first()).toBeVisible();
  await expect(page.getByText('Wiadomości').first()).toBeVisible();
}

export async function expectDirectorLayout(page) {
  await expect(page.getByText('Panel Dyrektora')).toBeVisible();
  await expect(page.getByText('Pulpit').first()).toBeVisible();
}
