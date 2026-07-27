#!/usr/bin/env node
/**
 * GARDE — une extrémité PORTÉE de `@map` doit nommer un référent DÉCLARÉ.
 *
 * SIGNALÉE par bp3-frontend le 2026-07-26 : une correspondance dont la portée était un mot INVENTÉ
 * compilait. Il a refusé de s'appuyer dessus pour traduire, alors qu'il aurait pu — ça passait.
 * (L'écriture de l'époque employait une flèche ; elle n'est pas reproduite — la flèche est une
 * règle de production et rien d'autre, la citer même au passé donnerait à recopier une faute.)
 *
 * ⚠️ LE DIAGNOSTIC D'ORIGINE ÉTAIT INEXACT, et c'est instructif : on avait conclu que la directive
 * « n'arrive pas dans l'arbre » parce qu'elle est absente de `ast.directives`. Elle arrive — dans
 * `ast.maps`, son canal propre. Ce n'était donc pas un silence de transport mais une ABSENCE DE
 * VALIDATION. Chercher une chose au mauvais endroit et conclure à son absence est le même piège
 * que le filtre d'adresses qui n'acceptait que les alphabets : on ne voit pas ce qu'on ne regarde
 * pas. La garde vérifie donc `ast.maps`, là où la donnée vit.
 *
 * CE QUI EST DÉCLARABLE (docs/design/SCENES.md §6.1-6.2) — aucune forme créée ici, on vérifie
 * celles qui existent : une SCÈNE déclarée, un LABEL posé sur un élément, ou `*`.
 *
 * ⚠️ `@map note.C#2` TOMBE, et c'est VOULU : la façon dont une note entrante se déclare comme
 * source n'existe pas encore dans le langage — la question est chez Romain. Fermer le silence
 * n'est pas remplir le vide. Le jour où la forme sera créée, ce garde devra l'accueillir ; d'ici
 * là, l'accepter fabriquerait une correspondance morte.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compile = (corps) => {
  try { return compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. LA FORME NOUVELLE — un NOM, puis sa SOURCE ───────────────────────────────────────────
for (const [corps, quoi] of [
  ['@in touches transport.keyboard\n@map depart touches.z\n@mode:ord\nS -> C4', "une ENTRÉE déclarée et son étiquette"],
  ['@map breath cc:2\n@mode:ord\nS -> C4', 'un contrôleur continu'],
  ['@map horloge osc:/clock\n@mode:ord\nS -> C4', 'une adresse OSC'],
  ['@trigger sync1:midi\n@map depart sync1\n@mode:ord\nS -> C4', 'un trigger déclaré'],
  ['@map ratio kick.vel\n@mode:ord\nS -> C4@kick D4', 'un label posé sur un élément'],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `1. ${quoi} doit passer — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

// ─── 2. LA LIAISON ARRIVE, avec son NOM ──────────────────────────────────────────────────────
{
  const r = compile('@map breath cc:2\n@mode:ord\nS -> C4');
  const m = (r.ast?.maps || [])[0];
  ok((r.ast?.maps || []).length === 1, "2. la liaison doit ARRIVER dans ast.maps — c'est son canal");
  ok(m?.name === 'breath' && m?.source?.kind === 'cc' && m?.source?.number === 2,
     `2. son NOM et sa SOURCE doivent être portés tels qu'écrits — reçu : ${JSON.stringify(m)}`);
  ok(m?.target === undefined && m?.arrow === undefined,
     `2. et il n'y a plus ni cible ni flèche : le NOM est la cible — reçu : ${JSON.stringify(m)}`);
}

// ─── 3. CE QUI NE DÉSIGNE RIEN CRIE, et le message nomme le mot fautif ───────────────────────
for (const [corps, quoi, mot] of [
  ['@map depart foobar.z\n@mode:ord\nS -> C4', 'une portée inventée', 'foobar'],
  ['@map ratio kick.vel\n@mode:ord\nS -> C4 D4', 'un label JAMAIS POSÉ', 'kick'],
  ['@map depart inconnu\n@mode:ord\nS -> C4', 'un nom nu inconnu', 'inconnu'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit CRIER — '${corps.split('\n')[0]}'`);
  ok(msg.includes(mot), `3. le message doit NOMMER le mot fautif '${mot}' — reçu : ${msg.slice(0, 110)}`);
}

// ─── 4. LES TROIS FORMES SUPPRIMÉES REFUSENT, ET NOMMENT LEUR DISPARITION ────────────────────
// ⚠️ Un mot supprimé qui retombe sur un message de parse illisible (« attendu une flèche ») fait
// deviner l'auteur. Chacune des trois nomme ce qui a disparu ET donne la réécriture.
for (const [corps, quoi, attendu] of [
  ['@alias breath = cc:2\n@mode:ord\nS -> C4', "@alias, absorbé par @map", '@alias'],
  ['@map breath = cc:2\n@mode:ord\nS -> C4', "le signe '=', supprimé", '='],
  ['@map cc:1 -> [x]\n@mode:ord\nS -> C4', 'la flèche, redevenue une production', 'NOMMER'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `4. ${quoi} doit être REFUSÉ`);
  ok(msg.includes('2026-07-27') || msg.includes(attendu) || msg.includes('NOMMER'),
     `4. et le refus doit NOMMER la disparition avec sa date — reçu : ${msg.slice(0, 130)}`);
}

// ─── 5. LA FLÈCHE EST REDEVENUE EXCLUSIVEMENT UNE PRODUCTION ─────────────────────────────────
// Le seul autre site qui l'employait pour du câblage était cette directive — mesuré sur les deux
// sites du parseur. Une règle, elle, doit continuer de l'accepter dans ses trois sens.
for (const [regle, quoi] of [
  ['S -> C4 D4', 'production vers la droite'],
  ['S <- C4 D4', 'production vers la gauche'],
  ['S <> C4 D4', 'production bidirectionnelle'],
]) {
  const r = compile(`@mode:ord\n${regle}`);
  ok((r.errors || []).length === 0,
     `5. la flèche doit rester une production (${quoi}) — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ liaison @map : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ liaison @map — ${passe} vérification(s) passée(s)`);
}
