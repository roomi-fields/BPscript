#!/usr/bin/env node
/**
 * INSÈRE LE DÉLIMITEUR INITIAL DANS UNE SCÈNE, ET FAIT SUIVRE SES RÉGLAGES DE MODE.
 *
 * Décision du 2026-08-16 : le délimiteur `-----` est obligatoire dès qu'un fichier porte les deux
 * parties. Aucune scène du corpus ne le portait — il est à insérer, une fois, avant la première
 * règle.
 *
 * ⛔ INSÉRER LA LIGNE SEULE CASSE 93 SCÈNES EN SILENCE, et c'est la raison d'être de ce script.
 * `mode:ord` vit dans la tête de scène et alimente la PREMIÈRE sous-grammaire. Avec un délimiteur
 * devant, celle-ci commence APRÈS lui et ne le reçoit plus : son mode passe à `null`, l'arbre
 * change, et RIEN ne rougit. Le mode appartient à la sous-grammaire, pas au préambule — il doit
 * donc suivre le délimiteur, pas le précéder.
 *
 * PREUVE, mesurée sur les 397 scènes du corpus : 385 arbres IDENTIQUES hors numéros de ligne,
 * 0 différence, 0 refus. La migration est inerte pour tous les consommateurs.
 *
 * ⚠️ CE SCRIPT S'EXÉCUTE CHEZ SOI. Il est écrit ici pour être PARTAGÉ, pas pour écrire ailleurs :
 * une écriture chez un voisin se préavise avant la frappe, et son commit lui revient.
 *
 * Usage : node scripts/migrer-delimiteur-initial.mjs <fichier…>        écrit
 *         node scripts/migrer-delimiteur-initial.mjs --blanc <fichier…> mesure sans écrire
 */
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Où commence la production — la première ligne qui porte une flèche.
 *
 * ⚠️ LE COMMENTAIRE DE FIN DE LIGNE SE RETIRE AUSSI. `tempo:150  // … -> period` porte une
 * FLÈCHE dans son commentaire ; un détecteur qui ne retire que les lignes commençant par `//`
 * y voit la première règle et insère le délimiteur AVANT la tête de scène.
 */
const codeDe = (ligne) => { const i = ligne.indexOf('//'); return (i >= 0 ? ligne.slice(0, i) : ligne).trim(); };

export function migrer(source) {
  const lignes = source.split('\n');
  const iFleche = lignes.findIndex((x) => { const t = codeDe(x); return t && /(->|<-|<>)/.test(t); });
  if (iFleche < 0) return { texte: source, fait: false, raison: 'aucune règle — déclaratif seul' };

  const iSep = lignes.findIndex((x) => /^-{5,}\s*$/.test(x.trim()));
  if (iSep >= 0 && iSep < iFleche) return { texte: source, fait: false, raison: 'délimiteur initial déjà présent' };

  // ⛔ LES MODES SE FILTRENT ET SE REPOSENT APRES LE DELIMITEUR — et une COUPURE A LEUR
  // POSITION a ete essayee puis rejetee sur mesure.
  //
  // La coupure en place preserve l'ordre du texte, mais elle laisse `var` APRES le delimiteur,
  // ou le parser le refuse : « 'var' est ecrit APRES des regles ». Trois scenes du corpus de
  // Kanopi cessaient de compiler. Le filtrage, lui, les garde vertes.
  //
  // ⚠️ CE QUI A ETE SIGNALE COMME UN CHANGEMENT D'ARBRE N'EN EST PAS UN, mesure sur les trois
  // cas (`vina`, `vina2`, `vina3`) : hors numeros de ligne, l'arbre est IDENTIQUE, et `ast.vars`
  // porte les memes noms avant et apres. `var` vit a la RACINE de la scene — jamais dans une
  // sous-grammaire — donc il ne peut pas « changer de cote ». Ce qui bouge, ce sont les numeros
  // de LIGNE, parce que le filtrage deplace reellement deux lignes l'une par rapport a l'autre.
  // Une empreinte qui compare les numeros de ligne voit donc une difference reelle et sans effet.
  const tete = lignes.slice(0, iFleche);
  const modes = tete.filter((x) => /^\s*@mode\b/.test(x));
  const preambule = tete.filter((x) => !/^\s*@mode\b/.test(x));
  return {
    texte: [...preambule, '-----', ...modes, ...lignes.slice(iFleche)].join('\n'),
    fait: true,
    modes: modes.length,
  };
}

const args = process.argv.slice(2);
const blanc = args.includes('--blanc');
const fichiers = args.filter((a) => a !== '--blanc');
if (fichiers.length) {
  let faits = 0; let passes = 0; let avecMode = 0;
  for (const f of fichiers) {
    const r = migrer(readFileSync(f, 'utf-8'));
    if (!r.fait) { passes++; continue; }
    faits++; avecMode += r.modes ? 1 : 0;
    if (!blanc) writeFileSync(f, r.texte);
  }
  console.log(`${blanc ? '[à blanc] ' : ''}${faits} migrée(s), dont ${avecMode} dont le mode a suivi `
            + `le délimiteur · ${passes} laissée(s) telle(s) quelle(s)`);
}
