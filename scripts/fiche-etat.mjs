#!/usr/bin/env node
/**
 * GÉNÉRATEUR DE LA FICHE D'ÉTAT — `baseline-status.json`.
 *
 * ⛔ POURQUOI ELLE EST DÉRIVÉE ET PLUS TENUE À LA MAIN. C'est le fichier que l'architecte lit pour
 * connaître mon état sans me réveiller. La mienne datait du 2026-06-16 — DEUX MOIS — et personne ne
 * s'en apercevait : aucun garde ne compare une fiche d'état au dépôt qu'elle décrit.
 *
 * CE QU'ELLE DISAIT DE FAUX, mesuré le 2026-08-14 :
 *   · 42 grammaires, alors que le corpus en porte 114 — elle en ignorait SOIXANTE-DOUZE ;
 *   · un vocabulaire (`green`/`yellow`/`red`) que le corpus n'emploie plus ;
 *   · un champ `source` qui nommait `compileBPS`, supprimé le 2026-07-19 (commit 1b974f5).
 * Elle décrivait donc une chaîne morte, sur un tiers du corpus, avec des mots périmés.
 *
 * ⚠️ LA CAUSE N'EST PAS LA NÉGLIGENCE, C'EST LA FORME. Ma charte dit de TENIR cette fiche en fin de
 * session ; elle ne dit pas de la MESURER. Une fiche qu'on tient se recopie de proche en proche, et
 * un chiffre faux de moitié s'y loge aussi bien qu'une règle périmée. Formulation de runtime-OSC,
 * qui a trouvé le défaut chez lui le même jour : sa fiche annonçait 66 bancs, il en avait 137.
 *
 * DONC ELLE SE GÉNÈRE. Le corpus, le portillon et le registre disent leurs propres chiffres ; ce
 * script les lit et n'en invente aucun. Il n'écrit rien sur le disque — le script npm redirige sa
 * sortie, et un garde compare l'enregistré au régénéré, comme pour le paquet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Le corpus dit lui-même le statut de chaque grammaire. */
function corpus() {
  const brut = JSON.parse(readFileSync(join(RACINE, 'test/grammars/grammars.json'), 'utf-8'));
  const table = Array.isArray(brut) ? Object.fromEntries(brut.map((g) => [g.name, g])) : brut;
  const parStatut = {};
  for (const g of Object.values(table)) {
    const s = g.status || 'sans statut';
    parStatut[s] = (parStatut[s] || 0) + 1;
  }
  return { total: Object.keys(table).length, parStatut, grammaires: Object.fromEntries(
    Object.entries(table).sort(([a], [b]) => a.localeCompare(b)).map(([n, g]) => [n, g.status || 'sans statut'])) };
}

/** Le portillon compte ses propres gardes — on lit son verdict, on ne l'estime pas. */
function portillon() {
  try {
    const sortie = execFileSync('node', [join(RACINE, 'test/run_guards.mjs')],
      { encoding: 'utf-8', cwd: RACINE, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    const m = sortie.match(/\[gardes\] (\d+) garde\(s\) vert\(s\), (\d+) en échec/);
    const a = sortie.match(/(\d+) assertion\(s\) RÉELLEMENT exécutée\(s\)/);
    return m
      ? { verts: Number(m[1]), echecs: Number(m[2]), assertions: a ? Number(a[1]) : null }
      : { verts: null, echecs: null, note: 'verdict illisible' };
  } catch (e) {
    const s = (e.stdout || '') + (e.stderr || '');
    const m = s.match(/\[gardes\] (\d+) garde\(s\) vert\(s\), (\d+) en échec/);
    return m ? { verts: Number(m[1]), echecs: Number(m[2]) } : { verts: null, echecs: null, note: 'portillon non mesurable' };
  }
}

/** Les librairies disent leur format et leur nature. */
function librairies() {
  const fichiers = readdirSync(join(RACINE, 'lib'));
  return {
    vocabulaire_en_bpscript: fichiers.filter((f) => f.endsWith('.bpsl')).map((f) => f.replace('.bpsl', '')).sort(),
    catalogues_en_json: fichiers.filter((f) => f.endsWith('.json')).length,
  };
}

const fiche = {
  component: 'BPScript — le langage, son transpileur et ses librairies',
  updated: execFileSync('git', ['-C', RACINE, 'log', '-1', '--format=%cs'], { encoding: 'utf-8' }).trim(),
  commit: execFileSync('git', ['-C', RACINE, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim(),
  derivee: 'baseline-status.json est GÉNÉRÉE par scripts/fiche-etat.mjs — ne pas éditer à la main.',
  voie_de_compilation: 'compileToBPxAST — voie unique, l\'AST est agnostique du moteur',
  corpus: corpus(),
  portillon: portillon(),
  librairies: librairies(),
};

process.stdout.write(`${JSON.stringify(fiche, null, 2)}\n`);
