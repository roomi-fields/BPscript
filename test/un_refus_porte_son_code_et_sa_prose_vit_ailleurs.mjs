#!/usr/bin/env node
/**
 * GARDE — TOUT REFUS PORTE UN CODE, ET SA PROSE VIT DANS LE CATALOGUE.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, ET C'EST DEUX VOISINS QUI L'ONT PAYÉ. Le TEXTE d'un refus était la
 * seule surface à laquelle un consommateur pouvait s'accrocher, et elle n'était déclarée nulle part :
 *
 *     kanopi   11 bancs sur 939 cassés par ma seule TRADUCTION en anglais — même refus, autre langue
 *     kairos   un banc exigeait le mot « introuvable » ; je rends `not found in the catalog`.
 *              Même porte, même cause, même étage : SEULE la phrase avait bougé.
 *
 * ⇒ *Un garde bâti sur la graphie d'un voisin mesure sa rédaction, jamais son comportement* (kairos,
 *   2026-09-04). Décision de Romain le même jour : des codes stables, et le texte hors du compilateur.
 *
 * ⛔ CE QUE CE GARDE TIENT, ET POURQUOI C'EST UNE MATRICE. Un refus s'écrit de DEUX façons — un JET
 * (`new ParseError(…)`) et une POUSSÉE (`errors.push({…})`) — et n'en couvrir qu'une laisse l'autre
 * libre de réécrire sa prose au site. C'est le défaut exact que `un_refus_ne_prescrit_pas_une_forme_
 * morte` a payé le 2026-08-19 : il balayait UN refus sur QUARANTE-DEUX dans l'émetteur.
 *
 * ⚠️ ET IL ÉPROUVE LE COMPLÉMENT : ce que le mécanisme doit REFUSER — un code absent du catalogue,
 * un trou qu'on ne remplit pas. Un composeur qui rend un texte approximatif au lieu de lever fait un
 * refus muet qui ressemble à un refus.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { texteDuDiagnostic, diagnostic, codesDeDiagnostic } from '../src/transpiler/diagnostics.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'transpiler');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LE CATALOGUE EXISTE ET IL N'EST PAS VIDE ─────────────────────────────────────────────────
const codes = codesDeDiagnostic();
ok(codes.length >= 150,
   `1. SOCLE : ${codes.length} code(s) au catalogue — sous ce seuil, tout ce qui suit mesure un `
   + `catalogue amputé et le déclare conforme.`);
ok(codes.every((c) => /^[A-Z][A-Z0-9_]+$/.test(c)),
   `1. un code s'écrit en MAJUSCULES et ne se renomme pas — reçu ${codes.filter((c) => !/^[A-Z][A-Z0-9_]+$/.test(c)).join(', ')}`);

// ── 2. AUCUN REFUS N'ÉCRIT SA PROSE AU SITE — les DEUX graphies, dans TOUS les fichiers ─────────
// ⛔ LA PORTÉE EST LE DOSSIER, PAS LA LISTE DES FICHIERS QUE JE CONNAIS. Un fichier ajouté demain
// est soumis le jour même ; une liste écrite à la main serait le neuvième lecteur par énumération.
{
  const fichiers = readdirSync(SRC)
    .filter((f) => f.endsWith('.js') && !f.endsWith('-data.js'))
    .map((f) => join(SRC, f));
  ok(fichiers.length >= 10, `2. SOCLE : ${fichiers.length} fichier(s) balayé(s) — l'assiette a fondu.`);

  const fautifs = [];
  let refusLus = 0;
  for (const chemin of fichiers) {
    const texte = readFileSync(chemin, 'utf-8');
    const nom = chemin.split('/').pop();
    // Un JET dont le premier argument n'est PAS un littéral de code entre apostrophes.
    // ⚠️ LE PREMIER ARGUMENT PEUT TENIR SUR DEUX LIGNES — un site qui CHOISIT son code par une
    //   condition écrit `new ParseError(\n  cond ? 'A' : 'B',`. Un motif borné à la ligne le
    //   déclarait fautif : le garde accusait la forme même qu'il existe pour encourager.
    for (const m of texte.matchAll(/new (?:Parse|Lex)Error\(([\s\S]{0,200}?),/g)) {
      refusLus++;
      const premier = m[1].trim();
      // Le seul critère : le premier argument ne contient AUCUNE prose — que des codes et une
      // condition. Un littéral de texte s'y voit à ses guillemets autour de minuscules.
      const codesCites = premier.match(/'[A-Z][A-Z0-9_]+'/g) || [];
      const litteraux = premier.match(/['"`]/g) || [];
      if (codesCites.length > 0 && litteraux.length === codesCites.length * 2) continue;
      fautifs.push(`${nom} → ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
    }
    // Une POUSSÉE qui écrit `message:` au lieu de passer par le composeur.
    for (const m of texte.matchAll(/errors\.push\(\{[^}]*?\bmessage:\s*([`'"])/g)) {
      refusLus++;
      fautifs.push(`${nom} → errors.push({ message: … }) écrit sa prose au site`);
    }
  }
  ok(refusLus >= 100,
     `2. SOCLE : ${refusLus} refus lu(s) — sous ce seuil, le balayage ne reconnaît plus la graphie `
     + `que le code écrit, et « aucun fautif » ne veut plus rien dire.`);
  ok(fautifs.length === 0,
     `2. ⛔ ${fautifs.length} refus écrivent leur PROSE au site au lieu de nommer un code :\n     `
     + `${fautifs.slice(0, 6).join('\n     ')}\n     Le texte vit dans 'messages/<langue>.js' — un `
     + `refus qui l'écrit sur place redevient une surface que les voisins épinglent.`);
}

// ── 3. LE CODE ARRIVE À LA PORTE — mesuré sur des refus RÉELS, pas sur la classe ────────────────
// ⛔ UN BANC QUI APPELLE MA CLASSE PROUVE LA CLASSE, JAMAIS LE BRANCHEMENT. Une erreur qui porte son
// code À L'INTÉRIEUR du compilateur et le perd à la porte laisse les consommateurs exactement où ils
// étaient. On compile donc de vraies scènes et on lit ce qui SORT.
{
  const B = String.fromCharCode(96);
  const cas = [
    ['un caractère illisible',   'core\nalphabet.western\n-----\nS -> C4 %\n'],
    ['un bloc de code ouvert',   `core\nalphabet.western\nsound m(v:1) ${B}${B}ts: x\n-----\nS -> C4\n`],
    ['une espace avant le sac',  'core\nalphabet.western\ndef kick (vel:120)\n-----\nS -> C4\n'],
    ['un terminal non déclaré',  'core\nalphabet.western\n-----\nS -> zorglub\n'],
    ['un axe qui ne sert rien',  'core\nalphabet.western\nzorglub.truc\n-----\nS -> C4\n'],
  ];
  for (const [quoi, source] of cas) {
    const errs = (compileToBPxAST(source, {}).errors) || [];
    ok(errs.length > 0, `3. ${quoi} : doit être REFUSÉ`);
    const sansCode = errs.filter((e) => !e.code);
    ok(sansCode.length === 0,
       `3. ${quoi} : chaque refus doit porter son code — ${sansCode.length} sans code, `
       + `dont « ${(sansCode[0] || {}).message ?? ''} ».slice(0, 70)`);
    for (const e of errs) {
      if (!e.code) continue;
      ok(codes.includes(e.code),
         `3. ${quoi} : le code '${e.code}' rendu au consommateur n'est pas au catalogue — un code `
         + `qu'on ne peut pas retrouver ne s'oppose à rien.`);
    }
  }
}

// ── 4. LE COMPLÉMENT — ce que le composeur doit REFUSER ────────────────────────────────────────
// ⛔ UN COMPOSEUR QUI REND UN TEXTE APPROXIMATIF FABRIQUE UN REFUS MUET. Rendre le code brut comme
// message, ou laisser une accolade dans une phrase publiée, ne rougit nulle part : c'est du texte
// pour un humain, et il ressemble à un message.
{
  let leve = false;
  try { texteDuDiagnostic('CODE_QUI_N_EXISTE_PAS', {}); } catch { leve = true; }
  ok(leve, "4. un code absent du catalogue doit LEVER — un texte approximatif est un refus muet");

  // ⛔ UN TROU SE DÉTECTE EN LE REMPLISSANT DEUX FOIS, jamais en lisant le fichier. Ma première
  //   écriture cherchait `{nom}` dans le texte du catalogue en découpant sur l'indentation — un
  //   message sur plusieurs lignes lui échappait, et le socle rendait ZÉRO sur un catalogue qui en
  //   porte des dizaines. *Suspecter l'instrument avant le sujet.* Deux valeurs différentes dans
  //   les mêmes trous donnent deux textes différents : c'est ce que « porter un trou » veut dire.
  const remplir = (v) => new Proxy({}, { has: () => true, get: () => v });
  const premierATrou = codes.find((c) =>
    texteDuDiagnostic(c, remplir('AAA')) !== texteDuDiagnostic(c, remplir('BBB')));
  ok(Boolean(premierATrou), '4. SOCLE : au moins un message doit porter un trou, sinon rien à éprouver');
  if (premierATrou) {
    let leve2 = false;
    try { texteDuDiagnostic(premierATrou, {}); } catch { leve2 = true; }
    ok(leve2, `4. un trou non rempli doit LEVER — '${premierATrou}' a rendu une phrase à accolades`);
  }

  const rendu = diagnostic(codes[0], parametresDe(), { line: 7 });
  ok(rendu.code === codes[0] && typeof rendu.message === 'string' && rendu.line === 7,
     `4. le composeur rend { code, message, line } — reçu ${JSON.stringify(rendu).slice(0, 90)}`);
}

/** Un sac qui remplit TOUS les trous, quel que soit leur nom — pour éprouver sans faire lever. */
function parametresDe() {
  return new Proxy({}, { has: () => true, get: () => 'x' });
}

if (echecs.length) {
  console.error(`[diagnostics] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[diagnostics] ${passe} PASS / 0 FAIL — ${codes.length} code(s) au catalogue, `
  + `les deux graphies d'un refus balayées.`);
