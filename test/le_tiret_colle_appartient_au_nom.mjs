#!/usr/bin/env node
/**
 * LE TIRET COLLÉ APPARTIENT AU NOM ; ENTRE ESPACES, IL EST UN SILENCE.
 *
 * Décision Romain, 2026-08-17. `dha-dha` est le terminal de ce nom ; `dha - dha` est deux bols
 * séparés par un silence. L'espace porte le sens, comme pour le point d'exclamation collé ou
 * espacé — divergence assumée avec le moteur natif, du même ordre que celle sur la casse.
 *
 * ⛔ CE QUE LA RÈGLE RÉPARE, ET C'EST LA RAISON DU GARDE. Le tokenizer consultait une liste de
 * noms PRÉ-SCANNÉS sur les membres GAUCHES : le même texte se lisait de deux façons selon qu'un
 * membre gauche l'avait déclaré ou non. Mesure du jour : `Tr-11 -> a` rendait UN symbole `Tr-11`,
 * et `S -> Tr-11` rendait `Tr` silence `11`. La lecture d'une ligne dépendait d'une autre ligne
 * du fichier. Le volet C tient cette localité — c'est elle qui se perdrait en premier.
 *
 * ⚠️ LE RAYON A ÉTÉ MESURÉ AVANT LA FRAPPE, et il était dix fois plus petit qu'annoncé : DEUX
 * scènes sur 397 y perdaient leur silence (douze autres étaient déjà rouges pour d'autres
 * raisons). Mon premier compte disait 79 occurrences dans 7 scènes — vrai pour les occurrences,
 * faux pour la casse : dans cinq d'entre elles le tiret collé formait déjà un nom déclaré, donc
 * la nouvelle règle les CONFIRME au lieu de les casser.
 */
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const jetons = (s) => {
  try { return tokenize(`${s}\n`).filter((t) => t.type !== 'NEWLINE' && t.type !== 'EOF')
    .map((t) => `${t.type}(${t.value})`).join(' '); }
  catch (e) { return `LEX: ${e.message}`; }
};

// ── A. LE COLLAGE DÉCIDE, ET LA MATRICE COUVRE LES DEUX SENS ────────────────────────────────
{
  for (const [quoi, source, attendu] of [
    ['collé des deux côtés',  'dha-dha',   'IDENT(dha-dha)'],
    ['entre espaces',         'dha - dha', 'IDENT(dha) REST(-) IDENT(dha)'],
    ['collé à gauche',        'do4-',      'IDENT(do4-)'],
    ['collé à gauche, double','dhin--',    'IDENT(dhin--)'],
    ['collé à droite seul',   '-fa3',      'REST(-) IDENT(fa3)'],
    ['entre nom et chiffre',  "A'8-2",     "IDENT(A'8-2)"],
    ['sans tiret',            'dha dha',   'IDENT(dha) IDENT(dha)'],
  ]) {
    ok(jetons(source) === attendu,
       `A. ${quoi} : '${source}' doit rendre « ${attendu} » — reçu « ${jetons(source)} »`);
  }
}

// ── B. CE QUE LA RÈGLE NE TOUCHE PAS ────────────────────────────────────────────────────────
// ⚠️ SANS CE VOLET, un collage trop large mangerait le séparateur, le contexte négatif et la
// pierre tombale de la flèche native — trois formes qui s'écrivent avec le même caractère.
{
  ok(jetons('-----') === 'SEPARATOR(-----)',
     `B. le séparateur de sous-grammaires reste entier — reçu « ${jetons('-----')} »`);
  ok(jetons('# - M') === jetons('#- M'),
     `B. le contexte négatif se lit pareil collé ou espacé : le '#' n'est pas une lettre. `
     + `collé « ${jetons('#- M')} » · espacé « ${jetons('# - M')} »`);
  ok(/LEX:/.test(jetons('a --> b')) && /moteur historique/.test(jetons('a --> b')),
     `B. la flèche du moteur historique reste REFUSÉE — reçu « ${jetons('a --> b')} »`);
  ok(jetons('-> b') === 'ARROW_R(->) IDENT(b)',
     `B. la flèche du langage n'est pas mangée par le collage — reçu « ${jetons('-> b')} »`);
}

