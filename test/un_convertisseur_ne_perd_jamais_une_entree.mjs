#!/usr/bin/env node
/**
 * GARDE — LE CONVERTISSEUR REND TOUTE ENTRÉE, OU IL REFUSE. JAMAIS « OUI » EN RENDANT MOINS.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE. `lib/core.json` porte `apporte`, un TABLEAU de neuf, à sa racine. Le
 * convertisseur le rendait sous forme de `// apporte : expression,midi,…` — **un COMMENTAIRE, qui ne
 * voyage pas jusqu'aux consommateurs** — et sortait en **code 0**. Une entrée sur cinq disparaissait
 * du bundle sans qu'un seul signe le dise, et l'outil déclarait la conversion réussie.
 *
 * ⛔ ET LA RÉPARATION D'ALORS ÉTAIT FAUSSE À SON TOUR — c'est le second temps, et il coûte plus cher
 * que le premier. J'ai remplacé le commentaire par `def apporte (expression, midi, …)` sur une mesure
 * que j'avais faite moi-même : *« mesuré à l'oracle, cette graphie COMPILE »*. Elle compile. Elle rend
 * `{expression:true, midi:true, …}` — un objet de booléens là où la source porte une liste ordonnée de
 * neuf, et rangé sous la section majoritaire au lieu de la racine. **J'avais mesuré la COMPILATION et
 * conclu sur la DONNÉE.** La perte muette était devenue un DÉPLACEMENT muet, et ce garde restait vert
 * parce qu'il cherchait le NOM dans le texte produit. Seule la preuve d'égalité par la porte du bundle
 * l'a vu : 53 feuilles avant, 59 après, `apporte` parti, neuf booléens venus.
 *
 * ⇒ **COMPTER dit ce qui est ÉCRIT ; EXERCER dit ce qui SE PASSE.** Un nom présent dans une source
 * produite ne dit rien de la donnée qu'elle publiera.
 *
 * ⇒ **Le refus est bruyant, la perte est muette.** C'est la classe que ce fichier a déjà payée une
 * fois — trois champs laissés derrière avec un « ✅ » — et le compte d'entrées avait été ajouté pour
 * ça. Il ne mordait pas ici : `recenser()` saute les tableaux, donc l'entrée perdue n'était même pas
 * comptée. **Un compte qui n'examine pas ce qui se perd ne mesure que lui-même.**
 *
 * ⛔ ET LE GARDE SE POSE SUR L'ESPACE, PAS SUR `apporte`. Il énumère TOUS les catalogues JSON encore
 * en place et TOUTES leurs entrées, quelle que soit la forme de la valeur — objet, liste, scalaire.
 * Une seule forme oubliée, et le prochain rétrécissement passe.
 *
 * ⚠️ TROIS INJECTIONS, ET LA TROISIÈME NE MORD PAS — je le dis plutôt que de le taire. Rétablir le
 * commentaire fait rougir le volet des catalogues réels ; rétablir la descente à deux niveaux fait
 * rougir la classe « membre homonyme ». **Rendre le COMPTE à nouveau aveugle aux listes ne fait rien
 * rougir** : le rendu étant réparé, plus rien ne se perd, et un second filet ne se voit pas tant que
 * le premier tient. C'est de la défense en profondeur, pas un défaut observable seul — **seule la
 * COMBINAISON des deux l'était**, et c'est elle qui a coûté `apporte`.
 *
 * ⚠️ CE QU'IL COUVRE, ET CE QU'IL LAISSE AU CONVERTISSEUR. Éprouvé par deux injections : rendre à
 * nouveau la liste en commentaire le fait ROUGIR ; sauter une entrée sur deux ne le fait PAS mordre —
 * et c'est juste, parce que le convertisseur REFUSE alors bruyamment, code non nul, rien d'écrit.
 * **Ce garde ne double pas le compte du convertisseur, il couvre le trou que ce compte ne voit pas** :
 * `recenser()` saute les valeurs de type liste, donc une entrée-liste perdue n'est même pas comptée.
 *
 * ⚠️ IL COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO : le jour où les catalogues seront
 * tous convertis, ce garde rougira au lieu de devenir vert par vacuité — c'est le signal qu'il a fini
 * son travail et qu'il doit sortir, pas qu'il veille encore.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { entreesDe } from '../src/transpiler/libs-champs.js';
// ⛔ LA DISPOSITION DES FICHIERS SE DEMANDE À CELUI DONT C'EST LE TRAVAIL. Ce banc lisait
// `lib/<nom>.json` de sa main, et un garde du portillon l'a refusé — un lecteur qui construit ce
// chemin devient AVEUGLE à une bascule vers `.bpsl` SANS CASSER : il continue sur moins de données
// et reste vert. Le convertisseur expose ce qu'il sait ; personne ne le redérive.
import { cataloguesEnJson, donneeDe } from '../scripts/json-vers-bpsl.mjs';

const RACINE = new URL('..', import.meta.url).pathname;
let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Le texte SANS ses commentaires — ce qui voyage réellement jusqu'aux consommateurs. */
const sansCommentaires = (t) => t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const catalogues = cataloguesEnJson();

