#!/usr/bin/env node
/**
 * ⛔ GARDE SUSPENDU — GEL MODULATION / PATCHING (Romain, 2026-08-09).
 *
 * « On gèle tout ce qui est modulation/patching. » Et geler un sujet gèle CE QUI LE SERT : on ne
 * SUPPRIME pas, on SUSPEND avec motif daté, et on attend.
 *
 * ⚠️ CE GARDE AVAIT ÉTÉ SUPPRIMÉ le 2026-08-09 au motif que « son sujet n'existe plus », les
 * directives qu'il éprouve ayant été retirées du langage le matin même. C'ÉTAIT LE MAUVAIS GESTE :
 * le sujet ne disparaît pas, il DORT — il revient avec le remaniement Dedale/FaustX, sous une
 * autre graphie. Un garde supprimé emporte avec lui ce qu'il gardait ; un garde suspendu le dit.
 *
 * ⚠️ ET LE JOUR MÊME, CETTE SUPPRESSION A COÛTÉ : le garde de la validation de modulation a été
 * retiré parce que « son sujet n'existe plus », alors que le CODE qu'il surveillait tournait
 * toujours — il lit une section supprimée, rend donc toujours vide, et accepte désormais une
 * modulation vers une source inexistante. Le sujet du GARDE avait disparu ; celui du CODE non.
 *
 * RALLUMAGE : au dégel du chantier Dedale/FaustX. L'ordre des chantiers est fixé par Romain —
 * 1. conformité à LANGUAGE.md hors patching, 2. un point ISO-100, 3. et seulement ensuite FaustX.
 *
 * Le corps du garde est CONSERVÉ INTACT sous ce drapeau : il n'y a rien à réinventer au dégel.
 */
const GEL_MODULATION_PATCHING = true;
if (GEL_MODULATION_PATCHING) {
  console.log('⏸️  SUSPENDU — gel modulation/patching (Romain 2026-08-09), rallumage au dégel Dedale/FaustX.');
  process.exit(0);
}

/**
 * GARDE — `@wire`, le CÂBLAGE INITIAL, et il vit à la RACINE de la scène.
 *
 * Forme retenue par Romain (2026-07-29, décision `2026-07-29-les-formes-declaratives-de-bpscript`) :
 *     @wire saw >> lpf >> audio
 * Elle pose l'ÉTAT DE DÉPART du branchement ; le flux le modifie ensuite avec les chevrons
 * existants. Ça ne rouvre PAS la directive de correspondance abandonnée le 2026-07-27 : l'argument
 * qui l'avait tuée était qu'UNE DIRECTIVE NE SE DÉBRANCHE PAS — un câblage initial n'a pas à se
 * débrancher, c'est sa définition même.
 *
 * ⚠️ LE NŒUD N'EST PAS NEUF, ET C'EST DÉLIBÉRÉ : c'est le `Wiring` que produisent déjà les corps de
 * macro, à l'identique. Inventer un second nœud pour le même fait aurait été une seconde source de
 * vérité — exactement la faute que j'ai payée le matin même en fondant `noteTerminals` avec
 * `alphabetTerminals`. Un même fait, un même nœud.
 *
 * ⚠️ ET IL VIT À LA RACINE PARCE QUE BPx L'A MESURÉ AVANT QUE J'ÉCRIVE. Leur mot : sans champ
 * propre, leur repli attrape-tout collerait le câblage sur CHAQUE FEUILLE. Le risque n'était donc
 * pas la casse — leurs trois formes d'essai chargent vertes — mais le PLACEMENT SILENCIEUX.
 * `scene.wires` le met là où vivent déjà les acteurs et la configuration de hauteur.
 * C'est le troisième bénéfice concret du préavis à l'écriture dans la journée, et le seul des trois
 * où la faute a été évitée AVANT d'exister.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const c = (src) => compileToBPxAST(`@core\n@alphabet.western\n${src}`);

// ── 1. LE CÂBLAGE ARRIVE, À LA RACINE, ET SOUS LE NŒUD DÉJÀ CONNU ───────────────────────────
{
  const r = c('@wire saw >> lpf >> audio\nS -> C4 D4\n');
  ok((r.errors || []).length === 0, `1. '@wire' doit compiler — ${(r.errors || []).map((e) => e.message)[0] ?? ''}`);
  ok(Array.isArray(r.ast?.wires) && r.ast.wires.length === 1, '1. il arrive dans scene.wires, à la RACINE');
  ok(r.ast?.wires?.[0]?.type === 'Wiring', '1. et sous le nœud DÉJÀ connu — pas un second nœud pour le même fait');
  ok((r.ast.wires[0].stages || []).map((s) => s.module).join('>') === 'saw>lpf>audio',
    `1. les trois étages arrivent dans l'ordre écrit (reçu : ${JSON.stringify(r.ast.wires[0].stages?.map((s) => s.module))})`);
  ok(!(r.ast.directives || []).some((d) => d && d.name === 'wire'),
    '1. et il ne traîne PAS dans directives — c\'est le placement silencieux que BPx voulait éviter');
}

// ── 2. ABSENT ≠ VIDE — même règle que libRefs ───────────────────────────────────────────────
ok(c('S -> C4\n').ast?.wires === undefined,
  '2. une scène qui ne câble rien n\'a PAS de champ vide — absent, comme libRefs');
{
  const r = c('@wire saw >> audio\n@wire lfo >> lpf.cutoff\nS -> C4\n');
  ok(r.ast?.wires?.length === 2, '2. deux câblages s\'accumulent dans l\'ordre source');
  ok(r.ast.wires[1].stages?.[1]?.port === 'cutoff', '2. et le PORT adressé par le point arrive avec');
}

// ── 3. CE QUI NE DOIT PAS AVOIR BOUGÉ ────────────────────────────────────────────────────────
// Le même nœud sert au corps de macro depuis toujours : si `@wire` l'avait détourné, cette moitié
// tomberait. C'est elle qui prouve qu'on a réutilisé au lieu de dupliquer.
{
  const r = c('@macro chain saw >> audio\nS -> chain C4\n');
  ok(r.ast?.macros?.[0]?.body?.[0]?.type === 'Wiring', '3. SE TAIT — le corps de macro produit toujours son Wiring');
  ok(r.ast?.wires === undefined, '3. et une macro de câblage ne remplit PAS scene.wires — deux portes, un nœud');
}
ok(c('@wire saw \\>> audio\nS -> C4\n').ast?.wires?.[0]?.stages?.[1]?.cut === true,
  '3. la COUPURE reste lisible dans un câblage initial (la graphie ne change pas)');

// ── 4. SOCLE ─────────────────────────────────────────────────────────────────────────────────
ok(c('@wire saw >> audio\nS -> C4\n').ast?.wires?.[0]?.stages?.length === 2,
  '4. TÉMOIN — le garde doit savoir LIRE un câblage (sinon tout ce fichier ment)');
ok(c('S -> C4\n').ast?.wires === undefined,
  '4. TÉMOIN — et savoir se taire quand il n\'y en a pas');

if (echecs.length) {
  console.error(`[cablage initial] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[cablage initial] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
