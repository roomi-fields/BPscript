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
 * 2. UN MOT TIENT ENTIÈREMENT DANS UN SEUL ALPHABET, jamais sur l'union des vocabulaires en
 *    portée — décision de Romain du 2026-08-16. Sous un acteur de tabla et un acteur occidental,
 *    `taC4` est REFUSÉ : `ta` est un bol, `C4` une note, et le mot mêlerait deux langues. L'union
 *    répond à « ce nom est-il connu » ; la segmentation pose « ce mot tient-il dans un
 *    vocabulaire », et la même donnée ne répond pas aux deux questions.
 *
 *    Un mot lisible dans DEUX alphabets ne se produit pas au corpus — mesuré le 2026-08-16 : une
 *    seule scène porte deux alphabets, et elle ne segmente rien. Le premier alphabet qui lit le mot
 *    entier gagne, et rien n'est construit pour un cas qui n'existe pas.
 *
 * 3. ELLE PORTE SUR LES TERMINAUX DE L'ALPHABET EN PORTÉE — sur le natif, `genagedhatrkt` rend
 *    `ge na ge dha tr kt`, parce que `gena` et `dhatrkt` n'y sont pas des bols.
 *
 *    ⚠️ NOTRE ALPHABET `tabla` LES DÉCLARE ENCORE, et le plus long préfixe les prend : le même nom
 *    rend aujourd'hui `gena ge dhatrkt`. L'écart est dans la DONNÉE, pas dans cette passe — il se
 *    ferme quand les dix-sept composés sortent de l'alphabet et que `dhee`, `tee` et `tr` y entrent.
 *    Une passe correcte sur un alphabet faux donne un résultat faux, et c'est ici qu'on le lit.
 *
 * 4. UN NOM INSEGMENTABLE EST REFUSÉ, et le natif le dit en toutes lettres — « Can't make sense
 *    of "a" ». C'est le reste non consommé qu'il nomme, pas le mot entier.
 *
 * 5. ELLE S'APPLIQUE À LA COMPILATION, PAS AU JEU. Une règle dont le membre gauche vise un
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
export function segmenter(nom: any, terminaux: any): {
    parts: null;
    reste: any;
} | {
    parts: any[];
    reste: null;
} | null;
