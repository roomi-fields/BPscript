// Test — compileToBPxAST : voie AST BPx PROPRE, SANS ancien format BP3 et SANS table parallèle.
// Directive Romain 2026-06-17 (confirmée BPx + Kanopi) : SOURCE UNIQUE = l'arbre. Tout vit sur
// les nœuds / directives ; le résultat ne renvoie que { ast, errors, warnings }.
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

function backtickNodes(ast) {
  const out = [];
  const walk = (els) => { for (const e of els || []) { if (/Backtick/.test(e.type || '')) out.push(e); if (e.voices) e.voices.forEach(walk); if (e.elements) walk(e.elements); } };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) walk(r.rhs);
  return out;
}

// 1. Résultat = ARBRE SEUL, aucune table parallèle, aucun artefact BP3
{
  const r = compileToBPxAST('core\n-----\nS -> C4 D4');
  check(!!r.ast, 'ast présent');
  check(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['ast', 'errors', 'warnings']),
    'résultat = { ast, errors, warnings } SEULEMENT, obtenu ' + JSON.stringify(Object.keys(r)));
  check(!('grammar' in r) && !('backticks' in r) && !('flagStates' in r) && !('libraries' in r),
    'aucune table parallèle ni grammaire BP3');
  check(r.ast.subgrammars[0].rules[0].rhs[0].payload?.nature === 'sounding', 'payload par token présent');
}

// 2. Backticks : tout SUR LE NŒUD (_btName + code + interp), pas de table
{
  const r = compileToBPxAST('core\n-----\nS -> C4 `sc: synth(1)` `note("c2")`');
  const bts = backtickNodes(r.ast);
  check(bts.length === 2, 'deux nœuds backtick, obtenu ' + bts.length);
  check(bts.every((n) => n._btName), 'tous _btName posés sur les nœuds');
  check(new Set(bts.map((n) => n._btName)).size === 2, '_btName uniques');
  const sc = bts.find((n) => n.tag === 'sc');
  check(sc && sc.payload?.interp === 'sc' && sc.payload?.nature === 'code' && sc.code === 'synth(1)',
    'backtick tagué : payload.interp + nature:code, code sur le nœud : ' + JSON.stringify(sc));
}

// 3. Interp 'auto' résolu DANS LE PAYLOAD depuis l'eval de l'acteur (tête de règle = acteur)
{
  // ⚠️ LA SOURCE DE L'HÉRITAGE A CHANGÉ LE 2026-07-28 : le langage venait du nom de la TÊTE DE
  // RÈGLE, ce qui obligeait à nommer une règle comme un acteur — l'amalgame refusé depuis. Il
  // vient désormais de l'acteur qui QUALIFIE le bloc par le point, là où il qualifie déjà une note.
  const r = compileToBPxAST('actor stru\n  eval.strudel\n-----\nS -> voix\nvoix -> stru.`note("c2")`');
  const bt = backtickNodes(r.ast)[0];
  check(bt && bt.payload?.interp === 'strudel', "interp 'auto' → 'strudel' (eval de l'acteur qui qualifie) : " + JSON.stringify(bt && bt.payload));
  check(bt && bt.actor === 'stru', "et le bloc porte l'IDENTITÉ de la voix, que le tag seul ne donne pas : " + JSON.stringify(bt && bt.actor));
}

// 4. flagStates LU depuis `var <nom> flag: ...` (ex-`flag`, tombée le 2026-08-05 — `flag` n'est
// plus une directive de tête de scène, EBNF.md:29-33 : quatre mots déclaratifs seulement).
{
  // `core` AVANT le drapeau : `flag` est un objet de `types`, que `core` apporte par sa chaîne, et
  // le registre se remplit à la lecture — aucun socle implicite (Romain, 2026-09-02).
  const r = compileToBPxAST('core\nflag section:1\n-----\nS -> C4');
  const vd = (r.ast.vars || []).find((v) => v.names?.[0] === 'section' && v.varType?.kind === 'flag');
  check(!!vd, "directive var section flag: présente dans l'arbre");
  // ⛔ LES ETATS NOMMES SONT SORTIS LE 2026-08-22 (Romain). Ce qui se lit depuis la directive est
  // desormais la VALEUR INITIALE, et la liste d etats reste VIDE — la verifier vide est le complement
  // qui empeche qu une valeur initiale en fabrique un.
  check(vd?.varType?.initiale === 1,
    'valeur initiale lisible depuis la directive : ' + JSON.stringify(vd?.varType));
  check(JSON.stringify(vd?.varType?.states) === '[]',
    'et AUCUN etat n est fabrique : ' + JSON.stringify(vd?.varType?.states));
}

// 5. LA BANQUE D'ÉCHANTILLONS EST LUE SUR L'ACTEUR, PAS SUR UNE DIRECTIVE DE SCÈNE.
// ⚠️ CE CAS A CHANGÉ DE SUJET le 2026-08-06 : `library.<moteur> "<banque>"` est SUPPRIMÉE
// (décision Romain — « bank est intrinsèque à strudel, c'est pas générique »). La banque est
// devenue un paramètre propre de l'entrée `strudel` de `lib/eval.json`, et se pose sur l'acteur.
// Le test ne disparaît pas avec la directive : c'est la même question — la banque est-elle
// LISIBLE DANS L'ARBRE, sans table annexe ? — posée au nouvel endroit.
{
  const r = compileToBPxAST('core\nactor drums  eval.strudel(bank:gm)\n-----\nS -> drums_r\ndrums_r -> drums.`s("bd")`');
  const a = (r.ast.actors || []).find((x) => x.name === 'drums');
  const bank = a?.properties?.entityParams?.eval?.bank;
  check(bank === 'gm', 'banque lisible sur l acteur : ' + JSON.stringify(a?.properties?.entityParams));
}

