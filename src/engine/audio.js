// Tiny procedural sound using Web Audio. No assets. All blips are synthesized.
// Audio context is created lazily on first user gesture (browser autoplay rules).

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }

  // Generic beep: type oscillator, freq Hz, duration s, volume 0..1.
  _blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  jump()      { this._blip(420, 0.12, 'square', 0.10, 760); }
  coin()      { this._blip(880, 0.08, 'triangle', 0.12, 1320); }
  stomp()     { this._blip(220, 0.12, 'sawtooth', 0.12, 90); }
  hurt()      { this._blip(180, 0.30, 'sawtooth', 0.14, 60); }
  checkpoint(){ this._blip(660, 0.10, 'triangle', 0.12, 990); }
  win()       { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'square', 0.12), i * 110)); }
  start()     { this._blip(523, 0.1, 'square', 0.1, 784); }
}
