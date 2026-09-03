/**
 * Frontière R4 — charge (params) sur un accord `!` (décision Romain + BPx 2026-06-23).
 *
 * 3 formes, 3 cibles distinctes :
 *   1. {C4!E4}(vel:90)        → contenance de BLOC : tout l'accord (sur le conteneur).
 *   2. C4!E4(vel:90)          → charge COLLÉE : E4 SEUL (dernier secondaire).
 *   3. C4(vel:80)!E4(vel:90)  → par NOTE : un override par note.
 *
 * Contrat AST figé : chaque note sonnante porte sa charge d'occurrence dans
 * payload.params (+ payload.occurrence:true), uniforme ; la contenance de bloc
 * reste sur le conteneur englobant (payload.containment:true, params).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}

function rule(src) {
  const r = compileToBPxAST(src);
  if (r.errors && r.errors.length) {
    console.log('  PARSE ERROR:', JSON.stringify(r.errors));
    return null;
  }
  return r.ast.subgrammars[0].rules[0];
}

// ⚠️ LE SOCLE EST OBLIGATOIRE DEPUIS LE 2026-08-08 (Romain : « invoquer commande,
// systematiquement »). Ces scenes emploient (vel:…) : elles doivent donc invoquer ce qui le
// declare. Sans core elles etaient acceptees parce que TOUTE librairie du depot faisait
// vocabulaire — l invocation ne commandait rien.
// ⚠️ DEUX CHOSES ONT CHANGÉ AVEC LA SORTIE DE `gate`, le 2026-08-18, et une seule se voit.
// La graphie d'abord : un terminal se déclare `<nom>:<canal>` directement. La POSITION ensuite —
// ces deux lignes vivaient APRÈS le délimiteur, où `gate` les rendait lisibles ; depuis que c'est
// la position qui qualifie, elles déclarent AVANT. Et le canal doit en être un : `sc` nommait un
// interpréteur, pas une sortie.
const DECLS = 'core\nC4:midi\nE4:midi\n-----\n';

// ── Forme 1 : contenance de bloc ────────────────────────────────────────
{
  const r = rule(DECLS + 'Accord -> {C4!E4}(vel:90)');
  const poly = r.rhs[0];
  assert('F1 RHS = Polymetric (bloc)', poly?.type === 'Polymetric', `got ${poly?.type}`);
  const grp = poly?.voices?.[0]?.[0];
  assert('F1 bloc contient un SimultaneousGroup', grp?.type === 'SimultaneousGroup');
  // La charge est sur le CONTENEUR — et le conteneur, ici, est le BLOC : le sac est COLLÉ à
  // l'accolade fermante.
  //
  // ⚠️ CE TEST LISAIT `r.settings`, LA RÈGLE, ET IL AVAIT RAISON SUR L'ÉTAT D'ALORS. Sa scène
  // n'invoque aucune librairie de contrôles(`gate` seul) : `vel` n'était donc pas reconnu comme
  // un réglage, le sac collé au `}` n'était pas absorbé par le bloc, et il retombait sur la règle.
  // Le test mesurait la voie SANS contrôles — celle que presque aucune scène réelle n'emprunte.
  // Depuis que `core` amène les contrôles (2026-08-08), il n'y a plus qu'une voie, et c'est la
  // règle du 2026-08-07 qui s'applique : COLLÉ règle le groupe, ESPACÉ règle la règle.
  const rq = poly?.settings;
  assert('F1 contenance sur le BLOC(sac collé à })', rq?.payload?.containment === true,
    JSON.stringify(rq?.payload));
  assert('F1 params.vel=90 sur le BLOC', rq?.payload?.params?.vel === 90,
    JSON.stringify(rq?.payload?.params));
  // ⚠️ TÉMOIN DE L'AUTRE MOITIÉ — le même sac SÉPARÉ par une espace règle la RÈGLE, pas le bloc.
  // Sans lui, une lecture qui poserait TOUT sur le bloc passerait les deux lignes ci-dessus.
  {
    const r2 = rule(DECLS + 'Accord -> {C4!E4} (vel:90)');
    assert('F1-témoin : sac ESPACÉ → la règle', r2?.settings?.payload?.params?.vel === 90,
      JSON.stringify(r2?.settings?.payload));
    assert('F1-témoin : sac ESPACÉ → PAS le bloc', !r2?.rhs?.[0]?.settings,
      JSON.stringify(r2?.rhs?.[0]?.settings));
  }
  // Les notes de l'accord ne portent PAS d'override d'occurrence.
  assert('F1 C4 sans charge', !grp?.primary?.payload?.params,
    JSON.stringify(grp?.primary?.payload));
  assert('F1 E4 sans charge', !grp?.secondaries?.[0]?.payload?.params,
    JSON.stringify(grp?.secondaries?.[0]?.payload));
}

// ── Forme 2 : charge collée → E4 seul ───────────────────────────────────
{
  const r = rule(DECLS + 'Accord -> C4!E4(vel:90)');
  const grp = r.rhs[0];
  assert('F2 RHS = SimultaneousGroup', grp?.type === 'SimultaneousGroup', `got ${grp?.type}`);
  assert('F2 C4 (primaire) SANS charge', !grp?.primary?.payload?.params,
    JSON.stringify(grp?.primary?.payload));
  const e4 = grp?.secondaries?.[0];
  assert('F2 E4 (secondaire) params.vel=90', e4?.payload?.params?.vel === 90,
    JSON.stringify(e4?.payload));
  assert('F2 E4 occurrence:true', e4?.payload?.occurrence === true,
    JSON.stringify(e4?.payload));
}

// ── Forme 3 : par note ──────────────────────────────────────────────────
{
  const r = rule(DECLS + 'Accord -> C4(vel:80)!E4(vel:90)');
  const grp = r.rhs[0];
  assert('F3 RHS = SimultaneousGroup', grp?.type === 'SimultaneousGroup', `got ${grp?.type}`);
  assert('F3 C4 params.vel=80', grp?.primary?.payload?.params?.vel === 80,
    JSON.stringify(grp?.primary?.payload));
  assert('F3 C4 occurrence:true', grp?.primary?.payload?.occurrence === true);
  const e4 = grp?.secondaries?.[0];
  assert('F3 E4 params.vel=90', e4?.payload?.params?.vel === 90,
    JSON.stringify(e4?.payload));
  assert('F3 E4 occurrence:true', e4?.payload?.occurrence === true);
}

// ── Repliement aussi hors accord : note simple SymbolCall ───────────────
{
  const r = rule('core\nC4:midi\n-----\nAccord -> C4(vel:80)');
  const n = r.rhs[0];
  assert('note simple params.vel=80 (repliée)', n?.payload?.params?.vel === 80,
    JSON.stringify(n?.payload));
  assert('note simple occurrence:true', n?.payload?.occurrence === true);
  // Le sac d'origine est conservé à côté de la charge repliée — mais dans le champ des RÉGLAGES.
  // ⚠️ Ce test exigeait `args`, « la voie BP3 héritée ». Cette voie n'existe plus pour un réglage :
  // depuis que les contrôles sont intrinsèques, `C4(vel:80)` est une NOTE portant un RÉGLAGE, plus
  // jamais un APPEL portant un ARGUMENT. C'est le champ qui change, pas la donnée.
  assert('le sac d\'origine est conservé', Array.isArray(n?.suffixQualifiers) && n.suffixQualifiers.length === 1,
    JSON.stringify(n?.suffixQualifiers));
  assert('et il n\'y a plus d\'appel', n?.args === undefined, JSON.stringify(n?.args));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
