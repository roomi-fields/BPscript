#!/usr/bin/env node
// @isole — il ECRIT sur le disque : dans un processus partage il contaminerait ses voisins.
/**
 * GARDE — L'ÉTAGE QUI RÉSOUT EXISTE, ET LA VOIE DE COMPILATION LE TRAVERSE.
 *
 * Décision de Romain, 2026-08-24, `le-compilateur-a-quatre-etages-et-un-seul-canal-de-refus` : le
 * troisième étage — résoudre et vérifier — était **sans domicile, éclaté sur cinq modules**. Il en a
 * un depuis le 2026-08-25 : `src/transpiler/resolution.js`.
 *
 * ⛔ CE QUE CE GARDE EXISTE POUR REFUSER, ET C'EST LE DÉFAUT QUE MA CHARTE NOMME : *« un banc qui
 * appelle ma propre porte prouve la porte, jamais le branchement — abonné des deux côtés et branché
 * nulle part reste vert de bout en bout. »* Un banc qui importerait `resoudre` et l'appellerait
 * lui-même serait vert que `compileToBPxAST` passe par cet étage OU NON. Ce garde compile une scène
 * par la **voie unique** et lit le témoin que seul un passage réel peut avoir posé.
 *
 * ⛔ ET IL COMPTE CE QU'IL A EXAMINÉ. *« Un catalogue vide et un catalogue mort ont la même
 * empreinte. »* Un étage traversé qui rendrait `examines: 0` est indiscernable d'un étage jamais
 * atteint : le compte est ce qui sépare les deux, et zéro est refusé.
 *
 * ⛔ ASSIETTE ASSERTÉE — LE PARSEUR SE DÉSABONNE DU CHARGEUR. La même décision : *« le parseur
 * n'importe rien du chargeur de librairies. Le compte de ces imports est une assiette assertée : il
 * ne peut que DESCENDRE, et zéro est la cible. »* Douze au 2026-08-25. Ce garde rougit à la HAUSSE ;
 * une baisse est le but, et elle demande une mise à jour explicite de la référence — sans quoi la
 * cible s'atteindrait sans que personne ne l'ait vue.
 *
 * ⚠️ ET LES DEUX MOITIÉS SE PROUVENT PAR INJECTION, sur la graphie que le code écrit : chaque juge
 * est une fonction pure, on lui donne le cas fautif, et on exige qu'il rougisse.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { dernierPassage, resoudre } from '../src/transpiler/resolution.js';

const RACINE = new URL('..', import.meta.url).pathname;
const REFERENCE = `${RACINE}test/assiette-du-parseur.json`;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── LES DEUX JUGES, PURS — ce qui les rend injectables ───────────────────────────────────────
/** L'étage a-t-il tourné ? `null` = jamais atteint · 0 = atteint et aveugle. Les deux sont refusés. */
const aTourne = (compte) => typeof compte === 'number' && compte > 0;
/** L'assiette du parseur : une hausse est refusée, une baisse s'annonce. */
const assietteTenue = (vu, reference) => vu <= reference;

// ── A. LE BRANCHEMENT — la voie unique passe par l'étage ─────────────────────────────────────
{
  const avant = dernierPassage();
  const r = compileToBPxAST('core\nalphabet.western\n-----\nS -> C4\n', {});
  ok(!(r.errors || []).length,
     `A. SOCLE : la scène témoin doit compiler, sinon le passage mesuré n'est pas celui d'une `
     + `compilation réussie. Reçu : ${(r.errors || [])[0]?.message?.slice(0, 90)}`);
  const apres = dernierPassage();
  ok(aTourne(apres),
     `A. ⛔ L'ÉTAGE N'EST PAS TRAVERSÉ par la voie unique — témoin ${JSON.stringify(apres)}. `
     + `Le fichier peut exister et n'être branché nulle part : c'est exactement l'état que ce garde `
     + `refuse.`);
  ok(apres !== avant || avant === null || apres > 0,
     `A. le témoin n'a pas bougé entre deux compilations — il ne mesure pas ce passage-ci.`);

  // ⛔ LE TÉMOIN QUI DISCRIMINE EST UN ÉCART, JAMAIS UN SEUIL. Ma première écriture exigeait
  // « plus de dix nœuds » sur cette scène-ci : un nombre DEVINÉ, qui a rougi sur un parcours
  // correct — la scène minimale en porte huit. Ajuster dix en huit aurait été régler l'assertion
  // sur ce qui sort. Ce qui prouve la descente est qu'une scène PLUS GROSSE rende PLUS de nœuds,
  // et cette comparaison ne suppose aucun chiffre.
  const grosse = `core\nalphabet.western\n-----\nS -> ${Array.from({ length: 10 }, (_, i) => `R${i}`).join(' ')}\n`
    + Array.from({ length: 10 }, (_, i) => `R${i} -> C4 D4 E4`).join('\n') + '\n';
  const r2 = compileToBPxAST(grosse, {});
  ok(!(r2.errors || []).length,
     `A. SOCLE : la scène large doit compiler — ${(r2.errors || [])[0]?.message?.slice(0, 80)}`);
  ok(dernierPassage() > apres,
     `A. ⛔ LE PARCOURS NE DESCEND PAS : une scène de dix règles rend ${dernierPassage()} nœud(s), `
     + `la scène minimale ${apres}. Un parcours qui s'arrête au premier étage rendrait un compte non `
     + `nul et ne verrait rien du fond d'un sac.`);
}

