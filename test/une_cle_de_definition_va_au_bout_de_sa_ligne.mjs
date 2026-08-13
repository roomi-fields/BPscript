#!/usr/bin/env node
/**
 * GARDE — la valeur d'une clé de `@def` va jusqu'au bout de sa ligne, et l'espace en sépare les
 * PARTIES.
 *
 * C'est la règle du langage, écrite ailleurs et non tenue ici : « l'espace ne sépare que les PARTIES
 * d'une valeur ». Le lecteur de clés d'une définition ne la tenait pas, et il échouait de DEUX
 * façons dont la seconde est bien pire :
 *
 *   `scope:symbol group`   il s'arrêtait au premier mot ESPACÉ et laissait le reste pendre. La
 *                          scène sortait « Expected arrow (-> <- <>) » — un refus qui accuse la
 *                          ligne SUIVANTE, alors que la faute est trois jetons plus haut.
 *   `range:0 127`          un NOMBRE espacé ne l'arrêtait PAS : les deux étaient CONCATÉNÉS en la
 *                          chaîne « 0127 ». Corruption SILENCIEUSE — la scène compile, la valeur
 *                          est fausse, et rien ne le dit. C'est le mode d'échec qui coûte le plus.
 *
 * POURQUOI CETTE FORME COMPTE : c'est celle dont une LIBRAIRIE écrite en BPScript a besoin. Un
 * contrôle porte une plage (`range:0 127`) et une portée (`scope:symbol group rule flow`) ; sans
 * valeur à plusieurs parties, aucune librairie ne peut se dire dans le langage.
 *
 * LA FORME RENDUE SUIT LA DONNÉE EXISTANTE : une seule partie reste une CHAÎNE — rien ne change
 * pour `bp3:_vel` — plusieurs deviennent une LISTE, exactement ce que les librairies JSON portent
 * déjà pour `range` et `scope`.
 *
 * ⛔ LES PARTIES SONT CELLES DU BLOC, ET LA LIGNE EST LA FRONTIÈRE. Sur une MÊME ligne,
 * `hz:440 voice` et `scope:symbol group` ont exactement la même forme : rien ne les distingue sans
 * connaître la clé. Or le mot nu après une clé est une faute DATÉE (témoin déplacé le 2026-08-08
 * après mesure aux deux endroits), et la valeur à plusieurs parties est ce dont une librairie a
 * besoin. Les deux ne peuvent pas coexister sur une ligne — ils coexistent de part et d'autre d'un
 * saut de ligne. Trouvé en cassant le garde voisin, pas en raisonnant.
 *
 * ⚠️ LE TYPAGE DES NOMBRES EST UNE AUTRE QUESTION, et il n'est PAS fait ici : `default:64` rend la
 * chaîne '64'. Le convertir changerait l'arbre de TOUTES les clés existantes. Une seule chose bouge
 * à la fois.
 *
 * INJECTION dans l'ACCUSÉ et dans le JUGE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = '@core\n@alphabet.western\n';
const clesDe = (corps) => {
  let r; try { r = compileToBPxAST(`${TETE}@def k\n${corps}\n\nS -> C4\n`); } catch (e) { return { erreur: e.message }; }
  if ((r.errors ?? []).length) return { erreur: r.errors[0].message };
  const d = ((r.ast ?? r).directives || []).find((x) => x.type === 'DefDirective');
  return d ? Object.fromEntries(Object.entries(d.keys || {}).map(([c, v]) => [c, v.value])) : {};
};

// ─── 0. TÉMOIN — une clé à UNE partie ne change pas de forme ─────────────────────────────────
ok(clesDe('  bp3:_k').bp3 === '_k',
   `0. TÉMOIN : une valeur à une seule partie reste une CHAÎNE — sinon tout ce qui existe déjà `
   + `change de forme (reçu ${JSON.stringify(clesDe('  bp3:_k'))})`);

// ─── 1. LES PARTIES SONT GARDÉES, ET TYPÉES ──────────────────────────────────────────────────
for (const [quoi, corps, cle, attendu] of [
  ['une plage de deux nombres',   '  range:0 127',                    'range', ['0', '127']],
  ['une portée de quatre mots',   '  scope:symbol group rule flow',   'scope', ['symbol', 'group', 'rule', 'flow']],
  ['un nombre seul, une partie',  '  default:64',                     'default', '64'],
  ['un négatif, une partie',      '  min:-12',                        'min', '-12'],
  ['un décimal, une partie',      '  facteur:1.5',                    'facteur', '1.5'],
  ['deux mots',                   '  args:pivot factor',              'args', ['pivot', 'factor']],
]) {
  const got = clesDe(corps)[cle];
  ok(JSON.stringify(got) === JSON.stringify(attendu),
     `1. ${quoi} : '${corps.trim()}' doit rendre ${JSON.stringify(attendu)} — reçu ${JSON.stringify(got)}`);
}

// ─── 2. LA CONCATÉNATION SILENCIEUSE EST FERMÉE ──────────────────────────────────────────────
// Le volet qui compte : la valeur fausse compilait. Un test d'acceptation ne l'aurait jamais vu.
{
  const r = clesDe('  range:0 127').range;
  ok(r !== '0127' && JSON.stringify(r) === '["0","127"]',
     `2. 'range:0 127' ne doit JAMAIS rendre une valeur collée — c'était « 0127 », une corruption `
     + `que la compilation ne signalait pas (reçu ${JSON.stringify(r)})`);
}

// ─── 3. LE BLOC ENTIER D'UN CONTRÔLE — la forme dont une librairie a besoin ──────────────────
{
  const k = clesDe('  bp3:_vel\n  args:value\n  range:0 127\n  default:64\n  scope:symbol group rule flow');
  ok(!k.erreur, `3. le bloc entier d'un contrôle doit compiler (${k.erreur})`);
  ok(k.bp3 === '_vel' && k.args === 'value' && k.default === '64'
     && JSON.stringify(k.range) === '["0","127"]'
     && JSON.stringify(k.scope) === '["symbol","group","rule","flow"]',
     `3. les cinq clés doivent arriver avec leurs types — reçu ${JSON.stringify(k)}`);
}

// ─── 4. LA LIGNE SUIVANTE N'EST PAS AVALÉE — le bloc reste borné par l'indentation ───────────
// Sans cette borne, une valeur qui court jusqu'au bout de sa ligne pourrait courir plus loin, et
// la règle écrite juste après deviendrait une clé, en silence.
{
  let r; try { r = compileToBPxAST(`${TETE}@def k\n  bp3:_k\n\nS -> C4 D4\n`); } catch (e) { r = { errors: [{ message: e.message }] }; }
  ok((r.errors ?? []).length === 0, `4. la règle qui suit le bloc doit rester une règle (${r.errors?.[0]?.message})`);
  const rhs = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [];
  ok(rhs.length === 2,
     `4. la règle doit garder ses DEUX termes — si la valeur avait débordé, elle en aurait avalé `
     + `(reçu ${rhs.length})`);
}

// ─── 5. INJECTION DANS LE JUGE — le découpage rejoué isolé ───────────────────────────────────
const couper = (jetons) => {
  const parts = []; let cur = '';
  for (const [v, espace] of jetons) { if (cur !== '' && espace) { parts.push(cur); cur = ''; } cur += v; }
  if (cur !== '') parts.push(cur);
  return parts;
};
ok(JSON.stringify(couper([['0', false], ['127', true]])) === '["0","127"]',
   '5. (mord) deux jetons séparés par une espace font DEUX parties');
ok(JSON.stringify(couper([['0', false], ['127', false]])) === '["0127"]',
   '5. (se tait) deux jetons COLLÉS font UNE partie — le collage réunit, c\'est le canon');
ok(JSON.stringify(couper([['_vel', false]])) === '["_vel"]',
   '5. (se tait) une partie seule reste une partie');

if (echecs.length) {
  console.error(`❌ clé de définition tronquée ou collée : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une clé de définition va au bout de sa ligne — ${passe} vérification(s) passée(s)`);
}