// ── C. LA LECTURE EST LOCALE — elle ne dépend plus d'une AUTRE ligne du fichier ─────────────
// ⛔ LE VOLET QUI TIENT LA CAUSE. Avant, un membre gauche déclarant `Tr-11` changeait la lecture
// de `Tr-11` en membre droit, ailleurs dans le fichier. Le même texte doit désormais rendre les
// mêmes jetons, que la déclaration existe ou non.
{
  const seul = jetons('S -> Tr-11');
  const avecDeclaration = (() => {
    const t = tokenize('Tr-11 -> a\n-----\nS -> Tr-11\n').filter((x) => x.type !== 'NEWLINE' && x.type !== 'EOF');
    const i = t.findIndex((x, k) => k > 2 && x.type === 'IDENT' && x.value === 'S');
    return t.slice(i).map((x) => `${x.type}(${x.value})`).join(' ');
  })();
  ok(seul === avecDeclaration,
     `C. 'S -> Tr-11' doit rendre les MÊMES jetons qu'une déclaration existe ou non — `
     + `seul « ${seul} » · avec déclaration « ${avecDeclaration} ». Si les deux diffèrent, la `
     + `lecture d'une ligne dépend encore d'une autre ligne du fichier.`);
  ok(seul === 'IDENT(S) ARROW_R(->) IDENT(Tr-11)',
     `C. et c'est le NOM qui est lu, des deux côtés de la flèche — reçu « ${seul} »`);
}

// ── D. LA PRODUCTION SUIT — l'arbre porte ce que les jetons disent ──────────────────────────
// Accepter n'est pas lire : une graphie qui compile en rendant autre chose est pire qu'un refus.
{
  const droite = (src) => {
    const a = parse(tokenize(`core\nalphabet.simple\n-----\n${src}\n`));
    const r = (a.subgrammars || []).flatMap((g) => g.rules || []);
    return (r[0]?.rhs || r[0]?.right || []).map((e) => e.type).join('·');
  };
  ok(droite('S -> a - b') === 'Symbol·Rest·Symbol',
     `D. 'a - b' doit rendre Symbol·Rest·Symbol — reçu « ${droite('S -> a - b')} »`);
  ok(droite('S -> a-b') === 'Symbol',
     `D. 'a-b' doit rendre UN Symbol — reçu « ${droite('S -> a-b')} ». Le nom est lu, pas trois `
     + `éléments : c'est ce qui distingue la nouvelle règle de l'ancienne.`);
}

// ── E. LE PRÉ-SCAN A DISPARU DU CODE ───────────────────────────────────────────────────────
// Le code mort s'élague dans le mouvement qui le rend mort : une branche sans appelant vivant
// que le prochain rebrancherait « puisqu'elle est là ».
{
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/transpiler/tokenizer.js', import.meta.url), 'utf-8'));
  for (const mort of ['prescanHyphenatedNonTerminals', 'hyphenatedIds']) {
    ok(!src.includes(mort),
       `E. '${mort}' doit avoir disparu du tokenizer — il n'a plus rien à décider, et une `
       + `branche sans appelant vivant se fait rebrancher tôt ou tard.`);
  }
}

// ── SOCLE ──────────────────────────────────────────────────────────────────────────────────
ok(passe >= 15, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ le tiret collé appartient au nom : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Le tiret collé est une lettre du nom, entre espaces il est un silence — sur les `
          + `deux sens, sans toucher au séparateur, au contexte négatif ni aux flèches. La lecture `
          + `est LOCALE, la production suit, et le pré-scan a disparu. ${passe} vérification(s).`);
