#!/usr/bin/env node
/**
 * GARDE — LE COMPILATEUR LIT SES LIBRAIRIES DANS LEURS SOURCES, JAMAIS DANS LE PAQUET.
 *
 * Décision de Romain, 2026-09-02 : la structure des objets suffit ; le paquet `libs-data.js` est un
 * dérivé, et il sort. Ce garde tient les deux moitiés de ce fait :
 *   1. le chargeur n'importe pas le paquet — le texte de `libs.js` ne le nomme pas ;
 *   2. une entrée AJOUTÉE à une source atteint le compilateur SANS que le paquet soit régénéré : dans
 *      un bac (copie des fichiers suivis), `lib/audio.bpsl` reçoit un contrôle témoin, le paquet du
 *      bac reste celui d'avant, et une scène qui écrit ce contrôle compile.
 * Et la contre-épreuve : le même contrôle, ABSENT de la source, est refusé.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LE CHARGEUR N'IMPORTE PAS LE PAQUET ──────────────────────────────────────────────────────
const chargeur = readFileSync(join(RACINE, 'src/transpiler/libs.js'), 'utf8');
ok(!/from\s+'\.\/libs-data\.js'/.test(chargeur),
   "1. `libs.js` importe encore `libs-data.js` — le compilateur relirait son propre cache");
ok(/from\s+'\.\/librairies\.js'/.test(chargeur) && /from\s+'\.\/sources\.js'/.test(chargeur),
   "1. `libs.js` doit lire ses librairies par `librairies.js` et `sources.js`");

// ── 2. UNE SOURCE MODIFIÉE ATTEINT LE COMPILATEUR SANS RÉGÉNÉRATION ─────────────────────────────
const bac = mkdtempSync(join(tmpdir(), 'bpscript-sources-'));
try {
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE }).split('\n').filter(Boolean);
  ok(suivis.length >= 100, `SOCLE : assiette de ${suivis.length} fichier(s) — trop peu pour un bac`);
  for (const f of suivis) { mkdirSync(join(bac, dirname(f)), { recursive: true }); cpSync(join(RACINE, f), join(bac, f)); }
  execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

  const scene = 'core\nalphabet.western\nzorglubtemoin:1\n-----\nS -> C4\n';
  const compiler = () => {
    const src = `import { compileToBPxAST } from './src/transpiler/index.js';\n`
      + `const r = compileToBPxAST(${JSON.stringify(scene)}, {});\n`
      + `process.stdout.write(JSON.stringify((r.errors || []).map((e) => String(e.message).slice(0, 80))));\n`;
    writeFileSync(join(bac, 'sonde.mjs'), src);
    return JSON.parse(execFileSync('node', ['sonde.mjs'], { cwd: bac, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  };
  // Contre-épreuve : absent de la source, le témoin est refusé.
  const avant = compiler();
  ok(avant.length > 0 && /zorglubtemoin/.test(avant.join(' ')),
     `2-témoin. 'zorglubtemoin' doit être REFUSÉ tant que la source ne le déclare pas — reçu ${JSON.stringify(avant)}`);
  // La source reçoit le témoin ; le paquet du bac n'est PAS régénéré.
  const paquetAvant = readFileSync(join(bac, 'src/transpiler/libs-data.js'), 'utf8');
  appendFileSync(join(bac, 'lib/audio.bpsl'),
    '\ncontrol zorglubtemoin (args(value), description:"témoin de ce garde", scope(scene), section:controls)\n');
  const apres = compiler();
  ok(apres.length === 0,
     `2. une entrée ajoutée à la SOURCE doit atteindre le compilateur sans régénérer le paquet — reçu ${JSON.stringify(apres)}`);
  ok(readFileSync(join(bac, 'src/transpiler/libs-data.js'), 'utf8') === paquetAvant && !/zorglubtemoin/.test(paquetAvant),
     '2. et le paquet du bac ne doit pas avoir bougé — sinon la preuve mesurerait une régénération');
} finally {
  rmSync(bac, { recursive: true, force: true });
}

ok(passe >= 6, `le garde doit avoir EXAMINÉ (${passe} assertions)`);
if (echecs.length) {
  console.error(`[sources] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[sources] ${passe} PASS / 0 FAIL — ${passe} assertion(s) — le compilateur lit ses librairies dans leurs sources`);
