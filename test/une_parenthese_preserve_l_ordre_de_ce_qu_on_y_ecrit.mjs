#!/usr/bin/env node
/**
 * GARDE — UNE PARENTHÈSE PRÉSERVE L'ORDRE DE CE QU'ON Y ÉCRIT.
 *
 * Arbitrage Romain, 2026-08-19 : une seule forme sert la SUITE et l'ENSEMBLE — un ensemble est une
 * suite dont personne ne lit le rang. Une liste s'écrit donc `registers(mandra, madhya, taar)`, et
 * ce qui en sort doit ressortir DANS CET ORDRE.
 *
 * ⛔ CE QUI L'A EXIGÉ EST UNE DONNÉE, PAS UN GOÛT : `octaves.saptak` adresse ses registres PAR LEUR
 * RANG — `default:1` désigne madhya, le deuxième des trois. Une suite rendue dans un autre ordre ne
 * casse rien de visible : elle désigne un AUTRE registre, en silence.
 *
 * ⛔ ET LE PIÈGE EST DANS LE LANGAGE HÔTE : un objet JavaScript réordonne ses clés entières avant
 * toutes les autres, donc `{"0":…,"1":…}` sort en ordre numérique quoi qu'on écrive. Une lecture qui
 * passe par un objet intermédiaire rend le rang du moteur d'exécution au lieu de celui de la source.
 * Le garde mesure donc l'ORDRE, jamais la seule présence des membres — compter ce qui existe n'est
 * pas mesurer ce que ça porte.
 *
 * DEUX ÉTAGES, parce qu'un seul ne dirait pas où le rang se perd :
 *   A. l'AST — ce que le PARSER rend d'une parenthèse ;
 *   B. la donnée PUBLIÉE — ce que le bundle rend de chaque liste écrite en parenthèse dans `lib/`.
 */
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../lib');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

console.log('[ordre] une parenthèse préserve l\'ordre de ce qu\'on y écrit');

// ── A. L'AST — LE RANG VIENT DE LA SOURCE, ET LE TÉMOIN LE FABRIQUE ─────────────────────────
// ⛔ OBSERVER NE DISCRIMINE PAS : une seule suite passerait aussi bien chez un lecteur qui TRIE.
// On écrit donc la MÊME suite dans DEUX ordres et on exige deux résultats différents.
{
  const pairs = (src) => {
    const r = compileToBPxAST(`core\nalphabet.western\n${src}\n-----\nS -> C4\n`);
    ok((r.errors || []).length === 0, `A. '${src}' doit compiler(reçu : ${(r.errors || [])[0]?.message})`);
    // `def x(…)` est un objet RACINE depuis le 2026-09-02 : il vit dans `vars`, pas dans `defs`.
    return (((r.ast?.vars || []).find((v) => v.varType?.kind === 'type' && v.varType.type === null)
             || (r.ast?.defs || [])[0])?.settings?.pairs || [])
      .find((p) => p.key === 'registers')?.value?.pairs?.map((p) => p.key);
  };
  const droit = pairs('def x(registers(mandra, madhya, taar))');
  const envers = pairs('def x(registers(taar, madhya, mandra))');
  ok(JSON.stringify(droit) === JSON.stringify(['mandra', 'madhya', 'taar']),
    `A. la suite écrite doit ressortir telle quelle — reçu ${JSON.stringify(droit)}`);
  ok(JSON.stringify(envers) === JSON.stringify(['taar', 'madhya', 'mandra']),
    `A. TÉMOIN FABRIQUÉ — la suite écrite à l'envers doit ressortir à l'envers. Si elle ressort `
    + `comme la première, le rang vient du lecteur et non de la source. Reçu ${JSON.stringify(envers)}`);
  ok(JSON.stringify(droit) !== JSON.stringify(envers),
    'A. les deux ordres doivent DIFFÉRER — sinon le garde ne distingue rien');
}

// ── B. LA DONNÉE PUBLIÉE — CHAQUE LISTE ÉCRITE EN PARENTHÈSE, DANS `lib/` ────────────────────
// Le garde balaye l'ESPACE : toute librairie du langage, toute déclaration, toute liste. Il grandit
// donc tout seul à chaque librairie réécrite, sans qu'on pense à l'y inscrire.
const trouver = (o, nom) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (Object.prototype.hasOwnProperty.call(o, nom) && o[nom] && typeof o[nom] === 'object') return o[nom];
  for (const v of Object.values(o)) { const t = trouver(v, nom); if (t) return t; }
  return null;
};

