export function describeVocabulary(directives?: any[]): {
    voices: any;
    keywords: any[];
    controls: {
        name: string;
    }[];
    values: {
        name: string;
    }[];
    functions: any[];
    components: {};
    addressKeys: any[];
    qualifierKeys: any[];
    directiveValues: {
        mode: {
            description: string;
            values: {
                name: string;
                description: string;
            }[];
        };
        scan: {
            description: string;
            values: {
                name: string;
                description: string;
            }[];
        };
    };
    syntaxWords: {
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
};
