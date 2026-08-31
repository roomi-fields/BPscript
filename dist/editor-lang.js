// public/editor/bpscript-parser.js
import { LRParser } from "@lezer/lr";
var parser = LRParser.deserialize({
  version: 14,
  states: "!pQVQPOOO!WQPO'#C`OOQO'#Ca'#CaOOQO'#Cb'#CbOOQO'#Cc'#CcOOQO'#Cd'#CdOOQO'#Ce'#CeOOQO'#Cf'#CfOOQO'#Cq'#CqOOQO'#Cm'#CmQVQPOOOOQO,58z,58zOOQO-E6k-E6k",
  stateData: "!m~OdOS~OQWORWOZWO[WO]WO^WO_WO`WOfPOhQOiROjSOkTOlUOmVO~OgZO~OQRhijklmgZ[]^`m~",
  goto: "ufPPPPgggggggPPPPPPkPPPqTWOYQYOR[YTXOY",
  nodeNames: "\u26A0 Scene LineComment Separator Directive RulePrefix Arrow BacktickCode Variable FlagExpr Weight TypeKeyword LambdaKeyword Number Symbol Newline Operator",
  maxTerm: 29,
  nodeProps: [
    ["group", -15, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, "Element"]
  ],
  skippedNodes: [0],
  repeatNodeCount: 1,
  tokenData: "=_~RvXY#iYZ#tpq#iqr#ytu$Rvw$Rxy$Ryz$R{|$W|}$R}!O%s!O!P&o!P!Q&}!Q![(p![!]$R!^!_)Z!_!`#y!`!a*e!a!b$R!b!c*k!c!}*p!}#O$R#P#Q$R#R#S+r#S#T,Y#T#V*p#V#W,w#W#Z*p#Z#[.Z#[#`*p#`#a3z#a#h*p#h#i8U#i#o*p#o#p$R#p#q<j#q#r$R#r#s$R~#nQd~XY#ipq#i~#yO_~~$OP`~!_!`$R~$WO`~~$]Ug~!O!P$W!Q![$W![!]$o!c!}$W#R#S$W#T#o$W~$rV}!O%X!O!P%X!P!Q%X!Q![%X!c!}%X#R#S%X#T#o%X~%^Vg~}!O%X!O!P%X!P!Q%X!Q![%X!c!}%X#R#S%X#T#o%X~%xQ`~}!O&O!`!a&j~&RP}!O&U~&XP}!O&[~&_P}!O&b~&gPR~}!O&b~&oOi~~&tP`~!O!P&w~&zP!O!P$R~'QS!P!Q'^!c!}'u#R#S'u#T#o'u~'cSQ~OY'^Z;'S'^;'S;=`'o<%lO'^~'rP;=`<%l'^~'xZqr'u{|'u}!O'u!P!Q(k!Q!['u!^!_'u!_!`'u!`!a'u!c!}'u#R#S'u#T#o'u~(pOl~~(uQ]~!P!Q({!Q![(p~)OP!Q![)R~)WP]~!Q![)R~)^Vqr$R}!O&j!Q![)s!_!`$R!`!a&j!m!n)s#_#`)s~)vWpq)s}!O)s!Q![)s!_!`)s!`!a*`!c!})s#R#S)s#T#o)s~*eOm~~*hP!_!`$R~*pOf~~*wVg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#o*p~+cT^~st+^!Q![+^!c!}+^#R#S+^#T#o+^~+yT^~`~st+^!Q![+^!c!}+^#R#S+^#T#o+^~,]TO#S,Y#S#T,l#T;'S,Y;'S;=`,q<%lO,Y~,qOj~~,tP;=`<%l,Y~-OXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#j*p#j#k-k#k#o*p~-tVg~Z~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#o*p~.bYg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#U/Q#U#f*p#f#g0h#g#o*p~/XXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#h*p#h#i/t#i#o*p~/{Xg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#X*p#X#Y-k#Y#o*p~0oWg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#U1X#U#o*p~1`Xg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#a*p#a#b1{#b#o*p~2SVg~^~st2i!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#o*p~2nT^~st+^!Q![2}!c!}+^#R#S+^#T#o+^~3SU^~st+^!Q![2}!c!}+^!}#O3f#R#S+^#T#o+^~3iP!Q![3l~3oQ!Q![3l#P#Q3u~3zOh~~4RWg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#U4k#U#o*p~4rXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#a*p#a#b5_#b#o*p~5fXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#U*p#U#V6R#V#o*p~6YXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#W*p#W#X6u#X#o*p~6|Wg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#U7f#U#o*p~7oVg~[~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#o*p~8]Xg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#f*p#f#g8x#g#o*p~9PXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#]*p#]#^9l#^#o*p~9sXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#Z*p#Z#[:`#[#o*p~:gXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#Z*p#Z#[;S#[#o*p~;ZXg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#X*p#X#Y;v#Y#o*p~;}Xg~^~st+^!O!P$W!Q![*p![!]$o!c!}*p#R#S*p#T#f*p#f#g-k#g#o*p~<mR!c!}<v#R#S<v#T#o<v~<yT!Q![<v!c!}<v#R#S<v#T#o<v#p#q=Y~=_Ok~",
  tokenizers: [0],
  topRules: { "Scene": [0, 1] },
  tokenPrec: 59
});

