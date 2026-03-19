/**
 * BPscript Resolver — alphabet + tuning → frequency
 *
 * Chain: token → parse (name + octave) → degree → temperament → frequency
 *
 * Octave conventions (defined per alphabet):
 *   Western:  C_3, D#_4, Eb_5  (underscore + digit)
 *   Indian:   Sa, Sa_^, Sa_^^, Sa_v, Sa_vv  (central + modifiers)
 *
 * Central octave = 4 (A_4 = 440 Hz default)
 */

export class Resolver {
  constructor() {
    this.baseHz = 440;
    this.centralOctave = 4;
    this.semitones = {};    // noteName → semitone offset (C→0, D→2, sa→0, re→2)
    this.ratios = null;     // semitone → frequency ratio (for non-equal temperament)
    this.octaveStyle = 'number';  // 'number' (C_4) or 'modifier' (Sa_^)
    this._cache = {};
  }

  /**
   * Configure from alphabet lib data.
   * @param {Object} alphabetEntry - e.g. libs.alphabet.alphabets.western
   */
  setAlphabet(alphabetEntry) {
    this._cache = {};
    if (!alphabetEntry?.generator) return;

    const gen = alphabetEntry.generator;

    if (gen.semitones) {
      this.semitones = { ...gen.semitones };
    } else if (gen.notes) {
      // Map notes to default major scale semitones
      const ds = [0, 2, 4, 5, 7, 9, 11];
      this.semitones = {};
      gen.notes.forEach((n, i) => {
        this.semitones[n] = ds[i % 7];
      });
    }

    // Detect octave style from alphabet
    this.octaveStyle = gen.octaveStyle || (gen.accidentals ? 'number' : 'modifier');
  }

  /**
   * Set tuning from tuning.json scale.
   * @param {Object} scaleData - e.g. tuningLib.scales.Cmaj
   */
  setTuning(scaleData) {
    this._cache = {};
    if (!scaleData) {
      this.ratios = null;
      return;
    }
    if (scaleData.frequencies) {
      this.ratios = {};
      for (let i = 0; i < scaleData.frequencies.length && i < 13; i++) {
        const f = scaleData.frequencies[i];
        this.ratios[i] = typeof f === 'number' ? f : parseFloat(f);
      }
    }
    if (scaleData.baseHz) this.baseHz = scaleData.baseHz;
  }

  /**
   * Set reference pitch.
   * @param {number} hz - e.g. 442
   */
  setReference(hz) {
    this.baseHz = hz;
    this._cache = {};
  }

  /**
   * Resolve a token to frequency.
   * @param {string} token - e.g. "C_4", "Sa_^", "D#_5"
   * @returns {{ frequency: number, midiNote: number, cents: number } | null}
   */
  resolve(token) {
    if (this._cache[token]) return this._cache[token];

    const parsed = this._parseToken(token);
    if (!parsed) return null;

    const { noteName, octave } = parsed;
    const semitone = this.semitones[noteName];
    if (semitone == null) return null;

    const midiNote = (octave + 1) * 12 + semitone;
    let frequency;
    let cents = 0;

    if (this.ratios && this.ratios[semitone] != null) {
      const ratio = this.ratios[semitone];
      const cOfOctave = this.baseHz * Math.pow(2, (octave - 4) + (-9 / 12));
      frequency = cOfOctave * ratio;
      const equalFreq = this.baseHz * Math.pow(2, (midiNote - 69) / 12);
      cents = 1200 * Math.log2(frequency / equalFreq);
    } else {
      frequency = this.baseHz * Math.pow(2, (midiNote - 69) / 12);
    }

    const result = {
      frequency: Math.round(frequency * 100) / 100,
      midiNote,
      cents: Math.round(cents * 100) / 100,
      noteName,
      octave,
    };
    this._cache[token] = result;
    return result;
  }

  /**
   * Parse token into note name + octave.
   *
   * Formats:
   *   C_4, D#_5, Eb_3       → number style (western)
   *   Sa, Sa_^, Sa_^^        → modifier style (indian, central=4)
   *   Sa_v, Sa_vv            → modifier style down
   */
  _parseToken(token) {
    if (!token || typeof token !== 'string') return null;

    // Style 1: name_N (underscore + digit) — "C_4", "D#_5", "Eb_3"
    const numMatch = token.match(/^(.+)_(\d+)$/);
    if (numMatch) {
      return { noteName: numMatch[1], octave: parseInt(numMatch[2]) };
    }

    // Style 2: name_^ name_^^ (up) or name_v name_vv (down)
    const modUp = token.match(/^(.+?)(_\^+)$/);
    if (modUp) {
      const ups = modUp[2].length - 1; // number of ^ chars
      return { noteName: modUp[1], octave: this.centralOctave + ups };
    }
    const modDown = token.match(/^(.+?)(_v+)$/);
    if (modDown) {
      const downs = modDown[2].match(/v/g).length;
      return { noteName: modDown[1], octave: this.centralOctave - downs };
    }

    // Style 3: bare name — central octave (e.g. "Sa", "C")
    if (this.semitones[token] != null) {
      return { noteName: token, octave: this.centralOctave };
    }

    // Legacy: old format C4, sa4 (letter(s) + digit, no underscore)
    const legacy = token.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (legacy) {
      return { noteName: legacy[1], octave: parseInt(legacy[2]) };
    }
    const legacyGeneric = token.match(/^([a-zA-Z]+)(\d+)$/);
    if (legacyGeneric && this.semitones[legacyGeneric[1]] != null) {
      return { noteName: legacyGeneric[1], octave: parseInt(legacyGeneric[2]) };
    }

    return null;
  }
}
