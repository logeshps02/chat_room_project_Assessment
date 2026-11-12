const { test, expect } = require('@playwright/test');

async function joinRoom(page, name, room) {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Room', { exact: true }).fill(room);
  await page.getByRole('button', { name: 'Join chat' }).click();
  await expect(page).toHaveURL(/\/chat\.html$/);
  await expect(page.locator('.connection-state')).toHaveAttribute('data-state', 'connected');
}

test.describe('Chat room', () => {
  test('direct chat URL without a session redirects to login', async ({ page }) => {
    await page.goto('/chat.html');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Join a conversation' })).toBeVisible();
  });

  test('joins the room and shows the online member', async ({ page }) => {
    await joinRoom(page, 'Alice', 'Presence');
    await expect(page.locator('#room-name')).toHaveText('Presence');
    await expect(page.locator('#user-count')).toHaveText('1');
    await expect(page.locator('#users-list')).toContainText('Alice');
    await expect(page.locator('.empty-state')).toContainText('Start the conversation');
    await expect(page.locator('#message-input')).toBeEnabled();
  });

  test('two people in the same room see each other’s messages and local timestamps', async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await joinRoom(alice, 'Alice', 'Live');
    await joinRoom(bob, 'Bob', 'Live');
    await expect(alice.locator('#user-count')).toHaveText('2');
    await expect(bob.locator('#users-list')).toContainText('Alice');

    await alice.locator('#message-input').fill('Hello from Alice');
    await alice.locator('#message-input').press('Enter');
    const bobMessage = bob.locator('.message-row').filter({ hasText: 'Hello from Alice' });
    await expect(bobMessage).toBeVisible();
    await expect(bobMessage.locator('.message-sender')).toHaveText('Alice');
    await expect(bobMessage.locator('time')).toHaveText(/\d{1,2}:\d{2}/);
    await expect(bobMessage.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d\d-\d\dT/);
    await expect(alice.locator('.message-row.is-mine')).toContainText('Hello from Alice');
    await expect(alice.locator('.message-row.is-mine .message-sender')).toHaveText('You');

    await aliceContext.close();
    await bobContext.close();
  });

  test('messages stay private to their room', async ({ browser }) => {
    const generalContext = await browser.newContext();
    const randomContext = await browser.newContext();
    const alice = await generalContext.newPage();
    const carol = await randomContext.newPage();

    await joinRoom(alice, 'Alice', 'Isolation');
    await joinRoom(carol, 'Carol', 'Random');
    await alice.locator('#message-input').fill('Only for Isolation');
    await alice.locator('#message-input').press('Enter');
    await expect(alice.locator('.message-bubble')).toContainText('Only for Isolation');
    await expect(carol.locator('.message-bubble')).toHaveCount(0);

    await generalContext.close();
    await randomContext.close();
  });

  test('a late joiner sees recent messages in chronological order', async ({ browser }) => {
    test.setTimeout(60_000);
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await joinRoom(alice, 'Alice', 'History');
    const input = alice.locator('#message-input');
    const messages = ['First message', 'Second message', 'Third message'];
    for (const [index, text] of messages.entries()) {
      await input.fill(text);
      await input.press('Enter');
      await expect(alice.locator('.message-row')).toHaveCount(index + 1);
    }

    await joinRoom(bob, 'Bob', 'History');
    await expect(bob.locator('.message-bubble')).toHaveText(messages);
    await expect(bob.locator('.message-row time')).toHaveCount(3);
    await expect(bob.locator('.message-row .message-sender')).toHaveText([
      'Alice',
      'Alice',
      'Alice',
    ]);

    await aliceContext.close();
    await bobContext.close();
  });

  test('typing indicator is visible only to other members and clears after idle', async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    await joinRoom(alice, 'Alice', 'Typing');
    await joinRoom(bob, 'Bob', 'Typing');

    await alice.locator('#message-input').fill('Still writing');
    await expect(bob.locator('#typing-indicator')).toHaveText('Alice is typing…');
    await expect(bob.locator('#typing-indicator')).toBeVisible();
    await expect(alice.locator('#typing-indicator')).toBeHidden();

    await alice.locator('#message-input').fill('');
    await expect(bob.locator('#typing-indicator')).toBeHidden();

    await alice.locator('#message-input').fill('This time I will pause');
    await expect(bob.locator('#typing-indicator')).toHaveText('Alice is typing…');
    await expect(bob.locator('#typing-indicator')).toBeHidden({ timeout: 5000 });

    await aliceContext.close();
    await bobContext.close();
  });

  test('unread tab title counts new messages and resets when the tab is focused', async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    await alice.addInitScript(() => {
      let visibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibilityState,
      });
      const browserHasFocus = document.hasFocus.bind(document);
      document.hasFocus = () => visibilityState === 'visible' && browserHasFocus();
      window.setTestVisibilityState = (state) => {
        visibilityState = state;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });
    await joinRoom(alice, 'Alice', 'Unread');
    await joinRoom(bob, 'Bob', 'Unread');

    await alice.evaluate(() => window.setTestVisibilityState('hidden'));
    await bob.locator('#message-input').fill('First unread');
    await bob.locator('#message-input').press('Enter');
    await expect(alice).toHaveTitle('(1) #Unread – ChatRooms');

    await bob.locator('#message-input').fill('Second unread');
    await bob.locator('#message-input').press('Enter');
    await expect(alice).toHaveTitle('(2) #Unread – ChatRooms');

    await alice.bringToFront();
    await alice.evaluate(() => window.setTestVisibilityState('visible'));
    await expect(alice).toHaveTitle('#Unread · ChatRooms');
    await expect(alice.locator('.message-bubble')).toHaveText(['First unread', 'Second unread']);

    await aliceContext.close();
    await bobContext.close();
  });

  test('retained history does not attribute another person’s reused name to the new user', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await joinRoom(alice, 'Alice', 'Ownership');
    await joinRoom(bob, 'Bob', 'Ownership');
    await alice.locator('#message-input').fill('Earlier Alice');
    await alice.locator('#message-input').press('Enter');
    await expect(bob.locator('.message-bubble')).toHaveText('Earlier Alice');

    await alice.reload();
    await expect(alice.locator('.connection-state')).toHaveAttribute('data-state', 'connected');
    await expect(alice.locator('.message-row.is-mine .message-bubble')).toHaveText('Earlier Alice');

    await aliceContext.close();
    await expect(bob.locator('#users-list')).not.toContainText('Alice');
    await joinRoom(bob, 'Alice', 'Ownership');
    const previousMessage = bob.locator('.message-row').filter({ hasText: 'Earlier Alice' });
    await expect(previousMessage).toBeVisible();
    await expect(previousMessage).not.toHaveClass(/is-mine/);
    await expect(previousMessage.locator('.message-sender')).toHaveText('Alice');

    await bob.locator('#message-input').fill('New Alice');
    await bob.locator('#message-input').press('Enter');
    await expect(bob.locator('.message-row.is-mine .message-bubble')).toHaveText('New Alice');

    await bobContext.close();
  });

  test('shows a new-message shortcut when scrolled up, then jumps to latest', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const aliceContext = await browser.newContext({ viewport: { width: 900, height: 500 } });
    const bobContext = await browser.newContext({ viewport: { width: 900, height: 500 } });
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await joinRoom(alice, 'Alice', 'Scroll');
    await joinRoom(bob, 'Bob', 'Scroll');
    const input = alice.locator('#message-input');
    for (let i = 1; i <= 8; i += 1) {
      await input.fill(`Message ${i}`);
      await input.press('Enter');
      await expect(alice.locator('.message-row')).toHaveCount(i);
    }

    await alice.locator('#messages').evaluate((element) => {
      element.scrollTop = 0;
    });
    await bob.locator('#message-input').fill('A newer message');
    await bob.locator('#message-input').press('Enter');
    await expect(
      alice.locator('.message-bubble').filter({ hasText: 'A newer message' })
    ).toBeVisible();
    const shortcut = alice.getByRole('button', { name: /New messages/ });
    await expect(shortcut).toBeVisible();
    await alice.locator('#messages').evaluate((element) => {
      element.style.scrollBehavior = 'auto';
    });
    await shortcut.click();
    await expect(shortcut).toBeHidden();
    await expect
      .poll(() =>
        alice
          .locator('#messages')
          .evaluate(
            (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 2
          )
      )
      .toBe(true);

    await aliceContext.close();
    await bobContext.close();
  });

  test('renders HTML-looking messages as text, never as markup', async ({ page }) => {
    await joinRoom(page, 'Alice', 'Security');
    const payload = '<img src=x onerror=alert(1)>';
    await page.locator('#message-input').fill(payload);
    await page.locator('#message-input').press('Enter');
    const bubble = page.locator('.message-bubble').filter({ hasText: payload });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText(payload);
    await expect(bubble.locator('img')).toHaveCount(0);
  });

  test('counts Unicode characters and sends long Unicode messages', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await joinRoom(alice, 'Alice', 'Unicode');
    await joinRoom(bob, 'Bob', 'Unicode');
    const text = `${'😀'.repeat(500)} தமிழ்`;
    await alice.locator('#message-input').fill(text);
    await expect(alice.locator('#char-count')).toHaveText('506 / 1000');
    await alice.locator('#message-input').press('Enter');
    await expect(bob.locator('.message-bubble')).toHaveText(text);

    await aliceContext.close();
    await bobContext.close();
  });

  test('blocks empty and over-limit messages and supports Shift+Enter', async ({ page }) => {
    await joinRoom(page, 'Alice', 'Composer');
    const input = page.locator('#message-input');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await input.fill('x'.repeat(1001));
    await expect(page.locator('#char-count')).toHaveText('1001 / 1000');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();

    await input.fill('first line');
    await input.press('Shift+Enter');
    await input.type('second line');
    await expect(input).toHaveValue('first line\nsecond line');
    await input.press('Enter');
    await expect(page.locator('.message-bubble')).toHaveText('first line\nsecond line');
    await expect(input).toHaveValue('');
  });

  test('mobile people toggle opens and closes the member list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await joinRoom(page, 'Alice', 'Mobile');
    const toggle = page.getByRole('button', { name: /People/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#users-panel')).toContainText('Alice');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('reconnects a duplicate display name and retains its own history', async ({ browser }) => {
    test.setTimeout(60_000);
    const aliceContext = await browser.newContext();
    const duplicateContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const duplicate = await duplicateContext.newPage();

    await duplicate.addInitScript(() => {
      let originalFactory;
      Object.defineProperty(window, 'io', {
        configurable: true,
        get: () => originalFactory,
        set: (factory) => {
          originalFactory = factory;
          Object.defineProperty(window, 'io', {
            configurable: true,
            writable: true,
            value: (...args) => {
              const socket = originalFactory(...args);
              window.__chatTestSocket = socket;
              return socket;
            },
          });
        },
      });
    });
    await joinRoom(alice, 'Alice', 'Reconnect');
    await joinRoom(duplicate, 'Alice', 'Reconnect');
    await expect(duplicate.locator('#users-list')).toContainText('Alice (2)');
    await duplicate.locator('#message-input').fill('Before reconnect');
    await duplicate.locator('#message-input').press('Enter');
    await expect(duplicate.locator('.message-row.is-mine .message-bubble')).toHaveText(
      'Before reconnect'
    );

    await duplicate.evaluate(() => window.__chatTestSocket.io.engine.close());
    await expect(duplicate.locator('.connection-state')).toHaveAttribute(
      'data-state',
      'disconnected'
    );
    await expect(duplicate.locator('.connection-state')).toHaveAttribute(
      'data-state',
      'connected',
      {
        timeout: 15_000,
      }
    );
    await expect(duplicate.locator('.message-row.is-mine .message-bubble')).toHaveText(
      'Before reconnect'
    );
    await duplicate.locator('#message-input').fill('I am back');
    await duplicate.locator('#message-input').press('Enter');
    await expect(duplicate.locator('.message-bubble')).toHaveText([
      'Before reconnect',
      'I am back',
    ]);

    await aliceContext.close();
    await duplicateContext.close();
  });

  test('leave clears the session and returns to the login page', async ({ page }) => {
    await joinRoom(page, 'Alice', 'Leave');
    await page.locator('#message-input').fill('Goodbye');
    await page.locator('#message-input').press('Enter');
    await expect(page.locator('.message-row.is-mine .message-bubble')).toHaveText('Goodbye');
    await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL(/\/$/);
    const stored = await page.evaluate(() => [
      sessionStorage.getItem('chatrooms.session'),
      sessionStorage.getItem('chatrooms.ownMessageIds'),
    ]);
    expect(stored).toEqual([null, null]);
  });

  test('chat works at narrow mobile width without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await joinRoom(page, 'Alice', 'Tiny');
    await page
      .locator('#message-input')
      .fill('A small-screen message that wraps without scrolling sideways.');
    await page.locator('#message-input').press('Enter');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
    await expect(page.locator('.message-bubble')).toBeVisible();
  });
});
