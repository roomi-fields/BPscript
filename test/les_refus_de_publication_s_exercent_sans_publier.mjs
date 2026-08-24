#!/usr/bin/env node
/**
 * GARDE — LES REFUS DE LA PUBLICATION S'EXERCENT, ET AUCUN DISQUE NE BOUGE.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, ET C'EST CHEZ UN VOISIN. runtime-OSC a mesuré, le 2026-08-24, que ses
 * **dix-sept injections éprouvaient le GARDE de fraîcheur** et qu'**aucune n'exerçait les refus de la
 * PUBLICATION elle-même** — assiette non déclarée, arbre sale, commit déjà publié. **Seul appelant :
 * la publication.** ⇒ *« Écrits, soignés, jamais tournés. »*
 *
 * ⇒ **LE REMÈDE N'EST PAS D'EXTRAIRE POUR POUVOIR APPELER, C'EST DE DONNER LES FAITS.** Une décision
 * qui va CHERCHER ses faits exige, pour être exercée, qu'on fabrique un dépôt sale et un artefact
 * déjà publié. **Celles-ci reçoivent ce qui a été mesuré ailleurs** — donc ce banc leur passe des
 * faits fabriqués, et il ne publie rien, n'écrit rien, ne salit rien.
 *
 * ⚠️ ET C'EST MIEUX QU'UN MODE `--essai` : un mode rend le script mesurable, séparer la décision rend
 * le mode inutile. **La cause est supprimée, pas contournée.**
 *
 * ⛔ CHAQUE VOLET ÉPROUVE LES DEUX SENS. Un refus qu'on n'a vu que MORDRE peut mordre sur tout ; un
 * refus qu'on n'a vu que SE TAIRE peut être mort. Les deux, ou rien.
 */
import {
  refuserAssiette, refuserArbreSale, refuserCommitDejaPublie, refuserNomDejaPris, refuserEmpreinte,
  refuserLien, refusAvantConstruction, refusApresConstruction,
} from '../scripts/publication-refus.mjs';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };
/** Un refus doit être un MESSAGE, jamais un booléen : un vide se remplit tout seul. */
const refuse = (r, mot, quoi) => {
  ok(typeof r === 'string' && r.length > 40, `${quoi} — doit rendre un MESSAGE, reçu ${JSON.stringify(r)}`);
  ok(typeof r === 'string' && r.includes(mot), `${quoi} — le message doit nommer « ${mot} » : ${String(r).slice(0, 90)}`);
};

// ── A. L'ASSIETTE ────────────────────────────────────────────────────────────────────────────
{
  const d = ['a.js', 'b.js'];
  ok(refuserAssiette({ derivee: d, declaree: ['a.js', 'b.js'] }) === null, 'A. (se tait) assiette exacte');
  refuse(refuserAssiette({ derivee: d, declaree: ['a.js'] }), 'MANQUENT', 'A. (mord) un fichier manquant');
  refuse(refuserAssiette({ derivee: d, declaree: [...d, 'z.md'] }), 'EN TROP', 'A. (mord) un fichier en trop');
  // ⛔ LE TÉMOIN ANTI-VACUITÉ : une dérivation vide rendrait « aucun écart » sur un paquet sans contenu.
  refuse(refuserAssiette({ derivee: [], declaree: [] }), 'VIDE', 'A. (mord) une dérivation VIDE');
}

// ── B. L'ARBRE SALE, ET SON PÉRIMÈTRE EST L'ASSIETTE ─────────────────────────────────────────
{
  const assiette = ['src/a.js'];
  ok(refuserArbreSale({ modifies: [], assiette }) === null, 'B. (se tait) arbre propre');
  ok(refuserArbreSale({ modifies: ['BACKLOG.md', 'docs/x.md'], assiette }) === null,
    "B. (se tait) ⛔ un fichier modifié HORS de l'assiette ne bloque pas — sinon la publication paie "
    + 'ce qu\'elle ne publie pas, et c\'est ce qui a bloqué kanopi une matinée');
  refuse(refuserArbreSale({ modifies: ['src/a.js'], assiette }), 'src/a.js',
    "B. (mord) un fichier de l'assiette non enregistré");
}

