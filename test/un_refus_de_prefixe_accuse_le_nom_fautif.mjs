#!/usr/bin/env node
/**
 * GARDE — QUAND `<préfixe>.<contrôle>:…` EST REFUSÉ, LE MESSAGE ACCUSE LE NOM QUI CLOCHE.
 *
 * ⛔ D'OÙ IL VIENT. `C4(engine.seed:42)` sortait « 'engine' n'est ni un contrôle à composants, ni
 * une instance déclarée — déclarer l'instance d'abord ». Les deux moitiés étaient fausses :
 * `engine` EST une librairie invoquée, et la cause réelle est que `seed` est une directive de
 * SCÈNE — `C4(seed:42)` est refusé aussi, NU. Le préfixe n'y était pour rien, et le message
 * accusait le seul des deux noms qui n'avait rien à se reprocher. Un auteur qui le suit part
 * déclarer une instance `engine` et s'enfonce.
 *
 * ⛔ ET IL VIENT AUSSI D'UNE FAUTE DE CE GARDE-CI, TROUVÉE EN L'ÉCRIVANT. Ma première réparation
 * demandait d'abord « le composant est-il une directive de scène ? » : `zorglub.vel:80` sortait
 * alors « 'vel' est une directive de SCÈNE », deux fois faux. DIX contrôles portent `scene` dans
 * leur portée — ils sont réservés ET écrivables dans une parenthèse. L'ordre des deux questions
 * EST le geste ; le volet D ci-dessous est le témoin qui l'a montré, et il reste pour le tenir.
 *
 * LA MATRICE, ET C'EST UNE MATRICE PARCE QUE LA CONSTRUCTION A TROIS SORTIES :
 *   A. préfixe INCONNU                       → le message nomme le PRÉFIXE
 *   B. préfixe connu, contrôle absent de LUI  → le message nomme la LIBRAIRIE et le contrôle
 *   C. préfixe connu, mot de tête de scène    → le message nomme la PLACE, pas le préfixe
 *   D. ⛔ préfixe inconnu ET composant réservé-mais-écrivable → A, jamais C
 *   E. le complément : les formes JUSTES compilent, sinon ce garde certifierait un refus général
 *
 * ⚠️ CE QU'IL NE MESURE PAS : que le refus soit BIEN FORMULÉ. Il mesure QUEL NOM est accusé —
 * la seule chose qui envoie l'auteur au bon endroit ou au mauvais.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { loadLibsFromDirectives } from '../src/transpiler/libs.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const SOCLE = 'core\nmidi\naudio\nexpression\ntranspo\nvariation\nengine\ntime\n';
/** Le message de refus d'une écriture dans une parenthèse de note, ou null si elle compile. */
const refus = (ecrit) => {
  let r;
  try { r = compileToBPxAST(`${SOCLE}-----\nS -> C4(${ecrit})`); }
  catch (x) { return `EXCEPTION ${x.message}`; }
  const m = (r.errors || [])[0];
  return m ? m.message : null;
};

// ── SOCLE — sans vocabulaire chargé, ce garde examinerait le vide ────────────────────────────
const CTX = loadLibsFromDirectives(
  ['core', 'midi', 'audio', 'expression', 'transpo', 'variation', 'engine', 'time'].map((n) => ({ name: n })));
ok(CTX.controlNames.size >= 50, `SOCLE : le vocabulaire doit être chargé — ${CTX.controlNames.size} mot(s)`);
const prefixes = new Set(Object.keys(CTX.controlsQualified || {}).map((q) => q.slice(0, q.indexOf('.'))));
ok(prefixes.size >= 5, `SOCLE : des préfixes doivent exister — ${prefixes.size}`);

/** Les mots qui sont réservés SANS être des contrôles : ils ne s'écrivent qu'en tête. */
const teteSeule = [...CTX.reservedDirectiveNames].filter((n) => !CTX.controlNames.has(n));
/** ⛔ Et ceux qui sont les DEUX — le piège du volet D. */
const lesDeux = [...CTX.reservedDirectiveNames].filter((n) => CTX.controlNames.has(n));
ok(teteSeule.length > 0, 'SOCLE : au moins un mot de tête pure doit exister');
ok(lesDeux.length > 0,
  'SOCLE : au moins un mot RÉSERVÉ ET CONTRÔLE doit exister — sans lui le volet D ne distingue '
  + 'rien, et l\'ordre des deux questions du parseur redeviendrait libre');

// ── A. PRÉFIXE INCONNU — le message nomme le préfixe ─────────────────────────────────────────
for (const [ecrit, quoi] of [['zorglub.vel:80', 'vel'], ['zorglub.wave:sine', 'wave']]) {
  const m = refus(ecrit);
  ok(m !== null, `A. '${ecrit}' doit être refusé`);
  ok(m && m.includes('zorglub'), `A. le refus de '${ecrit}' doit nommer le PRÉFIXE — reçu : ${m}`);
  ok(m && !/SCENE directive/.test(m),
    `A. et NE PAS accuser '${quoi}' d'être un mot de tête : le nom fautif est le préfixe — reçu : ${m}`);
}

