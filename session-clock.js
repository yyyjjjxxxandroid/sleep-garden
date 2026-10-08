// Playback time is independent of frame rate and the garden animation clock.
class SessionClock {
  constructor(timerSeconds = 0) {
    this.timerSeconds = timerSeconds;
    this.elapsed = 0;
    this.duration = timerSeconds;
    this.timerStartedAt = 0;
    this.status = 'idle';
    this.lastTime = 0;
  }

  start(now) {
    if (this.status === 'playing' || this.status === 'paused') return false;
    this.elapsed = 0;
    this.timerStartedAt = 0;
    this.duration = this.timerSeconds;
    this.status = 'playing';
    this.lastTime = now;
    return true;
  }

  tick(now) {
    if (this.status !== 'playing') return;
    this.elapsed += Math.max(0, now - this.lastTime) / 1000;
    this.lastTime = Math.max(this.lastTime, now);
    if (this.duration > 0) this.elapsed = Math.min(this.elapsed, this.duration);
  }

  pause(now) {
    this.tick(now);
    if (this.status === 'playing') this.status = 'paused';
  }

  resume(now) {
    if (this.status !== 'paused') return;
    this.status = 'playing';
    this.lastTime = now;
  }

  setTimer(seconds, now) {
    this.tick(now);
    this.timerSeconds = seconds;
    this.timerStartedAt = this.elapsed;
    this.duration = seconds > 0 ? this.elapsed + seconds : 0;
  }

  finish(now) {
    if (this.status !== 'playing' && this.status !== 'paused') return false;
    this.tick(now);
    this.status = 'completed';
    return true;
  }

  get expired() {
    return this.duration > 0 && this.elapsed >= this.duration;
  }

  get remaining() {
    return this.duration > 0 ? Math.max(0, this.duration - this.elapsed) : 0;
  }

  get progress() {
    return this.timerSeconds > 0
      ? Math.min(1, Math.max(0, (this.elapsed - this.timerStartedAt) / this.timerSeconds))
      : 0;
  }
}

if (typeof window !== 'undefined') window.SessionClock = SessionClock;
if (typeof module !== 'undefined') module.exports = { SessionClock };
