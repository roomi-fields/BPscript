/**
 * L'ARBRE JOINT LE CONTENU DES LIBRAIRIES QU'IL INVOQUE — décision de Romain, 2026-09-02.
 *
 * L'arbre portait des RÉFÉRENCES (`alphabet.dhati`, `sound.tabla_perc`, la liaison d'un acteur),
 * jamais leur contenu ; l'aval qui résout la hauteur relisait les catalogues dans un sac que l'hôte
 * lui passait, sans version, sous des clés de noms de fichiers. Mesuré le 2026-09-02 : Kairos
 * recevait `LIBS` entier de kanopi, et ses lecteurs nommaient `alphabets`, `tunings`… quand la porte
 * parle en mots. Un compilateur mûr fait l'un ou l'autre : il résout et émet un artefact
 * autoportant, ou il émet des références versionnées que le moteur charge lui-même. Ici, l'arbre
 * devient autoportant SANS que le compilateur fasse le travail de l'aval : il vérifie, il nomme, et
 * il JOINT LA PIÈCE DÉCLARÉE, telle que la porte des objets la rend. Aucune fréquence, aucun
 * intervalle, aucune table dépliée : `Sa` reste `Sa`, et la résolution reste où elle est.
 *
 * LA RÈGLE. Un objet entre dans `arbre.librairies` s'il est nommé par l'arbre :
 *   - par une CHAÎNE — un `libRefs` de scène ou d'acteur, une liaison d'acteur (`references[]`, hors
 *     le transport qui est un runtime et non un objet) : `alphabet.dhati` désigne UN objet ;
 *   - par un MOT — la clé d'un réglage (`scaleshift:2`, `vel:60`) ou le nom d'une directive sans
 *     sous-clé (`transpose:1/2`) : un mot désigne CHAQUE objet qui le porte. `scaleshift` est à la
 *     fois le contrôle déclaré dans `transpo` et la fonction digitale de `function`, avec son corps ;
 *     les deux entrent. C'est la condition 3 de la décision — « digital et homomorphism entrent AVEC
 *     leur corps » — tenue sans nommer aucune famille : le mot fait entrer toutes ses facettes ;
 *   - par un MEMBRE d'un objet déjà entré dont la clé est un mot de famille : un accordage écrit
 *     `temperament:"12TET"`, le tempérament entre.
 * Rien d'autre. La clé est la chaîne d'invocation, la valeur est l'`Objet` de la porte, à l'identique.
 * Mesuré sur les 177 scènes de kanopi le 2026-09-02 : 1152 objets joints, section de 346 octets à
 * 9,4 Ko, médiane 2,2 Ko.
 *
 * ⛔ UNE RÉFÉRENCE QUE LA PORTE NE REND PAS EST UNE FAUTE, jamais un trou silencieux : le compilateur
 * l'a validée en amont, donc l'objet existe — si la porte ne le rend pas, c'est la porte qui ment,
 * et l'arbre partirait incomplet sous un vert. Mesuré le 2026-09-02 sur `settings.test1`, que la porte
 * rendait comme une famille `settings/test1` : le défaut s'est vu parce que ce point crie.
 */
import { familles, famille, objet } from './index-des-objets.js';

/**
 * UN NOM D'ENTRÉE — ce que `lireNomDEntree` lit dans le parseur : lettres, chiffres, `_`, `-`. Une
 * adresse dont un segment n'en est pas un ne désigne pas un objet de librairie : la voix de code
 * inscrite en ligne (`def wobble \`js: …\` >> audio`) porte pour adresse son code lui-même, et
 * `audio.\`js: …\`` n'a rien à joindre — le corps est déjà dans l'arbre.
 */
const NOM_D_ENTREE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/**
 * Une chaîne que la porte ne rend pas comme objet peut encore invoquer une PLACE (`midi.controls`)
 * ou un MEMBRE DE RACINE (`midi_default.apporte`) : le compilateur accepte ces invocations, et
 * elles n'ont aucun objet à joindre. Tout autre nom introuvable est une faute — la porte ment.
 */
function estUnePlaceOuUnMembre(chaine) {
  const [mot, nom, ...reste] = chaine.split('.');
  if (reste.length) return false;
  const f = famille(mot);
  if (!f) return false;
  return nom in f.membres || f.entrees.some((e) => e.place === nom);
}

/**
 * Toutes les références de librairie que l'arbre porte, où qu'elles vivent : la règle vaut à toutes
 * les profondeurs, et un `libRefs` posé demain sur un nœud neuf entrera sans qu'une ligne bouge ici.
 */
export function referencesDe(ast) {
  const chaines = [];
  const mots = [];
  const vu = new Set();
  const noter = (liste, x) => { if (!vu.has(x)) { vu.add(x); liste.push(x); } };
  const visiter = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visiter(x); return; }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'librairies') continue;   // la section elle-même, quand l'arbre en porte déjà une
      if (k === 'libRefs' && Array.isArray(v)) { for (const r of v) if (typeof r === 'string') noter(chaines, r); }
      else if (k === 'references' && Array.isArray(v)) {
        for (const r of v) if (r && r.type === 'ActorReference' && r.category !== 'transport') noter(chaines, `${r.category}.${r.name}`);
      }
      else if (k === 'pairs' && Array.isArray(v)) {
        for (const p of v) if (p && typeof p.key === 'string') noter(mots, p.key);
      }
      else if (k === 'directives' && Array.isArray(v)) {
        for (const d of v) if (d && typeof d.name === 'string' && !d.subkey) noter(mots, d.name);
        visiter(v);
      }
      else visiter(v);
    }
  };
  visiter(ast);
  return { chaines, mots };
}

/**
 * Pose `ast.librairies` : chaque objet invoqué, puis ce que ces objets nomment.
 * @returns {Array<{message: string}>} les fautes — une référence que la porte ne rend pas
 */
export function joindreLesLibrairies(ast) {
  const fautes = [];
  const FAMILLES = new Set(familles());
  const section = {};
  const { chaines, mots } = referencesDe(ast);
  const file = [...chaines];
  // Un MOT fait entrer chaque objet qui le porte — un réglage n'a pas de chaîne, il a un nom.
  for (const mot of mots) {
    const o = objet(mot);
    if (!o) continue;   // un mot qui n'est l'entrée d'aucune librairie : une clé d'adresse, un mot de tête
    if (o.ambigu) file.push(...o.ambigu); else file.push(o.chaine.join('.'));
  }
  while (file.length) {
    const chaine = file.shift();
    if (chaine in section) continue;
    // Une chaîne dont la tête n'est pas un mot de famille ne désigne pas un objet de librairie
    // (un canal, un préfixe réservé) : elle n'a rien à joindre.
    const segments = chaine.split('.');
    if (!FAMILLES.has(segments[0])) continue;
    if (!segments.every((s) => NOM_D_ENTREE.test(s))) continue;   // une adresse qui n'est pas un nom : rien à joindre
    const o = objet(chaine);
    if (!o) {
      if (estUnePlaceOuUnMembre(chaine)) continue;
      fautes.push({ message: `librairies jointes : '${chaine}' est invoqué par la scène et la porte des objets ne le rend pas` });
      continue;
    }
    if (o.ambigu) { fautes.push({ message: `librairies jointes : '${chaine}' désigne plusieurs objets — ${o.ambigu.join(', ')}` }); continue; }
    section[chaine] = o;
    for (const [k, v] of Object.entries(o.membres)) if (FAMILLES.has(k) && typeof v === 'string') file.push(`${k}.${v}`);
  }
  ast.librairies = section;
  return fautes;
}
