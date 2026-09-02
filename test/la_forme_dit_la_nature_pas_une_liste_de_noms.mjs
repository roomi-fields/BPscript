#!/usr/bin/env node
/**
 * GARDE — LA NATURE D'UNE VALEUR SE LIT DANS SON ÉCRITURE, ET AUCUNE LISTE DE NOMS NE LA DÉCIDE.
 *
 * Phase 3 du chantier du compilateur, quatrième câblage. Le générateur du bundle portait cinq noms
 * écrits en dur — `args`, `values`, `scope`, `range`, `registers` — qui décidaient seuls qu'une clé
 * portait une collection. *« Rien ne se code en dur de ce qui se DÉCLARE »* : une parenthèse de
 * membres nus est une suite, un deux-points est une valeur, et la forme le dit sans qu'on la nomme.
 *
 * ⛔ CE QUE CE GARDE TIENT EN PREMIER : QUE LE CODE RETIRÉ N'A PLUS D'APPELANT VIVANT. *« Remplacer X
 * par Y = supprimer X dans le même mouvement. »* Une liste laissée en place à côté de son
 * remplaçant fait deux mécanismes pour un seul fait, et la profondeur choisit lequel — c'était
 * exactement l'état d'avant : le test de forme vivait à UN des deux endroits qui en avaient besoin.
 *
 * ⚠️ ET C'EST CE DOUBLE MÉCANISME QUI RENDAIT LE DÉFAUT INVISIBLE. Retirer la liste sans porter le
 * test de forme au second endroit transformait 68 listes publiées en objets — mesuré avant la
 * frappe. Le paquet aurait changé de 184 chemins sans qu'aucune règle n'ait bougé.
 *
 * ⚠️ ET IL SE PROUVE SUR UNE CLÉ QUE LA LISTE NE CONTENAIT PAS. Éprouver le mécanisme sur `args`
 * verdirait aussi bien avec la liste qu'avec la forme : les deux le classent pareil. Le cas qui
 * discrimine est une clé inventée, qu'aucune liste ne pouvait connaître.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── A. LE CODE VOUÉ AU RETRAIT N'A PLUS D'APPELANT VIVANT ────────────────────────────────────
{
  const source = readFileSync(`${RACINE}/src/transpiler/libs-bundle.js`, 'utf8');
  for (const mort of ['CLES_LISTES', 'clesListesDuFichier']) {
    ok(!source.includes(mort),
       `A. ⛔ « ${mort} » VIT ENCORE dans le générateur du bundle. Une liste de noms laissée à côté `
       + `du prédicat de forme fait deux mécanismes pour un seul fait, et la profondeur choisit `
       + `lequel. Le retrait se fait dans le mouvement qui rend le code mort.`);
  }
  ok(source.includes('const estUneSuite ='),
     `A. SOCLE : le prédicat de forme est introuvable — un socle muet ne prouve pas que le `
     + `remplacement a eu lieu, il prouve que le juge a changé de sujet.`);
}

// ── LE BAC : le générateur lit un répertoire fixe, donc la source témoin s'écrit hors arbre ──
const bac = mkdtempSync(join(tmpdir(), 'bpscript-forme-nature-'));
try {
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE }).split('\n').filter(Boolean);
  ok(suivis.length >= 100, `SOCLE : assiette de ${suivis.length} fichier(s) — trop peu pour régénérer.`);
  for (const f of suivis) { mkdirSync(join(bac, dirname(f)), { recursive: true }); cpSync(join(RACINE, f), join(bac, f)); }
  execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

  // ⛔ LA SOURCE TÉMOIN N'EMPLOIE AUCUN DES CINQ ANCIENS NOMS. C'est ce qui rend le cas
  // discriminant : une liste de noms ne pouvait pas connaître `cordes` ni `bourdon`.
  writeFileSync(join(bac, 'lib/temoin_forme.bpsl'),
    // Sans `section:controls` : une place de contrôles n'admet que des déclarations de contrôle, et le
    // générateur le vérifie au fil de la lecture depuis le 2026-09-02. L'entrée vit à la racine.
    'def temoin_forme (documented:true)\n'
    + 'def piece (cordes(mi, la, re), bourdon:do, args(un, deux))\n');

  const regenerer = () => {
    const brut = execFileSync('node', ['src/transpiler/libs-bundle.js'], { cwd: bac, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ligne = brut.split('\n').find((l) => l.startsWith('LIBS["temoin_forme"] ='));
    return ligne ? JSON.parse(ligne.replace('LIBS["temoin_forme"] = ', '').replace(/;\s*$/, '')) : null;
  };
  const piece = (regenerer() || {}).piece;
  ok(piece && typeof piece === 'object',
     `SOCLE : l'entrée témoin n'est pas dans le paquet régénéré — tout ce qui suit mesurerait son `
     + `absence, pas la forme. Reçu : ${JSON.stringify(piece)}`);

  // ── B. UNE PARENTHÈSE DE NOMS NUS EST UNE SUITE, sur une clé qu'aucune liste ne nommait ────
  ok(Array.isArray(piece?.cordes) && piece.cordes.join() === 'mi,la,re',
     `B. ⛔ LA FORME NE DÉCIDE PAS : « cordes(mi, la, re) » rend ${JSON.stringify(piece?.cordes)} au `
     + `lieu de la liste ["mi","la","re"]. Cette clé n'a jamais figuré dans la liste de cinq noms — `
     + `c'est précisément ce qui rend ce cas discriminant, et c'est la population que la liste ne `
     + `pouvait pas connaître : 62 clés de la donnée publiée.`);

  // ── C. LE COMPLÉMENT — un deux-points est une VALEUR, jamais une liste d'un élément ────────
  ok(piece?.bourdon === 'do',
     `C. ⛔ « bourdon:do » rend ${JSON.stringify(piece?.bourdon)}. Un deux-points dit une valeur ; le `
     + `promouvoir en liste d'un élément est ce que faisait la coercition retirée, et c'est ce qui `
     + `rendait indistinguables « une valeur » et « une collection à un membre ».`);

  // ── D. AUCUN PRIVILÈGE POUR LES CINQ ANCIENS NOMS — ils passent par la même porte ──────────
  ok(Array.isArray(piece?.args) && piece.args.join() === 'un,deux',
     `D. « args(un, deux) » rend ${JSON.stringify(piece?.args)}. L'ancien nom privilégié doit être `
     + `traité par le prédicat de forme comme n'importe quel autre — s'il l'est encore à part, la `
     + `liste survit sous une autre graphie.`);

  // ── E. LE PRÉDICAT MORD — la faute lui est donnée, il doit rougir ──────────────────────────
  {
    const chemin = join(bac, 'src/transpiler/libs-bundle.js');
    const texte = readFileSync(chemin, 'utf8');
    const ancre = 'const estUneSuite = (sac) => Boolean(sac && sac.type === \'SettingBag\'';
    ok(texte.includes(ancre),
       `E. ⛔ ANCRE INTROUVABLE — le prédicat a changé de graphie, et l'injection mesurerait un `
       + `fichier qu'elle n'a pas modifié. Un garde se prouve sur la graphie que le code ÉCRIT.`);
    writeFileSync(chemin, texte.replace(ancre, 'const estUneSuite = (sac) => Boolean(false && sac'));
    // ⚠️ DEPUIS LE 2026-09-02 LA MORSURE EST PLUS FORTE : chaque librairie construite entre au registre
    // du compilateur au fil de la lecture, donc un `core` dont les suites sont devenues des objets
    // fait PLANTER la lecture de la source suivante — le générateur ne rend plus de paquet du tout.
    // Un plantage est une morsure, pas une absence de mesure.
    let casse = null; let plante = false;
    try { casse = (regenerer() || {}).piece; } catch { plante = true; }
    ok(plante || !Array.isArray(casse?.cordes),
       `E. ⛔ LE PRÉDICAT NEUTRALISÉ NE CHANGE RIEN — l'injection ne mord pas, donc les volets B et D `
       + `ne prouvaient pas le prédicat. Une injection qui ne mord pas se suspecte elle-même. `
       + `Reçu : ${JSON.stringify(casse?.cordes)}`);
  }
} finally {
  rmSync(bac, { recursive: true, force: true });
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 8, `SOCLE : ${passe} vérification(s) seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ la forme dit la nature : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${passe} vérification(s) passée(s) — la forme dit la nature, et la liste de noms est morte.`);
