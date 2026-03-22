const fs = require('fs');
require('./bp3.js')().then(m => {
  const I = m.cwrap('bp3_init', 'number', []);
  const G = m.cwrap('bp3_load_grammar', 'number', ['string']);
  const A = m.cwrap('bp3_load_alphabet', 'number', ['string']);
  const SP = m.cwrap('bp3_load_settings_params', 'number', ['number','number','number','number','number','number']);
  const P = m.cwrap('bp3_produce', 'number', []);
  const R = m.cwrap('bp3_get_result', 'string', []);
  const C = m.cwrap('bp3_get_midi_event_count', 'number', []);
  const E = m.cwrap('bp3_get_midi_events', 'string', []);
  const Mg = m.cwrap('bp3_get_messages', 'string', []);

  const nc = parseInt(process.env.NOTE_CONV || '0');

  I(42);
  SP(nc, 10, 10, 1, 0, 60);
  try { const al = fs.readFileSync('_tmp_alphabet.txt', 'utf-8'); if (al.trim()) A(al); } catch {}
  G(fs.readFileSync('_tmp_grammar.txt', 'utf-8'));
  P();
  const midi = C();
  let notes = [];
  if (midi > 0) try { notes = JSON.parse(E()).filter(e => e.type === 144).map(e => e.note); } catch {}
  const res = R().trim();
  const err = /Errors: [1-9]/.test(Mg());
  console.log(JSON.stringify({ err, midi: notes.length, res: res.substring(0, 200), msg: Mg().substring(0, 300) }));
}).catch(e => console.log(JSON.stringify({ error: e.message })));