// ── C. UN COMMIT DÉJÀ PUBLIÉ ─────────────────────────────────────────────────────────────────
{
  ok(refuserCommitDejaPublie({ commit: 'abc1234', publies: ['def5678'] }) === null, 'C. (se tait) commit neuf');
  refuse(refuserCommitDejaPublie({ commit: 'abc1234', publies: ['abc1234'] }), 'DÉJÀ publié',
    'C. (mord) un commit déjà publié');
  refuse(refuserCommitDejaPublie({ commit: null, publies: [] }), 'introuvable', 'C. (mord) aucun commit');
}

// ── D. L'EMPREINTE ───────────────────────────────────────────────────────────────────────────
{
  const bonne = { commit: 'abc1234', fichiers: 18 };
  ok(refuserEmpreinte({ empreinte: bonne, commitAttendu: 'abc1234' }) === null, 'D. (se tait) empreinte juste');
  refuse(refuserEmpreinte({ empreinte: null }), 'aucune empreinte', 'D. (mord) empreinte absente');
  refuse(refuserEmpreinte({ empreinte: { fichiers: 18 } }), 'pas de commit', 'D. (mord) empreinte sans commit');
  refuse(refuserEmpreinte({ empreinte: bonne, commitAttendu: 'zzz9999' }), 'visé à côté',
    'D. (mord) la gravure a visé à côté');
  refuse(refuserEmpreinte({ empreinte: { commit: 'abc1234', fichiers: 0 }, commitAttendu: 'abc1234' }), 'ZÉRO fichier',
    'D. (mord) ⛔ le témoin ANTI-VACUITÉ — zéro fichier rend toute comparaison verte');
}

// ── E. LE LIEN ───────────────────────────────────────────────────────────────────────────────
{
  const R = '/paquets/';
  ok(refuserLien({ lien: 'l', cible: '/paquets/x-abc', cibleExiste: true, racinePaquets: R }) === null,
    'E. (se tait) un lien vers un paquet');
  refuse(refuserLien({ lien: 'l', cible: '/paquets/x-abc', cibleExiste: false, racinePaquets: R }),
    'chemin mort', 'E. (mord) un lien qui ne mène à rien');
  refuse(refuserLien({ lien: 'l', cible: '/dev/bp/BPscript', cibleExiste: true, racinePaquets: R }),
    'même disque', 'E. (mord) ⛔ un lien vers un ARBRE DE TRAVAIL ne publie rien');
  refuse(refuserLien({ lien: null }), 'aucun lien', 'E. (mord) aucun lien');
}

// ── E2. ⛔ LE NOM DÉJÀ PRIS — ce refus n'est PAS dans le patron, et c'est un trou mesuré ──────
// Un nom de paquet est un commit ABRÉGÉ, les abrégés se collisionnent, et la longueur de l'abrégé
// grandit avec le dépôt. Le patron protège « ne pas reconstruire un commit publié » ; il ne protège
// pas « ne pas écrire sous un nom que tient un AUTRE commit ».
{
  const n = 'bpscript-abc1234';
  ok(refuserNomDejaPris({ nom: n, cibleExiste: false, commitDuNom: null, commit: 'abc' }) === null,
    'E2. (se tait) le nom est libre');
  ok(refuserNomDejaPris({ nom: n, cibleExiste: true, commitDuNom: 'abc', commit: 'abc' }) === null,
    'E2. (se tait) le nom porte DÉJÀ mon commit — c\'est la branche qui rebascule le lien');
  refuse(refuserNomDejaPris({ nom: n, cibleExiste: true, commitDuNom: 'zzz', commit: 'abc' }),
    'DÉJÀ PRIS', 'E2. (mord) ⛔ le nom est tenu par un AUTRE commit — collision d\'abrégés');
  refuse(refuserNomDejaPris({ nom: n, cibleExiste: true, commitDuNom: null, commit: 'abc' }),
    'aucune empreinte lisible', 'E2. (mord) un dossier sans empreinte — construction interrompue');
}

