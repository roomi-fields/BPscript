/**
 * BPscript Resolver — alphabet + tuning → frequency/MIDI
 *
 * Uses lib/alphabet.json (note definitions with semitone offsets)
 * and lib/tuning.json (ratio-based temperaments) to resolve symbols
 * to MIDI note numbers and frequencies.
 */

export class Resolver {
  /**
   * @param {Object} alphabetData - from lib/alphabet.json (a specific alphabet entry)
   * @param {Object} [tuningData] - from lib/tuning.json (a specific tuning entry)
   * @param {Object} [options]
   * @param {number} [options.baseHz=440] - reference frequency for A4
   */
  constructor(alphabetData, tuningData, { baseHz = 440 } = {}) {
    this.baseHz = baseHz;
    this.semitones = {};   // symbol → semitone offset (e.g. "C" → 0, "D" → 2)
    this.ratios = null;     // degree → ratio (for non-equal temperament)

    // Build semitone map from alphabet generator
    if (alphabetData?.generator?.semitones) {
      this.semitones = { ...alphabetData.generator.semitones };
    } else if (alphabetData?.generator?.notes) {
      // Indian-style: sa=0, re=2, ga=4, ma=5, pa=7, dha=9, ni=11
      const defaultSemitones = [0, 2, 4, 5, 7, 9, 11];
      alphabetData.generator.notes.forEach((note, i) => {
        this.semitones[note] = defaultSemitones[i % 12] || i;
      });
    }

    // Build ratio table from tuning
    if (tuningData?.ratios) {
      this.ratios = tuningData.ratios;  // degree (0-11) → ratio
    }
  }

  /**
   * Resolve a symbol to MIDI note number and frequency.
   * @param {string} symbol - e.g. "C4", "sa4", "D#5"
   * @returns {{ midiNote: number, frequency: number, cents: number }}
   */
  resolve(symbol) {
    const parsed = this._parseSymbol(symbol);
    if (!parsed) return null;

    const { noteName, octave } = parsed;
    const semitone = this.semitones[noteName];
    if (semitone == null) return null;

    // MIDI note: C4 = 60
    const midiNote = (octave + 1) * 12 + semitone;

    let frequency;
    let cents = 0;

    if (this.ratios && this.ratios[semitone]) {
      // Just intonation / custom temperament
      const ratio = this.ratios[semitone];
      // Base: C of the octave, relative to A4=baseHz
      const cOfOctave = this.baseHz * Math.pow(2, (octave - 4) + (-9 / 12));
      frequency = cOfOctave * ratio;
      // Cents deviation from equal temperament
      const equalFreq = this.baseHz * Math.pow(2, (midiNote - 69) / 12);
      cents = 1200 * Math.log2(frequency / equalFreq);
    } else {
      // Equal temperament
      frequency = this.baseHz * Math.pow(2, (midiNote - 69) / 12);
    }

    return {
      midiNote,
      frequency: Math.round(frequency * 100) / 100,
      cents: Math.round(cents * 100) / 100
    };
  }

  /**
   * Parse a symbol string into note name + octave.
   * Handles: C4, D#5, Eb3, sa4, re6
   */
  _parseSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return null;

    // Try Western: letter + optional accidental + octave digit(s)
    const western = symbol.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (western) {
      return { noteName: western[1], octave: parseInt(western[2]) };
    }

    // Try Indian/generic: word + octave digit(s)
    const generic = symbol.match(/^([a-zA-Z]+)(\d+)$/);
    if (generic) {
      return { noteName: generic[1], octave: parseInt(generic[2]) };
    }

    return null;
  }
}
