#!/usr/bin/env node
/**
 * UNE DÉCLARATION S'ÉCRIT SUR PLUSIEURS LIGNES — parenthèse ouvrante et fermante.
 *
 * Décision Romain du 2026-08-15 : « La forme longue s'écrit sur plusieurs lignes, parenthèse
 * ouvrante et fermante. » Elle porte sur ce qui DÉCLARE — un préréglage, une transformation
 * paramétrée, les détails d'une sortie d'acteur.
 *
 * ⛔ ET LA PARENTHÈSE EST CE QUI BORNE, PAS L'INDENTATION. La même décision pose qu'un mot déclaré
 * sans argument VAUT SA PRÉSENCE — `letring` s'écrit seul. En indentation, un dernier mot sans
 * affectation est indistinguable de la fin du bloc ; la fermante le dit, un retour à la ligne non.
 *
 * ⛔ LA PRODUCTION NE SUIT PAS, ET C'EST LE VOLET C. Une règle finit à la ligne : autoriser le
 * multiligne dans un sac de flux changerait ce que la partie production sait borner. Le volet garde
 * cette frontière — sans lui, une correction faite « partout » l'effacerait sans que rien ne crie.
 *
 * ⚠️ LE SAUT VIT AU SOMMET DE CHAQUE BOUCLE, et c'est ce que le volet A mesure sur les trois
 * lecteurs à la fois. Posé après une seule virgule, il aurait laissé les autres formes de reprise
 * refuser un retour à la ligne — le lecteur de sortie d'acteur reprend par `continue` à trois
 * endroits distincts, un seul aurait été couvert.
 */
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const lire = (src) => { try { return { ast: parse(tokenize(src)), err: null }; }
                        catch (e) { return { ast: null, err: e.message }; } };

// ── A. LES TROIS DÉCLARATIONS ACCEPTENT LE MULTILIGNE ────────────────────────────────────────
// Une matrice, pas une liste : chaque lecteur de parenthèse déclarative est éprouvé.
{
  for (const [quoi, src] of [
    ['un préréglage',            'def x (\n  a:1,\n  b:2\n)\nalphabet.western\n-----\nS -> C4\n'],
    ['une transformation',       'core\ndef accent(\n  x\n) x(vel:120)\nalphabet.western\n-----\nS -> C4\n'],
    ['une sortie d\'acteur',     'core\nactor l @alphabet.western out.midi(\n  ch:1,\n  volume:80\n)\n-----\nS -> C4\n'],
    ['un mot sans argument',     'def kick (\n  letring,\n  vel:120\n)\nalphabet.western\n-----\nS -> C4\n'],
    ['une virgule finale',       'def x (\n  a:1,\n  b:2,\n)\nalphabet.western\n-----\nS -> C4\n'],
    ['un commentaire dedans',    'def x (\n  a:1,\n  // ce que la clé suivante règle\n  b:2\n)\nalphabet.western\n-----\nS -> C4\n'],
  ]) {
    const { err } = lire(src);
    ok(err === null,
       `A. ${quoi} doit s'écrire sur plusieurs lignes — reçu : ${String(err).slice(0, 90)}`);
  }
}

// ── B. LA FORME COURTE N'A PAS BOUGÉ ────────────────────────────────────────────────────────
// ⚠️ SANS CE VOLET, un lecteur qui EXIGERAIT le retour à la ligne passerait le volet A en triomphe
// tout en cassant toutes les déclarations existantes.
{
  for (const [quoi, src] of [
    ['un préréglage',        'def x (a:1, b:2)\nalphabet.western\n-----\nS -> C4\n'],
    ['une transformation',   'core\ndef accent(x) x(vel:120)\nalphabet.western\n-----\nS -> C4\n'],
    ['une sortie d\'acteur', 'core\nactor l @alphabet.western out.midi(ch:1)\n-----\nS -> C4\n'],
    ['un sac de règle',      'core\nalphabet.western\n-----\nS -> C4(vel:80)\n'],
  ]) {
    const { err } = lire(src);
    ok(err === null, `B. ${quoi} sur UNE ligne doit rester lu — reçu : ${String(err).slice(0, 90)}`);
  }
}

