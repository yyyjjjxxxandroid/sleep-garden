const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SessionClock } = require('../session-clock.js');

test('changing the timer starts a fresh countdown without losing total listening time', () => {
  const clock = new SessionClock();
  clock.start(0);
  clock.setTimer(60, 30000);
  assert.equal(clock.elapsed, 30);
  assert.equal(clock.progress, 0);
  clock.tick(45000);
  assert.equal(clock.progress, .25);
  assert.equal(clock.remaining, 45);
});

test('pause and resume exclude time spent paused even when no frames run', () => {
  const clock = new SessionClock(60);
  clock.start(0);
  clock.pause(10000);
  clock.tick(300000);
  clock.resume(600000);
  clock.tick(605000);
  assert.equal(clock.elapsed, 15);
  assert.equal(clock.remaining, 45);
});

test('a background gap clamps completion to the selected duration', () => {
  const clock = new SessionClock(60);
  clock.start(0);
  clock.tick(300000);
  assert.equal(clock.elapsed, 60);
  assert.equal(clock.progress, 1);
  assert.equal(clock.remaining, 0);
  assert.equal(clock.expired, true);
});

test('repeated starts and endings cannot reset or complete an active session twice', () => {
  const clock = new SessionClock();
  assert.equal(clock.finish(0), false);
  assert.equal(clock.start(0), true);
  assert.equal(clock.start(5000), false);
  assert.equal(clock.finish(10000), true);
  assert.equal(clock.finish(10000), false);
  assert.equal(clock.elapsed, 10);
  assert.equal(clock.start(20000), true);
  assert.equal(clock.elapsed, 0);
});

test('changing a paused timer and cancelling it retain the playback state', () => {
  const clock = new SessionClock(60);
  clock.start(0);
  clock.pause(10000);
  clock.setTimer(30, 20000);
  assert.equal(clock.status, 'paused');
  assert.equal(clock.remaining, 30);
  clock.setTimer(0, 30000);
  assert.equal(clock.progress, 0);
  assert.equal(clock.expired, false);
  assert.equal(clock.elapsed, 10);
});

test('fresh page state is idle with zero progress, including a saved timer preference', () => {
  const clock = new SessionClock(900);
  assert.equal(clock.status, 'idle');
  assert.equal(clock.elapsed, 0);
  assert.equal(clock.progress, 0);
  assert.equal(clock.remaining, 900);
});