// public/editor/bp3-parser.js
import { LRParser as LRParser2 } from "@lezer/lr";
var parser2 = LRParser2.deserialize({
  version: 14,
  states: "#`QVQPOOO!yQPO'#C`OOQO'#Ca'#CaOOQO'#Cb'#CbOOQO'#Cc'#CcOOQO'#Cd'#CdOOQO'#Ce'#CeOOQO'#Cf'#CfOOQO'#Cg'#CgOOQO'#Ch'#ChOOQO'#Ci'#CiOOQO'#Cq'#CqOOQO'#Cr'#CrOOQO'#C|'#C|OOQO'#Cx'#CxQVQPOOOOQO,58z,58zOOQO-E6v-E6v",
  stateData: "#h~OoOS~OQ]OR]O^]O_]O`]Oa]Ob]Oc]Od]Og]Oh]Oi]Oj]Ok]OqPOsQOtROuSOvTOwUOxVOyWOzXO{YO|ZO}[O~Or`O~OQRs}tuvwxz{|yqrhgi^_`k|~",
  goto: "!QqPPPPrrrrrrrrrrPPPPPPPrrPPPPPvPPP|T]O_Q_ORa_T^O_",
  nodeNames: "\u26A0 Grammar LineComment Separator ModeLine RulePrefix Arrow SpecialFn Flag Weight Variable SpeedRatio OutTimeObject TemplateRef Tie Rest Prolongation Period Wildcard NilString PolyBrace FileRef InitDirective Number Mode Symbol Newline Operator",
  maxTerm: 45,
  nodeProps: [
    ["group", -26, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, "Element"]
  ],
  skippedNodes: [0],
  repeatNodeCount: 1,
  tokenData: "Be~RuXY#fYZ#qpq#fqr#vvw#{xy$Qyz#vz{%Q|}#v}!O&Z!O!P'}!P!Q(S!Q![*U!^!_*^!a!b,i!c!k,n!k!l-S!l!n,n!n!o/t!o!q,n!q!r3W!r!s4^!s!t,n!t!u7p!u!v9h!v!w;^!w!},n!}#O<d#O#P%u#P#Q#v#R#S<z#T#Z,n#Z#[>V#[#o,n#o#pAk#p#qAp#q#rAk~#kQo~XY#fpq#f~#vOj~~#{Ok~~$QO^~~$VRk~![!]$`!_!`$`!b!c$z~$cUpq$`yz$u!Q![$`!c!}$`#R#S$`#T#o$`~$zO{~~$}P!Q![$`~%TXOt%puz%pz{%u{!Q%p!Q![%{![!}%p#O;'S%p;'S;=`&T<%lO%p~%uOc~~%xP!Q![%{~&QPy~!Q![%{~&WP;=`<%l%p~&`Q_~}!O&f#T#o'S~&iQ}!O&o!`!a&}~&rP}!O&u~&zPR~}!O&u~'SOt~~'VQ!O!P']#T#o'S~'`S!Q!['l!c!}'l#R#S'l#T#o'l~'qS|~!Q!['l!c!}'l#R#S'l#T#o'l~(SOa~~(VT!P!Q(f!Q![%{!c!}(}#R#S(}#T#o(}~(kSQ~OY(fZ;'S(f;'S;=`(w<%lO(f~(zP;=`<%l(f~)Q_pq(}{|(}}!O(}!O!P(}!P!Q*P!Q![(}!^!_(}!_!`(}!`!a(}!c!}(}#R#S(}#T#o(}%(^%(_(}%(b%(c(}%(c%(d(}~*UOv~~*ZPg~!Q![*U~*aU}!O*s!Q![*|!^!_+n!m!n*|#]#^*|#_#`*|~*vQ}!O&}!`!a&}~+PWpq*|}!O*|!Q![*|!_!`*|!`!a+i!c!}*|#R#S*|#T#o*|~+nOw~~+qR!c!}+z#R#S+z#T#o+z~+}T!Q![+z!`!a,^!c!}+z#R#S+z#T#o+z~,aP!`!a,d~,iOz~~,nOb~~,sTi~st,n!Q![,n!c!},n#R#S,n#T#o,n~-XVi~st,n!Q![,n!c!p,n!p!q-n!q!},n#R#S,n#T#o,n~-sVi~st,n!Q![,n!c!k,n!k!l.Y!l!},n#R#S,n#T#o,n~._Vi~st,n!Q![,n!c!v,n!v!w.t!w!},n#R#S,n#T#o,n~.yUi~st,n!Q![,n![!]/]!c!},n#R#S,n#T#o,n~/bS}~OY/]Z;'S/];'S;=`/n<%lO/]~/qP;=`<%l/]~/yXi~st,n!Q![,n!c!g,n!g!h0f!h!k,n!k!l2S!l!},n#R#S,n#T#o,n~0kVi~st,n!Q![,n!c!h,n!h!i1Q!i!},n#R#S,n#T#o,n~1VVi~st,n!Q![,n!c!v,n!v!w1l!w!},n#R#S,n#T#o,n~1sTh~i~st,n!Q![,n!c!},n#R#S,n#T#o,n~2XVi~st,n!Q![,n!c!p,n!p!q2n!q!},n#R#S,n#T#o,n~2wTq~h~i~st,n!Q![,n!c!},n#R#S,n#T#o,n~3]Vi~st,n!Q![,n!c!t,n!t!u3r!u!},n#R#S,n#T#o,n~3wVi~st,n!Q![,n!c!f,n!f!g2n!g!},n#R#S,n#T#o,n~4cVi~st,n!Q![,n!c!q,n!q!r4x!r!},n#R#S,n#T#o,n~4}Vi~st,n!Q![,n!c!u,n!u!v5d!v!},n#R#S,n#T#o,n~5iVi~st,n!Q![,n!c!n,n!n!o6O!o!},n#R#S,n#T#o,n~6TVi~st,n!Q![,n!c!q,n!q!r6j!r!},n#R#S,n#T#o,n~6oVi~st,n!Q![,n!c!p,n!p!q7U!q!},n#R#S,n#T#o,n~7ZVi~st,n!Q![,n!c!i,n!i!j2n!j!},n#R#S,n#T#o,n~7uXi~st,n!Q![,n!c!k,n!k!l8b!l!p,n!p!q3r!q!},n#R#S,n#T#o,n~8gVi~st,n!Q![,n!c!i,n!i!j8|!j!},n#R#S,n#T#o,n~9RVi~st,n!Q![,n!c!j,n!j!k1Q!k!},n#R#S,n#T#o,n~9mVi~st,n!Q![,n!c!w,n!w!x:S!x!},n#R#S,n#T#o,n~:XVi~st,n!Q![,n!c!d,n!d!e:n!e!},n#R#S,n#T#o,n~:wVq~h~i~st,n!Q!R,n!R!S2n!S![,n!c!},n#R#S,n#T#o,n~;cVi~st,n!Q![,n!c!g,n!g!h;x!h!},n#R#S,n#T#o,n~;}Vi~st,n!Q![,n!c!o,n!o!p2n!p!},n#R#S,n#T#o,n~<iPk~!Q![<l~<oQ!Q![<l#P#Q<u~<zOr~~=PP`~#T#o=S~=XTu~xy=h!Q![=S!c!}=S#R#S=S#T#o=S~=kTOy=hyz=zz;'S=h;'S;=`>P<%lO=h~>POu~~>SP;=`<%l=h~>[Vi~st,n!Q![,n!c!},n#R#S,n#T#f,n#f#g>q#g#o,n~>vUi~st,n!Q![,n!c!},n#R#S,n#T#U?Y#U#o,n~?_Vi~st,n!Q![,n!c!},n#R#S,n#T#a,n#a#b?t#b#o,n~?yTi~st@Y!Q![,n!c!},n#R#S,n#T#o,n~@_Ti~st,n!Q![@n!c!},n#R#S,n#T#o,n~@sUi~st,n!Q![@n!c!},n!}#OAV#R#S,n#T#o,n~AYP!Q![A]~A`Q!Q![A]#P#QAf~AkOs~~ApOd~~AsR!c!}A|#R#SA|#T#oA|~BPT!Q![A|!c!}A|#R#SA|#T#oA|#p#qB`~BeOx~",
  tokenizers: [0],
  topRules: { "Grammar": [0, 1] },
  tokenPrec: 92
});

