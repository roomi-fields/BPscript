# dhin1 — Test Report

Date: 2026-03-27
Result: **PASS → PASS → PASS → TODO**

## Source files

- `original.gr` — grammaire Bernard
- `silent.gr` — réécriture silent sound objects

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 618 |
| S2 WASM orig | PASS | 48 |
| S3 WASM silent | PASS | 0 |
| S4 BPscript | TODO | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | ??? @undefined | 4+4+4+4dhin.-.-.dha. 0-0 |  |  |
| 1 | ??? @undefined | ge.na.dha.-. 0-0 |  |  |
| 2 | ??? @undefined | -.dha.ge.na. 0-0 |  |  |
| 3 | ??? @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 4 | ??? @undefined | na.ka.dhee.ne. 0-0 |  |  |
| 5 | ??? @undefined | dhee.na.ge.na. 0-0 |  |  |
| 6 | ??? @undefined | ta.ge.ti.ra. 0-0 |  |  |
| 7 | ??? @undefined | ki.ta.dhin.-. 0-0 |  |  |
| 8 | ??? @undefined | -.dha.ge.na. 0-0 |  |  |
| 9 | ??? @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 10 | ??? @undefined | na.ka.tee.ne. 0-0 |  |  |
| 11 | ??? @undefined | tee.na.ke.na. 0-0 |  |  |
| 12 | ??? @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 13 | ??? @undefined | na.ka.ta.ti. 0-0 |  |  |
| 14 | ??? @undefined | ke.ke.na.ka. 0-0 |  |  |
| 15 | ??? @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 16 | ??? @undefined | na.ka.ta.ti. 0-0 |  |  |
| 17 | ??? @undefined | ke.ke.na.ka. 0-0 |  |  |
| 18 | ??? @undefined | ta.ge.ti.ra. 0-0 |  |  |
| 19 | ??? @undefined | ki.ta.dhin.-. 0-0 |  |  |
| 20 | ??? @undefined | -.dha.ge.na. 0-0 |  |  |
| 21 | ??? @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 22 | '|'. @undefined | na.ka.tee.ne. 0-0 |  |  |
| 23 | '|'. @undefined | tee.na.ke.na. 0-0 |  |  |
| 24 | '|'. @undefined | tin.-.-.ta. 0-0 |  |  |
| 25 | '|'. @undefined | ke.na.ta.-. 0-0 |  |  |
| 26 | '|'. @undefined | -.ta.ke.na. 0-0 |  |  |
| 27 | '|'. @undefined | ta.ti.ke.ke. 0-0 |  |  |
| 28 | '|'. @undefined | na.ka.tee.ne. 0-0 |  |  |
| 29 | '|'. @undefined | tee.na.ke.na. 0-0 |  |  |
| 30 | '|'. @undefined | ta.ke.ti.ra. 0-0 |  |  |
| 31 | '|'. @undefined | ki.ta.tin.-. 0-0 |  |  |
| 32 | '|'. @undefined | -.ta.ke.na. 0-0 |  |  |
| 33 | '|'. @undefined | ta.ti.ke.ke. 0-0 |  |  |
| 34 | '|'. @undefined | na.ka.tee.ne. 0-0 |  |  |
| 35 | '|'. @undefined | tee.na.ke.na. 0-0 |  |  |
| 36 | '|'. @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 37 | '|'. @undefined | na.ka.ta.ti. 0-0 |  |  |
| 38 | '|'. @undefined | ke.ke.na.ka. 0-0 |  |  |
| 39 | '|'. @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 40 | '|'. @undefined | na.ka.ta.ti. 0-0 |  |  |
| 41 | '|'. @undefined | ke.ke.na.ka. 0-0 |  |  |
| 42 | '|'. @undefined | ta.ge.ti.ra. 0-0 |  |  |
| 43 | '|'. @undefined | ki.ta.ge.na. 0-0 |  |  |
| 44 | "dha--". @undefined | -.dha.ge.na. 0-0 |  |  |
| 45 | "dha-dha-dha-". @undefined | dha.ti.ge.ge. 0-0 |  |  |
| 46 | "dha-ta-dha-". @undefined | na.ka.dhee.ne. 0-0 |  |  |
| 47 | "dhagena". @undefined | dhee.na.ge.na 0-0 |  |  |
| 48 | "dhagenadha--". @undefined |  |  |  |
| 49 | "dhagenadhin--". @undefined |  |  |  |
| 50 | "dhatigegenaka". @undefined |  |  |  |
| 51 | "dhatigegenakateeneteenakena". @undefined |  |  |  |
| 52 | "dheenedha-dheene". @undefined |  |  |  |
| 53 | "dheenedheenagena". @undefined |  |  |  |
| 54 | "dheenedheenedheene". @undefined |  |  |  |
| 55 | "dhin--". @undefined |  |  |  |
| 56 | "dhin--dhagenadha--dhagenadhatigegenakadheenedheenagena". @undefined |  |  |  |
| 57 | "dhin--dhagenadha--dhagenadhatigegenakadheenedheenagenatagetirakitadhin--dhagenadhatigegenakateeneteenakena". @undefined |  |  |  |
| 58 | "dhin--dhagenadha--dhagenadhatigegenakadheenedheenagenatagetirakitagena-dhagenadhatigegenakateeneteenakena". @undefined |  |  |  |
| 59 | "tagetirakita". @undefined |  |  |  |
| 60 | "tagetirakitadhin--dhagenadhatigegenakadheenedheenagena". @undefined |  |  |  |
| 61 | "tagetirakitadhin--dhagenadhatigegenakateeneteenakena". @undefined |  |  |  |
| 62 | "tagetirakitagena-dhagenadhatigegenakadheenedheenagena". @undefined |  |  |  |
| 63 | "tagetirakitagena-dhagenadhatigegenakateeneteenakena". @undefined |  |  |  |
| 64 | "teeneteenakena". @undefined |  |  |  |
| 65 | "tirakita". @undefined |  |  |  |
| 66 | <-> @undefined |  |  |  |
| 67 | <-> @undefined |  |  |  |
| 68 | <-> @undefined |  |  |  |
| 69 | <-> @undefined |  |  |  |
| 70 | <-> @undefined |  |  |  |
| 71 | <-> @undefined |  |  |  |
| 72 | <-> @undefined |  |  |  |
| 73 | <-> @undefined |  |  |  |
| 74 | <-> @undefined |  |  |  |
| 75 | <-> @undefined |  |  |  |
| 76 | <-> @undefined |  |  |  |
| 77 | <-> @undefined |  |  |  |
| 78 | <-> @undefined |  |  |  |
| 79 | <-> @undefined |  |  |  |
| 80 | <-> @undefined |  |  |  |
| 81 | <-> @undefined |  |  |  |
| 82 | <-> @undefined |  |  |  |
| 83 | <-> @undefined |  |  |  |
| 84 | <-> @undefined |  |  |  |
| 85 | <-> @undefined |  |  |  |
| 86 | <-> @undefined |  |  |  |
| 87 | <-> @undefined |  |  |  |
| 88 | A3 @undefined |  |  |  |
| 89 | A3 @undefined |  |  |  |
| 90 | A3 @undefined |  |  |  |
| 91 | A3 @undefined |  |  |  |
| 92 | A3 @undefined |  |  |  |
| 93 | A3 @undefined |  |  |  |
| 94 | A3 @undefined |  |  |  |
| 95 | A4 @undefined |  |  |  |
| 96 | A6 @undefined |  |  |  |
| 97 | A6 @undefined |  |  |  |
| 98 | A6 @undefined |  |  |  |
| 99 | A6 @undefined |  |  |  |
| 100 | A6 @undefined |  |  |  |
| 101 | A6 @undefined |  |  |  |
| 102 | A6 @undefined |  |  |  |
| 103 | A6 @undefined |  |  |  |
| 104 | be @undefined |  |  |  |
| 105 | be @undefined |  |  |  |
| 106 | be @undefined |  |  |  |
| 107 | be @undefined |  |  |  |
| 108 | be @undefined |  |  |  |
| 109 | be @undefined |  |  |  |
| 110 | be @undefined |  |  |  |
| 111 | be @undefined |  |  |  |
| 112 | be @undefined |  |  |  |
| 113 | be @undefined |  |  |  |
| 114 | be @undefined |  |  |  |
| 115 | be @undefined |  |  |  |
| 116 | be @undefined |  |  |  |
| 117 | be @undefined |  |  |  |
| 118 | be @undefined |  |  |  |
| 119 | be @undefined |  |  |  |
| 120 | be @undefined |  |  |  |
| 121 | be @undefined |  |  |  |
| 122 | be @undefined |  |  |  |
| 123 | be @undefined |  |  |  |
| 124 | be @undefined |  |  |  |
| 125 | be @undefined |  |  |  |
| 126 | Can't @undefined |  |  |  |
| 127 | Can't @undefined |  |  |  |
| 128 | Can't @undefined |  |  |  |
| 129 | Can't @undefined |  |  |  |
| 130 | Can't @undefined |  |  |  |
| 131 | Can't @undefined |  |  |  |
| 132 | Can't @undefined |  |  |  |
| 133 | Can't @undefined |  |  |  |
| 134 | Can't @undefined |  |  |  |
| 135 | Can't @undefined |  |  |  |
| 136 | Can't @undefined |  |  |  |
| 137 | Can't @undefined |  |  |  |
| 138 | Can't @undefined |  |  |  |
| 139 | Can't @undefined |  |  |  |
| 140 | Can't @undefined |  |  |  |
| 141 | Can't @undefined |  |  |  |
| 142 | Can't @undefined |  |  |  |
| 143 | Can't @undefined |  |  |  |
| 144 | Can't @undefined |  |  |  |
| 145 | Can't @undefined |  |  |  |
| 146 | Can't @undefined |  |  |  |
| 147 | Can't @undefined |  |  |  |
| 148 | character @undefined |  |  |  |
| 149 | character @undefined |  |  |  |
| 150 | character @undefined |  |  |  |
| 151 | character @undefined |  |  |  |
| 152 | character @undefined |  |  |  |
| 153 | character @undefined |  |  |  |
| 154 | character @undefined |  |  |  |
| 155 | character @undefined |  |  |  |
| 156 | character @undefined |  |  |  |
| 157 | character @undefined |  |  |  |
| 158 | character @undefined |  |  |  |
| 159 | character @undefined |  |  |  |
| 160 | character @undefined |  |  |  |
| 161 | character @undefined |  |  |  |
| 162 | character @undefined |  |  |  |
| 163 | character @undefined |  |  |  |
| 164 | character @undefined |  |  |  |
| 165 | character @undefined |  |  |  |
| 166 | character @undefined |  |  |  |
| 167 | character @undefined |  |  |  |
| 168 | character @undefined |  |  |  |
| 169 | character @undefined |  |  |  |
| 170 | convention? @undefined |  |  |  |
| 171 | convention? @undefined |  |  |  |
| 172 | convention? @undefined |  |  |  |
| 173 | convention? @undefined |  |  |  |
| 174 | convention? @undefined |  |  |  |
| 175 | convention? @undefined |  |  |  |
| 176 | convention? @undefined |  |  |  |
| 177 | convention? @undefined |  |  |  |
| 178 | convention? @undefined |  |  |  |
| 179 | convention? @undefined |  |  |  |
| 180 | convention? @undefined |  |  |  |
| 181 | convention? @undefined |  |  |  |
| 182 | convention? @undefined |  |  |  |
| 183 | convention? @undefined |  |  |  |
| 184 | convention? @undefined |  |  |  |
| 185 | convention? @undefined |  |  |  |
| 186 | convention? @undefined |  |  |  |
| 187 | convention? @undefined |  |  |  |
| 188 | convention? @undefined |  |  |  |
| 189 | convention? @undefined |  |  |  |
| 190 | convention? @undefined |  |  |  |
| 191 | convention? @undefined |  |  |  |
| 192 | dha-- @undefined |  |  |  |
| 193 | dha-dha-dha- @undefined |  |  |  |
| 194 | dha-ta-dha- @undefined |  |  |  |
| 195 | dhagena @undefined |  |  |  |
| 196 | dhagenadha-- @undefined |  |  |  |
| 197 | dhagenadhin-- @undefined |  |  |  |
| 198 | dhatigegenaka @undefined |  |  |  |
| 199 | dhatigegenakateeneteenakena @undefined |  |  |  |
| 200 | dheenedha-dheene @undefined |  |  |  |
| 201 | dheenedheenagena @undefined |  |  |  |
| 202 | dheenedheenedheene @undefined |  |  |  |
| 203 | dhin-- @undefined |  |  |  |
| 204 | dhin--dhagenadha--dhagenadhatigegenakadheenedheenagena @undefined |  |  |  |
| 205 | dhin--dhagenadha--dhagenadhatigegenakadheenedheenagenatagetirakitadhin--dhagenadhatigegenakateeneteenakena @undefined |  |  |  |
| 206 | dhin--dhagenadha--dhagenadhatigegenakadheenedheenagenatagetirakitagena-dhagenadhatigegenakateeneteenakena @undefined |  |  |  |
| 207 | F'12 @undefined |  |  |  |
| 208 | F'24 @undefined |  |  |  |
| 209 | F'24 @undefined |  |  |  |
| 210 | F24 @undefined |  |  |  |
| 211 | F24 @undefined |  |  |  |
| 212 | F48 @undefined |  |  |  |
| 213 | F48 @undefined |  |  |  |
| 214 | gram#5[1] @undefined |  |  |  |
| 215 | gram#5[10] @undefined |  |  |  |
| 216 | gram#5[11] @undefined |  |  |  |
| 217 | gram#5[12] @undefined |  |  |  |
| 218 | gram#5[13] @undefined |  |  |  |
| 219 | gram#5[14] @undefined |  |  |  |
| 220 | gram#5[2] @undefined |  |  |  |
| 221 | gram#5[3] @undefined |  |  |  |
| 222 | gram#5[4] @undefined |  |  |  |
| 223 | gram#5[5] @undefined |  |  |  |
| 224 | gram#5[6] @undefined |  |  |  |
| 225 | gram#5[7] @undefined |  |  |  |
| 226 | gram#5[8] @undefined |  |  |  |
| 227 | gram#5[9] @undefined |  |  |  |
| 228 | gram#6[1] @undefined |  |  |  |
| 229 | gram#6[2] @undefined |  |  |  |
| 230 | gram#6[3] @undefined |  |  |  |
| 231 | gram#6[4] @undefined |  |  |  |
| 232 | gram#6[5] @undefined |  |  |  |
| 233 | gram#6[6] @undefined |  |  |  |
| 234 | gram#6[7] @undefined |  |  |  |
| 235 | gram#6[8] @undefined |  |  |  |
| 236 | incorrect @undefined |  |  |  |
| 237 | incorrect @undefined |  |  |  |
| 238 | incorrect @undefined |  |  |  |
| 239 | incorrect @undefined |  |  |  |
| 240 | incorrect @undefined |  |  |  |
| 241 | incorrect @undefined |  |  |  |
| 242 | incorrect @undefined |  |  |  |
| 243 | incorrect @undefined |  |  |  |
| 244 | incorrect @undefined |  |  |  |
| 245 | incorrect @undefined |  |  |  |
| 246 | incorrect @undefined |  |  |  |
| 247 | incorrect @undefined |  |  |  |
| 248 | incorrect @undefined |  |  |  |
| 249 | incorrect @undefined |  |  |  |
| 250 | incorrect @undefined |  |  |  |
| 251 | incorrect @undefined |  |  |  |
| 252 | incorrect @undefined |  |  |  |
| 253 | incorrect @undefined |  |  |  |
| 254 | incorrect @undefined |  |  |  |
| 255 | incorrect @undefined |  |  |  |
| 256 | incorrect @undefined |  |  |  |
| 257 | incorrect @undefined |  |  |  |
| 258 | make @undefined |  |  |  |
| 259 | make @undefined |  |  |  |
| 260 | make @undefined |  |  |  |
| 261 | make @undefined |  |  |  |
| 262 | make @undefined |  |  |  |
| 263 | make @undefined |  |  |  |
| 264 | make @undefined |  |  |  |
| 265 | make @undefined |  |  |  |
| 266 | make @undefined |  |  |  |
| 267 | make @undefined |  |  |  |
| 268 | make @undefined |  |  |  |
| 269 | make @undefined |  |  |  |
| 270 | make @undefined |  |  |  |
| 271 | make @undefined |  |  |  |
| 272 | make @undefined |  |  |  |
| 273 | make @undefined |  |  |  |
| 274 | make @undefined |  |  |  |
| 275 | make @undefined |  |  |  |
| 276 | make @undefined |  |  |  |
| 277 | make @undefined |  |  |  |
| 278 | make @undefined |  |  |  |
| 279 | make @undefined |  |  |  |
| 280 | May @undefined |  |  |  |
| 281 | May @undefined |  |  |  |
| 282 | May @undefined |  |  |  |
| 283 | May @undefined |  |  |  |
| 284 | May @undefined |  |  |  |
| 285 | May @undefined |  |  |  |
| 286 | May @undefined |  |  |  |
| 287 | May @undefined |  |  |  |
| 288 | May @undefined |  |  |  |
| 289 | May @undefined |  |  |  |
| 290 | May @undefined |  |  |  |
| 291 | May @undefined |  |  |  |
| 292 | May @undefined |  |  |  |
| 293 | May @undefined |  |  |  |
| 294 | May @undefined |  |  |  |
| 295 | May @undefined |  |  |  |
| 296 | May @undefined |  |  |  |
| 297 | May @undefined |  |  |  |
| 298 | May @undefined |  |  |  |
| 299 | May @undefined |  |  |  |
| 300 | May @undefined |  |  |  |
| 301 | May @undefined |  |  |  |
| 302 | must @undefined |  |  |  |
| 303 | must @undefined |  |  |  |
| 304 | must @undefined |  |  |  |
| 305 | must @undefined |  |  |  |
| 306 | must @undefined |  |  |  |
| 307 | must @undefined |  |  |  |
| 308 | must @undefined |  |  |  |
| 309 | must @undefined |  |  |  |
| 310 | must @undefined |  |  |  |
| 311 | must @undefined |  |  |  |
| 312 | must @undefined |  |  |  |
| 313 | must @undefined |  |  |  |
| 314 | must @undefined |  |  |  |
| 315 | must @undefined |  |  |  |
| 316 | must @undefined |  |  |  |
| 317 | must @undefined |  |  |  |
| 318 | must @undefined |  |  |  |
| 319 | must @undefined |  |  |  |
| 320 | must @undefined |  |  |  |
| 321 | must @undefined |  |  |  |
| 322 | must @undefined |  |  |  |
| 323 | must @undefined |  |  |  |
| 324 | note @undefined |  |  |  |
| 325 | note @undefined |  |  |  |
| 326 | note @undefined |  |  |  |
| 327 | note @undefined |  |  |  |
| 328 | note @undefined |  |  |  |
| 329 | note @undefined |  |  |  |
| 330 | note @undefined |  |  |  |
| 331 | note @undefined |  |  |  |
| 332 | note @undefined |  |  |  |
| 333 | note @undefined |  |  |  |
| 334 | note @undefined |  |  |  |
| 335 | note @undefined |  |  |  |
| 336 | note @undefined |  |  |  |
| 337 | note @undefined |  |  |  |
| 338 | note @undefined |  |  |  |
| 339 | note @undefined |  |  |  |
| 340 | note @undefined |  |  |  |
| 341 | note @undefined |  |  |  |
| 342 | note @undefined |  |  |  |
| 343 | note @undefined |  |  |  |
| 344 | note @undefined |  |  |  |
| 345 | note @undefined |  |  |  |
| 346 | of @undefined |  |  |  |
| 347 | of @undefined |  |  |  |
| 348 | of @undefined |  |  |  |
| 349 | of @undefined |  |  |  |
| 350 | of @undefined |  |  |  |
| 351 | of @undefined |  |  |  |
| 352 | of @undefined |  |  |  |
| 353 | of @undefined |  |  |  |
| 354 | of @undefined |  |  |  |
| 355 | of @undefined |  |  |  |
| 356 | of @undefined |  |  |  |
| 357 | of @undefined |  |  |  |
| 358 | of @undefined |  |  |  |
| 359 | of @undefined |  |  |  |
| 360 | of @undefined |  |  |  |
| 361 | of @undefined |  |  |  |
| 362 | of @undefined |  |  |  |
| 363 | of @undefined |  |  |  |
| 364 | of @undefined |  |  |  |
| 365 | of @undefined |  |  |  |
| 366 | of @undefined |  |  |  |
| 367 | of @undefined |  |  |  |
| 368 | or @undefined |  |  |  |
| 369 | or @undefined |  |  |  |
| 370 | or @undefined |  |  |  |
| 371 | or @undefined |  |  |  |
| 372 | or @undefined |  |  |  |
| 373 | or @undefined |  |  |  |
| 374 | or @undefined |  |  |  |
| 375 | or @undefined |  |  |  |
| 376 | or @undefined |  |  |  |
| 377 | or @undefined |  |  |  |
| 378 | or @undefined |  |  |  |
| 379 | or @undefined |  |  |  |
| 380 | or @undefined |  |  |  |
| 381 | or @undefined |  |  |  |
| 382 | or @undefined |  |  |  |
| 383 | or @undefined |  |  |  |
| 384 | or @undefined |  |  |  |
| 385 | or @undefined |  |  |  |
| 386 | or @undefined |  |  |  |
| 387 | or @undefined |  |  |  |
| 388 | or @undefined |  |  |  |
| 389 | or @undefined |  |  |  |
| 390 | or @undefined |  |  |  |
| 391 | or @undefined |  |  |  |
| 392 | or @undefined |  |  |  |
| 393 | or @undefined |  |  |  |
| 394 | or @undefined |  |  |  |
| 395 | or @undefined |  |  |  |
| 396 | or @undefined |  |  |  |
| 397 | or @undefined |  |  |  |
| 398 | or @undefined |  |  |  |
| 399 | or @undefined |  |  |  |
| 400 | or @undefined |  |  |  |
| 401 | or @undefined |  |  |  |
| 402 | or @undefined |  |  |  |
| 403 | or @undefined |  |  |  |
| 404 | or @undefined |  |  |  |
| 405 | or @undefined |  |  |  |
| 406 | or @undefined |  |  |  |
| 407 | or @undefined |  |  |  |
| 408 | or @undefined |  |  |  |
| 409 | or @undefined |  |  |  |
| 410 | or @undefined |  |  |  |
| 411 | or @undefined |  |  |  |
| 412 | Q24 @undefined |  |  |  |
| 413 | sense @undefined |  |  |  |
| 414 | sense @undefined |  |  |  |
| 415 | sense @undefined |  |  |  |
| 416 | sense @undefined |  |  |  |
| 417 | sense @undefined |  |  |  |
| 418 | sense @undefined |  |  |  |
| 419 | sense @undefined |  |  |  |
| 420 | sense @undefined |  |  |  |
| 421 | sense @undefined |  |  |  |
| 422 | sense @undefined |  |  |  |
| 423 | sense @undefined |  |  |  |
| 424 | sense @undefined |  |  |  |
| 425 | sense @undefined |  |  |  |
| 426 | sense @undefined |  |  |  |
| 427 | sense @undefined |  |  |  |
| 428 | sense @undefined |  |  |  |
| 429 | sense @undefined |  |  |  |
| 430 | sense @undefined |  |  |  |
| 431 | sense @undefined |  |  |  |
| 432 | sense @undefined |  |  |  |
| 433 | sense @undefined |  |  |  |
| 434 | sense @undefined |  |  |  |
| 435 | start @undefined |  |  |  |
| 436 | start @undefined |  |  |  |
| 437 | start @undefined |  |  |  |
| 438 | start @undefined |  |  |  |
| 439 | start @undefined |  |  |  |
| 440 | start @undefined |  |  |  |
| 441 | start @undefined |  |  |  |
| 442 | start @undefined |  |  |  |
| 443 | start @undefined |  |  |  |
| 444 | start @undefined |  |  |  |
| 445 | start @undefined |  |  |  |
| 446 | start @undefined |  |  |  |
| 447 | start @undefined |  |  |  |
| 448 | start @undefined |  |  |  |
| 449 | start @undefined |  |  |  |
| 450 | start @undefined |  |  |  |
| 451 | start @undefined |  |  |  |
| 452 | start @undefined |  |  |  |
| 453 | start @undefined |  |  |  |
| 454 | start @undefined |  |  |  |
| 455 | start @undefined |  |  |  |
| 456 | start @undefined |  |  |  |
| 457 | symbol, @undefined |  |  |  |
| 458 | symbol, @undefined |  |  |  |
| 459 | symbol, @undefined |  |  |  |
| 460 | symbol, @undefined |  |  |  |
| 461 | symbol, @undefined |  |  |  |
| 462 | symbol, @undefined |  |  |  |
| 463 | symbol, @undefined |  |  |  |
| 464 | symbol, @undefined |  |  |  |
| 465 | symbol, @undefined |  |  |  |
| 466 | symbol, @undefined |  |  |  |
| 467 | symbol, @undefined |  |  |  |
| 468 | symbol, @undefined |  |  |  |
| 469 | symbol, @undefined |  |  |  |
| 470 | symbol, @undefined |  |  |  |
| 471 | symbol, @undefined |  |  |  |
| 472 | symbol, @undefined |  |  |  |
| 473 | symbol, @undefined |  |  |  |
| 474 | symbol, @undefined |  |  |  |
| 475 | symbol, @undefined |  |  |  |
| 476 | symbol, @undefined |  |  |  |
| 477 | symbol, @undefined |  |  |  |
| 478 | symbol, @undefined |  |  |  |
| 479 | tagetirakita @undefined |  |  |  |
| 480 | tagetirakitadhin--dhagenadhatigegenakadheenedheenagena @undefined |  |  |  |
| 481 | tagetirakitadhin--dhagenadhatigegenakateeneteenakena @undefined |  |  |  |
| 482 | tagetirakitagena-dhagenadhatigegenakadheenedheenagena @undefined |  |  |  |
| 483 | tagetirakitagena-dhagenadhatigegenakateeneteenakena @undefined |  |  |  |
| 484 | teeneteenakena @undefined |  |  |  |
| 485 | terminal @undefined |  |  |  |
| 486 | terminal @undefined |  |  |  |
| 487 | terminal @undefined |  |  |  |
| 488 | terminal @undefined |  |  |  |
| 489 | terminal @undefined |  |  |  |
| 490 | terminal @undefined |  |  |  |
| 491 | terminal @undefined |  |  |  |
| 492 | terminal @undefined |  |  |  |
| 493 | terminal @undefined |  |  |  |
| 494 | terminal @undefined |  |  |  |
| 495 | terminal @undefined |  |  |  |
| 496 | terminal @undefined |  |  |  |
| 497 | terminal @undefined |  |  |  |
| 498 | terminal @undefined |  |  |  |
| 499 | terminal @undefined |  |  |  |
| 500 | terminal @undefined |  |  |  |
| 501 | terminal @undefined |  |  |  |
| 502 | terminal @undefined |  |  |  |
| 503 | terminal @undefined |  |  |  |
| 504 | terminal @undefined |  |  |  |
| 505 | terminal @undefined |  |  |  |
| 506 | terminal @undefined |  |  |  |
| 507 | time-pattern @undefined |  |  |  |
| 508 | time-pattern @undefined |  |  |  |
| 509 | time-pattern @undefined |  |  |  |
| 510 | time-pattern @undefined |  |  |  |
| 511 | time-pattern @undefined |  |  |  |
| 512 | time-pattern @undefined |  |  |  |
| 513 | time-pattern @undefined |  |  |  |
| 514 | time-pattern @undefined |  |  |  |
| 515 | time-pattern @undefined |  |  |  |
| 516 | time-pattern @undefined |  |  |  |
| 517 | time-pattern @undefined |  |  |  |
| 518 | time-pattern @undefined |  |  |  |
| 519 | time-pattern @undefined |  |  |  |
| 520 | time-pattern @undefined |  |  |  |
| 521 | time-pattern @undefined |  |  |  |
| 522 | time-pattern @undefined |  |  |  |
| 523 | time-pattern @undefined |  |  |  |
| 524 | time-pattern @undefined |  |  |  |
| 525 | time-pattern @undefined |  |  |  |
| 526 | time-pattern @undefined |  |  |  |
| 527 | time-pattern @undefined |  |  |  |
| 528 | time-pattern @undefined |  |  |  |
| 529 | tirakita @undefined |  |  |  |
| 530 | unknown @undefined |  |  |  |
| 531 | unknown @undefined |  |  |  |
| 532 | unknown @undefined |  |  |  |
| 533 | unknown @undefined |  |  |  |
| 534 | unknown @undefined |  |  |  |
| 535 | unknown @undefined |  |  |  |
| 536 | unknown @undefined |  |  |  |
| 537 | unknown @undefined |  |  |  |
| 538 | unknown @undefined |  |  |  |
| 539 | unknown @undefined |  |  |  |
| 540 | unknown @undefined |  |  |  |
| 541 | unknown @undefined |  |  |  |
| 542 | unknown @undefined |  |  |  |
| 543 | unknown @undefined |  |  |  |
| 544 | unknown @undefined |  |  |  |
| 545 | unknown @undefined |  |  |  |
| 546 | unknown @undefined |  |  |  |
| 547 | unknown @undefined |  |  |  |
| 548 | unknown @undefined |  |  |  |
| 549 | unknown @undefined |  |  |  |
| 550 | unknown @undefined |  |  |  |
| 551 | unknown @undefined |  |  |  |
| 552 | uppercase @undefined |  |  |  |
| 553 | uppercase @undefined |  |  |  |
| 554 | uppercase @undefined |  |  |  |
| 555 | uppercase @undefined |  |  |  |
| 556 | uppercase @undefined |  |  |  |
| 557 | uppercase @undefined |  |  |  |
| 558 | uppercase @undefined |  |  |  |
| 559 | uppercase @undefined |  |  |  |
| 560 | uppercase @undefined |  |  |  |
| 561 | uppercase @undefined |  |  |  |
| 562 | uppercase @undefined |  |  |  |
| 563 | uppercase @undefined |  |  |  |
| 564 | uppercase @undefined |  |  |  |
| 565 | uppercase @undefined |  |  |  |
| 566 | uppercase @undefined |  |  |  |
| 567 | uppercase @undefined |  |  |  |
| 568 | uppercase @undefined |  |  |  |
| 569 | uppercase @undefined |  |  |  |
| 570 | uppercase @undefined |  |  |  |
| 571 | uppercase @undefined |  |  |  |
| 572 | uppercase @undefined |  |  |  |
| 573 | uppercase @undefined |  |  |  |
| 574 | Variable @undefined |  |  |  |
| 575 | Variable @undefined |  |  |  |
| 576 | Variable @undefined |  |  |  |
| 577 | Variable @undefined |  |  |  |
| 578 | Variable @undefined |  |  |  |
| 579 | Variable @undefined |  |  |  |
| 580 | Variable @undefined |  |  |  |
| 581 | Variable @undefined |  |  |  |
| 582 | Variable @undefined |  |  |  |
| 583 | Variable @undefined |  |  |  |
| 584 | Variable @undefined |  |  |  |
| 585 | Variable @undefined |  |  |  |
| 586 | Variable @undefined |  |  |  |
| 587 | Variable @undefined |  |  |  |
| 588 | Variable @undefined |  |  |  |
| 589 | Variable @undefined |  |  |  |
| 590 | Variable @undefined |  |  |  |
| 591 | Variable @undefined |  |  |  |
| 592 | Variable @undefined |  |  |  |
| 593 | Variable @undefined |  |  |  |
| 594 | Variable @undefined |  |  |  |
| 595 | Variable @undefined |  |  |  |
| 596 | with @undefined |  |  |  |
| 597 | with @undefined |  |  |  |
| 598 | with @undefined |  |  |  |
| 599 | with @undefined |  |  |  |
| 600 | with @undefined |  |  |  |
| 601 | with @undefined |  |  |  |
| 602 | with @undefined |  |  |  |
| 603 | with @undefined |  |  |  |
| 604 | with @undefined |  |  |  |
| 605 | with @undefined |  |  |  |
| 606 | with @undefined |  |  |  |
| 607 | with @undefined |  |  |  |
| 608 | with @undefined |  |  |  |
| 609 | with @undefined |  |  |  |
| 610 | with @undefined |  |  |  |
| 611 | with @undefined |  |  |  |
| 612 | with @undefined |  |  |  |
| 613 | with @undefined |  |  |  |
| 614 | with @undefined |  |  |  |
| 615 | with @undefined |  |  |  |
| 616 | with @undefined |  |  |  |
| 617 | with @undefined |  |  |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
