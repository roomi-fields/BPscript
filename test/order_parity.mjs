// order_parity.mjs — NON-RÉGRESSION d'ordre, voie texte.
//
// Capture la sortie canonique NATIVE (`bp3 … -o`) pour les grammaires TEXTE,
// la tokenise avec l'utilitaire d'ordre PARTAGÉ (src/transpiler/orderTokens.js),
// et la compare jeton-à-jeton à l'ORACLE NATIF FIGÉ (`s3_native.json`, mode 'text').
//
// ⚠️ CE BANC A COMPARÉ AU WASM (`s3_timed.json`) JUSQU'AU 2026-08-11, deux mois après la
// décision qui le retire (`decisions/2026-06-14-oracle-natif-trois-voies.md` : ni moteur, ni
// oracle). Il ne mesurait donc plus une non-régression mais un écart entre un moteur vivant et
// un portage abandonné — le pas manquant du PLAN phase A point 3.
//
// ⚠️ ET IL NE POUVAIT PAS LE SIGNALER, POUR UNE RAISON QUE J'AI D'ABORD MAL NOMMÉE. J'ai rapporté
// qu'il était hors du portillon ; c'est FAUX, `run_guards.mjs` le lance — il balaie le dossier au
// lieu de nommer ses gardes, et ma recherche de son NOM n'a rien trouvé. La vraie cause est que
// son assiette par défaut valait TROIS grammaires écrites en dur sur les 27 qu'il pouvait
// comparer, et que les trois étaient d'accord avec le WASM. Elle suit maintenant les captures.
//
// Sans --write : LECTURE SEULE (validation, gate Romain). Avec --write : pose
// snapshots/s3_native.json mode 'text'. L'idempotence porte sur la MESURE : jetons identiques →
// la mesure n'est jamais réécrite, mais les CONDITIONS le sont si le binaire a change — sinon un
// instantané fraîchement revérifié continue de citer une empreinte qui n'existe plus.
// Référence : hub/constats/2026-06-16-voie-texte-ordre.md.
//
// --campaign (ISO-100 A.2b, [433]) : toutes les clés mode TEXTE dont le -gr. existe,
// tout statut (l'oracle sert le programme, pas mon gate), moins look-and-say (#52) et
// la famille AllItems (divergence de contenu renvoyée à BPx). En campagne, le natif
// fait foi sur les DIFF (décision 2026-06-14 §MAJ) — l'écart est affiché pour triage.
//
// Usage : node test/order_parity.mjs [grammaire …|--campaign] [--write] [--force]

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeOrder } from '../src/transpiler/orderTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');
/**
 * L'ORACLE DE LA CAMPAGNE EST UN BINAIRE ARCHIVÉ, PAS LE BINAIRE DE TRAVAIL.
 *
 * ⛔ POURQUOI CE N'EST PLUS `bp3-engine/bp3`. Ce binaire a été reconstruit QUATRE fois le
 * 2026-08-11 sous le même numéro 3.5.1, et mes 27 instantanés qualifiés citent une empreinte
 * (`9081f9a6…`) qui n'existe plus nulle part. Une référence dont le producteur a disparu ne se
 * rejoue pas : elle ne devient pas fausse, elle devient invérifiable, ce qui est pire parce que
 * rien ne le signale.
 *
 * bp3-engine a figé et nommé l'oracle de campagne le 2026-08-11 (`builds/v3.5.1-iso.1/bp3`,
 * empreinte `fb6df5ad…`, version 3.5.1 du 11 août 13:16:56, commit 672cd43) et s'engage à ne pas
 * le reconstruire tant que la campagne mesure. `bp3` de travail porte aujourd'hui le MÊME contenu
 * — c'est l'ARCHIVE qui fait foi, parce qu'elle seule ne bougera pas sous la mesure.
 *
 * ⚠️ ET IL N'Y A PAS DE REPLI SUR LE BINAIRE DE TRAVAIL. Un repli mesurerait contre un moteur non
 * nommé en croyant mesurer contre l'oracle, et le vert ne dirait pas lequel — exactement le défaut
 * que bp3-engine a payé le même jour, son script ayant remplacé un binaire EN COURS D'EXÉCUTION,
 * échoué en silence et mesuré vingt minutes contre l'ancien.
 */
const BP3 = path.resolve(BP3_DIR, 'builds', 'v3.5.1-iso.1', 'bp3');
if (!fs.existsSync(BP3)) {
  console.error(`❌ oracle de campagne introuvable : ${BP3}\n`
    + `   Ce banc ne mesure QUE contre l'archive figée par bp3-engine. Il n'y a pas de repli sur\n`
    + `   'bp3-engine/bp3' : un repli rendrait un vert dont on ignorerait le moteur.`);
  process.exit(1);
}

