/**
 * Web MIDI Transport
 *
 * Sends MIDI events via the Web MIDI API.
 * Requires user gesture to call navigator.requestMIDIAccess().
 */

export class MidiTransport {
  /**
   * @param {Object} [options]
   * @param {number} [options.outputIndex=0] - MIDI output port index
   */
  constructor({ outputIndex = 0 } = {}) {
    this._access = null;
    this._output = null;
    this._outputIndex = outputIndex;
    this._ready = false;
    this._pendingNoteOffs = [];
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
   * Schedule a note event.
   * Web MIDI API uses DOMHighResTimeStamp (performance.now() based).
   * We convert from AudioContext time.
   *
   * @param {Object} event - { note, velocity, durSec, channel }
   * @param {number} absTime - absolute AudioContext time (not used directly for MIDI)
   */
  send(event, absTime) {
    if (!this._ready || !this._output) return;

    const channel = (event.channel || 0) & 0x0F;
    const vel = Math.round(event.velocity * 127);
    const note = event.note;

    // Convert absTime to performance.now() timestamp
    // AudioContext.currentTime and performance.now() share the same origin (approximately)
    const perfNow = performance.now();
    const audioNow = this._getAudioCtxCurrentTime?.() || 0;
    const offset = (absTime - audioNow) * 1000; // seconds → ms
    const timestamp = perfNow + Math.max(0, offset);

    // NoteOn
    this._output.send([0x90 | channel, note, vel], timestamp);

    // NoteOff
    const offTime = timestamp + event.durSec * 1000;
    this._output.send([0x80 | channel, note, 0], offTime);

    this._pendingNoteOffs.push({ note, channel, offTime });
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
    }
    this._pendingNoteOffs = [];
  }
}