// ── C. LA PRODUCTION GARDE SA LECTURE — une règle finit à la ligne ──────────────────────────
// ⚠️ CE VOLET GARDE UNE FRONTIÈRE, PAS UN DÉFAUT. La partie déclarative et la production ne se
// lisent pas pareil ; une correction appliquée « partout » effacerait la différence en silence.
{
  for (const [quoi, src] of [
    ['un sac de réglages', 'core\nalphabet.western\n-----\nS -> C4(\n  vel:80\n)\n'],
    ['un sac de flux',     'core\nalphabet.western\n-----\nS -> a !(\n  vel:80\n) b\n'],
  ]) {
    const { err } = lire(src);
    ok(err !== null,
       `C. ${quoi} multiligne DANS UNE RÈGLE doit rester refusé : une règle finit à la ligne. `
       + `S'il passe, le multiligne a été étendu à la production, ce que la décision ne dit pas.`);
  }
}

// ── D. UNE PARENTHÈSE JAMAIS REFERMÉE EST REFUSÉE ───────────────────────────────────────────
// ⚠️ LE TÉMOIN QUI COMPTE : en sautant les retours à la ligne, un lecteur qui ne bornerait plus
// rien avalerait la scène entière en silence. Le refus doit sortir, et nommer la fermante.
{
  const { err } = lire('def x (\n  a:1\nalphabet.western\n-----\nS -> C4\n');
  ok(err !== null,
     `D. une parenthèse jamais refermée doit REFUSER — sinon le saut des retours à la ligne fait `
     + `avaler tout ce qui suit, sans un signe.`);
  ok(err !== null && /RPAREN|parenth/i.test(err),
     `D. le refus doit nommer la parenthèse fermante — reçu : ${String(err).slice(0, 90)}`);
}

// ── E. CE QUE LE MULTILIGNE PRODUIT EST CE QUE LA FORME COURTE PRODUIT ──────────────────────
// ⛔ ACCEPTER N'EST PAS LIRE. Une forme qui compile en rendant un arbre différent est pire qu'une
// forme refusée : elle passe le volet A en vert et la donnée sort fausse.
{
  const courte = lire('def x (a:1, b:2, letring)\nalphabet.western\n-----\nS -> C4\n');
  const longue = lire('def x (\n  a:1,\n  b:2,\n  letring\n)\nalphabet.western\n-----\nS -> C4\n');
  const paires = (r) => {
    // `def x (…)` est un objet RACINE depuis le 2026-09-02 : il vit dans `vars`, pas dans `defs`.
    const d = (r.ast?.vars || []).find((v) => v.varType?.kind === 'type' && v.varType.type === null);
    return d?.settings?.pairs?.map((p) => `${p.key}=${p.value}`).join(' ') ?? null;
  };
  ok(paires(courte) !== null && paires(courte) === paires(longue),
     `E. les deux écritures doivent rendre le MÊME arbre — courte : ${paires(courte)} · `
     + `longue : ${paires(longue)}. Une différence ici veut dire que le retour à la ligne emporte `
     + `une clé ou en fabrique une.`);
  ok(String(paires(courte)).includes('letring=true'),
     `E. un mot déclaré sans argument vaut sa PRÉSENCE — reçu : ${paires(courte)}. C'est la raison `
     + `pour laquelle la parenthèse borne et l'indentation non.`);
}

// ── SOCLE ───────────────────────────────────────────────────────────────────────────────────
ok(passe >= 15, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ une déclaration s'écrit sur plusieurs lignes : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Les trois déclarations à parenthèse s'écrivent sur plusieurs lignes et rendent le `
          + `même arbre que sur une seule ; la forme courte n'a pas bougé, la production garde sa `
          + `lecture, et une parenthèse jamais refermée refuse. ${passe} vérification(s) passée(s).`);
