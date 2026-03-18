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
    const panValue = ((event.pan || 64) - 64) / 64; // MIDI 0-127 → -1 to 1
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

    // Determine output destination: CV bus if active, else audioCtx.destination
    const dest = (this._cvBus && absTime < this._cvBus.endTime)
      ? this._cvBus.node
      : this.audioCtx.destination;

    // Optional panner
    if (panValue !== 0) {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
      gain.connect(panner);
      panner.connect(dest);
      this._nodes.push({ node: panner });
    } else {
      gain.connect(dest);
    }

    osc.start(absTime);
    osc.stop(absTime + dur + 0.01);

    this._nodes.push({ osc, gain });
  }

  /**
   * Schedule a CV event at the given absolute audio time.
   * The CV modulates an audio parameter (filter, gain, pan) over its duration.
   * @param {Object} cvEvent - { name, target, transport, lib, objectType, args, code, durSec }
   * @param {number} absTime - absolute AudioContext time
   */
  sendCV(cvEvent, absTime) {
    const dur = Math.max(0.05, cvEvent.durSec);
    const args = cvEvent.args || {};

    switch (cvEvent.objectType) {
      case 'adsr':
        this._cvADSR(args, dur, absTime);
        break;
      case 'lfo':
        this._cvLFO(args, dur, absTime);
        break;
      case 'ramp':
        this._cvRamp(args, dur, absTime);
        break;
      case 'backtick':
        this._cvBacktick(cvEvent.code, dur, absTime);
        break;
    }
  }

  /** ADSR envelope on a lowpass filter applied to destination */
  _cvADSR(args, dur, absTime) {
    const attackSec = (args.attack || 10) / 1000;
    const decaySec = (args.decay || 100) / 1000;
    const sustain = args.sustain != null ? args.sustain : 0.7;
    const releaseSec = (args.release || 200) / 1000;

    // Create a filter node on the destination bus
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;

    // ADSR on filter frequency: 200 Hz → 4000 Hz → sustain level → 200 Hz
    const minFreq = 200;
    const maxFreq = 4000;
    const sustainFreq = minFreq + (maxFreq - minFreq) * sustain;

    filter.frequency.setValueAtTime(minFreq, absTime);
    filter.frequency.linearRampToValueAtTime(maxFreq, absTime + attackSec);
    filter.frequency.linearRampToValueAtTime(sustainFreq, absTime + attackSec + decaySec);

    // Hold sustain until release starts
    const releaseStart = Math.max(absTime + attackSec + decaySec, absTime + dur - releaseSec);
    filter.frequency.setValueAtTime(sustainFreq, releaseStart);
    filter.frequency.linearRampToValueAtTime(minFreq, absTime + dur);

    // Insert filter into the audio graph: reconnect destination
    // Use a gain node as the CV bus entry point
    const bus = this.audioCtx.createGain();
    bus.gain.value = 1;
    bus.connect(filter);
    filter.connect(this.audioCtx.destination);

    // Store as the active CV bus — notes scheduled in this window will route through it
    this._cvBus = { node: bus, endTime: absTime + dur };
    this._nodes.push({ node: filter }, { node: bus });
  }

  /** LFO on stereo panning */
  _cvLFO(args, dur, absTime) {
    const rate = args.rate || 4;
    const amplitude = args.amplitude != null ? args.amplitude : 0.5;
    const shape = args.shape || 'sine';

    const lfo = this.audioCtx.createOscillator();
    const lfoGain = this.audioCtx.createGain();
    const panner = this.audioCtx.createStereoPanner();

    lfo.type = shape;
    lfo.frequency.value = rate;
    lfoGain.gain.value = amplitude;

    lfo.connect(lfoGain);
    lfoGain.connect(panner.pan);
    panner.connect(this.audioCtx.destination);

    lfo.start(absTime);
    lfo.stop(absTime + dur);

    // Store as CV bus for notes to route through
    const bus = this.audioCtx.createGain();
    bus.gain.value = 1;
    bus.connect(panner);
    this._cvBus = { node: bus, endTime: absTime + dur };
    this._nodes.push({ osc: lfo, node: lfoGain }, { node: panner }, { node: bus });
  }

  /** Linear ramp on filter frequency */
  _cvRamp(args, dur, absTime) {
    const fromVal = args.from != null ? args.from : 200;
    const toVal = args.to != null ? args.to : 4000;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;

    filter.frequency.setValueAtTime(fromVal, absTime);
    filter.frequency.linearRampToValueAtTime(toVal, absTime + dur);

    const bus = this.audioCtx.createGain();
    bus.gain.value = 1;
    bus.connect(filter);
    filter.connect(this.audioCtx.destination);

    this._cvBus = { node: bus, endTime: absTime + dur };
    this._nodes.push({ node: filter }, { node: bus });
  }

  /** Backtick CV: evaluate JS function to get a Float32Array curve */
  _cvBacktick(code, dur, absTime) {
    try {
      // The code should be a function (t, dur) => value or return a Float32Array
      const fn = new Function('sampleRate', 'dur', `
        const samples = Math.ceil(sampleRate * dur);
        const curve = new Float32Array(samples);
        const userFn = ${code};
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate;
          curve[i] = typeof userFn === 'function' ? userFn(t, dur) : userFn;
        }
        return curve;
      `);
      const curve = fn(this.audioCtx.sampleRate, dur);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4;

      // Scale curve values (0-1) to frequency range (200-4000 Hz)
      const scaledCurve = new Float32Array(curve.length);
      for (let i = 0; i < curve.length; i++) {
        scaledCurve[i] = 200 + Math.max(0, Math.min(1, curve[i])) * 3800;
      }

      filter.frequency.setValueCurveAtTime(scaledCurve, absTime, dur);

      const bus = this.audioCtx.createGain();
      bus.gain.value = 1;
      bus.connect(filter);
      filter.connect(this.audioCtx.destination);

      this._cvBus = { node: bus, endTime: absTime + dur };
      this._nodes.push({ node: filter }, { node: bus });
    } catch (e) {
      console.warn('CV backtick error:', e.message);
    }
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
