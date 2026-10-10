// 加载 index.html 后，在全新且隔离的 agent-browser 会话中运行：
// 先进行一次真实点击，以满足浏览器的音频自动播放策略：
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
  const waitResult = async () => {
    for(let i=0;i<160&&$('resultOverlay').hidden;i++)await wait(50);
    assert(!$('resultOverlay').hidden&&$('completionNotice').hidden,'growth finishes before its result appears');
  };
  const click = id => $(id).click();
  const records = () => JSON.parse(localStorage.getItem('sleepGarden.v1') || '{}').records || [];
  const waitPlaying = async () => {
    for (let i = 0; i < 100 && $('app').dataset.session !== 'running'; i++) await wait(10);
    assert($('app').dataset.session === 'running', 'audio activation reaches playing');
  };
  assert($('app').dataset.audio === 'running', 'trusted user click activates audio');
  click('totalTime'); click('timerCancel'); click('finishButton'); await waitResult(); click('returnGarden');
  assert(!$('progress').hasAttribute('aria-valuemax'), 'unlimited progress has no fictitious maximum');

  // 延迟恢复音频，用于复现快速开始/结束时的竞态，无需真实等待。
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
  assert($('finishButton').disabled && $('resetButton').disabled && records().length === initialRecords, 'audio activation disables ending and reset without creating a record');
  // Also exercise an internal end during activation: a late audio promise
  // must remain harmless even when the disabled UI cannot dispatch a click.
  $('finishButton').onclick(); $('finishButton').onclick();
  await wait(150);
  assert(records().length === initialRecords + 1, 'rapid start/end records exactly one plant');
  assert($('app').dataset.audio === 'paused', 'late audio resume cannot restart a finished session');
  assert($('app').dataset.session === 'done', 'late audio resume cannot overwrite completed state');
  AudioContext.prototype.resume = originalResume;
  // Restart during growth: the previous plant must finish, and its delayed
  // result must not interrupt the new listening session.
  click('restartButton'); await waitPlaying(); await wait(4300);
  assert($('resultOverlay').hidden&&$('completionNotice').hidden,'restarting during growth cancels the old completion overlay');
  let world;const updateWorld=GardenWorld.prototype.update;
  GardenWorld.prototype.update=function(now){world=this;GardenWorld.prototype.update=updateWorld;return updateWorld.call(this,now)};
  await wait(60);
  assert(world.state.records.every(r=>r.growth===undefined),'restarting leaves no partially grown runtime record');

  // 推进陪伴时钟，同时保持渲染器和 UI 事件循环真实运行。
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

  customTimer(1); await advance(15000);
  const resetRecords=records().length,resetMix=JSON.stringify(JSON.parse(localStorage.getItem('sleepGarden.v1')).mix);
  click('resetButton');
  assert($('elapsed').textContent==='00:00'&&$('timerDisplay').textContent==='01:00'&&$('progressFill').style.width==='0%', 'reset clears elapsed and countdown progress while preserving the selected timer');
  assert($('app').dataset.audio==='paused'&&$('app').dataset.session==='paused', 'reset stops sound and waits for explicit resume');
  await advance(120000);
  assert($('elapsed').textContent==='00:00'&&$('timerDisplay').textContent==='01:00', 'reset countdown remains frozen while paused');
  assert(records().length===resetRecords&&JSON.stringify(JSON.parse(localStorage.getItem('sleepGarden.v1')).mix)===resetMix, 'reset preserves the sound recipe and creates no record');
  click('resetButton');click('playButton');await waitPlaying();await advance(1000);
  assert(Number($('progress').getAttribute('aria-valuenow'))>=1&&Number($('progress').getAttribute('aria-valuenow'))<4, 'resume after repeated reset starts counting from zero');

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
  assert($('timerDisplay').textContent === '不限时' && !$('progress').hasAttribute('aria-valuemax'), 'cancel switches back to unlimited progress');

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

  // 音频失败后必须保留可重试的暂停状态。
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
  assert($('timerDisplay').textContent === '00:00', 'timer completion has no negative remaining time');
  assert(!$('completionNotice').hidden&&$('resultOverlay').hidden,'timer expiry first shows the plant growing');
  await waitResult();
  assert(!$('resultOverlay').hidden && $('app').dataset.session === 'done', 'timer expiry displays one completed result');
  assert(records().at(-1).duration < 100, 'paused wall time does not enter the saved duration');
  assert(JSON.parse(localStorage.getItem('sleepGarden.v1')).timerSeconds === 60, 'timer preference is persisted for the next fresh session');
  performance.now = realNow; SessionClock.prototype.tick = realTick;window.setTimeout = originalTimeout;AudioParam.prototype.setValueAtTime = originalSetValue;
  return { passed: results.length, results };
})();
