#!/usr/bin/env node
/**
 * GARDE — un fichier de données n'agrandit pas le langage en le commentant.
 *
 * CE QUI EST ARRIVÉ, le 2026-07-27 : j'ai posé une clé d'explication dans une section de contrôles
 * de `lib/controls.json`. Le chargeur ne filtrait qu'un seul nom de clé (`_comment`) — ma ligne de
 * documentation est donc entrée AU VOCABULAIRE comme un contrôle, en silence. 58 contrôles
 * chargés, 57 après correction : le 58e était ma propre prose.
 *
 * POURQUOI C'EST UNE FAILLE DE FRONTIÈRE et pas un bug de chargeur (architecte, 2026-07-27) : la
 * limite entre la DONNÉE et le LANGAGE se franchissait par accident, dans le sens qui agrandit le
 * langage. Le mot ainsi créé se serait comporté comme un vrai mot — réservant son nom, avalant
 * l'écriture d'un auteur qui l'aurait porté (c'est exactement ce que `mute` venait de faire à la
 * démo du patchbay le même jour).
 *
 * LISTE BLANCHE, PAS LISTE NOIRE — la correction demandée, et la seule qui tienne. Exclure des
 * noms de clés (`_comment`, puis `_doc`, puis…) laisse toujours entrer la prochaine clé de
 * commodité. On exige donc la FORME d'une déclaration : `args` ET `description`. Ce critère est
 * MESURÉ, pas choisi — les 57 contrôles du dépôt les portent tous les deux. Tout le reste est
 * refusé BRUYAMMENT, à la seule exception de la documentation préfixée `_`, admise explicitement.
 */
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import { registerLib, loadLibsFromDirectives, clearRegistry, registerAll } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const charger = (nom, contenu) => {
  registerLib(nom, contenu);
  try { return { ctx: loadLibsFromDirectives([{ name: nom }]), erreur: null }; }
  catch (e) { return { ctx: null, erreur: e.message }; }
};
const CONTROLE_VALIDE = { args: ['value'], description: 'contrôle bien formé' };

// ─── 1. SOCLE — le vocabulaire réel charge, entier ───────────────────────────────────────────
{
  const ctx = loadLibsFromDirectives(Object.keys(LIBS).map((n) => ({ name: n })));
  ok(ctx.controlNames.size >= 50,
     `1. toutes les librairies du dépôt doivent charger — ${ctx.controlNames.size} contrôle(s)`);
  const prose = [...ctx.controlNames].filter((n) => n.startsWith('_'));
  ok(prose.length === 0,
     `1. AUCUN nom de contrôle ne doit commencer par '_' — reçu : ${JSON.stringify(prose)}`);
}

// ─── 2. LES TROIS PLACEMENTS, pas celui du ticket ────────────────────────────────────────────
// Une section de contrôles se déclare de trois façons dans une librairie : `controls`, `engine`,
// et `groups` (ex-`runtime`, renommé 2026-08-10 — le nom `runtime` est retiré partout, remplacé
// par `resolvedBy` ; lui-même en sous-groupes OU à plat). La clé fautive était dans UNE d'entre
// elles ; garder cette seule-là aurait laissé les autres ouvertes.
const PLACEMENTS = [
  ['controls', (e) => ({ controls: { vel: CONTROLE_VALIDE, ...e } })],
  ['engine', (e) => ({ engine: { vel: CONTROLE_VALIDE, ...e } })],
  ['groups en sous-groupe', (e) => ({ groups: { musical: { vel: CONTROLE_VALIDE, ...e } } })],
  ['groups à plat', (e) => ({ groups: { vel: CONTROLE_VALIDE, ...e } })],
];

// 2a. La documentation préfixée passe, sous toutes ses formes — c'est la convention du dépôt.
for (const [ou, batir] of PLACEMENTS) {
  for (const [forme, valeur] of [
    ['une chaîne', 'une explication en prose'],
    ['un tableau', ['ligne une', 'ligne deux']],
    ['un objet', { pourquoi: 'parce que' }],
  ]) {
    const { ctx, erreur } = charger(`essai_doc_${ou}_${forme}`.replace(/\W/g, '_'),
                                    batir({ _note_de_service: valeur }));
    ok(erreur === null, `2a. une clé '_' (${forme}) dans '${ou}' doit être admise — reçu : ${erreur}`);
    ok(ctx?.controlNames.has('vel'), `2a. et le vrai contrôle voisin doit charger (${ou}, ${forme})`);
    ok(!ctx?.controlNames.has('_note_de_service'),
       `2a. la documentation ne doit JAMAIS entrer au vocabulaire (${ou}, ${forme})`);
  }
}

// 2b. Tout le reste REFUSE, et le refus NOMME la librairie et la clé fautive.
for (const [ou, batir] of PLACEMENTS) {
  for (const [forme, valeur] of [
    ['une chaîne nue', 'clé de commodité sans préfixe'],
    ['un tableau nu', ['a', 'b']],
    ['un objet sans args ni description', { note: 'incomplet' }],
    ['un objet avec description seule', { description: 'il manque args' }],
    ['un objet avec args seuls', { args: [] }],
  ]) {
    const nom = `essai_refus_${ou}_${forme}`.replace(/\W/g, '_');
    const { erreur } = charger(nom, batir({ commodite: valeur }));
    ok(erreur !== null,
       `2b. '${forme}' dans '${ou}' doit être REFUSÉE — un fichier de données n'agrandit pas le langage`);
    ok(erreur?.includes('commodite'), `2b. le refus doit NOMMER la clé fautive (${ou}, ${forme}) — reçu : ${String(erreur).slice(0, 100)}`);
    ok(erreur?.includes(nom), `2b. et NOMMER la librairie (${ou}, ${forme}) — reçu : ${String(erreur).slice(0, 100)}`);
  }
}

// ─── 3. Un contrôle BIEN FORMÉ passe partout — on n'a pas fermé la porte au lieu de la garder ─
for (const [ou, batir] of PLACEMENTS) {
  const { ctx, erreur } = charger(`essai_ok_${ou}`.replace(/\W/g, '_'),
                                  batir({ inedit: { args: [], description: 'contrôle sans argument' } }));
  ok(erreur === null, `3. un contrôle bien formé dans '${ou}' doit charger — reçu : ${erreur}`);
  ok(ctx?.controlNames.has('inedit'), `3. et il doit entrer au vocabulaire (${ou})`);
}

// Le registre a été sali par les librairies d'essai : on le rend propre aux tests qui suivent.
clearRegistry();
registerAll(LIBS);

if (echecs.length) {
  console.error(`❌ frontière donnée → langage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une donnée n'agrandit pas le langage — ${passe} vérification(s) passée(s) sur ${PLACEMENTS.length} placement(s)`);
}
