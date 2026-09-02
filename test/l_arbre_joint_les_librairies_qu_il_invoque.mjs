#!/usr/bin/env node
/**
 * GARDE — L'ARBRE JOINT LE CONTENU DES LIBRAIRIES QU'IL INVOQUE, ET RIEN D'AUTRE.
 *
 * Décision de Romain, 2026-09-02 : l'arbre gagne une section `librairies` qui porte, pour chaque
 * objet que la scène invoque, l'objet tel que la porte des objets le rend, sans rien calculer. Un
 * objet entre s'il est nommé par une CHAÎNE (`libRefs`, liaison d'acteur), par un MOT (la clé d'un
 * réglage, le nom d'une directive — chaque objet qui porte le mot entre, le contrôle ET la fonction
 * digitale avec son corps), ou par un MEMBRE d'un objet déjà entré dont la clé est un mot de
 * famille. Ce garde tient, sur TOUTES les scènes du corpus, avec SA PROPRE lecture des références —
 * s'il lisait celle du compilateur, une référence oubliée des deux côtés resterait verte :
 *   1. chaque chaîne que l'arbre porte a son entrée, clé = chaîne ;
 *   2. chaque mot de réglage a l'entrée de chacun des objets qui le portent ;
 *   3. chaque membre d'une entrée dont la clé est un mot de famille a son entrée à son tour ;
 *   4. aucune entrée n'est là sans un chemin depuis une référence — la section est MINIMALE ;
 *   5. la section ne porte rien de calculé : chaque valeur est ÉGALE à ce que la porte rend.
 * Et il compte ce qu'il a examiné : sous le plancher, il refuse d'avoir examiné.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { familles, objet } from '../src/transpiler/objets.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

exigerCorpus();

// ⛔ LE PREMIER GESTE DE CE PROCESSUS EST UNE COMPILATION, PAS UNE LECTURE DE LA PORTE — et c'est
// une mesure. Le 2026-09-02 la porte construite rendait une section VIDE hors dépôt : l'index des
// objets se mémorisait pendant l'amorçage du registre, déclenché par la première compilation, sur un
// registre partiel. Ce garde était vert parce qu'il lisait `familles()` d'abord, ce qui amorçait le
// registre avant toute jonction. Un garde qui commence par la porte ne voit jamais ce défaut ; celui-ci
// commence donc comme un consommateur réel : par une scène.
{
  const premiere = compileToBPxAST('core\n-----\nS -> C4 D4\n', {});
  const cles = Object.keys((premiere.ast && premiere.ast.librairies) || {});
  ok(cles.includes('alphabet.western') && cles.includes('tuning.western_12TET'),
     `la PREMIÈRE compilation du processus joint déjà ses librairies — reçu ${JSON.stringify(cles)} : l'index s'est mémorisé pendant l'amorçage`);
}
const FAMILLES = new Set(familles());

// Les références, lues ICI — partout dans l'arbre, hors la section elle-même.
const referencesDe = (ast) => {
  const chaines = new Set();
  const mots = new Set();
  const visiter = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visiter(x); return; }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'librairies') continue;
      if (k === 'libRefs' && Array.isArray(v)) { for (const r of v) if (typeof r === 'string') chaines.add(r); }
      else if (k === 'references' && Array.isArray(v)) {
        for (const r of v) if (r && r.type === 'ActorReference' && r.category !== 'transport') chaines.add(`${r.category}.${r.name}`);
      }
      else if (k === 'pairs' && Array.isArray(v)) { for (const p of v) if (p && typeof p.key === 'string') mots.add(p.key); }
      else if (k === 'directives' && Array.isArray(v)) { for (const d of v) if (d && typeof d.name === 'string' && !d.subkey) mots.add(d.name); visiter(v); }
      else visiter(v);
    }
  };
  visiter(ast);
  return { chaines: [...chaines].filter((c) => FAMILLES.has(c.split('.')[0])), mots: [...mots] };
};
/** Les chaînes de tous les objets qu'un mot désigne. */
const objetsDuMot = (mot) => { const o = objet(mot); return !o ? [] : o.ambigu ? o.ambigu : [o.chaine.join('.')]; };

