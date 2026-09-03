#!/usr/bin/env node
/**
 * GARDE — la clé `implements` : une INTERFACE et sa RÉALISATION ne sont pas deux homonymes.
 *
 * LA DOCTRINE (Romain, 2026-08-15) : « MIDI a toutes ses primitives, et `expression` est un
 * sur-ensemble d'appel générique qui va appeler les primitives d'expression du runtime
 * sous-jacent quel qu'il soit. » Un mot déclaré des deux côtés a donc UNE entrée publique —
 * l'interface — et des réalisations qu'on vise par leur préfixe :
 *     !(volume:90)        l'interface, que le runtime actif réalise
 *     !(midi.volume:90)   la réalisation MIDI, visée directement
 *
 * CE QUE LA RÈGLE D'AMBIGUÏTÉ DEVIENT, ET CE QU'ELLE NE DEVIENT PAS. Deux déclarations d'un même
 * nom SANS `implements` restent une erreur, exactement comme avant — volet 1. Avec `implements`, la
 * forme nue résout PAR CONSTRUCTION vers l'interface : il n'y a plus deux candidats à départager,
 * il n'y en a qu'un — volet 2. C'est la différence entre lever une ambiguïté et arbitrer entre
 * deux homonymes, et un garde qui ne tiendrait que le second cas laisserait passer une règle de
 * priorité silencieuse.
 *
 * ⚠️ LE DESTINATAIRE EST LE POINT QUI COMPTE, et c'est le mode d'échec le plus discret : sans
 * reprise, `ctx.controls` garde la DERNIÈRE déclaration lue, donc la forme nue emporterait la
 * plage, le défaut et le destinataire de la RÉALISATION — un réglage générique partirait au
 * runtime MIDI même quand ce n'est pas lui qui sonne, sans une erreur. Volet 2c.
 *
 * ⛔ LE MÉCANISME SE PROUVE SUR DES FIXTURES FABRIQUÉES EN MÉMOIRE, jamais sur le disque : mes
 * librairies sont lues VIVANTES par mes consommateurs. Les volets 0 à 4 n'engagent donc aucun mot
 * du vocabulaire ; le volet 5 mesure à part la SEULE paire réellement déclarée, `volume`.
 *
 * INJECTION dans l'ACCUSÉ (le `implements` retiré, la cible faussée) et dans le JUGE.
 */
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import { createRequire } from 'node:module';
import { loadLibsFromDirectives, registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── LES FIXTURES — deux librairies qui déclarent le MÊME mot ────────────────────────────────
const CONTROLE = { args: ['value'], range: [0, 127], description: 'témoin du garde' };
const interfaceLib = (extra = {}) => ({
  name: 'zzface', resolvedBy: 'toutes les sorties',
  controls: { zzvolume: { ...CONTROLE, transportGroup: 'zzface', ...extra } },
});
// ⚠️ `implements` est un MOT RÉSERVÉ de JavaScript : il nomme la clé de la donnée, jamais une
// variable de ce fichier. Le paramètre porte donc le nom de ce qu'il désigne — la cible visée.
const implementationLib = (cible) => ({
  name: 'zzmidi', resolvedBy: 'runtime-ZZ',
  controls: {
    zzvolume: {
      ...CONTROLE, bp3: '_zzvolume', value: 100, transportGroup: 'zzmidi',
      ...(cible === null ? {} : { implements: cible }),
    },
  },
});
const DIRS = [{ name: 'zzface' }, { name: 'zzmidi' }];

/** Charge les deux fixtures et rend le contexte, ou l'erreur que le chargeur a jetée. */
const charger = (face, midi) => {
  clearRegistry();
  registerAll(LIBS);
  registerLib('zzface', face);
  registerLib('zzmidi', midi);
  try { return { ctx: loadLibsFromDirectives(DIRS) }; }
  catch (e) { return { erreur: e.message }; }
};
const restaurer = () => { clearRegistry(); registerAll(LIBS); };

// ── 0. SOCLE — les fixtures declarent bien DEUX fois le meme nom ────────────────────────────
{
  const { ctx } = charger(interfaceLib(), implementationLib(null));
  ok(!!ctx && !!ctx.controlsQualified['zzface.zzvolume'] && !!ctx.controlsQualified['zzmidi.zzvolume'],
     '0. SOCLE : les deux fixtures doivent être chargées et qualifiées — sinon les volets suivants '
     + "ne mesurent rien(un garde qui n'a rien examiné se croit vert)");
}

// ── 1. SANS `implements`, LA RÈGLE NE CHANGE PAS — deux homonymes restent ambigus ──────────────
{
  const { ctx } = charger(interfaceLib(), implementationLib(null));
  ok(ctx.ambiguousControls.has('zzvolume'),
     "1. deux déclarations SANS `implements` doivent rester AMBIGUËS — la règle de Romain sur "
     + "l'appel nu ne bouge pas, et c'est le complément qui empêche ce garde de décrire un langage "
     + 'plus permissif que le vrai');
}

// ── 2. AVEC `implements`, IL N'Y A PLUS QU'UNE ENTRÉE PUBLIQUE ─────────────────────────────────
{
  const { ctx } = charger(interfaceLib(), implementationLib('zzface.zzvolume'));
  ok(!ctx.ambiguousControls.has('zzvolume'),
     "2a. avec `implements`, le nom ne doit PLUS être ambigu — l'interface est l'unique entrée "
     + 'publique, il n\'y a pas deux candidats à départager');
  ok(ctx.controls.zzvolume === ctx.controlsQualified['zzface.zzvolume'],
     '2b. la forme NUE doit résoudre vers la déclaration de l\'INTERFACE, pas vers la dernière '
     + 'librairie lue');
  ok(ctx.controlResolvedBy.zzvolume === 'toutes les sorties',
     `2c. le destinataire de la forme nue doit être celui de l'INTERFACE — vu : `
     + `${ctx.controlResolvedBy.zzvolume}. Sinon un réglage générique part au runtime de la `
     + 'réalisation, en silence, même quand ce n\'est pas lui qui sonne');
  ok(ctx.controlQualifiedResolvedBy['zzmidi.zzvolume'] === 'runtime-ZZ',
     '2d. la forme PRÉFIXÉE de la réalisation doit garder SON destinataire — la viser directement '
     + 'est justement ce qu\'elle sert à faire');
  ok(ctx.implementations['zzface.zzvolume'] && ctx.implementations['zzface.zzvolume'].includes('zzmidi.zzvolume'),
     "2e. le lien interface → réalisations doit être porté par le contexte, lisible de l'aval");
  ok(ctx.implementedInterface['zzmidi.zzvolume'] === 'zzface.zzvolume',
     '2f. et le lien inverse aussi');
}

// ── 3. INJECTION DANS L'ACCUSÉ — un `implements` qui pointe dans le vide échoue ────────────────
{
  const { erreur } = charger(interfaceLib(), implementationLib('zzface.zzvolme'));
  ok(typeof erreur === 'string' && /zzface\.zzvolme/.test(erreur) && /nulle part/.test(erreur),
     `3a. (mord) une COQUILLE dans la cible doit être refusée en nommant la cible — reçu : ${erreur}`);
}
{
  const { erreur } = charger(interfaceLib(), implementationLib('zzmidi.zzvolume'));
  ok(typeof erreur === 'string' && /lui-même/.test(erreur),
     `3b. (mord) une déclaration qui se réalise ELLE-MÊME doit être refusée — reçu : ${erreur}`);
}
{
  const { erreur } = charger(interfaceLib(), implementationLib('zzface.zzabsent'));
  ok(typeof erreur === 'string' && /nulle part/.test(erreur),
     `3c. (mord) une cible absente d'une librairie qui EXISTE doit être refusée — reçu : ${erreur}`);
}

// ── 4. UNE INTERFACE QUI NE SERT QU'UNE FOIS RESTE UNE INTERFACE ─────────────────────────────
// Le complément du volet 2 : un mot déclaré dans UNE SEULE librairie n'est jamais ambigu, et la
// clé n'a pas à changer ça. Sans ce volet, une reprise trop large ferait résoudre n'importe quel
// mot vers autre chose que sa propre déclaration.
{
  const { ctx } = charger(interfaceLib(), { name: 'zzmidi', resolvedBy: 'runtime-ZZ', controls: {} });
  ok(!ctx.ambiguousControls.has('zzvolume') && ctx.controls.zzvolume === ctx.controlsQualified['zzface.zzvolume'],
     '4. un mot déclaré une SEULE fois résout vers sa propre déclaration, sans ambiguïté');
}

// ── 5. LA PREMIÈRE PAIRE RÉELLE — `volume` ──────────────────────────────────────────────────
// ⚠️ CE VOLET EXIGEAIT L'INVERSE JUSQU'AU 2026-08-15 : « aucune réalisation n'est déclarée
// aujourd'hui ». Il a fait son office — la première paire est entrée SCIEMMENT, en le faisant
// rougir, au lieu d'apparaître en aval. Romain a tranché le point qui bloquait (« les défauts sont
// dans la librairie midi-default ») ; le volet bascule et décrit maintenant la paire déclarée.
restaurer();
{
  const ctx = loadLibsFromDirectives([{ name: 'core' }]);
  ok(ctx.implementedInterface['midi.volume'] === 'expression.volume',
     `5a. 'midi.volume' doit réaliser 'expression.volume' — vu : ${ctx.implementedInterface['midi.volume']}`);
  // ⚠️ LA COMPARAISON PORTE SUR LE CONTENU, PAS SUR L'IDENTITÉ D'OBJET, et le distinguo a été payé :
  // la librairie des défauts reverse sa valeur en RECONSTRUISANT la déclaration (`{...def, default}`),
  // donc l'égalité de référence est fausse alors que la résolution est juste. Un garde qui compare
  // des adresses mémoire mesure le chemin, pas le résultat.
  ok(ctx.controls.volume
     && ctx.controls.volume.transportGroup === ctx.controlsQualified['expression.volume'].transportGroup
     && ctx.controls.volume.description === ctx.controlsQualified['expression.volume'].description,
     "5b. `volume` nu doit résoudre vers la déclaration de l'INTERFACE, dans les librairies RÉELLES "
     + "et pas seulement sur les fixtures — sinon un réglage générique part au runtime MIDI même "
     + `quand ce n'est pas lui qui sonne. Vu : ${JSON.stringify(ctx.controls.volume)}`);
  ok(ctx.controls.volume && ctx.controls.volume.bp3 === undefined,
     "5b. et il ne doit PAS porter la graphie native de la réalisation — la viser demande de la "
     + 'préfixer');
  ok(ctx.controlResolvedBy.volume === 'toutes les sorties',
     `5c. et son destinataire est celui de l'interface — vu : ${ctx.controlResolvedBy.volume}`);
  ok(ctx.controlQualifiedResolvedBy['midi.volume'] === 'runtime-MIDI',
     '5d. la forme préfixée garde le sien');
  // ⛔ L'INTERFACE NE PORTE PAS DE DÉFAUT, et la réalisation non plus le jour où `midi-default`
  // existera. Romain : « les défauts sont dans la librairie midi-default, ça sera modifié dans le
  // live par les contrôles de volume de l'UI ».
  ok(ctx.controlsQualified['expression.volume'].value === undefined,
     "5e. la DÉCLARATION de l'interface ne porte AUCUNE valeur par défaut — elle décrit le mot, "
     + '`midi_default` donne la valeur');
  // ⚠️ 90, PAS 100. La declaration portait 100 depuis toujours ; la mesure de runtime-MIDI sur les
  // sources du moteur dit 90. Deplacer la valeur dans la librairie des defauts a ete l occasion de
  // la confronter — une valeur recopiee de proche en proche ne se verifie jamais toute seule.
  ok(ctx.controls.volume && ctx.controls.volume.value === 90,
     "5e. et la valeur arrive quand même à la forme nue, reversée par la ligne de tête de l'environnement — "
     + `sinon l'aide de l'éditeur perd un champ qu'elle affichait. Vu : ${ctx.controls.volume?.value}`);
  ok(ctx.ambiguousControls.size === 0,
     `5f. et aucun nom n'est ambigu dans les librairies réelles — vus : ${[...ctx.ambiguousControls].join(', ')}`);
}

// ── 6. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (quals, implementedInterface) => {
  const faces = quals.filter((q) => !implementedInterface[q]);
  const reals = quals.filter((q) => implementedInterface[q]);
  return !(reals.length > 0 && faces.length === 1 && reals.every((q) => implementedInterface[q] === faces[0]));
};
ok(juger(['a.v', 'b.v'], {}), '6. (mord) deux déclarations nues restent ambiguës');
ok(!juger(['a.v', 'b.v'], { 'b.v': 'a.v' }), '6. (se tait) une réalisation vers l\'unique interface');
ok(juger(['a.v', 'b.v', 'c.v'], { 'c.v': 'a.v' }), '6. (mord) une réalisation ne couvre pas DEUX interfaces');
ok(!juger(['a.v', 'b.v', 'c.v'], { 'b.v': 'a.v', 'c.v': 'a.v' }), '6. (se tait) deux réalisations, une interface');
ok(juger(['a.v', 'b.v'], { 'a.v': 'z.v', 'b.v': 'z.v' }), '6. (mord) aucune interface en portée');

