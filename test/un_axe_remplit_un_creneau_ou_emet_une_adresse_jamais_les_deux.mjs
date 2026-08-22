#!/usr/bin/env node
/**
 * UN AXE REMPLIT UN CRÉNEAU **OU** ÉMET UNE ADRESSE — JAMAIS LES DEUX.
 *
 * ARBITRAGE DE L'ARCHITECTE, 2026-08-22, sur mesure de Kairos. C'est un contrat entre dépôts : le
 * même refus vit chez lui.
 *
 * ⛔ CETTE RÈGLE N'A JAMAIS ÉTÉ ÉCRITE, ET ELLE A SURVÉCU PAR ACCIDENT. Une liste d'exclusion
 * (`bpxAst.js`, `axesHauteur`) datait du 2026-07-26 ; le mot `temperament` est né le 2026-08-10,
 * quinze jours plus tard, et n'y figure donc pas. Il se trouve qu'il n'a aucun créneau à remplir —
 * la règle tient chez lui, sans que personne l'ait voulu. Le prochain axe ajouté jouerait au même
 * tirage. Nommer ce qui est n'est pas choisir : c'est fermer le tirage.
 *
 * ⛔ CE QUI M'A FAIT CONCLURE FAUX LA PREMIÈRE FOIS, ET C'EST LE CŒUR DE LA MÉTHODE ICI. J'avais
 * mesuré « `temperament.12TET` émet une adresse ET remplit `properties.tuning` », donc « les deux
 * ne s'excluent pas ». Faux : mon socle portait `alphabet.western` à côté, et `western` déclare
 * `tuning: "western_12TET"` dans le catalogue. Je lisais LA CASCADE DE DÉFAUTS et je l'attribuais
 * au tempérament. Conclure sur ce qui s'affiche à côté n'est pas mesurer qui l'écrit.
 *
 * D'où le TÉMOIN DIFFÉRENTIEL de ce garde : chaque axe est compilé DEUX FOIS, avec et sans son
 * invocation, et seul ce qui APPARAÎT ou CHANGE entre les deux lui est imputé. Un champ que la
 * cascade pose de toute façon ne compte pour personne.
 *
 * ⚠️ ET IL PORTE SON TROU PLUTÔT QUE DE CONCLURE EN SILENCE : un axe dont aucune entrée ne compile
 * n'est pas mesurable, et le garde le NOMME.
 *
 * ⛔ LE TROU QU'ON M'AVAIT ANNONCÉ N'EXISTE PAS, ET C'EST MON ENTRÉE INVENTÉE QUI L'AVAIT CRÉÉ.
 * `scale` était réputé non mesurable, « refusé à la compilation, entrée absente du catalogue ». Je
 * l'avais mesuré sur `scale.major` — un nom que j'avais écrit de mémoire. Le catalogue en porte 185,
 * dont `maqam_sikah` : 24 sur 24 essayées compilent. L'axe n'émet aucune adresse et ne remplit aucun
 * créneau — un TROISIÈME état, qui ne viole pas la règle et qu'aucun des deux camps n'avait vu.
 * Une entrée inventée ne mesure pas l'axe, elle mesure l'invention.
 *
 * ⛔ LES AXES VIENNENT DE LA DONNÉE, pas d'une liste écrite ici — et pas non plus de
 * `core.schema.catalogAxes`, qui en compte six et ne porte PAS `temperament` alors qu'il s'invoque.
 * La source est le champ `resolves` des librairies : ce qu'un fichier déclare est ce qu'une scène
 * peut écrire. Un axe neuf entre dans cette matrice sans qu'une ligne d'ici bouge.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** axe déclaré → les fichiers qui le servent. */
const fichiersDuMot = new Map();
for (const [f, l] of Object.entries(LIBS)) {
  const m = l && typeof l === 'object' ? l.resolves : null;
  if (!m) continue;
  if (!fichiersDuMot.has(m)) fichiersDuMot.set(m, []);
  fichiersDuMot.get(m).push(f);
}

/** Les entrées qu'un axe propose, dans l'ordre où ses fichiers les servent. */
function entreesDeLAxe(axe) {
  const out = [];
  for (const f of fichiersDuMot.get(axe) || []) {
    const lib = LIBS[f];
    const coll = (lib && (lib.alphabets || lib.tables || lib.objects)) || lib || {};
    for (const k of Object.keys(coll)) {
      if (['resolves', 'resolvedBy', 'name', 'description', 'version', 'schema', 'defaults'].includes(k)) continue;
      if (k.startsWith('_')) continue;
      if (coll[k] && typeof coll[k] === 'object') out.push(k);
    }
  }
  return out;
}

