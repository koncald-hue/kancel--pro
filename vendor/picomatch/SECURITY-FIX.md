# Local security patch

This private vendored copy is based on picomatch 4.0.7 and carries a local ReDoS guard for repeated extglobs with a leading bare wildcard followed by content (for example `+(*a)`). Risky patterns are treated literally by the parser.

The upstream package has no published patched release as of 2026-11-17. This patch follows the approach documented in upstream PR https://github.com/micromatch/picomatch/pull/238 and advisory https://github.com/advisories/GHSA-fc5q-39xc-vjpf. Replace this fork with an upstream fixed release after one is published and verified.