// ⛔ LE TÉMOIN ANTI-VACUITÉ — un garde qui n'a rien examiné ne prouve rien.
ok(catalogues.length > 0,
  "⛔ ZÉRO catalogue JSON examiné. Si tous sont convertis, ce garde n'a plus d'objet et il SORT ; "
  + "s'il reste des JSON qu'il ne voit pas, son périmètre est faux. Dans les deux cas il ne veille plus.");

let entreesVues = 0;
let convertissent = 0;
for (const nom of catalogues) {
  const j = donneeDe(nom);
  const attendues = entreesDe(j);
  const r = spawnSync('node', [path.join(RACINE, 'scripts/json-vers-bpsl.mjs'), nom, '--essai'],
    { encoding: 'utf-8', timeout: 120000 });

  // Un REFUS est légitime : il est bruyant, il n'écrit rien, et personne n'est trompé.
  if (r.status !== 0) {
    ok((r.stderr || '').includes('⛔'),
      `${nom} — le convertisseur échoue SANS message de refus. Un échec muet envoie chercher ailleurs.`);
    continue;
  }

  // Sortie en code 0 : alors CHAQUE entrée doit être là, hors commentaire.
  convertissent++;
  const rendu = sansCommentaires(r.stdout || '');
  for (const entree of attendues) {
    entreesVues++;
    const forme = Array.isArray(j[entree]) ? 'liste'
      : (j[entree] && typeof j[entree] === 'object' ? 'objet' : typeof j[entree]);
    ok(new RegExp(`(^|\\W)${entree.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(\\W|$)`, 'm').test(rendu),
      `⛔ ${nom}.${entree} (${forme}) MANQUE de la source produite, et le convertisseur a rendu `
      + `CODE 0. Un commentaire ne voyage pas jusqu'aux consommateurs : cette entrée disparaîtrait `
      + `du bundle en silence. Le convertisseur doit REFUSER, jamais rendre moins en disant oui.`);
  }
}

// ⛔ CE TÉMOIN ÉTAIT MORT-NÉ, ET IL A LAISSÉ PASSER LE JOUR OÙ IL COMPTAIT. Il s'écrivait
// `entreesVues > 0 || catalogues.every(() => true)` : la seconde branche est vraie par construction,
// donc l'assertion ne pouvait RIEN refuser. Le 2026-08-24, les deux derniers catalogues réels se sont
// mis à refuser tous les deux, le volet réel a examiné ZÉRO entrée, et ce garde a rendu vert en
// affichant « 0 entrée(s) rendue(s) ». **Un garde qui compte doit refuser d'avoir compté zéro** — et
// un `||` dont un membre est une tautologie neutralise l'autre en silence.
ok(convertissent === 0 || entreesVues > 0,
  `⛔ ${convertissent} catalogue(s) convertissent et ZÉRO entrée n'a été examinée — le volet des `
  + `catalogues réels ne mesure plus rien.`);
// Et l'inverse : quand plus aucun catalogue ne convertit, le volet réel est ÉTEINT. Ce n'est pas une
// faute, c'est la fin de son objet — mais il ne veille plus, et ça se dit à voix haute.
if (!convertissent) {
  console.log(`[convertisseur sans perte] ⚠️ VOLET RÉEL ÉTEINT — les ${catalogues.length} catalogue(s) `
    + `restants REFUSENT tous. Ce volet n'exerce plus rien ; seule la matrice fabriquée veille.`);
}

