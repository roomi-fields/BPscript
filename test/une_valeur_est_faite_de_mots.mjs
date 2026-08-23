#!/usr/bin/env node
/**
 * UNE VALEUR EST FAITE DE MOTS — ET UN SIGNE QUI OUVRE UNE STRUCTURE N'EN EST PAS UN.
 *
 * ⛔ CE QUI SE PASSAIT, MESURÉ SUR L'ARBRE LE 2026-08-24. Le lecteur du corps NU d'une déclaration
 * prenait TOUT jusqu'au bout de la ligne comme parties de la valeur :
 *
 *     def fatbass for:sub37 (device(preset:bass-init))
 *     ⇒ name:"fatbass"  ·  kind:"terminal"  ·  for = ["sub37", "(device(preset:bass-init))"]
 *
 * Le nom TRONQUÉ écrase l'entrée `fatbass` du même catalogue, la nature bascule de `prereglage` à
 * `terminal`, et le corps entier devient du texte. Zéro erreur, zéro avertissement.
 *
 * ⚠️ ET LE DÉFAUT NE VIVAIT PAS SUR LA PARENTHÈSE : quinze signes étaient avalés de la même façon.
 * Réparer celui qui s'est montré aurait laissé les quatorze autres — d'où la MATRICE ci-dessous,
 * qui énumère les signes que le tokenizer produit au lieu de re-vérifier celui qui a mordu.
 *
 * ⚠️ CE QUI A RENDU LE DÉFAUT VISIBLE EST UN ACCIDENT, et c'est ce qui le rend grave : mon
 * convertisseur ne l'a attrapé que parce qu'un doublon de section rendait la source invalide par
 * ailleurs. Sans lui, `voices` sortait « ✅ écrit » avec une donnée fausse. Compiler ne prouve rien.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const lire = (ligne) => {
  const r = compileToBPxAST(`core\n${ligne}\n\n-----\nS -> -\n`, {});
  return { ok: !(r.errors || []).length, err: String((r.errors || [])[0]?.message || ''),
           def: (r.ast?.defs || [])[0] || null };
};

// ── A. LA MATRICE DES SIGNES — chacun doit être REFUSÉ dans une valeur ───────────────────────
// Les signes que le tokenizer produit et qui ouvrent une structure. Ce n'est pas la liste de ce
// qui a mordu : c'est celle de ce que le langage sait écrire ailleurs.
{
  const SIGNES = ['(b:2)', ')', '[b]', ']', '{b}', '}', '|b|', '<b>', '>', '!b', '?b',
                  '@b', '$b', '&b', '~b', '*b', '=b'];
  for (const s of SIGNES) {
    const r = lire(`def x a:1 ${s}`);
    ok(!r.ok, `A. « ${s} » doit être REFUSÉ dans la valeur de 'a' — il a été ACCEPTÉ, et rendu `
            + `${JSON.stringify(r.def?.keys?.a?.value)}. Un signe avalé devient une partie de texte.`);
  }
}

// ── A2. ⛔ LE CODE TYPÉ — le quinzième signe, que ma propre liste annonçait comme couvert ────
// ⛔ TROUVÉ PAR BP3-FRONTEND EN ÉPROUVANT MON PRÉAVIS, pas par moi. J'avais mis l'accent grave dans
// le jeu positif — il porte une voix de code — et le défaut survivait entier sur lui :
//     def x a:1 `js: 1`   ⇒   a = ["1", "js: 1"]   zéro erreur
// Le profil exact qu'on répare. Un code typé OUVRE une valeur, il ne la prolonge pas.
{
  const r = lire('def x a:1 `js: 1`');
  ok(!r.ok, `A2. du code typé en SECONDE partie doit être refusé — reçu `
          + `${JSON.stringify(r.def?.keys?.a?.value)}. C'est le jumeau vivant du cas 'fatbass'.`);
  // Les deux formes de la bible où le code typé EST la valeur restent vivantes.
  for (const [l, ligne] of [['337', 'def fondu phase `js: (t) => t`'], ['526', 'def noir `py: d.blackout()`']]) {
    const t = lire(ligne);
    ok(t.ok, `A2-borne. LANGUAGE.md:${l} — « ${ligne} » doit rester vivant : ${t.err.slice(0, 80)}`);
  }
  // ⛔ ET LE DISCRIMINANT EST CE QUI PRÉCÈDE, PAS L'ACCENT GRAVE. Kanopi a mesuré la distinction
  // avant moi : une PAIRE en première partie fait du code typé une seconde partie — refusé ; un
  // NOM NU fait basculer le lecteur en `kind:"code"` avant tout découpage — vivant. Sans ce
  // témoin, « le code typé est refusé » ne se distingue pas de « le lecteur de code est mort ».
  const code = lire('def wobble phase `js: (t, dur) => 0.5`');
  ok(code.ok && code.def?.kind === 'code',
     `A2-témoin. une voix de code doit rendre kind:"code" — reçu ${JSON.stringify(code.def?.kind)}. `
   + `C'est le nom NU en tête qui fait basculer le lecteur, pas l'accent grave.`);
}

// ── B. ⛔ LE CAS QUI A MOTIVÉ — et c'est l'ARBRE qu'on mesure, pas le verdict ─────────────────
{
  const r = lire('def fatbass for:sub37 (device(preset:bass-init))');
  ok(!r.ok, `B. ⛔ « def fatbass for:sub37 (…) » doit être REFUSÉ. Reçu : name=${JSON.stringify(r.def?.name)} `
          + `kind=${JSON.stringify(r.def?.kind)} — un nom tronqué écrase l'entrée voisine en silence.`);
  // Le témoin qui discrimine : la MÊME déclaration sans le suffixe reste vivante et garde sa nature.
  const t = lire('def fatbass (device(preset:bass-init))');
  ok(t.ok && t.def?.name === 'fatbass' && t.def?.kind === 'prereglage',
     `B-témoin. la déclaration SANS le nom illisible doit rester un préréglage nommé 'fatbass' — `
   + `reçu name=${JSON.stringify(t.def?.name)} kind=${JSON.stringify(t.def?.kind)}. Sans ce témoin, `
   + `« la forme est refusée » ne se distingue pas de « le lecteur a cessé de lire les préréglages ».`);
}

// ── C. LES BORNES — ce qui compose un MOT doit rester vivant ─────────────────────────────────
// Chacune vient de la donnée ou de la bible, aucune n'est inventée pour le banc.
{
  const VIVANTES = [
    ['un nombre',              'def x hz:440'],
    ['un souligné initial',    'def x bp3:_vel'],
    ['un rapport',             'def x r:3/2'],
    ['un dièse',               'def x n:C#4'],
    ['un texte',               'def x s:"un mot"'],
    ['un composant pointé',    'def ka voice.sec'],              // LANGUAGE.md:366
    ['un booléen',             'def muet sounding:false'],       // LANGUAGE.md:368
    // ⚠️ L'ENVELOPPE EST NOMMÉE : `range:0 127` vit dans un corps NU et refuse dans un corps
    // PARENTHÉSÉ — bp3-frontend l'a éprouvé dans cinq enveloppes dont aucune n'était celle-ci, et
    // a conclu que la forme était morte. Elle ne l'est pas ; elle vit dans une seule des deux.
    ['deux parties, corps NU',  'def x range:0 127'],
    ['une structure de noms',  'def cadence sa re ga pa'],       // LANGUAGE.md:336
    ['un corps parenthésé',    'def x (a:1, b(c:2))'],
    // ⛔ CES QUATRE-LÀ VIENNENT DE VOISINS QUI ONT ÉPROUVÉ MON PRÉAVIS, pas de ma liste. Atlas
    // enseigne la transformation paramétrée dans son aide publiée et a demandé qu'elle ne tombe
    // pas « par le bord » ; Kanopi porte les deux voix de code en vitrine. Aucune n'était dans mes
    // bornes, et toutes touchent l'espace que ce refus resserre.
    ['une transformation',     'def accent(x) x(vel:120)'],      // atlas, aide publiée
    ['un préréglage',          'def fort (vel:100)'],            // atlas
    ['une voix de code',       'def wobble phase `js: (t, dur) => 0.5`'],   // kanopi, cv-backtick
    ['du code sans convention', 'def wobble `js: 1`'],           // kanopi
  ];
  for (const [quoi, ligne] of VIVANTES) {
    const r = lire(ligne);
    ok(r.ok, `C. ${quoi} — « ${ligne} » doit rester vivant : ${r.err.slice(0, 90)}`);
  }
  // ⛔ ET LA VALEUR À DEUX PARTIES DOIT RENDRE DEUX PARTIES, pas une chaîne recollée. Le refus ne
  // doit pas avoir emporté la règle qu'il borde.
  const r = lire('def x range:0 127');
  ok(JSON.stringify(r.def?.keys?.range?.value) === '["0","127"]',
     `C. ⛔ « range:0 127 » doit rendre DEUX parties — reçu ${JSON.stringify(r.def?.keys?.range?.value)}. `
   + `Un lecteur qui les recolle rendait « 0127 », et c'était une corruption silencieuse.`);
}

// ── D. UN COMPTE, ET LE REFUS D'AVOIR EXAMINÉ ZÉRO ───────────────────────────────────────────
ok(passe > 0, `D. ZÉRO vérification exécutée — ce garde n'a rien examiné.`);

if (echecs.length) {
  console.error(`❌ une valeur est faite de mots : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ une valeur est faite de mots — dix-sept signes de structure sont refusés dans une `
  + `valeur de corps nu, le nom illisible qui écrasait une entrée voisine est arrêté, et les `
  + `quatorze formes vivantes de la bible, de la donnée et des scènes des voisins passent. `
  + `${passe} vérification(s) passée(s).`);
