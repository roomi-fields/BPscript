# tryAllItems1 — Test Report

Date: 2026-03-30
Result: **PASS**

## Source files

- `original.gr` — grammaire Bernard
- `silent.gr` — réécriture silent sound objects
- `silent.al` — alphabet plat
- `scene.bps` — scène BPscript

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 314 |
| S2 WASM orig | PASS | 134 |
| S3 WASM silent | PASS | 134 |
| S4 BPscript | PASS | 2 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C3 @undefined | C3 undefined-undefined | C3 0-0 | C4 0-1000 |
| 1 | C3 @undefined | C3 undefined-undefined | C3 0-0 | D6 1000-2000 |
| 2 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 3 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 4 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 5 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 6 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 7 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 8 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 9 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 10 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 11 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 12 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 13 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 14 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 15 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 16 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 17 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 18 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 19 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 20 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 21 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 22 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 23 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 24 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 25 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 26 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 27 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 28 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 29 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 30 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 31 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 32 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 33 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 34 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 35 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 36 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 37 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 38 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 39 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 40 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 41 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 42 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 43 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 44 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 45 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 46 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 47 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 48 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 49 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 50 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 51 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 52 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 53 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 54 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 55 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 56 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 57 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 58 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 59 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 60 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 61 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 62 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 63 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 64 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 65 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 66 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 67 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 68 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 69 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 70 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 71 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 72 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 73 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 74 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 75 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 76 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 77 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 78 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 79 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 80 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 81 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 82 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 83 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 84 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 85 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 86 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 87 | C3 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 88 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 89 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 90 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 91 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 92 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 93 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 94 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 95 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 96 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 97 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 98 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 99 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 100 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 101 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 102 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 103 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 104 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 105 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 106 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 107 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 108 | C3 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 109 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 110 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 111 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 112 | C3 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 113 | C3 @undefined | C3 undefined-undefined | C3 0-0 |  |
| 114 | C3 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 115 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 116 | C4 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 117 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 118 | C4 @undefined | C4 undefined-undefined | C4 0-0 |  |
| 119 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 120 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 121 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 122 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 123 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 124 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 125 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 126 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 127 | C4 @undefined | D3 undefined-undefined | D3 0-0 |  |
| 128 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 129 | C4 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 130 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 131 | C4 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 132 | C4 @undefined | C5 undefined-undefined | C5 0-0 |  |
| 133 | C4 @undefined | D6 undefined-undefined | D6 0-0 |  |
| 134 | C4 @undefined |  |  |  |
| 135 | C4 @undefined |  |  |  |
| 136 | C4 @undefined |  |  |  |
| 137 | C4 @undefined |  |  |  |
| 138 | C4 @undefined |  |  |  |
| 139 | C4 @undefined |  |  |  |
| 140 | C4 @undefined |  |  |  |
| 141 | C4 @undefined |  |  |  |
| 142 | C5 @undefined |  |  |  |
| 143 | C5 @undefined |  |  |  |
| 144 | C5 @undefined |  |  |  |
| 145 | C5 @undefined |  |  |  |
| 146 | C5 @undefined |  |  |  |
| 147 | C5 @undefined |  |  |  |
| 148 | C5 @undefined |  |  |  |
| 149 | C5 @undefined |  |  |  |
| 150 | C5 @undefined |  |  |  |
| 151 | C5 @undefined |  |  |  |
| 152 | C5 @undefined |  |  |  |
| 153 | C5 @undefined |  |  |  |
| 154 | C5 @undefined |  |  |  |
| 155 | C5 @undefined |  |  |  |
| 156 | C5 @undefined |  |  |  |
| 157 | C5 @undefined |  |  |  |
| 158 | C5 @undefined |  |  |  |
| 159 | C5 @undefined |  |  |  |
| 160 | C5 @undefined |  |  |  |
| 161 | C5 @undefined |  |  |  |
| 162 | C5 @undefined |  |  |  |
| 163 | C5 @undefined |  |  |  |
| 164 | C5 @undefined |  |  |  |
| 165 | C5 @undefined |  |  |  |
| 166 | C5 @undefined |  |  |  |
| 167 | C5 @undefined |  |  |  |
| 168 | C5 @undefined |  |  |  |
| 169 | C5 @undefined |  |  |  |
| 170 | C5 @undefined |  |  |  |
| 171 | C5 @undefined |  |  |  |
| 172 | C5 @undefined |  |  |  |
| 173 | C5 @undefined |  |  |  |
| 174 | C5 @undefined |  |  |  |
| 175 | C5 @undefined |  |  |  |
| 176 | C5 @undefined |  |  |  |
| 177 | C5 @undefined |  |  |  |
| 178 | C5 @undefined |  |  |  |
| 179 | C5 @undefined |  |  |  |
| 180 | C5 @undefined |  |  |  |
| 181 | C5 @undefined |  |  |  |
| 182 | C5 @undefined |  |  |  |
| 183 | C5 @undefined |  |  |  |
| 184 | C5 @undefined |  |  |  |
| 185 | C5 @undefined |  |  |  |
| 186 | C5 @undefined |  |  |  |
| 187 | D3 @undefined |  |  |  |
| 188 | D3 @undefined |  |  |  |
| 189 | D3 @undefined |  |  |  |
| 190 | D3 @undefined |  |  |  |
| 191 | D3 @undefined |  |  |  |
| 192 | D3 @undefined |  |  |  |
| 193 | D3 @undefined |  |  |  |
| 194 | D3 @undefined |  |  |  |
| 195 | D3 @undefined |  |  |  |
| 196 | D3 @undefined |  |  |  |
| 197 | D3 @undefined |  |  |  |
| 198 | D3 @undefined |  |  |  |
| 199 | D3 @undefined |  |  |  |
| 200 | D3 @undefined |  |  |  |
| 201 | D3 @undefined |  |  |  |
| 202 | D3 @undefined |  |  |  |
| 203 | D3 @undefined |  |  |  |
| 204 | D3 @undefined |  |  |  |
| 205 | D3 @undefined |  |  |  |
| 206 | D3 @undefined |  |  |  |
| 207 | D3 @undefined |  |  |  |
| 208 | D3 @undefined |  |  |  |
| 209 | D3 @undefined |  |  |  |
| 210 | D3 @undefined |  |  |  |
| 211 | D3 @undefined |  |  |  |
| 212 | D3 @undefined |  |  |  |
| 213 | D3 @undefined |  |  |  |
| 214 | D3 @undefined |  |  |  |
| 215 | D3 @undefined |  |  |  |
| 216 | D3 @undefined |  |  |  |
| 217 | D3 @undefined |  |  |  |
| 218 | D3 @undefined |  |  |  |
| 219 | D3 @undefined |  |  |  |
| 220 | D3 @undefined |  |  |  |
| 221 | D3 @undefined |  |  |  |
| 222 | D3 @undefined |  |  |  |
| 223 | D3 @undefined |  |  |  |
| 224 | D3 @undefined |  |  |  |
| 225 | D3 @undefined |  |  |  |
| 226 | D3 @undefined |  |  |  |
| 227 | D3 @undefined |  |  |  |
| 228 | D3 @undefined |  |  |  |
| 229 | D3 @undefined |  |  |  |
| 230 | D3 @undefined |  |  |  |
| 231 | D3 @undefined |  |  |  |
| 232 | D3 @undefined |  |  |  |
| 233 | D3 @undefined |  |  |  |
| 234 | D3 @undefined |  |  |  |
| 235 | D3 @undefined |  |  |  |
| 236 | D3 @undefined |  |  |  |
| 237 | D3 @undefined |  |  |  |
| 238 | D3 @undefined |  |  |  |
| 239 | D3 @undefined |  |  |  |
| 240 | D3 @undefined |  |  |  |
| 241 | D3 @undefined |  |  |  |
| 242 | D3 @undefined |  |  |  |
| 243 | D3 @undefined |  |  |  |
| 244 | D3 @undefined |  |  |  |
| 245 | D3 @undefined |  |  |  |
| 246 | D3 @undefined |  |  |  |
| 247 | D6 @undefined |  |  |  |
| 248 | D6 @undefined |  |  |  |
| 249 | D6 @undefined |  |  |  |
| 250 | D6 @undefined |  |  |  |
| 251 | D6 @undefined |  |  |  |
| 252 | D6 @undefined |  |  |  |
| 253 | D6 @undefined |  |  |  |
| 254 | D6 @undefined |  |  |  |
| 255 | D6 @undefined |  |  |  |
| 256 | D6 @undefined |  |  |  |
| 257 | D6 @undefined |  |  |  |
| 258 | D6 @undefined |  |  |  |
| 259 | D6 @undefined |  |  |  |
| 260 | D6 @undefined |  |  |  |
| 261 | D6 @undefined |  |  |  |
| 262 | D6 @undefined |  |  |  |
| 263 | D6 @undefined |  |  |  |
| 264 | D6 @undefined |  |  |  |
| 265 | D6 @undefined |  |  |  |
| 266 | D6 @undefined |  |  |  |
| 267 | D6 @undefined |  |  |  |
| 268 | D6 @undefined |  |  |  |
| 269 | D6 @undefined |  |  |  |
| 270 | D6 @undefined |  |  |  |
| 271 | D6 @undefined |  |  |  |
| 272 | D6 @undefined |  |  |  |
| 273 | D6 @undefined |  |  |  |
| 274 | S @undefined |  |  |  |
| 275 | T @undefined |  |  |  |
| 276 | T @undefined |  |  |  |
| 277 | T @undefined |  |  |  |
| 278 | T @undefined |  |  |  |
| 279 | T @undefined |  |  |  |
| 280 | T @undefined |  |  |  |
| 281 | T @undefined |  |  |  |
| 282 | T @undefined |  |  |  |
| 283 | T @undefined |  |  |  |
| 284 | T @undefined |  |  |  |
| 285 | T @undefined |  |  |  |
| 286 | T @undefined |  |  |  |
| 287 | T @undefined |  |  |  |
| 288 | T @undefined |  |  |  |
| 289 | T @undefined |  |  |  |
| 290 | X @undefined |  |  |  |
| 291 | X @undefined |  |  |  |
| 292 | X @undefined |  |  |  |
| 293 | X @undefined |  |  |  |
| 294 | X @undefined |  |  |  |
| 295 | X @undefined |  |  |  |
| 296 | X @undefined |  |  |  |
| 297 | X @undefined |  |  |  |
| 298 | X @undefined |  |  |  |
| 299 | X @undefined |  |  |  |
| 300 | X @undefined |  |  |  |
| 301 | X @undefined |  |  |  |
| 302 | Y @undefined |  |  |  |
| 303 | Y @undefined |  |  |  |
| 304 | Y @undefined |  |  |  |
| 305 | Y @undefined |  |  |  |
| 306 | Y @undefined |  |  |  |
| 307 | Y @undefined |  |  |  |
| 308 | Y @undefined |  |  |  |
| 309 | Y @undefined |  |  |  |
| 310 | Y @undefined |  |  |  |
| 311 | Y @undefined |  |  |  |
| 312 | Y @undefined |  |  |  |
| 313 | Y @undefined |  |  |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
