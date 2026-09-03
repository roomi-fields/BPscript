#!/usr/bin/env node
/**
 * GARDE — UN LITTÉRAL ET UNE SUITE SE LISENT PAREIL À TOUTES LES PROFONDEURS.
 *
 * `true`, `false` et un nombre écrits dans une source de librairie doivent ressortir du paquet avec
 * la MÊME NATURE, qu'ils soient posés sur la déclaration du fichier, dans une entrée, ou au fond
 * d'une place imbriquée.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, LE 2026-08-24, ET C'EST DE MOI. Le générateur portait DEUX lecteurs de
 * valeur, à trois cents lignes l'un de l'autre : `valeurDeCle` typait, `sacEnObjet` recopiait brut.
 * **La profondeur décidait lequel s'appliquait.**
 *
 *     champ de fichier, sur la déclaration     documented:false   →  false     LE BOOLÉEN
 *     membre au fond d'une place               out:true           →  "true"    LA CHAÎNE
 *
 * ⚠️ J'AI MESURÉ LE PREMIER CAS ET CONCLU SUR LE SECOND, puis routé « le langage n'a pas de littéral
 * booléen » à quatre destinataires — dont une surface publiée. **runtime-MIDI l'a réfuté avec mon
 * propre paquet publié**, et sa question était la bonne : *pas si le langage a un booléen, mais
 * QUELLE POSITION le perd.*
 *
 * ⇒ ET C'EST UNE CHAÎNE NON VIDE QUI EST VRAIE : `"false"` passe tous les tests de présence et tous
 * les tests de vérité. Un champ qui déclare qu'un geste N'EST PAS du langage entrait donc dans le
 * vocabulaire, en silence, par la seule profondeur où il était écrit.
 *
 * ⛔ ON FABRIQUE LE CAS, on ne le cherche pas dans la donnée : aujourd'hui aucune source n'écrit un
 * littéral typable au fond d'un sac, donc un garde qui OBSERVE serait vert sur les deux lecteurs.
 * C'est exactement pourquoi le défaut a vécu jusqu'ici.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;

// ── LE TÉMOIN : le même trio de littéraux, à TROIS profondeurs ───────────────────────────────
// ⚠️ Le nom du fichier est `zz_temoin` : sa déclaration porte les champs de fichier, ses `def`
// portent les entrées, et la place `objects` porte un membre imbriqué. Les trois chemins que le
// générateur emprunte, dans une seule source.
const SOURCE = `// témoin du garde des littéraux — fabriqué, jamais lu par une scène
def zz_temoin(resolvedBy:zz, resolves:zz_temoin, section:objects)

def surface(vrai:true, faux:false, nombre:12, mot:oui)

def profond(place(dedans(vrai:true, faux:false, nombre:12, mot:oui)))

def suites(surface(a, b), place(dedans(profonde(a, b))))
`;

const bac = mkdtempSync(join(tmpdir(), 'zz-litteral-'));
let publie = null;
let sortie = '';
try {
  // Une COPIE du dépôt : le générateur lit `lib/` par son propre chemin, on ne peut pas le
  // détourner. On copie ce qu'il lui faut et on ajoute le témoin.
  execFileSync('bash', ['-c',
    `cd ${JSON.stringify(RACINE)} && tar cf - --exclude=node_modules --exclude=.git lib src scripts package.json | (cd ${JSON.stringify(bac)} && tar xf -)`],
  { encoding: 'utf8' });
  writeFileSync(join(bac, 'lib', 'zz_temoin.bpsl'), SOURCE);
  const js = execFileSync(process.execPath, [join(bac, 'src', 'transpiler', 'libs-bundle.js')],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(bac, 'sortie.mjs'), js);
  const lu = execFileSync(process.execPath, ['--input-type=module', '-e',
    `const { LIBS } = await import(${JSON.stringify(join(bac, 'sortie.mjs'))});\n`
    + 'process.stdout.write(JSON.stringify(LIBS.zz_temoin ?? null));'], { encoding: 'utf8' });
  publie = JSON.parse(lu);
} catch (x) {
  sortie = `EXCEPTION ${(x.stderr || x.message || '').slice(0, 220)}`;
} finally {
  rmSync(bac, { recursive: true, force: true });
}

ok(publie && typeof publie === 'object',
  `SOCLE : le témoin doit être publié par le générateur — ${sortie || JSON.stringify(publie)}`);

if (publie) {
  const surface = publie.objects?.surface;
  const profond = publie.objects?.profond?.place?.dedans;
  ok(surface && typeof surface === 'object', `A. l'entrée de surface doit être publiée — ${JSON.stringify(publie).slice(0, 160)}`);
  ok(profond && typeof profond === 'object', `A. le membre imbriqué doit être publié — ${JSON.stringify(publie.objects?.profond).slice(0, 160)}`);

  // ── A. LA NATURE, LITTÉRAL PAR LITTÉRAL, AUX DEUX PROFONDEURS ──────────────────────────────
  for (const [ou, o] of [['surface', surface], ['profond', profond]]) {
    if (!o) continue;
    ok(o.vrai === true,
      `A. ⛔ '${ou}.vrai' doit être le BOOLÉEN true — reçu ${JSON.stringify(o.vrai)} (${typeof o.vrai}). `
      + `Une chaîne "true" passe tous les tests de vérité ET tous les tests de présence.`);
    ok(o.faux === false,
      `A. ⛔ '${ou}.faux' doit être le BOOLÉEN false — reçu ${JSON.stringify(o.faux)} (${typeof o.faux}). `
      + `C'est le cas qui MENT : une chaîne "false" est VRAIE, donc un champ qui dit « non » dit « oui ».`);
    ok(o.nombre === 12,
      `A. ⛔ '${ou}.nombre' doit être le NOMBRE 12 — reçu ${JSON.stringify(o.nombre)} (${typeof o.nombre}).`);
    ok(o.mot === 'oui',
      `A. '${ou}.mot' reste un MOT — sans quoi le typage mangerait les noms. Reçu ${JSON.stringify(o.mot)}.`);
  }

  // ── B. ⛔ LE COMPLÉMENT : LES DEUX PROFONDEURS DISENT LA MÊME CHOSE ────────────────────────
  // Sans ce volet, deux lecteurs qui se trompent DE LA MÊME FAÇON passeraient le volet A.
  if (surface && profond) {
    const nature = (o) => Object.keys(o).sort().map((k) => `${k}:${typeof o[k]}`).join(' ');
    ok(nature(surface) === nature(profond),
      `B. ⛔ les deux profondeurs doivent rendre les MÊMES natures — surface [${nature(surface)}] `
      + `contre profond [${nature(profond)}]. C'est l'écart exact qui a vécu ici : deux lecteurs de `
      + `valeur, et la profondeur qui décide lequel s'applique.`);
  }

  // ── B2. ⛔ UNE SUITE DE NOMS NUS EST UNE LISTE, À TOUTES LES PROFONDEURS AUSSI ────────────
  // ⛔ MÊME DÉFAUT, MÊME FICHIER, TROUVÉ LE MÊME JOUR — et j'avais fermé la moitié. Le littéral
  // était typé partout depuis le matin ; la SUITE, elle, devenait une LISTE à l'étage de l'entrée
  // (reconnue à sa FORME) et un OBJET plus bas (reconnue à une LISTE DE CLÉS écrite à la main).
  //
  //     surface(a, b)                 →  ["a","b"]
  //     place(dedans(profonde(a, b))) →  {"a":true,"b":true}      AVANT la réparation
  //
  // ⚠️ C'est l'architecte qui l'a fait mesurer, en refusant de relayer à Romain une affirmation que
  // je lui avais donnée : « une liste de noms n'a pas de graphie ». **Elle en a une, et elle passe.**
  // Ce qui ne passait pas était la LECTURE, un étage plus bas — et ma phrase désignait le langage
  // quand le défaut était dans mon générateur.
  {
    const s = publie.objects?.suites;
    ok(Array.isArray(s?.surface),
      `B2. ⛔ 'suites.surface' doit être une LISTE — reçu ${JSON.stringify(s?.surface)}.`);
    ok(Array.isArray(s?.place?.dedans?.profonde),
      `B2. ⛔ 'suites.place.dedans.profonde' doit être une LISTE elle aussi — reçu `
      + `${JSON.stringify(s?.place?.dedans?.profonde)}. Une suite lue comme un objet perd son ORDRE `
      + `et sa NATURE : un lecteur qui fait \`[0]\` rend undefined.`);
    ok(JSON.stringify(s?.surface) === JSON.stringify(s?.place?.dedans?.profonde),
      `B2. et les deux profondeurs rendent la MÊME chose — ${JSON.stringify(s?.surface)} contre `
      + `${JSON.stringify(s?.place?.dedans?.profonde)}.`);
  }

  // ── C. ET LE CHAMP DE FICHIER SUIT LA MÊME RÈGLE ──────────────────────────────────────────
  ok(publie.documented === false,
    `C. le champ de fichier porte la même nature que le reste — reçu ${JSON.stringify(publie.documented)}. `
    + `C'est la profondeur où le typage marchait déjà ; le volet existe pour qu'il ne cesse pas.`);
}

if (e.length) {
  console.error(`[littéral] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[littéral] ${p} PASS / 0 FAIL — même nature à toutes les profondeurs`);