// ── F. TOUS ENSEMBLE — la publication les pose EN DEUX TEMPS ─────────────────────────────────
{
  const sains = {
    assiette: { derivee: ['a.js'], declaree: ['a.js'] },
    arbre: { modifies: [], assiette: ['a.js'] },
    commit: { commit: 'abc1234', publies: [] },
    nom: { nom: 'x-abc1234', cibleExiste: false, commitDuNom: null, commit: 'abc1234' },
    empreinte: { empreinte: { commit: 'abc1234', fichiers: 1 }, commitAttendu: 'abc1234' },
    lien: { lien: 'l', cible: '/paquets/x-abc', cibleExiste: true, racinePaquets: '/paquets/' },
  };
  ok(refusAvantConstruction(sains).length === 0, 'F. (se tait) des faits sains, AUCUN refus avant');
  ok(refusApresConstruction(sains).length === 0, 'F. (se tait) des faits sains, AUCUN refus après');
  ok(refusAvantConstruction({}).length === 4,
    `F. (mord) des faits ABSENTS produisent les QUATRE refus d'avant — reçu ${refusAvantConstruction({}).length}.`);
  ok(refusApresConstruction({}).length === 2,
    `F. (mord) des faits ABSENTS produisent les DEUX refus d'après — reçu ${refusApresConstruction({}).length}.`);
}

// ── H. ⛔ LA MATRICE DU FAIT ABSENT — le quatrième « troisième état » de la journée ───────────
// Sur des faits absents, QUATRE de ces refus rendaient `null` : « arbre propre », « rien de publié »,
// « le nom est libre », « le lien est dans la racine ». Un `undefined` replié sur une valeur neutre a
// exactement la forme d'une mesure qui n'a rien trouvé. ⇒ **La matrice porte sur les SIX**, y compris
// ceux qui n'ont jamais eu le défaut : réparer les quatre qui ont mordu laisserait le cinquième
// l'écrire à nouveau.
{
  const TOUS = { refuserAssiette, refuserArbreSale, refuserCommitDejaPublie, refuserNomDejaPris,
    refuserEmpreinte, refuserLien };
  for (const [nom, fn] of Object.entries(TOUS)) {
    const r = fn({});
    ok(typeof r === 'string' && r.length > 40,
      `H. ⛔ ${nom}({}) doit REFUSER sur des faits absents — reçu ${JSON.stringify(r)}. `
      + `Un fait qui manque n'est pas un fait qui va bien.`);
  }
}

// ── G. ⛔ ET AUCUN DISQUE N'A BOUGÉ — c'est la raison d'être de ce banc ───────────────────────
// Le module des refus n'importe RIEN qui écrive. Mesuré sur son texte, pas supposé.
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../scripts/publication-refus.mjs', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  for (const mot of ['writeFileSync', 'renameSync', 'rmSync', 'mkdirSync', 'execFileSync', 'execSync']) {
    ok(!src.includes(mot),
      `G. ⛔ le module des refus ne doit RIEN pouvoir écrire ni exécuter — il porte « ${mot} ». `
      + `Une décision qui touche le disque redevient inexerçable, et c'est la cause qu'on supprime ici.`);
  }
  ok(!/readFileSync|readFile\b/.test(src),
    'G. ⛔ ni MESURER : une décision qui va chercher ses propres faits exige un dépôt fabriqué pour '
    + "être exercée. Les faits lui sont DONNÉS — c'est toute la différence.");
}

if (e.length) {
  console.error(`[refus publication] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[refus publication] ${p} PASS / 0 FAIL — six refus exercés dans les deux sens, zéro écriture`);
