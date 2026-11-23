/**
 * Workd Builder — Procedural Web Audio API Synthesizer
 * Zero external audio files. Designed for instant tactile response on Mobile Safari/WebKit.
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.unlocked = false;
    this.lastCreakTime = 0;
  }

  /**
   * Unlocks and initializes Web Audio on the first user touch/pointer gesture.
   * Required by iOS Safari/WebKit autoplay policies.
   */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(0.68, this.ctx.currentTime);

      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer(1.0);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.unlocked && this.ctx) {
      // Silent 1-sample unlock pulse for older iOS WebKit quirks
      try {
        const silentBuf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch (_) {
        // Ignore if blocked
      }
      this.unlocked = true;
    }
  }

  _ready() {
    if (!this.ctx || !this.master) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx.state === 'running';
  }

  _createNoiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Blend white + slightly pinked noise for warm stone/sand grain
      last = (last + 0.06 * white) / 1.06;
      data[i] = white * 0.65 + last * 1.1;
    }
    return buffer;
  }

  /**
   * Quarry rock chipping: crisp limestone crack + gritty dust burst.
   */
  playQuarryChip(step = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const pitchBoost = 1 + step * 0.11 + (Math.random() - 0.5) * 0.06;

    // 1. Stone crack body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 * pitchBoost, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.065);
    oscGain.gain.setValueAtTime(0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);

    // 2. Sharp stone flake noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650 * pitchBoost, now);
    filter.Q.setValueAtTime(1.8, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.master);
    noise.start(now, Math.random() * 0.6, 0.09);
  }

  /**
   * Raw stone block breaks free from the cliff.
   */
  playStoneSpawn() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.14);
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);

    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(260, now + 0.03);
    pop.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    popGain.gain.setValueAtTime(0.14, now + 0.03);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    pop.connect(popGain);
    popGain.connect(this.master);
    pop.start(now + 0.03);
    pop.stop(now + 0.13);
  }

  /**
   * Soft tactile pop when lifting a stone block.
   */
  playPickup() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.075);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Heavy tactile stone thud on pallet, sled, or workbench drop.
   */
  playHeavyThud() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    // Low bass thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);

    // Subtle stone grit impact
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.master);
    noise.start(now, Math.random() * 0.5, 0.1);
  }

  /**
   * Wooden transport sled creaking + soft sand runner glide.
   */
  playSledCreak(duration = 0.55) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCreakTime < 0.24) return;
    this.lastCreakTime = now;

    // 1. Timber creak resonance
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = 148 + Math.random() * 28;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.18, now + duration * 0.45);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.88, now + duration);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(430, now);
    bp.frequency.linearRampToValueAtTime(620, now + duration * 0.5);
    bp.frequency.linearRampToValueAtTime(340, now + duration);
    bp.Q.setValueAtTime(6.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);

    // 2. Desert sand runner brush
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const sandFilter = this.ctx.createBiquadFilter();
    sandFilter.type = 'bandpass';
    sandFilter.frequency.setValueAtTime(920, now);
    sandFilter.Q.setValueAtTime(1.1, now);
    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.09, now + 0.08);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(sandFilter);
    sandFilter.connect(sGain);
    sGain.connect(this.master);
    noise.start(now, Math.random() * 0.3, duration);
  }

  /**
   * Wooden pull-lever mechanical clack.
   */
  playLeverFlip() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.055);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Stonecutter chisel carving ping (stage 1, 2, or 3 finished).
   */
  playChiselPing(stage = 1) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const ratios = [1.0, 1.122, 1.26];
    const mult = ratios[Math.min(Math.max(stage - 1, 0), 2)];

    // Metallic chisel harmonic ping
    const freqs = [1180 * mult, 1980 * mult];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.16);
      g.gain.setValueAtTime(idx === 0 ? 0.22 : 0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (idx === 0 ? 0.17 : 0.12));
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.18);
    });

    // Stone chip dust burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.16, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(this.master);
    noise.start(now, Math.random() * 0.5, 0.07);

    // Stage 3 finished carved block sparkle chime
    if (stage >= 3) {
      const notes = [587.33, 880.0, 1174.66]; // D5 - A5 - D6
      notes.forEach((n, i) => {
        const t = now + 0.04 + i * 0.045;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(n, t);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + 0.28);
      });
    }
  }

  /**
   * Magnetic blueprint snap when a carved block locks into the pyramid.
   */
  playBlueprintSnap(tier = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    // Satisfying stone seat thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(135, now);
    thud.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    thudGain.gain.setValueAtTime(0.36, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thud.connect(thudGain);
    thudGain.connect(this.master);
    thud.start(now);
    thud.stop(now + 0.13);

    // Ascending pentatonic crystalline lock chime based on tier (0..4)
    const scale = [523.25, 587.33, 659.25, 783.99, 1046.5];
    const baseNote = scale[Math.min(tier, scale.length - 1)];

    [baseNote, baseNote * 1.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.03);
      gain.gain.setValueAtTime(i === 0 ? 0.18 : 0.11, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + i * 0.05);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + i * 0.03);
      osc.stop(now + 0.36);
    });
  }

  /**
   * Harmonic shimmer when an entire pyramid tier is completed.
   */
  playLayerComplete(tier = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const root = 392.0 * Math.pow(1.06, tier); // Gently rises each tier
    const chord = [root, root * 1.25, root * 1.5, root * 2.0];

    chord.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  /**
   * Golden sunbeam fanfare when the 55th pyramidion capstone completes the pyramid.
   */
  playVictoryFanfare() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    // Warm radiant chord progression (D major / Lydian solar fanfare)
    const sequence = [
      { freq: 293.66, time: 0.0, dur: 1.4, vol: 0.16, type: 'triangle' }, // D4
      { freq: 440.0, time: 0.09, dur: 1.35, vol: 0.15, type: 'triangle' }, // A4
      { freq: 587.33, time: 0.18, dur: 1.3, vol: 0.17, type: 'sine' }, // D5
      { freq: 739.99, time: 0.28, dur: 1.35, vol: 0.16, type: 'sine' }, // F#5
      { freq: 880.0, time: 0.42, dur: 1.5, vol: 0.16, type: 'triangle' }, // A5
      { freq: 1174.66, time: 0.56, dur: 1.8, vol: 0.18, type: 'sine' }, // D6
      { freq: 1479.98, time: 0.72, dur: 1.6, vol: 0.11, type: 'sine' }, // F#6 shimmer
    ];

    sequence.forEach((n) => {
      const t = now + n.time;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(n.vol, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + n.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + n.dur + 0.05);
    });
  }

  /**
   * Tactile World Map island tile tap (warm resonant chime if unlocked, muted stone knock if locked).
   */
  playMapTap(locked = false) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    if (locked) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.09);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // Crisp wooden-stone tile tap + warm golden fifth harmonic
    [440, 659.25].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      gain.gain.setValueAtTime(idx === 0 ? 0.2 : 0.13, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24 + idx * 0.04);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + idx * 0.03);
      osc.stop(now + 0.3);
    });
  }

  /**
   * Soft airy camera fly-to whoosh when gliding across the 3D World Map.
   */
  playCameraWhoosh() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(340, now);
    bp.frequency.exponentialRampToValueAtTime(980, now + 0.18);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.36);
    bp.Q.setValueAtTime(1.6, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.master);
    noise.start(now, Math.random() * 0.35, 0.4);
  }

  /**
   * Bright uplifting adventure chime when tapping JOUER to launch a level.
   */
  playStartChime() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6

    notes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  dispose() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.unlocked = false;
  }
}
