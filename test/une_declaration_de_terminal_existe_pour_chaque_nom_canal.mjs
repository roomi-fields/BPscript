#!/usr/bin/env node
/**
 * GARDE — UNE DÉCLARATION DE TERMINAL EXISTE POUR CHAQUE `<nom>:<canal>`, ET POUR RIEN D'AUTRE.
 *
 * ⛔ CE QUE CE GARDE FERME, et son mode d'échec est MUET. Un terminal déclaré `<nom>:<canal>` doit
 * poser une entrée dans `declarations` : c'est cette PRÉSENCE qui lui confère le statut de terminal
 * d'alphabet chez BPx. Une entrée qui manque ne produit AUCUNE erreur — elle produit un arbre plus
 * petit. Mesuré le 2026-08-18 : l'arbre dérivé de `koto3` a maigri de 26 % — 2919 octets — SANS UNE
 * SEULE ERREUR, et douze scènes sur treize rendaient un arbre identique à l'octet. **Une perte
 * silencieuse de production ne se découvre pas par un refus, et un compte de scènes qui compilent ne
 * la voit pas non plus.**
 *
 * ⚠️ CE GARDE A PORTÉ CETTE PROPRIÉTÉ SOUS UNE AUTRE FORME, et il faut savoir laquelle. Jusqu'au
 * 2026-08-30 il exigeait un champ `temporalType: 'gate'` sur chaque déclaration, parce que le
 * contrat de BPx le déclarait requis et que sa classification testait `=== 'gate'`.
 * ⇒ **Le champ est sorti** — décision de Romain, 2026-08-30 : `gate` et `trig` sortent comme mots du
 * langage. BPx a publié à `8f36a0f` : `DeclarationAST` porte `type`, `name`, `runtime`, `line`, et
 * **la PRÉSENCE d'une entrée nommée confère le statut**.
 *
 * ⛔ ET LA PROPRIÉTÉ N'A PAS DISPARU AVEC LE CHAMP — c'est tout l'objet du § 5. Mesuré des deux côtés
 * avant la frappe : le test sur le type rendait **113 noms chez moi, 106 chez BPx, et ZÉRO par
 * l'autre valeur**. Il ne discriminait rien ; il séparait un ensemble de l'ensemble vide. La
 * PRÉSENCE rend exactement le même ensemble — 204 scènes identiques chez BPx, 0 divergente.
 * ⇒ **Élaguer le champ sans porter sa propriété ailleurs aurait retiré la seule chose qui empêchait
 * la panne silencieuse, en même temps que sa cause.**
 */
import { canaux, clesDActeur } from '../src/transpiler/index-des-objets.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
const CORE = LIBS.core;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const compile = (src) => compileToBPxAST(SOCLE + src);

// ── 1. L'ENTRÉE EST LÀ, SUR CHAQUE CANAL DE SORTIE ───────────────────────────────────────────
// Une matrice, pas un cas : le nœud se construit dans UNE branche, mais un canal est lu dans la
// donnée et rien ne garantit qu'ils passent tous par elle.
// ⚠️ `text` A QUITTÉ CETTE LISTE LE 2026-08-19, ET C'EST UN DURCISSEMENT. Il PORTE la direction de
// sortie mais son ÉCRITURE est fermée (`schema.channels.text.writable === false`) : la forme
// d'acteur `out.text` le refuse depuis le 2026-08-04, la déclaration de terminal l'acceptait. Une
// liste écrite à la main gardait l'incohérence — elle se DÉRIVE désormais de la donnée, et `text`
// devient un cas de REFUS nommé plus bas, pas un cas absent.
const CANAUX = Object.entries(canaux())
  .filter(([, c]) => c && c.out && c.writable).map(([n]) => n);
console.log(`[déclaration] ${CANAUX.length} canaux de sortie ÉCRIVABLES x la forme déclarée`);
for (const canal of CANAUX) {
  const r = compile(`zz:${canal}\n-----\nS -> zz`);
  const d = (r.ast?.declarations || [])[0];
  ok((r.errors || []).length === 0, `1. 'zz:${canal}' doit compiler — reçu : ${(r.errors || []).map((e) => e.message).join(' | ').slice(0, 90)}`);
  ok(d && d.type === 'Declaration' && d.name === 'zz' && d.runtime === canal,
     `1. 'zz:${canal}' doit poser une Declaration NOMMÉE et portant son canal — c'est cette entrée `
     + `qui confère le statut de terminal d'alphabet. Reçu ${JSON.stringify(d)}`);
}

