const fs = require('fs');
const BP3 = require('./bp3.js');
BP3().then(m => {
  const I = m.cwrap('bp3_init', 'number', []);
  const G = m.cwrap('bp3_load_grammar', 'number', ['string']);
  const A = m.cwrap('bp3_load_alphabet', 'number', ['string']);
  const P = m.cwrap('bp3_produce', 'number', []);
  const R = m.cwrap('bp3_get_result', 'string', []);
  const Mg = m.cwrap('bp3_get_messages', 'string', []);
  const C = m.cwrap('bp3_get_midi_event_count', 'number', []);
  const E = m.cwrap('bp3_get_midi_events', 'string', []);

  function stripFileRefs(text) {
    return text.replace(/\r/g, '\n').split('\n')
      .filter(l => !/^-[a-z]{2}\./.test(l.trim())).join('\n');
  }

  // Test original (strip -se. -al. -ho. etc.)
  const origRaw = fs.readFileSync('_tmp_orig.txt', 'utf-8');
  const origClean = stripFileRefs(origRaw);

  const al = fs.readFileSync('_tmp_alphabet.txt', 'utf-8');

  I(42);
  if (al) A(al);
  G(origClean);
  P();
  const origErr = /Errors: [1-9]/.test(Mg());
  const origRes = R().trim();
  const origMidi = C();
  let origNotes = [];
  if (origMidi > 0) try { origNotes = JSON.parse(E()).filter(e => e.type === 144).map(e => e.note); } catch {}

  // Test transpiled
  I(42);
  if (al) A(al);
  G(fs.readFileSync('_tmp_grammar.txt', 'utf-8'));
  P();
  const transErr = /Errors: [1-9]/.test(Mg());
  const transRes = R().trim();
  const transMidi = C();
  let transNotes = [];
  if (transMidi > 0) try { transNotes = JSON.parse(E()).filter(e => e.type === 144).map(e => e.note); } catch {}

  const midiMatch = origNotes.length === transNotes.length && origNotes.every((n, i) => n === transNotes[i]);

  console.log(JSON.stringify({
    origErr, origRes: origRes.substring(0, 500), origMidi: origNotes.length,
    transErr, transRes: transRes.substring(0, 500), transMidi: transNotes.length,
    match: origRes === transRes, midiMatch
  }));
}).catch(e => console.log(JSON.stringify({ error: e.message })));
