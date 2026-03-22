/**
 * BPscript Resolver — 5-layer pitch resolution
 *
 * Chain: token → parse (octaves) → note + alteration (alphabet)
 *        → degree (tuning) → ratio (temperament) → frequency
 *
 * Two modes:
 *   Table:      temperament has fixed ratios[] → lookup
 *   Parametric: temperament has period + generator + mapping → compute
 *
 * One resolver per actor. Not a singleton.
 */

import { normalizeRatio, normalizeRatios } from './ratios.js';

export class Resolver {
  /**
   * @param {Object} config
   * @param {Object} config.alphabet    - from alphabets.json: { notes: [], alterations: [] }
   * @param {Object} config.octaves     - from octaves.json: { position, separator, registers, default }
   * @param {Object} config.tuning      - from tunings.json: { temperament, degrees, alterations, baseHz, baseNote, baseRegister }
   * @param {Object} config.temperament - from temperaments.json: { type?, period_ratio|period, divisions|generator, ratios|mapping }
   */
  constructor(config = {}) {
    this._cache = {};

    // Alphabet
    this.notes = config.alphabet?.notes || [];
    this.alterations = config.alphabet?.alterations || [];
    this._noteSet = new Set(this.notes);

    // Octaves — use tuning's baseRegister as default if available
    this.octaveConfig = config.octaves || { position: 'suffix', separator: '', registers: ['0','1','2','3','4','5','6','7','8','9'], default: 4 };
    if (config.tuning?.baseRegister != null) {
      this.octaveConfig = { ...this.octaveConfig, default: config.tuning.baseRegister };
    }

    // Tuning
    this.degrees = config.tuning?.degrees || null;
    this.ascending = config.tuning?.ascending || null;
    this.descending = config.tuning?.descending || null;
    this.alterationRatios = {};
    if (config.tuning?.alterations) {
      for (const [k, v] of Object.entries(config.tuning.alterations)) {
        this.alterationRatios[k] = normalizeRatio(v);
      }
    }
    this.baseHz = config.tuning?.baseHz || 440;
    this.baseNote = config.tuning?.baseNote || 'A';
    this.baseRegister = config.tuning?.baseRegister ?? 4;

    // Temperament
    this.temperament = config.temperament || null;
    this._isParametric = this.temperament?.type === 'parametric';

    // Pre-normalize table ratios
    if (this.temperament && !this._isParametric && this.temperament.ratios) {
      this._ratios = normalizeRatios(this.temperament.ratios);
      this._periodRatio = this.temperament.period_ratio || 2;
    } else if (this._isParametric) {
      this._period = this.temperament.period || 1200;  // cents
      this._generator = this.temperament.generator || 700;  // cents
      this._mapping = this.temperament.mapping || null;
    }

    // Compute base note offset for frequency calculation
    this._baseNoteIndex = this.notes.indexOf(this.baseNote);
    this._baseDegreeStep = this._getStep(this._baseNoteIndex);
  }

  /**
   * Get the step (in temperament grid) for a note at a given degree index.
   * @param {number} degreeIndex - index in alphabet.notes
   * @returns {number|null}
   */
  _getStep(degreeIndex) {
    if (degreeIndex < 0) return null;
    const degs = this.degrees || this.ascending;
    if (!degs || degreeIndex >= degs.length) return null;
    return degs[degreeIndex];
  }

  /**
   * Set the generator value (for parametric temperaments, real-time CV).
   * @param {number} cents - generator value in cents
   */
  setGenerator(cents) {
    if (!this._isParametric) return;
    this._generator = cents;
    this._cache = {};
  }

  /**
   * Set reference pitch.
   * @param {number} hz
   */
  setReference(hz) {
    this.baseHz = hz;
    this._cache = {};
  }

  /**
   * Resolve a token to frequency or sound parameters.
   * @param {string} token - e.g. "C4", "Sa_^", "ga_komal", "D#5", "dhin"
   * @param {string} [direction] - 'ascending' or 'descending' (for directional tunings)
   * @returns {{ frequency: number, noteName: string, alteration: string|null, register: number } | { layers: Array } | { freq: number, ... } | null}
   */
  resolve(token, direction) {
    const cacheKey = direction ? token + ':' + direction : token;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    // Try 5-layer pitch resolution
    const pitched = this._resolvePitch(token, direction);
    if (pitched) {
      this._cache[cacheKey] = pitched;
      return pitched;
    }

    // Fallback: sounds resolver (percussion, samples, etc.)
    if (this.soundsResolver) {
      const sounds = this.soundsResolver.resolve(token);
      if (sounds) {
        this._cache[cacheKey] = sounds;
        return sounds;
      }
    }

    return null;
  }

