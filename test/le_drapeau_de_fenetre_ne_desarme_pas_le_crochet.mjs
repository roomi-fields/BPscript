#!/usr/bin/env node
/**
 * GARDE — `--fenetres` VIT AU SITE DE BASCULE, JAMAIS SUR LE CHEMIN DE LA POUSSÉE.
 *
 * ⛔ CE QUI L'A RENDU NÉCESSAIRE, ET CE N'EST PAS ARRIVÉ CHEZ MOI. Amendement de l'architecte,
 * 2026-08-25 : runtime-MIDI a posé le drapeau **dans la fonction commune** à ses deux sites. Mesuré
 * chez lui, boîte à quatre non-lus, aucune fenêtre ouverte :
 *
 *     AVANT   le crochet de poussée    code 1 — « 4 message(s) NON LU(S) »
 *     APRÈS   le crochet de poussée    ⛔ CODE 0, AVEC LES MÊMES QUATRE NON-LUS
 *
 * ⇒ **Le garde du courrier était désarmé au seul endroit où il compte, et rien ne rougissait.**
 *
 * ⛔ ET LE DÉSARMEMENT EST INVISIBLE AUX BANCS DE FENÊTRE : la couture d'épreuve `--depuis-entree`
 * saute déjà la lecture du courrier, donc aucun banc de fenêtre ne distingue un crochet armé d'un
 * crochet désarmé. **L'inverser reste vert de bout en bout.** Le seul témoin qui discrimine demande
 * une BOÎTE NON VIDE — il se prend à la main, et l'architecte a inscrit cette borne chez lui.
 *
 * ⇒ CE GARDE PREND L'AUTRE MOITIÉ, celle qui est mécanisable : **la structure des appels**. Il ne
 * peut pas prouver que le crochet refuse ; il prouve qu'aucun chemin de poussée ne porte le drapeau,
 * ce qui est la condition sans laquelle le refus ne peut pas exister.
 *
 * ⚠️ CHEZ MOI LA SÉPARATION TIENT PAR CONSTRUCTION — le crochet lance le garde en shell, la
 * publication l'appelle par son propre chemin. **Éprouvé à la main le 2026-08-25, boîte à quatre
 * non-lus : le crochet rend 1, la bascule rend 0.** Ce garde existe pour que ça reste vrai, pas pour
 * constater que ça l'est.
 */
import { readFileSync, existsSync } from 'node:fs';

const RACINE = new URL('..', import.meta.url).pathname;
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * Le texte d'un fichier, commentaires retirés.
 *
 * ⛔ LE JUGE TRAVAILLE SUR LE FICHIER, JAMAIS SUR LA LIGNE, et ma première écriture faisait
 * l'inverse : elle cherchait le drapeau sur la ligne qui nomme `garde-fenetre.sh`. Or la publication
 * capture le chemin dans une variable — `const garde = path.join(…)` — puis appelle
 * `execFile('bash', [garde, '--fenetres'])`. **Les deux faits vivent sur deux lignes différentes**,
 * et le juge a rougi sur une pose correcte. C'est « une mesure par graphie ne voit pas une racine
 * capturée en variable », commise dans le garde écrit pour la traquer.
 */