/**
 * LES LISTES ÉCRITES DANS UN CORPS, AVEC LEUR CHEMIN D'IMBRICATION.
 *
 * Une LISTE est une parenthèse dont aucun membre ne porte de valeur et qui n'en contient aucune
 * autre. Ce marcheur suit les parenthèses au lieu de les apparier par motif : **un motif ne porte
 * pas de profondeur**, et c'est ce qui a fait chercher `chains.C3` à la racine de sa déclaration.
 *
 * ⛔ ET LA STRUCTURE SE LIT SUR UN TEXTE MASQUÉ, JAMAIS SUR LE TEXTE BRUT. Les descriptions de `midi`
 * portent des parenthèses DANS LEURS GUILLEMETS — `(mute.all)`, `(sync:start)` — et le marcheur les
 * prenait pour des listes : quatre rouges sur une donnée intacte. **Une prose citée n'est pas une
 * graphie.** Le masque remplace `(`, `)` et `,` par un point à l'intérieur des textes, uniquement
 * pour TROUVER les bornes ; les membres se découpent ensuite dans le texte ORIGINAL, si bien qu'un
 * membre écrit `"tuning.diapason"` ressort intact.
 */
function masquerTextes(t) {
  let dedans = false;
  let out = '';
  for (const c of t) {
    if (c === '"') { dedans = !dedans; out += c; continue; }
    out += (dedans && '(),'.includes(c)) ? '.' : c;
  }
  return out;
}

function listesEcrites(corps) {
  const out = [];
  const marcher = (texte, brut, chemin) => {
    let i = 0;
    while (i < texte.length) {
      // ⛔ UNE CLÉ N'EST PAS TOUJOURS UN NOM NU. `homomorphism` écrit sa section universelle `"*"(…)` —
      // entre guillemets, parce que `*` n'est pas écrivable nu. Un motif en `\w+` saute ce niveau,
      // le chemin perd un cran, et le garde cherche `sections.chains.a` là où vit
      // `sections.*.chains.a`. **Une clé se lit dans ses DEUX graphies, ou le chemin est faux.**
      const m = /("([^"]*)"|\w+)\(/g;
      m.lastIndex = i;
      const t = m.exec(texte);
      if (!t) return;
      let n = 1;
      let j = m.lastIndex;
      while (j < texte.length && n > 0) { if (texte[j] === '(') n++; else if (texte[j] === ')') n--; j++; }
      const dedans = texte.slice(m.lastIndex, j - 1);
      const dedansBrut = brut.slice(m.lastIndex, j - 1);
      const ici = [...chemin, t[2] !== undefined ? t[2] : t[1]];
      if (dedans.includes('(')) marcher(dedans, dedansBrut, ici);
      else out.push({ cle: ici[ici.length - 1], membres: dedansBrut, chemin: ici });
      i = j;
    }
  };
  marcher(masquerTextes(corps), corps, []);
  return out;
}

const sources = readdirSync(LIB_DIR).filter((f) => f.endsWith('.bpsl')).sort();
ok(sources.length >= 9, `B. le balayage doit voir les librairies du langage — ${sources.length} vue(s)`);