// ── 1bis. LES CANAUX QUI NE S'ÉCRIVENT PAS — refusés, chacun par SA cause ───────────────────
// La matrice ci-dessus a perdu `text` en se dérivant ; elle ne rétrécit pas pour autant — il
// revient ici, du côté du refus. Trois causes distinctes, et le refus doit dire LAQUELLE : le
// canal n'existe pas · il existe mais ne sort pas · il sort mais ne s'écrit pas encore.
for (const [canal, motif, pourquoi] of [
  ['zorglub',  /does not exist/,        "le canal n'existe pas"],
  ['keyboard', /is not an output/,      'le canal existe mais ne porte que l\'entrée'],
  ['text',     /WRITING/,               "le canal sort, mais son écriture attend son appareil"],
]) {
  const r = compile(`zz:${canal}\n-----\nS -> zz`);
  const msg = (r.errors || []).map((e) => e.message).join(' | ');
  ok((r.errors || []).length > 0, `1bis. 'zz:${canal}' doit être REFUSÉ — ${pourquoi}`);
  ok(motif.test(msg), `1bis. 'zz:${canal}' — le refus doit dire QUE ${pourquoi} (reçu : ${msg.slice(0, 110)})`);
  ok(!/terminal 'zz' undeclared/.test(msg),
     `1bis. 'zz:${canal}' accuse le TERMINAL alors que la faute est sur le CANAL — c'est le défaut `
     + `réparé le 2026-08-19 (reçu : ${msg.slice(0, 110)})`);
}

// ── 2. L'OBJET HORS-TEMPS — le seul endroit où l'absence se voyait ───────────────────────────
// `koto3` est la seule scène du corpus dont un terminal déclaré est employé en objet hors-temps.
// C'est ce qui l'a distinguée des douze autres, et c'est donc ce cas-là qui se garde ici.
{
  const r = compile('f:midi\n-----\nmode:rnd\nY -> !f\nS -> Y');
  ok((r.errors || []).length === 0,
     `2. un terminal déclaré employé en OBJET HORS-TEMPS doit compiler — reçu : `
     + `${(r.errors || []).map((e) => e.message).join(' | ').slice(0, 100)}`);
  const trouve = JSON.stringify(r.ast?.subgrammars || []).includes('"OutTimeObject"');
  ok(trouve, `2. et l'arbre doit porter un OutTimeObject`);
  ok((r.ast?.declarations || []).some((d) => d.name === 'f' && d.runtime === 'midi'),
     `2. et son entrée doit EXISTER, nommée et portant son canal — sans elle, BPx ne le compte pas `
     + `parmi les terminaux d'alphabet et la production maigrit SANS erreur`);
}

// ── 3. LE COMPLÉMENT — ce qui n'est pas une déclaration n'en pose pas ────────────────────────
// Sans cette moitié, une branche qui poserait une entrée sur TOUTE ligne de tête serait verte.
for (const [quoi, src] of [
  ['un réglage de scène', 'tempo:120\n-----\nS -> C4'],
  ['une propriété sur un composant', 'alphabet.western:midi\n-----\nS -> C4'],
]) {
  const r = compile(src);
  ok((r.ast?.declarations || []).length === 0,
     `3. ${quoi} ne doit poser AUCUNE déclaration — reçu ${JSON.stringify(r.ast?.declarations)}`);
}

// ── 4. TÉMOIN D'INSTRUMENT — le garde sait mordre ────────────────────────────────────────────
// Un fichier qui ne lirait jamais le canal passerait au vert sur une déclaration absente.
{
  const r = compile('-----\nS -> C4');
  ok((r.ast?.declarations || []).length === 0,
     '4. TÉMOIN — une scène sans déclaration en rend zéro : la section 1 mesure donc bien '
     + 'quelque chose quand elle en trouve');
}

