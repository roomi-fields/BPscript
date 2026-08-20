#!/usr/bin/env node
/**
 * GARDE — LA FICHE D'ÉTAT DÉCRIT LE DÉPÔT D'AUJOURD'HUI, PAS CELUI D'IL Y A CINQ JOURS.
 *
 * ⛔ CE QU'IL TIENT, ET LA FAUTE ÉTAIT VIVANTE QUAND IL A ÉTÉ ÉCRIT. `baseline-status.json` est le
 * fichier que l'architecte lit pour connaître mon état sans me réveiller. Mesuré le 2026-08-20 :
 * elle déclarait 141 gardes quand le portillon en comptait 177, six librairies de vocabulaire quand
 * le dossier en portait dix, et un commit vieux de cinq jours.
 *
 * ⛔ ET L'EN-TÊTE DU GÉNÉRATEUR AFFIRMAIT QUE CE GARDE EXISTAIT — « un garde compare l'enregistré au
 * régénéré, comme pour le paquet ». Il n'existait pas. Une affirmation dans le code se relit comme
 * une preuve, et celle-là a tenu cinq jours : personne ne va vérifier qu'un garde nommé dans un
 * commentaire est branché quelque part.
 *
 * ⚠️ POURQUOI IL NE COMPARE PAS TOUT, ET C'EST MESURÉ, PAS COMMODE. Régénérer la fiche LANCE le
 * portillon — c'est de là que vient son compte de gardes. Un garde qui la régénère depuis le
 * portillon le relancerait à l'intérieur de lui-même. Deux champs sont donc hors de portée ici :
 *
 *   · `portillon`  — sa mesure EST le portillon ; elle se rafraîchit en lançant `npm run fiche:etat`.
 *   · `commit`     — la fiche est générée AVANT le commit qui l'enregistre, donc elle porte
 *                    structurellement le précédent. Exiger l'égalité serait exiger l'impossible.
 *
 * Tout le reste se dérive sans lancer quoi que ce soit, et tout le reste est comparé : le corpus et
 * les librairies disent leurs propres chiffres, et la fiche doit dire les mêmes.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('../', import.meta.url);
const chemin = new URL('baseline-status.json', RACINE);
ok(existsSync(chemin), "la fiche d'état doit exister à la racine — c'est ce que l'architecte lit");
const fiche = JSON.parse(readFileSync(chemin, 'utf8'));

// ── A. LES LIBRAIRIES — le dossier dit sa vérité, la fiche doit la répéter ───────────────────────
{
  const fichiers = readdirSync(new URL('lib/', RACINE));
  const attendu = fichiers.filter((f) => f.endsWith('.bpsl')).map((f) => f.replace('.bpsl', '')).sort();
  const declare = fiche.librairies?.vocabulaire_en_bpscript || [];
  ok(attendu.length > 0, 'A. le dossier lib/ doit porter des librairies de vocabulaire — sans elles le garde examine zéro');
  const manquantes = attendu.filter((x) => !declare.includes(x));
  const fantomes = declare.filter((x) => !attendu.includes(x));
  ok(manquantes.length === 0,
    `A. ${manquantes.length} librairie(s) de vocabulaire absente(s) de la fiche : ${manquantes.join(', ')} — régénérer par 'npm run fiche:etat'`);
  ok(fantomes.length === 0,
    `A. ${fantomes.length} librairie(s) nommée(s) par la fiche et absente(s) du dossier : ${fantomes.join(', ')}`);

  const catalogues = fichiers.filter((f) => f.endsWith('.json')).length;
  ok(fiche.librairies?.catalogues_en_json === catalogues,
    `A. la fiche annonce ${fiche.librairies?.catalogues_en_json} catalogue(s) en JSON, le dossier en porte ${catalogues}`);
}

// ── B. LE CORPUS — même exigence, sur la source que le générateur lit ────────────────────────────
{
  const brut = JSON.parse(readFileSync(new URL('test/grammars/grammars.json', RACINE), 'utf8'));
  const table = Array.isArray(brut) ? Object.fromEntries(brut.map((g) => [g.name, g])) : brut;
  const total = Object.keys(table).length;
  ok(total > 0, 'B. le corpus doit porter des grammaires — sans elles le garde examine zéro');
  ok(fiche.corpus?.total === total,
    `B. la fiche annonce ${fiche.corpus?.total} grammaire(s), le corpus en porte ${total}`);
  const nommees = Object.keys(fiche.corpus?.grammaires || {}).length;
  ok(nommees === total,
    `B. la fiche nomme ${nommees} grammaire(s) pour un total annoncé de ${fiche.corpus?.total} — un total qui ignore ses trous`);
}

// ── C. ⛔ CE QUI N'EST PAS COMPARÉ DOIT ÊTRE PRÉSENT ET PLAUSIBLE ────────────────────────────────
// Les deux champs hors de portée ne sont pas pour autant libres : une fiche qui les perdrait
// passerait ce garde en silence, et c'est exactement la forme de faute qu'il existe pour attraper.
ok(typeof fiche.commit === 'string' && /^[0-9a-f]{7,}$/.test(fiche.commit),
  `C. la fiche doit porter un commit — reçu ${JSON.stringify(fiche.commit)}`);
ok(Number.isInteger(fiche.portillon?.verts) && fiche.portillon.verts > 0,
  `C. la fiche doit porter un compte de gardes non nul — reçu ${JSON.stringify(fiche.portillon)}`);
ok(fiche.portillon?.echecs === 0,
  `C. la fiche enregistrée déclare ${fiche.portillon?.echecs} échec(s) — elle a été prise sur un portillon rouge`);
ok(typeof fiche.derivee === 'string' && /fiche-etat/.test(fiche.derivee),
  "C. la fiche doit dire qu'elle est dérivée et par quoi — sinon quelqu'un l'éditera à la main");

const ATTENDU = 1 + 4 + 3 + 4;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[fiche] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[fiche] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
