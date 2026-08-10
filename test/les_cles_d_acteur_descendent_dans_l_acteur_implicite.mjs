#!/usr/bin/env node
/**
 * LES CINQ CLÉS D'ACTEUR DESCENDENT DANS L'ACTEUR IMPLICITE.
 *
 * ⚠️ LA DEMANDE, MOT POUR MOT (Romain, 2026-08-07) : « toutes ces directives doivent descendre dans
 * l'acteur implicite créé dans l'arbre quand il n'y a pas d'acteur dans la scène ». Le principe
 * était déjà ratifié et daté — `docs/design/SCENE_DEFAULTS_CASCADE.md` (2026-07-04), « tout ce
 * qu'une scène peut définir a un défaut » — mais son étape 2, « étendre aux autres axes », n'avait
 * jamais été faite pour deux des cinq.
 *
 * ÉTAT MESURÉ AVANT (2026-08-07), et les deux manques n'étaient pas de même nature :
 *   · `alphabet`, `tuning`, `octaves` descendaient ;
 *   · `eval` ne descendait PAS DU TOUT — `@eval.strudel` était lu par le validateur et par
 *     personne d'autre ;
 *   · `out` descendait avec la MAUVAISE VALEUR — l'acteur recevait toujours `audio`, le défaut du
 *     socle, en ignorant ce que la scène écrivait.
 *
 * ⚠️ ET LE SECOND EST LE PIRE DES DEUX, c'est pour ça qu'il a survécu. Une clé absente se voit ;
 * une clé PRÉSENTE ET FAUSSE a exactement la même tête qu'une clé juste. Aucun consommateur ne
 * pouvait distinguer « la scène n'a rien dit » de « la scène a dit midi et je l'ai jeté ». C'est
 * le mode d'échec MUET — rien ne manque, donc rien ne peut le signaler.
 *
 * ⚠️ IL ÉTAIT DOUBLEMENT INVISIBLE : `@out` était REFUSÉ au parse depuis le 2026-08-04, par un
 * fail-loud que j'avais posé moi-même en invoquant une décision qui ne dit pas ça. On ne mesure
 * pas la descente d'une directive qu'on interdit d'écrire — le refus cachait le trou.
 *
 * LES QUATRE VOLETS :
 *   A. MATRICE — chaque clé écrite en défaut de scène arrive sur l'acteur implicite ;
 *   B. LA VALEUR ÉCRITE, pas un défaut — sans ça, `out` serait passé vert pendant trois jours ;
 *   C. LES PARAMÈTRES SUIVENT (`@out.midi(ch:1)`) et les deux écritures d'une sortie qui se
 *      contredisent REFUSENT ;
 *   D. TÉMOIN DES DEUX SENS — sans directive, la clé prend le défaut du socle et n'est pas vide.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { loadLib } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// LA LISTE VIENT DE LA DONNÉE, JAMAIS D'ICI — `lib/core.json`, `schema.actorKeys`. Une sixième clé
// déclarée demain est testée par ce garde sans qu'on y pense ; le socle du volet D échoue si la
// liste maigrit.
const CLES = (loadLib('core')?.schema?.actorKeys) || [];

const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');
/** L'acteur implicite : l'unique acteur de l'arbre quand la scène n'en déclare aucun. */
const acteurImplicite = (r) => (r.ast && r.ast.actors && r.ast.actors[0]) || null;

// Ce que chaque clé écrit dans la scène, et où elle atterrit sur l'acteur.
// ⚠️ `out` atterrit sur `properties.transport` : le mot ÉCRIT a changé le 2026-08-04, le CHAMP
// interne non. Cette asymétrie est déclarée ici plutôt que découverte par un lecteur.
const OU = {
  alphabet: { ecrit: '@alphabet.sargam',        champ: 'alphabet',  categorie: 'alphabet', attendu: 'sargam' },
  tuning:   { ecrit: '@tuning.sargam_22shruti', champ: 'tuning',    categorie: 'tuning',   attendu: 'sargam_22shruti' },
  octaves:  { ecrit: '@octaves.saptak',         champ: 'octaves',   categorie: 'octaves',  attendu: 'saptak' },
  out:      { ecrit: '@out.midi',               champ: 'transport', categorie: 'transport', attendu: 'midi' },
  eval:     { ecrit: '@eval.strudel',           champ: 'eval',      categorie: 'eval',     attendu: 'strudel' },
};
/** La valeur portée par la propriété, quelle que soit sa forme (chaîne ou référence). */
const valeurDe = (props, champ) => {
  const v = props ? props[champ] : undefined;
  return (v && typeof v === 'object') ? v.key : v;
};

