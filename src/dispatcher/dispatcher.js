/**
 * BPscript Dispatcher
 *
 * Loads timed tokens from BP3 WASM (symbolic labels with timing),
 * maintains control state, and distributes to transports
 * via a lookahead clock for sample-accurate scheduling.
 *
 * Loop mode: when enabled, the dispatcher calls a re-derive function
 * at the end of each cycle to get a new sequence (potentially different
 * in random mode). The live coder can swap the grammar between cycles.
 */

import { Clock } from './clock.js';

export class Dispatcher {
  /**
   * @param {AudioContext} audioCtx
   */
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.clock = new Clock(audioCtx);
    this.transports = {};     // name → Transport instance
    this.events = [];         // sorted by startSec
    this._cursor = 0;
    this._onEnd = null;
    this._running = false;
    this._loopOffset = 0;     // accumulated time offset from previous cycles

    // Loop mode
    this.loop = false;
    this._reDerive = null;    // function that returns new timed tokens

    // Control state — updated by control tokens during playback
    this.controlState = {
      vel: 64, chan: 1, pan: 64,
      wave: 'triangle', attack: 20, release: 100,
      detune: 0, filter: 0, filterQ: 1,
    };
  }

  /**
   * Register a transport by name.
   */
  addTransport(name, transport) {
    this.transports[name] = transport;
  }

  /**
   * Set the control table (from transpiler output).
   * Maps CT0, CT1... to their assignments.
   */
  setControlTable(controlTable) {
    this._controlTable = {};
    if (controlTable) {
      for (const entry of controlTable) {
        this._controlTable[entry.id] = entry.assignments;
      }
    }
  }

  /**
   * Load timed tokens from bp3_get_timed_tokens().
   * Each token: { token: "C4", start: 0, end: 1000 }
   */
  load(timedTokens) {
    if (!timedTokens || timedTokens.length === 0) {
      this.events = [];
      return;
    }

    this.controlState = {
      vel: 64, chan: 1, pan: 64,
      wave: 'triangle', attack: 20, release: 100,
      detune: 0, filter: 0, filterQ: 1,
    };

    this.events = timedTokens.map(t => ({
      token: t.token,
      startSec: t.start / 1000,
      durSec: Math.max(0, (t.end - t.start)) / 1000,
      isControl: t.token.startsWith('_'),
      isSilence: t.token === '-',
      isProlongation: t.token === '_',
    })).sort((a, b) => a.startSec - b.startSec);

    this._cursor = 0;
    this._loopOffset = 0;
  }

  /**
   * Total duration of loaded sequence in seconds.
   */
  get duration() {
    if (this.events.length === 0) return 0;
    const last = this.events[this.events.length - 1];
    return last.startSec + last.durSec;
  }

  /**
   * Start playback.
   * @param {Function} [onEnd] - called when playback ends (non-loop) or on error
   * @param {Object} [options]
   * @param {boolean} [options.loop=false] - loop the sequence
   * @param {Function} [options.reDerive] - called at end of each cycle, must return timed tokens array
   */
  start(onEnd, { loop = false, reDerive = null } = {}) {
    if (this.events.length === 0) return;
    this._onEnd = onEnd;
    this._cursor = 0;
    this._running = true;
    this._loopOffset = 0;
    this.loop = loop;
    this._reDerive = reDerive;
    this.controlState = { vel: 64, chan: 1 };

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.clock.start((scheduleUntil) => {
      this._schedule(scheduleUntil);
    });
  }

  stop() {
    this._running = false;
    this.loop = false;
    this.clock.stop();
    for (const transport of Object.values(this.transports)) {
      transport.close();
    }
  }

  /**
   * Hot-swap: replace the grammar for the next loop cycle.
   * In loop mode, the new reDerive function will be called at the next cycle boundary.
   * Outside loop mode, restarts with new tokens immediately.
   */
  hotSwap(timedTokens, reDerive) {
    if (this.loop && reDerive) {
      // Just swap the re-derive function — next cycle will use it
      this._reDerive = reDerive;
    } else {
      // Immediate swap: reload and reset cursor
      const currentTime = this.clock.now;
      this.load(timedTokens);
      this._loopOffset = currentTime;
    }
  }

  /** Internal: schedule events up to the given absolute audio time */
  _schedule(scheduleUntil) {
    while (this._cursor < this.events.length) {
      const evt = this.events[this._cursor];
      const absTime = this.clock.absTime(this._loopOffset + evt.startSec);

      if (absTime > scheduleUntil) break;

      if (evt.isControl) {
        this._applyControl(evt.token);
      } else if (!evt.isSilence && !evt.isProlongation && evt.durSec > 0) {
        const transport = this.transports['default']
          || Object.values(this.transports)[0];

        if (transport) {
          transport.send({
            token: evt.token,
            startSec: this._loopOffset + evt.startSec,
            durSec: evt.durSec,
            ...this.controlState,
            velocity: this.controlState.vel / 127,
          }, absTime);
        }
      }

      this._cursor++;
    }

    // End of sequence
    if (this._cursor >= this.events.length && this._running) {
      const cycleEnd = this.clock.absTime(this._loopOffset + this.duration);
      const remaining = (cycleEnd - this.audioCtx.currentTime) * 1000; // ms

      if (remaining <= this.clock.lookahead * 1000) {
        if (this.loop) {
          this._nextCycle();
        } else {
          // Schedule end callback after remaining time
          this.stop();
          const onEnd = this._onEnd;
          if (onEnd) {
            setTimeout(() => onEnd(), Math.max(0, remaining));
          }
        }
      }
    }
  }

  /** Start the next loop cycle */
  _nextCycle() {
    this._loopOffset += this.duration;
    this.controlState = { vel: 64, chan: 1 };

    // Re-derive: call bp3_produce again for a new sequence
    if (this._reDerive) {
      const newTokens = this._reDerive();
      if (newTokens && newTokens.length > 0) {
        // Reload events without resetting loopOffset
        this.events = newTokens.map(t => ({
          token: t.token,
          startSec: t.start / 1000,
          durSec: Math.max(0, (t.end - t.start)) / 1000,
          isControl: t.token.startsWith('_'),
          isSilence: t.token === '-',
          isProlongation: t.token === '_',
        })).sort((a, b) => a.startSec - b.startSec);
      }
    }

    this._cursor = 0;
  }

  /** Apply a control token — _script(CTN) → look up table, or _xxx(value) */
  _applyControl(token) {
    const m = token.match(/^_(\w+)\((.+)\)$/);
    if (!m) return;
    const [, name, value] = m;

    // _script(CTN) → look up control table
    if (name === 'script' && value.startsWith('CT') && this._controlTable) {
      const assignments = this._controlTable[value];
      if (assignments) {
        for (const [key, val] of Object.entries(assignments)) {
          this._setControl(key, val);
        }
      }
      return;
    }

    // Direct BP3 control: _vel(80), _chan(2), etc.
    this._setControl(name, value);
  }

  _setControl(name, value) {
    const cs = this.controlState;
    const v = typeof value === 'number' ? value : parseFloat(value);
    switch (name) {
      case 'vel': cs.vel = v || 64; break;
      case 'chan': cs.chan = v || 1; break;
      case 'pan': cs.pan = v || 64; break;
      case 'wave': cs.wave = String(value); break;
      case 'attack': cs.attack = v || 20; break;
      case 'release': cs.release = v || 100; break;
      case 'detune': cs.detune = v || 0; break;
      case 'filter': cs.filter = v || 0; break;
      case 'filterQ': cs.filterQ = v || 1; break;
      case 'transpose': cs.transpose = v || 0; break;
      case 'ins': cs.ins = v || 0; break;
      case 'staccato': cs.staccato = v || 0; break;
      case 'legato': cs.legato = v || 0; break;
    }
  }
}
