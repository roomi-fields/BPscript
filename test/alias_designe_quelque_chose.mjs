#!/usr/bin/env node
/**
 * GARDE — une valeur PORTÉE de `@alias` doit nommer un référent DÉCLARÉ.
 *
 * SIGNALÉE par bp3-frontend le 2026-07-26 : une correspondance dont la portée était un mot INVENTÉ
 * compilait. Il a refusé de s'appuyer dessus pour traduire, alors qu'il aurait pu — ça passait.
 * (L'écriture de l'époque employait une flèche ; elle n'est pas reproduite — la flèche est une
 * règle de production et rien d'autre, la citer même au passé donnerait à recopier une faute.)
 *
 * ⚠️ LE DIAGNOSTIC D'ORIGINE ÉTAIT INEXACT, et c'est instructif : on avait conclu que la directive
 * « n'arrive pas dans l'arbre » parce qu'elle est absente de `ast.directives`. Elle arrive — dans
 * son canal propre. Ce n'était donc pas un silence de transport mais une ABSENCE DE
 * VALIDATION. Chercher une chose au mauvais endroit et conclure à son absence est le même piège
 * que le filtre d'adresses qui n'acceptait que les alphabets : on ne voit pas ce qu'on ne regarde
 * pas. La garde vérifie donc `ast.aliases`, là où la donnée vit.
 *
 * CE QUI EST DÉCLARABLE (docs/design/SCENES.md §6.1-6.2) — aucune forme créée ici, on vérifie
 * celles qui existent : une SCÈNE déclarée, un LABEL posé sur un élément, ou `*`.
 *
 * ⚠️ `@alias note.C#2` TOMBE, et c'est VOULU : la façon dont une note entrante se déclare comme
 * source n'existe pas encore dans le langage — la question est chez Romain. Fermer le silence
 * n'est pas remplir le vide. Le jour où la forme sera créée, ce garde devra l'accueillir ; d'ici
 * là, l'accepter fabriquerait une correspondance morte.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compile = (corps) => {
  try { return compileToBPxAST(`@core\n@alphabet.western:midi\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. LA FORME NOUVELLE — un NOM, puis sa SOURCE ───────────────────────────────────────────
for (const [corps, quoi] of [
  ['@var touches in.keyboard\n@alias depart touches.z\n@mode:ord\nS -> C4', "une ENTRÉE déclarée et son étiquette"],
  ['@alias breath cc:2\n@mode:ord\nS -> C4', 'un contrôleur continu'],
  ['@alias horloge osc:/clock\n@mode:ord\nS -> C4', 'une adresse OSC'],
  ['@trigger sync1:midi\n@alias depart sync1\n@mode:ord\nS -> C4', 'un trigger déclaré'],
  ['@alias ratio groove.vel\n@mode:ord\nS -> groove:{C4 D4, E4}', "l'étiquette d'un groupe polymétrique"],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `1. ${quoi} doit passer — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

// ─── 2. LA LIAISON ARRIVE, avec son NOM ──────────────────────────────────────────────────────
{
  const r = compile('@alias breath cc:2\n@mode:ord\nS -> C4');
  const m = (r.ast?.aliases || [])[0];
  ok((r.ast?.aliases || []).length === 1, "2. l'alias doit ARRIVER dans ast.aliases — c'est son canal");
  ok(m?.name === 'breath' && m?.source?.kind === 'cc' && m?.source?.number === 2,
     `2. son NOM et sa SOURCE doivent être portés tels qu'écrits — reçu : ${JSON.stringify(m)}`);
  ok(m?.target === undefined && m?.arrow === undefined,
     `2. et il n'y a plus ni cible ni flèche : le NOM est la cible — reçu : ${JSON.stringify(m)}`);
}

// ─── 3. CE QUI NE DÉSIGNE RIEN CRIE, et le message nomme le mot fautif ───────────────────────
for (const [corps, quoi, mot] of [
  ['@alias depart foobar.z\n@mode:ord\nS -> C4', 'une portée inventée', 'foobar'],
  ['@alias ratio kick.vel\n@mode:ord\nS -> C4 D4', 'un label JAMAIS POSÉ', 'kick'],
  ['@alias depart inconnu\n@mode:ord\nS -> C4', 'un nom nu inconnu', 'inconnu'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit CRIER — '${corps.split('\n')[0]}'`);
  ok(msg.includes(mot), `3. le message doit NOMMER le mot fautif '${mot}' — reçu : ${msg.slice(0, 110)}`);
}

// ─── 4. LES FORMES SUPPRIMÉES REFUSENT, ET NOMMENT LEUR DISPARITION ──────────────────────────
// ⚠️ Un mot supprimé qui retombe sur un message de parse illisible fait deviner l'auteur. Chacune
// nomme ce qui a disparu ET donne la réécriture. La forme du refus est vérifiée sur DEUX points :
// qu'il refuse, et que son message porte de quoi se corriger — un refus muet vaut à peine mieux.
//
// ⚠️ `@map` FIGURE ICI DEPUIS LE 2026-07-27 AU SOIR, et c'est l'inverse du matin même : la
// directive de correspondance est ABANDONNÉE. L'argument, absent de tous les inventaires (y
// compris du mien) : **une directive ne se débranche pas**. `\\>>` coupe un câble pendant que ça
// joue ; aucune déclaration ne sait faire ça. Entre deux écritures pour brancher A sur B, la
// moins puissante part. Mon inventaire du matin comparait la directive à `@macro` et concluait
// juste sur ce couple — il ne l'avait jamais comparée au CÂBLAGE, le geste qu'elle faisait.
for (const [corps, quoi, attendu, reecriture] of [
  ['@map breath cc:2\n@mode:ord\nS -> C4', '@map, ABANDONNÉ le 2026-07-27 au soir', 'ABANDONNÉ', '>>'],
  ['@map breath = cc:2\n@mode:ord\nS -> C4', '@map, quelle que soit sa suite', 'ABANDONNÉ', '@alias'],
  ['@alias breath = cc:2\n@mode:ord\nS -> C4', "le signe '=', supprimé de TOUT le langage", '=', '@alias breath'],
  ['@alias breath -> cc:2\n@mode:ord\nS -> C4', 'la flèche dans une directive', 'production', '@alias breath'],
  ['@def riff = C4\n@mode:ord\nS -> riff', "le signe '=' dans une definition non plus", '=', '@def riff'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `4. ${quoi} doit être REFUSÉ`);
  ok(msg.includes(attendu),
     `4. et le refus doit NOMMER la disparition ('${attendu}') — reçu : ${msg.slice(0, 130)}`);
  // ⚠️ La RÉÉCRITURE est vérifiée nommément, pas par un motif large : un motif qui accepte
  // n'importe quelle graphie de directive laisserait passer un refus qui constate sans corriger.
  ok(msg.includes(reecriture),
     `4. et donner la RÉÉCRITURE ('${reecriture}'), pas seulement constater — reçu : ${msg.slice(0, 130)}`);
}

// ─── 4bis. `@map` NE GARDE AUCUN APPELANT VIVANT ─────────────────────────────────────────────
// Exigence explicite du lot [1042] : « garde qui ÉCHOUE si @map garde un appelant vivant ».
// Le mot ne doit plus rien produire NI figurer au vocabulaire réservé — un mot qui reste déclaré
// quelque part est une voie parallèle en attente de se rouvrir.
{
  const r = compile('@map breath cc:2\n@mode:ord\nS -> C4');
  ok(!r.ast, "4bis. '@map' ne doit produire AUCUN arbre — pas d'AST dégradé qui laisserait passer");
  const VOCAB = LIBS['core']?.schema?.reservedDirectives || [];
  ok(!VOCAB.includes('map'),
     "4bis. 'map' doit avoir quitté le vocabulaire réservé — le mot se supprime AVEC sa directive, "
     + 'sinon il reste joignable et la voie parallèle se rouvre toute seule');
  ok(VOCAB.includes('alias'),
     "4bis. et 'alias' doit y être revenu — la directive qui reste doit être déclarée, sinon elle "
     + "n'est vivante que dans le parseur");
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
  console.error(`❌ désignation @alias : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ désignation @alias, et '@map' sans aucun appelant vivant — ${passe} vérification(s) passée(s)`);
}
