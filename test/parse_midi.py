"""Parse MIDI file and output NoteOn/NoteOff events as JSON.
Output: [[name, start_ms, end_ms], ...] sorted by start time then name.
NoteOff is matched to the earliest unmatched NoteOn of the same pitch."""
import struct, json, sys

midi_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/_s1_output.mid'
with open(midi_path, 'rb') as f:
    data = f.read()

if data[:4] != b'MThd':
    print('[]')
    sys.exit()

division = struct.unpack('>H', data[12:14])[0]
pos = 8 + struct.unpack('>I', data[4:8])[0]
nn = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

# Tempo map: list of (tick, tempo_us) — default 500000 us/beat = 120 BPM
tempo_map = [(0, 500000)]

# Collect all NoteOn and NoteOff events
raw_events = []  # (tick, type, note_num, name)

for track in range(struct.unpack('>H', data[10:12])[0]):
    if pos >= len(data) or data[pos:pos+4] != b'MTrk':
        break
    tlen = struct.unpack('>I', data[pos+4:pos+8])[0]
    td = data[pos+8:pos+8+tlen]
    pos += 8 + tlen
    tick = 0
    i = 0
    rs = 0

    while i < len(td):
        # Read delta time
        delta = 0
        while i < len(td):
            b = td[i]; i += 1
            delta = (delta << 7) | (b & 0x7F)
            if not (b & 0x80):
                break
        tick += delta
        if i >= len(td):
            break

        st = td[i]
        if st == 0xFF:  # Meta event
            i += 1
            meta_type = td[i]; i += 1
            l = 0
            while i < len(td):
                b = td[i]; i += 1
                l = (l << 7) | (b & 0x7F)
                if not (b & 0x80):
                    break
            if meta_type == 0x51 and l == 3:  # Set Tempo
                tempo_us = (td[i] << 16) | (td[i+1] << 8) | td[i+2]
                tempo_map.append((tick, tempo_us))
            i += l
        elif st & 0x80:
            rs = st; i += 1
            if (st & 0xF0) in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                d1 = td[i]; i += 1
                d2 = td[i]; i += 1
                name = nn[d1 % 12] + str(d1 // 12 - 1)
                if (st & 0xF0) == 0x90 and d2 > 0:
                    raw_events.append((tick, 'on', d1, name))
                elif (st & 0xF0) == 0x80 or ((st & 0xF0) == 0x90 and d2 == 0):
                    raw_events.append((tick, 'off', d1, name))
            elif (st & 0xF0) in (0xC0, 0xD0):
                i += 1
        else:
            d1 = st; i += 1
            if (rs & 0xF0) in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                d2 = td[i]; i += 1
                name = nn[d1 % 12] + str(d1 // 12 - 1)
                ms = tick * 1000 // division
                if (rs & 0xF0) == 0x90 and d2 > 0:
                    raw_events.append((ms, 'on', d1, name))
                elif (rs & 0xF0) == 0x80 or ((rs & 0xF0) == 0x90 and d2 == 0):
                    raw_events.append((ms, 'off', d1, name))

# Convert ticks to ms using tempo map
def tick_to_ms(tick):
    ms = 0.0
    prev_tick = 0
    prev_tempo = 500000  # default 120 BPM
    for map_tick, map_tempo in tempo_map:
        if map_tick >= tick:
            break
        ms += (map_tick - prev_tick) * prev_tempo / (division * 1000.0)
        prev_tick = map_tick
        prev_tempo = map_tempo
    ms += (tick - prev_tick) * prev_tempo / (division * 1000.0)
    return int(round(ms))

# Recompute all event times using tempo map
raw_events = [(tick_to_ms(tick), typ, note_num, name) for tick, typ, note_num, name in raw_events]

# Match NoteOn with NoteOff to get durations
pending = {}  # note_num → [start_ms, ...]
result = []

for ms, typ, note_num, name in raw_events:
    if typ == 'on':
        if note_num not in pending:
            pending[note_num] = []
        pending[note_num].append(ms)
    elif typ == 'off':
        if note_num in pending and len(pending[note_num]) > 0:
            start = pending[note_num].pop(0)
            result.append([name, start, ms, note_num])

# Sort by start time, then note number
result.sort(key=lambda x: (x[1], x[3]))

# Output: {"tokens": [[name, start, end], ...], "midi": [[note, start, end], ...]}
tokens = [[r[0], r[1], r[2]] for r in result]
midi = [[r[3], r[1], r[2]] for r in result]
print(json.dumps({"tokens": tokens, "midi": midi}))
