/**
 * LES SOURCES DE LIBRAIRIE — ce que `lib/` contient, rendu comme du texte.
 *
 * Le compilateur lit ses librairies dans leurs sources, l'une après l'autre (décision de Romain,
 * 2026-09-02 : « pourquoi la structure des objets ne suffit pas » — elle suffit ; le paquet
 * intermédiaire n'est qu'un cache dérivé, et il sort). Ce module est le SEUL endroit qui sache où
 * vivent les fichiers : en Node, ils se lisent sur le disque ; dans une porte construite pour le
 * navigateur, le constructeur (`scripts/construire.mjs`) remplace ce module par la même liste,
 * embarquée comme texte au moment de la construction. Un seul import site, deux fournisseurs,
 * choisis À LA CONSTRUCTION — jamais à l'exécution.
 *
 * ⚠️ LE FORMAT D'UN FICHIER N'EST PAS UNE INFORMATION UTILE À QUI VEUT LA DONNÉE, mais il en est une
 * pour qui doit la LIRE : une source `.bpsl` se compile, un catalogue `.json` se prend tel quel, un
 * corps `.ts` d'une fonction digitale se rattache à son objet. Chaque source dit son format.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../lib');

/**
 * Toutes les sources de `lib/`, dans l'ordre des noms, chacune avec son nom logique, son format et
 * son texte. Un sous-dossier donne un préfixe (`settings/notreich`) ; un corps `.ts` porte le nom de
 * la librairie qui l'accueille et celui de la fonction.
 *
 * @returns {Array<{nom: string, format: 'bpsl'|'json'|'ts', texte: string, fichier: string, fonction?: string}>}
 */
export function sourcesDeLibrairie() {
  const out = [];
  const ramasser = (dir, prefix) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { ramasser(full, prefix + entry + '/'); continue; }
      if (entry.endsWith('.bpsl')) {
        out.push({ nom: prefix + entry.replace(/\.bpsl$/, ''), format: 'bpsl', texte: readFileSync(full, 'utf-8'), fichier: prefix + entry });
      } else if (entry.endsWith('.json')) {
        out.push({ nom: prefix + entry.replace(/\.json$/, ''), format: 'json', texte: readFileSync(full, 'utf-8'), fichier: prefix + entry });
      } else if (entry.endsWith('.ts') && prefix) {
        // `lib/<librairie>/<fonction>.ts` : le corps d'une fonction digitale de la librairie <librairie>.
        out.push({ nom: prefix.replace(/\/$/, ''), format: 'ts', texte: readFileSync(full, 'utf-8'), fichier: prefix + entry, fonction: entry.replace(/\.ts$/, '') });
      }
    }
  };
  ramasser(LIB_DIR, '');
  return out;
}
