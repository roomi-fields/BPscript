#!/usr/bin/env node
/**
 * GARDE — un tag de backtick nomme un ÉVALUATEUR DÉCLARÉ, pas n'importe quel mot.
 *
 * CE QUI PASSAIT, mesuré le 2026-08-13 : `` `zz: du code` `` compilait, et `` `jss: 1+1` `` aussi.
 * Le lecteur de tag ne vérifiait que sa FORME — une expression régulière « une lettre, puis des
 * caractères de mot » — jamais son appartenance à une liste. Une COQUILLE créait donc un interprète
 * fantôme EN SILENCE : la scène compilait, et le code partait à un évaluateur qui n'existe pas.
 * Même famille que le drapeau qui confisquait le nom d'un réglage, réparé la veille.
 *
 * DEUX MAILLONS MANQUAIENT, pas un seul — et c'est ce qui rendait le défaut invisible :
 *   · `lib/eval.json` DÉCLARAIT bien les évaluateurs, mais `core` ne l'apportait pas : une scène
 *     ordinaire n'avait même pas la liste en portée ;
 *   · et rien ne confrontait le tag à cette liste.
 * Le premier est réparé dans `core.apporte`, le second ici.
 *
 * LA LISTE EST UNE DONNÉE, jamais un tableau en dur. Ajouter un langage se fait dans la librairie,
 * et le refus le suit sans une ligne de code — ce garde le VÉRIFIE au volet 3, en fabriquant un
 * évaluateur en mémoire et en exigeant que son tag devienne acceptable.
 *
 * INJECTION dans l'ACCUSÉ (le refus retiré, la liste vidée) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { describeVocabulary, registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n-----\n';
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const refusDeTag = (src) =>
  erreursDe(src).filter((e) => /nomme un évaluateur qui n'est pas déclaré/.test(String(e.message)));

// ─── 0. SOCLE — la liste doit exister ET être en portée d'une scène ordinaire ────────────────
clearRegistry();
registerAll(LIBS);
const declares = (describeVocabulary().components || {}).eval || [];
ok(declares.length >= 8,
   `0. SOCLE : la librairie 'eval' doit déclarer au moins huit évaluateurs — vue ${declares.length}`);
ok((LIBS.core.apporte || []).includes('eval'),
   "0. SOCLE : `core` doit APPORTER 'eval' — sans quoi une scène ordinaire n'a pas la liste en "
   + 'portée, et le refus ne peut rien confronter');
ok(declares.includes('txt'),
   "0. `txt` doit être déclaré — ratifié par Romain le 2026-08-13 pour porter une PHRASE là où le "
   + "langage n'a pas de caractère d'échappement");

// ─── 1. LES TAGS DÉCLARÉS PASSENT, À TOUTES LES PLACES OÙ UN BACKTICK S'ÉCRIT ────────────────
for (const tag of declares) {
  ok(erreursDe(`${TETE}S -> \`${tag}: contenu\` C4\n`).length === 0,
     `1. '${tag}' est déclaré : son tag doit passer — refusé`);
}

// ─── 2. UN TAG NON DÉCLARÉ EST REFUSÉ, et la coquille est le cas qui compte ──────────────────
for (const [quoi, tag] of [
  ['un mot inventé',            'zz'],
  ['une coquille sur js',       'jss'],
  ['une coquille sur strudel',  'strudle'],
  ['un nom plausible',          'python'],
]) {
  ok(refusDeTag(`${TETE}S -> \`${tag}: contenu\` C4\n`).length > 0,
     `2. ${quoi} ('${tag}') doit être refusé — sinon il crée un interprète fantôme en silence`);
}

// ─── 2bis. LE REFUS PORTE LA LISTE, pour que l'auteur voie ce qu'il pouvait écrire ───────────
{
  const m = String(refusDeTag(`${TETE}S -> \`zz: x\` C4\n`)[0]?.message ?? '');
  ok(/js/.test(m) && /strudel/.test(m) && /txt/.test(m),
     `2bis. le refus doit NOMMER les évaluateurs déclarés — reçu : ${m.slice(0, 140)}`);
}

// ─── 3. LA LISTE EST UNE DONNÉE — ajouter un évaluateur suffit à faire passer son tag ────────
// ⚠️ Fabriqué EN MÉMOIRE, jamais sur le disque : une librairie modifiée sur disque atteint mes
// consommateurs à la seconde où j'enregistre.
{
  const avecFaux = JSON.parse(JSON.stringify(LIBS.eval));
  avecFaux.objects.zzlangue = { description: 'TÉMOIN DU GARDE — évaluateur fabriqué en mémoire' };
  registerLib('eval', avecFaux);
  ok(erreursDe(`${TETE}S -> \`zzlangue: x\` C4\n`).length === 0,
     "3. déclarer un évaluateur dans la LIBRAIRIE doit suffire à faire passer son tag — sinon la "
     + 'liste est en dur quelque part, et ajouter un langage demanderait de toucher au code');
  clearRegistry();
  registerAll(LIBS);
  ok(refusDeTag(`${TETE}S -> \`zzlangue: x\` C4\n`).length > 0,
     "3. après restauration, le témoin doit redevenir inconnu — sinon il fuit sur les gardes suivants");
}

// ─── 4. LE COMPLÉMENT — un backtick SANS tag reste légitime ──────────────────────────────────
// Sans ce volet, refuser TOUT backtick ferait passer le garde au vert en décrivant un langage plus
// étroit que le vrai : le tag est facultatif quand l'acteur déclare déjà son évaluateur.
ok(erreursDe(`${TETE}S -> C4(vel:\`40+2\`)\n`).length === 0,
   "4. un backtick SANS tag doit rester accepté — le langage s'hérite alors de l'acteur, et ce "
   + "garde ne porte que sur le tag ÉCRIT");

// ─── 5. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (tag, liste) => typeof tag === 'string' && tag.length > 0 && !liste.has(tag);
const liste = new Set(['js', 'txt']);
ok(juger('zz', liste), '5. (mord) un tag hors liste doit rougir');
ok(!juger('js', liste), '5. (se tait) un tag déclaré passe');
ok(!juger(null, liste), "5. (se tait) l'absence de tag n'est pas un tag inconnu");
ok(!juger('', liste), '5. (se tait) un tag vide non plus');

if (echecs.length) {
  console.error(`❌ tag de backtick non déclaré : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un tag nomme un évaluateur déclaré — ${passe} vérification(s) passée(s), `
    + `${declares.length} évaluateurs en portée`);
}
