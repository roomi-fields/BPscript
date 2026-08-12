/**
 * EMPREINTE DES MOTEURS VOISINS — pour qu'une campagne ne puisse pas mesurer un remplacement en cours.
 *
 * Ma chaîne de mesure importe TROIS artefacts construits chez des voisins : `BPx/dist`,
 * `kairos/dist`, `kronos/dist`. Deux d'entre eux ne sont pas versionnés — ce sont des produits de
 * build LOCAUX, que leur propriétaire refait quand il veut, sans me prévenir et sans que rien ne
 * l'en empêche. Je ne peux donc PAS les figer sur une révision, comme je le fais pour la baseline
 * native (`BASELINE_DIR`).
 *
 * Ce que je peux faire, c'est refuser de rendre une mesure prise à cheval sur un remplacement.
 * Le 2026-08-12 une campagne complète a rendu 66 « ne produit pas » sur 87 : `kairos/dist/index.js`
 * avait disparu en cours de balayage, pendant que son propriétaire reconstruisait. Sans cette
 * empreinte, ce chiffre se lit comme un effondrement du langage — soixante grammaires qui ne
 * produisent plus — alors qu'il ne dit rien d'autre que « j'ai lu un répertoire vivant ». C'est
 * exactement le mode de défaillance déjà payé sur la baseline native, et pour la même raison :
 * une mesure datée d'un instant qu'on ne contrôle pas n'est pas une mesure.
 *
 * L'empreinte est PRISE AVANT et RELUE APRÈS. Elle ne protège pas du remplacement ; elle le rend
 * visible, et un verdict faux devient un refus bruyant.
 *
 * CE QU'ELLE NE VOIT PAS, et je le dis plutôt que de laisser croire à une garantie : un fichier
 * réécrit à taille ÉGALE ET à date inchangée passe au travers. Il faudrait empreindre le CONTENU
 * pour le couvrir ; le prix serait payé à chaque campagne, pour un cas qu'un build ne produit pas.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

/** Les trois moteurs que ma chaîne importe, dans l'ordre où elle les traverse. */
export const MOTEURS = {
  BPx: '/home/romi/dev/bp/BPx/dist',
  kairos: '/home/romi/dev/bp/kairos/dist',
  kronos: '/home/romi/dev/bp/kronos/dist',
};

/**
 * Empreinte d'un arbre construit : nombre de fichiers, octets cumulés, date de modification la
 * plus récente. Les trois ensemble, parce qu'un seul se trompe — un fichier réécrit à l'identique
 * ne change pas la taille, un fichier retiré ne change pas la date du reste.
 */
export function empreinteDe(racine) {
  if (!existsSync(racine)) return { absent: true };
  let fichiers = 0; let octets = 0; let dernier = 0;
  const parcourir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { parcourir(p); continue; }
      if (!e.isFile()) continue;
      const s = statSync(p);
      fichiers += 1; octets += s.size; dernier = Math.max(dernier, s.mtimeMs);
    }
  };
  parcourir(racine);
  return { fichiers, octets, dernier };
}

/** Empreinte des trois moteurs, à cet instant. */
export function empreinteVoisins() {
  return Object.fromEntries(Object.entries(MOTEURS).map(([n, d]) => [n, empreinteDe(d)]));
}

/** Rend l'empreinte lisible dans un rapport : `kairos 214 fichiers · 1.2 Mo · 2026-08-12 09:01:57`. */
export function direEmpreinte(e) {
  return Object.entries(e).map(([n, v]) => (v.absent
    ? `${n} ABSENT`
    : `${n} ${v.fichiers}f · ${Math.round(v.octets / 1024)} Ko · ${new Date(v.dernier).toISOString().replace('T', ' ').slice(0, 19)}`)).join('\n  ');
}

/**
 * Compare l'empreinte de fin à celle du début et JETTE si un moteur a bougé. Le refus est bruyant
 * par construction : rendre un tableau chiffré sur une chaîne remplacée en cours de route est le
 * seul résultat pire que ne rien rendre.
 */
export function exigerVoisinsStables(avant, apres = empreinteVoisins()) {
  const bouges = Object.keys(MOTEURS).filter((n) => JSON.stringify(avant[n]) !== JSON.stringify(apres[n]));
  if (bouges.length === 0) return apres;
  throw new Error(
    `[empreinte] MESURE INVALIDE — ${bouges.join(', ')} a changé PENDANT le balayage.\n`
    + `  avant :\n  ${direEmpreinte(avant)}\n`
    + `  après :\n  ${direEmpreinte(apres)}\n`
    + `  Ces artefacts de build ne sont pas versionnés : leur propriétaire les refait sans préavis,\n`
    + `  et une campagne à cheval sur un remplacement rend un effondrement qui n'existe pas.\n`
    + `  Attendu : rejouer une fois le voisin au repos.`,
  );
}
