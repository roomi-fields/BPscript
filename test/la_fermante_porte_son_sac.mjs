#!/usr/bin/env node
/**
 * UN BLOC RÉPARTI SUR PLUSIEURS RÈGLES SE RÈGLE COMME UN BLOC ÉCRIT D'UN SEUL TENANT.
 *
 * DÉCISION DE ROMAIN, portée par BPx le 2026-08-08 avec sa mesure : un réglage COLLÉ à une
 * accolade fermante porte sur LE BLOC ENTIER. C'est la règle générale du 2026-08-07 — collé règle
 * le groupe, espacé règle la règle — appliquée là où elle manquait.
 *
 * ⚠️ CE QUI ÉTAIT PERDU, ET POURQUOI L'AVAL NE POUVAIT RIEN Y FAIRE. Un bloc dont l'ouvrante et la
 * fermante vivent dans deux règles différentes ne peut pas se refermer au parse : on ne sait pas
 * quelle règle apportera l'ouvrante, et le tirage peut la fournir ou non. La branche de la fermante
 * lisait donc le crochet et la durée, mais PAS la parenthèse — qui tombait dans le sac de fin de
 * règle. Résultat mesuré, deux écritures du même bloc, deux musiques :
 *     S -> {C4 D4 E4 F4}(vel:50) G4          → QUATRE notes à 50
 *     A -> { C4 D4  ⏎  B -> E4 F4 }(vel:50)  → DEUX seulement
 * L'information « ce sac était collé au } » n'existait plus dans l'arbre. Aucun lecteur ne pouvait
 * la reconstituer : ce n'était pas un défaut de lecture chez l'aval, c'était une perte à l'écriture.
 *
 * ⚠️ ET LE COMMENTAIRE QUI GARDAIT CETTE PLACE ANNONÇAIT UN TRAVAIL INEXISTANT. Il renvoyait à une
 * « seconde passe » nommée `annotateUnbalancedBraces` dont le dépôt entier ne portait qu'une
 * occurrence : le commentaire lui-même. BPx l'a lu, a conclu que le travail était fait ailleurs, et
 * la durée d'un bloc réparti était perdue en silence des DEUX côtés pendant ce temps.
 * Un commentaire qui promet un mécanisme absent est pire qu'un trou déclaré — il éteint la question
 * chez celui qui le lit.
 *
 * CE QUE CE GARDE MESURE : l'endroit où le sac ATTERRIT, pas la compilation. Les quatre écritures
 * compilent toutes ; seule la place du sac distingue « le bloc entier » de « cette règle-ci ».
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const P = 'core\nalphabet.western\n-----\n';
const compiler = (corps) => {
  try { return compileToBPxAST(P + corps); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');

/** Où le réglage `vel` atterrit : sur la fermante, sur la règle, sur le bloc ? */
function ouEstLeSac(ast) {
  const vus = [];
  const w = (n, s = new WeakSet()) => {
    if (!n || typeof n !== 'object' || s.has(n)) return; s.add(n);
    if (Array.isArray(n)) { n.forEach((x) => w(x, s)); return; }
    const sacs = [n.settings, ...(n.suffixQualifiers || [])].filter(Boolean);
    if (sacs.some((sac) => (sac.pairs || []).some((p) => p.key === 'vel'))) vus.push(n.type);
    Object.values(n).forEach((v) => w(v, s));
  };
  w(ast);
  return vus.sort();
}

