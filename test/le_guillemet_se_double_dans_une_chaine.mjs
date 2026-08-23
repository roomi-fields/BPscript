#!/usr/bin/env node
/**
 * LE GUILLEMET SE DOUBLE DANS UNE CHAÎNE — ET AVANT, IL DISPARAISSAIT EN SILENCE.
 *
 * ARBITRAGE DE ROMAIN, 2026-08-23 : dans une chaîne, le guillemet se double. La règle n'était écrite
 * NULLE PART — ni dans les 244 décisions de l'index, ni dans `LANGUAGE.md`, ni dans `FORME-OBJET.md`.
 * Elle est consignée en étant câblée : un mot de langage qui ne vit dans aucun code est un souvenir.
 *
 * ⛔ CE QUE CE GARDE FERME N'ÉTAIT PAS UN REFUS, ET C'EST PIRE QU'UN REFUS. Le lecteur fermait la
 * chaîne au premier guillemet puis rouvrait : `"scale ""Ma05"" fin"` rendait TROIS jetons — `scale `,
 * `Ma05`, ` fin` — que la suite concaténait en `scale Ma05 fin`. Les guillemets DISPARAISSAIENT et le
 * texte sortait faux. L'auteur écrit une chose, le consommateur en reçoit une autre, et aucune des
 * deux frontières ne dit un mot. C'est la famille du poids muet.
 *
 * ⚠️ LE TÉMOIN QUI COMPTE EST LA CHAÎNE VIDE, PAS LE DOUBLEMENT. `""` s'écrit avec deux guillemets
 * accolés, exactement comme un doublement, et `lib/octaves.bpsl` s'en sert HUIT fois — `separator:""`,
 * `default:""`, et dans une liste de registres. Ce qui les distingue est ce qui SUIT le guillemet
 * fermant : une virgule ferme, un guillemet double. Un câblage qui confondrait les deux viderait
 * silencieusement la donnée d'octaves, et le bundle serait toujours vert de forme.
 */
import { readFileSync } from 'node:fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * Les chaînes que le tokenizer rend pour une ligne de tête de scène.
 *
 * ⛔ LE JET SE CAPTURE, IL NE TRAVERSE PAS. Éprouvé par injection : un câblage qui avale la chaîne
 * VIDE fait déborder la lecture sur le reste de la ligne, et le découpeur jette « caractère
 * inattendu '^' » — sur un caractère qui n'a rien à voir. Sans cette capture, le banc PLANTAIT à la
 * première ligne et ses vingt-cinq assertions suivantes ne s'exécutaient pas : il aurait signalé un
 * défaut, en cachant l'essentiel de ce qu'il garde. C'est le défaut nommé dans `run_guards.mjs`,
 * rencontré ici pour de vrai.
 */
const chaines = (ligne) => {
  try {
    return tokenize(`core\ntempo:120\n${ligne}\n\n-----\nS -> -\n`)
      .filter((t) => t.type === 'STRING').map((t) => t.value);
  } catch (e) {
    return { jet: String(e.message).slice(0, 90) };
  }
};

// ── A. LE DOUBLEMENT REND UN GUILLEMET LITTÉRAL, DANS UNE SEULE CHAÎNE ────────────────────────
// ⛔ « une seule » est la moitié qui compte : trois jetons concaténés donnent le même TEXTE à un
// caractère près, et c'est ce qui rendait le défaut invisible.
{
  const cas = [
    ['def t (d:"scale ""Ma05"" fin")', ['scale "Ma05" fin'], 'au milieu'],
    ['def t (d:"""Ma05"" fin")',       ['"Ma05" fin'],       'en tête'],
    ['def t (d:"fin ""Ma05""")',       ['fin "Ma05"'],       'en queue'],
    ['def t (d:"""")',                 ['"'],                'un guillemet SEUL'],
    ['def t (d:"""""")',               ['""'],               'deux guillemets à la suite'],
  ];
  for (const [ligne, attendu, ou] of cas) {
    const vu = chaines(ligne);
    if (vu && vu.jet) { echecs.push(`A. doublement ${ou} — le découpeur JETTE : ${vu.jet}`); continue; }
    ok(vu.length === attendu.length,
       `A. doublement ${ou} — ${attendu.length} chaîne(s) attendue(s), ${vu.length} rendue(s) : `
     + `${JSON.stringify(vu)}. Plusieurs jetons se concatènent plus loin et le guillemet se perd.`);
    ok(JSON.stringify(vu) === JSON.stringify(attendu),
       `A. doublement ${ou} — attendu ${JSON.stringify(attendu)}, rendu ${JSON.stringify(vu)}`);
  }
}

