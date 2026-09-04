// @isole — il ECRIT sur le disque : dans un processus partage il contaminerait ses voisins.
/**
 * UNE MESURE NE SE PREND PAS SUR UN RÉPERTOIRE VIVANT.
 *
 * Ma campagne importe trois artefacts construits chez des voisins, dont deux ne versionnent pas
 * leur build. Le 2026-08-12, `kairos/dist` a été reconstruit PENDANT un balayage : 60 grammaires
 * sur 87 sont ressorties « ne produit pas », et le tableau se lisait comme un effondrement du
 * langage. Il ne disait rien d'autre que « j'ai lu un répertoire pendant qu'on le remplaçait ».
 *
 * Ce garde tient l'empreinte qui rend cette course VISIBLE. Il l'éprouve sur un arbre à moi, pas
 * sur celui d'un voisin — on n'écrit pas chez les autres pour se prouver quelque chose — et il
 * couvre L'ESPACE des façons de bouger, pas la seule qui s'est montrée : un fichier retiré, un
 * fichier ajouté, un contenu réécrit à taille ÉGALE, un répertoire entièrement disparu.
 *
 * L'inverse compte autant : un arbre qui n'a pas bougé doit passer, sinon le garde crie tout le
 * temps et on finit par le débrancher.
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { empreinteDe, exigerVoisinsStables, empreinteVoisins, direEmpreinte, MOTEURS } from './empreinte_voisins.mjs';

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.log(`  FAIL ${quoi}`); } };

const racine = mkdtempSync(path.join(tmpdir(), 'empreinte-'));
mkdirSync(path.join(racine, 'sous'), { recursive: true });
writeFileSync(path.join(racine, 'a.js'), 'export const a = 1;\n');
writeFileSync(path.join(racine, 'sous', 'b.js'), 'export const b = 2;\n');

// L'empreinte compare TROIS grandeurs ; on vérifie qu'elle les porte toutes, sans quoi choisir ce
// qu'on compare revient à choisir ce qu'on ne verra pas.
{
  const e = empreinteDe(racine);
  verifier(e.fichiers === 2, `l'empreinte compte les fichiers de tout l'arbre (attendu 2, obtenu ${e.fichiers})`);
  verifier(typeof e.octets === 'number' && e.octets > 0, "l'empreinte porte les octets cumulés");
  verifier(typeof e.dernier === 'number' && e.dernier > 0, "l'empreinte porte la date de modification la plus récente");
}

// L'INVERSE — un arbre au repos passe. Un garde qui rougit toujours ne prévient de rien.
{
  const avant = empreinteDe(racine);
  const apres = empreinteDe(racine);
  verifier(JSON.stringify(avant) === JSON.stringify(apres), 'un arbre au repos rend deux fois la MÊME empreinte');
}

/** Chaque façon de bouger, éprouvée sur un arbre neuf pour qu'aucune ne masque la suivante. */
const facons = {
  'un fichier RETIRÉ': (r) => rmSync(path.join(r, 'sous', 'b.js')),
  'un fichier AJOUTÉ': (r) => writeFileSync(path.join(r, 'c.js'), 'export const c = 3;\n'),
  'un contenu RÉÉCRIT À TAILLE ÉGALE': (r) => {
    writeFileSync(path.join(r, 'a.js'), 'export const a = 9;\n');   // même longueur, autre octet
    utimesSync(path.join(r, 'a.js'), new Date(Date.now() + 5000), new Date(Date.now() + 5000));
  },
  'un fichier RÉÉCRIT sans changer sa date': (r) => {
    const p = path.join(r, 'a.js');
    const q = empreinteDe(r).dernier;
    writeFileSync(p, 'export const a = 12345;\n');                  // taille différente
    utimesSync(p, new Date(q), new Date(q));                        // date remise en arrière
  },
  'le répertoire ENTIÈREMENT disparu': (r) => rmSync(r, { recursive: true, force: true }),
};

for (const [quoi, bouger] of Object.entries(facons)) {
  const r = mkdtempSync(path.join(tmpdir(), 'empreinte-'));
  mkdirSync(path.join(r, 'sous'), { recursive: true });
  writeFileSync(path.join(r, 'a.js'), 'export const a = 1;\n');
  writeFileSync(path.join(r, 'sous', 'b.js'), 'export const b = 2;\n');
  const avant = empreinteDe(r);
  bouger(r);
  const apres = empreinteDe(r);
  verifier(JSON.stringify(avant) !== JSON.stringify(apres), `l'empreinte VOIT ${quoi}`);
  rmSync(r, { recursive: true, force: true });
}

// LE JUGE — on lui injecte la faute directement, et on exige qu'il JETTE, pas qu'il note.
{
  const vrai = empreinteVoisins();
  const faux = { ...vrai, kairos: { fichiers: -1, octets: -1, dernier: -1 } };
  let jete = false; let message = '';
  try { exigerVoisinsStables(faux, vrai); } catch (e) { jete = true; message = e.message; }
  verifier(jete, 'le juge JETTE quand un moteur a bougé — il ne se contente pas de le noter');
  verifier(/kairos/.test(message), 'le refus NOMME le moteur qui a bougé');
  verifier(/INVALIDE/.test(message), 'le refus dit que la MESURE est invalide, pas seulement que le moteur a changé');
}

// Et l'inverse chez le juge : une chaîne stable ne doit rien déclencher.
{
  const e = empreinteVoisins();
  let jete = false;
  try { exigerVoisinsStables(e, e); } catch { jete = true; }
  verifier(!jete, 'le juge LAISSE PASSER une chaîne qui n\'a pas bougé');
}

// La couverture : les trois moteurs que la chaîne traverse sont TOUS sous empreinte. En oublier un
// laisserait un tiers de la chaîne libre de bouger sans un signe.
{
  const noms = Object.keys(MOTEURS);
  for (const m of ['BPx', 'kairos', 'kronos']) verifier(noms.includes(m), `${m} est sous empreinte`);
  const vrai = empreinteVoisins();
  for (const m of noms) {
    const faux = { ...vrai, [m]: { fichiers: -1, octets: -1, dernier: -1 } };
    let jete = false;
    try { exigerVoisinsStables(faux, vrai); } catch { jete = true; }
    verifier(jete, `le juge rougit aussi quand c'est ${m} qui bouge`);
  }
  verifier(direEmpreinte(vrai).split('\n').length === noms.length, "le rapport d'empreinte cite les trois moteurs");
}

rmSync(racine, { recursive: true, force: true });
console.log(`Résultat une_mesure_ne_se_prend_pas_sur_un_repertoire_vivant : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