// 6. acteurs : references[] (ActorReference)
// ⚠️ CE CAS PORTAIT AUSSI UNE ASSERTION SUR `ast.scenes`, RETIRÉE le 2026-07-29 : `scene` est
// SUPPRIMÉE du langage (décision Romain, « on n'a ni la maturité ni le besoin de déclarer des
// sous-scènes »). Le témoin est devenu un cas REFUSÉ, plus bas — le garder aurait fait rougir la
// pierre tombale qu'il aurait dû protéger.
{
  const r = compileToBPxAST('actor tabla\n  alphabet.tabla\n  out.midi(ch:10)\n-----\nS -> tabla.dha');
  const tr = r.ast.actors[0].references?.find((x) => x.category === 'transport');
  check(tr?.type === 'ActorReference' && tr?.name === 'midi' && tr?.params?.ch === 10,
    'ActorReference transport sur le nœud acteur : ' + JSON.stringify(tr));
}

// 6bis. `scene` est REFUSÉE, et elle l'est COMME UN MOT INVENTÉ.
// ⚠️ CE VOLET EXIGEAIT UN REFUS NOMMÉ, ET C'ÉTAIT LE BON TEST JUSQU'AU 2026-08-19. Ce jour-là le
// LECTEUR de `scene` a été retiré — la décision de Romain du 2026-07-29 (« on le retire du reste »)
// avait treize semaines et n'avait jamais été appliquée : la pierre tombale était écrite en
// commentaire et la graphie compilait toujours, posant son nœud. Depuis le 2026-08-15, un mot sorti
// tombe dans le refus d'un mot inventé ; c'est donc cette identité-là qui se garde.
// ⛔ ET LA SCÈNE D'ESSAI A CHANGÉ DE PLACE : elle écrivait la ligne APRÈS le délimiteur, où le
// refus qui mord est celui de la POSITION. Une déclaration se mesure là où elle déclare.
{
  const scene = (mot) => `core\nalphabet.western\n${mot} verse "verse.bps"\n-----\nS -> C4`;
  const msgs = (compileToBPxAST(scene('scene')).errors || []).map((e) => e.message ?? String(e));
  const invente = (compileToBPxAST(scene('zorglubinvente')).errors || []).map((e) => e.message ?? String(e));
  check(msgs.length > 0, 'scene doit être REFUSÉE : ' + JSON.stringify(msgs));
  const nu = (l) => l.join(' | ').replace(/at line \d+:\d+/g, '').trim();
  check(nu(msgs) === nu(invente),
    'scene doit refuser comme un mot INVENTÉ, mot pour mot : ' + JSON.stringify(msgs));
  // ET LE CHAMP RESTE, VIDE — c'est la moitié que Romain garde pour BPx, qui le lit.
  const ok = compileToBPxAST('core\nalphabet.western\n-----\nS -> C4');
  check(Array.isArray(ok.ast?.scenes) && ok.ast.scenes.length === 0,
    "`ast.scenes` doit rester un tableau VIDE — le lecteur sort, le champ reste : "
    + JSON.stringify(ok.ast?.scenes));
}

// 7. États de drapeau nommés RÉSOLUS dans l'AST (bug BPx G2) : la garde porte l'ENTIER, pas le nom
// (`var <nom> flag: ...`, ex-`flag` tombée le 2026-08-05)
{
  const r = compileToBPxAST('types\nflag section:1\n-----\n[section==1] S -> A\n[section==2] S -> Two\n-----\nA -> C4\nTwo -> C4 C4');
  const guards = [];
  for (const sg of r.ast.subgrammars) for (const rule of sg.rules) {
    const gg = Array.isArray(rule.guard) ? rule.guard : (rule.guard ? [rule.guard] : []);
    for (const g of gg) guards.push(g);
  }
  check(guards.some((g) => g.flag === 'section' && g.value === 1), 'garde [section==1] portée telle quelle dans l\'AST : ' + JSON.stringify(guards.map((g) => g.value)));
  check(guards.some((g) => g.flag === 'section' && g.value === 2), 'garde [section==2] portée telle quelle dans l\'AST');
  check(!guards.some((g) => typeof g.value === 'string'), 'aucun nom d\'état non résolu (que des entiers)');
  // ⛔ UN AUTRE DRAPEAU RESTE UNE CHAÎNE — c'est la référence croisée, fidèle BP3. Mais il doit
  // être DÉCLARÉ : ce volet éprouvait 'other', qui n'est ni un état de 'section' ni un drapeau,
  // donc un nom qui ne désigne RIEN. Il certifiait le trou que la décision du 2026-08-20 ferme.
  const r2 = compileToBPxAST('types\nflag section:1\nflag autre:9\n-----\n[section==autre] S -> A\n-----\nA -> C4');
  check(r2.ast.subgrammars[0].rules[0].guard[0].value === 'autre', 'le nom d un AUTRE DRAPEAU déclaré reste une chaîne (réf croisée)');
  // ET SON COMPLÉMENT : un nom qui ne désigne rien est REFUSÉ — l'incomplétude se refuse à l'usage.
  const r3 = compileToBPxAST('types\nflag section:1\n-----\n[section==other] S -> A\n-----\nA -> C4');
  check((r3.errors || []).length > 0, 'un nom qui n est ni un état ni un drapeau est REFUSÉ');
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