// ── LA MATRICE — ÉCRITURES × ENDROIT ATTENDU ─────────────────────────────────────────────────
// Ajouter une écriture la teste automatiquement. Les deux premières sont le cœur de la décision :
// même bloc, même contenu, deux graphies — le réglage doit atterrir au même endroit logique.
const CAS = [
  ['bloc d\'un seul tenant, sac COLLÉ',
   'S -> {C4 D4 E4 F4}(vel:50) G4\n', ['Polymetric'],
   'le sac collé à la fermante règle le BLOC'],
  ['bloc RÉPARTI, sac COLLÉ à la fermante',
   'S -> A B G4\n-----\nA -> { C4 D4\nB -> E4 F4 }(vel:50)\n', ['RawBrace'],
   'la fermante doit PORTER le sac — sinon l\'information disparaît de l\'arbre et le bloc réparti '
   + 'ne sonne pas comme le bloc écrit d\'un tenant'],
  ['bloc RÉPARTI, sac SÉPARÉ par une espace',
   'S -> A B G4\n-----\nA -> { C4 D4\nB -> E4 F4 } (vel:50)\n', ['Rule'],
   'séparé par une espace, il règle la RÈGLE — c\'est l\'autre moitié de la règle générale, et '
   + 'sans elle un correctif qui poserait TOUT sur la fermante passerait pour juste'],
  ['bloc RÉPARTI, sac collé PUIS un autre espacé',
   'S -> A B\n-----\nA -> { C4 D4\nB -> E4 F4 }(vel:50) (pan:20)\n', ['RawBrace'],
   'les deux coexistent : le collé au bloc, l\'espacé à la règle'],
];
for (const [quoi, corps, attendu, pourquoi] of CAS) {
  const r = compiler(corps);
  ok(messages(r) === '', `'${quoi}' est REFUSÉ : ${messages(r).slice(0, 80)}`);
  if (messages(r)) continue;
  const vu = ouEstLeSac(r.ast);
  ok(JSON.stringify(vu) === JSON.stringify(attendu),
     `${quoi} — le réglage doit être porté par ${attendu.join('+')}, il l'est par `
     + `${vu.join('+') || 'RIEN'}. ${pourquoi}. Les deux écritures COMPILENT : seule la place du `
     + `sac les distingue, et elle décide de combien de notes sonnent à 50.`);
}

// ── LE SAC N'ÉCRASE PAS LA DURÉE, ET RÉCIPROQUEMENT ──────────────────────────────────────────
// La fermante portait déjà sa durée ; le sac s'ajoute, il ne prend pas sa place.
{
  const r = compiler('S -> A B\n-----\nA -> { C4 D4\nB -> E4 F4 }:2\n');
  ok(messages(r) === '', `la durée collée à la fermante est REFUSÉE : ${messages(r).slice(0, 70)}`);
  if (!messages(r)) {
    // ⚠️ LA PREMIÈRE `RawBrace` EST L'OUVRANTE — ce garde cherchait celle-là et accusait le code
    // d'avoir perdu la durée. L'instrument ment plus souvent que le sujet, y compris quand c'est
    // le mien et qu'il vient d'être écrit.
    // ⛔ TOUTES LES SOUS-GRAMMAIRES, pas la premiere : le delimiteur initial est obligatoire
    // depuis le 2026-08-17, donc la passe qui porte la fermante n est plus forcement `[0]`.
    // Chercher dans une seule passe fait rendre `undefined` a un garde qui a raison sur le fond.
    const rb = r.ast.subgrammars.flatMap((g) => g.rules).flatMap((x) => x.rhs)
      .find((e) => e.type === 'RawBrace' && e.value === '}');
    ok(rb && rb.duree, `la fermante doit toujours porter sa DURÉE — reçu ${JSON.stringify(rb)}`);
  }
}

