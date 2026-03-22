// Run transpiled BPscript grammar
// Reads from /tmp/_v44_tgr.txt, /tmp/_v44_tal.txt
var distDir = require('path').resolve(__dirname, '..', 'dist');
process.chdir(distDir);
var fs = require('fs');
require(require('path').join(distDir, 'bp3.js'))().then(function(bp3) {
    var I = bp3.cwrap('bp3_init', 'number', []);
    var G = bp3.cwrap('bp3_load_grammar', 'number', ['string']);
    var A = bp3.cwrap('bp3_load_alphabet', 'number', ['string']);
    var P = bp3.cwrap('bp3_produce', 'number', []);
    var TC = bp3.cwrap('bp3_get_timed_token_count', 'number', []);
    var T = bp3.cwrap('bp3_get_timed_tokens', 'string', []);
    var R = bp3.cwrap('bp3_get_result', 'string', []);
    var Mg = bp3.cwrap('bp3_get_messages', 'string', []);
    I();
    try { var al = fs.readFileSync('/tmp/_v44_tal.txt', 'utf-8'); if (al.trim()) A(al); } catch (e) {}
    G(fs.readFileSync('/tmp/_v44_tgr.txt', 'utf-8'));
    try {
        var r = P(); var tc = TC(); var tokens = [];
        try { tokens = JSON.parse(T()).filter(function(t) { return t.token !== '-' && !t.token.startsWith('_'); }); } catch (x) {}
        var text = R().trim();
        var msg = Mg();
        var errs = (msg.match(/Errors:\s*(\d+)/) || [])[1] || '0';
        process.stdout.write(JSON.stringify({ r: r, tc: tc, tokens: tokens.length, text: text.substring(0, 120), errs: parseInt(errs) }) + '\n');
    } catch (e) {
        process.stdout.write(JSON.stringify({ crash: e.constructor.name + ':' + e.message.substring(0, 40) }) + '\n');
    }
    process.exit(0);
}).catch(function(e) { process.stdout.write(JSON.stringify({ crash: 'FATAL:' + e.message.substring(0, 40) }) + '\n'); process.exit(0); });
setTimeout(function() { process.stdout.write(JSON.stringify({ crash: 'TIMEOUT' }) + '\n'); process.exit(0); }, 55000);
