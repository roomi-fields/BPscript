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
    this._controlDefaults = {};  // set via setControlDefaults()
    this.controlState = {};
    this._controlStack = []; // for scoped () controls with start/end pairs

    // Transport routing: symbol name → transport name (e.g. 'Sa' → 'midi')
    this._transportMap = {};  // set via setTransportMap()

    // CV state
    this._cvTable = {};    // CV0 → { name, target, transport, lib, objectType, args, code }
    this._cvNames = {};    // CV instance name → CV id
  }

  /**
   * Register a transport by name.
   */
  addTransport(name, transport) {
    this.transports[name] = transport;
  }

  /**
   * Set transport routing map: symbol → transport name.
   * Symbols not in the map use the 'default' transport.
   * @param {Object} map - { 'Sa': 'midi', 'Re': 'midi', ... }
   */
  setTransportMap(map) {
    this._transportMap = map || {};
  }

  /**
   * Set control defaults from controls.json runtime section.
   * Called once at init. The dispatcher uses these to reset controlState.
   * @param {Object} defaults - { vel: 64, chan: 1, wave: "triangle", ... }
   */
  setControlDefaults(defaults) {
    this._controlDefaults = { ...defaults };
    this.controlState = { ...defaults };
  }

  /**
   * Set tuning/temperament data for runtime scale() lookup.
   * @param {Object} tunings - full tunings.json content
   * @param {Object} temperaments - full temperaments.json content
   */
  setTuningData(tunings, temperaments) {
    this._tunings = tunings || {};
    this._temperaments = temperaments || {};
  }

  /**
   * Set the control table (from transpiler output).
   * Maps CT0, CT1... to their assignments.
   */
  setControlTable(controlTable) {
    this._controlTable = {};
    this._controlScopes = {};
    if (controlTable) {
      for (const entry of controlTable) {
        this._controlTable[entry.id] = entry.assignments;
        if (entry.scope) {
          this._controlScopes[entry.id] = { scope: entry.scope, restores: entry.restores };
        }
      }
    }
  }

  /**
   * Set the CV table (from transpiler output).
   * Maps CV0, CV1... to their definitions.
   */
  setCVTable(cvTable) {
    this._cvTable = {};
    this._cvNames = {};
    if (cvTable) {
      for (const entry of cvTable) {
        this._cvTable[entry.id] = entry;
        this._cvNames[entry.name] = entry.id;
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

    this.controlState = { ...this._controlDefaults };

    this.events = timedTokens.map(t => ({
      token: t.token,
      startSec: t.start / 1000,
      durSec: Math.max(0, (t.end - t.start)) / 1000,
      isControl: t.token.startsWith('_'),
      isCV: !!this._cvNames[t.token],
      isSilence: t.token === '-',
      isProlongation: t.token === '_',
    })).sort((a, b) => {
      if (a.startSec !== b.startSec) return a.startSec - b.startSec;
      const pri = (e) => e.isControl ? 0 : e.isCV ? 1 : 2;
      return pri(a) - pri(b);
    });

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
    this.controlState = { ...this._controlDefaults };

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
      } else if (evt.isCV) {
        // CV token — create the audio bus before notes at this time
        const cvId = this._cvNames[evt.token];
        const cvDef = this._cvTable[cvId];
        if (cvDef) {
          const transport = this.transports[cvDef.transport]
            || this.transports['default']
            || Object.values(this.transports)[0];

          if (transport && transport.sendCV) {
            transport.sendCV({
              ...cvDef,
              durSec: evt.durSec > 0 ? evt.durSec : this.duration,
            }, absTime);
          }
        }
      } else if (!evt.isSilence && !evt.isProlongation && evt.durSec > 0) {
        // Route to transport: check transportMap first, then fall back to 'default'
        const mappedName = this._transportMap[evt.token];
        const transport = (mappedName && this.transports[mappedName])
          || this.transports['default']
          || Object.values(this.transports)[0];

        if (transport) {
          // Symbolic pitch operations: keyxpand → rotate (degree) → transpose (grid)
          let token = evt.token;
          if (this._resolver) {
            if (this.controlState.keyxpand && this.controlState.keyxpand !== '0,1') {
              const parts = String(this.controlState.keyxpand).split(',');
              const pivot = parts[0]?.trim();
              const factor = parseFloat(parts[1]);
              if (pivot && !isNaN(factor)) {
                token = this._resolver.keyxpandToken(token, pivot, factor);
              }
            }
            if (this.controlState.rotate) {
              token = this._resolver.rotateToken(token, this.controlState.rotate);
            }
            if (this.controlState.transpose) {
              token = this._resolver.transposeToken(token, this.controlState.transpose);
            }
          }
          transport.send({
            token,
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
    this.controlState = { ...this._controlDefaults };

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
          isCV: !!this._cvNames[t.token],
          isSilence: t.token === '-',
          isProlongation: t.token === '_',
        })).sort((a, b) => {
          if (a.startSec !== b.startSec) return a.startSec - b.startSec;
          const pri = (e) => e.isControl ? 0 : e.isCV ? 1 : 2;
          return pri(a) - pri(b);
        });
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
      const scopeInfo = this._controlScopes?.[value];

      // Scoped end: restore previous state
      if (scopeInfo?.scope === 'end') {
        if (this._controlStack.length > 0) {
          const prev = this._controlStack.pop();
          // If scale changed, re-apply the restored scale
          if (prev.scale !== this.controlState.scale) {
            this.controlState = prev;
            this._applyScale(String(prev.scale || '0,0'));
          } else {
            this.controlState = prev;
          }
        }
        return;
      }

      // Scoped start: push current state before applying
      if (scopeInfo?.scope === 'start') {
        this._controlStack.push({ ...this.controlState });
      }

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
    // String values (e.g. wave type) stored as-is, numeric values parsed
    const v = parseFloat(value);
    this.controlState[name] = isNaN(v) ? String(value) : v;

    // Paired flags: xxxcont/xxxfixed toggle continuous mode
    if (name.endsWith('cont')) {
      this.controlState[name] = true;
    } else if (name.endsWith('fixed')) {
      // pitchfixed → disable pitchcont, pressfixed → disable presscont, etc.
      const contName = name.replace(/fixed$/, 'cont');
      this.controlState[contName] = false;
      delete this.controlState[name]; // pitchfixed itself is not needed
    }

    // scale() — reconfigure resolver tuning in real-time
    if (name === 'scale') {
      this._applyScale(String(value));
    }
  }

  /** Apply a scale change to the resolver. */
  _applyScale(value) {
    if (!this._resolver) return;

    // scale(0,0) → reset to initial tuning
    if (value === '0,0' || value === '0') {
      this._resolver.resetScale();
      return;
    }

    // Parse "tuningName,blockkey" or "tuningName"
    const parts = value.split(',');
    const tuningName = parts[0]?.trim();
    const blockkey = parts[1]?.trim() || null;

    if (!tuningName || !this._tunings) return;

    // Lookup tuning in tunings.json
    const tuning = this._tunings[tuningName];
    if (!tuning) {
      console.warn(`[dispatcher] scale: unknown tuning "${tuningName}"`);
      return;
    }

    // Lookup associated temperament in temperaments.json
    const temperament = tuning.temperament && this._temperaments
      ? this._temperaments[tuning.temperament]
      : null;

    this._resolver.reconfigure(tuning, temperament, blockkey);
  }

  /**
   * Dry-run: resolve all loaded events through the control pipeline
   * without audio playback. Requires load() to have been called first.
   * Returns tokens with controls applied (transpose, keyxpand, rotate).
   * Output is in temporal order (same as load() sorting).
   *
   * @param {Object} [options]
   * @param {boolean} [options.verbose=false] - include control tokens in output
   * @returns {Array<{token: string, start: number, end: number}>}
   */
  resolveTokens({ verbose = false } = {}) {
    const resolved = [];
    this.controlState = { ...this._controlDefaults };
    this._controlStack = [];

    for (const evt of this.events) {
      if (evt.isControl) {
        this._applyControl(evt.token);
        if (verbose) {
          resolved.push({
            token: evt.token,
            start: Math.round(evt.startSec * 1000),
            end: Math.round((evt.startSec + evt.durSec) * 1000),
          });
        }
        continue;
      }

      if (evt.isSilence || evt.isProlongation) continue;

      // Symbolic pitch operations: keyxpand → rotate → transpose
      let token = evt.token;
      if (this._resolver) {
        if (this.controlState.keyxpand && this.controlState.keyxpand !== '0,1') {
          const parts = String(this.controlState.keyxpand).split(',');
          const pivot = parts[0]?.trim();
          const factor = parseFloat(parts[1]);
          if (pivot && !isNaN(factor)) {
            token = this._resolver.keyxpandToken(token, pivot, factor);
          }
        }
        if (this.controlState.rotate) {
          token = this._resolver.rotateToken(token, this.controlState.rotate);
        }
        if (this.controlState.transpose) {
          token = this._resolver.transposeToken(token, this.controlState.transpose);
        }
      }

      resolved.push({
        token,
        start: Math.round(evt.startSec * 1000),
        end: Math.round((evt.startSec + evt.durSec) * 1000),
      });
    }

    return resolved;
  }
}
