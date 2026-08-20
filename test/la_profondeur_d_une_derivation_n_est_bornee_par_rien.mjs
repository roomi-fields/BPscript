#!/usr/bin/env node
/**
 * GARDE — UN ARBRE DE DÉRIVATION N'A PAS DE FOND, ET CE QUI N'EST PAS UN TYPE N'EN OUVRE PAS.
 *
 * ⛔ LA FAUTE QU'IL TIENT. Le registre des prototypes n'accueillait que ce qu'`object` déclare, donc
 * un arbre s'arrêtait à DEUX étages en silence : `object scale (…)` puis `scale interval (…)`
 * passaient, et `interval ionian (…)` était refusé sur une erreur de syntaxe qui ne nommait pas la
 * cause. Or `interval` EST un nom déclaré par un type — il dérive au même titre que le premier.
 *
 * ⚠️ POURQUOI C'EST GRAVE ET PAS SEULEMENT GÊNANT. Limiter la profondeur depuis le parseur revient à
 * décider de la modélisation à la place de qui écrit la librairie. La forme validée le 2026-08-20
 * demande trois étages pour les gammes ; une autre en demandera quatre. Le prototypal pur ne borne
 * rien, et un parseur qui borne impose une forme sans le dire.
 *
 * ⛔ ET LA FAUTE EST REVENUE UNE FOIS. Cette réparation avait été frappée une première fois puis
 * PERDUE — elle vivait dans un arbre de travail non enregistré, et un retour à l'état publié l'a
 * emportée avec le reste. Ce garde est ce qui manquait pour que sa disparition se voie.
 *
 * LA MATRICE DIT AUSSI CE QUI N'OUVRE PAS DE DÉRIVATION, parce qu'une règle sans son complément
 * laisse ouvert tout ce qu'elle n'a pas nommé : une CONVENTION et un DRAPEAU déclarent un nom sans
 * en faire un prototype, et un mot que rien ne déclare reste refusé.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const passe = (src) => {
  try { return (compileToBPxAST(src).errors || []).length === 0; }
  catch { return false; }
};

// ── A. LA PROFONDEUR — trois étages, puis quatre, puis cinq ──────────────────────────────────────
const RACINE = 'object scale (description)\nscale interval (ratios)\n';
ok(passe('object scale (description)'), 'A. 1 étage — un prototype racine');
ok(passe(`${RACINE}`), 'A. 2 étages — un prototype qui dérive du premier');
ok(passe(`${RACINE}interval ionian (ratios(1, 2))`), 'A. ⛔ 3 étages — un exemplaire du prototype dérivé, la forme validée');
ok(passe(`${RACINE}interval fragment (ratios)\nfragment jins (ratios(1))`), 'A. 4 étages');
ok(passe('object a (x)\na b (x)\nb c (x)\nc d (x)\nd e (x:1)'), 'A. 5 étages — rien ne borne');

// ── B. UN EXEMPLAIRE DÉRIVE AUSSI — le prototypal ne distingue pas modèle et instance ────────────
ok(passe('object a (x)\na b (x:1)\nb c (x:1)'), "B. un exemplaire QUI PORTE UNE VALEUR sert de prototype à son tour");

// ── C. ⛔ LE COMPLÉMENT — ce qui déclare un nom SANS ouvrir de dérivation ─────────────────────────
// ⚠️ LA CONVENTION S'ÉCRIT NUE : `signal ondes (x)` est refusé À LA DÉCLARATION — une convention ne
// porte pas de corps. Ma première écriture testait donc ce refus-là en croyant tester la dérivation,
// et elle restait verte sous l'injection qui ouvre le registre à tout. Une assertion qui passe pour
// une autre raison que la sienne est un garde absent qui s'ignore.
ok(passe('signal ondes'), "C. la convention se déclare NUE — sans quoi l'assertion suivante ne teste pas ce qu'elle dit");
ok(!passe('signal ondes\nondes truc (x:1)'), "C. une CONVENTION déclare un nom sans en faire un prototype");
ok(!passe('flag etat (a:1)\netat truc (x:1)'), "C. un DRAPEAU non plus — il déclare des états, pas un modèle");
ok(passe('control vel2 (x)\nvel2 truc (x:1)'), "C. mais tout TYPE en ouvre une, pas seulement `object`");

// ── D. TÉMOINS — le mécanisme ne s'ouvre pas à n'importe quel mot, ni à n'importe quel ordre ─────
ok(!passe('zorglubinvente truc (x:1)'), "D. TÉMOIN — un mot qui ne désigne rien reste refusé");
ok(!passe('object scale (description)\ninconnu ionian (x:1)'), "D. TÉMOIN — un nom que rien n'a déclaré reste refusé");
ok(!passe('a b (x:1)\nobject a (x)'), "D. l'ORDRE tient — le registre se remplit à la lecture, pas à la fin");

const ATTENDU = 13;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[profondeur] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[profondeur] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