// ── B. LE TÉMOIN QUI DISCRIMINE — LA CHAÎNE VIDE N'EST PAS UN DOUBLEMENT ──────────────────────
// Sans lui, « le doublement marche » ne se distingue pas de « deux guillemets accolés fusionnent
// toujours », et la donnée d'octaves partirait sans un signe.
{
  const cas = [
    ['def t (d:"")',                              [''],                   'seule'],
    ['def t (a:"", b:"")',                        ['', ''],               'deux fois'],
    ['def t (registers(vv, v, "", "^", "^^"))',   ['', '^', '^^'],        'dans une liste'],
    ['def t (separator:"", default:"4")',         ['', '4'],              'la forme d octaves'],
  ];
  for (const [ligne, attendu, ou] of cas) {
    const vu = chaines(ligne);
    if (vu && vu.jet) { echecs.push(`B-témoin. chaîne VIDE ${ou} — le découpeur JETTE : ${vu.jet}`); continue; }
    ok(JSON.stringify(vu) === JSON.stringify(attendu),
       `B-témoin. chaîne VIDE ${ou} — attendu ${JSON.stringify(attendu)}, rendu ${JSON.stringify(vu)}. `
     + `Ce qui distingue une chaîne vide d'un doublement est ce qui SUIT le guillemet fermant.`);
  }
}

// ── C. LA DONNÉE RÉELLE — octaves porte ses vides, et ce garde le vérifie SUR LE BUNDLE ───────
// ⛔ LES VOLETS A ET B JUGENT DES LIGNES QUE J'AI ÉCRITES. Celui-ci juge la donnée qui voyage.
// `lib/octaves.bpsl` est le SEUL fichier du dépôt qui écrit deux guillemets accolés : si le câblage
// les avait fusionnés, ses séparateurs et ses registres auraient changé sans qu'un refus le dise.
// ⛔ ET CE VOLET A DÛ ÊTRE RÉÉCRIT PARCE QU'IL N'A PAS MORDU. Sa première version lisait `LIBS`,
// c'est-à-dire `libs-data.js` — un artefact GÉNÉRÉ, figé sur disque. Sous injection, il restait VERT
// pendant que les trois autres volets rougissaient : il ne lisait pas le découpeur qu'il prétendait
// garder, il lisait une photo prise avant. Un garde branché sur un artefact ne garde pas le code qui
// le produit. Il lit donc maintenant la SOURCE et la passe au découpeur courant.
{
  const source = readFileSync(new URL('../lib/octaves.bpsl', import.meta.url), 'utf8');
  let jetons = null, jet = '';
  try { jetons = tokenize(source).filter((t) => t.type === 'STRING').map((t) => t.value); }
  catch (e) { jet = String(e.message).slice(0, 100); }

  ok(!jet, `C. lib/octaves.bpsl ne se DÉCOUPE PLUS — le découpeur JETTE : ${jet}. C'est le seul `
         + `fichier du dépôt qui écrit deux guillemets accolés.`);
  if (jetons) {
    const vides = jetons.filter((v) => v === '').length;
    ok(vides >= 5,
       `C. ${vides} chaîne(s) VIDE(s) découpée(s) dans lib/octaves.bpsl, 5 au moins attendues — il y `
     + `en avait 8 le 2026-08-23. Sous ce seuil, le câblage du doublement a mangé des chaînes vides `
     + `de la source : c'est exactement la donnée que ce garde existe pour protéger.`);
    ok(!jetons.some((v) => v.includes('-----') || v.includes('\n')),
       `C. une chaîne découpée déborde sur le reste du fichier — la lecture n'a pas trouvé son `
     + `guillemet fermant et a avalé la suite : ${JSON.stringify(jetons.find((v) => v.includes('\n')) || '').slice(0, 70)}`);
    // Le témoin dans l'autre sens : le fichier porte AUSSI des chaînes non vides.
    ok(jetons.some((v) => v !== ''),
       `C-témoin. aucune chaîne NON vide dans octaves — ce volet compterait des vides sans savoir `
     + `distinguer, et « tout est vide » passerait pour un succès.`);
  }
  // Et la donnée PUBLIÉE porte bien ces vides — deux questions distinctes, deux mesures.
  const oct = LIBS.octaves || {};
  const videsPublies = Object.values(oct).filter((d) => d && typeof d === 'object'
    && (d.separator === '' || d.default === '' || (Array.isArray(d.registers) && d.registers.includes('')))).length;
  ok(videsPublies >= 3,
     `C. ${videsPublies} entrée(s) d'octaves portent une chaîne vide dans le BUNDLE, 3 au moins `
   + `attendues. Le découpeur peut être juste et le bundle périmé : ce sont deux états.`);
}

