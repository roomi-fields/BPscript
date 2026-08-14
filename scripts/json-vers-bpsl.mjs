#!/usr/bin/env node
/**
 * CONVERTIT UNE LIBRAIRIE DE CONTRÔLES DE JSON VERS BPSCRIPT.
 *
 * La demande de Romain : « je veux que ton interpréteur interprète le contenu des librairies de la
 * même façon qu'il interprète le contenu des scènes ». Le vocabulaire se dit donc dans le langage
 * qu'il sert ; les CATALOGUES DE DONNÉES (alphabets, gammes, tempéraments) restent en JSON, parce
 * que ce sont des données et non du vocabulaire.
 *
 * ⚠️ CE SCRIPT N'EST PAS UN LECTEUR DE LIBRAIRIE — il n'en existe qu'un, le transpileur. Il ÉCRIT
 * une source `.bps` ; c'est `libs-bundle.js` qui la relit, avec le compilateur et lui seul. La
 * preuve de la conversion n'est pas ce que ce script croit avoir écrit, c'est l'ÉGALITÉ du bundle
 * avant et après.
 *
 * ⛔ CE QU'IL REFUSE PLUTÔT QUE DE L'APPROXIMER : une valeur qu'il ne sait pas rendre fidèlement
 * (objet imbriqué dans un contrôle, partie contenant une espace dans une liste). Il s'arrête et la
 * nomme. Une conversion qui « passe » en perdant une valeur est le pire résultat possible : les
 * consommateurs lisent le bundle, et une valeur muette ne casse rien avant longtemps.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CLES_LISTES = new Set(['args', 'values', 'scope', 'range']);
const CHAMPS_DE_FICHIER = new Set(['resolvedBy', 'resolves', 'name', 'description', 'version', 'type']);

/** Une valeur simple se rend nue ; une phrase passe par le backtick typé. */
function rendValeur(cle, v, ou) {
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    for (const p of v) {
      if (typeof p === 'object' && p !== null) throw new Error(`${ou}.${cle} : liste d'OBJETS, non rendue`);
      if (String(p).includes(' ')) throw new Error(`${ou}.${cle} : la partie « ${p} » contient une espace`);
    }
    return v.map(String).join(' ');
  }
  if (typeof v === 'object' && v !== null) throw new Error(`${ou}.${cle} : objet imbriqué, non rendu`);
  const s = String(v);
  // ⚠️ LE BACKTICK TYPÉ EST OBLIGATOIRE DÈS QU'IL Y A UNE ESPACE — sans lui, la valeur se
  // découperait en PARTIES et une description deviendrait une liste de mots.
  if (s === '' || /[\s`]/.test(s) || CLES_LISTES.has(cle)) {
    if (s.includes('`')) throw new Error(`${ou}.${cle} : la valeur contient un backtick`);
    return `\`txt: ${s}\``;
  }
  return s;
}

/** Un champ de prose `_xxx_doc` devient un COMMENTAIRE : il ne voyage plus jusqu'aux consommateurs. */
function enCommentaire(texte, largeur = 96) {
  const mots = String(texte).replace(/\s+/g, ' ').trim().split(' ');
  const lignes = []; let cur = '//';
  for (const m of mots) {
    if ((cur + ' ' + m).length > largeur) { lignes.push(cur); cur = '//'; }
    cur += ' ' + m;
  }
  if (cur !== '//') lignes.push(cur);
  return lignes;
}

export function convertir(nom, j) {
  const out = [];
  const refus = [];
  out.push(`// LA LIBRAIRIE « ${nom} » — écrite dans le langage qu'elle sert.`);
  out.push('// Convertie depuis le JSON : le bundle en rend la MÊME donnée, les consommateurs ne');
  out.push("// voient aucun changement. C'est l'AUTHORING qui change, pas la donnée.");
  out.push('//');
  out.push('// ⚠️ LA DOCUMENTATION EST UN COMMENTAIRE, plus une clé `_xxx_doc` dans la donnée : un');
  out.push('//    commentaire ne voyage pas jusqu\'aux consommateurs, une clé si.');
  out.push('');

  // ── LA PROSE DU FICHIER, EN TÊTE ──
  for (const [k, v] of Object.entries(j)) {
    if (!k.startsWith('_') || typeof v !== 'string') continue;
    out.push(`// ${k.replace(/^_|_doc$/g, '').toUpperCase().replace(/_/g, ' ')}`);
    out.push(...enCommentaire(v));
    out.push('');
  }

  // ── LE BLOC DU FICHIER ──
  out.push(`@def ${nom}`);
  for (const c of CHAMPS_DE_FICHIER) {
    if (j[c] === undefined) continue;
    try { out.push(`  ${c}:${rendValeur(c, j[c], nom)}`); } catch (e) { refus.push(e.message); }
  }
  out.push('');

  // ── UN BLOC PAR CONTRÔLE ──
  for (const [nomC, def] of Object.entries(j.controls || {})) {
    if (typeof def !== 'object' || def === null) { out.push(...enCommentaire(`${nomC} : ${def}`), ''); continue; }
    for (const [k, v] of Object.entries(def)) {
      if (k.startsWith('_') && typeof v === 'string') out.push(...enCommentaire(`${nomC} · ${v}`));
    }
    out.push(`@def ${nomC}`);
    for (const [k, v] of Object.entries(def)) {
      if (k.startsWith('_')) continue;
      // Une liste VIDE s'écrit en n'écrivant pas la clé — le bundle la rétablit (cf. libs-bundle.js).
      if (Array.isArray(v) && v.length === 0) continue;
      try { out.push(`  ${k}:${rendValeur(k, v, nomC)}`); } catch (e) { refus.push(e.message); }
    }
    out.push('');
  }
  return { texte: out.join('\n'), refus };
}

const cible = process.argv[2];
if (cible) {
  const j = JSON.parse(readFileSync(`lib/${cible}.json`, 'utf-8'));
  const { texte, refus } = convertir(cible, j);
  if (refus.length) {
    console.error(`⛔ ${cible} : ${refus.length} valeur(s) non rendue(s) — rien n'est écrit.`);
    for (const r of refus) console.error(`   - ${r}`);
    process.exit(1);
  }
  writeFileSync(`lib/${cible}.bpsl`, texte + '\n');
  console.log(`✅ lib/${cible}.bpsl écrit (${Object.keys(j.controls || {}).length} contrôles)`);
}
