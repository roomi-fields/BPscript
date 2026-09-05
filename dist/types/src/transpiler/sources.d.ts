/**
 * Toutes les sources de `lib/`, dans l'ordre des noms, chacune avec son nom logique, son format et
 * son texte. Un sous-dossier donne un préfixe (`settings/notreich`) ; un corps `.ts` porte le nom de
 * la librairie qui l'accueille et celui de la fonction.
 *
 * @returns {Array<{nom: string, format: 'bpsl'|'json'|'ts', texte: string, fichier: string, fonction?: string}>}
 */
export function sourcesDeLibrairie(): Array<{
    nom: string;
    format: "bpsl" | "json" | "ts";
    texte: string;
    fichier: string;
    fonction?: string;
}>;
