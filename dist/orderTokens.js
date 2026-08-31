// src/transpiler/orderTokens.js
var SEPARATORS = /* @__PURE__ */ new Set([" ", "	", "\n", "\r", "{", "}", "&", ","]);
function tokenizeOrder(canonical) {
  const s = String(canonical);
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (SEPARATORS.has(c)) {
      i++;
      continue;
    }
    if (c === "_" && i + 1 < n && /[A-Za-z]/.test(s[i + 1])) {
      let j2 = i + 1;
      while (j2 < n && /[A-Za-z0-9]/.test(s[j2])) j2++;
      if (j2 < n && s[j2] === "(") {
        let depth = 0;
        let k = j2;
        for (; k < n; k++) {
          if (s[k] === "(") depth++;
          else if (s[k] === ")") {
            depth--;
            if (depth === 0) {
              k++;
              break;
            }
          }
        }
        out.push(s.slice(i, k));
        i = k;
      } else {
        out.push(s.slice(i, j2));
        i = j2;
      }
      continue;
    }
    let j = i;
    while (j < n) {
      const d = s[j];
      if (SEPARATORS.has(d)) break;
      if (d === "_" && j > i && j + 1 < n && /[A-Za-z]/.test(s[j + 1])) break;
      j++;
    }
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}
var orderTokens_default = tokenizeOrder;
export {
  orderTokens_default as default,
  tokenizeOrder
};
