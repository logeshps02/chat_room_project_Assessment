// Captures README/PR screenshots. Usage: node scripts/screenshots.js [page...]
const { chromium } = require('@playwright/test');
const { start } = require('../src/server');

const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/screenshots';

async function login(context, name, room) {
  const page = await context.newPage();
  await page.goto(BASE);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Room', { exact: true }).fill(room);
  await page.getByRole('button', { name: 'Join chat' }).click();
  await page.waitForURL(/chat\.html/);
  return page;
}

const shots = {
  async login(browser) {
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await desktop.goto(BASE);
    await desktop.screenshot({ path: `${OUT}/login-desktop.png` });
    const mobile = await browser.newPage({ viewport: { width: 375, height: 740 } });
    await mobile.goto(BASE);
    await mobile.getByRole('button', { name: 'Join chat' }).click();
    await mobile.screenshot({ path: `${OUT}/login-mobile-error.png` });
  },
  async chat(browser) {
    const alice = await login(
      await browser.newContext({ viewport: { width: 1280, height: 760 } }),
      'Alice',
      'General'
    );
    const bob = await login(
      await browser.newContext({ viewport: { width: 390, height: 760 } }),
      'Bob',
      'General'
    );
    await alice.waitForTimeout(300);
    for (const [page, text] of [
      [alice, 'Hi Bob! Welcome to #General 👋'],
      [bob, 'Hey Alice, thanks! Is the build green?'],
      [alice, 'Yes – all tests passing ✅\nDeploying to the tunnel now.'],
    ]) {
      await page.locator('#message-input').fill(text);
      await page.locator('#message-input').press('Enter');
      await page.waitForTimeout(500);
    }
    await alice.screenshot({ path: `${OUT}/chat-desktop.png` });
    await bob.screenshot({ path: `${OUT}/chat-mobile.png` });
  },
};

(async () => {
  const server = start(PORT);
  const browser = await chromium.launch();
  const wanted = process.argv.slice(2);
  try {
    for (const [name, fn] of Object.entries(shots)) {
      if (!wanted.length || wanted.includes(name)) await fn(browser);
    }
  } finally {
    await browser.close();
    server.close();
    process.exit(0);
  }
})();
