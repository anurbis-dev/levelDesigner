import { createRequire } from 'module';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);

async function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch {
    execSync('npm i -D puppeteer --no-save', { stdio: 'inherit' });
    return require('puppeteer');
  }
}

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
const msgs = [];

page.on('console', (m) => {
  msgs.push({ type: m.type(), text: m.text() });
});
page.on('pageerror', (e) => {
  msgs.push({ type: 'pageerror', text: String(e && e.message ? e.message : e) });
});
page.on('requestfailed', (r) => {
  const fail = r.failure();
  msgs.push({ type: 'requestfailed', text: `${r.url()} ${fail ? fail.errorText : ''}` });
});

await page.goto('http://localhost:3000/index.html', {
  waitUntil: 'networkidle0',
  timeout: 60000
});
await new Promise((r) => setTimeout(r, 4000));

const state = await page.evaluate(() => ({
  ready: document.body.classList.contains('editor-ready'),
  hasEditor: !!window.editor,
  dockInited: !!(window.editor && window.editor.dockManager && window.editor.dockManager._inited),
  bodyText: document.body.innerText.slice(0, 200)
}));

const errors = msgs.filter((m) =>
  m.type === 'error' || m.type === 'pageerror' || m.type === 'requestfailed' || m.type === 'warn'
);

console.log('=== STATE ===');
console.log(JSON.stringify(state, null, 2));
console.log('=== ERRORS/WARNS ===');
console.log(JSON.stringify(errors, null, 2));
console.log('=== ALL CONSOLE ===');
console.log(JSON.stringify(msgs, null, 2));

await browser.close();
process.exit(errors.some((m) => m.type === 'error' || m.type === 'pageerror') ? 1 : 0);
