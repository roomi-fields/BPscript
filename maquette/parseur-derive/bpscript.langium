// MAQUETTE — phase 2 du chantier « parseur dérivé d'un formalisme ».
//
// ⚠️ CE N'EST PAS LE LANGAGE. C'est un FRAGMENT, choisi sur la mesure de la phase 0 : les natures
// de nœud les plus produites du corpus — Symbol, Rule, Polymetric, Rest, Prolongation, le nombre.
// Elles couvrent la quasi-totalité des 274 scènes ; la queue longue (câblage, gabarits, points
// d'attente) est délibérément absente.
//
// CE QUE CETTE MAQUETTE DOIT PROUVER, et rien d'autre :
//   1. qu'une grammaire maintenue produit un analyseur qui accepte le langage réel ;
//   2. que l'arbre qu'elle en tire se compare à celui du parseur écrit à la main ;
//   3. que les refus portent une position et un attendu — la gestion d'erreur des compilateurs
//      standards, sans qu'on l'écrive.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : le sens, la résolution (alphabets, acteurs, hauteurs), et les
// messages qui nomment une relève. Ces derniers viennent d'un catalogue à tenir, quel que soit
// l'outil — c'est le troisième formalisme du plan.

grammar BPScript

entry Scene:
    NL* (directives+=Directive NL+ | subgrammars+=Subgrammar)*;

// ── La partie déclarative, réduite à l'invocation de librairie ───────────────
Directive:
    '@' name=ID ('.' target=ID)?;

// ── Les règles de production ────────────────────────────────────────────────
Subgrammar:
    rules+=Rule+;

// ⚠️ LA FIN DE LIGNE FAIT PARTIE DE LA GRAMMAIRE. Mesuré à la maquette : avec l'espace entièrement
// caché, deux règles qui se suivent se fondent en une — le membre droit de la première avale la
// tête de la seconde, puis la flèche échoue. Le retour à la ligne n'est donc PAS de la mise en
// page dans ce langage : il TERMINE une règle, et la grammaire doit le dire.
Rule:
    lhs=SymbolRef arrow=Arrow rhs+=RhsElement+ NL+;

Arrow returns string:
    '->' | '<-' | '<>';

RhsElement:
    Polymetric | Rest | Prolongation | NumericTerminal | SymbolRef;

// `{A B, C D}` — plusieurs voix séparées par la virgule ; une seule voix = un groupement.
Polymetric:
    '{' voices+=Voice (',' voices+=Voice)* '}';

Voice:
    elements+=RhsElement+;

// ⚠️ NOMMÉ `SymbolRef` ET NON `Symbol` : l'outil refuse `Symbol`, nom réservé du runtime
// JavaScript. Contrainte réelle relevée à la maquette — le nom des nœuds n'est donc PAS
// entièrement libre, et l'arbre engendré ne pourra pas porter partout les noms actuels.
SymbolRef:
    name=ID;

Rest:
    value='-';

Prolongation:
    value='_';

NumericTerminal:
    value=NUMBER;

// ── Lexèmes ─────────────────────────────────────────────────────────────────
// ⚠️ `ID` accepte le chiffre en fin de mot : les terminaux du langage s'écrivent `C4`, `Bb3`,
// `A_r` — un identifiant qui refuserait le chiffre final rejetterait la moitié du corpus.
terminal ID: /[A-Za-z_][A-Za-z0-9_']*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;

terminal NL: /[\r\n]+/;
hidden terminal WS: /[ \t]+/;
hidden terminal COMMENT: /\/\/[^\n\r]*/;
