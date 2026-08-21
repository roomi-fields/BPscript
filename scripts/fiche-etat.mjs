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
 * sortie.
 *
 * ⛔ ET LE GARDE QUE CET EN-TÊTE ANNONÇAIT N'EXISTAIT PAS. Il disait « un garde compare l'enregistré
 * au régénéré, comme pour le paquet » ; aucun fichier du dépôt ne lisait `baseline-status.json` à
 * part ce script. La fiche a donc dérivé cinq jours — 141 gardes annoncés pour 177, six librairies
 * pour dix — sous une phrase qui affirmait le contraire. Une affirmation dans un commentaire se
 * relit comme une preuve, et personne ne va vérifier qu'un garde nommé là est branché quelque part.
 *
 * LE GARDE EXISTE DEPUIS LE 2026-08-20 — `test/la_fiche_d_etat_dit_le_depot_qu_elle_decrit.mjs` — et
 * il ne compare PAS l'enregistré au régénéré : régénérer LANCE le portillon, et un garde qui ferait
 * ça depuis le portillon le relancerait à l'intérieur de lui-même. Il compare donc la fiche aux
 * SOURCES que ce script lit — le dossier des librairies et le corpus — et vérifie que les deux
 * champs hors de sa portée, `portillon` et `commit`, sont présents et plausibles.
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

/**
 * Le portillon compte ses propres gardes — on lit son verdict, on ne l'estime pas.
 *
 * ⛔ ET IL NE SE COMPTE PAS LUI-MÊME — corrigé le 2026-08-21, BPS-79 devenu bloquant.
 *
 * Cette fiche est GÉNÉRÉE en lançant le portillon, qui contient le garde de la fiche, qui lit la
 * fiche PRÉCÉDENTE. Tant que celle-ci est périmée, ce garde rougit ; la fiche fraîche enregistre
 * donc « 1 échec », ce qui la fait rougir à son tour. LE POINT FIXE N'EXISTE PAS : j'ai régénéré
 * deux fois de suite, le compte est resté à 1 les deux fois.
 *
 * UN COMPTEUR DÉRIVÉ DE CE QU'IL MESURE NE PEUT PAS S'INCLURE DANS SA PROPRE MESURE. Son échec ne
 * dit rien de l'état du dépôt — il dit que la fiche est périmée, ce qui est vrai par construction
 * pendant qu'on la régénère.
 *
 * ⚠️ CE N'EST PAS UNE ASSERTION AJUSTÉE À CE QUI SORT, et la différence tient à ceci : le garde de
 * la fiche n'est PAS retiré du portillon — il continue de mordre au push, sur la fiche commitée.
 * C'est l'INSTRUMENT qui cesse de se compter, pas la règle qui s'assouplit. Un dépôt réellement
 * rouge fait toujours une fiche à `echecs > 0`, parce que ses autres gardes, eux, sont comptés.
 */
const MOI = 'la_fiche_d_etat_dit_le_depot_qu_elle_decrit.mjs';
function portillon() {
  const lire = (sortie) => {
    const m = sortie.match(/\[gardes\] (\d+) garde\(s\) vert\(s\), (\d+) en échec/);
    if (!m) return null;
    // Le garde de CETTE fiche, s'il a échoué, sort du compte — et il sort du dénominateur des
    // verts aussi, sans quoi les deux nombres ne parleraient plus du même ensemble.
    const moiEnEchec = new RegExp(`ÉCHEC ${MOI.replace('.', '\\.')}`).test(sortie);
    const a = sortie.match(/(\d+) assertion\(s\) RÉELLEMENT exécutée\(s\)/);
    return { verts: Number(m[1]), echecs: Number(m[2]) - (moiEnEchec ? 1 : 0),
             assertions: a ? Number(a[1]) : null };
  };
  try {
    const sortie = execFileSync('node', [join(RACINE, 'test/run_guards.mjs')],
      { encoding: 'utf-8', cwd: RACINE, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    return lire(sortie) || { verts: null, echecs: null, note: 'verdict illisible' };
  } catch (e) {
    const s = (e.stdout || '') + (e.stderr || '');
    return lire(s) || { verts: null, echecs: null, note: 'portillon non mesurable' };
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
