#!/usr/bin/env node
/**
 * GARDE — UN CHAMP DE FICHIER N'EST JAMAIS UNE ENTRÉE INVOCABLE, SUR AUCUN AXE.
 *
 * Un catalogue mêle à la même profondeur ce qui parle DU FICHIER (`resolves`, `resolvedBy`,
 * `documented`…) et ce qui EST une entrée (`western`, `12TET`). Un chargeur qui lit `file[nom]` sans
 * rien écarter sert donc les deux, et `temperament.resolvedBy` devient une ENTRÉE FANTÔME.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, LE 2026-08-24. En posant `documented` — décision Romain,
 * `un-catalogue-declare-s-il-est-documente` — j'ai mesuré ce que la donnée neuve ouvrait :
 *
 *     temperament.documented     ACCEPTÉ    une entrée fantôme invocable
 *     temperament.resolvedBy     ACCEPTÉ    le même défaut, vivant depuis toujours
 *     octaves.documented         PLANTAGE   « octaveDef.registers is not iterable »
 *     octaves.resolvedBy         PLANTAGE   le même, sur un champ vieux de deux semaines
 *
 * ⚠️ ET LE PLANTAGE EST LE PIRE DES DEUX : il est jeté par la passe qui étend les terminaux, DEUX
 * étages avant le validateur de références qui aurait nommé la faute. Une exception à la place d'un
 * refus, sur la classe que ce dépôt a déjà tranchée pour un caractère illisible.
 *
 * ⚠️ ET C'EST KAIROS QUI A NOMMÉ LA CLASSE : « un champ ajouté au sommet du sac devient chez moi une
 * entrée fantôme INVOCABLE ». Il l'avait réparée chez lui la veille sur `description` et `version`,
 * après avoir lu un préavis qui annonçait la réécriture de six descriptions publiées. Le même défaut
 * vivait chez moi, dans le chargeur, et personne ne l'avait mesuré côté compilateur.
 *
 * ⛔ ET C'EST UNE MATRICE, PAS UNE LISTE. Le défaut ne vit pas sur `documented` : il vit sur le
 * PRODUIT axe × champ de fichier. Une liste de quatre cas serait verte le jour où un champ neuf
 * s'ajoute — ce qui est exactement comment ces quatre-là sont arrivés.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { CHAMPS_DE_FICHIER } from '../src/transpiler/libs-champs.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const scene = (tete) => `core\nalphabet.western\n${tete}\n-----\nS -> C4\n`;

// ── A. LA MATRICE — chaque axe SERVI × chaque champ qu'il PORTE RÉELLEMENT ────────────────────
// Les deux dimensions viennent de la donnée : les mots déclarés par les catalogues, et les champs
// de fichier réellement écrits. Un cas fabriqué sur un champ que personne ne porte ne prouverait
// rien — le chargeur rendrait `undefined` pour une autre raison.
const axes = [...new Set(Object.values(LIBS)
  .map((l) => (l && typeof l === 'object' ? l.resolves : null)).filter(Boolean))].sort();
ok(axes.length >= 20, `A. SOCLE : au moins 20 axes servis attendus — ${axes.length}`);

let cas = 0;
const acceptes = [];
const plantages = [];
for (const axe of axes) {
  for (const champ of CHAMPS_DE_FICHIER) {
    if (!Object.values(LIBS).some((l) => l && typeof l === 'object' && l.resolves === axe && champ in l)) continue;
    cas++;
    try {
      const r = compileToBPxAST(scene(`${axe}.${champ}`));
      if (!(r.errors || []).length) acceptes.push(`${axe}.${champ}`);
    } catch (x) {
      plantages.push(`${axe}.${champ} → ${x.message.slice(0, 60)}`);
    }
  }
}
ok(cas >= 60,
  `A. SOCLE : la matrice doit porter au moins 60 cas (axe × champ réellement porté) — ${cas}. `
  + `Un garde qui a examiné trois cas serait vert sans rien voir.`);
ok(acceptes.length === 0,
  `A. ⛔ ${acceptes.length} champ(s) de fichier sont INVOCABLES comme entrées : `
  + `${acceptes.slice(0, 6).join(', ')}. Une invocation qui résout un champ de fichier charge une `
  + `CHAÎNE là où l'aval attend une entrée — et rien ne le dit.`);
ok(plantages.length === 0,
  `A. ⛔ ${plantages.length} champ(s) de fichier font PLANTER le compilateur : `
  + `${plantages.slice(0, 4).join(' · ')}. Une exception arrive avant le validateur qui nommerait la `
  + `référence : l'auteur lit une pile d'appels au lieu d'un refus.`);
console.log(`[champ ≠ entrée] ${axes.length} axes · ${cas} cas mesurés · ${cas - acceptes.length - plantages.length} refusés`);

// ── B. ET LES VRAIES ENTRÉES PASSENT — sinon la règle serait tenue par un refus général ───────
// ⛔ SANS CE VOLET, fermer l'axe entier rendrait le volet A vert. C'est le complément de la portée :
// on écrit la règle ET son contraire, sur la même matrice.
{
  let servis = 0;
  for (const axe of axes) {
    // Une entrée réelle de cet axe : un membre qui porte un OBJET, jamais un champ de fichier.
    let entree = null;
    for (const lib of Object.values(LIBS)) {
      if (!lib || typeof lib !== 'object' || lib.resolves !== axe) continue;
      const source = lib.objects && typeof lib.objects === 'object' ? lib.objects : lib;
      entree = Object.keys(source).find((k) => !k.startsWith('_') && !CHAMPS_DE_FICHIER.has(k)
        && source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]));
      if (entree) break;
    }
    if (!entree) continue;
    // ⚠️ ON NE JUGE QUE LE REFUS D'AXE ET D'ENTRÉE. Une entrée réelle peut légitimement échouer
    // pour AUTRE CHOSE — un son sans catalogue versionné, un registre qui ne segmente pas le `C4`
    // témoin. Ce volet mesure que l'entrée n'est pas déclarée INEXISTANTE, pas qu'elle compile.
    const msg = ((compileToBPxAST(scene(`${axe}.${entree}`)).errors || [])[0] || {}).message || '';
    servis++;
    ok(!/introuvable dans le catalogue|n'existe pas dans la librairie|aucune librairie ne sert/.test(msg),
      `B. '${axe}.${entree}' est une ENTRÉE réelle : elle ne doit jamais être déclarée inexistante. `
      + `Reçu : ${msg.slice(0, 100)}`);
  }
  ok(servis >= 15, `B. SOCLE : au moins 15 axes doivent avoir été éprouvés par une entrée réelle — ${servis}`);
}

if (e.length) {
  console.error(`[champ ≠ entrée] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[champ ≠ entrée] ${p} PASS / 0 FAIL`);
