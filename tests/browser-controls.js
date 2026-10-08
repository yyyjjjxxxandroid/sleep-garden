// Run against a fresh isolated agent-browser session after loading index.html:
// First use a real click to satisfy browser audio autoplay policy:
// agent-browser --session garden-bugfix click "#startButton"
// agent-browser --session garden-bugfix eval --stdin < tests/browser-controls.js
(async () => {
  const results = [];
  const assert = (condition, label) => {
    if (!condition) throw Error(label);
    results.push(label);
  };
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = id => $(id).click();
  const records = () => JSON.parse(localStorage.getItem('sleepGarden.v1') || '{}').records || [];
  const waitPlaying = async () => {
    for (let i = 0; i < 100 && $('app').dataset.session !== 'playing'; i++) await wait(10);
    assert($('app').dataset.session === 'playing', 'audio activation reaches playing');
  };
  assert($('app').dataset.audio === 'running', 'trusted user click activates audio');
  click('totalTime'); click('timerCancel'); click('finishButton'); click('returnGarden');
  assert(!$('progress').hasAttribute('aria-valuemax'), 'unlimited progress has no fictitious maximum');

  // Delayed audio resume reproduces rapid start/end races without a real wait.
  const originalTimeout = window.setTimeout;
  let timerCallback;
  window.setTimeout = (callback, delay, ...args) => { if(delay >= 59000) timerCallback = callback; return originalTimeout(callback, delay, ...args); };
  const originalSetValue = AudioParam.prototype.setValueAtTime;
  let scheduledAudioStops = 0;
  AudioParam.prototype.setValueAtTime = function(value, time){ if(value === 0) scheduledAudioStops++; return originalSetValue.call(this, value, time); };
  const originalResume = AudioContext.prototype.resume;
  AudioContext.prototype.resume = async function () { await wait(80); return originalResume.call(this); };
  const initialRecords = records().length;
  click('restartButton'); click('restartButton'); click('finishButton'); click('finishButton');
  await wait(150);
  assert(records().length === initialRecords + 1, 'rapid start/end records exactly one plant');
  assert($('app').dataset.audio === 'paused', 'late audio resume cannot restart a finished session');
  assert($('app').dataset.session === 'completed', 'late audio resume cannot overwrite completed state');
  AudioContext.prototype.resume = originalResume;
  click('returnGarden'); click('restartButton'); await waitPlaying();

  // Advance the listening clock while leaving the renderer and UI event loop real.
  const realNow = performance.now.bind(performance);
  const realTick = SessionClock.prototype.tick;
  let offset = 0;
  performance.now = () => realNow() + offset;
  SessionClock.prototype.tick = function () { realTick.call(this, performance.now()); };
  const advance = async ms => { offset += ms; await wait(50); };
  const customTimer = minutes => {
    click('totalTime'); $('customMinutes').value = String(minutes);
    $('customMinutes').dispatchEvent(new Event('input')); click('customTimer');
  };

  for (const invalid of [0, 721, 1.5]) {
    customTimer(invalid);
    assert(!$('timerOverlay').hidden && !$('customMinutes').checkValidity(), `invalid timer ${invalid} is visibly rejected`);
    $('timerOverlay').querySelector('.close-sheet').click();
  }
  customTimer(1);
  assert(parseFloat($('progressFill').style.width) < 1, 'timer selected during playback starts at zero progress');
  await advance(15000);
  assert(Math.abs(Number($('progress').getAttribute('aria-valuenow')) - 25) <= 1, 'one-minute timer reaches 25 percent at fifteen seconds');
  click('playButton'); const pausedTime = $('elapsed').textContent, pausedRemaining = $('totalTime').textContent;
  await advance(120000);
  assert($('elapsed').textContent === pausedTime && $('totalTime').textContent === pausedRemaining, 'pause freezes elapsed and remaining time');
  click('playButton'); await waitPlaying();
  assert($('totalTime').textContent === pausedRemaining, 'resume excludes the paused interval');
  customTimer(2);
  assert(Number($('progress').getAttribute('aria-valuenow')) === 0, 'changing timer resets only countdown progress');
  click('totalTime'); click('timerCancel');
  assert($('totalTime').textContent === '不限时' && !$('progress').hasAttribute('aria-valuemax'), 'cancel switches back to unlimited progress');

  click('soundButton');
  const rainButton = $('mute-rain');
  if (rainButton.getAttribute('aria-pressed') === 'true') rainButton.click();
  rainButton.click();
  assert(Number($('volume-rain').value) > 0 && rainButton.getAttribute('aria-pressed') === 'true', 'rain button enables a channel whose default volume is zero');
  rainButton.click(); assert($('volume-rain').value === '0', 'rain button mutes the channel');
  rainButton.click(); assert(Number($('volume-rain').value) > 0, 'rain button restores previous volume');
  $('soundOverlay').querySelector('.close-sheet').click();

  click('focusButton'); assert($('app').classList.contains('focused'), 'cat focus button responds');
  click('backFocus'); assert(!$('app').classList.contains('focused'), 'return from cat focus responds');
  click('environmentButton');
  document.querySelector('[data-weather="aurora"]').click();
  assert($('app').classList.contains('night'), 'weather selection updates night state');
  $('soundOverlay').querySelector('.close-sheet').click();
  click('gardenButton'); assert(!$('historyOverlay').hidden, 'history button opens records');
  $('historyOverlay').querySelector('.close-sheet').click();

  // Audio failure must leave a retryable paused state.
  click('playButton');
  AudioContext.prototype.resume = () => Promise.reject(Error('simulated audio failure'));
  click('playButton'); await wait(50);
  assert($('app').dataset.session === 'paused' && !$('playButton').disabled, 'audio failure leaves an enabled retry button and paused timer');
  AudioContext.prototype.resume = originalResume;
  click('playButton'); await waitPlaying();

  customTimer(1);
  const beforeFinish = records().length;
  assert(typeof timerCallback === 'function', 'timer expiry has a callback independent of animation frames');
  assert(scheduledAudioStops > 0, 'timed playback schedules audio to stop independently of page callbacks');
  offset += 61000; timerCallback();
  click('finishButton'); click('finishButton');
  assert(records().length === beforeFinish + 1, 'timer expiry and repeated manual ending create one plant');
  assert($('progressFill').style.width === '100%', 'timer completion is clamped to 100 percent');
  assert($('totalTime').textContent === '00:00', 'timer completion has no negative remaining time');
  assert(!$('resultOverlay').hidden && $('app').dataset.session === 'completed', 'timer expiry displays one completed result');
  assert(records().at(-1).duration < 100, 'paused wall time does not enter the saved duration');
  assert(JSON.parse(localStorage.getItem('sleepGarden.v1')).timerSeconds === 60, 'timer preference is persisted for the next fresh session');
  performance.now = realNow; SessionClock.prototype.tick = realTick;window.setTimeout = originalTimeout;AudioParam.prototype.setValueAtTime = originalSetValue;
  return { passed: results.length, results };
})();
