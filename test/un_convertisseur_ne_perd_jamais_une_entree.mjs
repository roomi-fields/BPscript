#!/usr/bin/env node
/**
 * GARDE — LE CONVERTISSEUR REND TOUTE ENTRÉE, OU IL REFUSE. JAMAIS « OUI » EN RENDANT MOINS.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE. `lib/core.json` porte `apporte`, un TABLEAU de neuf, à sa racine. Le
 * convertisseur le rendait sous forme de `// apporte : expression,midi,…` — **un COMMENTAIRE, qui ne
 * voyage pas jusqu'aux consommateurs** — et sortait en **code 0**. Une entrée sur cinq disparaissait
 * du bundle sans qu'un seul signe le dise, et l'outil déclarait la conversion réussie.
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

ok(entreesVues > 0 || catalogues.every((n) => true),
  '⛔ aucune entrée examinée sur les catalogues qui convertissent.');

if (e.length) {
  console.error(`[convertisseur sans perte] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[convertisseur sans perte] ${p} PASS / 0 FAIL — ${catalogues.length} catalogue(s), `
  + `${entreesVues} entrée(s) rendue(s) hors commentaire`);