// ── LE SCEAU EST LE MÊME DES DEUX CÔTÉS ─────────────────────────────────────────────────────
// ⚠️ ROUTER LE SAC NE SUFFISAIT PAS, et c'est BPx qui l'a vu. Le sac arrivait sur la fermante mais
// NU : sans le sceau (`payload`) que porte celui d'un bloc écrit d'un seul tenant. Or c'est
// `payload.params` que lit l'extracteur commun — celui par lequel passe déjà le bloc d'un tenant.
// Sans sceau, l'aval aurait dû emprunter un second chemin pour la même notion : deux
// implémentations qui dérivent à la première évolution. Ils ont refusé de lire les paires en dur
// chez eux, et ils avaient raison : le sceau porte la nature et la portée, donc la classification
// des contrôles, qui vit dans MES librairies.
// On compare donc les deux sceaux CHAMP À CHAMP, pas leur simple présence.
{
  const tenant = compiler('S -> {C4 D4 E4 F4}(vel:50) G4\n');
  const reparti = compiler('S -> A B\n-----\nA -> { C4 D4\nB -> E4 F4 }(vel:50)\n');
  const sceau = (r, nature) => {
    let vu = null;
    const w = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(w); return; }
      if (n.type === nature && n.settings) vu = n.settings.payload ?? null;
      Object.values(n).forEach(w);
    };
    w(r.ast); return vu;
  };
  const a = sceau(tenant, 'Polymetric');
  const b = sceau(reparti, 'RawBrace');
  ok(!!b, `le sac de la fermante n'est pas SCELLÉ — il arrive nu. L'aval lit payload.params ; sans `
        + `lui il doit ouvrir un second chemin pour la même notion, et les deux dérivent.`);
  ok(JSON.stringify(a) === JSON.stringify(b),
     `les deux écritures du même bloc doivent porter le MÊME sceau, champ à champ. `
     + `Un seul tenant → ${JSON.stringify(a)} · réparti → ${JSON.stringify(b)}. `
     + `Une différence ici, et l'aval traite les deux écritures par deux chemins distincts.`);
}

// ── TÉMOIN — LE DÉTECTEUR SAIT DISTINGUER LES TROIS PORTEURS ────────────────────────────────
// ⚠️ Sans lui, un détecteur qui rendrait toujours la même nature passerait la matrice en triomphe.
{
  const r = compiler('S -> C4(vel:50) D4\n');
  ok(JSON.stringify(ouEstLeSac(r.ast)) === '["Symbol"]',
     `TÉMOIN — le détecteur ne reconnaît plus un réglage porté par une NOTE : il rend `
     + `${JSON.stringify(ouEstLeSac(r.ast))}. Tant qu'il confond les porteurs, la matrice ne prouve rien.`);
}

// ── SOCLE — LE COMMENTAIRE MENSONGER NE REVIENT PAS ─────────────────────────────────────────
// ⚠️ Mécanisé plutôt que rappelé : la fonction annoncée n'a jamais existé, et son nom seul avait
// suffi à convaincre un voisin que le travail était fait. Si quelqu'un la réintroduit en
// commentaire sans l'écrire, ce garde le dira.
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/transpiler/parser.js', import.meta.url), 'utf8');
  const cites = (src.match(/annotateUnbalancedBraces/g) || []).length;
  const definie = /function\s+annotateUnbalancedBraces/.test(src);
  ok(cites === 0 || definie,
     `SOCLE : 'annotateUnbalancedBraces' est CITÉE ${cites} fois dans le parseur sans y être `
     + `DÉFINIE. C'est exactement ce qui a coûté la durée des blocs répartis : un voisin a lu le `
     + `nom, conclu que le mécanisme existait, et cessé de chercher. Soit la fonction existe, soit `
     + `son nom disparaît.`);
}

ok(CAS.length >= 4 && CAS.some(([, , a]) => a[0] === 'RawBrace') && CAS.some(([, , a]) => a[0] === 'Rule'),
   `SOCLE : la matrice doit porter les DEUX destinations — ${CAS.length} écritures, dont au moins `
   + `une qui vise la fermante et une qui vise la règle. Avec une seule, elle ne mesure plus une `
   + `frontière.`);

if (echecs.length) {
  console.error(`❌ la fermante porte son sac : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un bloc réparti se règle comme un bloc d'un seul tenant — ${CAS.length} écritures `
          + `mesurées sur l'ENDROIT où le réglage atterrit, durée préservée, et le commentaire qui `
          + `promettait une passe inexistante ne peut plus revenir. ${passe} vérification(s) passée(s).`);
