// Test ONE grammar in isolation. Reads _tmp_grammar.txt, _tmp_alphabet.txt, _tmp_settings.json
const fs = require('fs');
require('./bp3.js')().then(m => {
  const I = m.cwrap('bp3_init', 'number', []);
  const G = m.cwrap('bp3_load_grammar', 'number', ['string']);
  const A = m.cwrap('bp3_load_alphabet', 'number', ['string']);
  const S = m.cwrap('bp3_load_settings', 'number', ['string']);
  const P = m.cwrap('bp3_produce', 'number', []);
  const R = m.cwrap('bp3_get_result', 'string', []);
  const C = m.cwrap('bp3_get_midi_event_count', 'number', []);
  const E = m.cwrap('bp3_get_midi_events', 'string', []);
  const Mg = m.cwrap('bp3_get_messages', 'string', []);

  I(42);
  try { const se = fs.readFileSync('_tmp_settings.json', 'utf-8'); if (se.trim()) S(se); } catch {}
  try { const al = fs.readFileSync('_tmp_alphabet.txt', 'utf-8'); if (al.trim()) A(al); } catch {}
  G(fs.readFileSync('_tmp_grammar.txt', 'utf-8'));
  P();
  const midi = C();
  let notes = [];
  if (midi > 0) try { notes = JSON.parse(E()).filter(e => e.type === 144).map(e => e.note); } catch {}
  const res = R().trim();
  const err = /Errors: [1-9]/.test(Mg());
  const msg = Mg();
  console.log(JSON.stringify({ err, midi: notes.length, res: res.substring(0, 500), notes: notes.slice(0, 500), msg: msg.substring(0, 500) }));
}).catch(e => console.log(JSON.stringify({ error: e.message })));