// ── 7. ⛔ LA SORTIE, PAS LE CHEMIN — le compilateur REFUSE-T-IL, ET NOMME-T-IL LES DEUX ? ─────
//
// ⛔ CE VOLET MANQUAIT, ET SON ABSENCE ÉTAIT INVISIBLE. Les six volets ci-dessus mesurent le
// CHARGEUR : ils vérifient que `ambiguousControls` est peuplé. Aucun n'appelait le compilateur.
// Le jour où le refus disparaîtrait du parseur — ou où son message cesserait de nommer les
// candidats — TOUT SERAIT RESTÉ VERT : la table serait toujours peuplée, et rien ne compilait une
// scène pour regarder ce qui sort. Un banc qui prouve la table ne prouve pas le branchement.
//
// ⚠️ ET LA DONNÉE RÉELLE NE PEUT PAS SERVIR DE TÉMOIN : `ambiguousControls` est VIDE aujourd'hui
// (volet 5f), donc ce chemin n'est jamais exercé par les librairies vivantes. Un mécanisme qui
// n'a aucun cas et un mécanisme mort ont exactement la même empreinte — on FABRIQUE le cas.
//
// Décision Romain, `2026-08-02-prefixe-de-librairie-optionnel-resolution-par-unicite.md` : « s'il
// est porté par deux, LA COMPILATION S'ARRÊTE et NOMME LES DEUX CANDIDATS ». Ce volet mesure les
// deux moitiés de cette phrase, à la sortie.
{
  clearRegistry();
  registerAll(LIBS);
  registerLib('zzface', interfaceLib());
  registerLib('zzmidi', implementationLib(null));   // AUCUN `implements` : deux vrais candidats
  const { compileToBPxAST } = require('../src/transpiler/index.js');
  const SOCLE = 'core\nalphabet.western\nzzface\nzzmidi\n';
  const compiler = (ecrit) => {
    try { return (compileToBPxAST(`${SOCLE}-----\nS -> C4(${ecrit})`).errors || []).map((x) => x.message); }
    catch (e) { return [`EXCEPTION ${e.message}`]; }
  };

  const nu = compiler('zzvolume:64');
  ok(nu.length >= 1,
    "7a. ⛔ le nom NU d'un contrôle porté par deux librairies doit ARRÊTER la compilation — "
    + `reçu : ${nu.length ? nu[0] : 'AUCUNE erreur, la décision du 2026-08-02 n\'est pas câblée'}`);
  const msg = nu[0] || '';
  ok(msg.includes('zzface') && msg.includes('zzmidi'),
    "7b. ⛔ et le refus doit NOMMER LES DEUX CANDIDATS — un message qui dit « ambigu » sans dire "
    + `ENTRE QUOI oblige l'auteur à deviner. Reçu : ${JSON.stringify(msg.slice(0, 140))}`);

  // ⛔ ET LE COMPLÉMENT : les deux formes préfixées PASSENT. Sans lui, un parseur qui refuserait
  // toute écriture de ce contrôle passerait 7a et 7b sans distinction.
  const parA = compiler('zzface.zzvolume:64');
  const parB = compiler('zzmidi.zzvolume:64');
  ok(parA.length === 0 && parB.length === 0,
    `7c. les DEUX formes préfixées doivent compiler — c'est la réécriture que le refus propose. `
    + `zzface : ${parA[0] || 'ok'} · zzmidi : ${parB[0] || 'ok'}`);

  // ⛔ ET AVEC `implements`, LA MÊME ÉCRITURE NUE PASSE : il n'y a plus deux candidats. C'est le
  // témoin qui distingue « le refus mord » de « le refus mord toujours ».
  clearRegistry();
  registerAll(LIBS);
  registerLib('zzface', interfaceLib());
  registerLib('zzmidi', implementationLib('zzface.zzvolume'));
  const avecInterface = compiler('zzvolume:64');
  ok(avecInterface.length === 0,
    `7d. TÉMOIN — avec \`implements\`, le nom nu résout et COMPILE : une interface n'est pas une `
    + `ambiguïté. Reçu : ${avecInterface[0] || 'ok'}`);
}

restaurer();

// Le compte des vérifications EXÉCUTÉES, hors ce bilan lui-même : un garde qui refuse d'avoir
// examiné zéro doit aussi refuser d'en avoir examiné douze parce qu'un bloc s'est tu.
const TOTAL_ATTENDU = 29;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ interface et réalisation : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une interface et sa réalisation ne sont pas des homonymes — ${passe} vérification(s) passée(s)`);
}
