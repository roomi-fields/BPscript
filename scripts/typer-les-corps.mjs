#!/usr/bin/env node
/**
 * TYPER LES CORPS — le TypeScript d'un backtick reste vérifié.
 *
 * ⛔ POURQUOI CE SCRIPT EXISTE. Les corps de librairie vivaient dans des fichiers `.ts` que `tsc`
 * lisait directement. Depuis le 2026-09-03 ils vivent dans un BACKTICK tagué, à l'intérieur d'une
 * source BPScript (décision de Romain : « un corps n'est pas un attribut ou un membre » ; le corps
 * s'écrit avec la forme que le langage a déjà pour le code externe). `tsc` ne voit donc plus rien —
 * et le portillon l'a dit tout de suite : « No inputs were found in config file ».
 *
 * ⇒ CE N'EST PAS UNE RAISON DE RETIRER LA VÉRIFICATION. Un corps est du TypeScript typé contre le
 *   SDK de son exécutant ; le perdre rendrait muettes les fautes que `tsc` attrapait. On EXTRAIT
 *   donc les corps dans un dossier de travail et on les type là — la source reste le `.bpsl`.
 *
 * ⚠️ LE DOSSIER EXTRAIT EST JETABLE ET HORS DU DÉPÔT : il ne doit jamais devenir une seconde
 *   autorité. Il naît, il se type, il meurt.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(RACINE, 'lib');
const BAC = join(RACINE, '.corps-types');

/** Les corps tagués `ts` d'une source, avec le nom de l'objet qui les porte. */
export function corpsTypescript(texte) {
  const out = [];
  // La clôture compte : l'ouverture est une suite de backticks, la fermeture la même suite.
  const rx = /(`+)ts:\s*([\s\S]*?)\1/g;
  let m;
  while ((m = rx.exec(texte))) out.push(m[2]);
  return out;
}

const sources = [];
const ramasser = (dir, prefixe) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { ramasser(join(dir, e.name), `${prefixe}${e.name}-`); continue; }
    if (!e.name.endsWith('.bpsl')) continue;
    const texte = readFileSync(join(dir, e.name), 'utf8');
    for (const [i, code] of corpsTypescript(texte).entries()) {
      sources.push({ nom: `${prefixe}${e.name.replace(/\.bpsl$/, '')}${i ? `-${i}` : ''}.ts`, code });
    }
  }
};
ramasser(LIB, '');

if (!sources.length) {
  console.error('⛔ AUCUN corps TypeScript extrait — ce script refuse d\'avoir examiné zéro. '
    + 'Soit les corps ont changé de forme, soit l\'extraction est fautive : les deux se regardent.');
  process.exit(1);
}

rmSync(BAC, { recursive: true, force: true });
mkdirSync(BAC, { recursive: true });
for (const s of sources) writeFileSync(join(BAC, s.nom), s.code);

const config = join(RACINE, 'tsconfig.corps.json');
if (!existsSync(config)) {
  console.error(`⛔ ${config} manque — le typage des corps n'a pas de configuration.`);
  process.exit(1);
}
try {
  execFileSync('npx', ['tsc', '-p', config], { cwd: RACINE, stdio: 'inherit' });
  console.log(`✓ ${sources.length} corps TypeScript typé(s), extraits de leurs backticks`);
} finally {
  rmSync(BAC, { recursive: true, force: true });
}
