/**
 * LES DIAGNOSTICS — UN CODE STABLE, UN TEXTE QUI VIT AILLEURS.
 *
 * ⛔ POURQUOI CE MODULE EXISTE, ET CE SONT DEUX VOISINS QUI L'ONT PAYÉ. Le TEXTE de mes refus était
 * la seule chose à quoi un consommateur pouvait s'accrocher, et il n'était déclaré nulle part :
 *
 *     kanopi   11 bancs sur 939 cassés par ma seule TRADUCTION en anglais — même refus, autre langue
 *     kairos   `pitch-e2e.test.ts` exigeait le mot « introuvable » ; je rends `not found in the
 *              catalog`. Même porte, même cause, même étage : SEULE la phrase avait bougé.
 *
 * ⇒ Formulation de kairos, reprise ici parce qu'elle est juste : *un garde bâti sur la graphie d'un
 *   voisin mesure sa rédaction, jamais son comportement.* Et le canal était invisible à mon relevé
 *   de porte, qui lit des adresses et des noms de fichiers — jamais une phrase.
 *
 * ⇒ DÉCISION DE ROMAIN, 2026-09-04 : « il faut des codes d'erreurs, et aussi sortir le texte du
 *   compilateur, le mettre à côté pour facilement faire des traductions / mises à jour ».
 *
 * ⛔ LE CODE EST LA SURFACE, LE TEXTE NE L'EST PLUS. Un code ne se renomme pas — c'est ce qui le rend
 * opposable. Le texte, lui, doit pouvoir bouger souvent : c'est le but du catalogue, et c'est
 * exactement pourquoi plus personne ne doit s'y accrocher.
 *
 * ⚠️ ET LE TEXTE NE PORTE AUCUNE LOGIQUE. Un message se compose par SUBSTITUTION de trous nommés,
 * jamais par une expression évaluée dans le catalogue : un catalogue traduisible par quelqu'un qui
 * ne lit pas le code ne peut pas contenir de code.
 *
 * ⛔ ET LE CATALOGUE EST UNE SOURCE, JAMAIS UN ARTEFACT GÉNÉRÉ. `libs-data.js` est sorti le même
 * jour pour cette raison exacte : un fichier figé à côté de sa source fait deux autorités, et il
 * faut un garde de fraîcheur pour tenir l'écart. Ici il n'y a rien à régénérer — le fichier de
 * messages EST la donnée, éditée à la main, une langue par fichier.
 */
import { MESSAGES } from './messages/en.js';

/**
 * UN REFUS, TEL QU'IL SORT DE LA PORTE.
 *
 * ⛔ LE `code` EST LA SURFACE, `message` NE L'EST PAS — c'est la règle que ce module entier porte,
 * et elle est ici pour qu'un consommateur la lise dans le TYPE et pas seulement dans la prose. Deux
 * voisins ont bâti sur la phrase et ont cassé sur une traduction.
 *
 * `line` est présente quand la faute se situe ; les champs restants sont ceux que le site de refus
 * a joints — ils varient par code, et c'est pourquoi la forme reste ouverte.
 *
 * @typedef {object} Diagnostic
 * @property {string} code    Identifiant stable du refus. C'est sur lui qu'on s'accroche.
 * @property {string} message Texte composé depuis le catalogue de la langue. Il bouge.
 * @property {number} [line]  Ligne de la source, quand le refus en porte une.
 */

/**
 * Le texte d'un diagnostic, ses trous remplis.
 *
 * ⛔ UN CODE ABSENT DU CATALOGUE LÈVE, IL NE REND PAS UN TEXTE APPROXIMATIF. Rendre le code brut
 * comme message ferait un refus muet qui a l'air d'un refus : le lecteur verrait une chaîne en
 * majuscules et chercherait une cause qui n'existe pas. Un catalogue incomplet est un défaut de
 * construction, et il se voit à la première exécution.
 *
 * ⚠️ ET UN TROU NON REMPLI LÈVE AUSSI. Un `{nom}` laissé tel quel dans un message publié est une
 * phrase qui ment sur ce qu'elle décrit — et elle ne rougit nulle part, parce qu'un message est
 * du texte pour un humain. C'est la forme la plus discrète du défaut : le refus est juste, sa
 * cause est juste, et l'auteur lit un accolade.
 */
export function texteDuDiagnostic(code, params = {}) {
  const gabarit = MESSAGES[code];
  if (typeof gabarit !== 'string') {
    throw new Error(`diagnostic '${code}' absent du catalogue — un refus sans texte n'enseigne rien`);
  }
  const manquants = [];
  const texte = gabarit.replace(/\{(\w+)\}/g, (_, cle) => {
    if (!(cle in params)) { manquants.push(cle); return `{${cle}}`; }
    const v = params[cle];
    return v === null || v === undefined ? '' : String(v);
  });
  if (manquants.length) {
    throw new Error(`diagnostic '${code}' : trou(s) non rempli(s) — ${manquants.join(', ')}`);
  }
  return texte;
}

/**
 * UN DIAGNOSTIC PRÊT À POUSSER — `{ code, message, line }`, et ce qu'on veut de plus.
 *
 * ⛔ UNE SEULE FORME POUR LE CANAL COLLECTÉ. Sans elle, chaque site répétait le code DEUX fois — une
 * pour le champ, une pour composer le texte — et un site qui choisit son code par une condition
 * l'écrivait quatre fois. Deux écritures d'un même fait divergent : c'est la porte par où un `code`
 * cesse de correspondre à son message, sans que rien ne rougisse.
 */
export function diagnostic(code, params, extra = {}) {
  return { code, message: texteDuDiagnostic(code, params), ...extra };
}

/** Les codes que le catalogue déclare — pour qui inventorie, et pour les gardes. */
export function codesDeDiagnostic() {
  return Object.keys(MESSAGES);
}
