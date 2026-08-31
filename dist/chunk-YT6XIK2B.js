// src/transpiler/syntaxe-data.js
var SYNTAXE = {
  "_source": "BPscript/schema-syntaxe/language.json",
  "syntaxWords": {
    "->": {
      "kind": "operator",
      "description": "R\xE8gle de production : le membre gauche est r\xE9\xE9crit en membre droit (d\xE9faut gauche\u2192droite)",
      "syntax": "LHS -> RHS"
    },
    "<-": {
      "kind": "operator",
      "description": "R\xE8gle d'analyse : la s\xE9quence droite est r\xE9duite au symbole gauche (droite\u2192gauche)",
      "syntax": "LHS <- RHS"
    },
    "<>": {
      "kind": "operator",
      "description": "R\xE8gle bidirectionnelle : production ET analyse",
      "syntax": "LHS <> RHS"
    }
  },
  "directiveValues": {
    "mode": {
      "description": "Mode de d\xE9rivation du sous-grammaire suivant",
      "values": [
        {
          "name": "ord",
          "description": "Ordonn\xE9 \u2014 r\xE8gles appliqu\xE9es s\xE9quentiellement (d\xE9faut)"
        },
        {
          "name": "rnd",
          "description": "Al\xE9atoire \u2014 s\xE9lection pond\xE9r\xE9e"
        },
        {
          "name": "lin",
          "description": "Lin\xE9aire \u2014 bouclage cyclique"
        },
        {
          "name": "sub",
          "description": "Substitution \u2014 remplacement simultan\xE9 de toutes les occurrences"
        },
        {
          "name": "sub1",
          "description": "Substitution du premier \u2014 occurrence la plus \xE0 gauche seulement"
        },
        {
          "name": "tem",
          "description": "Template \u2014 appariement structurel"
        },
        {
          "name": "poslong",
          "description": "Positional longest \u2014 plus longue correspondance d'abord"
        }
      ]
    },
    "scan": {
      "description": "Placement de la r\xE8gle candidate dans le contexte",
      "values": [
        {
          "name": "left",
          "description": "Argument gauche"
        },
        {
          "name": "right",
          "description": "Argument droit"
        },
        {
          "name": "rnd",
          "description": "Al\xE9atoire"
        }
      ]
    }
  }
};

export {
  SYNTAXE
};
