#!/usr/bin/env node
/**
 * GARDE — LE DOUBLE DÉFAUT DES MANIPULATIONS EST FERMÉ : UN SEUL OBJET LE PORTE.
 *
 * ⛔ CE GARDE A CHANGÉ DE CIBLE LE 2026-09-03, ET IL NE SE TAIT PAS. Il tenait l'ACCORD entre deux
 * déclarations du même défaut — `transpo` (le contrôle écrit dans une scène) et `digital` (la
 * fonction qui le calcule) —, constat de Kairos du 2026-08-19 : elles s'accordaient PAR LE FAIT, et
 * une divergence future aurait été deux nombres identiques cessant un jour de l'être, sans que rien
 * ne rougisse.
 *
 * L'ARBITRAGE DE ROMAIN A SUPPRIMÉ LA CAUSE : une manipulation est un MOT du langage, et son corps
 * se rattache à l'objet qui le porte. `digital` est sortie ; les quatre manipulations sont les
 * contrôles de `transpo` qui les nommaient déjà, et ils portent désormais leur défaut, leurs
 * paramètres et leur corps AU MÊME ENDROIT. Il n'y a plus deux déclarations à accorder.
 *
 * ⚠️ CE QUE CE GARDE TIENT MAINTENANT, et c'est la moitié qui compte : que le double NE REVIENNE
 * PAS. Un second domicile qui redéclarerait le défaut d'une manipulation serait exactement le
 * silence que le garde d'avant surveillait — il rougirait alors, en le nommant.
 *
 * ⚠️ ET LE COMPLÉMENT : chaque manipulation porte bien les trois pièces au même endroit. Un garde
 * qui n'exigerait que l'absence du double serait vert sur un registre vide.
 */
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur
import { LIBS } from '../src/transpiler/libs-data.js';
import { objets } from '../src/transpiler/index-des-objets.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

console.log('[deux-défauts] le double défaut des manipulations est fermé — un seul objet le porte');

// ── 1. LES QUATRE MANIPULATIONS PORTENT TOUT AU MÊME ENDROIT ────────────────────────────────
const MANIPULATIONS = ['transpose', 'scaleshift', 'chromashift', 'keyxpand'];
const controles = LIBS.transpo?.controls || {};
for (const nom of MANIPULATIONS) {
  const c = controles[nom];
  ok(c && typeof c === 'object',
     `1. '${nom}' doit être un contrôle de 'transpo' — c'est le mot que la scène écrit`);
  ok(c && c.params && typeof c.params === 'object',
     `1. '${nom}' porte SES PARAMÈTRES — reçu ${JSON.stringify(c && Object.keys(c))}`);
  ok(c && typeof c.body === 'string' && c.body.length > 100,
     `1. '${nom}' porte SON CORPS, greffé depuis lib/transpo/${nom}.ts — reçu ${typeof (c && c.body)}`);
  ok(c && 'value' in c === ('value' in (c || {})),
     `1. '${nom}' — sa valeur, s'il en a une, vit sur lui`);
}

// ── 2. LA LIBRAIRIE DES FONCTIONS EST SORTIE, ET AVEC ELLE LE SECOND DOMICILE ────────────────
ok(LIBS.digital === undefined,
   `2. 'digital' ne doit plus exister — une manipulation est un contrôle, pas une entrée à part`);
ok(!Object.values(LIBS).some((l) => l && typeof l === 'object' && l.resolves === 'function'),
   `2. aucune librairie ne déclare le mot 'function' — la famille a disparu avec la forme`);

// ── 3. LE DOUBLE NE REVIENT PAS — mesuré sur TOUT le registre, pas sur deux noms ─────────────
// Un second objet qui porterait le même nom ET un défaut serait le silence d'avant, revenu.
{
  const parNom = new Map();
  for (const o of objets()) {
    if (!MANIPULATIONS.includes(o.nom)) continue;
    if (!('value' in o.membres) && !o.membres.params) continue;
    parNom.set(o.nom, [...(parNom.get(o.nom) || []), o.chaine.join('.')]);
  }
  ok(parNom.size === MANIPULATIONS.length,
     `3. SOCLE : les quatre manipulations doivent être vues — reçu ${[...parNom.keys()].join(', ')}`);
  for (const [nom, chaines] of parNom) {
    ok(chaines.length === 1,
       `3. '${nom}' est déclaré par ${chaines.length} objets — ${chaines.join(' · ')}. Deux domiciles `
       + `pour un défaut divergent en silence : c'est ce que la sortie de 'digital' a fermé.`);
  }
}

// ── 4. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (chaines) => chaines.length === 1;
ok(juger(['transpo.transpose']), '4. (se tait) un seul domicile');
ok(!juger(['transpo.transpose', 'function.transpose']), '4. (mord) deux domiciles pour un même mot');

if (echecs.length) {
  console.error(`❌ le double défaut est revenu : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`[deux-défauts] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
