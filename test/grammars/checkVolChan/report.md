# checkVolChan — Test Report

Date: 2026-04-01
Result: **PASS → PASS → PASS → TODO**

## Source files

- `original.gr` — grammaire Bernard
- `silent.gr` — réécriture silent sound objects
- `silent.al` — alphabet plat

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 292 |
| S2 WASM orig | PASS | 0 |
| S3 WASM silent | PASS | 26 |
| S4 BPscript | TODO | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | _chan(5) @undefined |  | do4 3000-4000 |  |
| 1 | _chan(K1) @undefined |  | re4 4000-5000 |  |
| 2 | _chan(K1=2) @undefined |  | mi4 5000-6000 |  |
| 3 | _cresc @undefined |  | fa4 6000-7000 |  |
| 4 | _cresc @undefined |  | sol4 7000-8000 |  |
| 5 | _decresc @undefined |  | fa4 8000-9000 |  |
| 6 | _mod(0) @undefined |  | mi4 9000-10000 |  |
| 7 | _mod(127) @undefined |  | re4 10000-11000 |  |
| 8 | _press(0) @undefined |  | do4 11000-12000 |  |
| 9 | _press(16383) @undefined |  | re4 12000-13000 |  |
| 10 | _presstep @undefined |  | mi4 13000-14000 |  |
| 11 | _script(MIDI @undefined |  | fa4 14000-15000 |  |
| 12 | _script(MIDI @undefined |  | do4 15000-16000 |  |
| 13 | _script(MIDI @undefined |  | mi4 16000-17000 |  |
| 14 | _script(Wait @undefined |  | re4 17000-18000 |  |
| 15 | _vol(0) @undefined |  | fa4 18000-19000 |  |
| 16 | _vol(1) @undefined |  | sol4 19000-20000 |  |
| 17 | _vol(127) @undefined |  | si4 20000-21000 |  |
| 18 | _vol(30) @undefined |  | do5 21000-22000 |  |
| 19 | _vol(5) @undefined |  | do4 22000-23000 |  |
| 20 | _vol(70) @undefined |  | mi4 23000-24000 |  |
| 21 | _vol(K9=127) @undefined |  | re4 24000-25000 |  |
| 22 | --> @undefined |  | fa4 25000-26000 |  |
| 23 | --> @undefined |  | sol4 22000-23333 |  |
| 24 | --> @undefined |  | si4 23333-24666 |  |
| 25 | --> @undefined |  | do5 24666-26000 |  |
| 26 | --> @undefined |  |  |  |
| 27 | --> @undefined |  |  |  |
| 28 | ??? @undefined |  |  |  |
| 29 | ??? @undefined |  |  |  |
| 30 | ??? @undefined |  |  |  |
| 31 | ??? @undefined |  |  |  |
| 32 | ??? @undefined |  |  |  |
| 33 | ??? @undefined |  |  |  |
| 34 | '|'. @undefined |  |  |  |
| 35 | '|'. @undefined |  |  |  |
| 36 | '|'. @undefined |  |  |  |
| 37 | '|'. @undefined |  |  |  |
| 38 | “MIDI @undefined |  |  |  |
| 39 | “MIDI @undefined |  |  |  |
| 40 | "vol(1)". @undefined |  |  |  |
| 41 | "vol(30)". @undefined |  |  |  |
| 42 | "vol(5)". @undefined |  |  |  |
| 43 | "vol(70)". @undefined |  |  |  |
| 44 | “Wait @undefined |  |  |  |
| 45 | “Wait @undefined |  |  |  |
| 46 | [1..128] @undefined |  |  |  |
| 47 | [X-11: @undefined |  |  |  |
| 48 | {_chan(K1=2) @undefined |  |  |  |
| 49 | {Part1 @undefined |  |  |  |
| 50 | {Part3} @undefined |  |  |  |
| 51 | #98 @undefined |  |  |  |
| 52 | = @undefined |  |  |  |
| 53 | >>> @undefined |  |  |  |
| 54 | >>> @undefined |  |  |  |
| 55 | 0 @undefined |  |  |  |
| 56 | 0 @undefined |  |  |  |
| 57 | 0 @undefined |  |  |  |
| 58 | 0 @undefined |  |  |  |
| 59 | 1 @undefined |  |  |  |
| 60 | 1 @undefined |  |  |  |
| 61 | 1” @undefined |  |  |  |
| 62 | 1” @undefined |  |  |  |
| 63 | 1) @undefined |  |  |  |
| 64 | 1) @undefined |  |  |  |
| 65 | 2) @undefined |  |  |  |
| 66 | aborted @undefined |  |  |  |
| 67 | aborted @undefined |  |  |  |
| 68 | all @undefined |  |  |  |
| 69 | be @undefined |  |  |  |
| 70 | be @undefined |  |  |  |
| 71 | be @undefined |  |  |  |
| 72 | be @undefined |  |  |  |
| 73 | blue @undefined |  |  |  |
| 74 | Can't @undefined |  |  |  |
| 75 | Can't @undefined |  |  |  |
| 76 | Can't @undefined |  |  |  |
| 77 | Can't @undefined |  |  |  |
| 78 | channel @undefined |  |  |  |
| 79 | channel @undefined |  |  |  |
| 80 | channel @undefined |  |  |  |
| 81 | channel @undefined |  |  |  |
| 82 | channel @undefined |  |  |  |
| 83 | channel @undefined |  |  |  |
| 84 | character @undefined |  |  |  |
| 85 | character @undefined |  |  |  |
| 86 | character @undefined |  |  |  |
| 87 | character @undefined |  |  |  |
| 88 | controller @undefined |  |  |  |
| 89 | convention? @undefined |  |  |  |
| 90 | convention? @undefined |  |  |  |
| 91 | convention? @undefined |  |  |  |
| 92 | convention? @undefined |  |  |  |
| 93 | do4 @undefined |  |  |  |
| 94 | do4 @undefined |  |  |  |
| 95 | do4 @undefined |  |  |  |
| 96 | do4 @undefined |  |  |  |
| 97 | do4 @undefined |  |  |  |
| 98 | do4 @undefined |  |  |  |
| 99 | do4 @undefined |  |  |  |
| 100 | do4 @undefined |  |  |  |
| 101 | do4 @undefined |  |  |  |
| 102 | do4 @undefined |  |  |  |
| 103 | do4 @undefined |  |  |  |
| 104 | do4 @undefined |  |  |  |
| 105 | do4 @undefined |  |  |  |
| 106 | do4 @undefined |  |  |  |
| 107 | do4 @undefined |  |  |  |
| 108 | do4 @undefined |  |  |  |
| 109 | do4 @undefined |  |  |  |
| 110 | do4 @undefined |  |  |  |
| 111 | do4 @undefined |  |  |  |
| 112 | do4 @undefined |  |  |  |
| 113 | do4 @undefined |  |  |  |
| 114 | fa4 @undefined |  |  |  |
| 115 | fa4 @undefined |  |  |  |
| 116 | fa4 @undefined |  |  |  |
| 117 | fa4 @undefined |  |  |  |
| 118 | fa4 @undefined |  |  |  |
| 119 | fa4 @undefined |  |  |  |
| 120 | fa4 @undefined |  |  |  |
| 121 | fa4 @undefined |  |  |  |
| 122 | fa4 @undefined |  |  |  |
| 123 | fa4 @undefined |  |  |  |
| 124 | fa4 @undefined |  |  |  |
| 125 | fa4 @undefined |  |  |  |
| 126 | fa4 @undefined |  |  |  |
| 127 | for @undefined |  |  |  |
| 128 | for @undefined |  |  |  |
| 129 | for @undefined |  |  |  |
| 130 | for @undefined |  |  |  |
| 131 | g @undefined |  |  |  |
| 132 | g” @undefined |  |  |  |
| 133 | g” @undefined |  |  |  |
| 134 | g) @undefined |  |  |  |
| 135 | GRAM#1[2] @undefined |  |  |  |
| 136 | GRAM#1[3] @undefined |  |  |  |
| 137 | GRAM#1[4] @undefined |  |  |  |
| 138 | GRAM#1[6] @undefined |  |  |  |
| 139 | GRAM#1[7] @undefined |  |  |  |
| 140 | GRAM#1[8] @undefined |  |  |  |
| 141 | incorrect @undefined |  |  |  |
| 142 | incorrect @undefined |  |  |  |
| 143 | incorrect @undefined |  |  |  |
| 144 | incorrect @undefined |  |  |  |
| 145 | Init @undefined |  |  |  |
| 146 | Init @undefined |  |  |  |
| 147 | instruction @undefined |  |  |  |
| 148 | instruction @undefined |  |  |  |
| 149 | instruction @undefined |  |  |  |
| 150 | instruction @undefined |  |  |  |
| 151 | is @undefined |  |  |  |
| 152 | is @undefined |  |  |  |
| 153 | is @undefined |  |  |  |
| 154 | is @undefined |  |  |  |
| 155 | jazz] @undefined |  |  |  |
| 156 | make @undefined |  |  |  |
| 157 | make @undefined |  |  |  |
| 158 | make @undefined |  |  |  |
| 159 | make @undefined |  |  |  |
| 160 | May @undefined |  |  |  |
| 161 | May @undefined |  |  |  |
| 162 | May @undefined |  |  |  |
| 163 | May @undefined |  |  |  |
| 164 | mi4 @undefined |  |  |  |
| 165 | mi4 @undefined |  |  |  |
| 166 | mi4 @undefined |  |  |  |
| 167 | mi4 @undefined |  |  |  |
| 168 | mi4 @undefined |  |  |  |
| 169 | mi4 @undefined |  |  |  |
| 170 | mi4 @undefined |  |  |  |
| 171 | mi4 @undefined |  |  |  |
| 172 | mi4 @undefined |  |  |  |
| 173 | mi4 @undefined |  |  |  |
| 174 | mi4 @undefined |  |  |  |
| 175 | mi4 @undefined |  |  |  |
| 176 | mi4 @undefined |  |  |  |
| 177 | MIDI @undefined |  |  |  |
| 178 | must @undefined |  |  |  |
| 179 | must @undefined |  |  |  |
| 180 | must @undefined |  |  |  |
| 181 | must @undefined |  |  |  |
| 182 | not @undefined |  |  |  |
| 183 | not @undefined |  |  |  |
| 184 | not @undefined |  |  |  |
| 185 | not @undefined |  |  |  |
| 186 | note @undefined |  |  |  |
| 187 | note @undefined |  |  |  |
| 188 | note @undefined |  |  |  |
| 189 | note @undefined |  |  |  |
| 190 | note @undefined |  |  |  |
| 191 | notes @undefined |  |  |  |
| 192 | Number @undefined |  |  |  |
| 193 | of @undefined |  |  |  |
| 194 | of @undefined |  |  |  |
| 195 | of @undefined |  |  |  |
| 196 | of @undefined |  |  |  |
| 197 | of @undefined |  |  |  |
| 198 | off @undefined |  |  |  |
| 199 | on: @undefined |  |  |  |
| 200 | on: @undefined |  |  |  |
| 201 | or @undefined |  |  |  |
| 202 | or @undefined |  |  |  |
| 203 | or @undefined |  |  |  |
| 204 | or @undefined |  |  |  |
| 205 | or @undefined |  |  |  |
| 206 | or @undefined |  |  |  |
| 207 | or @undefined |  |  |  |
| 208 | or @undefined |  |  |  |
| 209 | out @undefined |  |  |  |
| 210 | Part1 @undefined |  |  |  |
| 211 | Part2 @undefined |  |  |  |
| 212 | Part2,_vol(54) @undefined |  |  |  |
| 213 | Part2} @undefined |  |  |  |
| 214 | Part3} @undefined |  |  |  |
| 215 | program @undefined |  |  |  |
| 216 | program @undefined |  |  |  |
| 217 | program @undefined |  |  |  |
| 218 | program @undefined |  |  |  |
| 219 | range @undefined |  |  |  |
| 220 | re4 @undefined |  |  |  |
| 221 | re4 @undefined |  |  |  |
| 222 | re4 @undefined |  |  |  |
| 223 | re4 @undefined |  |  |  |
| 224 | re4 @undefined |  |  |  |
| 225 | re4 @undefined |  |  |  |
| 226 | re4 @undefined |  |  |  |
| 227 | re4 @undefined |  |  |  |
| 228 | re4 @undefined |  |  |  |
| 229 | re4 @undefined |  |  |  |
| 230 | re4 @undefined |  |  |  |
| 231 | re4 @undefined |  |  |  |
| 232 | re4 @undefined |  |  |  |
| 233 | S @undefined |  |  |  |
| 234 | script @undefined |  |  |  |
| 235 | script @undefined |  |  |  |
| 236 | script @undefined |  |  |  |
| 237 | script @undefined |  |  |  |
| 238 | Script @undefined |  |  |  |
| 239 | Script @undefined |  |  |  |
| 240 | sense @undefined |  |  |  |
| 241 | sense @undefined |  |  |  |
| 242 | sense @undefined |  |  |  |
| 243 | sense @undefined |  |  |  |
| 244 | sol4 @undefined |  |  |  |
| 245 | sol4 @undefined |  |  |  |
| 246 | sol4 @undefined |  |  |  |
| 247 | sol4 @undefined |  |  |  |
| 248 | start @undefined |  |  |  |
| 249 | start @undefined |  |  |  |
| 250 | start @undefined |  |  |  |
| 251 | start @undefined |  |  |  |
| 252 | symbol, @undefined |  |  |  |
| 253 | symbol, @undefined |  |  |  |
| 254 | symbol, @undefined |  |  |  |
| 255 | symbol, @undefined |  |  |  |
| 256 | terminal @undefined |  |  |  |
| 257 | terminal @undefined |  |  |  |
| 258 | terminal @undefined |  |  |  |
| 259 | terminal @undefined |  |  |  |
| 260 | The @undefined |  |  |  |
| 261 | This @undefined |  |  |  |
| 262 | This @undefined |  |  |  |
| 263 | This @undefined |  |  |  |
| 264 | This @undefined |  |  |  |
| 265 | time-pattern @undefined |  |  |  |
| 266 | time-pattern @undefined |  |  |  |
| 267 | time-pattern @undefined |  |  |  |
| 268 | time-pattern @undefined |  |  |  |
| 269 | TryAlsoThis @undefined |  |  |  |
| 270 | TryAlsoThis2 @undefined |  |  |  |
| 271 | unknown @undefined |  |  |  |
| 272 | unknown @undefined |  |  |  |
| 273 | unknown @undefined |  |  |  |
| 274 | unknown @undefined |  |  |  |
| 275 | uppercase @undefined |  |  |  |
| 276 | uppercase @undefined |  |  |  |
| 277 | uppercase @undefined |  |  |  |
| 278 | uppercase @undefined |  |  |  |
| 279 | valid: @undefined |  |  |  |
| 280 | valid: @undefined |  |  |  |
| 281 | valid: @undefined |  |  |  |
| 282 | valid: @undefined |  |  |  |
| 283 | Variable @undefined |  |  |  |
| 284 | Variable @undefined |  |  |  |
| 285 | Variable @undefined |  |  |  |
| 286 | Variable @undefined |  |  |  |
| 287 | Wait @undefined |  |  |  |
| 288 | with @undefined |  |  |  |
| 289 | with @undefined |  |  |  |
| 290 | with @undefined |  |  |  |
| 291 | with @undefined |  |  |  |

## Settings

NoteConvention=1, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
