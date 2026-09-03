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
  },
  "grammarWords": {
    "description": "Les mots avec lesquels on \xE9crit la STRUCTURE \u2014 la grammaire, qu'un auteur ne peut jamais ombrer. Un PLANCHER : ce qui n'a pas su \xEAtre \xE9tabli ne compte pas comme une absence. Dissous du sch\xE9ma de `core` le 2026-09-03.",
    "qualite": "plancher",
    "mots": [
      "actor",
      "core",
      "def",
      "in",
      "init",
      "mode",
      "out",
      "seed",
      "terminal"
    ]
  },
  "bracketRewrites": {
    "description": "Les r\xE9glages que le CROCHET a port\xE9s et qui s'\xE9crivent en PARENTH\xC8SES depuis la d\xE9cision du 2026-08-02. Le compilateur les comprend lui-m\xEAme : \xE9crits entre crochets, ils sont refus\xE9s AVEC leur r\xE9\xE9criture, au lieu de tomber sur \xAB cl\xE9 inconnue \xBB. Une pierre tombale de graphie, donc du LANGAGE \u2014 elle a quitt\xE9 le sch\xE9ma de `core` avec lui le 2026-09-03.",
    "mots": [
      "scan",
      "weight",
      "on_fail",
      "meter",
      "rotate",
      "legato",
      "staccato"
    ]
  },
  "actorKeyRewrites": {
    "description": "Les mots qu'un acteur a port\xE9s comme cl\xE9s et qui n'en sont plus : `sound` et `sounds` (un prototype d'objet sonore vit en librairie), `voice` (une voix s'attache au terminal). \xC9crits sur un acteur, ils sont refus\xE9s AVEC ce qui les remplace, au lieu de tomber dans la lecture g\xE9n\xE9rique d'une affectation. Une pierre tombale de graphie, donc du LANGAGE \u2014 elle a quitt\xE9 le sch\xE9ma de `core` avec lui le 2026-09-03.",
    "mots": [
      "sound",
      "sounds",
      "voice"
    ]
  }
};

export {
  SYNTAXE
};
