// LE PRÉFIXE PAR LA LIBRAIRIE EST UNE FAÇON D'ÉCRIRE, PAS UNE PORTE DÉROBÉE.
//
// CE QUE ROMAIN A TRANCHÉ (2026-08-09) : « time.tempo doit être accepté par BPScript, à étendre à
// toutes les librairies.directives ». Le préfixe est OPTIONNEL, il n'a jamais été INTERDIT — c'est
// la contrepartie exacte de la résolution par unicité (2026-08-02) : le nom nu vaut quand il est
// unique, le préfixe nomme explicitement qui déclare la directive.
//
// ⚠️ CE QUE CE GARDE EXISTE POUR EMPÊCHER, ET QUI EST ARRIVÉ DEUX FOIS PENDANT L'ÉCRITURE.
// Chaque refus posé sur une directive se garde par `!subkey` : il ne regarde que la forme NUE.
// Un rabattement du préfixe placé après ces refus laisse donc la forme préfixée passer PAR-DESSUS.
// Mesuré : `@core.seed:120` passait là où `@seed:120` est refusé depuis le 2026-06-11, et
// `@core.scene:120` ROUVRAIT `@scene`, SUPPRIMÉE du langage. Dix-huit paires se comportaient
// autrement que leur nom nu — dix-huit refus contournables en préfixant.
//
// ⚠️ ET LE CAS DU JOUR N'EN MONTRAIT AUCUN. `tempo` se comportait parfaitement, préfixé comme nu :
// un garde écrit sur l'exemple qui a motivé la demande aurait été VERT sur les dix-huit trous.
// Seul le PRODUIT CROISÉ les a vus — d'où la forme de ce garde, qui ne teste pas une liste de cas
// mais construit LIBRAIRIES × DIRECTIVES DÉCLARÉES lui-même. Une directive ajoutée à une librairie
// est testée le jour même, sans que personne ait à y penser.
//
// LA PROPRIÉTÉ, une seule et elle est totale : pour toute paire déclarée, `@lib.dir:v` se comporte
// EXACTEMENT comme `@dir:v` — accepté si l'un l'est, refusé PAR LE MÊME REFUS sinon. On ne compare
// pas « les deux échouent » (ce serait vrai de deux refus sans rapport) mais l'identité du message,
// aux positions près : c'est ce qui distingue « le préfixe se résout » de « le préfixe casse ».

import { LIBS } from '../src/transpiler/libs-data.js';
import { compileToBPxAST } from '../src/transpiler/index.js';

let echecs = 0;
const dire = (ok, quoi) => { if (!ok) { echecs++; console.log('  ÉCHEC ' + quoi); } };

// Les positions (`at line 1:12`) diffèrent légitimement : le préfixe décale la colonne. Tout le
// reste du message doit être identique — c'est le juge, et il est aussi discriminant qu'il peut
// l'être. Un juge qui ne comparerait que le NOMBRE d'erreurs certifierait deux refus étrangers.
const norm = (m) => m.replace(/at line \d+:\d+/, '').replace(/\s+/g, ' ').trim();
const compile = (src) => compileToBPxAST(src + '\nS -> C4 D4');

// LA MATRICE SE CONSTRUIT DEPUIS LA DONNÉE, jamais une liste de paires écrite à la main.
const paires = [];
for (const [lib, data] of Object.entries(LIBS)) {
  for (const d of (data.schema && data.schema.reservedDirectives) || []) paires.push([lib, d]);
  for (const d of Object.keys(data.values || {})) paires.push([lib, d]);
}

// TÉMOIN ANTI-RÉTRÉCISSEMENT : si la donnée cesse de déclarer des directives, la matrice se vide
// et ce garde passerait au vert sans avoir rien examiné — la famille « verdir sans examiner »,
// fermée neuf fois dans ce dépôt. Le socle refuse zéro.
dire(paires.length >= 40, `la matrice s'est vidée : ${paires.length} paires (attendu ≥ 40)`);

for (const [lib, dir] of paires) {
  const prefixe = compile(`@${lib}.${dir}:120`);
  const nu = compile(`@${dir}:120`);
  const memeCompte = prefixe.errors.length === nu.errors.length;
  const memeRefus = !prefixe.errors.length
    || (nu.errors.length && norm(prefixe.errors[0].message) === norm(nu.errors[0].message));
  dire(memeCompte && memeRefus,
    `@${lib}.${dir} ne se comporte pas comme @${dir} — `
    + `préfixé: ${prefixe.errors[0] ? norm(prefixe.errors[0].message).slice(0, 60) : 'accepté'} | `
    + `nu: ${nu.errors[0] ? norm(nu.errors[0].message).slice(0, 60) : 'accepté'}`);
}

// LES DEUX SENS DU TÉMOIN. Une règle qui refuserait tout laisserait au vert la moitié « doit
// mordre » ; c'est la moitié « doit passer » qui la démasque (payé deux fois le 2026-07-28).
dire(compile('@core.tempo:120').errors.length === 0, '@core.tempo:120 doit être ACCEPTÉ');
dire(compile('@tempo:120').errors.length === 0, '@tempo:120 doit rester ACCEPTÉ');
dire(compile('@core.scene:120').errors.length > 0, '@core.scene:120 doit être REFUSÉ (@scene est supprimée)');
dire(compile('@core.seed:120').errors.length > 0, '@core.seed:120 doit être REFUSÉ (@seed s\'écrit en bloc)');
dire(compile('@zzz.tempo:120').errors.length > 0, '@zzz.tempo:120 doit être REFUSÉ (librairie inexistante)');
dire(compile('@core.zzz:1').errors.length > 0, '@core.zzz:1 doit être REFUSÉ (entrée inexistante)');

// L'INVOCATION DE COMPOSANT N'EST PAS UNE DIRECTIVE PRÉFIXÉE et ne doit pas être avalée par le
// rabattement : `western` vit dans `alphabets`, pas parmi les directives déclarées par `alphabet`.
dire(compile('@alphabet.western').errors.length === 0, '@alphabet.western doit rester ACCEPTÉ');
dire(compile('@out.midi(ch:1)').errors.length === 0, '@out.midi(ch:1) doit rester ACCEPTÉ');

console.log(echecs === 0
  ? `✅ le préfixe par la librairie ne contourne aucun refus (${paires.length} paires × identité du refus, + 8 témoins)`
  : `❌ ${echecs} échec(s)`);
process.exit(echecs === 0 ? 0 : 1);