/**
 * L'ESTAMPILLE D'UN INSTANTANÉ NATIF — version, empreinte du binaire, ET COMMANDE COMPLÈTE.
 *
 * RÈGLE DU PROPRIÉTAIRE DE L'ORACLE (bp3-engine, `ORACLE-BINAIRE.md`, étendue aux instantanés le
 * 2026-08-10) : tout artefact de référence natif se cite version + md5 + commande.
 *
 * ⚠️ POURQUOI LA COMMANDE EST DÉTERMINANTE ET NON ACCESSOIRE. Mesuré le 2026-08-10 sur `koto3`,
 * graine 1, binaire b100125b : à PRODUCTION IDENTIQUE — mêmes 20 items, fichier texte octet pour
 * octet identique — 28 % des événements se placent à un instant DIFFÉRENT selon les sorties
 * demandées, et la fin totale passe de 15862 à 17648. Deux instantanés produits par le même binaire
 * et deux commandes différentes ne sont donc PAS comparables. Sans la commande, un écart de
 * minutage se lit comme une régression du moteur.
 *
 * ⚠️ ET LE NUMÉRO DE VERSION SEUL N'EST PAS UNE EMPREINTE (`ORACLE-BINAIRE.md`, constat #65) :
 * c'est un `#define`, deux binaires distincts peuvent l'afficher identique. Le md5 est la seule
 * empreinte de contenu.
 */
function estampilleNative(commande) {
  let version = null, md5 = null;
  try { version = (execSync(`"${BP3}" --version`, { encoding: 'utf8', timeout: 10000 })
    .match(/Version\s+([0-9.]+)/) || [])[1] || null; } catch { /* binaire absent → champ nul */ }
  try { md5 = execSync(`md5sum "${BP3}"`, { encoding: 'utf8', timeout: 10000 }).split(/\s+/)[0]; }
  catch { /* idem */ }
  // ⚠️ LES TROIS CHAMPS SONT ÉCRITS MÊME NULS, et c'est délibéré : un instantané qui les porte à
  // `null` se lit comme NON QUALIFIÉ et se compte (test/un_instantane_natif_se_cite.mjs). Un champ
  // absent, lui, ne se distingue pas d'un format qui ne l'a jamais eu.
  return { engineVersion: version, engineMd5: md5, command: commande ?? null };
}
const GUARD = path.join(__dirname, 'bp3-guard.sh');   // enveloppe anti-OOM, cf [231]
const GRAMMARS = JSON.parse(fs.readFileSync(path.join(__dirname, 'grammars', 'grammars.json'), 'utf8'));

// Réglages BP2 positionnels → JSON (repris de s3_native.cjs, version compacte).
function convertOldSettings(c, conv) {
  const lines = c.split(/\r\n?|\n/);
  let hdr = 0;
  while (hdr < lines.length && lines[hdr].trim().startsWith('//')) hdr++;
  const vals = lines.slice(hdr);
  if (vals.length < 48) return null;
  const v = (p) => { const t = (vals[p] || '').trim(); if (!t || t.startsWith('/') || t.startsWith('<')) return null; return isNaN(parseFloat(t)) ? null : t; };
  const o = {};
  const set = (k, nm, p, b, u) => { const val = v(p); if (val === null) return; const e = { name: nm, value:val, boolean: b ? '1' : '0' }; if (u) e.unit = u; o[k] = e; };
  set('Quantization', 'Quantization', 2, false, 'ms'); set('Time_res', 'Time resolution', 3, false, 'ms');
  set('Improvize', 'Non-stop improvize', 10, true); set('MaxItemsProduce', 'Max items produced', 11, false);
  set('UseEachSub', 'Play each substitution', 12, true); set('AllItems', 'Produce all items', 13, true);
  set('MaxConsoleTime', 'Max computation time', 44, false, 'seconds'); set('Seed', 'Seed for randomization', 45, false);
  o.NoteConvention = { name: 'Note convention', value:conv, boolean: '0' };
  return o;
}

/**
 * LES ENTRÉES ÉPHÉMÈRES, ET LEUR SOURCE — pour que la commande gravée SE REJOUE.
 *
 * ⛔ CE BANC GRAVAIT UNE COMMANDE QUI NE POUVAIT PAS SE REJOUER, et elle passait pour qualifiée :
 * elle citait `/tmp/_ord_<nom>_se.json` et un `-gr` temporaire, deux fichiers que ce banc fabrique
 * puis efface. Les trois champs étaient écrits, aucun n'était nul, et personne n'aurait pu
 * reproduire la mesure. C'est le cousin du défaut payé par bp3-frontend le 2026-08-11 — là un
 * champ vide, ici un chemin mort : dans les deux cas la condition a l'apparence d'une condition.
 *
 * On mémorise donc, pour chaque dérivé, le fichier SOURCE et ce qu'on lui a fait. La commande
 * gravée cite les sources ; les transformations sont déclarées à côté, jamais sous-entendues.
 */
