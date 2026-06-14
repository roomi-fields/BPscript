/**
 * Node.js filesystem provider for the lib loader (libs.js).
 *
 * Kept in a SEPARATE module so the importable loader (libs.js) carries NO
 * filesystem access at module load. The browser build swaps this file for
 * `libs-fs.browser.js` via the package.json "browser" field — so a bundler
 * (esbuild/Vite) never sees `fs`/`url`/`path` and never chokes on them
 * (no top-level await, no Node builtins in the browser graph).
 *
 * In Node these are plain synchronous calls — the harness keeps its
 * on-demand lib loading unchanged.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../lib');
export const readLibFile = (absPath) => readFileSync(absPath, 'utf-8');