let scenes = 0, entrees = 0, parMot = 0, suivies = 0, sansSection = 0;
for (const nom of nomsBps()) {
  const r = compileToBPxAST(lireBps(nom), {});
  if (!r.ast) continue;   // les scènes qui ne compilent pas sont le sujet d'autres gardes
  scenes++;
  const section = r.ast.librairies;
  ok(section && typeof section === 'object' && !Array.isArray(section),
     `${nom} : l'arbre ne porte pas de section 'librairies' — reçu ${JSON.stringify(section)}`);
  if (!section) { sansSection++; continue; }
  const { chaines, mots } = referencesDe(r.ast);
  const atteintes = new Set(chaines);
  // 1. chaque chaîne a son entrée
  for (const chaine of chaines) {
    ok(chaine in section, `${nom} : '${chaine}' est invoqué et n'a pas d'entrée dans 'librairies' — clés ${JSON.stringify(Object.keys(section))}`);
  }
  // 2. chaque mot fait entrer CHACUN des objets qui le portent
  for (const mot of mots) {
    for (const chaine of objetsDuMot(mot)) {
      if (!atteintes.has(chaine)) parMot++;
      atteintes.add(chaine);
      ok(chaine in section, `${nom} : le réglage '${mot}' désigne '${chaine}', et la section ne le porte pas — un mot fait entrer toutes ses facettes`);
    }
  }
  // 3. et 5. chaque entrée est l'objet de la porte, et ce qu'elle nomme est entré
  for (const [chaine, e] of Object.entries(section)) {
    entrees++;
    const attendu = objet(chaine);
    ok(attendu && !attendu.ambigu && JSON.stringify(e) === JSON.stringify(attendu),
       `${nom} : 'librairies[${chaine}]' n'est pas l'objet que la porte rend — l'arbre ne calcule rien, il joint`);
    for (const [k, v] of Object.entries(e.membres || {})) {
      if (!FAMILLES.has(k) || typeof v !== 'string') continue;
      const suivie = `${k}.${v}`;
      if (!atteintes.has(suivie)) suivies++;
      atteintes.add(suivie);
      ok(suivie in section, `${nom} : '${chaine}' nomme '${suivie}' par son membre '${k}', et la section ne le porte pas`);
    }
  }
  // 4. la section est minimale : aucune entrée hors des références et de ce qu'elles nomment
  for (const chaine of Object.keys(section)) {
    ok(atteintes.has(chaine), `${nom} : 'librairies[${chaine}]' n'est nommé ni par l'arbre ni par un objet joint — la section n'est pas minimale`);
  }
}

// Les témoins qui DISCRIMINENT chaque voie d'entrée : sans eux, une voie peut cesser d'exister en vert.
ok(suivies > 0, `aucune entrée suivie par un membre sur ${scenes} scènes — sans suivi, \`tuning.western_12TET\` entrerait sans \`temperament.12TET\``);
ok(parMot > 0, `aucune entrée par un mot de réglage sur ${scenes} scènes — sans elle, une fonction digitale n'entrerait jamais avec son corps`);
{
  // Une scène nue porte une section VIDE d'invocation explicite mais PLEINE de ses défauts : l'acteur
  // implicite lie `alphabet.western`, et c'est ce que la condition 2 de la décision exige.
  const nue = compileToBPxAST('core\n-----\nS -> C4 D4\n', {});
  ok(nue.ast && nue.ast.librairies && typeof nue.ast.librairies === 'object',
     `une scène nue porte une section 'librairies' — reçu ${JSON.stringify(nue.ast && nue.ast.librairies)}`);
  ok(nue.ast && nue.ast.librairies && 'alphabet.western' in nue.ast.librairies && 'tuning.western_12TET' in nue.ast.librairies,
     `une scène nue joint ses DÉFAUTS — alphabet et accordage de l'acteur implicite — reçu ${JSON.stringify(Object.keys((nue.ast && nue.ast.librairies) || {}))}`);
  // Et une fonction digitale entre AVEC son corps.
  const digitale = compileToBPxAST('core\n-----\nS -> C4(scaleshift:2)\n', {});
  const f = digitale.ast && digitale.ast.librairies && digitale.ast.librairies['function.scaleshift'];
  ok(f && typeof f.membres.body === 'string' && f.membres.body.length > 0,
     `'scaleshift:2' fait entrer 'function.scaleshift' AVEC son corps — reçu ${JSON.stringify(f && Object.keys(f.membres))}`);
}

ok(scenes >= 150, `SOCLE : ${scenes} scène(s) compilée(s) — sous 150 le corpus ne mesure rien`);
ok(entrees >= 900, `SOCLE : ${entrees} entrée(s) jointe(s) — la mesure du 2026-09-02 en donnait 1152`);
ok(sansSection === 0, `${sansSection} scène(s) sans section`);

if (echecs.length) {
  console.error(`[librairies jointes] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs.slice(0, 20)) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[librairies jointes] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · ${scenes} scènes, ${entrees} entrées jointes, ${parMot} par un mot, ${suivies} suivies par un membre`);