/** Tous les chemins de l'arbre dont la CLÉ porte ce nom, avec leur valeur scalaire. */
function champs(o, nom, chemin = '', out = []) {
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o)) {
    const ici = chemin ? `${chemin}.${k}` : k;
    if (k === nom && (typeof v === 'string' || typeof v === 'number')) out.push(`${ici}=${v}`);
    if (v && typeof v === 'object') champs(v, nom, ici, out);
  }
  return out;
}

/** Toutes les adresses émises par un arbre — acteurs et scène. */
function adresses(ast) {
  const out = [...(ast.libRefs || [])];
  for (const a of ast.actors || []) out.push(...(a.libRefs || []));
  return out.map(String);
}

const compiler = (lignes) => {
  try {
    const r = compileToBPxAST(`core\n${lignes}-----\nS -> -\n`, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', ast: r.ast };
  } catch (e) { return { ok: false, err: e.message, ast: null }; }
};

/**
 * VIOLATIONS CONNUES — inscrites avec leur cause et ce qu'elles attendent.
 *
 * ⛔ MÊME PATRON QUE LE REGISTRE DES REFUS DU CORPUS, ET POUR LA MÊME RAISON : une entrée qui cesse
 * de violer fait ROUGIR ce garde, qui exige alors qu'on la retire à la main. Un cliquet qui ne se
 * desserre jamais certifie un état disparu.
 */
const CONNUES = [
  // Mesuré le 2026-08-22, dès la première exécution de ce garde : `eval.strudel` émet l'adresse
  // `eval.strudel` ET pose `actors[].properties.eval = 'strudel'`. Sans l'invocation, le champ
  // n'existe nulle part — ce n'est donc pas la cascade, c'est bien l'axe qui écrit les deux.
  // CE QUE ÇA ATTEND : le choix appartient à l'architecte, pas à moi. Retirer l'ardoise (comme
  // `alphabet` le fait déjà quand il émet une adresse) ou retirer l'adresse change ce que l'aval
  // reçoit — c'est une frontière, et elle se préavise.
  ['eval', 'émet une adresse ET pose properties.eval — frontière, arbitrage demandé le 2026-08-22'],
];
const attendues = new Map(CONNUES);

// ── LA MATRICE — chaque INVOCATION, avec son témoin différentiel ──────────────────────────────
// ⛔ PAR INVOCATION, PAS PAR AXE, et c'est `alphabet` qui l'impose : son entrée du catalogue de
// référence remplit un créneau, celle d'un second fichier émet une adresse ET voit son ardoise
// RETIRÉE. L'invariant est tenu à chaque invocation, jamais au niveau de l'axe.
//
// ⚠️ ET TOUTES LES ENTRÉES SE MESURENT, PAS LA PREMIÈRE : mon premier jet gardait la première qui
// compile, et pour `tuning` comme pour `alphabet` c'était l'entrée par DÉFAUT — le champ ne bougeait
// donc pas et le garde concluait « aucun créneau ». Deux faux négatifs, sur les deux axes mêmes qui
// motivaient la règle. Une entrée choisie par commodité mesure la commodité.
// ⛔ ET CHAQUE AXE SE MESURE DANS DEUX CONTEXTES, PAS UN. Mon premier jet n'écrivait qu'une seule
// invocation par scène — or le cas qui m'a trompé en portait DEUX : `alphabet.western` posait
// `properties.tuning` par cascade, et j'attribuais ce champ au `temperament.12TET` écrit à côté.
// Une scène réelle porte plusieurs directives ; un garde qui n'en écrit qu'une ne reproduit jamais
// la seule situation où le témoin différentiel a quelque chose à filtrer.
// ⚠️ MESURÉ, PAS SUPPOSÉ : avec un seul axe par scène, désarmer le témoin différentiel ne faisait
// rougir personne — l'injection ne mordait pas parce qu'aucun cas ne l'exerçait.
const CONTEXTES = [
  ['seul', ''],
  ['avec un alphabet', 'alphabet.western\n'],
];
const mesures = [];
const nonMesurables = [];
for (const axe of [...fichiersDuMot.keys()].sort()) {
  const entrees = entreesDeLAxe(axe);
  let compileAuMoinsUne = false, dernierRefus = '';
  for (const [nomCtx, ctx] of CONTEXTES) {
    // LE TÉMOIN EST LA MÊME SCÈNE MOINS L'INVOCATION TESTÉE — pas une scène vide. Ce que le
    // contexte pose de toute façon apparaît des deux côtés et n'est imputé à personne.
    const temoin = compiler(ctx);
    if (!temoin.ok) continue;
    const sans = champs(temoin.ast, axe).sort().join(' | ');
    for (const e of entrees.slice(0, 24)) {
      const r = compiler(`${ctx}${axe}.${e}\n`);
      if (!r.ok) { dernierRefus = r.err; continue; }
      compileAuMoinsUne = true;

      const avec = champs(r.ast, axe).sort().join(' | ');
      const creneau = avec !== sans && avec !== '';
      const adresse = adresses(r.ast).some((a) => a.split('.')[0] === axe);

      mesures.push({ axe, entree: e, contexte: nomCtx, creneau, adresse, avec });
      if (creneau && adresse && attendues.has(axe)) continue;   // inscrite, cf. CONNUES
      ok(!(creneau && adresse),
         `⛔ '${axe}.${e}' (${nomCtx}) fait LES DEUX — il émet une adresse ET remplit un créneau `
       + `(${avec}${sans ? ` ; sans l'invocation : ${sans}` : ''}). Un axe porte l'un OU l'autre : `
       + `l'aval ne sait pas lequel fait autorité, et deux invocations du même domaine à la même `
       + `portée font crier le résolveur en aval.`);
    }
  }
  if (!compileAuMoinsUne) {
    nonMesurables.push(`${axe} — aucune de ses ${entrees.length} entrée(s) ne compile`
      + `${dernierRefus ? ` (dernier refus : ${dernierRefus.slice(0, 60)})` : ''}`);
  }
}

// ── LE CLIQUET — une violation inscrite qui a cessé doit SORTIR du registre, à la main ────────
for (const [axe, cause] of CONNUES) {
  const encore = mesures.some((m) => m.axe === axe && m.creneau && m.adresse);
  ok(encore,
     `CLIQUET. '${axe}' est inscrit comme violation connue (${cause}) et ne viole PLUS. C'est `
   + `peut-être une bonne nouvelle — mais l'entrée doit sortir de CONNUES à la main, sinon ce garde `
   + `certifie un état qui n'existe plus.`);
}

// ── SOCLE — un garde qui n'a rien mesuré est vert pour la mauvaise raison ─────────────────────
ok(fichiersDuMot.size >= 20,
   `SOCLE : ${fichiersDuMot.size} axe(s) déclaré(s) lus dans la donnée, 20 au moins attendus.`);
ok(mesures.length >= 5,
   `SOCLE : ${mesures.length} axe(s) réellement MESURÉ(S), 5 au moins attendus. Sous ce seuil, le `
 + `vert de ce garde dit qu'il n'a rien compilé, pas que la règle tient.`);

// ── LE TROU, NOMMÉ — un axe non mesurable ne se conclut jamais en silence ─────────────────────
// ⚠️ Ce volet ne REFUSE pas : il IMPRIME. Un axe qui ne compile pas est un fait sur le catalogue,
// pas une violation de la règle. Le taire ferait croire que la matrice couvre tout.
if (nonMesurables.length) {
  console.log(`⚠️ ${nonMesurables.length} axe(s) NON MESURABLE(S) — la règle n'est pas vérifiée sur eux :`);
  for (const n of nonMesurables) console.log(`   · ${n}`);
}

// ── TÉMOIN — le garde distingue les deux états, et sait voir un créneau ───────────────────────
// Sans lui, « aucun axe ne fait les deux » se confond avec « rien n'est jamais détecté ».
{
  const aCreneau = mesures.filter((m) => m.creneau).map((m) => m.axe);
  const aAdresse = mesures.filter((m) => m.adresse).map((m) => m.axe);
  ok(aCreneau.length >= 1,
     `TÉMOIN. aucun axe mesuré ne remplit de créneau — l'instrument ne sait pas en voir un, et son `
   + `vert ne prouve rien. (Au 2026-08-22 : tuning et octaves en remplissaient un.)`);
  ok(aAdresse.length >= 1,
     `TÉMOIN. aucun axe mesuré n'émet d'adresse — même défaut, dans l'autre sens. `
   + `(Au 2026-08-22 : temperament, sound, homomorphism en émettaient une.)`);
  const uniq = (l) => [...new Set(l)].sort().join(', ') || '—';
  const ni = [...new Set(mesures.filter((m) => !m.creneau && !m.adresse).map((m) => m.axe))]
    .filter((a) => !aCreneau.includes(a) && !aAdresse.includes(a));
  console.log(`[axes] créneau : ${uniq(aCreneau)}`);
  console.log(`[axes] adresse : ${uniq(aAdresse)}`);
  // ⚠️ LE TROISIÈME ÉTAT SE DIT AUSSI : un axe qui ne fait NI l'un NI l'autre ne viole rien, mais
  // le taire ferait croire que la matrice n'a que deux cases. `scale` est là au 2026-08-22.
  console.log(`[axes] ni l'un ni l'autre : ${uniq(ni)}`);

  // ⛔ CE QUE LE TÉMOIN DIFFÉRENTIEL PROTÈGE VRAIMENT — ET CE N'EST PAS UN VERDICT, C'EST UN
  // CLASSEMENT. Je l'ai éprouvé en le désarmant (`sans = ''`) : AUCUNE violation n'apparaissait.
  // La raison, mesurée : aucun axe qui émet une adresse ne porte un champ à son propre nom, même en
  // comptant la cascade. Le différentiel ne change donc jamais le verdict sur la donnée d'aujourd'hui.
  //
  // Ce qu'il change est le CLASSEMENT, et c'est faux sans lui : l'entrée d'un axe qui COÏNCIDE avec
  // le défaut de la cascade — `tuning.western_12TET`, `alphabet.western` — serait comptée « remplit
  // un créneau » alors qu'elle ne pose rien de neuf. C'est exactement l'erreur qui m'a fait conclure
  // faux sur `temperament`, un cran plus loin : lire un champ posé par autre chose et l'imputer à
  // l'invocation qu'on regarde.
  //
  // ⚠️ ET C'EST CE VOLET QUI FAIT MORDRE LE DÉSARMEMENT. Sans lui, retirer le différentiel laisse le
  // garde vert — donc rien ne le tiendrait.
  {
    // ⚠️ ET LA FORMULATION A DÛ ÊTRE RESSERRÉE DEUX FOIS. « Au moins un axe mixte » passait au vert
    // même désarmé, parce qu'`alphabet` est mixte pour une AUTRE raison — son ardoise est retirée
    // quand il émet une adresse, donc certaines de ses entrées ne posent aucun champ. Un témoin qui
    // se satisfait du premier cas venu mesure le cas venu, pas la règle.
    // Ce qui discrimine : un axe dont TOUTES les entrées posent un champ, et dont CERTAINES sont
    // pourtant classées « pas de créneau ». Sans le différentiel, `avec` non vide impliquerait
    // toujours « créneau » — un tel axe ne pourrait pas exister.
    const parAxe = new Map();
    for (const m of mesures) {
      if (!parAxe.has(m.axe)) parAxe.set(m.axe, { posent: 0, total: 0, sansCreneau: 0 });
      const c = parAxe.get(m.axe);
      c.total++;
      if (m.avec !== '') c.posent++;
      if (!m.creneau) c.sansCreneau++;
    }
    const temoins = [...parAxe]
      .filter(([, c]) => c.posent === c.total && c.sansCreneau > 0 && c.total > 1)
      .map(([a]) => a);
    ok(temoins.length >= 1,
       `TÉMOIN DU DIFFÉRENTIEL. aucun axe ne pose un champ sur TOUTES ses entrées tout en en ayant `
     + `qui sont classées « pas de créneau ». C'est la signature du différentiel : l'entrée qui `
     + `COÏNCIDE avec le défaut de la cascade ne remplit rien de neuf. Sans lui, poser un champ `
     + `impliquerait toujours « créneau », et le classement redeviendrait celui de la cascade — `
     + `l'erreur exacte qui a fait imputer au tempérament un champ posé par l'alphabet. `
     + `(Au 2026-08-22 : octaves et tuning étaient dans ce cas.)`);
    console.log(`[axes] différentiel prouvé actif sur : ${uniq(temoins)}`);
  }
}

if (echecs.length) {
  console.error(`❌ un axe remplit un créneau OU émet une adresse : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un axe remplit un créneau OU émet une adresse, jamais les deux — ${mesures.length} axe(s) `
  + `mesurés sur les ${fichiersDuMot.size} que la donnée déclare, chacun par témoin différentiel `
  + `(avec et sans son invocation, pour que la cascade de défauts ne soit imputée à personne)`
  + `${nonMesurables.length ? `, ${nonMesurables.length} non mesurable(s) nommé(s) ci-dessus` : ''}. `
  + `${passe} vérification(s) passée(s).`);
