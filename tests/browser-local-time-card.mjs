// Run in an ego-browser nodejs round after creating a dedicated TaskSpace:
// const {checkLocalTimeCard}=await import('file:///ABSOLUTE_REPO/tests/browser-local-time-card.mjs');
// await checkLocalTimeCard(task.page('p1'),{url:'http://127.0.0.1:8768/index.html'});
import assert from 'node:assert/strict';

export async function checkLocalTimeCard(page, {url, screenshotDirectory} = {}) {
  assert.ok(url, 'A dedicated local preview URL is required');
  const passed = [];
  const check = (value, message) => { assert.ok(value, message); passed.push(message); };
  const measure = () => page.evaluate(() => {
    const card = document.getElementById('localEnvironment');
    const style = getComputedStyle(card), rect = card.getBoundingClientRect();
    return {
      display: style.display, opacity: Number(style.opacity),
      space: card.dataset.space, visible: card.classList.contains('is-visible'),
      time: card.querySelector('time').textContent,
      petEnabled: document.getElementById('app').classList.contains('pet-life-enabled'),
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: innerWidth, height: innerHeight
    };
  });
  async function visit(width, height) {
    await page.cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 500});
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('.pet-life-enabled') &&
      document.querySelector('#localEnvironment time')?.textContent &&
      (document.querySelector('.garden-3d')?.dataset.ready === 'true' || document.querySelector('.world-ready')),
      undefined, {timeout: 20000});
    return measure();
  }
  await visit(1440, 1000);
  await page.waitForFunction(() => document.getElementById('localEnvironment').classList.contains('is-visible'), undefined, {timeout: 10000});
  let card = await measure();
  check(card.petEnabled && card.display !== 'none', 'The initialized pet module does not remove the time card');
  check(card.space === 'true' && /^\d{2}:\d{2}$/.test(card.time), 'The desktop card has room and a real local time');
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('localEnvironment')).opacity) > .95, undefined, {timeout: 2000});
  if (screenshotDirectory) await page.screenshot({path: screenshotDirectory + '/desktop.png'});
  await page.waitForFunction(() => !document.getElementById('localEnvironment').classList.contains('is-visible'), undefined, {timeout: 10000});
  check(!(await measure()).visible, 'The restored card still fades after its brief initial display');

  await visit(1440, 1000);
  await page.waitForFunction(() => document.querySelector('#localEnvironment.is-visible'), undefined, {timeout: 10000});
  await page.click('#personalizeButton');
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('localEnvironment')).opacity) < .05, undefined, {timeout: 2000});
  check(!(await page.evaluate(() => document.getElementById('personalizeOverlay').hidden)), 'An open settings overlay hides the time card');
  await page.click('#confirmPlan');

  for (const [width, height] of [[390, 844], [320, 640]]) {
    card = await visit(width, height);
    check(card.display !== 'none', `Pet CSS does not disable the card at ${width}x${height}`);
    if (card.space === 'true') {
      await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('localEnvironment')).opacity) > .95, undefined, {timeout: 3000});
      card = await measure();
      check(card.left >= 0 && card.top >= 0 && card.right <= card.width && card.bottom <= card.height,
        `The visible card fits the ${width}x${height} viewport`);
    } else {
      check(card.opacity === 0, `The insufficient-space guard remains active at ${width}x${height}`);
    }
    if (screenshotDirectory) await page.screenshot({path: screenshotDirectory + '/mobile-' + width + '.png'});
  }
  console.log(JSON.stringify({passed: passed.length, checks: passed}));
  return passed;
}
