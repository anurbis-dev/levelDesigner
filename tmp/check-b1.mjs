import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();

async function waitReady() {
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.editor?.dockManager?._inited, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
}

await waitReady();

const before = await page.evaluate(() => {
  const dm = editor.dockManager;
  const types = [...dm.model.collectPresentContentTypes()];
  const viewportLeaf = document.querySelector('.leaf-node[data-content-type="viewport"]');
  const viewportClose = viewportLeaf?.querySelector('.icon-btn.close');
  const layersLeaf = document.querySelector('.leaf-node[data-content-type="layers"]');
  const layersClose = layersLeaf?.querySelector('.icon-btn.close');
  if (layersClose) layersClose.click();
  return {
    typesBeforeClose: types,
    viewportHasClose: !!viewportClose,
    layersHadClose: !!layersClose,
    chipsDomGone: !document.getElementById('dock-chips')
  };
});

await new Promise((r) => setTimeout(r, 300));

const mid = await page.evaluate(() => {
  const dm = editor.dockManager;
  dm.persistence.flush(dm.getLayoutSnapshot());
  return {
    typesAfterClose: [...dm.model.collectPresentContentTypes()],
    mainTreeHasAssets: JSON.stringify(dm.model.mainTree).includes('"assets"'),
    savedMain: editor.configManager.get('panels.dock.mainTree') != null
  };
});

await waitReady();

const after = await page.evaluate(() => {
  const dm = editor.dockManager;
  return {
    typesAfterReload: [...dm.model.collectPresentContentTypes()],
    hasAssets: dm.model.hasContentType('assets'),
    viewportHasClose: !!document.querySelector('.leaf-node[data-content-type="viewport"] .icon-btn.close'),
    chipsDomGone: !document.getElementById('dock-chips')
  };
});

await page.evaluate(() => {
  editor.dockManager.resetLayout();
  editor.dockManager.persistence.flush(editor.dockManager.getLayoutSnapshot());
});

console.log(JSON.stringify({ before, mid, after }, null, 2));

const ok =
  before.viewportHasClose === false
  && before.layersHadClose === true
  && before.chipsDomGone === true
  && mid.typesAfterClose.includes('layers') === false
  && mid.savedMain === true
  && after.typesAfterReload.includes('layers') === false
  && after.hasAssets === true
  && after.viewportHasClose === false
  && after.chipsDomGone === true;

await browser.close();
process.exit(ok ? 0 : 1);