let listes = 0;
let ordreNonTrivial = 0;
for (const fichier of sources) {
  const nomLib = fichier.replace('.bpsl', '');
  const texte = readFileSync(join(LIB_DIR, fichier), 'utf-8');
  // Une déclaration à corps parenthésé, sur une ligne : `def <nom> (…)` ou `<type> <nom> (…)`.
  //
  // ⛔ CE MOTIF NE LISAIT QUE `def`, ET LA BASCULE DES CATALOGUES L'A RENDU AVEUGLE SANS UN MOT.
  // Le 2026-09-01, 204 entrées sont passées de `def western(…)` à `alphabet western(…)` : ce
  // garde est resté VERT en examinant **388 assertions de moins**, sur six catalogues entiers.
  // ⚠️ RIEN ICI N'A ROUGI — c'est la référence d'assertions du portillon qui l'a vu, et elle seule.
  // « Une entrée retirée d'une librairie en emporte des centaines sans un mot » : c'est le même
  // mécanisme, par la forme au lieu du contenu. Un garde qui filtre sur une graphie perd sa
  // couverture le jour où la graphie change, et il le fait en vert.
  // ⚠️ ET LE NOM D'UNE ENTRÉE PORTE UN TIRET — `bp3_Bohlen-Pierce`. `\w` ne le capture pas : neuf
  // tempéraments sortaient du balayage par ce seul caractère.
  // ⛔ ET UNE DÉCLARATION SE PLIE DÉSORMAIS SUR PLUSIEURS LIGNES (Romain, 2026-09-03). Ce motif
  // exigeait une ligne entière — `(.*)\)\s*$` — et rendait ZÉRO liste examinée dès que les
  // librairies ont été indentées : le garde tournait en vert sans rien mesurer, et c'est son propre
  // compteur de couverture qui l'a dit. On déplie donc AVANT d'apparier, comme le fait la mise en
  // forme : joindre les lignes tant que les parenthèses restent ouvertes.
  const deplie = (() => {
    const out = [];
    let acc = null, prof = 0;
    for (const l of texte.split('\n')) {
      const nu = l.replace(/"(?:[^"]|"")*"/g, '""').replace(/\/\/.*$/, '');
      for (const c of nu) { if (c === '(') prof++; else if (c === ')') prof--; }
      if (acc === null) { if (prof > 0) acc = l.trimEnd(); else out.push(l); }
      else { acc += ' ' + l.trim(); if (prof <= 0) { out.push(acc); acc = null; prof = 0; } }
    }
    if (acc !== null) out.push(acc);
    return out.join('\n');
  })();
  for (const m of deplie.matchAll(/^(?:def|[a-z][\w-]*) ([\w-]+)\((.*)\)\s*$/gm)) {
    const [, nomDecl, corps] = m;
    const publiee = nomDecl === nomLib ? LIBS[nomLib] : trouver(LIBS[nomLib], nomDecl);
    if (!publiee) { echecs.push(`B. ${nomLib}.${nomDecl} : déclaré dans la source, introuvable dans la donnée publiée`); continue; }
    // ⛔ CE VOLET LISAIT LES PARENTHÈSES IMBRIQUÉES COMME SI ELLES ÉTAIENT DE PREMIER NIVEAU, PUIS
    // CHERCHAIT LEUR CLÉ À LA RACINE DE LA DÉCLARATION. Son commentaire disait « on ne lit que le
    // premier niveau » ; son motif `[^()]*` attrapait au contraire les parenthèses les PLUS
    // INTÉRIEURES. Tant que les librairies écrites à la main restaient plates, les deux revenaient
    // au même ; `homomorphism` porte `sections(TR(chains(C3(…))))` et le garde a rendu **190
    // rouges** sur une donnée que la preuve d'égalité disait juste feuille à feuille.
    //
    // ⇒ **Le remède est de porter le CHEMIN, pas de chercher la clé plus loin.** Chercher `C3`
    // n'importe où sous la déclaration retrouverait le premier homonyme — et deux sections peuvent
    // porter le même nom de chaîne. Un chemin ne se devine pas, il se suit.
    for (const l of listesEcrites(corps)) {
      const { cle, membres, chemin } = l;
      const bruts = membres.split(',').map((x) => x.trim()).filter((x) => x !== '');
      if (!bruts.length || bruts.some((x) => x.includes(':'))) continue;   // pas une liste
      // ⛔ UN MEMBRE PORTE SA NATURE, ET LE GARDE LA LIT COMME LE COMPILATEUR : un texte entre
      // guillemets reste un TEXTE — `"0"` n'est pas 0 —, un nombre nu devient un NOMBRE, un nom
      // reste son nom. Comparer les seuls textes laisserait passer un registre « 0 » publié en
      // nombre, et c'est exactement le type qui casserait la résolution de hauteur.
      const ecrits = bruts.map((x) => {
        const t = x.match(/^"([\s\S]*)"$/);
        if (t) return t[1];
        return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
      });
      const rendue = chemin.reduce((o, k) => (o == null ? o : o[k]), publiee);
      listes++;
      ok(Array.isArray(rendue),
        `B. ${nomLib}.${nomDecl}.${chemin.join('.')} doit être publiée comme une SUITE — reçu ${JSON.stringify(rendue)}`);
      ok(JSON.stringify(rendue) === JSON.stringify(ecrits),
        `B. ${nomLib}.${nomDecl}.${chemin.join('.')} : la donnée publiée doit être la suite ÉCRITE, dans son ordre `
        + `ET dans ses types. écrit ${JSON.stringify(ecrits)} · publié ${JSON.stringify(rendue)}`);
      const trie = [...ecrits].map(String).sort();
      if (JSON.stringify(trie) !== JSON.stringify(ecrits.map(String))) ordreNonTrivial++;
    }
  }
}

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ, ET REFUSE D'AVOIR EXAMINÉ ZÉRO.
ok(listes >= 18, `B. le garde doit avoir examiné des listes publiées, pas seulement tourné(${listes} vue(s))`);
// ⛔ ET IL REFUSE DE N'AVOIR VU QUE DES SUITES DÉJÀ TRIÉES : sur celles-là, un lecteur qui TRIE
// passerait tout le volet B sans se distinguer d'un lecteur correct.
ok(ordreNonTrivial >= 1,
  `B-témoin. aucune des ${listes} listes examinées n'a un ordre distinct de son tri alphabétique — `
  + `le volet B ne distinguerait pas un lecteur qui trie d'un lecteur qui préserve.`);