// ── B. PRÉFIXE CONNU, CONTRÔLE ABSENT DE CETTE LIBRAIRIE ─────────────────────────────────────
{
  const m = refus('midi.wave:sine');
  ok(m !== null, "B. 'midi.wave' doit être refusé — `wave` vit chez `audio`");
  ok(m && m.includes('midi') && m.includes('wave'),
    `B. le refus doit nommer LA LIBRAIRIE et LE CONTRÔLE — reçu : ${m}`);
  ok(m && !/instance déclarée/.test(m),
    `B. et ne pas envoyer déclarer une instance : 'midi' est une librairie — reçu : ${m}`);
  const inconnu = refus('audio.zorglub42:1');
  ok(inconnu !== null && inconnu.includes('audio'),
    `B. un contrôle inventé sous un bon préfixe nomme aussi la librairie — reçu : ${inconnu}`);
}

// ── C. PRÉFIXE CONNU, MOT DE TÊTE DE SCÈNE — le message nomme la PLACE ───────────────────────
// ⛔ SUR L'ESPACE, pas sur `seed` : tout mot de tête pure préfixé par une librairie doit sortir
// le même diagnostic. Un garde qui n'éprouverait qu'un mot ne dirait rien des autres.
{
  let vus = 0;
  const manques = [];
  for (const mot of teteSeule) {
    const m = refus(`engine.${mot}:42`);
    if (m === null) continue;                    // certains mots ne se lisent pas ainsi : hors sujet
    vus++;
    if (!/SCENE directive/.test(m)) manques.push(`${mot} → ${String(m).slice(0, 70)}`);
  }
  ok(vus >= 5, `C. le garde doit avoir éprouvé plusieurs mots de tête — ${vus} sur ${teteSeule.length}`);
  ok(manques.length === 0,
    `C. ${manques.length} mot(s) de tête préfixés ne sortent pas le diagnostic de PLACE :\n     `
    + manques.slice(0, 6).join('\n     '));
}

// ── D. ⛔ LE TÉMOIN QUI A MORDU — réservé ET contrôle, sous un préfixe inconnu ────────────────
// C'est le cas qui distingue « on regarde le préfixe d'abord » de « on regarde le composant
// d'abord ». Les deux ordres passent tous les volets ci-dessus ; seul celui-ci les sépare.
{
  let vus = 0;
  const fautifs = [];
  for (const mot of lesDeux) {
    const m = refus(`zorglub.${mot}:1`);
    if (m === null) continue;
    vus++;
    if (/SCENE directive/.test(m)) fautifs.push(mot);
    else if (!String(m).includes('zorglub')) fautifs.push(`${mot} (ne nomme pas le préfixe)`);
  }
  ok(vus >= 1, `D. le garde doit avoir éprouvé au moins un mot réservé-ET-contrôle — ${vus}`);
  ok(fautifs.length === 0,
    `D. ⛔ ${fautifs.length} mot(s) réservés-ET-contrôles font accuser la PLACE alors que le nom `
    + `fautif est le PRÉFIXE : ${fautifs.slice(0, 8).join(', ')}. L'ordre des deux questions du `
    + `parseur est inversé — le préfixe se juge AVANT le composant.`);
}

// ── E. LE COMPLÉMENT — les formes justes compilent ───────────────────────────────────────────
// Sans lui, un parseur qui refuserait TOUTE forme préfixée passerait A, B, C et D.
{
  let compilees = 0;
  const cassees = [];
  for (const qual of Object.keys(CTX.controlsQualified)) {
    const [lib, nom] = [qual.slice(0, qual.indexOf('.')), qual.slice(qual.indexOf('.') + 1)];
    const def = CTX.controlsQualified[qual];
    if (!Array.isArray(def.scope) || !def.scope.includes('symbol')) continue;
    // ⚠️ UNE CLÉ SANS ARGUMENT S'ÉCRIT NUE, et lui coller une valeur fabrique un refus qui n'a
    // rien à voir avec le préfixe. Mesuré en écrivant ce volet : 27 contrôles continus
    // (`modcont`, `pancont`…) sortaient « ne prend AUCUN argument » et se comptaient comme des
    // formes préfixées cassées. L'instrument était fautif, pas le sujet.
    const sansArgument = Array.isArray(def.args) && def.args.length === 0;
    const v = Array.isArray(def.values) && def.values.length ? def.values[0]
      : (Array.isArray(def.range) && def.range.length === 2 ? def.range[0] : 1);
    const m = refus(sansArgument ? `${lib}.${nom}` : `${lib}.${nom}:${v}`);
    if (m === null) compilees++; else cassees.push(`${qual} → ${String(m).slice(0, 60)}`);
  }
  ok(compilees >= 40, `E. les formes préfixées JUSTES doivent compiler — ${compilees} vue(s)`);
  ok(cassees.length === 0,
    `E. ${cassees.length} forme(s) préfixée(s) légitime(s) sont refusées :\n     `
    + cassees.slice(0, 6).join('\n     '));
}

const ATTENDU = 4 + 6 + 4 + 2 + 2 + 2;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[préfixe] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[préfixe] ${p} PASS / 0 FAIL — ${p} assertion(s), ${prefixes.size} préfixe(s), `
          + `${teteSeule.length} mot(s) de tête pure, ${lesDeux.length} réservé(s)-ET-contrôle(s)`);
