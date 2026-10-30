# Local deepmerge security patch

This is a private, explicitly renamed fork of deepmerge 4.3.1's standalone CommonJS runtime and original TypeScript declarations. It supplies the Svelte build plugin's existing `deepmerge` import through a root npm override. It is not published to npm and is not an upstream fixed release.

The upstream advisory [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), reviewed October 27, 2026, has no published patched version. Its [reproducer and remediation](https://github.com/TehShrike/deepmerge/issues/273) describe returned-object prototype poisoning with null-prototype targets, nested null placeholders and own `__proto__` keys. Downgrading to the registry's suggested obsolete SvelteKit is not a compatible repair.

The patch rejects `__proto__`, `constructor` and `prototype` in **both** target and source loops before assignment and writes own data properties with `Object.defineProperty`. It retains the existing API, nested merges, cloning, arrays, enumerable symbols, custom merge options and special-value behavior. No audit threshold or advisory suppression is added. The fork's different package identity records the changed implementation explicitly; the original vulnerable runtime is no longer installed.

`tests/integration/deepmerge-security.test.mjs` fails against the original installed runtime and passes with the patch. It checks both input directions, null-prototype and own-key targets, nested placeholders, absence of inherited flags, and the build plugin's merge behaviors. Full source checks, production builds and browser qualification remain mandatory.

Upstream package: https://www.npmjs.com/package/deepmerge/v/4.3.1
Original standalone `dist/cjs.js` SHA-256: `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`.
Original MIT license and copyright are retained in LICENSE. Remove this fork when a supported upstream dependency removes or fixes the vulnerable implementation.
