#!/usr/bin/env node
/**
 * GARDE — UNE DÉCLARATION SE PLIE SUR PLUSIEURS LIGNES, ET LE PLI N'ENTRE PAS DANS LA DONNÉE.
 *
 * Décision de Romain (2026-08-19) : dans la partie déclarative, seule la virgule sépare ; l'espace
 * et l'indentation sont de la mise en forme. Le retour à la ligne aussi(Romain, 2026-09-03 : « j'espère
 * que tu supportes qu'on ajoute des retours à la ligne pour plus de lisibilité »). Mesuré avant ce
 * garde : `pan:64` suivi de la parenthèse fermante sur sa propre ligne rendait la chaîne « 64\n ».
 *
 * LA MATRICE — où le pli se pose × ce qu'il doit rendre :
 *   après la parenthèse ouvrante · après une virgule · avant la parenthèse fermante · dans un sac
 *   imbriqué · avec un commentaire en fin de ligne → la MÊME donnée que la forme sur une ligne ;
 *   entre deux parties SANS virgule → REFUS qui nomme la virgule (le pli vaut une espace, jamais
 *   un séparateur).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const TETE = 'core\nalphabet.simple\n';
const membres = (decl) => {
  const r = compileToBPxAST(`${TETE}${decl}\n-----\nS -> a\n`, {});
  if (!r.ast) return { erreurs: (r.errors || []).map((e) => e.message) };
  const v = (r.ast.vars || [])[0];
  const lire = (sac) => Object.fromEntries((sac && sac.pairs ? sac.pairs : []).map((p) => [p.key, p.value && p.value.type === 'SettingBag' ? lire(p.value) : p.value]));
  return { erreurs: (r.errors || []).map((e) => e.message), membres: v ? lire(v.settings) : null };
};

const REFERENCE = membres('sound metro(vel:120, pan:64, description:"x")');
ok(REFERENCE.erreurs.length === 0 && REFERENCE.membres && REFERENCE.membres.pan === 64 && REFERENCE.membres.description === 'x',
   `TÉMOIN : la forme sur une ligne rend ses membres — reçu ${JSON.stringify(REFERENCE)}`);

// ── 1. la même donnée, quel que soit le pli ────────────────────────────────────────────────────
for (const [ou, decl] of [
  ['après la parenthèse ouvrante',   'sound metro(\n  vel:120, pan:64, description:"x")'],
  ['après une virgule',              'sound metro(vel:120,\n  pan:64,\n  description:"x")'],
  ['avant la parenthèse fermante',   'sound metro(vel:120, pan:64, description:"x"\n)'],
  ['partout',                        'sound metro(\n  vel:120,\n  pan:64,\n  description:"x"\n)'],
  ['avec un commentaire en fin de ligne', 'sound metro(vel:120,   // la vélocité\n  pan:64,          // le panoramique\n  description:"x")'],
]) {
  const r = membres(decl);
  ok(r.erreurs.length === 0 && JSON.stringify(r.membres) === JSON.stringify(REFERENCE.membres),
     `1. pli ${ou} : la même donnée que sur une ligne — reçu ${JSON.stringify(r)}`);
}

// ── 2. un sac imbriqué se plie aussi ───────────────────────────────────────────────────────────
{
  const ligne = membres('def truc(range(min:16, max:8000), description:"x")');
  const plie = membres('def truc(\n  range(\n    min:16,\n    max:8000\n  ),\n  description:"x"\n)');
  ok(ligne.erreurs.length === 0 && plie.erreurs.length === 0 && JSON.stringify(plie.membres) === JSON.stringify(ligne.membres),
     `2. un sac imbriqué plié rend la même donnée — reçu ${JSON.stringify(plie)} contre ${JSON.stringify(ligne)}`);
}

// ── 3. le complément : le pli n'est pas un séparateur ──────────────────────────────────────────
{
  const r = membres('sound metro(vel:120\n  pan:64)');
  ok(r.erreurs.length > 0 && r.erreurs.some((m) => /COMMA|comma separates|only ONE value/.test(m)),
     `3. deux membres séparés par un pli SANS virgule sont refusés en nommant la virgule — reçu ${JSON.stringify(r.erreurs)}`);
}

ok(passe >= 8, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[déclaration pliée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[déclaration pliée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
