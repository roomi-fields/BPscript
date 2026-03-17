/**
 * Web Audio Transport
 *
 * Plays notes via oscillators scheduled with AudioContext.
 * Receives symbolic tokens (C4, sa6...) and resolves them to frequencies.
 */

export class WebAudioTransport {
  /**
   * @param {AudioContext} audioCtx
   * @param {Object} [options]
   * @param {string} [options.waveform='triangle'] - oscillator type
   * @param {Resolver} [options.resolver] - symbol → frequency resolver
   */
  constructor(audioCtx, { waveform = 'triangle', resolver = null } = {}) {
    this.audioCtx = audioCtx;
    this.waveform = waveform;
    this.resolver = resolver;
    this._nodes = [];
  }

  /**
   * Schedule a note event at the given absolute audio time.
   * @param {Object} event - { token, velocity, durSec, channel }
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
      // Fallback: try parsing as MIDI-style note name
      freq = this._tokenToFreq(event.token);
    }
    if (freq === null || freq <= 0) return; // not a playable token

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = this.waveform;
    osc.frequency.value = freq;

    const dur = Math.max(0.05, event.durSec);
    const attackTime = 0.02;
    const releaseTime = Math.min(0.1, dur * 0.2);
    const sustainLevel = event.velocity * 0.3;

    gain.gain.setValueAtTime(0, absTime);
    gain.gain.linearRampToValueAtTime(sustainLevel, absTime + attackTime);
    gain.gain.setValueAtTime(sustainLevel, absTime + dur - releaseTime);
    gain.gain.linearRampToValueAtTime(0, absTime + dur);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(absTime);
    osc.stop(absTime + dur + 0.01);

    this._nodes.push({ osc, gain });
  }

  close() {
    const now = this.audioCtx.currentTime;
    for (const { osc, gain } of this._nodes) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        osc.stop(now + 0.01);
      } catch {}
    }
    this._nodes = [];
  }

  /** Fallback: parse Western note name to frequency (C4=261.63) */
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