const derives = new Map();

function buildEngineArgs(name, prodFile, { allowExcluded = false } = {}) {
  // gd peut être ABSENT de grammars.json (ex. Ruwet, Visser3/5 pour l'oracle single-play,
  // item ORACLE-SINGLEPLAY-RECONCILE) : on construit alors les args depuis le seul -gr,
  // les auxiliaires (-se/-al) étant inférés du CORPS de la grammaire (fallbacks plus bas).
  const gd = GRAMMARS[name] || null;
  if (gd && gd.status === 'excluded' && !allowExcluded) return null;
  const grName = (gd && gd.bernard) || name;
  const grFile = path.join(TD, `-gr.${grName}`);
  if (!fs.existsSync(grFile)) return null;

  // Normalisation des fins de ligne : certaines grammaires (ex. transposition3,
  // 1997) sont en CR Mac → sans normalisation, le moteur voit toute la grammaire
  // comme UNE ligne commentée (`//`) et ne produit rien. On écrit donc un temp
  // NORMALISÉ, mais DANS test-data, pour que les auxiliaires embarqués (-ho/-al)
  // se résolvent relativement à ce dossier (sinon ils sont introuvables).
  let gr = fs.readFileSync(grFile, 'utf8').replace(/\r\n?/g, '\n');
  const grNoC = gr.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // CONVENTION DE NOTES — DÉCLARÉE d'abord, reniflée seulement à défaut.
  //
  // On la devinait en cherchant `sa`/`ga` puis `do|re|mi…` dans le corps. L'heuristique
  // tient sur la plupart des grammaires et se trompe précisément là où ça compte : une
  // grammaire indienne portant `re4` est classée FRANÇAISE, alors que le natif avale `re`
  // comme degré indien et effondre sa production (bp3-engine, baseline v12 : `bells` rend
  // 4 jetons en indian contre 16 en français). Deviner une convention qui CHANGE LA SORTIE
  // est un pari, pas une mesure.
  // La convention se déclare donc dans `grammars.json` (`note_convention`), et le reniflage
  // ne sert plus que de défaut pour les grammaires qui ne la déclarent pas.
  const DECLAREE = { french: '1', indian: '2', english: '0', keys: '0' };
  const declaree = (GRAMMARS[name] || {}).note_convention;
  if (declaree !== undefined && DECLAREE[declaree] === undefined) {
    throw new Error(`grammars.json ${name}.note_convention = "${declaree}" inconnue (attendu : ${Object.keys(DECLAREE).join(', ')})`);
  }
  const hasIndian = declaree ? declaree === 'indian' : /\b(sa|ga)\d\b/.test(grNoC);
  const hasFrench = declaree ? declaree === 'french' : /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoC);
  const conv = declaree ? DECLAREE[declaree] : (hasIndian ? '2' : hasFrench ? '1' : '0');

  const tmpGr = path.join(TD, `_ord_tmp_${name}.gr`);
  fs.writeFileSync(tmpGr, gr);
  derives.set(tmpGr, { source: grFile, transformations: ['fins de ligne normalisées en LF'] });
  const args = ['produce', '-e', '-gr', tmpGr, '--seed', '1'];
  if (hasIndian) args.push('--indian'); else if (hasFrench) args.push('--french');

  // -se / -al / -to depuis s1_args ou inférés
  const explicit = new Set();
  const pushSettings = (file) => {
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, 'utf8').trim();
    let obj = raw.startsWith('{') ? JSON.parse(raw) : convertOldSettings(raw, conv);
    if (!obj) return;
    obj.ShowGraphic = { name: 'Show graphic', value:'0' };
    obj.DisplayItems = { name: 'Display final score', value:'1', boolean: '1' };
    for (const [k, val] of Object.entries(gd?.se_overrides || {})) { if (k === '_comment') continue; if (obj[k]) obj[k].value = String(val); else obj[k] = { name: k, value:String(val) }; }
    const tmpSe = path.join('/tmp', `_ord_${name}_se.json`);
    fs.writeFileSync(tmpSe, JSON.stringify(obj));
    args.push('-se', tmpSe);
    // La commande gravée doit citer la SOURCE, pas le dérivé éphémère : cf. `derives`.
    derives.set(tmpSe, {
      source: file,
      transformations: [
        raw.startsWith('{') ? 'lu tel quel (JSON)' : `converti depuis le format BP2 positionnel (convention ${conv})`,
        'ShowGraphic=0', 'DisplayItems=1',
        ...Object.entries(gd?.se_overrides || {}).filter(([k]) => k !== '_comment').map(([k, v]) => `${k}=${v} (se_overrides du catalogue)`),
      ],
    });
  };
  if (gd?.s1_args) {
    // s1_args = paires (drapeau, fichier). En BP3 les fichiers AUX commencent
    // aussi par `-` (ex. -so.abc) : un drapeau simple `-x` consomme TOUJOURS
    // l'élément suivant comme fichier. Seuls les `--xxx` sont des drapeaux nus.
    for (let i = 0; i < gd.s1_args.length; i++) {
      const a = gd.s1_args[i];
      if (a.startsWith('--')) { args.push(a); continue; }
      if (a.startsWith('-')) {
        explicit.add(a);
        if (i + 1 < gd.s1_args.length) {
          const f = gd.s1_args[++i];
          const r = f.startsWith('/') ? f : path.join(TD, f);
          if (a === '-se') pushSettings(r); else args.push(a, r);
        } else args.push(a);
      } else args.push(a);
    }
  }
  if (!explicit.has('-se') && gd?.php_ref?.settings) { const m = gd.php_ref?.settings.match(/-se\.(\S+)/); if (m) pushSettings(path.join(TD, `-se.${m[1]}`)); }
  // Repli (aligné s3_native.cjs, gap découvert en [435]) : réglages/alphabet référencés
  // dans le CORPS de la grammaire — beaucoup de clés to_be_tested n'ont ni s1_args ni
  // php_ref.settings alors que le -se. existe dans test-data.
  if (!explicit.has('-se') && !args.includes('-se')) { const m = gr.match(/-se\.(\S+)/); if (m) pushSettings(path.join(TD, `-se.${m[1]}`)); }
  // ⛔ L'ALPHABET DÉCLARÉ SE PASSE QUEL QUE SOIT SON PRÉFIXE — le motif ne retenait que `-al.` et
  // laissait tomber en silence les alphabets nommés `-ho.` (`dhin1` déclare `-ho.dhin--`).
  // MESURÉ le 2026-08-11 : sans `-al`, dhin1 rend une production VIDE ; avec, 341 octets. Mon banc
  // la comptait donc « non capturable » alors que l'outil de référence du chantier la produisait
  // — 318 octets le matin même. Le fichier était là, le drapeau existait, seul le motif refusait.
  // ⚠️ CE N'EST PAS LE CAS QUE LA NOTE CI-DESSOUS ÉCARTE : elle interdit de passer un `-ho` sous le
  // drapeau `-ho`, ce qui double-charge. Ici le fichier passe sous `-al`, et c'est ce que fait
  // l'outil de référence.
  if (!explicit.has('-al') && gd?.php_ref?.alphabet) {
    const m = gd.php_ref.alphabet.match(/-(?:al|ho)\.\S+/);
    if (m) { const f = path.join(TD, m[0]); if (fs.existsSync(f)) args.push('-al', f); }
  }
  if (!explicit.has('-al') && !args.includes('-al')) {
    const m = gr.match(/-al\.(\S+)/);
    if (m) { const f = path.join(TD, `-al.${m[1]}`); if (fs.existsSync(f)) args.push('-al', f); }
  }
  // NB : le `-ho.X` (homomorphisme) référencé dans le corps est AUTO-RÉSOLU par bp3 depuis le
  // dossier du -gr (TD) — le passer EN PLUS via `-ho` casse les grammaires qui l'auto-chargent
  // déjà (MyMelody, koto3 : double-chargement → « no output »). On ne le passe donc PAS.

  args.push('-o', prodFile);
  return args;
}