// ── 5. LA BIJECTION SUR LE CORPUS — la propriété qui a remplacé le champ ─────────────────────
// ⛔ C'EST CE PARAGRAPHE QUI PORTE CE QUE `temporalType` PORTAIT. Deux questions distinctes, et une
// seule sortie ne les sépare pas : toute ligne `nom:canal` pose-t-elle une entrée (SURJECTION), et
// toute entrée vient-elle d'une telle ligne (INJECTION) ? Les deux ensemble disent que la PRÉSENCE
// est un substitut exact du test sur le type.
{
  const { toutesLesScenes } = await import('./corpus.mjs');
  let scenes = 0, compilees = 0, entrees = 0, sansCanal = 0;
  const orphelines = [], muettes = [];
  for (const [nom, src] of toutesLesScenes()) {
    scenes++;
    let r;
    try { r = compileToBPxAST(src, {}); } catch { continue; }
    if (!r.ast || (r.errors || []).length) continue;
    compilees++;
    const decls = r.ast.declarations || [];
    entrees += decls.length;

    // Les lignes `nom:canal` de la PARTIE DÉCLARATIVE — seul endroit où le lecteur est appelé.
    const tete = src.split(/^-{3,}\s*$/m)[0] || '';
    const candidates = new Set();
    for (const brut of tete.split('\n')) {
      const l = brut.replace(/\s*\/\/.*$/, '').trim();
      const m = l.match(/^([A-Za-z_][\w'#]*)\s*:\s*([A-Za-z_][\w]*)\s*$/);
      if (m) candidates.add(m[1]);
    }
    for (const d of decls) {
      if (!d.runtime) sansCanal++;
      if (!candidates.has(d.name)) orphelines.push(`${nom}: '${d.name}' émis sans ligne 'nom:canal'`);
      candidates.delete(d.name);
    }
    // ⚠️ Ce qui RESTE dans `candidates` n'est pas fautif en soi : un réglage de tête (`tempo:120`) a
    // la même forme. On ne retient que ce que le compilateur a par ailleurs traité comme un TERMINAL
    // — sinon ce volet mesurerait la graphie, pas le canal.
    const terminaux = new Set();
    for (const sg of (r.ast.subgrammars || [])) {
      for (const rg of (sg.rules || [])) {
        for (const e of (rg.rhs || [])) if (e && e.name) terminaux.add(e.name);
      }
    }
    for (const c of candidates) if (terminaux.has(c)) muettes.push(`${nom}: '${c}' employé en règle, aucune entrée émise`);
  }

  // ⛔ SOCLE — un garde qui n'a rien examiné est vert pour la mauvaise raison.
  ok(compilees >= 300, `5-socle. ${compilees} scène(s) compilées sur ${scenes}, 300 au moins attendues`);
  ok(entrees >= 50, `5-socle. ${entrees} entrée(s) 'declarations' examinées, 50 au moins attendues — `
     + `sous ce seuil, les deux volets ci-dessous sont verts sur rien`);

  ok(orphelines.length === 0,
     `5. INJECTION — ${orphelines.length} entrée(s) émise(s) SANS ligne 'nom:canal' : ${orphelines.slice(0, 3).join(' · ')}`);
  ok(muettes.length === 0,
     `5. SURJECTION — ${muettes.length} terminal(aux) déclaré(s) en tête et employé(s) en règle SANS `
     + `entrée : ${muettes.slice(0, 3).join(' · ')}`);
  ok(sansCanal === 0, `5. toute entrée porte son canal — ${sansCanal} sans 'runtime'`);
  console.log(`[déclaration] corpus : ${compilees}/${scenes} compilées · ${entrees} entrée(s) · `
    + `injection ${orphelines.length} · surjection ${muettes.length}`);
}

// ── 6. LE CHAMP RETIRÉ NE REVIENT PAS ────────────────────────────────────────────────────────
// ⛔ Il ne suffit pas qu'il soit parti : rien n'empêche un remaniement de le remettre « au cas où »,
// et il serait alors une clé inconnue que BPx traverse sans lire — invisible, et fausse.
{
  const r = compile('zz:midi\n-----\nS -> zz');
  const d = (r.ast?.declarations || [])[0];
  ok(d && !('temporalType' in d),
     `6. aucune déclaration ne porte 'temporalType' — le champ est sorti du contrat de BPx à `
     + `'8f36a0f' (décision de Romain, 2026-08-30). Reçu ${JSON.stringify(d)}`);
  // TÉMOIN — le volet 6 sait distinguer un champ présent d'un champ absent.
  ok('temporalType' in { ...d, temporalType: 'gate' },
     `6-témoin. le test de présence mord sur un objet qui porte le champ — sans lui, le volet 6 `
     + `serait vert sur n'importe quoi`);
}

if (echecs.length) {
  console.error(`❌ une déclaration de terminal existe pour chaque nom:canal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error('   - ' + e);
  process.exit(1);
}
console.log(`✅ une déclaration de terminal existe pour chaque 'nom:canal', et pour rien d'autre — `
  + `${passe} vérification(s)`);
