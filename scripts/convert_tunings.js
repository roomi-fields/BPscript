#!/usr/bin/env node
/**
 * Convert Bernard Bel's 162 scales from lib/tuning.json (BP3 legacy format)
 * to the new lib/temperaments.json format.
 *
 * Each scale becomes a temperament entry with:
 *   - period_ratio: last ratio (usually 2, but can be stretched)
 *   - divisions: number of notes (excluding the period repeat)
 *   - ratios: exact fractions or decimal approximations
 *   - description: preserved from original
 *   - source: "Bernard Bel / Bol Processor"
 *
 * Run: node scripts/convert_tunings.js
 */

import { readFileSync, writeFileSync } from 'fs';

const legacy = JSON.parse(readFileSync('lib/tuning.json', 'utf8'));
const existing = JSON.parse(readFileSync('lib/temperaments.json', 'utf8'));

let converted = 0;
let skipped = 0;

for (const [name, scale] of Object.entries(legacy.scales)) {
  // Skip if already exists in temperaments.json
  const key = 'bp3_' + name.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (existing[key]) {
    skipped++;
    continue;
  }

  const hasFullRatios = scale.ratios && scale.ratios.length > 2;
  const sourceRatios = hasFullRatios ? scale.ratios : scale.frequencies;

  if (!sourceRatios || sourceRatios.length < 2) {
    console.warn(`SKIP ${name}: no usable ratios or frequencies`);
    skipped++;
    continue;
  }

  // Period ratio = last value in the ratios/frequencies array
  const lastRatio = sourceRatios[sourceRatios.length - 1];
  let periodRatio;
  if (typeof lastRatio === 'string' && lastRatio.includes('/')) {
    const [num, den] = lastRatio.split('/').map(Number);
    periodRatio = num / den;
  } else {
    periodRatio = typeof lastRatio === 'number' ? lastRatio : parseFloat(lastRatio);
  }

  // Divisions = number of steps (exclude the period repeat)
  const divisions = sourceRatios.length - 1;

  // Ratios = all values except the last one (which is the period)
  const ratios = sourceRatios.slice(0, -1);

  const entry = {
    description: scale.description || `Scale "${name}" from Bernard Bel / Bol Processor`,
    source: 'Bernard Bel / Bol Processor',
    period_ratio: Math.round(periodRatio * 10000) / 10000,
    divisions,
    ratios
  };

  // Preserve comma info if present
  if (scale.comma) entry.comma = scale.comma;

  // Preserve interval types if present
  if (scale.intervalTypes) entry.intervalTypes = scale.intervalTypes;

  // Preserve baseHz
  if (scale.baseHz) entry.baseHz = scale.baseHz;

  // Preserve notes for reference
  if (scale.notes) entry.notes = scale.notes.slice(0, -1); // exclude period repeat

  existing[key] = entry;
  converted++;
}

// Write back
writeFileSync('lib/temperaments.json', JSON.stringify(existing, null, 2) + '\n', 'utf8');

console.log(`Converted: ${converted}, Skipped: ${skipped}, Total in file: ${Object.keys(existing).length}`);
