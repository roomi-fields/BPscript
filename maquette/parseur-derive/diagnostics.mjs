// ⚠️ MESURE HONNÊTE — la première passait par les réglages PAR DÉFAUT et concluait « inutilisable ».
// Ici on branche le point d'accroche que l'outil expose, et on repose les MÊMES trois fautes.
import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem,
         LangiumParserErrorMessageProvider } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';

// LE TROISIÈME FORMALISME, en miniature : un catalogue de diagnostics tenu à part, qui traduit
// « ce que la grammaire attendait » en « ce que l'auteur doit écrire ».
const CATALOGUE = {
  Arrow: "une règle relie sa tête à son membre droit par une flèche — '->', '<-' ou '<>'",
  RhsElement: "un membre droit ne peut pas être vide : il attend au moins un terminal, un silence, une prolongation ou un groupe",
  "'}'": "ce groupe n'est jamais refermé — il manque son accolade fermante",
};

class Messages extends LangiumParserErrorMessageProvider {
  buildMismatchTokenMessage(o) {
    const attendu = o.expected?.name ?? '?';
    return CATALOGUE[attendu] ?? `attendu : ${attendu}`;
  }
  buildNoViableAltMessage(o) {
    const noms = (o.expectedPathsPerAlt || []).flat().flat().map((t) => t?.name).filter(Boolean);
    for (const n of noms) if (CATALOGUE[n]) return CATALOGUE[n];
    return `aucune écriture connue ne commence ainsi — attendu l'un de : ${[...new Set(noms)].slice(0, 5).join(', ')}`;
  }
  buildEarlyExitMessage(o) {
    const noms = (o.expectedIterationPaths || []).flat().map((t) => t?.name).filter(Boolean);
    for (const n of noms) if (CATALOGUE[n]) return CATALOGUE[n];
    return `il en faut au moins un — attendu : ${[...new Set(noms)].slice(0, 5).join(', ')}`;
  }
}

const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule,
  { parser: { ParserErrorMessageProvider: () => new Messages() } });
shared.ServiceRegistry.register(services);
const parse = (t) => services.parser.LangiumParser.parse(t);

console.log('=== LES MÊMES TROIS FAUTES, avec le catalogue branché ===\n');
for (const s of ['S -> \n', 'S C4 D4\n', 'S -> {A B, C\n']) {
  const e = [...(parse(s).lexerErrors || []), ...(parse(s).parserErrors || [])][0];
  const t = e?.token;
  console.log('  ' + JSON.stringify(s.replace(/\n/g, '⏎')));
  console.log('     ligne ' + (t?.startLine ?? '?') + ', colonne ' + (t?.startColumn ?? '?')
              + ' — ' + (e?.message || '').replace(/\s+/g, ' ').slice(0, 100));
}
