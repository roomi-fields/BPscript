#!/usr/bin/env node
/**
 * METTRE EN FORME LES LIBRAIRIES — la source dit ce qui EST, la note dit pourquoi.
 *
 * Romain, 2026-09-03 : « j'aimerai que les librairies soient nettoyées de tous les commentaires
 * techniques. Si tu en as besoin tu les mets à côté dans des fichiers de note relatifs à chaque
 * librairie, et que tu fasses une indentation humainement lisible ».
 *
 * ⇒ CE QUE L'OUTIL FAIT, sur chaque `lib/*.bpsl` :
 *   · il DÉPLACE les commentaires dans `lib/notes/<nom>.md`, ancrés sur la déclaration qu'ils
 *     précédaient — rien n'est perdu, tout devient lisible d'un seul côté ;
 *   · il REPLIE les déclarations trop larges : une paire de premier niveau par ligne, indentée,
 *     et le sac imbriqué se replie à son tour quand il reste trop large ;
 *   · il GARDE `// @documented`, qui n'est pas un commentaire mais une MARQUE que le compilateur
 *     lit — la retirer changerait la donnée publiée.
 *
 * ⛔ LE PLI NE CHANGE RIEN À LA DONNÉE, et c'est prouvé ailleurs : `test/une_declaration_se_plie_
 * sur_plusieurs_lignes.mjs` mesure la même donnée pour cinq positions de pli, sac imbriqué compris.
 * Ici, la preuve est le témoin d'égalité du bundle, qui compare la donnée avant/après.
 *
 * ⚠️ IL RESPECTE LES CHAÎNES. Une description porte des virgules, des parenthèses et parfois `//` ;
 * découper sur ces signes sans suivre les guillemets couperait une phrase en deux membres.
 *
 * `--verifier` ne récrit rien et rend 1 si un fichier n'est pas en forme — c'est ce mode que le
 * portillon appelle.
 */
import fs from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(new URL('..', import.meta.url).pathname);
const LIB = path.join(RACINE, 'lib');
const NOTES = path.join(LIB, 'notes');
const LARGEUR = 100;          // au-delà, la déclaration se replie
const MARQUES = ['@documented'];   // ce qu'un commentaire porte de DONNÉE, jamais déplacé

/** Découpe une ligne en [code, commentaire] en suivant les guillemets. */
export function separerCommentaire(ligne) {
  let dansChaine = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') dansChaine = !dansChaine;
    else if (!dansChaine && c === '/' && ligne[i + 1] === '/') {
      return [ligne.slice(0, i).replace(/\s+$/, ''), ligne.slice(i)];
    }
  }
  return [ligne, ''];
}

/** Les membres de premier niveau d'un sac, virgules hors chaînes et hors parenthèses imbriquées. */
export function membresDuSac(corps) {
  const out = [];
  let profondeur = 0, dansChaine = false, debut = 0;
  for (let i = 0; i < corps.length; i++) {
    const c = corps[i];
    if (c === '"') dansChaine = !dansChaine;
    else if (!dansChaine && (c === '(' || c === '[')) profondeur++;
    else if (!dansChaine && (c === ')' || c === ']')) profondeur--;
    else if (!dansChaine && c === ',' && profondeur === 0) {
      out.push(corps.slice(debut, i).trim());
      debut = i + 1;
    }
  }
  const dernier = corps.slice(debut).trim();
  if (dernier) out.push(dernier);
  return out;
}

