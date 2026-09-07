#!/usr/bin/env node
/**
 * GARDE — CE QUE `lib/places.bpsl` DÉCLARE, LE COMPILATEUR L'APPLIQUE.
 *
 * ⛔ POURQUOI CE GARDE EXISTE. La spécification des places est devenue de la DONNÉE le 2026-09-07,
 * et une donnée que rien ne lit n'est pas une spécification : c'est un document écrit en `.bpsl`.
 * Ce garde est ce qui la rend PORTEUSE — il pilote ses cas depuis le fichier, jamais depuis une
 * liste écrite ici. Une place ajoutée là-bas est éprouvée sans qu'une ligne bouge ici ; une place
 * dont le type change fait rougir ce garde le jour même.
 *
 * ⛔ CE QU'IL MESURE, ET CE N'EST PAS « Y A-T-IL UN REFUS ». Le garde voisin
 * `une_place_refuse_ce_qu_elle_n_attend_pas` éprouve qu'un nom INCONNU est refusé — acquis aux
 * treize places. Celui-ci éprouve l'autre moitié, celle qui manque : un nom **déclaré d'une AUTRE
 * SORTE** doit être refusé aussi. *Un contrôle d'existence n'est pas un contrôle de sorte.*
 *
 * ⚠️ MESURE DU 2026-09-07 QUI A FAIT ÉCRIRE CE GARDE : le nom d'un drapeau est accepté à SIX places
 * sur douze, dont QUATRE où il n'a rien à faire — comme terme du flux, dans un corps de `def`, comme
 * clé d'un sac, comme rôle d'un point d'attente. Ce n'est pas quatre défauts : c'est un seul, à
 * quatre endroits. `nomsDeclares` verse tous les noms de `vars` dans les déclarés SANS LIRE leur
 * sorte, alors que la sorte est dans l'arbre (`varType.kind`).
 *
 * ⇒ LE MOTEUR NATIF TRANCHE CETTE FUITE. En BP3 un drapeau vit ENTRE BARRES OBLIQUES —
 *   `S --> X /Num_total = 20/` — et il n'existe AUCUNE position où il côtoie un terminal. La forme
 *   que le compilateur accepte n'a pas de contrepartie native.
 *
 * ⚠️ LES PLACES QUI FUIENT SONT INSCRITES OUVERTES, avec leur cause, et leur assertion est INVERSÉE :
 * le jour où l'une se ferme, ce garde rougit et demande qu'on la sorte de la liste. *Une exception
 * qui survit à sa cause est un trou qui ne rougit jamais.*
 */
import '../src/transpiler/index.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\nflag ff:1\nin.midi tt\nactor aa(out.audio)\ndef mm C4 D4\n';

/**
 * UN EXEMPLAIRE DÉCLARÉ DE CHAQUE SORTE — le nom, et ce que le socle en fait.
 * ⛔ Ces noms sont TOUS déclarés : ce garde n'éprouve jamais un inconnu, c'est le sujet du voisin.
 */
const EXEMPLAIRES = {
  symbol: 'C4',
  flag: 'ff',
  destination: 'midi',
  eval: 'js',
  control: 'vel',
};

/**
 * LA GRAPHIE DE CHAQUE PLACE — `%s` marque la position mesurée.
 * ⛔ CETTE TABLE NE DÉCLARE AUCUNE PLACE : elle dit seulement COMMENT ÉCRIRE celles que
 * `lib/places.bpsl` déclare. Une place de la donnée sans graphie ici fait rougir le socle.
 */
const GRAPHIES = {
  fluxDroite: ['flux', 'S -> %s'],
  corpsDeDef: ['declUse', 'def q %s D4'],
  gardeDeRegle: ['flux', '[%s==1] S -> C4'],
  mutationDeDrapeau: ['flux', 'S -> C4 [%s=2]'],
  cleDUnSac: ['flux', 'S -> C4(%s:64)'],
  tagDeBacktick: ['flux', 'S -> `%s: 1+1`'],
  sortieDActeur: ['declSeul', 'actor bb(out.%s)'],
  occurrenceDAttente: null,   // la seconde place du point d attente : sa graphie s ecrit `<!role.%s`
};

/**
 * LES PLACES QUI FUIENT — mesurées le 2026-09-07, avec la sorte qui passe et n'a rien à y faire.
 * ⛔ L'ASSERTION EST INVERSÉE : on EXIGE que la fuite soit encore là. Le jour où elle se ferme, ce
 * garde rougit et demande qu'on retire la ligne — une exception ne survit pas à sa cause en silence.
 */
const OUVERTES = {
  fluxDroite: 'flag',
  corpsDeDef: 'flag',
  cleDUnSac: 'flag',
};

