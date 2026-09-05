export namespace SYNTAXE {
    let _source: string;
    let syntaxWords: {
        "->": {
            kind: string;
            description: string;
            syntax: string;
        };
        "<-": {
            kind: string;
            description: string;
            syntax: string;
        };
        "<>": {
            kind: string;
            description: string;
            syntax: string;
        };
    };
    namespace directiveValues {
        namespace mode {
            let description: string;
            let values: {
                name: string;
                description: string;
            }[];
        }
        namespace scan {
            let description_1: string;
            export { description_1 as description };
            let values_1: {
                name: string;
                description: string;
            }[];
            export { values_1 as values };
        }
    }
    namespace grammarWords {
        let description_2: string;
        export { description_2 as description };
        export let qualite: string;
        export let mots: string[];
        export namespace syntaxe {
            let description_3: string;
            export { description_3 as description };
            export let actor: string;
            export let core: string;
            export let def: string;
            let _in: string;
            export { _in as in };
            export let init: string;
            let mode_1: string;
            export { mode_1 as mode };
            export let out: string;
            export let seed: string;
            export let terminal: string;
        }
    }
    namespace bracketRewrites {
        let description_4: string;
        export { description_4 as description };
        let mots_1: string[];
        export { mots_1 as mots };
    }
    namespace actorKeyRewrites {
        let description_5: string;
        export { description_5 as description };
        let mots_2: string[];
        export { mots_2 as mots };
    }
}