// ── D. LES BORNES — ce que ce câblage ne doit PAS changer ─────────────────────────────────────
{
  const cas = [
    ['def t (d:"deux mots")',        ['deux mots'],        'une chaîne ordinaire'],
    ['def t (d:"un-mot")',           ['un-mot'],           'sans espace'],
    ['def t (a:"x", b:"y")',         ['x', 'y'],           'deux chaînes séparées'],
    ['def t (d:"le mot `midi` ici")', ['le mot `midi` ici'], 'un accent grave à l intérieur'],
  ];
  for (const [ligne, attendu, ou] of cas) {
    const vu = chaines(ligne);
    if (vu && vu.jet) { echecs.push(`D-borne. ${ou} — le découpeur JETTE : ${vu.jet}`); continue; }
    ok(JSON.stringify(vu) === JSON.stringify(attendu),
       `D-borne. ${ou} — attendu ${JSON.stringify(attendu)}, rendu ${JSON.stringify(vu)}`);
  }
  // Une chaîne non terminée ne doit pas faire boucler le lecteur ni avaler le reste du fichier.
  const ouverte = chaines('def t (d:"jamais fermee');
  ok(Array.isArray(ouverte) && ouverte.length === 1,
     `D-borne. une chaîne NON TERMINÉE doit rendre une chaîne et s'arrêter — rendu `
   + `${JSON.stringify(ouverte)}. La boucle du doublement ne doit pas dépasser la fin du texte.`);
}

// ── E. LA VALEUR ARRIVE, ET ELLE ARRIVE TYPÉE ────────────────────────────────────────────────
// ⛔ LE DÉCOUPEUR N'EST QUE LA MOITIÉ DU CHEMIN. Les volets A à D prouvent qu'un doublement rend UN
// jeton ; celui-ci prouve que la paire qui en sort porte la bonne valeur ET son champ `texte`.
// L'architecte a mesuré les deux symptômes ensemble — guillemets disparus, `texte:true` absent —
// et un câblage qui réparerait le premier sans le second laisserait l'aval typer une chaîne comme
// un nom nu. Deux symptômes, deux assertions.
{
  const paires = (ligne) => {
    const r = compileToBPxAST(`core\nalphabet.western\n${ligne}\n-----\nS -> C4\n`);
    return { err: (r.errors || []).map((e) => String(e.message ?? e))[0] || '',
             p: (r.ast?.defs || [])[0]?.settings?.pairs || [] };
  };
  const { err, p } = paires('def x (a:"", b:"deux mots", c:"scale ""Ma05"" fin", d:nu, e:12)');
  ok(err === '', `E. la ligne d'épreuve doit COMPILER — reçu : ${err.slice(0, 90)}`);
  const par = (k) => p.find((x) => x.key === k) || {};
  ok(par('c').value === 'scale "Ma05" fin',
     `E. le doublement doit ARRIVER dans la paire — attendu 'scale "Ma05" fin', reçu `
   + `${JSON.stringify(par('c').value)}. Le découpeur peut être juste et la valeur se perdre après.`);
  for (const k of ['a', 'b', 'c']) {
    ok(par(k).texte === true,
       `E. la paire '${k}' est un TEXTE et doit porter texte:true — reçu ${JSON.stringify(par(k))}. `
     + `Sans ce champ, l'aval type une chaîne comme un nom nu : c'est le second symptôme du défaut, `
     + `et il se répare séparément du premier.`);
  }
  // Le témoin qui discrimine : ce qui n'est PAS un texte ne doit pas porter le champ.
  ok(par('d').texte === undefined && par('e').texte === undefined,
     `E-témoin. un nom nu et un nombre ne portent PAS texte:true — sinon « le champ est là » ne `
   + `voudrait rien dire. reçu d=${JSON.stringify(par('d'))} e=${JSON.stringify(par('e'))}`);
}

if (echecs.length) {
  console.error(`❌ le guillemet se double dans une chaîne : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ le guillemet se double dans une chaîne — un doublement rend UN jeton portant un `
  + `guillemet littéral, en tête, au milieu et en queue ; la chaîne VIDE reste vide, seule, répétée `
  + `et en liste ; la donnée d'octaves garde ses vides dans le bundle ; et une chaîne ordinaire, un `
  + `accent grave interne et une chaîne non terminée ne bougent pas. ${passe} vérification(s) passée(s).`);
