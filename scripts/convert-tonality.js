/**
 * Convert BP3 -to.* tonality files to lib/tuning.json
 *
 * Format BP3 -to.*:
 *   "scale_name"
 *   /note1 note2 ... noteN/          — note names
 *   c<ratio> <num> <den>c            — comma (syntonic comma ratio)
 *   k<indices>k                       — key indices (optional)
 *   [num den num den ...]            — ratios as fraction pairs
 *   sp h p h ... ps                   — interval types (optional)
 *   |N|                               — base octave
 *   f2 <params> <freqs>              — pre-computed frequencies + metadata
 *   <html>description</html>         — description (optional)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TD = '/mnt/d/Claude/bp3-engine/test-data';
const files = readdirSync(TD).filter(f => f.startsWith('-to.'));

const scales = {};

for (const file of files) {
  const content = readFileSync(join(TD, file), 'utf-8').replace(/\r/g, '');
  const lines = content.split('\n');

  let i = 0;
  // Skip header
  while (i < lines.length && !lines[i].startsWith('_begin')) i++;
  i++; // skip _begin tables

  while (i < lines.length) {
    // Find scale name
    while (i < lines.length && !lines[i].match(/^"/)) i++;
    if (i >= lines.length) break;

    const name = lines[i].replace(/"/g, '').trim();
    i++;

    let notes = [];
    let ratios = [];
    let baseOctave = 4;
    let baseHz = 261.63;
    let baseMidiKey = 60;
    let frequencies = [];
    let description = '';
    let comma = null;
    let intervalTypes = [];

    // Parse fields until next scale or end
    while (i < lines.length && !lines[i].match(/^"/)) {
      const line = lines[i].trim();

      // Note names: /C D E F .../
      if (line.startsWith('/') && line.endsWith('/')) {
        notes = line.slice(1, -1).trim().split(/\s+/);
      }

      // Comma: c<float> <num> <den>c
      else if (line.startsWith('c') && line.endsWith('c') && line.length > 2) {
        const parts = line.slice(1, -1).trim().split(/\s+/);
        if (parts.length >= 3) {
          comma = { ratio: parseFloat(parts[0]), num: parseInt(parts[1]), den: parseInt(parts[2]) };
        }
      }

      // Ratios: [num den num den ...]
      else if (line.startsWith('[') && line.includes(']')) {
        const ratioStr = line.replace(/[\[\]]/g, '').trim();
        const nums = ratioStr.split(/\s+/).map(Number);
        ratios = [];
        for (let j = 0; j < nums.length; j += 2) {
          if (j + 1 < nums.length) {
            ratios.push({ num: nums[j], den: nums[j + 1] });
          }
        }
      }

      // Interval types: sp h p h ... ps
      else if (line.startsWith('sp') && line.endsWith('ps')) {
        intervalTypes = line.slice(2, -2).trim().split(/\s+/);
      }

      // Base octave: |N|
      else if (line.match(/^\|\d+\|$/)) {
        baseOctave = parseInt(line.replace(/\|/g, ''));
      }

      // Frequencies: f2 0 128 -51 N ratio baseHz baseMidi freq1 freq2 ...
      else if (line.startsWith('f2 ')) {
        const parts = line.split(/\s+/);
        if (parts.length > 7) {
          const nDegrees = parseInt(parts[4]);
          const octaveRatio = parseFloat(parts[5]);
          baseHz = parseFloat(parts[6]);
          baseMidiKey = parseInt(parts[7]);
          frequencies = parts.slice(8).map(Number);
        }
      }

      // Description: <html>...</html>
      else if (line.startsWith('<html>')) {
        description = line.replace(/<\/?html>/g, '').replace(/<br\s*\/?>/g, ' ').trim();
      }

      i++;
    }

    // Skip empty/invalid scales
    if (ratios.length === 0 && frequencies.length === 0) continue;

    // Build scale object
    const scale = {
      notes,
      baseHz,
      baseMidiKey,
    };

    if (ratios.length > 0) {
      // Filter out zero ratios (placeholder entries like BACH)
      const validRatios = ratios.filter(r => r.num !== 0 || r.den !== 0);
      if (validRatios.length > 0) {
        scale.ratios = validRatios.map(r => r.den === 1 ? r.num : `${r.num}/${r.den}`);
      }
    }

    if (frequencies.length > 0) {
      scale.frequencies = frequencies;
    }

    if (comma) scale.comma = `${comma.num}/${comma.den}`;
    if (description) scale.description = description;
    if (intervalTypes.length > 0) scale.intervalTypes = intervalTypes;
    if (baseOctave !== 4) scale.baseOctave = baseOctave;

    // Deduplicate: keep the version with most data
    if (!scales[name] || Object.keys(scale).length > Object.keys(scales[name]).length) {
      scales[name] = scale;
    }
  }
}

const output = {
  name: "tuning",
  description: "Tuning systems and temperaments converted from BP3 -to.* files",
  source: "Bernard Bel / Bol Processor",
  scales
};

writeFileSync('lib/tuning.json', JSON.stringify(output, null, 2) + '\n');
console.log(`Converted ${Object.keys(scales).length} scales from ${files.length} files`);
console.log('Sample scales:', Object.keys(scales).slice(0, 10).join(', '));
