// Run through ego-browser nodejs with a dedicated local preview Page:
// const {checkLocalTimeCard}=await import('file:///ABSOLUTE_REPO/tests/browser-local-time-card.mjs');
// await checkLocalTimeCard(task.page('p1'),{url:'http://127.0.0.1:8768/index.html'});
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

export async function checkLocalTimeCard(page, {url, screenshotDirectory} = {}) {
  assert.ok(url, 'A dedicated local preview URL is required');
  const passed = [];
  const check = (value, message) => { assert.ok(value, message); passed.push(message); };
  const measure = () => page.evaluate(() => {
    const card = document.getElementById('localEnvironment');
    const style = getComputedStyle(card), rect = card.getBoundingClientRect();
    return {
      display: style.display, opacity: Number(style.opacity), space: card.dataset.space,
      time: card.querySelector('time').textContent,
      petEnabled: document.getElementById('app').classList.contains('pet-life-enabled'),
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: innerWidth, height: innerHeight
    };
  });
  async function visit(width, height) {
    await page.cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 500});
    await page.goto(url, {waitUntil: 'commit', timeout: 30000});
    await page.waitForFunction(() => document.querySelector('.pet-life-enabled') &&
      document.querySelector('#localEnvironment time')?.textContent &&
      (document.querySelector('.garden-3d')?.dataset.ready === 'true' || document.querySelector('.world-ready')),
      undefined, {timeout: 30000});
    return measure();
  }
  async function showPresentation() {
    // This is a CSS/layout regression, not a timing assertion. Pin only the
    // presentation class after navigation: driver latency can outlast the card.
    // garden-environment.test.cjs independently checks the real notice lifecycle.
    await page.waitForFunction(() => !document.getElementById('localEnvironment').classList.contains('is-visible'),
      undefined, {timeout: 12000});
    await page.evaluate(() => document.getElementById('localEnvironment').classList.add('is-visible'));
    await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('localEnvironment')).opacity) > .95,
      undefined, {timeout: 3000});
  }
  async function screenshot(name) {
    if (!screenshotDirectory) return;
    const {data} = await page.cdp('Page.captureScreenshot', {format: 'png'});
    await writeFile(screenshotDirectory + '/' + name + '.png', Buffer.from(data, 'base64'));
  }
  let card = await visit(1440, 1000);
  check(card.petEnabled && card.display !== 'none', 'The initialized pet module does not remove the time card');
  check(card.space === 'true' && /^\d{2}:\d{2}$/.test(card.time), 'The desktop card has room and a real local time');
  await showPresentation();
  await screenshot('desktop');
  await page.click('#personalizeButton');
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('localEnvironment')).opacity) < .05,
    undefined, {timeout: 3000});
  check(!(await page.evaluate(() => document.getElementById('personalizeOverlay').hidden)), 'An open settings overlay hides the time card');
  await page.click('#confirmPlan');
  for (const [width, height] of [[390, 844], [320, 640]]) {
    card = await visit(width, height);
    check(card.display !== 'none', `Pet CSS does not disable the card at ${width}x${height}`);
    if (card.space === 'true') {
      await showPresentation();
      card = await measure();
      check(card.left >= 0 && card.top >= 0 && card.right <= card.width && card.bottom <= card.height,
        `The visible card fits the ${width}x${height} viewport`);
    } else {
      check(card.opacity === 0, `The insufficient-space guard remains active at ${width}x${height}`);
    }
    await screenshot('mobile-' + width);
  }
  console.log(JSON.stringify({passed: passed.length, checks: passed}));
  return passed;
}