/** Replie une déclaration : une paire par ligne dès qu'elle dépasse la largeur. */
export function replier(ligne, indent = 0) {
  const marge = ' '.repeat(indent);
  if (ligne.length <= LARGEUR) return [marge + ligne.trim()];
  // La tête va jusqu'à la parenthèse ouvrante de premier niveau ; le reste est le sac.
  let dansChaine = false, ouvre = -1;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') dansChaine = !dansChaine;
    else if (!dansChaine && c === '(') { ouvre = i; break; }
  }
  if (ouvre < 0 || !ligne.trimEnd().endsWith(')')) return [marge + ligne.trim()];
  // ⛔ LE COLLAGE EST DU SENS, PAS DE LA MISE EN FORME. « espace sépare deux termes ; leur COLLAGE
  //   les réunit en un seul » — écrire `diapason (` au lieu de `diapason(` fait deux termes d'un
  //   seul, et le compilateur le refuse en nommant la virgule. Mesuré sur SIX librairies d'un coup.
  //   Ce qui séparait la tête de sa parenthèse est donc reproduit tel quel.
  const tete = ligne.slice(0, ouvre).trim();
  const colle = ouvre > 0 && !/\s/.test(ligne[ouvre - 1]);
  const corps = ligne.slice(ouvre + 1, ligne.lastIndexOf(')'));
  const membres = membresDuSac(corps);
  // ⚠️ UN MEMBRE UNIQUE SE REPLIE AUSSI quand il est lui-même un sac : `def values (diapason(…))`
  //   n'a qu'un membre et faisait 829 colonnes — la borne « au moins deux membres » le laissait
  //   passer entier. Ce qui décide est la LARGEUR, jamais le nombre.
  if (!membres.length) return [marge + ligne.trim()];
  if (membres.length === 1 && !membres[0].includes('(')) return [marge + ligne.trim()];
  const out = [`${marge}${tete}${colle ? '' : ' '}(`];
  membres.forEach((m, i) => {
    const virgule = i < membres.length - 1 ? ',' : '';
    const pose = `${marge}  ${m}${virgule}`;
    if (pose.length <= LARGEUR || !m.includes('(')) out.push(pose);
    else {
      // Un membre encore trop large est un sac : on le replie à son tour.
      const sous = replier(m, indent + 2);
      if (sous.length === 1) out.push(pose);
      else { sous[sous.length - 1] += virgule; out.push(...sous); }
    }
  });
  out.push(`${marge})`);
  return out;
}

/**
 * DÉPLIER D'ABORD, REPLIER ENSUITE — sans quoi l'outil n'est pas idempotent.
 *
 * ⛔ MESURÉ : appliqué deux fois, il perdait l'indentation qu'il venait de poser. Sa lecture était
 * LIGNE À LIGNE, donc une déclaration déjà pliée arrivait en quatorze lignes indépendantes, chacune
 * trop courte pour être repliée et réécrite à la marge zéro. Une mise en forme qui ne part pas d'une
 * forme CANONIQUE ne converge pas : elle oscille entre deux états, et le mode `--verifier` rougit
 * pour toujours.
 */
export function deplier(lignes) {
  const out = [];
  let accumule = null, profondeur = 0;
  for (const brute of lignes) {
    const [code] = separerCommentaire(brute);
    if (accumule === null && !code.trim()) { out.push(brute); continue; }
    let dansChaine = false;
    for (const c of code) {
      if (c === '"') dansChaine = !dansChaine;
      else if (!dansChaine && (c === '(' || c === '[')) profondeur++;
      else if (!dansChaine && (c === ')' || c === ']')) profondeur--;
    }
    // ⚠️ LE COMMENTAIRE D'UNE LIGNE PLIÉE REMONTE AVANT la déclaration : joindre le texte le
    //   ferait entrer au milieu du code, où il avalerait la fin de la ligne.
    const [, commentaire] = separerCommentaire(brute);
    if (accumule === null) {
      if (profondeur > 0) { accumule = code.trimEnd(); if (commentaire) out.push(`// ${commentaire.replace(/^\/\/\s?/, '')}`); }
      else out.push(brute);
    } else {
      if (commentaire) out.push(`// ${commentaire.replace(/^\/\/\s?/, '')}`);
      accumule += (accumule.endsWith('(') || accumule.endsWith('[') || !code.trim() ? '' : ' ') + code.trim();
      if (profondeur <= 0) { out.push(accumule); accumule = null; profondeur = 0; }
    }
  }
  if (accumule !== null) out.push(accumule);
  return out;
}

