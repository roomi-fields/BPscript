/**
 * Web MIDI Transport
 *
 * Sends MIDI events via the Web MIDI API.
 * Resolves token → frequency → MIDI note + pitch bend for microtonal accuracy.
 * Requires user gesture to call navigator.requestMIDIAccess().
 */

export class MidiTransport {
  /**
   * @param {Object} [options]
   * @param {number} [options.outputIndex=0] - MIDI output port index
   * @param {Object} [options.resolver] - Resolver instance for token → frequency
   */
  constructor({ outputIndex = 0, resolver = null } = {}) {
    this._access = null;
    this._output = null;
    this._outputIndex = outputIndex;
    this._ready = false;
    this._pendingNoteOffs = [];
    this.resolver = resolver;
  }

  /**
   * Initialize MIDI access. Must be called after user gesture.
   * @returns {Promise<boolean>} true if MIDI output available
   */
  async init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not available');
      return false;
    }
    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(this._access.outputs.values());
      if (outputs.length === 0) {
        console.warn('No MIDI outputs found');
        return false;
      }
      this._output = outputs[this._outputIndex] || outputs[0];
      this._ready = true;
      console.log(`MIDI output: ${this._output.name}`);
      return true;
    } catch (e) {
      console.error('MIDI access denied:', e);
      return false;
    }
  }

  /**
   * Set a specific MIDI output port directly (used by web UI).
   * @param {MIDIOutput} port
   */
  setOutput(port) {
    this._output = port;
    this._ready = !!port;
  }

  /**
   * Schedule a note event.
   * Resolves token to MIDI note via frequency, with pitch bend for microtonal.
   *
   * @param {Object} event - { token, velocity, durSec, chan, vel, pitchrange }
   * @param {number} absTime - absolute AudioContext time
   */
  send(event, absTime) {
    if (!this._ready || !this._output) return;

    // Resolve token → frequency → MIDI note
    const resolved = this.resolver?.resolve(event.token);
    if (!resolved?.frequency) return;

    const semitones = 69 + 12 * Math.log2(resolved.frequency / 440);
    const note = Math.max(0, Math.min(127, Math.round(semitones)));
    const bendCents = (semitones - note) * 100;

    const channel = ((event.chan || 1) - 1) & 0x0F;
    const vel = Math.min(127, Math.max(0, Math.round((event.velocity ?? 0.5) * 127)));

    // Convert absTime to performance.now() timestamp
    const perfNow = performance.now();
    const audioNow = this._getAudioCtxCurrentTime?.() || 0;
    const offset = (absTime - audioNow) * 1000; // seconds → ms
    const timestamp = perfNow + Math.max(0, offset);

    // Pitch bend for microtonal (> 1 cent deviation)
    if (Math.abs(bendCents) > 1) {
      const pitchrange = event.pitchrange || 200; // cents, default ±1 tone
      const bendNorm = bendCents / pitchrange; // -1..+1
      const bendValue = Math.round(8192 + bendNorm * 8191);
      const bendClamped = Math.max(0, Math.min(16383, bendValue));
      const lsb = bendClamped & 0x7F;
      const msb = (bendClamped >> 7) & 0x7F;
      this._output.send([0xE0 | channel, lsb, msb], timestamp);
    }

    // NoteOn
    this._output.send([0x90 | channel, note, vel], timestamp);

    // NoteOff
    const offTime = timestamp + (event.durSec || 0.1) * 1000;
    this._output.send([0x80 | channel, note, 0], offTime);

    // Reset pitch bend after note (if it was bent)
    if (Math.abs(bendCents) > 1) {
      this._output.send([0xE0 | channel, 0x00, 0x40], offTime);
    }

    this._pendingNoteOffs.push({ note, channel, offTime });
  }

  /**
   * Send a CC message.
   * @param {number} cc - CC number (0-127)
   * @param {number} value - CC value (0-127)
   * @param {number} [channel=0] - MIDI channel (0-based)
   */
  sendCC(cc, value, channel = 0) {
    if (!this._ready || !this._output) return;
    this._output.send([0xB0 | (channel & 0x0F), cc & 0x7F, value & 0x7F]);
  }

  /**
   * Set a reference to get current AudioContext time (for timing conversion).
   */
  setAudioCtxTimeGetter(fn) {
    this._getAudioCtxCurrentTime = fn;
  }

  /**
   * Stop: send all-notes-off on all channels.
   */
  close() {
    if (!this._ready || !this._output) return;
    for (let ch = 0; ch < 16; ch++) {
      // All Notes Off (CC 123)
      this._output.send([0xB0 | ch, 123, 0]);
      // Reset pitch bend
      this._output.send([0xE0 | ch, 0x00, 0x40]);
    }
    this._pendingNoteOffs = [];
  }
}
