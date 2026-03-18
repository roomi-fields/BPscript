/**
 * Web Audio Transport
 *
 * Plays notes via oscillators scheduled with AudioContext.
 * Receives symbolic tokens and control state from the dispatcher.
 *
 * Primitives:
 *   wave     — oscillator type (sine, triangle, square, sawtooth)
 *   vel      — velocity → gain
 *   pan      — stereo panning (-100 to 100)
 *   attack   — envelope attack in ms
 *   release  — envelope release in ms
 *   detune   — pitch detune in cents
 *   filter   — lowpass filter cutoff Hz (0 = bypass)
 *   filterQ  — filter resonance
 */

export class WebAudioTransport {
  /**
   * @param {AudioContext} audioCtx
   * @param {Object} [options]
   * @param {Resolver} [options.resolver] - symbol → frequency resolver
   */
  constructor(audioCtx, { resolver = null } = {}) {
    this.audioCtx = audioCtx;
    this.resolver = resolver;
    this._nodes = [];
  }

  /**
   * Schedule a note event at the given absolute audio time.
   * @param {Object} event - { token, velocity, durSec, wave, pan, attack, release, detune, filter, filterQ }
   * @param {number} absTime - absolute AudioContext time
   */
  send(event, absTime) {
    // Resolve token to frequency
    let freq = null;
    if (this.resolver) {
      const resolved = this.resolver.resolve(event.token);
      if (resolved) freq = resolved.frequency;
    }
    if (freq === null) {
      freq = this._tokenToFreq(event.token);
    }
    if (freq === null || freq <= 0) return;

    const dur = Math.max(0.05, event.durSec);
    const velocity = event.velocity || 0.5;
    const wave = event.wave || 'triangle';
    const attackSec = (event.attack || 20) / 1000;
    const releaseSec = Math.min((event.release || 100) / 1000, dur * 0.4);
    const detune = event.detune || 0;
    const panValue = (event.pan || 0) / 100; // -1 to 1
    const filterFreq = event.filter || 0;
    const filterQ = event.filterQ || 1;

    // Build audio graph: osc → [filter] → gain → [panner] → destination
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = wave;
    osc.frequency.value = freq;
    if (detune !== 0) osc.detune.value = detune;

    // Envelope
    const sustainLevel = velocity * 0.4;
    gain.gain.setValueAtTime(0, absTime);
    gain.gain.linearRampToValueAtTime(sustainLevel, absTime + attackSec);
    gain.gain.setValueAtTime(sustainLevel, absTime + dur - releaseSec);
    gain.gain.linearRampToValueAtTime(0, absTime + dur);

    // Connect graph
    let source = osc;

    // Optional filter
    if (filterFreq > 0) {
      const biquad = this.audioCtx.createBiquadFilter();
      biquad.type = 'lowpass';
      biquad.frequency.value = filterFreq;
      biquad.Q.value = filterQ;
      source.connect(biquad);
      source = biquad;
      this._nodes.push({ node: biquad });
    }

    source.connect(gain);

    // Optional panner
    if (panValue !== 0) {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
      gain.connect(panner);
      panner.connect(this.audioCtx.destination);
      this._nodes.push({ node: panner });
    } else {
      gain.connect(this.audioCtx.destination);
    }

    osc.start(absTime);
    osc.stop(absTime + dur + 0.01);

    this._nodes.push({ osc, gain });
  }

  close() {
    const now = this.audioCtx.currentTime;
    for (const entry of this._nodes) {
      try {
        if (entry.gain) {
          entry.gain.gain.cancelScheduledValues(now);
          entry.gain.gain.setValueAtTime(0, now);
        }
        if (entry.osc) {
          entry.osc.stop(now + 0.01);
        }
      } catch {}
    }
    this._nodes = [];
  }

  /** Fallback: parse Western note name to frequency */
  _tokenToFreq(token) {
    const m = token.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!m) return null;
    const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const base = noteMap[m[1].toUpperCase()];
    if (base == null) return null;
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    const oct = parseInt(m[3]);
    const midi = (oct + 1) * 12 + base + acc;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}