/** Rend { source, note } pour un fichier de librairie. */
export function mettreEnForme(texte, nom) {
  const lignes = deplier(texte.split('\n'));
  const sortie = [];
  const note = [];
  let enAttente = [];        // commentaires vus, en attente de la déclaration qu'ils annoncent
  let marques = [];

  const viderVersLaNote = (ancre) => {
    if (!enAttente.length) return;
    note.push(ancre ? `## ${ancre}` : '## En-tête');
    note.push('');
    for (const l of enAttente) note.push(l);
    note.push('');
    enAttente = [];
  };

  for (const brute of lignes) {
    let [code, commentaire] = separerCommentaire(brute);
    if (commentaire) {
      const nu = commentaire.replace(/^\/\/\s?/, '').trimEnd();
      if (MARQUES.some((m) => commentaire.includes(m))) marques.push(commentaire.trim());
      else if (nu) enAttente.push(nu);
      else if (enAttente.length) enAttente.push('');
    }
    if (!code.trim()) { if (!commentaire) sortie.push(''); continue; }
    // ⛔ L'ESPACE ENTRE UN MOT DÉCLARÉ ET SON SAC EST INTERDITE — Romain, 2026-09-03. Le COLLAGE
    // réunit deux termes, l'espace les sépare : `control transpose (rank:3)` faisait donc deux termes
    // d'un objet et de son sac. La règle valait déjà À L'INTÉRIEUR d'un sac, où le compilateur
    // refusait `diapason (…)` ; elle vaut maintenant partout.
    // ⚠️ UN NOM DÉCLARÉ PEUT COMMENCER PAR UN CHIFFRE — `temperament 12TET(…)`, `tuning 31EDO(…)`.
    //   La première écriture exigeait une lettre en tête et laissait 174 tempéraments espacés ; c'est
    //   le refus du parseur qui les a trouvés, pas cet outil.
    code = code.replace(/^(\s*(?:def\s+)?[A-Za-z_][\w-]*(?:\s+[\w][\w-]*)?)\s+\(/, '$1(');
    // Les commentaires accumulés s'ancrent sur cette ligne — mais SEULEMENT si c'est une DÉCLARATION.
    // ⚠️ Une ligne d'invocation (`expression`, seule) n'est pas un sujet : ancrer l'en-tête du fichier
    // dessus faisait titrer la note « ## expression » là où elle parle de la librairie entière.
    const declare = code.match(/^\s*(?:def|[a-z_]+)\s+([A-Za-z_][\w-]*)\(/);
    viderVersLaNote(declare ? declare[1] : null);
    for (const m of marques) sortie.push(m);
    marques = [];
    sortie.push(...replier(code));
  }
  viderVersLaNote(null);

  // Deux lignes vides de suite n'apportent rien ; une seule sépare. Et un fichier ne commence pas
  // par du vide : les commentaires d'en-tête partis, la source ouvrait sur une ligne blanche.
  const propre = [];
  for (const l of sortie) {
    if (l === '' && (propre.length === 0 || propre[propre.length - 1] === '')) continue;
    propre.push(l);
  }
  while (propre.length && propre[propre.length - 1] === '') propre.pop();

  const enTete = [
    `# Notes — librairie \`${nom}\``,
    '',
    `Ce que \`lib/${nom}.bpsl\` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la`,
    'borne d\'une mesure. La source porte ce qui EST, cette note porte le reste.',
    '',
  ];
  return {
    source: propre.join('\n') + '\n',
    note: note.length ? enTete.concat(note).join('\n').replace(/\n{3,}/g, '\n\n') + '\n' : null,
  };
}

// ── exécution ────────────────────────────────────────────────────────────────────────────────
const verifier = process.argv.includes('--verifier');
const fichiers = fs.readdirSync(LIB).filter((f) => f.endsWith('.bpsl')).sort();
if (!fichiers.length) { console.error('⛔ aucune librairie lue — refus d\'avoir examiné zéro'); process.exit(1); }
if (!verifier) fs.mkdirSync(NOTES, { recursive: true });

let horsForme = 0, ecrits = 0;
for (const f of fichiers) {
  const nom = f.replace(/\.bpsl$/, '');
  const avant = fs.readFileSync(path.join(LIB, f), 'utf8');
  const { source, note } = mettreEnForme(avant, nom);
  const cible = path.join(NOTES, `${nom}.md`);
  const noteAvant = fs.existsSync(cible) ? fs.readFileSync(cible, 'utf8') : null;
  // ⛔ L'IDEMPOTENCE SE JUGE SUR LA SOURCE SEULE. Une fois les commentaires déplacés, la source
  //   n'en porte plus, donc l'outil ne RECONSTRUIT plus de note : comparer une note vide à la note
  //   déjà écrite déclarait le fichier hors forme à chaque passage, et `--verifier` rougissait
  //   éternellement. Une note n'est comparée que si la source en porte encore la matière.
  const change = source !== avant || (note !== null && note !== noteAvant);
  if (verifier) {
    if (change) { horsForme++; console.error(`✗ ${f} n'est pas en forme`); }
    continue;
  }
  if (source !== avant) { fs.writeFileSync(path.join(LIB, f), source); ecrits++; }
  if (note && note !== noteAvant) fs.writeFileSync(cible, note);
}

if (verifier) {
  if (horsForme) {
    console.error(`⛔ ${horsForme} librairie(s) hors forme sur ${fichiers.length} — `
      + 'lancer `node scripts/mettre-en-forme-les-librairies.mjs`');
    process.exit(1);
  }
  console.log(`✓ ${fichiers.length} librairie(s) en forme — aucun commentaire technique dans la source, `
    + `aucune ligne au-delà de ${LARGEUR} colonnes qui puisse se replier`);
} else {
  console.log(`✓ ${fichiers.length} librairie(s) relues, ${ecrits} récrite(s) — notes dans lib/notes/`);
}