// La dernière invocation native, retenue pour l'estampille de l'instantané qu'elle produit.
let derniereCommande = null;
/** Les entrées éphémères de cette invocation, avec leur source et leurs transformations. */
let dernieresEntrees = null;

/**
 * Rend l'estampille REJOUABLE : la commande citant les fichiers SOURCES, et à côté ce qu'on a
 * fait à chacun. Sans ces deux moitiés la commande gravée ne reproduit rien — un `-se` converti
 * n'est pas le `-se` du dépôt, et le taire ferait chercher l'écart dans le moteur.
 */
function conditionsRejouables(commande) {
  if (!commande) return { command: null, entrees: null };
  let rejouable = commande;
  const entrees = [];
  for (const [ephemere, quoi] of derives) {
    if (!commande.includes(ephemere)) continue;
    rejouable = rejouable.split(ephemere).join(quoi.source);
    entrees.push({ passe_au_binaire: ephemere, source: quoi.source, transformations: quoi.transformations });
  }
  return { command: rejouable, entrees: entrees.length ? entrees : null };
}

function nativeOrder(name, opts = {}) {
  const prodFile = path.join('/tmp', `_ord_${name}_prod.txt`);
  try { fs.unlinkSync(prodFile); } catch {}
  const args = buildEngineArgs(name, prodFile, opts);
  if (!args) return { error: 'args' };
  // Sous le garde anti-OOM : la campagne inclut des grammaires à boucle infinie
  // documentée (PP, checkcontext) — plafond mémoire + victime OOM + timeout.
  // La commande est RETENUE TELLE QU'EXÉCUTÉE — la reconstruire ailleurs ferait diverger la trace
  // et ce qui a tourné, et c'est précisément ce que l'estampille doit interdire.
  const commande = `bash "${GUARD}" "${BP3}" ${args.map((a) => `"${a}"`).join(' ')}`;
  derniereCommande = commande;
  dernieresEntrees = null;
  try { execSync(commande, { cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }); } catch {}
  try { fs.unlinkSync(path.join(TD, `_ord_tmp_${name}.gr`)); } catch {} // temp grammaire normalisée
  if (!fs.existsSync(prodFile)) return { error: 'no output' };
  // Garde anti-démesure : une dérivation non terminante (Improvize, livecode2) peut écrire
  // des centaines de Mo avant le timeout — jamais un oracle, et readFileSync exploserait.
  const sz = fs.statSync(prodFile).size;
  if (sz > 50 * 1024 * 1024) { try { fs.unlinkSync(prodFile); } catch {} return { error: `production démesurée (${(sz / 1048576).toFixed(0)} Mo — dérivation non terminante)` }; }
  const canonical = fs.readFileSync(prodFile, 'utf8').trim();
  return { canonical, tokens: tokenizeOrder(canonical) };
}