// ── LA MATRICE DES CLASSES — FABRIQUÉE, jamais espérée dans `lib/` ──────────────────────────────
// ⛔ UN TOTAL NON NUL CACHE UNE CLASSE VIDE. Compter « 7 entrées rendues » ne dit pas qu'une entrée
// SCALAIRE ait jamais été examinée : `lib/` n'en porte peut-être aucune, et le garde reste vert en
// n'ayant jamais éprouvé cette forme. **Un garde s'écrit pour la CONSTRUCTION, pas pour la forme
// signalée** — alors on FABRIQUE chaque classe, on la fait passer par l'outil, et on refuse d'avoir
// examiné zéro sur chacune. Le bac à sable est un `lib/` temporaire : c'est le joint que deux autres
// gardes du portillon emploient déjà, l'outil lisant `lib/` relativement au répertoire courant.
const CLASSES = {
  // ⚠️ CETTE CLASSE REFUSE, ET C'EST SA RÉUSSITE. Un scalaire à la racine n'a AUCUNE graphie
  // d'entrée : le convertir le perdrait. Ce qu'on exige ici est un refus qui NOMME l'entrée.
  'valeur scalaire à la racine': {
    __refuse: 'quoi', documented: true, name: 'z', resolves: 'z', quoi: 42, t: { a: { b: 1 } },
  },
  // ⛔ CETTE CLASSE A CHANGÉ D'ISSUE, ET LE MOTIF VAUT D'ÊTRE RETENU. Elle attendait un SUCCÈS :
  // l'outil écrivait `def apporte (un, deux)`, la source compilait, le nom apparaissait dans le
  // rendu, et ce garde était vert. **Il comptait le NOM ÉCRIT ; personne n'exerçait la DONNÉE.**
  // Passée par le générateur du bundle, cette graphie rend `{un:true, deux:true}` — un objet de
  // booléens là où la source porte une liste ordonnée. Aucune graphie ne rend une liste en position
  // d'ENTRÉE (la même parenthèse la rend en position de MEMBRE) : question de langage ouverte, donc
  // l'outil REFUSE en nommant l'entrée. Ce que ce garde exige ici est ce refus, pas une conversion.
  'tableau à la racine': {
    __refuse: 'entrée-LISTE',
    documented: true, name: 'z', resolves: 'z', apporte: ['un', 'deux'], t: { a: { b: 1 } },
  },
  'membre imbriqué': { documented: true, name: 'z', resolves: 'z', t: { a: { b: { c: 1 } } } },
  // ⚠️ CETTE CLASSE EXISTE POUR SURVIVRE À UN RETRAIT. `lib/mapping.json` est aujourd'hui le SEUL
  // catalogue réel qui n'a aucune entrée, donc le seul qui exerce le refus anti-vacuité du
  // convertisseur — « ZÉRO entrée recensée ». Le jour où il sera retiré, ce chemin cesserait d'être
  // traversé par quoi que ce soit, **et rien ne le dirait** : un contrôle ne signale pas qu'il a
  // perdu son objet. La forme est fabriquée ici ; le retrait ne la lui reprend pas.
  'catalogue sans aucune entrée': {
    __refuse: 'ZÉRO entrée', documented: true, name: 'z', resolves: 'z', _note: 'que de la glose',
  },
  'membre homonyme à plusieurs branches': {
    documented: true, name: 'z', resolves: 'z',
    t: { une: { default: { x: 1 } }, deux: { default: { y: 2 } }, trois: { default: { z: 3 } } },
  },
};
{
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const os = await import('node:os');
  const bac = mkdtempSync(path.join(os.tmpdir(), 'bpsl-classes-'));
  try {
    mkdirSync(path.join(bac, 'lib'));
    let examinees = 0;
    for (const [classe, donnee] of Object.entries(CLASSES)) {
      const { __refuse, ...aEcrire } = donnee;
      writeFileSync(path.join(bac, 'lib', 'zz_classe.json'), JSON.stringify(aEcrire));
      const r = spawnSync('node', [path.join(RACINE, 'scripts/json-vers-bpsl.mjs'), 'zz_classe', '--essai'],
        { cwd: bac, encoding: 'utf-8', timeout: 120000 });
      examinees++;
      const rendu = sansCommentaires(r.stdout || '');
      // ⛔ ICI LE REFUS N'EST PAS LICITE, ET C'EST TOUTE LA DIFFÉRENCE AVEC LES CATALOGUES RÉELS.
      // Ces quatre cas sont fabriqués VALIDES : chacun DOIT se convertir. Accepter un refus les
      // rendrait verts sur un outil qui ne convertit plus rien — et c'est exactement ce qui est
      // arrivé : l'injection qui rétablit l'aplatissement fait REFUSER le cas homonyme, et la
      // matrice l'acceptait. **Un garde qui accepte les deux issues ne discrimine aucune des deux.**
      if (donnee.__refuse) {
        ok(r.status !== 0 && (r.stderr || '').includes(donnee.__refuse),
          `⛔ MATRICE · ${classe} — l'outil doit REFUSER en nommant « ${donnee.__refuse} », `
          + `et il a rendu code ${r.status}. Une forme sans graphie qui passe est une perte.`);
        continue;
      }
      ok(r.status === 0,
        `⛔ MATRICE · ${classe} — l'outil REFUSE un cas qu'il doit convertir : `
        + `${String(r.stderr || '').split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 160)}`);
      for (const entree of entreesDe(donnee)) {
        if (r.status !== 0) continue;
        ok(new RegExp(`(^|\\W)${entree}(\\W|$)`, 'm').test(rendu),
          `⛔ MATRICE · ${classe} — l'entrée « ${entree} » MANQUE de la source produite alors que `
          + `l'outil a rendu CODE 0. C'est la forme même que cette classe existe pour éprouver.`);
      }
    }
    ok(examinees === Object.keys(CLASSES).length,
      `⛔ MATRICE — ${examinees} classe(s) examinée(s) sur ${Object.keys(CLASSES).length}. `
      + `Un total non nul cache une classe vide : chaque forme se fabrique et se traverse.`);
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

if (e.length) {
  console.error(`[convertisseur sans perte] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[convertisseur sans perte] ${p} PASS / 0 FAIL — ${catalogues.length} catalogue(s) réel(s), `
  + `${entreesVues} entrée(s) rendue(s) hors commentaire, `
  + `${Object.keys(CLASSES).length} classe(s) FABRIQUÉE(S) traversée(s)`);
