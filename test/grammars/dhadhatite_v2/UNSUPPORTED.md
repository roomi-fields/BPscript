# UNSUPPORTED features — dhadhatite_v2

Transposition of `-gr.dhadhatite` to BPScript. Partial: several BP3 features
have no BPScript equivalent.

## 1. LHS time-signature annotation

BP3: `gram#1[1] <100> S <-> 4+4+4+4/4 S64`

The `4+4+4+4/4` on the LHS annotates the polymetric time signature of the
derivation tree. BPScript has `@meter` for global meter but no LHS-embedded
time-signature annotation.

**NOT YET SUPPORTED in BPScript** — backlog item: LHS time-signature notation.

## 2. Template bracket markers `(= ...)` and `(: ...)` in rule bodies

BP3: `gram#2[1] ... S1F +S2F (= V8 ) +S2F * (= S1F ++ S2F ) (: V8 ) S1F`

`(= X )` creates a "master bracket" for template matching.
`(: X )` creates a "slave bracket" that mirrors the master (structural copy).
`*` separates template group boundaries in the RHS.

BPScript has a `@templates` section with `($N ...)` bracket syntax, but it
describes templates as standalone structural constraints, not as inline
annotations within rule bodies.

**NOT YET SUPPORTED in BPScript** — backlog item: inline template bracket
markers `(= ...) / (: ...)` in rule RHS.

## 3. Context markers `+` and `++` as token prefixes

BP3: `gram#5[1] + B2 <-> +teena`

`+` and `++` prefix tokens to mark "context depth". A rule with `+ B2` on the
LHS only fires when `B2` was introduced in a `+` context (via gram#2). The
context tag is propagated through the derivation tree and used in gram#5 to
disambiguate which variant of a fixed pattern to use (e.g., `dhadhatitedhadhadheena`
vs `dhadhatitedhadhateena`).

BPScript has no context-propagation mechanism of this kind.

**NOT YET SUPPORTED in BPScript** — backlog item: context-depth markers
`+`/`++` on LHS/RHS tokens with cross-subgrammar propagation.

## 4. Negative-context marker `#+` on LHS

BP3: `gram#5[6] <100> #+ S1F <-> #+ dhadhatitedhadhadheena`

`#+` is the negative-context marker in Bernard's engine: the rule fires only
when `S1F` is NOT in a `+` context. BPScript's `#` is a comment delimiter; it
has no negative-context semantic.

**NOT YET SUPPORTED in BPScript** — backlog item: negative-context LHS marker
`#+`.

## 5. `<--` rule direction with ordering constraint

BP3: `gram#5[8] ++ S2F <-- ++ dhadhatitedhadhadheena [This rule must be last]`

`<--` means right-to-left derivation (scanning RHS before LHS). The comment
`[This rule must be last]` is a structural constraint in the ORD sub-grammar:
this rule must be attempted after all others, ensuring the `++`-context variant
overrides the `+`-context variant from gram#5[7].

BPScript has `<-` for right-to-left but no "must be last" ordering constraint
within an ORD block.

**NOT YET SUPPORTED in BPScript** — backlog items:
  - `<--` (right-to-left) rule direction (distinct from `<-`?)
  - Rule ordering constraint in ORD sub-grammars

## 6. Multiple LIN rules with identical LHS

BP3 LIN allows multiple rules with the same LHS; they are tried according to
weights. Grammars #2 and #5 use this extensively (gram#2[2]/[3] both have
`S1V S2F S1F S2F E32` as LHS; gram#2[5..10] all have `S1V S2V S1F S2F E32`).

In BPScript, multiple rules with the same LHS in a `@mode:lin` sub-grammar
should work (the encoder emits them as separate BP3 rules), but they are
currently untested for LIN mode specifically.

**Possibly supported** — needs verification in encoder.js LIN path.

## 7. TEMPLATES section translation

The original has 6 template entries using the BP3 `(= ...) / (: ...)` inline
bracket notation and `+`/`++` context markers. These cannot be translated to
BPScript `@templates` without resolving items 2, 3, and 4 above first.

**NOT TRANSLATED** — depends on items 2, 3, 4.

## Summary of backlog items

| # | Feature | File | Line |
|---|---------|------|------|
| 1 | LHS time-signature annotation | scene.bps | gram#1[1] |
| 2 | Inline `(= ...) / (: ...)` template brackets | scene.bps | gram#2[1..10] |
| 3 | `+`/`++` context-depth token prefixes | scene.bps | gram#2[1..10], gram#5[1..8] |
| 4 | Negative-context marker `#+` | scene.bps | gram#5[6] |
| 5 | `<--` direction + "must be last" constraint | scene.bps | gram#5[8] |
| 6 | Multiple identical LHS in LIN (test needed) | encoder.js | LIN path |
| 7 | TEMPLATES section with old bracket format | scene.bps | @templates |