// public/editor/bpscript-lang.js
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
var bpsHighlight = styleTags({
  LineComment: t.lineComment,
  Separator: t.processingInstruction,
  Directive: t.keyword,
  RulePrefix: t.labelName,
  Arrow: t.operator,
  BacktickCode: t.special(t.string),
  Variable: t.special(t.variableName),
  FlagExpr: t.annotation,
  Weight: t.meta,
  TypeKeyword: t.typeName,
  LambdaKeyword: t.keyword,
  Number: t.number,
  Symbol: t.variableName,
  Operator: t.punctuation
});
var bpsLang = LRLanguage.define({
  name: "bpscript",
  parser: parser.configure({ props: [bpsHighlight] }),
  languageData: {
    commentTokens: { line: "//" }
  }
});
var bpscriptLanguage = new LanguageSupport(bpsLang);
var bp3Highlight = styleTags({
  LineComment: t.lineComment,
  Separator: t.processingInstruction,
  ModeLine: t.keyword,
  RulePrefix: t.labelName,
  Arrow: t.operator,
  SpecialFn: t.function(t.variableName),
  Flag: t.annotation,
  Weight: t.meta,
  Variable: t.special(t.variableName),
  SpeedRatio: t.modifier,
  OutTimeObject: t.special(t.atom),
  TemplateRef: t.special(t.typeName),
  FileRef: t.link,
  InitDirective: t.processingInstruction,
  Tie: t.operator,
  Rest: t.null,
  Prolongation: t.null,
  Period: t.punctuation,
  Wildcard: t.atom,
  NilString: t.null,
  PolyBrace: t.brace,
  Mode: t.keyword,
  Number: t.number,
  Symbol: t.variableName,
  Operator: t.punctuation
});
var bp3Lang = LRLanguage.define({
  name: "bp3",
  parser: parser2.configure({ props: [bp3Highlight] }),
  languageData: {
    commentTokens: { line: "//" }
  }
});
var bp3Language = new LanguageSupport(bp3Lang);
export {
  bp3Language,
  bpscriptLanguage
};
