// Run original BP3 grammar with auxiliary files
// Reads from /tmp/_v44_gr.txt, /tmp/_v44_se.txt, /tmp/_v44_al.txt, /tmp/_v44_to.txt
var distDir = require('path').resolve(__dirname, '..', 'dist');
process.chdir(distDir);
var fs = require('fs');
require(require('path').join(distDir, 'bp3.js'))().then(function(bp3) {
    var I = bp3.cwrap('bp3_init', 'number', []);
    var G = bp3.cwrap('bp3_load_grammar', 'number', ['string']);
    var Se = bp3.cwrap('bp3_load_settings', 'number', ['string']);
    var A = bp3.cwrap('bp3_load_alphabet', 'number', ['string']);
    var To = bp3.cwrap('bp3_load_tonality', 'number', ['string']);
    var P = bp3.cwrap('bp3_produce', 'number', []);
    var MC = bp3.cwrap('bp3_get_midi_event_count', 'number', []);
    var E = bp3.cwrap('bp3_get_midi_events', 'string', []);
    var R = bp3.cwrap('bp3_get_result', 'string', []);
    var Mg = bp3.cwrap('bp3_get_messages', 'string', []);
    I();
    try { var se = fs.readFileSync('/tmp/_v44_se.txt', 'utf-8'); if (se.trim()) Se(se); } catch (e) {}
    try { var al = fs.readFileSync('/tmp/_v44_al.txt', 'utf-8'); if (al.trim()) A(al); } catch (e) {}
    try { var to = fs.readFileSync('/tmp/_v44_to.txt', 'utf-8'); if (to.trim()) To(to); } catch (e) {}
    G(fs.readFileSync('/tmp/_v44_gr.txt', 'utf-8'));
    try {
        var r = P(); var mc = MC(); var notes = [];
        if (mc > 0) try { notes = JSON.parse(E()).filter(function(e) { return e.type === 144; }).map(function(e) { return e.note; }); } catch (x) {}
        var text = R().trim();
        var msg = Mg();
        var errs = (msg.match(/Errors:\s*(\d+)/) || [])[1] || '0';
        process.stdout.write(JSON.stringify({ r: r, midi: mc, notes: notes, text: text.substring(0, 120), errs: parseInt(errs) }) + '\n');
    } catch (e) {
        process.stdout.write(JSON.stringify({ crash: e.constructor.name + ':' + e.message.substring(0, 40) }) + '\n');
    }
    process.exit(0);
}).catch(function(e) { process.stdout.write(JSON.stringify({ crash: 'FATAL:' + e.message.substring(0, 40) }) + '\n'); process.exit(0); });
setTimeout(function() { process.stdout.write(JSON.stringify({ crash: 'TIMEOUT' }) + '\n'); process.exit(0); }, 55000);
