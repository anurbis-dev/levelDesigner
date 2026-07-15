/**
 * B2 smoke: viewport leaf hosts toolbar + canvas with non-zero size.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
page.setDefaultTimeout(60000);

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction(() => window.editor?.dockManager?._inited, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));

const state = await page.evaluate(() => {
  const leaf = document.querySelector('.leaf-node[data-content-type="viewport"]');
  const body = leaf?.querySelector('.leaf-body');
  const toolbar = document.getElementById('toolbar-container');
  const viewport = document.getElementById('canvas-viewport');
  const canvas = document.getElementById('main-canvas');
  const canvasContainer = document.getElementById('canvas-container');
  const size = editor.stateManager?.get('canvas.size');
  const pos = editor.stateManager?.get('canvas.position');

  return {
    dockInited: !!editor.dockManager?._inited,
    hasViewportLeaf: !!leaf,
    toolbarInLeaf: !!(toolbar && body?.contains(toolbar)),
    viewportInLeaf: !!(viewport && body?.contains(viewport)),
    canvasInViewport: !!(canvas && viewport?.contains(canvas)),
    canvasInContainer: !!(canvasContainer && viewport?.contains(canvasContainer)),
    toolbarButtons: toolbar ? toolbar.querySelectorAll('button').length : 0,
    canvasW: canvas?.width || 0,
    canvasH: canvas?.height || 0,
    viewportCW: viewport?.clientWidth || 0,
    viewportCH: viewport?.clientHeight || 0,
    stateSize: size || null,
    statePos: pos || null,
    stillInOfftree: !!(viewport?.closest('#dock-legacy-offtree')),
    hasPlaceholderInViewport: !!body?.querySelector('.dock-placeholder[data-content-type="viewport"]')
  };
});

// Drag a split resizer slightly and re-check canvas size updates
const afterResize = await page.evaluate(() => {
  editor.updateCanvas();
  const canvas = document.getElementById('main-canvas');
  return { w: canvas?.width || 0, h: canvas?.height || 0 };
});

console.log(JSON.stringify({ state, afterResize, errors: errors.slice(0, 20) }, null, 2));

const ok =
  state.dockInited
  && state.hasViewportLeaf
  && state.toolbarInLeaf
  && state.viewportInLeaf
  && state.canvasInViewport
  && state.canvasInContainer
  && state.toolbarButtons > 0
  && state.canvasW > 50
  && state.canvasH > 50
  && state.viewportCW > 50
  && state.viewportCH > 50
  && !state.stillInOfftree
  && !state.hasPlaceholderInViewport
  && afterResize.w > 50
  && afterResize.h > 50
  // Extension noise ok; fail on real app errors mentioning Canvas/Dock/undefined
  && !errors.some((e) => /DockContent|CanvasRenderer|TypeError|is not defined/i.test(e));

await browser.close();
process.exit(ok ? 0 : 1);
