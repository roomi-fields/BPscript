#!/usr/bin/env node
/**
 * GARDE — LE CROCHET DE POUSSÉE GARDE LE COURRIER, ET RIEN NE LE DÉSARME.
 *
 * ⛔ CE QUE CE GARDE TENAIT AVANT LE 2026-09-05, ET CE QU'IL EN RESTE. Il éprouvait le drapeau
 * `--fenetres`, qui nommait le SITE d'appel du garde partagé : le crochet de poussée l'appelait NU
 * (donc avec ses deux refus — courrier non lu ET fenêtre ouverte), le site de publication l'appelait
 * avec le drapeau (donc sur le seul refus de fenêtre).
 *
 * ⇒ Les fenêtres de gel sont retirées de l'écosystème (Romain, 2026-09-04 : « go qu'on en finisse »),
 *   et l'appel du site de publication est parti avec elles. Le drapeau n'existe plus nulle part, donc
 *   les volets qui l'éprouvaient n'ont plus d'objet.
 *
 * ⇒ ⛔ CE QUI SURVIT EST LA MOITIÉ QUI NE PARLAIT PAS DE FENÊTRES : le script retiré portait DEUX
 *   refus, et le second — POUSSER AVEC DU COURRIER NON LU — n'a aucun rapport avec le gel. Il a
 *   refusé deux de mes poussées le 2026-09-04, à raison : l'un des messages non lus portait un défaut
 *   de chez moi qui bloquait bp3-frontend. *Un garde né d'un mécanisme qu'on retire ne part pas si sa
 *   fonction lui survit* (règle de l'architecte, 2026-09-04, cas BPx).
 *
 * ⇒ ⛔ ET LE REFUS A SON PROPRE SCRIPT DEPUIS LE 2026-09-05 : `garde-courrier-non-lu.sh`, que le
 *   crochet appelle à la place. *Deux refus dans un même script sont DEUX gardes, et ils se retirent
 *   séparément — un fichier partagé n'est pas une fonction partagée.* Mesuré chez kairos, qui a poussé
 *   avec une lettre non lue sans que rien ne l'arrête, le jour où les appels sont partis.
 *
 * ⚠️ ET « 0 NON-LU » EST LE SEUL VERDICT, JAMAIS L'ÉCRAN : le lot d'affichage est borné à quatre. Le
 *   2026-08-23, un dépôt a poussé après avoir lu quatre messages sur six — sa discipline était juste,
 *   son geste était faux, et rien ne le lui a dit.
 *
 * ⚠️ ET LE DÉSARMEMENT EST INVISIBLE AUTREMENT : mesuré chez runtime-MIDI le 2026-08-25, un drapeau
 * posé dans la fonction commune à ses deux sites rendait CODE 0 avec quatre non-lus en boîte, sans
 * qu'aucun banc ne rougisse. Ce garde prend la moitié mécanisable — la STRUCTURE de l'appel.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`;
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const texte = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*(\/\/|#).*$/gm, ' ');

/** Les deux juges, purs — donc injectables. */
const atteintLeGarde = (t) => /garde-courrier-non-lu(\.sh)?['"\s\],)]/.test(t);
const porteLeDrapeau = (t) => /--fenetres/.test(t);

// ── A. LE CROCHET DE POUSSÉE — l'appel est là, et sans drapeau ───────────────────────────────
{
  const t = texte('.githooks/pre-push');
  ok(atteintLeGarde(t),
     `A. SOCLE : aucun appel au garde de la tour dans le crochet de poussée. Le garde a changé de `
     + `nom, ou le crochet ne l'appelle plus — les deux se voient ici et pas ailleurs.`);
  ok(!porteLeDrapeau(t),
     `A. ⛔ LE CROCHET DE POUSSÉE PORTE « --fenetres » — le refus sur COURRIER NON LU est désarmé au `
     + `seul endroit où il compte, et aucun banc ne peut le voir.`);
}

// ── B. LE DRAPEAU NE VIT NULLE PART — il est parti avec les fenêtres ─────────────────────────
// ⛔ La portée ET son complément : le retrait se prouve sur TOUT l'arbre suivi, jamais sur les deux
//   fichiers qu'on a touchés. Un drapeau qui survit dans un appelant unique désarme le crochet en
//   silence — c'est le défaut de runtime-MIDI, et il vivait dans un troisième fichier.
{
  const { execFileSync } = await import('node:child_process');
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE })
    .split('\n').filter((f) => /\.(mjs|js|cjs|sh)$/.test(f) || f.startsWith('.githooks/'));
  const MOI = 'test/le_crochet_de_poussee_garde_le_courrier.mjs';
  const ailleurs = [];
  for (const f of suivis) {
    if (f === MOI) continue;
    // ⛔ SUIVI N'EST PAS PRÉSENT : une reconstruction retire des morceaux de `dist/` avant qu'ils
    //   soient enregistrés. Le garde tombait alors en exception — donc il DISPARAISSAIT du portillon
    //   au lieu d'y rougir. Un fichier absent ne porte aucun drapeau ; il sort.
    if (!existsSync(`${RACINE}${f}`)) continue;
    if (porteLeDrapeau(texte(f))) ailleurs.push(f);
  }
  ok(suivis.length > 50, `B. SOCLE : ${suivis.length} fichier(s) examiné(s) — un périmètre qui fond ne prouve rien.`);
  ok(ailleurs.length === 0,
     `B. ⛔ « --fenetres » vit encore : ${ailleurs.join(' · ')}. Le drapeau est parti avec les fenêtres ; `
     + `un survivant désarmerait le refus de courrier là où il compte.`);
}

// ── C. LE JUGE MORD ──────────────────────────────────────────────────────────────────────────
{
  ok(porteLeDrapeau('bash ~/dev/bp/hub/tools/garde-courrier-non-lu.sh --fenetres || exit 1'),
     `C. le juge ne voit pas le drapeau dans un appel shell — il ne mordrait jamais.`);
  ok(porteLeDrapeau("execFile('bash', [garde, '--fenetres'], …)"),
     `C. le juge ne voit pas le drapeau passé en argument de tableau.`);
  ok(!porteLeDrapeau('bash ~/dev/bp/hub/tools/garde-courrier-non-lu.sh || exit 1'),
     `C. le juge accuse un appel SANS drapeau — il refuserait la forme correcte.`);
  ok(atteintLeGarde('BP_AGENT=bpscript bash "$HOME/dev/bp/hub/tools/garde-courrier-non-lu.sh" || exit 1'),
     `C. le juge ne reconnaît pas l'appel du crochet — son socle serait toujours faux.`);
}

console.log(`[crochet courrier] ${passe} PASS / ${echecs.length} FAIL — ${passe} assertion(s)`);
if (echecs.length) {
  console.error(`❌ le crochet de poussée garde le courrier : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