// ── C. LE DÉFAUT NOMME SON REGISTRE, ET SON NOM EST DANS LA SUITE ───────────────────────────
// ⛔ `octaves` ADRESSAIT SES REGISTRES PAR LEUR RANG, et Romain l'a retiré : un nom ne bouge pas
// quand la liste s'allonge, un rang désigne silencieusement autre chose dès qu'on insère devant.
// La donnée portait le piège — `bp3` écrivait 5 pour le registre nommé « 4 », `bp3_fr` 5 pour le
// « 3 » : dans deux tables sur trois, le nombre écrit et le nom visé étaient deux nombres
// différents, parce que la liste commence un cran plus bas.
//
// ⚠️ L'ORDRE RESTE CE QUE CE GARDE ÉPROUVE : la suite construit la table — c'est elle qui dit quel
// registre est au-dessus de quel autre. Elle ne sert plus à DÉSIGNER, elle sert toujours à ORDONNER.
// Un membre perdu ou déplacé casse encore la table, et ce volet le voit toujours.
{
  let designations = 0;
  let videNomme = 0;
  for (const [nom, conv] of Object.entries(LIBS.octaves || {})) {
    if (!conv || typeof conv !== 'object' || !Array.isArray(conv.registers)) continue;
    designations++;
    const d = conv.default;
    ok(typeof d === 'string',
      `C. octaves.${nom} : 'default' (${JSON.stringify(d)}) doit NOMMER son registre, jamais `
      + `l'indexer. Un nombre y serait indistinguable de l'ancien rang.`);
    ok(conv.registers.includes(d),
      `C. octaves.${nom} : le nom '${d}' doit EXISTER dans la suite de ${conv.registers.length} `
      + `registres ${JSON.stringify(conv.registers)}. Un nom introuvable ne crie pas tout seul — `
      + `une recherche d'indice rend −1, qui est un entier valide et décale d'un cran.`);
    if (d === '') videNomme++;
  }
  ok(designations >= 10, `C. le garde doit voir les conventions d'octaves — ${designations} vue(s)`);
  // Les désignations que la décision cite, ou que la donnée rendait fragiles.
  ok(LIBS.octaves?.saptak?.default === 'madhya',
    `C. octaves.saptak : le défaut doit être 'madhya' — reçu ${JSON.stringify(LIBS.octaves?.saptak?.default)}`);
  ok(LIBS.octaves?.bp3?.default === '4' && LIBS.octaves?.bp3_fr?.default === '3',
    `C. bp3 et bp3_fr portaient TOUS DEUX le rang 5 pour deux registres DIFFÉRENTS — '4' et '3'. `
    + `C'est l'écart exact que le nom supprime. Reçu `
    + `${JSON.stringify([LIBS.octaves?.bp3?.default, LIBS.octaves?.bp3_fr?.default])}`);
  ok(LIBS.octaves?.western?.default === '4' && typeof LIBS.octaves?.western?.default === 'string',
    `C. octaves.western : le défaut doit être le TEXTE '4', jamais le nombre 4 — les deux s'écrivent `
    + `pareil une fois la clé posée, et le nombre serait lu comme un rang. Reçu `
    + `${JSON.stringify(LIBS.octaves?.western?.default)}`);
  // ⛔ LE REGISTRE VIDE SE NOMME PAR LE VIDE. Deux conventions le portent, et il occupe un rang dans
  // la suite : le retirer décalerait tous les suivants, en silence.
  ok(videNomme >= 2,
    `C. au moins deux conventions doivent nommer par défaut le registre VIDE — reçu ${videNomme}`);
}

console.log(`[ordre] ${listes} liste(s) publiée(s) examinée(s), dont ${ordreNonTrivial} d'ordre non trivial`);

if (echecs.length) {
  console.error(`[ordre] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[ordre] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