  /**
   * 5-layer pitch resolution: register → note → degree → step → frequency.
   * @returns {{ frequency: number, noteName: string, alteration: string|null, register: number } | null}
   */
  _resolvePitch(token, direction) {
    // Step 1: Parse register (octave convention)
    const parsed = this._parseRegister(token);
    if (!parsed) return null;

    // Step 2: Parse note + alteration
    const { noteName, alteration, register } = this._parseNoteAlteration(parsed.body, parsed.register);
    if (noteName == null) return null;

    // Step 3: Get degree index from alphabet
    const degreeIndex = this.notes.indexOf(noteName);
    if (degreeIndex < 0) return null;

    // Step 4: Get step from tuning (respecting direction if applicable)
    let step;
    if (direction === 'descending' && this.descending) {
      step = degreeIndex < this.descending.length ? this.descending[degreeIndex] : null;
    } else if (this.ascending) {
      step = degreeIndex < this.ascending.length ? this.ascending[degreeIndex] : null;
    } else if (this.degrees) {
      step = degreeIndex < this.degrees.length ? this.degrees[degreeIndex] : null;
    } else {
      step = null;
    }
    if (step == null) return null;

    // Step 5: Compute frequency
    let frequency;

    if (this._isParametric) {
      frequency = this._resolveParametric(step, alteration, register);
    } else {
      frequency = this._resolveTable(step, alteration, register);
    }

    if (frequency == null || isNaN(frequency)) return null;

    return {
      frequency: Math.round(frequency * 100) / 100,
      noteName,
      alteration,
      register,
    };
  }

  /**
   * Resolve using table mode (fixed ratios).
   */
  _resolveTable(step, alteration, register) {
    if (!this._ratios || step >= this._ratios.length) return null;

    const ratio = this._ratios[step];
    const altRatio = alteration ? (this.alterationRatios[alteration] || 1) : 1;
    const periodPow = Math.pow(this._periodRatio, register - this.baseRegister);

    // Base frequency: resolve baseNote at baseRegister
    const baseStep = this._baseDegreeStep;
    const baseRatio = (baseStep != null && baseStep < this._ratios.length) ? this._ratios[baseStep] : 1;

    return this.baseHz / baseRatio * periodPow * ratio * altRatio;
  }

  /**
   * Resolve using parametric mode (Dynamic Tonality).
   * pitch_cents = step × generator, reduced mod period.
   */
  _resolveParametric(step, alteration, register) {
    const period = this._period;
    const generator = this._generator;

    // step is number of generators
    let pitchCents = step * generator;

    // Reduce into [0, period)
    pitchCents = ((pitchCents % period) + period) % period;

    // Alteration
    const altRatio = alteration ? (this.alterationRatios[alteration] || 1) : 1;

    // Base note pitch
    const baseStep = this._baseDegreeStep;
    let baseCents = baseStep != null ? ((baseStep * generator % period) + period) % period : 0;

    // Absolute cents from base
    const deltaCents = pitchCents - baseCents + (register - this.baseRegister) * period;

    return this.baseHz * Math.pow(2, deltaCents / 1200) * altRatio;
  }

  /**
   * Parse register (octave) from token using octaves config.
   * @returns {{ body: string, register: number } | null}
   */
  _parseRegister(token) {
    if (!token || typeof token !== 'string') return null;

    const oct = this.octaveConfig;
    const sep = oct.separator || '';
    const regs = oct.registers || [];
    const defaultReg = oct.default ?? 0;

    if (oct.position === 'suffix') {
      // Try longest register suffix first
      const sorted = [...regs].sort((a, b) => b.length - a.length);
      for (const reg of sorted) {
        if (reg === '') continue; // empty = default, try last
        const suffix = sep + reg;
        if (token.endsWith(suffix)) {
          const body = token.slice(0, -suffix.length);
          if (body.length > 0) {
            return { body, register: regs.indexOf(reg) };
          }
        }
      }
      // No suffix matched → default register
      return { body: token, register: defaultReg };
    }

    if (oct.position === 'prefix') {
      const sorted = [...regs].sort((a, b) => b.length - a.length);
      for (const reg of sorted) {
        if (reg === '') continue;
        const prefix = reg + sep;
        if (token.startsWith(prefix)) {
          const body = token.slice(prefix.length);
          if (body.length > 0) {
            return { body, register: regs.indexOf(reg) };
          }
        }
      }
      return { body: token, register: defaultReg };
    }

    return { body: token, register: defaultReg };
  }

  /**
   * Parse note name + alteration from body string.
   * Tries longest alteration match first.
   * @returns {{ noteName: string|null, alteration: string|null, register: number }}
   */
  _parseNoteAlteration(body, register) {
    // Try exact match first (no alteration)
    if (this._noteSet.has(body)) {
      return { noteName: body, alteration: null, register };
    }

    // Try note + alteration (suffix): "ga_komal" → note="ga", alt="komal"
    // Also handle "C#" → note="C", alt="#"
    const alts = [...this.alterations].filter(a => a !== '').sort((a, b) => b.length - a.length);
    for (const alt of alts) {
      // Alteration as suffix with separator _
      if (body.endsWith('_' + alt)) {
        const noteName = body.slice(0, -(alt.length + 1));
        if (this._noteSet.has(noteName)) {
          return { noteName, alteration: alt, register };
        }
      }
      // Alteration as direct suffix (C#, Db)
      if (body.endsWith(alt)) {
        const noteName = body.slice(0, -alt.length);
        if (this._noteSet.has(noteName)) {
          return { noteName, alteration: alt, register };
        }
      }
    }

    // Legacy fallback: try splitting letter(s) + digits for old formats
    const legacy = body.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (legacy) {
      const noteName = legacy[1].replace(/#/, '').replace(/b/, '');
      const alt = legacy[1].includes('#') ? '#' : legacy[1].includes('b') ? 'b' : null;
      const legacyReg = parseInt(legacy[2]);
      if (this._noteSet.has(noteName)) {
        return { noteName, alteration: alt, register: legacyReg };
      }
    }

    return { noteName: null, alteration: null, register };
  }
}
