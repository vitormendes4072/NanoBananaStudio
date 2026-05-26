/**
 * Captures screenshots of the running app for the README.
 * Run: node scripts/screenshot.mjs
 * Requires the dev server to be running on localhost:5173
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const BASE = 'http://localhost:5173';

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Capture console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Wait for polling to run
  await page.waitForTimeout(5000);

  // Debug: directly fetch jobs from page context and check
  const debugInfo = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/jobs');
      const data = await r.json();
      const completed = (data.jobs || []).filter((j) => j.status === 'completed' && j.result);
      const grid = document.getElementById('gallery-grid');
      const galleryFilter = document.getElementById('gallery-filter');
      return {
        apiOk: r.ok,
        totalJobs: data.jobs?.length,
        completedWithResult: completed.length,
        gridChildren: grid?.children?.length,
        gridHTML: grid?.innerHTML?.substring(0, 100),
        galleryFilterValue: galleryFilter?.value,
        firstImageUrl: completed[0]?.result?.imageUrl,
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Debug:', JSON.stringify(debugInfo));
  if (errors.length) console.log('Page errors:', errors.slice(0, 5));

  // Populate gallery grid with real thumbnails
  const forceResult = await page.evaluate(async () => {
    const r = await fetch('/api/jobs');
    const data = await r.json();
    const completed = (data.jobs || []).filter((j) => j.status === 'completed' && j.result);
    const grid = document.getElementById('gallery-grid');
    if (!grid) return 'grid not found';
    grid.innerHTML = '';
    for (const job of completed.slice(0, 12)) {
      const card = document.createElement('div');
      card.style.cssText =
        'display:inline-block;width:180px;height:180px;margin:4px;overflow:hidden;border-radius:8px;background:#f0f0f0;';
      const img = document.createElement('img');
      img.src = `/api/thumb?src=${encodeURIComponent(job.result.imageUrl)}`;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      card.appendChild(img);
      grid.appendChild(card);
    }
    return `injected ${Math.min(12, completed.length)} cards`;
  });
  console.log('Force inject:', forceResult);
  // Wait for thumbnails to load
  await page.waitForTimeout(3000);

  // ── 1. Header + Usage dashboard ──────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const usagePanel = page.locator('section.overview-panel');
  await usagePanel.screenshot({ path: path.join(outDir, '1-usage-dashboard.png') });
  console.log('✓ 1-usage-dashboard.png');

  // ── 2. Prompt panel ───────────────────────────────────────────────────────
  const promptPanel = page.locator('.composer-panel');
  await promptPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await promptPanel.screenshot({ path: path.join(outDir, '2-prompt-panel.png') });
  console.log('✓ 2-prompt-panel.png');

  // ── 3. Biblioteca Criativa (Product models + Templates) ───────────────────
  const libPanel = page.locator('.resource-library-panel');
  await libPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await libPanel.screenshot({ path: path.join(outDir, '3-biblioteca-criativa.png') });
  console.log('✓ 3-biblioteca-criativa.png');

  // ── 4. Generation controls (Advanced + toolbar) ───────────────────────────
  const toolbarPanel = page.locator('.toolbar-panel');
  await toolbarPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, '4-generation-controls.png'),
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  console.log('✓ 4-generation-controls.png');

  // ── 5. Gallery with generated images ─────────────────────────────────────
  await page.evaluate(() => {
    const gallerySection = Array.from(document.querySelectorAll('section')).find(
      (s) => s.querySelector('h2')?.textContent?.trim() === 'Galeria'
    );
    if (gallerySection) gallerySection.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(500);
  const gridCount = await page.evaluate(
    () => document.getElementById('gallery-grid')?.children?.length ?? 0
  );
  console.log(`  gallery grid children: ${gridCount}`);
  await page.screenshot({
    path: path.join(outDir, '5-gallery.png'),
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  console.log('✓ 5-gallery.png');

  // ── 6. Full page overview (scaled) ───────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, '6-full-overview.png'),
    fullPage: false,
  });
  console.log('✓ 6-full-overview.png');

  await browser.close();
  console.log(`\nAll screenshots saved to: docs/screenshots/`);
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
