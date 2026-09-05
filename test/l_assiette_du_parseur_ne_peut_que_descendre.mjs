#!/usr/bin/env node
/**
 * ENFORCEMENT DE LA MIGRATION — DEUX ASSIETTES QUI NE PEUVENT QUE DESCENDRE.
 *
 * Décision de Romain, 2026-08-24 : le compilateur a quatre étages et un seul canal de refus
 * (`decisions/2026-08-24-le-compilateur-a-quatre-etages-et-un-seul-canal-de-refus.md`). Le parseur
 * **ne connaît rien du vocabulaire** ; l'étage de résolution reçoit les refus qui parlent d'un nom.
 *
 * ⛔ CE GARDE SE POSE AVANT LE PREMIER DÉPLACEMENT, ET C'EST TOUTE SA FONCTION. La migration est un
 * déplacement refus par refus, sans voie parallèle. Sans plafond asserté, rien ne distingue « la
 * migration avance » de « la migration recule » : les deux laissent le portillon vert, et un refus
 * de nom RAJOUTÉ au parseur pendant le chantier ne rougirait nulle part.
 *
 * ⚠️ CE QU'IL MESURE EST UN PLAFOND, PAS UNE CIBLE. Il refuse la HAUSSE. Une baisse est le travail
 * qui avance : elle demande de rescellier le plancher ici, en nommant ce qui a été déplacé.
 *
 * ⛔ ET IL LIT LES CODES, PAS LA PROSE — parce que c'est ce que le code ÉCRIT. Les refus portent un
 * code (`PARSE_FLOW_WORD_UNDECLARED`) et leur prose vit ailleurs, dans le catalogue des diagnostics.
 * Un relevé écrit sur la prose a rendu 5 refus de nom là où il y en a 8 : il cherchait des mots
 * anglais dans des identifiants en capitales. *Un garde se prouve sur la graphie que le code écrit,
 * jamais sur celle qu'on croit qu'il écrit.*
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '..', 'src', 'transpiler');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Les fonctions que le parseur importe du chargeur de librairies. */
export function importsDuChargeur(texte) {
  const noms = new Set();
  for (const m of texte.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'\.\/libs\.js'/gm)) {
    for (const n of m[1].split(',')) { const s = n.trim(); if (s) noms.add(s.split(/\s+as\s+/)[0].trim()); }
  }
  return [...noms];
}

/** Les arrêts immédiats d'un fichier, et ceux dont le CODE parle d'un nom. */
export function arretsImmediats(texte) {
  const arrets = [...texte.matchAll(/throw new (?:ParseError|Error)\(([\s\S]*?)\);/g)].map((m) => m[1]);
  const codes = [];
  for (const a of arrets) for (const c of a.matchAll(/'([A-Z][A-Z0-9_]{4,})'/g)) codes.push(c[1]);
  const PARLE_DUN_NOM = /UNKNOWN|UNDECLARED|NOT_DECLARED|NO_DEFINITION|UNDEFINED|NEITHER|NOT_IN_SCOPE|MISSING/;
  return { total: arrets.length, codes, deNom: codes.filter((c) => PARLE_DUN_NOM.test(c)) };
}

const parseur = readFileSync(path.join(SRC, 'parser.js'), 'utf-8');

// ── SOCLE — un fichier qu'on n'a pas lu rend zéro partout, et zéro passe les deux plafonds ────
ok(parseur.length > 100000, `SOCLE : parser.js fait ${parseur.length} octets — un périmètre qui fond ne prouve rien`);

// ── ASSIETTE 1 — le parseur ne connaît rien du vocabulaire ────────────────────────────────────
// 13 le 2026-08-24 · 7 le 2026-09-05, après la refonte du langage. Zéro à terme.
const PLAFOND_IMPORTS = 7;
const imports = importsDuChargeur(parseur);
ok(imports.length > 0, `SOCLE : aucun import du chargeur trouvé dans parser.js — le lecteur est aveugle, `
  + `pas le parseur innocent. La graphie de l'import a changé.`);