/**
 * L'ORACLE FIGÉ — `s3_native.json`, la référence NATIVE, et plus le WASM.
 *
 * ⚠️ CE BANC A COMPARÉ LE NATIF AU WASM PENDANT DEUX MOIS APRÈS LA DÉCISION QUI RETIRE LE WASM.
 * `decisions/2026-06-14-oracle-natif-trois-voies.md` écrit qu'il n'est ni moteur ni oracle, et
 * `projets/2026-07-16-iso-100-grammaires/PLAN.md` phase A point 3 porte le geste : repointer les
 * voies sur l'oracle natif ET retirer les étages WASM du harnais. Le pas n'avait jamais été fait
 * ici, et il ne pouvait pas se signaler tout seul : ce fichier n'est appelé ni par
 * `test/run_guards.mjs`, ni par `package.json`, ni par `.githooks/pre-push`. Un outil hors du
 * portillon ne prévient jamais personne — c'est ce qui a laissé le WASM survivre à son retrait.
 *
 * CE QUE LE BANC MESURE DÉSORMAIS : le natif produit à l'instant contre le natif FIGÉ. C'est une
 * non-régression de l'oracle, pas une parité entre deux moteurs. Les deux côtés passent par le
 * MÊME découpage (`tokenizeOrder`), donc un écart désigne la production, jamais la recette.
 */
