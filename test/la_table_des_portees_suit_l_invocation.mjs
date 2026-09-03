#!/usr/bin/env node
/**
 * GARDE — LA TABLE DES PORTÉES PERMISES SUIT L'INVOCATION, ET UNE HOMONYMIE ENTRE LIBRAIRIES
 * INVOQUÉES SE REFUSE À L'USAGE.
 *
 * Décision de Romain, 2026-09-02/03 : la table qui dit où un réglage a le droit de s'écrire « doit
 * dépendre des librairies invoquées » ; deux objets peuvent porter le même nom, l'ambiguïté se refuse
 * et l'utilisateur préfixe — comme un terminal par son acteur. Elle lisait cinq librairies par leur
 * nom, quelle que soit la scène. Ce garde tient :
 *   1. un réglage d'une librairie invoquée est jugé à sa place (le refus témoin `scaleshift` en tête) ;
 *   2. une interface et ses réalisations sont UN mot : `volume` (expression, réalisé par midi et audio)
 *      s'écrit nu sous `core`, à la portée de l'interface ;
 *   3. deux librairies invoquées qui déclarent le même réglage sans lien de réalisation → REFUS nu qui
 *      nomme les deux formes préfixées — fabriqué dans le registre, jamais observé — et la forme
 *      préfixée est jugée à la place que SA librairie déclare ;
 *   4. une seule des deux invoquée → le réglage passe ;
 *   5. la table se mémorise par ENSEMBLE de librairies invoquées, et un registre qui bouge la périme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerLib, leRegistre } from '../src/transpiler/libs.js';
import { chargerPorteesPermises } from '../src/transpiler/resolution.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compiler = (src) => { const r = compileToBPxAST(src, {}); return { ok: !!r.ast && !(r.errors || []).length, msgs: (r.errors || []).map((e) => e.message) }; };

// ── 1. un réglage invoqué est jugé à sa place ───────────────────────────────────────────────────
{
  const r = compiler('core\nscaleshift\n-----\nS -> C4\n');
  ok(!r.ok && r.msgs.some((m) => /cannot be written at the top of a scene/.test(m)),
     `1. 'scaleshift' en tête de scène est refusé à sa place — reçu ${JSON.stringify(r.msgs)}`);
  const ok1 = compiler('core\n-----\nS -> C4(scaleshift:2)\n');
  ok(ok1.ok, `1. 'scaleshift' sur un élément passe — reçu ${JSON.stringify(ok1.msgs)}`);
}

// ── 2. une interface et ses réalisations sont un seul mot ───────────────────────────────────────
{
  const r = compiler('core\n-----\nS -> C4(volume:90)\n');
  ok(r.ok, `2. 'volume' (expression, réalisé par midi et audio) s'écrit nu sous core — reçu ${JSON.stringify(r.msgs)}`);
  const t = chargerPorteesPermises(compileToBPxAST('core\n-----\nS -> C4\n', {}).ast);
  ok(Array.isArray(t.get('volume')),
     `2. la table rend UNE portée pour 'volume' nu — reçu ${JSON.stringify(t.get('volume'))}`);
}

// ── 3 et 4. l'homonymie FABRIQUÉE : deux librairies déclarent 'zzduo' avec des portées différentes ─
{
  const registre = leRegistre();
  const gabarit = (scope) => ({ resolves: null, resolvedBy: 'BPx', controls: { zzduo: { args: ['value'], description: 'témoin', scope } } });
  registerLib('zzlibA', { ...gabarit(['symbol', 'rule']), resolves: 'zzlibA' });
  registerLib('zzlibB', { ...gabarit(['scene']), resolves: 'zzlibB' });
  try {
    const deux = compiler('core\nzzlibA\nzzlibB\n-----\nS -> C4(zzduo:1)\n');
    ok(!deux.ok && deux.msgs.some((m) => /zzduo.*is declared by 2 libraries.*'zzlibA\.zzduo:…'.*'zzlibB\.zzduo:…'/.test(m)),
       `3. 'zzduo' déclaré par deux librairies invoquées est REFUSÉ nu, en nommant les deux formes préfixées — reçu ${JSON.stringify(deux.msgs)}`);
    const prefixe = compiler('core\nzzlibA\nzzlibB\n-----\nS -> C4(zzlibA.zzduo:1)\n');
    ok(prefixe.ok, `3. préfixé, 'zzlibA.zzduo' passe à la place que zzlibA déclare — reçu ${JSON.stringify(prefixe.msgs)}`);
    const horsPlace = compiler('core\nzzlibA\nzzlibB\n-----\nS -> C4(zzlibB.zzduo:1)\n');
    ok(!horsPlace.ok && horsPlace.msgs.some((m) => /zzduo.*cannot be written/.test(m)),
       `3. préfixé, 'zzlibB.zzduo' est jugé à la place que zzlibB déclare(scène seule) — reçu ${JSON.stringify(horsPlace.msgs)}`);
    const une = compiler('core\nzzlibA\n-----\nS -> C4(zzduo:1)\n');
    ok(une.ok, `4. une seule des deux invoquée : 'zzduo' passe — reçu ${JSON.stringify(une.msgs)}`);
    const t = chargerPorteesPermises(compileToBPxAST('core\nzzlibA\nzzlibB\n-----\nS -> C4\n', {}).ast);
    ok(t.get('zzduo') === undefined && t.has('zzduo') && JSON.stringify(t.get('zzduo', 'zzlibB')) === '["scene"]',
       `3. la table ne rend aucune portée nue pour 'zzduo', et celle de zzlibB préfixé — reçu ${JSON.stringify([t.get('zzduo'), t.get('zzduo', 'zzlibB')])}`);
  } finally {
    delete registre.zzlibA; delete registre.zzlibB;
    registerLib('zzlibA', undefined); registerLib('zzlibB', undefined);
    delete registre.zzlibA; delete registre.zzlibB;
  }
}

// ── 5. la mémoire suit l'ensemble invoqué et le registre ────────────────────────────────────────
{
  const a = chargerPorteesPermises(compileToBPxAST('core\n-----\nS -> C4\n', {}).ast);
  const b = chargerPorteesPermises(compileToBPxAST('core\n-----\nS -> D4\n', {}).ast);
  ok(a === b, '5. deux scènes qui invoquent la même chose partagent la même table');
  const c = chargerPorteesPermises(compileToBPxAST('alphabet.western\n-----\nS -> C4\n', {}).ast);
  ok(c !== a && c.get('scaleshift') === undefined, `5. une scène qui n'invoque pas transpo n'a pas 'scaleshift' dans sa table — reçu ${JSON.stringify(c.get('scaleshift'))}`);
}

ok(passe >= 8, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[portées par invocation] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[portées par invocation] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
