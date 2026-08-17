#!/usr/bin/env node
/**
 * LE NOM D'UNE ENTRÉE DE LIBRAIRIE PEUT COMMENCER PAR UN CHIFFRE.
 *
 * `EBNF.md` §« Invoquer une librairie » : `library_invocation = "@" , LIBRARY , "." , entry_name`,
 * et `entry_name = ( letter | digit ) , { … }`. Les accordages et les tempéraments portent des noms
 * d'usage qui commencent par leur nombre de degrés — `12TET`, `22shruti`.
 *
 * ⛔ C'EST UNE PRODUCTION DISTINCTE, PAS UN `IDENT` ÉLARGI, et le volet C est là pour ça. `IDENT`
 * sert aussi aux acteurs, aux variables, aux définitions et aux terminaux : l'élargir ferait entrer
 * les chiffres dans toutes ces places d'un coup, ce que la décision ne demande pas.
 *
 * ⚠️ ET LA LECTURE EXISTAIT DÉJÀ, EN UN EXEMPLAIRE MAL PLACÉ. Le canal de provenance
 * (`@factory.`/`@mine.`) la portait — son commentaire nommait `12TET` et `22shruti` — et
 * l'invocation DIRECTE ne l'avait pas. Une garde de Kairos passait donc par la provenance pour
 * atteindre un tempérament, faute d'autre voie. Les deux lisent maintenant par la même fonction ;
 * le volet D garde ce partage, parce que deux lecteurs d'un même nom divergent au premier ajout.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const compiler = (tete) => {
  try { return compileToBPxAST(`@core\n${tete}\nS -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};

// ── A. LES ENTRÉES À CHIFFRE DE LA DONNÉE — toutes atteignables ──────────────────────────────
// ⚠️ LA LISTE EST MESURÉE SUR LE BUNDLE, jamais écrite ici : une entrée ajoutée demain est
// couverte le jour même, et une entrée retirée ne laisse pas un cas fantôme.
{
  const aChiffre = [];
  for (const [lib, f] of Object.entries(LIBS)) {
    if (!f || typeof f !== 'object') continue;
    for (const k of Object.keys(f)) if (/^[0-9]/.test(k)) aChiffre.push([lib, k]);
  }
  ok(aChiffre.length > 0,
     `A. aucune entrée à chiffre dans le bundle — le garde serait creux. S'il n'y en a plus, c'est `
     + `la donnée qui a changé, et ce garde doit le dire au lieu de verdir sur zéro.`);
  for (const [lib, entree] of aChiffre) {
    const r = compiler(`@${lib}.${entree}`);
    ok(messages(r) === '',
       `A. '@${lib}.${entree}' doit être ACCEPTÉ — reçu : ${messages(r).slice(0, 90)}`);
  }
}

// ── B. UNE ENTRÉE INCONNUE EST REFUSÉE POUR SON ABSENCE, PAS POUR SA FORME ───────────────────
// ⚠️ LE TÉMOIN QUI COMPTE : sans lui, une lecture qui avalerait n'importe quoi passerait le volet
// A en triomphe. Le refus doit NOMMER l'entrée manquante — s'il parlait de forme, il enverrait
// l'auteur corriger une graphie qui est juste.
{
  const msg = messages(compiler('@temperaments.12zzz'));
  ok(/12zzz/.test(msg),
     `B. '@temperaments.12zzz' doit REFUSER en nommant l'entrée absente. Reçu : ${msg.slice(0, 100) || 'aucune erreur'}`);
  ok(!/Expected/.test(msg),
     `B. le refus ne doit PAS être une faute de forme — reçu : ${msg.slice(0, 100)}. La graphie est `
     + `valide ; c'est l'entrée qui n'existe pas.`);
}

// ── C. LE LECTEUR D'ENTRÉE NE SE BRANCHE NULLE PART AILLEURS ────────────────────────────────
// La production ne vaut que pour un nom d'ENTRÉE. Un acteur, une variable, une définition
// commencent toujours par une lettre.
//
// ⚠️ CE VOLET GARDE LA FAUTE RÉALISABLE, ET J'AI DÛ CHERCHER LAQUELLE. Ma première injection
// élargissait `IDENT` dans le tokenizer : elle N'A PAS MORDU, et ce n'était pas le volet qui était
// creux — la branche des NOMBRES précède celle des identifiants, donc un chiffre initial est
// consommé avant que la règle des identifiants s'applique. L'élargissement y est inopérant.
// La faute qui peut réellement arriver est de BRANCHER LE NOUVEAU LECTEUR AILLEURS, en croyant
// bien faire. Injectée sur les acteurs, elle fait rougir ce volet.
{
  for (const [quoi, tete] of [
    ['un acteur',      '@actor 1perc @alphabet.western out.midi'],
    ['une variable',   '@var 2pivot'],
    ['une définition', '@def 3cloche  register:5'],
  ]) {
    ok(messages(compiler(tete)) !== '',
       `C. ${quoi} dont le nom commence par un chiffre doit rester REFUSÉ — la production neuve ne `
       + `vaut QUE pour un nom d'entrée. Si ce volet passe au vert, le lecteur d'entrée a été `
       + `branché ailleurs, et les chiffres sont entrés dans toutes ces places d'un coup.`);
  }
}

// ── D-bis. LE NOM DE LA LIBRAIRIE PORTE AUSSI UN TIRET ──────────────────────────────────────
// ⚠️ TROUVE PAR KANOPI EN RETIRANT LE PREFIXE DE PROVENANCE, qui le masquait. Le tokenizer detache
// le tiret partout depuis qu'il est un SILENCE dans le flux ; dans un nom de librairie il est une
// lettre. `@ragas-tunings.X` cassait a l'ANALYSE — « Expected arrow, got PERIOD » — au lieu d'etre
// LU puis refuse pour son axe. La difference compte : un refus syntaxique envoie corriger une
// graphie juste.
{
  const msg = messages(compiler('@ragas-tunings.sargam_12TET'));
  ok(!/Expected/.test(msg),
     `D-bis. '@ragas-tunings.X' doit etre LU, pas casser a l'analyse. Reçu : ${msg.slice(0, 100)}. `
     + `Un refus syntaxique sur un nom valide envoie l'auteur corriger ce qui est juste.`);
  ok(/aucune librairie ne sert l'axe 'ragas-tunings'/.test(msg),
     `D-bis. le refus doit nommer l'axe ENTIER, tiret compris — reçu : ${msg.slice(0, 100)}. `
     + `S'il nomme 'ragas' seul, le tiret a coupe le nom.`);
}

// ── D. UN SEUL LECTEUR — la voie directe et le canal de provenance lisent pareil ─────────────
// ⚠️ CE VOLET GARDE LA CAUSE, PAS LE SYMPTÔME. La lecture vivait dans le canal de provenance et
// manquait à la voie directe : deux endroits pour un même nom, un seul qui savait le lire.
{
  const direct = compiler('@temperaments.12TET');
  const provenance = compiler('@factory.temperaments.12TET');
  ok(messages(direct) === '' && messages(provenance) === '',
     `D. les deux voies doivent lire le même nom — direct : ${messages(direct).slice(0, 50) || 'ok'} · `
     + `provenance : ${messages(provenance).slice(0, 50) || 'ok'}. Si l'une passe et pas l'autre, `
     + `il reste deux lecteurs.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 10, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ un nom d'entrée peut commencer par un chiffre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Une entrée de librairie peut commencer par un chiffre — mesuré sur les entrées que `
          + `la DONNÉE porte, avec le refus qui nomme l'entrée absente au lieu de la forme, et sans `
          + `que 'IDENT' bouge pour les acteurs, variables et définitions. Un seul lecteur sert les `
          + `deux voies. ${passe} vérification(s) passée(s).`);