// ── B. L'ÉTAGE REFUSE D'AVOIR EXAMINÉ ZÉRO, et son parcours descend vraiment ─────────────────
{
  const vide = resoudre(null, {});
  ok(vide.examines === 0 && Array.isArray(vide.diagnostics),
     `B. un arbre nul doit rendre un compte de zéro et un canal vide — reçu ${JSON.stringify(vide)}`);
  const plat = resoudre({ type: 'X' }, {});
  const profond = resoudre({ type: 'X', a: { type: 'Y', b: [{ type: 'Z' }] } }, {});
  ok(plat.examines === 1,
     `B. un nœud seul doit compter 1 — reçu ${plat.examines}`);
  ok(profond.examines === 3,
     `B. ⛔ LE PARCOURS NE DESCEND PAS : trois nœuds imbriqués, dont un dans un TABLEAU, doivent `
     + `compter 3 — reçu ${profond.examines}. Un parcours qui s'arrête au premier étage rendrait un `
     + `compte non nul et ne verrait rien du fond d'un sac.`);
  const cycle = { type: 'X' }; cycle.moi = cycle;
  ok(resoudre(cycle, {}).examines === 1,
     `B. un cycle doit être traversé une fois, pas boucler.`);
}

// ── C. L'ASSIETTE DU PARSEUR — le compte d'imports depuis le chargeur ────────────────────────
{
  const source = readFileSync(`${RACINE}src/transpiler/parser.js`, 'utf8');
  // La ligne d'import du chargeur, telle que le fichier l'écrit — jamais une liste tenue ici.
  const m = source.match(/^import\s*\{([^}]*)\}\s*from\s*'\.\/libs\.js';\s*$/m);
  const vu = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean).length : 0;
  ok(m !== null,
     `C. SOCLE : la ligne d'import de './libs.js' est introuvable dans parser.js. Zéro import serait `
     + `la cible — mais un socle muet ne prouve pas qu'on y est, il prouve que le juge a changé de `
     + `sujet. Si l'import a vraiment disparu, ce socle se retire dans le même geste.`);
  const reference = JSON.parse(readFileSync(REFERENCE, 'utf8')).importsDuChargeur;
  if (process.argv.includes('--maj')) {
    writeFileSync(REFERENCE, `${JSON.stringify({ importsDuChargeur: vu }, null, 1)}\n`);
    console.log(`[assiette] référence mise à ${vu} import(s).`);
  }
  ok(assietteTenue(vu, reference),
     `C. ⛔ LE PARSEUR S'ABONNE DAVANTAGE AU CHARGEUR — ${vu} import(s), ${reference} en référence. `
     + `Un nom inconnu n'est pas une faute de forme : ce qui a besoin du vocabulaire vit à l'étage `
     + `qui résout. Cette assiette ne peut que descendre.`);
  if (vu < reference) {
    console.log(`[assiette] ⚠️ ${reference - vu} import(s) de moins — c'est le but. Figer : `
      + `node test/l_etage_qui_resout_est_branche.mjs --maj`);
  }
}

// ── D. LES DEUX JUGES MORDENT — la faute leur est donnée, ils doivent rougir ─────────────────
{
  ok(!aTourne(null), `D. le juge du branchement accepte « jamais atteint » — il ne mordrait jamais.`);
  ok(!aTourne(0), `D. le juge du branchement accepte un étage qui a examiné ZÉRO. Un étage traversé `
                + `et aveugle a la même empreinte qu'un étage jamais atteint.`);
  ok(aTourne(1), `D. le juge du branchement refuse un passage RÉEL — il refuserait la voie correcte.`);
  ok(!assietteTenue(13, 12), `D. le juge de l'assiette accepte une HAUSSE — il ne mordrait jamais.`);
  ok(assietteTenue(12, 12), `D. le juge de l'assiette refuse l'égalité — il rougirait sans cause.`);
  ok(assietteTenue(0, 12), `D. le juge de l'assiette refuse la CIBLE — zéro est le but, pas la faute.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 15, `SOCLE : ${passe} vérification(s) seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ l'étage qui résout : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${passe} vérification(s) passée(s) — l'étage qui résout est branché et compte ce qu'il voit.`);
