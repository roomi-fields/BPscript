/**
 * LA SEGMENTATION D'UN NOM COLLÉ — plus long préfixe, glouton, sans retour arrière.
 *
 * Un alphabet dit ce qu'il fait d'un nom qu'il ne contient pas. `dhagenateena` n'est pas un mot :
 * c'est `dha ge na tee na`, cinq terminaux, et le nom collé est une COMMODITÉ DE SAISIE des deux
 * côtés de la flèche.
 *
 * ⛔ TOUT CE QUI SUIT EST MESURÉ SUR LE BINAIRE NATIF par bp3-engine (md5 372dd047), sur les 38
 * fichiers d'alphabet du corpus qui se chargent. Rien n'y est déduit.
 *
 * 1. PLUS LONG PRÉFIXE, GLOUTON, SANS RETOUR ARRIÈRE. Le cas décisif n'est pas mesurable sur
 *    `dhati` — ses dix bols ne sont jamais préfixes l'un de l'autre — donc il a été mesuré sur un
 *    alphabet FABRIQUÉ `{ta, tak, ka}` : `takka` rend `tak ka`, et `taka` est REFUSÉ. Le moteur
 *    prend `tak`, il reste `a`, et il NE REVIENT PAS sur la lecture `ta ka` qui aurait pourtant
 *    réussi. Un algorithme qui rebrousse chemin donnerait un résultat DIFFÉRENT du natif sur ce
 *    cas précis, et identique partout ailleurs — c'est pourquoi il fallait le fabriquer.
 *
 * 2. ELLE PORTE SUR LES TERMINAUX DE L'ALPHABET EN PORTÉE — sur le natif, `genagedhatrkt` rend
 *    `ge na ge dha tr kt`, parce que `gena` et `dhatrkt` n'y sont pas des bols.
 *
 *    ⚠️ NOTRE ALPHABET `tabla` LES DÉCLARE ENCORE, et le plus long préfixe les prend : le même nom
 *    rend aujourd'hui `gena ge dhatrkt`. L'écart est dans la DONNÉE, pas dans cette passe — il se
 *    ferme quand les dix-sept composés sortent de l'alphabet et que `dhee`, `tee` et `tr` y entrent.
 *    Une passe correcte sur un alphabet faux donne un résultat faux, et c'est ici qu'on le lit.
 *
 * 3. UN NOM INSEGMENTABLE EST REFUSÉ, et le natif le dit en toutes lettres — « Can't make sense
 *    of "a" ». C'est le reste non consommé qu'il nomme, pas le mot entier.
 *
 * 4. ELLE S'APPLIQUE À LA COMPILATION, PAS AU JEU. Une règle dont le membre gauche vise un
 *    SOUS-BOL mord : `na ti --> na trkt` attrape le `na` qui est le troisième bol de `dhagena`.
 *    Le nom collé n'est un mot pour personne — il est dissous avant que la grammaire travaille.
 *
 * ⛔ ET LES NOTES NE PASSENT PAS PAR ICI. Sans aucun fichier d'alphabet, `do5 re5` sonne et
 * `dha dha` est refusé : la composition d'une note est un CALCUL — base, altération, registre —
 * et la segmentation en est un autre. Deux chemins qui s'empilent. Cette passe ne s'applique donc
 * qu'aux noms que l'alphabet ne porte pas et que le calcul de note n'a pas résolus.
 *
 * ⚠️ ELLE NE PRÉSERVE PAS LA SORTIE, ET C'EST ATTENDU. `dhagena` est aujourd'hui un terminal
 * déclaré qui porte une voix VIDE : il ne sonne pas. Segmenté, il rend trois bols qui, eux,
 * sonnent. La segmentation FAIT SONNER CE QUI ÉTAIT MUET — un vert qui ne changerait rien serait
 * une mesure à suspecter, pas un résultat à célébrer.
 */

/**
 * Découpe un nom en terminaux de l'alphabet. Rend `null` si le nom est un terminal à lui seul
 * (rien à faire) ou s'il ne se segmente pas — et dans ce dernier cas le reste non consommé est
 * porté par `reste`, parce que c'est LUI que le refus doit nommer.
 */
export function segmenter(nom, terminaux) {
  if (!nom || terminaux.has(nom)) return null;
  // Les longueurs vont du plus long au plus court : c'est la règle du plus long préfixe, et la
  // trier une fois évite de la redécouvrir à chaque position.
  const longueurs = [...new Set([...terminaux].map((t) => t.length))].sort((a, b) => b - a);
  const parts = [];
  let i = 0;
  while (i < nom.length) {
    let pris = null;
    for (const L of longueurs) {
      if (L > nom.length - i) continue;
      const bout = nom.slice(i, i + L);
      if (terminaux.has(bout)) { pris = bout; break; }
    }
    // ⛔ PAS DE RETOUR ARRIÈRE : on ne réessaie pas une lecture plus courte en amont. C'est ce que
    // le natif fait, et `taka` le prouve — il échoue là où un retour arrière aurait réussi.
    if (!pris) return { parts: null, reste: nom.slice(i) };
    parts.push(pris);
    i += pris.length;
  }
  return parts.length > 1 ? { parts, reste: null } : null;
}
