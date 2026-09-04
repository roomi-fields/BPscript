#!/usr/bin/env node
/**
 * GARDE — LA PORTE DES OBJETS REND TOUTE ENTRÉE DE TOUTE LIBRAIRIE, PAR SA CHAÎNE ET PAR SON NOM.
 *
 * La porte `objets.js` remplace la lecture du paquet par ses clés de fichier (décision de Romain,
 * 2026-09-02 : la structure des objets suffit). Ce garde tient trois choses, sur TOUTES les familles :
 *   1. chaque entrée que le paquet porte est rendue par sa famille, avec ses membres ;
 *   2. chaque entrée se résout par sa chaîne `famille.nom`, et par son nom nu quand il est unique ;
 *   3. un nom porté par plusieurs familles rend la liste des candidats, jamais l'un d'eux en silence.
 * Et il compte ce qu'il a examiné : sous le plancher, il refuse d'avoir examiné.
 */
import '../src/transpiler/index.js';
import { placesDesLibrairies } from '../src/transpiler/librairies.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();
const PLACES = placesDesLibrairies(leRegistre());
import { entreesDe } from '../src/transpiler/libs-champs.js';
import { familles, famille, objet, objets } from '../src/transpiler/objets.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 0. LE SOCLE — l'assiette vient du paquet, la porte doit la couvrir entièrement ──────────────
const attendues = [];   // [clé de paquet, place|null, nom]
const sousDossiers = [];   // [clé de paquet] — un catalogue de sous-dossier est UNE entrée de son dossier
// Le mot d'une clé du paquet : `resolves`, sinon la clé ; pour `settings/test1`, le mot de `settings`.
const motDe = (cle) => {
  const barre = cle.indexOf('/');
  const tete = barre > 0 ? cle.slice(0, barre) : cle;
  return (LIBS[tete] && LIBS[tete].resolves) || tete;
};
for (const [cle, lib] of Object.entries(LIBS)) {
  if (!lib || typeof lib !== 'object' || Array.isArray(lib)) continue;
  if (cle.includes('/')) { sousDossiers.push(cle); continue; }
  const places = new Set((PLACES[cle] || []));
  for (const nom of entreesDe(lib)) if (!places.has(nom)) attendues.push([cle, null, nom]);
  for (const place of places) for (const nom of entreesDe(lib[place] || {})) attendues.push([cle, place, nom]);
}
ok(attendues.length >= 600, `0. SOCLE : ${attendues.length} entrée(s) dans le paquet — sous 600 le balayage ne mesure rien`);
ok(familles().length >= 20, `0. SOCLE : ${familles().length} famille(s) — sous 20 la porte ne rend pas les catalogues`);

// ── 1. CHAQUE ENTRÉE EST RENDUE PAR SA FAMILLE, AVEC SES MEMBRES ────────────────────────────────
const parFamille = new Map(familles().map((m) => [m, famille(m)]));
// Un catalogue de sous-dossier est l'entrée de son dossier : `settings/test1` → `settings.test1`,
// avec le contenu du fichier pour membres. Mesuré le 2026-09-02 : rendu comme une famille à part, il
// ne se résolvait par aucune chaîne qu'une scène écrit.
ok(sousDossiers.length > 0, `1. SOCLE : aucun catalogue de sous-dossier dans le paquet — la mesure du 2026-09-02 en donnait 3`);
for (const cle of sousDossiers) {
  const mot = motDe(cle);
  const nom = cle.slice(cle.indexOf('/') + 1);
  const e = objet(`${mot}.${nom}`);
  ok(e && !e.ambigu && e.famille === mot && e.nom === nom,
     `1. '${cle}' doit être l'entrée '${mot}.${nom}' de la famille '${mot}' — reçu ${JSON.stringify(e && (e.ambigu || e.chaine))}`);
  ok(!familles().includes(cle), `1. '${cle}' ne doit pas être une famille — les familles sont des MOTS`);
  ok(e && entreesDe(LIBS[cle]).every((k) => k in e.membres),
     `1. '${mot}.${nom}' porte le contenu du fichier pour membres — reçu ${JSON.stringify(e && Object.keys(e.membres))}`);
  ok(e && e.documented === Boolean(LIBS[cle].documented), `1. '${mot}.${nom}' — documented ${JSON.stringify(e && e.documented)}`);
}
for (const [cle, place, nom] of attendues) {
  const mot = motDe(cle);
  const f = parFamille.get(mot);
  const e = f && f.entrees.find((o) => o.nom === nom && o.place === place);
  ok(!!e, `1. '${cle}${place ? '.' + place : ''}.${nom}' n'est pas rendu par la famille '${mot}'`);
  if (!e) continue;
  const brut = place ? LIBS[cle][place][nom] : LIBS[cle][nom];
  const membresAttendus = Object.keys(brut).filter((k) => !k.startsWith('_'));
  ok(membresAttendus.every((k) => k in e.membres) && !('_derive' in e.membres),
     `1. '${mot}.${nom}' — membres ${JSON.stringify(Object.keys(e.membres))} au lieu de ${JSON.stringify(membresAttendus)}`);
  ok(e.derive === (typeof brut._derive === 'string' ? brut._derive : null),
     `1. '${mot}.${nom}' — dérivation ${JSON.stringify(e.derive)} au lieu de ${JSON.stringify(brut._derive ?? null)}`);
}