const texte = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*(\/\/|#).*$/gm, ' ');

/** Les deux juges, purs — donc injectables. */
const atteintLeGarde = (t) => /garde-fenetre(\.sh)?['"\s\],)]/.test(t);
const porteLeDrapeau = (t) => /--fenetres/.test(t);

// ── A. LE CROCHET DE POUSSÉE — aucun drapeau, les DEUX décisions tiennent ────────────────────
{
  const t = texte('.githooks/pre-push');
  ok(atteintLeGarde(t),
     `A. SOCLE : aucun appel au garde de la tour dans le crochet de poussée. Le garde a changé de `
     + `nom, ou le crochet ne l'appelle plus — les deux se voient ici et pas ailleurs.`);
  ok(!porteLeDrapeau(t),
     `A. ⛔ LE CROCHET DE POUSSÉE PORTE « --fenetres » — le refus sur COURRIER NON LU est désarmé au `
     + `seul endroit où il compte, et aucun banc de fenêtre ne peut le voir.`);
}

// ── B. LE SITE DE BASCULE — le drapeau, et il y est ─────────────────────────────────────────
{
  const t = texte('scripts/publier.mjs');
  ok(atteintLeGarde(t),
     `B. SOCLE : la publication n'appelle plus le garde de la tour. `
     + `« publier » appelé seul redevient un site de bascule non gardé.`);
  ok(porteLeDrapeau(t),
     `B. ⛔ LE SITE DE BASCULE N'A PAS « --fenetres » : il re-garde le COURRIER à la fin d'un `
     + `portillon de trois minutes, donc il mesure un autre instant que le geste. C'est ce qui a fait `
     + `retirer la première pose, le 2026-08-25.`);
}

// ── C. AUCUN AUTRE CHEMIN NE PORTE LE DRAPEAU ────────────────────────────────────────────────
// ⛔ La portée ET son complément : le défaut de runtime-MIDI vit dans un APPELANT UNIQUE, donc
// nommer deux fichiers ne suffit pas. Tout ce qui appelle le garde ailleurs est refusé d'office.
{
  const { execFileSync } = await import('node:child_process');
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE })
    .split('\n').filter((f) => /\.(mjs|js|cjs|sh)$/.test(f) || f.startsWith('.githooks/'));
  const AUTORISES = new Set(['.githooks/pre-push', 'scripts/publier.mjs',
                             'test/le_drapeau_de_fenetre_ne_desarme_pas_le_crochet.mjs']);
  const ailleurs = [];
  for (const f of suivis) {
    if (AUTORISES.has(f)) continue;
    // ⛔ SUIVI N'EST PAS PRÉSENT. Une reconstruction retire des morceaux de `dist/` avant qu'ils
    // soient enregistrés : ils restent SUIVIS et n'existent plus sur le disque. Le garde tombait
    // alors en exception — donc il DISPARAISSAIT du portillon au lieu d'y rougir, et c'est le
    // compte de gardes qui l'a rattrapé. Un fichier absent ne porte aucun drapeau ; il sort.
    if (!existsSync(`${RACINE}${f}`)) continue;
    const t = texte(f);
    if (atteintLeGarde(t) && porteLeDrapeau(t)) ailleurs.push(f);
  }
  ok(suivis.length > 50, `C. SOCLE : ${suivis.length} fichier(s) examiné(s) — un périmètre qui fond ne prouve rien.`);
  ok(ailleurs.length === 0,
     `C. ⛔ « --fenetres » vit ailleurs qu'au site de bascule : ${ailleurs.join(' · ')}. Un appelant `
     + `unique servant les deux sites désarme le crochet en silence.`);
}

// ── D. LE JUGE MORD ──────────────────────────────────────────────────────────────────────────
{
  ok(porteLeDrapeau('bash ~/dev/bp/hub/tools/garde-fenetre.sh --fenetres || exit 1'),
     `D. le juge ne voit pas le drapeau dans un appel shell — il ne mordrait jamais.`);
  ok(porteLeDrapeau("execFile('bash', [garde, '--fenetres'], …)"),
     `D. le juge ne voit pas le drapeau passé en argument de tableau.`);
  ok(!porteLeDrapeau('bash ~/dev/bp/hub/tools/garde-fenetre.sh || exit 1'),
     `D. le juge accuse un appel SANS drapeau — il refuserait la forme correcte.`);
}

ok(passe >= 8, `SOCLE : ${passe} vérification(s) seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ le drapeau de fenêtre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${passe} vérification(s) passée(s) — le drapeau vit au site de bascule, et nulle part ailleurs.`);
