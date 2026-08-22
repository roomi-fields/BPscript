#!/usr/bin/env node
// ⛔ MIGRE LE 2026-08-22 : une librairie s invoque par le mot qu elle DECLARE, jamais par le nom
// de son fichier (decision de Romain du 2026-08-17, frappee ce jour). `temperaments` →
// `temperament`, `test_alphabets` → `alphabet`, `voices` → `voice`, `tunings` → `tuning`,
// `scales` → `scale`, `sounds` → `sound`, `alphabets` → `alphabet`.
/**
 * UN AXE QUE PERSONNE NE SERT EST REFUSÉ.
 *
 * `@<axe>.<entrée>` charge une entrée dans une librairie. Quand AUCUNE librairie ne porte cet axe,
 * l'invocation ne charge rien — et rien ne distingue ce silence d'une scène qui n'a pas déclaré.
 *
 * ⛔ LE TROU N'ÉTAIT PAS DE TROIS NOMS, IL ÉTAIT OUVERT À L'INFINI. La spec nommait `module`,
 * `patch` et `devices` parmi les librairies invocables ; aucune donnée ne les sert, et le
 * compilateur les acceptait. Mais le code ne les a JAMAIS connus : la branche disait « pas une
 * librairie : autre faute, autre message », et aucun autre message n'existait. `@zzzinvente.quoi`
 * passait donc aussi bien qu'eux.
 *
 * ⚠️ LA CONTRE-ÉPREUVE QUI L'A ÉTABLI : `@alphabet.nexistepas` REFUSE. La validation existe et mord
 * quand la donnée existe — ce qui passait n'était donc pas une liste privilégiée, c'était TOUT nom
 * pour lequel aucune donnée n'est chargée. Un axe fabriqué le prouve mieux qu'un axe observé.
 *
 * ⚠️ ET CE QUI EST ÉPARGNÉ SE LIT DANS LA DONNÉE : les mots du langage que
 * `core.schema.reservedDirectives` recense. `@out.midi` porte une sous-clé sans être une invocation
 * de librairie ; l'écrire en dur ici rouvrirait le défaut qu'on ferme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const compiler = (tete) => compileToBPxAST(`core\nalphabet.western\n${tete}\n-----\nS -> C4\n`);

// ── A. UN AXE SANS DONNÉE EST REFUSÉ, ET LE REFUS LE NOMME ──────────────────────────────────
// ⚠️ Les trois premiers viennent de la spec, le quatrième est FABRIQUÉ — c'est lui qui prouve que
// la règle porte sur l'espace et non sur une liste.
{
  for (const axe of ['module', 'patch', 'devices', 'zzzinvente', 'quoiquecesoit']) {
    const msg = messages(compiler(`${axe}.nimporte`));
    ok(new RegExp(`aucune librairie ne sert l'axe '${axe}'`).test(msg),
       `A. '${axe}.nimporte' doit REFUSER en nommant l'axe. Reçu : ${msg.slice(0, 100) || 'aucune erreur'}`);
  }
}

// ── B. CE QUE LA DONNÉE SERT PASSE — sur TOUTES les librairies du bundle ────────────────────
// ⚠️ LA LISTE VIENT DU BUNDLE : une librairie ajoutée demain est couverte le jour même, et une
// librairie retirée ne laisse pas un cas fantôme.
{
  const ALIAS = { alphabets: 'alphabet', tunings: 'tuning', scales: 'scale', sounds: 'sound' };
  let verifies = 0;
  for (const [nom, f] of Object.entries(LIBS)) {
    if (!f || typeof f !== 'object') continue;
    const entrees = Object.keys(f).filter((k) => !k.startsWith('_')
      && !['resolvedBy', 'resolves', 'name', 'description', 'version', 'schema', 'defaults', 'symbols', 'settings', 'apporte'].includes(k)
      && f[k] && typeof f[k] === 'object' && !Array.isArray(f[k]));
    if (!entrees.length) continue;
    const axe = ALIAS[nom] || nom;
    if (axe === 'alphabet') continue;   // une scène ne déclare qu'un alphabet — testé au volet C
    verifies++;
    const msg = messages(compiler(`${axe}.${entrees[0]}`));
    ok(!/aucune librairie ne sert/.test(msg),
       `B. '${axe}.${entrees[0]}' est servi par le bundle : il ne doit PAS tomber sous ce refus. `
       + `Reçu : ${msg.slice(0, 90)}`);
  }
  ok(verifies >= 10,
     `B. ${verifies} axes servis vérifiés seulement — le volet ne mesure plus l'espace des librairies.`);
}

// ── C. LES MOTS DU LANGAGE SONT ÉPARGNÉS, ET LA LISTE EST DANS LA DONNÉE ────────────────────
// ⚠️ SANS CE VOLET, un refus trop large casserait `out.midi` — une clé d'ACTEUR qui porte une
// sous-clé sans être une invocation de librairie.
{
  const mots = LIBS.core?.schema?.reservedDirectives || [];
  ok(Array.isArray(mots) && mots.length > 10,
     `C. 'core.schema.reservedDirectives' doit vivre dans la DONNÉE — reçu ${JSON.stringify(mots).slice(0, 60)}.`);
  ok(mots.includes('out'),
     `C. 'out' doit être recensé parmi les mots du langage — sinon 'out.midi' tombe sous le refus.`);

  const sortie = compileToBPxAST('core\nalphabet.western\nout.midi\n-----\nS -> C4\n');
  ok(messages(sortie) === '',
     `C. 'out.midi' est une clé d'ACTEUR, pas une invocation de librairie : elle doit passer. `
     + `Reçu : ${messages(sortie).slice(0, 90)}`);

  // ⚠️ LE VOLET PORTE SUR TOUS LES MOTS RECENSÉS, PAS SUR `out` SEUL, et c'est une injection qui
  // ne mordait pas qui l'a exigé : écrire `new Set(['out'])` en dur dans le code passait le volet
  // EN VERT, puisque `out` était le seul cas éprouvé. Huit mots du langage portent une sous-clé
  // sans être servis par une librairie — `speed`, `alias`, `init`, `template`, `ins`, `transpose`,
  // `chromashift`, `out`. Les parcourir tous fait échouer toute liste plus courte que la donnée.
  const ALIAS_FICHIER = { alphabet: 'alphabets', tuning: 'tunings', scale: 'scales', sound: 'sounds' };
  let epargnes = 0;
  for (const mot of mots) {
    if (LIBS[ALIAS_FICHIER[mot] || mot]) continue;         // servi par une librairie : autre cas
    const msg = messages(compiler(`${mot}.zzz`));
    if (!msg) epargnes++;
    ok(!/aucune librairie ne sert/.test(msg),
       `C. '${mot}' est un mot du LANGAGE recensé par la donnée : il ne doit jamais tomber sous le `
       + `refus d'axe. Reçu : ${msg.slice(0, 90)}. Une liste écrite dans le code au lieu de la `
       + `donnée en épargnerait moins que la donnée n'en recense.`);
  }
  // ⚠️ SEUIL DESCENDU DE 5 À 4 LE 2026-08-19, À LA MAIN ET SUR MESURE. `out` a quitté les épargnés :
  // la sortie de SCÈNE (`out.<canal>` en tête, sans acteur) acceptait un canal inventé, alors que
  // la forme d'acteur le refusait depuis le 2026-08-04. La quatrième case de la liste fermée est
  // fermée, donc `out.zzz` porte désormais un message — et c'est le bon : il NOMME la direction,
  // jamais « aucune librairie ne sert », ce que le volet juste au-dessus vérifie mot pour mot.
  // Le seuil suit le fait ; il ne le précède pas.
  ok(epargnes >= 4,
     `C. ${epargnes} mots du langage épargnés seulement — sous ce seuil, le volet ne mesure plus la `
     + `donnée mais un cas particulier.`);

  const alpha = compileToBPxAST('core\nalphabet.western\n-----\nS -> C4\n');
  ok(messages(alpha) === '', `C. 'alphabet.western' passe toujours — reçu : ${messages(alpha).slice(0, 80)}`);
}

// ── D. LA VALIDATION D'ENTRÉE N'A PAS BOUGÉ — le refus voisin garde son message ─────────────
// Un axe SERVI dont l'entrée manque crie autrement : c'est l'entrée qu'il nomme, pas l'axe.
{
  const msg = messages(compiler('temperament.nexistepasdutout'));
  ok(/l'entrée 'nexistepasdutout' n'existe pas/.test(msg),
     `D. un axe servi dont l'entrée manque doit nommer L'ENTRÉE, pas l'axe — les deux refus se `
     + `distinguent. Reçu : ${msg.slice(0, 100)}`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 18, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ un axe que personne ne sert : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Un axe qu'aucune librairie ne sert est REFUSÉ, y compris fabriqué — la règle porte `
          + `sur l'espace, pas sur trois noms. Ce que le bundle sert passe, les mots du langage sont `
          + `épargnés par la DONNÉE, et le refus d'entrée voisin garde son message. `
          + `${passe} vérification(s) passée(s).`);