// ── 2. LA RÉSOLUTION — par la chaîne, puis par le nom nu quand il est unique ────────────────────
const parNom = new Map();
for (const o of objets()) { if (!parNom.has(o.nom)) parNom.set(o.nom, []); parNom.get(o.nom).push(o); }
let uniques = 0, ambigus = 0;
for (const [nom, liste] of parNom) {
  for (const o of liste) {
    const r = objet(`${o.famille}.${nom}`);
    ok(r && !r.ambigu && r.famille === o.famille && r.nom === nom,
       `2. '${o.famille}.${nom}' ne se résout pas par sa chaîne — reçu ${JSON.stringify(r && (r.ambigu || r.chaine))}`);
  }
  const familleUnique = new Set(liste.map((o) => o.famille)).size === 1 && liste.length === 1;
  const nu = objet(nom);
  if (familleUnique) { uniques++; ok(nu && !nu.ambigu && nu.nom === nom, `2. '${nom}' est unique et doit se résoudre nu`); }
  else { ambigus++; ok(nu && Array.isArray(nu.ambigu) && nu.ambigu.length === liste.length,
     `2. '${nom}' est porté par ${liste.length} objets : la porte doit rendre la LISTE, reçu ${JSON.stringify(nu)}`); }
}
ok(uniques >= 500, `2. SOCLE : ${uniques} nom(s) unique(s) — la mesure du 2026-09-02 en donnait 558`);
ok(ambigus >= 10, `2. SOCLE : ${ambigus} nom(s) ambigu(s) — la mesure du 2026-09-02 en donnait 89 (dont 'western', 'gamelan_pelog')`);
ok(objet('zorglubinvente') === null, '2. un nom que rien ne porte rend null');
ok(objet('zorglubinvente.western') === null, '2. une chaîne dont la famille est inventée rend null');

// ── 3. LA PORTE N'EXPOSE NI LES CLÉS DE FICHIER, NI LES CHAMPS DU PAQUET ────────────────────────
for (const m of familles()) {
  const f = famille(m);
  ok(!('resolves' in f.membres) && !('name' in f.membres) && !('section' in f.membres) && !('type' in f.membres) && !('version' in f.membres),
     `3. la racine '${m}' expose un champ du paquet : ${JSON.stringify(Object.keys(f.membres))}`);
}
ok(familles().includes('scale') && familles().includes('alphabet') && familles().includes('sound') && !familles().includes('scales') && !familles().includes('sounds'),
   `3. les familles se nomment par le MOT, jamais par le fichier — reçu ${JSON.stringify(familles())}`);