function oracleFige(name) {
  const p = path.join(__dirname, 'grammars', name, 'snapshots', 's3_native.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  // ⚠️ UN ORACLE `mode:'midi'` N'EST PAS COMPARABLE ICI, ET LE CROIRE FABRIQUE DES ÉCARTS.
  // Mesuré à la première exécution de ce banc rebasculé : tryRotate « DIFF @0 instant='6'
  // figé='E4' », MyMelody « instant='1' figé='mi4' ». Rien n'avait bougé dans le moteur — les
  // deux côtés ne disaient simplement pas la même chose. Un oracle `midi` est pris par
  // `--tokensout` et porte les NOTES SONNANTES ; la voie texte lit `-o` et porte la PRODUCTION
  // CANONIQUE, où les mêmes instants s'écrivent en chiffres et en marqueurs de structure.
  // L'ancien terme de comparaison ne posait pas ce piège : les `s3_timed` étaient tous d'une
  // seule espèce. La bascule sur `s3_native`, elle, tombe sur un corpus MIXTE — 22 pris par
  // `-o`, 33 par `--tokensout`. On refuse donc les seconds au lieu de les comparer de travers :
  // une comparaison entre deux mesures d'espèces différentes rougit toujours, et pour rien.
  if (j.mode === 'midi') return { incomparable: 'oracle midi (--tokensout) — ce banc lit la voie texte' };
  const tokens = j.tokens.map((t) => t[0]);
  return { tokens, mode: j.mode ?? null };
}

// Pose l'oracle natif d'ORDRE texte. Anti-dégénéré : refuse 0 jeton ou majorité de
// noms vides (gamme invalide). Format aligné sur s3_native.cjs (midi) : mode 'text',
// timings nuls (l'ordre EST l'information).
/** Les conditions de l'invocation qui vient d'avoir lieu — pour rafraîchir sans re-capturer. */
function estampilleActuelle() {
  const c = conditionsRejouables(derniereCommande);
  return { ...estampilleNative(c.command), entrees: c.entrees, date: new Date().toISOString().slice(0, 10) };
}

function writeTextOracle(name, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return 'VIDE (non écrit)';
  const empty = tokens.filter((t) => !t || t === '').length;
  if (empty > tokens.length / 2) return `DÉGÉNÉRÉ (${empty}/${tokens.length} noms vides, non écrit)`;
  const newToks = tokens.map((t) => [t, 0, 0]);
  const dir = path.join(__dirname, 'grammars', name, 'snapshots');
  const file = path.join(dir, 's3_native.json');
  // Idempotence : jetons identiques à l'oracle en place → fraîcheur confirmée, pas de
  // réécriture ; un oracle mode:'midi' n'est JAMAIS écrasé par la voie texte.
  if (fs.existsSync(file)) {
    try {
      const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (prev.mode === 'midi') return 'ORACLE MIDI en place (non touché)';
      if (JSON.stringify(prev.tokens) === JSON.stringify(newToks)) {
        // ⛔ L'IDEMPOTENCE PORTAIT SUR LES JETONS ET PAS SUR LES CONDITIONS, et c'est un trou.
        // Un instantané dont la mesure vient d'être CONFIRMÉE sur un binaire neuf continuait de
        // déclarer l'empreinte d'un binaire qui n'existe plus. Il disait donc moins que ce qu'on
        // savait de lui, et un lecteur y aurait lu une référence non revérifiée.
        // MESURÉ le 2026-08-11 : le binaire a été recompilé DEUX FOIS dans la journée sous le même
        // numéro 3.5.1 — b100125b, puis 3a6fa3e7, puis 9081f9a6. Mes dix instantanés qualifiés
        // portaient trois empreintes différentes alors que les 27 comparaisons rendaient 0 écart.
        // On réécrit donc les CONDITIONS quand elles ont bougé, jamais la mesure : c'est
        // exactement l'annotation sans re-capture que la décision du jour autorise.
        const neuf = { ...prev, ...estampilleActuelle() };
        // ⛔ ET LE BLOC QUI DÉCLARE LE TROU S'EN VA QUAND LE TROU EST COMBLÉ. Il dit « aucune
        // autorité, conditions inconnues » : le laisser sur un instantané qui porte désormais son
        // binaire, son empreinte et sa commande ferait mentir le fichier CONTRE lui-même, et un
        // lecteur croirait sur parole la moitié la plus pessimiste. Mon garde l'a attrapé — il
        // exige que le compte des blocs égale le compte des non-qualifiés.
        if (neuf.engineVersion && neuf.engineMd5 && neuf.command) delete neuf.conditions_de_mesure;
        if (JSON.stringify(neuf) === JSON.stringify(prev)) return `inchangé — frais confirmé (${newToks.length} jetons)`;
        fs.writeFileSync(file, JSON.stringify(neuf, null, 2));
        return `mesure inchangée (${newToks.length} jetons) — CONDITIONS rafraîchies (binaire ${neuf.engineMd5?.slice(0, 8)})`;
      }
    } catch { /* illisible → réécrit */ }
  }
  const snap = {
    source: 'native -o (bp3 Linux, production canonique ordonnée)',
    stage: 's3_native',
    mode:'text',
    tokens: newToks,
    date: new Date().toISOString().slice(0, 10),
    ...(() => { const c = conditionsRejouables(derniereCommande);
        dernieresEntrees = c.entrees;
        return { ...estampilleNative(c.command), entrees: c.entrees }; })(),
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  return `écrit (${newToks.length} jetons)`;
}

const argv = process.argv.slice(2);
const DO_WRITE = argv.includes('--write');     // pose s3_native si parité OK
const CAMPAIGN = argv.includes('--campaign');  // ISO-100 A.2b : tout le corpus texte
const FORCE = argv.includes('--force') || CAMPAIGN; // pose le natif même si DIFF (natif fait foi)
const SINGLEPLAY = argv.includes('--singleplay'); // ORACLE-SINGLEPLAY-RECONCILE (item tour [573])
const targets = argv.filter((a) => !a.startsWith('--'));

// ── Mode --singleplay (item ORACLE-SINGLEPLAY-RECONCILE, tour [573]) ────────────
// Émet un oracle single-play UNIFORME (texte RÉSOLU, ordonné, seed 1) pour bp3-frontend :
// natif `bp3 … -o` (machinerie buildEngineArgs : conversion -se, note-convention, alphabet)
// → tokenizeOrder (séquence de jetons SONNANTS incluant les contrôles `_x(args)`). C'est ce que
// bp3-frontend confronte à son « play frontal ». Sortie : test/oracles/singleplay/<name>.json .
// Fonctionne AUSSI pour les grammaires absentes de grammars.json (Ruwet, Visser3/5) — buildEngineArgs
// infère les auxiliaires depuis le -gr. `allowExcluded` pour ne bloquer sur aucun statut.
if (SINGLEPLAY) {
  const OUT = path.join(__dirname, 'oracles', 'singleplay');
  fs.mkdirSync(OUT, { recursive: true });
  const list = targets.length ? targets
    : ['MyMelody', 'doeslittle', 'simpletemplates', 'Ruwet', 'koto3', 'Visser3', 'Visser5'];
  console.log(`=== Oracle single-play (natif -o RÉSOLU, seed 1) → test/oracles/singleplay/ ===\n`);
  let ok = 0, ko = 0;
  for (const name of list) {
    const nat = nativeOrder(name, { allowExcluded: true });
    if (nat.error || !Array.isArray(nat.tokens) || nat.tokens.length === 0) {
      console.log(`  ${name}: ÉCHEC natif (${nat.error || '0 jeton'}) — pas d'oracle`); ko++; continue;
    }
    const snap = {
      name,
      source: 'native bp3 -o (single-play résolu, seed 1) → tokenizeOrder',
      mode:'text-singleplay',
      seed: 1,
      count: nat.tokens.length,
      tokens: nat.tokens,
      ...(() => { const c = conditionsRejouables(derniereCommande);
        dernieresEntrees = c.entrees;
        return { ...estampilleNative(c.command), entrees: c.entrees }; })(),
    };
    const file = path.join(OUT, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(snap, null, 2));
    console.log(`  ${name}: ${nat.tokens.length} jetons → oracles/singleplay/${name}.json`);
    ok++;
  }
  console.log(`\n${ok} oracle(s) émis / ${ko} en échec sur ${list.length}`);
  process.exit(ko && ok === 0 ? 1 : 0);
}

// Hors campagne texte : #52 look-and-say (build natif faux, décision 2026-06-14 §MAJ) ;
// famille AllItems = divergence de CONTENU (octave C5/C4) renvoyée à BPx (résorption §2.B).
const EXCLUDE_TEXT = new Set(['look-and-say', 'all-items', 'all-items1', 'tryAllItems0', 'tryAllItems1', 'templates']);

const names = CAMPAIGN
  ? Object.entries(GRAMMARS)
      .filter(([k, v]) => k !== '_comment'
        && (v.production_mode || 'midi') === 'text'
        && fs.existsSync(path.join(TD, `-gr.${v.bernard || k}`)))
      .map(([k]) => k)
  : targets.length ? targets : parDefaut();

/**
 * L'ASSIETTE PAR DÉFAUT — TOUT CE QUI PORTE UN ORACLE FIGÉ EN MODE TEXTE.
 *
 * ⛔ ELLE VALAIT TROIS NOMS ÉCRITS EN DUR, ET C'EST COMME ÇA QUE LE WASM A SURVÉCU DEUX MOIS À LA
 * DÉCISION QUI LE RETIRAIT. Ce banc tourne bien à chaque portillon — `run_guards.mjs` balaie le
 * dossier — mais sans argument il n'examinait que `flags`, `negative-context` et `ek-do-tin`. Les
 * trois étaient d'accord avec le WASM, donc il passait au vert en mesurant 6 % de ce qu'il pouvait.
 * Un garde au portillon avec une assiette minuscule trompe PLUS qu'un outil hors portillon : celui
 * -là ne se donne pas pour un verdict.
 *
 * ⚠️ ET LE COÛT NE JUSTIFIAIT RIEN : mesuré le 2026-08-11, les 27 oracles texte passent en 1,4
 * seconde. Le choix de trois n'avait aucun motif écrit, et aucun motif mesuré.
 *
 * LA RÈGLE EST DÉSORMAIS UNE PROPRIÉTÉ, PAS UNE LISTE : si une grammaire porte un oracle figé en
 * mode texte, elle est comparable — sinon cet oracle ne sert à rien. L'assiette suit donc les
 * captures, et un oracle neuf entre dans le banc le jour où il est posé, sans qu'on pense à
 * l'inscrire. `allowExcluded` : un statut `excluded` empêche de CAPTURER en campagne, il n'a
 * jamais voulu dire qu'on renonce à comparer ce qui est déjà capturé (`PP`, `dhin`).
 */
function parDefaut() {
  const base = path.join(__dirname, 'grammars');
  const noms = [];
  for (const d of fs.readdirSync(base)) {
    const f = path.join(base, d, 'snapshots', 's3_native.json');
    if (!fs.existsSync(f)) continue;
    try { if (JSON.parse(fs.readFileSync(f, 'utf8')).mode === 'text') noms.push(d); }
    catch { /* illisible : c'est le garde des instantanés qui le dit, pas ce banc */ }
  }
  return noms.sort();
}

// ⚠️ SOCLE — REFUSER DE CONCLURE SUR ZÉRO. En mode campagne, la liste est CONSTRUITE en filtrant
// sur l'existence des fichiers natifs : si l'arborescence disparaît, `names` est VIDE et le verdict
// tombe à « 0 OK / 0 DIFF sur 0 » avec une sortie de succès. C'est la famille fermée le 2026-07-27
// dans les autres gardes (`exigerCorpus` ne vérifiait que l'existence des dossiers) — celle-ci y a
// échappé parce que ce MODE n'était pas dans le balayage. Hors portillon ne veut pas dire inoffensif :
// ça veut dire INVISIBLE, elle ne rougira jamais pour prévenir, et qui lancera ce mode sur une
// arborescence absente lira un succès.
if (names.length === 0) {
  console.error(`\n[order_parity] AUCUNE grammaire à examiner${CAMPAIGN ? ' (mode campagne : la liste est construite en filtrant sur l\'existence des fichiers natifs — l\'arborescence est-elle là ?)' : ''}. `
    + `Un verdict sur zéro grammaire n'est pas un verdict.`);
  process.exit(1);
}

let pass = 0, fail = 0, horsVoie = 0, sansOracle = 0;
console.log(`=== Non-régression d'ORDRE (natif -o à l'instant  vs  oracle natif figé, tokeniseur partagé)${DO_WRITE ? '  [--write]' : ''}${FORCE ? '  [--force natif fait foi]' : ''} ===\n`);
for (const name of names) {
  if (CAMPAIGN && EXCLUDE_TEXT.has(name)) { console.log(`  ${name}: EXCLU (${name === 'look-and-say' ? '#52 build natif faux' : 'famille AllItems, renvoyée BPx'})`); continue; }
  // Un oracle figé vaut jugement de mesurabilité : on compare même une clé `excluded`.
  const nat = nativeOrder(name, { allowExcluded: true });
  const fige = oracleFige(name);
  if (nat.error) { console.log(`  ${name}: ÉCHEC natif (${nat.error})`); fail++; continue; }
  const a = nat.tokens;
  if (!fige) {
    if (DO_WRITE && FORCE) console.log(`  ${name}: pas d'oracle figé → ${writeTextOracle(name, a)}`);
    // ⚠️ UNE ABSENCE N'EST PAS UN ÉCART, et les confondre gonfle le compte de rouge : la
    // première campagne rebasculée affichait « 24 DIFF » dont 22 étaient des oracles MANQUANTS
    // et 2 seulement de vrais écarts. Un chiffre qui mélange les deux fait chercher une
    // régression là où il n'y a qu'un trou de corpus.
    else { console.log(`  ${name}: pas d'oracle figé`); sansOracle++; }
    continue;
  }
  // Ni OK ni DIFF : la question ne se pose pas. Compté à part, jamais silencieux — un cas
  // écarté qui ne s'affiche pas se lit comme un cas passé.
  if (fige.incomparable) { console.log(`  ${name}: HORS VOIE — ${fige.incomparable}`); horsVoie++; continue; }
  const b = fige.tokens;
  let diff = -1;
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) { if (a[i] !== b[i]) { diff = i; break; } }
  if (diff === -1) {
    const w = DO_WRITE ? ` → ${writeTextOracle(name, a)}` : '';
    console.log(`  ${name}: OK — ${a.length} jetons, ordre identique${w}`); pass++;
  } else {
    if (DO_WRITE && FORCE) { console.log(`  ${name}: DIFF @${diff} instant=${JSON.stringify(a[diff])} figé=${JSON.stringify(b[diff])} (len ${a.length}/${b.length}) — natif fait foi → ${writeTextOracle(name, a)}`); }
    else { console.log(`  ${name}: DIFF @${diff} — instant=${JSON.stringify(a[diff])} figé=${JSON.stringify(b[diff])} (len instant=${a.length} figé=${b.length}${fige.mode ? `, oracle ${fige.mode}` : ''})`); fail++; }
  }
}
console.log(`\n${pass} OK / ${fail} ÉCART / ${sansOracle} SANS ORACLE / ${horsVoie} HORS VOIE (oracle midi) sur ${names.length} grammaire(s) EXAMINÉE(S)`);
process.exit(fail ? 1 : 0);
