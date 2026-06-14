/**
 * Browser stub for libs-fs.js (selected via the package.json "browser" field).
 *
 * No filesystem in the browser: the loader (libs.js) falls back to the
 * registry only. The host must pre-register all libs before compiling, e.g.:
 *
 *   import { LIBS } from 'bpscript/src/transpiler/libs-data.js';
 *   import { registerAll } from 'bpscript/src/transpiler/libs.js';
 *   registerAll(LIBS);
 */
export const LIB_DIR = null;
export const readLibFile = null;