// ── A + B. MATRICE : chaque clé descend, ET c'est la valeur ÉCRITE qui descend ─────────────────
let cellules = 0;
for (const cle of CLES) {
  const q = OU[cle];
  ok(!!q, `A. la clé '${cle}' est déclarée dans lib/core.json mais ce garde ne sait pas où elle `
        + `atterrit — une clé ajoutée sans son point de chute n'est pas mesurée, elle est ignorée.`);
  if (!q) continue;
  cellules++;
  // La scène pose toujours l'alphabet (sans lui rien ne résout), puis la clé mesurée.
  const src = '@core\n@alphabet.sargam\n'
            + (cle === 'alphabet' ? '' : `${q.ecrit}\n`) + 'S -> sa\n';
  const r = compiler(src);
  const msg = messages(r);
  ok(msg === '', `A. '${q.ecrit}' est REFUSÉ en défaut de scène : ${msg.replace(/\s+/g, ' ').slice(0, 100)}`);
  if (msg) continue;
  const acteur = acteurImplicite(r);
  ok(acteur !== null, `A. aucun acteur implicite n'est fabriqué alors que la scène n'en déclare aucun.`);
  if (!acteur) continue;
  // A — la clé est là.
  ok(valeurDe(acteur.properties, q.champ) != null,
     `A. '${q.ecrit}' ne descend pas : l'acteur implicite n'a rien sur '${q.champ}'. La scène l'a `
     + `écrit, l'arbre l'a perdu — le consommateur devra le deviner.`);
  // B — c'est la valeur ÉCRITE, pas un défaut.
  ok(valeurDe(acteur.properties, q.champ) === q.attendu,
     `B. '${q.ecrit}' descend avec la MAUVAISE valeur : '${valeurDe(acteur.properties, q.champ)}' `
     + `au lieu de '${q.attendu}'. Une clé présente et fausse a la même tête qu'une clé juste — `
     + `c'est exactement ce que faisait 'out' jusqu'au 2026-08-07.`);
  // B — et elle est aussi dans les références, la forme que le consommateur lit.
  const refs = (acteur.references || []).filter((x) => x.category === q.categorie).map((x) => x.name);
  ok(refs.includes(q.attendu),
     `B. '${q.ecrit}' n'apparaît pas dans les références de l'acteur (catégorie '${q.categorie}' : `
     + `${refs.join(',') || '—'}). C'est la forme canonique que BPx lit — une propriété sans sa `
     + `référence n'est lue par personne.`);
}

// ── C. LES PARAMÈTRES SUIVENT, ET DEUX SORTIES QUI SE CONTREDISENT REFUSENT ────────────────────
{
  const r = compiler('@core\n@alphabet.sargam\n@out.midi(ch:1)\nS -> sa\n');
  ok(messages(r) === '', `C. '@out.midi(ch:1)' est refusé : ${messages(r).slice(0, 100)}`);
  const t = acteurImplicite(r)?.properties?.transport;
  ok(t && t.params && t.params.ch === 1,
     `C. les paramètres de '@out.midi(ch:1)' ne descendent pas : ${JSON.stringify(t)}. La clé les `
     + `porte sous un '@actor' ; elle doit les porter partout où elle s'écrit.`);
}
{
  // Les deux écritures d'une sortie disent la MÊME chose — si elles se contredisent, on refuse en
  // les nommant, plutôt que d'en élire une en silence.
  const r = compiler('@core\n@alphabet.sargam:audio\n@out.midi\nS -> sa\n');
  ok(/deux sorties pour la même scène/.test(messages(r)),
     `C. '@alphabet.sargam:audio' + '@out.midi' désignent deux canaux différents et l'arbre en `
     + `choisit un SANS RIEN DIRE (${messages(r).slice(0, 80) || 'aucune erreur'}).`);
}

// ── D. TÉMOIN DES DEUX SENS — sans directive, la clé n'est pas vide, elle prend le socle ───────
// ⚠️ SANS CE VOLET, LE GARDE NE PROUVERAIT QUE LA MOITIÉ. Un arbre qui recopierait aveuglément
// tout ce qu'on lui écrit passerait A, B et C ; ce qui le démasque, c'est le cas où la scène
// n'écrit RIEN et où la clé doit quand même valoir quelque chose (`SCENE_DEFAULTS_CASCADE.md` :
// « un paramètre définissable n'est jamais inexistant »).
{
  const r = compiler('@core\n@alphabet.sargam\nS -> sa\n');
  ok(messages(r) === '', `D. la scène minimale ne compile pas : ${messages(r).slice(0, 90)}`);
  const p = acteurImplicite(r)?.properties;
  const socle = loadLib('core')?.defaults?.components?.transport;
  ok(valeurDe(p, 'transport') === socle,
     `D-témoin. sans '@out', la sortie devrait valoir le défaut du socle ('${socle}') et vaut `
     + `'${valeurDe(p, 'transport')}'. Une cascade qui ne rend rien quand la scène se tait n'est `
     + `pas une cascade, c'est une recopie.`);
  ok(valeurDe(p, 'alphabet') === 'sargam',
     `D-témoin. l'alphabet écrit ne descend plus — le témoin lui-même ne mesure plus rien.`);
}

// ── SOCLE — la matrice ne se vide pas en silence ───────────────────────────────────────────────
ok(CLES.length >= 5 && cellules === CLES.length,
   `SOCLE : ${cellules} clé(s) mesurée(s) sur ${CLES.length} déclarée(s) dans lib/core.json — sous `
   + `cinq, ce n'est pas que le langage a maigri, c'est que le garde ne lit plus la liste.`);

if (echecs.length) {
  console.error(`❌ les clés d'acteur ne descendent pas : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ les ${cellules} clés d'acteur descendent dans l'acteur implicite — ${passe} `
          + `vérification(s) : chacune arrive avec la valeur ÉCRITE (propriété ET référence), les `
          + `paramètres suivent, deux sorties contradictoires refusent, et sans directive la `
          + `sortie prend le défaut du socle.`);