ok(imports.length <= PLAFOND_IMPORTS,
   `ASSIETTE 1 — le parseur importe ${imports.length} fonction(s) du chargeur, plafond ${PLAFOND_IMPORTS}. `
 + `Le parseur ne doit RIEN connaître du vocabulaire : ce compte ne peut que descendre. `
 + `Vues : ${imports.join(', ')}`);

// ── ASSIETTE 2 — les refus qui parlent d'un NOM vivent à l'étage de résolution ─────────────────
// 46 le 2026-08-24 · 8 le 2026-09-05 · 7 le même jour, quand `PARSE_SCAN_UNKNOWN_VALUE_EXPECTED`
// est SORTI. ⛔ Il n'a pas été déplacé : il était DOUBLÉ. Mesuré par amputation — le refus du
// parseur retiré, `(scan:zzinconnu)` reste refusé par `validateControls`, qui nomme la valeur, le
// contrôle et les valeurs permises. Son message est parti du catalogue dans le même geste : un
// message sans producteur enseigne un refus qui n'existe plus.
// ⇒ 6 le 2026-09-05, quand `PARSE_UNKNOWN_KEY_KEY_NEITHER` a été DÉPLACÉ — celui-là n'était pas
// doublé : amputé, `[zzcle:1]` en fin de règle n'était plus refusé du tout. Il vit désormais dans
// `refuserCleDeCrochetInconnue` (resolution.js), garde son code et son message, et COLLECTE avec
// les autres : « un nom inconnu ET une clé inconnue » rend maintenant 2 erreurs au lieu d'1.
const PLAFOND_REFUS_DE_NOM = 6;
const { total, codes, deNom } = arretsImmediats(parseur);
ok(codes.length > 50, `SOCLE : ${codes.length} code(s) de refus lus dans parser.js — sous ce seuil, le `
  + `garde est vert parce qu'il ne voit plus les refus, pas parce qu'ils ont migré.`);
ok(deNom.length <= PLAFOND_REFUS_DE_NOM,
   `ASSIETTE 2 — ${deNom.length} refus du parseur parlent d'un NOM, plafond ${PLAFOND_REFUS_DE_NOM}. `
 + `Un refus de nom appartient à l'étage de résolution : ce compte ne peut que descendre. `
 + `Vus : ${[...new Set(deNom)].sort().join(', ')}`);

// ── LE JUGE SE PROUVE SUR CE QU'IL DOIT VOIR ET SUR CE QU'IL DOIT LAISSER ──────────────────────
ok(importsDuChargeur("import { a, b as c } from './libs.js';").join() === 'a,b',
   `le juge ne lit pas un import à deux noms dont un aliasé`);
ok(importsDuChargeur("import { x } from './vocabulaire.js';").length === 0,
   `le juge accuse un import qui ne vient PAS du chargeur`);
{
  const t = arretsImmediats("throw new ParseError('PARSE_FLOW_WORD_UNDECLARED', { nom }, tok);\n"
                          + "throw new ParseError('PARSE_BAG_MALFORMED', { x }, tok);");
  ok(t.total === 2, `le juge compte ${t.total} arrêt(s) au lieu de 2`);
  ok(t.deNom.length === 1 && t.deNom[0] === 'PARSE_FLOW_WORD_UNDECLARED',
     `le juge ne distingue pas un refus de NOM d'un refus de FORME — vu : ${t.deNom.join(', ')}`);
}
// Et il ne se laisse pas berner par la prose : un code sans mot-clé de nom n'en est pas un.
ok(arretsImmediats("throw new ParseError('PARSE_BAG_MALFORMED', { }, tok); // unknown attribute").deNom.length === 0,
   `le juge compte un refus de nom sur un COMMENTAIRE qui parle d'un nom inconnu`);

if (echecs.length) {
  console.error(`[assiette du parseur] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[assiette du parseur] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · `
  + `${imports.length}/${PLAFOND_IMPORTS} import(s) du chargeur · ${deNom.length}/${PLAFOND_REFUS_DE_NOM} refus de nom `
  + `sur ${total} arrêt(s) immédiat(s) examinés dans parser.js`);
