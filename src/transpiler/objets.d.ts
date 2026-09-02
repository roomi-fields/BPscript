/**
 * La porte des objets — ce qu'une librairie déclare, rendu comme des objets.
 * Voir `objets.js` pour le contrat ; ce fichier n'en est que le type.
 */

/** Un objet déclaré par une librairie : une entrée d'une famille. */
export interface Objet {
  /** Son nom, tel qu'il s'écrit. */
  nom: string;
  /** Le mot de la famille qui le porte — ce qu'on invoque : `scale`, `alphabet`, `audio`… */
  famille: string;
  /** L'objet dont il dérive (le type en tête de sa déclaration), ou `null` pour une racine. */
  derive: string | null;
  /** Ses membres propres, tels que la donnée les porte. */
  membres: Record<string, unknown>;
  /** La place du catalogue où il est rangé (`controls`, `objects`…), ou `null` à la racine. */
  place: string | null;
  /** Sa chaîne d'invocation, de la famille à lui : `['alphabet', 'western']`. */
  chaine: string[];
}

/** Une famille : sa racine et ses entrées. */
export interface Famille {
  nom: string;
  /** Les membres propres de la racine : `documented`, `resolvedBy`, `description`, `apporte`… */
  membres: Record<string, unknown>;
  entrees: Objet[];
}

/** Ce que rend `objet()` quand plusieurs objets finissent par le suffixe demandé. */
export interface Ambigu {
  ambigu: string[];
}

/** Les mots qu'on invoque, dans l'ordre de la donnée. */
export function familles(): string[];
/** Une famille par son mot, ou `null`. */
export function famille(mot: string): Famille | null;
/** Résout `famille.nom`, ou un suffixe non ambigu ; `null` si rien, `{ambigu}` si plusieurs. */
export function objet(chaine: string): Objet | Ambigu | null;
/** Tous les objets, à plat. */
export function objets(): Objet[];
