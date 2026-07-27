#!/usr/bin/env node
/**
 * GARDE — mes documents de la TOUR disent-ils encore vrai sur MON dépôt ?
 *
 * D'OÙ ELLE VIENT. Le 2026-07-27, ma fiche projet affirmait TROIS choses fausses depuis six
 * semaines, et mon CONTRAT avec BPx en affirmait autant depuis huit jours : un pipeline supprimé,
 * une sortie supprimée, un chemin d'oracles à moitié disparu, et des scènes qui n'y ont jamais
 * vécu sous cette forme. Personne ne l'a vu.
 *
 * ⚠️ POURQUOI C'EST DIFFÉRENT DE TOUT LE RESTE, et pourquoi ça mérite une garde : **ces documents
 * ne rougissent JAMAIS**. Un test faux échoue, un code faux plante, une doc fausse ne fait rien du
 * tout. Un contrat ne se fait pas attraper par l'usage — il se fait attraper quand quelqu'un
 * CONSTRUIT DESSUS, et c'est trop tard. Le mensonge a vécu huit jours parce que personne ne
 * demandait la chose promise.
 *
 * ET C'EST LA MÊME LEÇON QUE TOUTE LA JOURNÉE, appliquée au dernier endroit qui y échappait : une
 * règle qui demande de la vigilance n'est pas une règle, c'est une intention. « Relire ses documents
 * de temps en temps » en est une. Ceci en est la version mécanique.
 *
 * CE QU'ELLE VÉRIFIE : uniquement les affirmations **de fait, sur MON dépôt**, que ces documents
 * portent — des chemins, des absences, des comptes. Pas leur prose, pas leurs intentions, pas ce
 * qui appartient aux autres. Une garde qui prétendrait juger un contrat entier mentirait à son tour.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const HUB = path.resolve(RACINE, '..', 'hub');
const DOCS = [
  ['contrat', path.join(HUB, 'contrats', 'bpscript-bpx.md')],
  ['fiche', path.join(HUB, 'projets', 'bpscript.md')],
];

// ─── 1. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
// La tour est un dépôt VOISIN : s'il n'est pas là, cette garde ne peut RIEN dire. Elle le dit au
// lieu de verdir — c'est la famille fermée le 2026-07-27 dans huit gardes, et celle-ci naît après,
// donc elle naît avec son socle.
const absents = DOCS.filter(([, p]) => !existsSync(p)).map(([q]) => q);
ok(absents.length === 0,
   `1. document(s) introuvable(s) : ${absents.join(', ')} — la tour est-elle clonée à côté ? `
   + `Sans eux cette garde ne vérifie RIEN, et un vert ne prouverait rien.`);
if (absents.length > 0) {
  console.error(`❌ documents de tour : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
const texte = Object.fromEntries(DOCS.map(([q, p]) => [q, readFileSync(p, 'utf8')]));

// ─── 2. LES COMPTES D'ORACLES ANNONCÉS SONT-ILS ENCORE LES BONS ? ────────────────────────────
// Le contrat annonce trois niveaux avec leur présence. On recompte sur le disque et on confronte
// au CHIFFRE ÉCRIT — c'est le seul moyen qu'un document dérive sans que personne le voie.
const GRAMMAIRES = path.join(RACINE, 'test', 'grammars');
const compteNiveau = (niveau) => {
  if (!existsSync(GRAMMAIRES)) return -1;
  let n = 0;
  for (const d of readdirSync(GRAMMAIRES)) {
    if (existsSync(path.join(GRAMMAIRES, d, 'snapshots', `${niveau}.json`))) n++;
  }
  return n;
};
ok(compteNiveau('s3_native') > 0, "2. l'arborescence d'oracles doit exister — sinon rien à confronter");

for (const [niveau, motif] of [
  ['s3_native', /`s3_native\.json`\s*\|\s*\*\*(\d+)\*\*/],
  ['s3_timed', /`s3_timed\.json`\s*\|\s*\*\*(\d+)\*\*/],
  ['s1_native', /`s1_native\.json`\s*\|\s*\*\*(\d+)\*\*/],
]) {
  const m = texte.contrat.match(motif);
  ok(m !== null, `2. le contrat doit ANNONCER un compte pour '${niveau}' — sinon il ne dit rien de vérifiable`);
  if (!m) continue;
  const annonce = Number(m[1]);
  const reel = compteNiveau(niveau);
  ok(annonce === reel,
     `2. le contrat annonce ${annonce} grammaire(s) avec '${niveau}', le disque en porte ${reel}. `
     + `Un document qui ne rougit jamais dérive en silence — c'est pour ça que cette garde existe.`);
}

// ─── 3. LES ABSENCES AFFIRMÉES SONT-ELLES ENCORE VRAIES ? ────────────────────────────────────
// Les deux documents affirment qu'AUCUNE scène ne vit sous l'arborescence d'oracles. C'est
// l'affirmation la plus fragile : il suffit qu'une copie revienne pour qu'elle devienne fausse —
// et c'est précisément l'incident `vina` du 2026-07-19, deux fichiers divergents sous le même nom.
{
  const compterBps = (d) => {
    if (!existsSync(d)) return 0;
    let n = 0;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) n += compterBps(path.join(d, e.name));
      else if (e.name.endsWith('.bps')) n++;
    }
    return n;
  };
  const scenes = compterBps(GRAMMAIRES);
  const affirme = /0 fichier `\.bps` sous `test\/grammars\/`/.test(texte.fiche);
  ok(affirme, "3. la fiche doit AFFIRMER l'absence de scènes — sinon il n'y a rien à garder ici");
  ok(scenes === 0,
     `3. la fiche affirme 0 scène sous l'arborescence d'oracles, il y en a ${scenes}. `
     + `Soit une copie est revenue (incident 'vina'), soit le document est à corriger — les deux `
     + `demandent une action, aucune ne se résout en attendant.`);
}

// ─── 4. LA VOIE SUPPRIMÉE EST-ELLE ENCORE SUPPRIMÉE ? ────────────────────────────────────────
// Les deux documents disent que l'ancienne voie n'existe plus. Si elle revenait, ils redeviendraient
// faux dans l'autre sens — et un document qu'on a corrigé une fois inspire une confiance qu'il ne
// mérite plus dès que le code bouge.
{
  const facade = readFileSync(path.join(RACINE, 'src', 'transpiler', 'index.js'), 'utf8');
  const exporte = /export\s*\{([^}]*)\}/.exec(facade);
  const noms = exporte ? exporte[1].split(',').map((x) => x.trim()) : [];
  ok(noms.includes('compileToBPxAST'), `4. la voie unique doit être exportée — reçu : ${JSON.stringify(noms)}`);
  ok(!noms.includes('compileBPS'),
     "4. la fiche et le contrat affirment que l'ancienne voie est SUPPRIMÉE — elle est réexportée, "
     + "donc l'un des deux ment désormais");
}

if (echecs.length) {
  console.error(`❌ documents de tour : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ mes documents de tour disent vrai — ${passe} vérification(s) passée(s) sur `
            + `${DOCS.length} document(s) et ${compteNiveau('s3_native')} grammaire(s) d'oracles`);
}