// ── 4. `documented` SE LIT SUR L'ENTRÉE, CHEZ SON CONTRIBUTEUR ──────────────────────────────────
// Décision de Romain, 2026-09-02 : `test_alphabets` reste publié et NON documenté, à côté de
// `alphabets`, documenté, dans la même famille. La racine de la famille ne garde qu'un contributeur ;
// c'est l'entrée qui porte le signal, et ce volet tient sur TOUTES les entrées de TOUS les catalogues.
for (const [cle, place, nom] of attendues) {
  const mot = motDe(cle);
  const e = parFamille.get(mot).entrees.find((o) => o.nom === nom && o.place === place);
  if (!e) continue;   // déjà rougi au volet 1
  ok(e.documented === Boolean(LIBS[cle].documented),
     `4. '${mot}.${nom}' — documented ${JSON.stringify(e.documented)} au lieu de ${JSON.stringify(Boolean(LIBS[cle].documented))}, la valeur de son contributeur '${cle}'`);
}
{
  // Le témoin qui DISCRIMINE : une famille à deux contributeurs de statuts opposés. Une porte qui
  // recopierait la racine rendrait la même valeur sur les 24 ; celle-ci en rend deux.
  const contributeurs = Object.keys(LIBS).filter((cle) => LIBS[cle] && (LIBS[cle].resolves || cle) === 'alphabet');
  const statuts = new Set(contributeurs.map((cle) => Boolean(LIBS[cle].documented)));
  ok(contributeurs.length >= 2 && statuts.size === 2,
     `4. SOCLE : la famille 'alphabet' doit être servie par deux catalogues de statuts opposés — reçu ${JSON.stringify(contributeurs.map((c) => [c, Boolean(LIBS[c].documented)]))}`);
  const alphabet = parFamille.get('alphabet');
  const documentes = alphabet.entrees.filter((o) => o.documented).length;
  const non = alphabet.entrees.filter((o) => !o.documented).length;
  ok(documentes > 0 && non > 0,
     `4. la famille 'alphabet' rend des entrées documentées ET non documentées — reçu ${documentes} / ${non}`);
  ok(objet('alphabet.western').documented === true && objet('alphabet.abc').documented === false,
     `4. 'alphabet.western' est documenté, 'alphabet.abc' ne l'est pas — reçu ${JSON.stringify([objet('alphabet.western').documented, objet('alphabet.abc').documented])}`);
}

// ── 5. LA DÉRIVATION SE RÉSOUT À LA PORTE — un objet porte les membres de son prototype qu'il n'écrit pas
// Romain, 2026-09-02 : ce qu'un exemplaire écrit gagne, ce qu'il n'écrit pas vient de son prototype, à tous
// les niveaux ; l'octaviation par défaut vit dans `def alphabet`, et chaque alphabet en hérite.
{
  let herites = 0;
  for (const o of objets()) {
    if (!o.derive) continue;
    const proto = objet(o.derive);
    if (!proto || proto.ambigu) continue;
    for (const [k, v] of Object.entries(proto.membres)) {
      const brut = (LIBS[o.famille === 'core' ? 'core' : Object.keys(LIBS).find((c) => ((LIBS[c] && LIBS[c].resolves) || c) === o.famille && (o.place ? LIBS[c][o.place] && LIBS[c][o.place][o.nom] : LIBS[c][o.nom]))] || {});
      const propre = o.place ? brut[o.place] && brut[o.place][o.nom] : brut[o.nom];
      if (propre && k in propre) continue;   // écrit par l'exemplaire : il gagne
      herites++;
      ok(k in o.membres && JSON.stringify(o.membres[k]) === JSON.stringify(v),
         `5. '${o.chaine.join('.')}' dérive de '${o.derive}' et n'écrit pas '${k}' : il doit le porter tel que le prototype le déclare`);
    }
  }
  ok(herites >= 20, `5. SOCLE : ${herites} membre(s) hérité(s) vérifié(s) — la mesure du 2026-09-02 en donnait 39 (scope ×24, octaves ×15)`);
  const arabic = objet('alphabet.arabic');
  ok(arabic && arabic.membres.octaves === 'western' && JSON.stringify(arabic.membres.scope) === '["scene"]',
     `5. 'alphabet.arabic' porte 'octaves:western' et 'scope' hérités — reçu ${JSON.stringify(arabic && arabic.membres)}`);
  const sargam = objet('alphabet.sargam');
  ok(sargam && sargam.membres.octaves === 'saptak', `5. 'alphabet.sargam' écrit ses octaves et les garde — reçu ${JSON.stringify(sargam && sargam.membres.octaves)}`);
}

ok(passe >= 2000, `le garde doit avoir EXAMINÉ(${passe} assertions)`);
if (echecs.length) {
  console.error(`[porte des objets] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs.slice(0, 20)) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[porte des objets] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · ${attendues.length} entrées, ${familles().length} familles, ${uniques} noms uniques, ${ambigus} ambigus`);