const SANS_ACTEUR = SOCLE.replace('actor aa(out.audio)\n', '');
const composer = (ou, ligne) => (ou === 'flux' ? `${SOCLE}-----\n${ligne}\n`
  : ou === 'declUse' ? `${SOCLE}${ligne}\n-----\nS -> q\n`
    : ou === 'declSeul' ? `${SANS_ACTEUR}${ligne}\n-----\nS -> C4\n`
      : `${SOCLE}${ligne}\n-----\nS -> C4\n`);

const accepte = (ou, gabarit, nom) => compileToBPxAST(composer(ou, gabarit.replace('%s', nom))).errors.length === 0;

// ── LA DONNÉE PILOTE — les places viennent du fichier, jamais d'ici ──────────────────────────
const PLACES = leRegistre().places || {};
const declarees = Object.entries(PLACES)
  // ⛔ LE PROTOTYPE N EST PAS UNE PLACE. `place` porte `admet` parce qu il le TYPE pour ses entrées ;
  // le prendre pour une place ferait échouer le garde sur l objet qui définit la forme. Une entrée
  // se reconnaît à sa trace de dérivation, jamais à la présence du membre.
  .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && v._derive === 'place' && v.admet)
  .map(([nom, def]) => ({ nom, admet: def.admet && def.admet._derive }));

// SOCLE — une donnée vide rendrait ce garde muet et vert.
ok(declarees.length >= 6,
   `SOCLE : ${declarees.length} place(s) déclarée(s) dans lib/places.bpsl — la donnée a changé de forme, `
   + `ou elle n'est plus lue. Ce garde ne mesure rien sans elle.`);
ok(declarees.every((p) => p.admet),
   `SOCLE : une place déclarée ne porte pas de type sur son membre 'admet' — `
   + `${declarees.filter((p) => !p.admet).map((p) => p.nom).join(', ')}`);

// ⛔ CHAQUE PLACE DE LA DONNÉE A SA GRAPHIE ICI, sinon elle n'est pas éprouvée et personne ne le dit.
{
  const sansGraphie = declarees.filter((p) => !(p.nom in GRAPHIES)).map((p) => p.nom);
  ok(sansGraphie.length === 0,
     `⛔ ${sansGraphie.join(', ')} : déclarée dans lib/places.bpsl et sans graphie ici — elle n'est `
     + `PAS éprouvée, et le compte de ce garde monterait sans qu'elle le soit.`);
}

// ── LE JUGE — un nom d'une AUTRE sorte doit être refusé ──────────────────────────────────────
let eprouvees = 0;
for (const { nom, admet } of declarees) {
  const graphie = GRAPHIES[nom];
  if (!graphie) continue;               // place déclarée dont la graphie reste à établir
  const [ou, gabarit] = graphie;

  // (a) LE CAS SAIN — sans lui, « tout est refusé » passerait pour un juge parfait.
  const exemplaire = EXEMPLAIRES[admet];
  if (!exemplaire) {
    ok(false, `⛔ ${nom} admet '${admet}', dont ce garde n'a aucun exemplaire déclaré — il ne peut `
      + `donc pas éprouver cette place, et un silence ici se lirait comme une couverture.`);
    continue;
  }
  ok(accepte(ou, gabarit, exemplaire),
     `${nom} : le cas SAIN (${admet} '${exemplaire}') est REFUSÉ — la sonde est fausse, et tout ce `
     + `qui suit mesurerait la sonde au lieu de la place.`);

  // (b) LES AUTRES SORTES — déclarées, mais pas celle que la place admet.
  for (const [sorte, autre] of Object.entries(EXEMPLAIRES)) {
    if (sorte === admet) continue;
    eprouvees++;
    const passeQuandMeme = accepte(ou, gabarit, autre);
    if (OUVERTES[nom] === sorte) {
      ok(passeQuandMeme,
         `${nom} est inscrite OUVERTE sur '${sorte}' et elle REFUSE désormais — la fuite est fermée. `
         + `Retirer la ligne de OUVERTES : une exception qui survit à sa cause est un trou muet.`);
      continue;
    }
    ok(!passeQuandMeme,
       `⛔ ${nom} admet '${admet}' et accepte un '${sorte}' ('${autre}'). Un contrôle d'EXISTENCE `
       + `n'est pas un contrôle de SORTE — la place ne vérifie que « ce nom est-il connu ».`);
  }
}

ok(eprouvees >= 15,
   `SOCLE : ${eprouvees} confrontation(s) sorte × place — sous ce seuil le garde a cessé d'exercer.`);

console.log(`[places] ${declarees.length} place(s) lue(s) dans lib/places.bpsl · ${eprouvees} `
  + `confrontation(s) sorte × place · ${Object.keys(OUVERTES).length} place(s) OUVERTE(S) inscrite(s)`);

if (echecs.length) {
  console.error(`[places] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[places] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
