# Conformance vectors

The browser extension (JavaScript) and the Windows program (Rust) are two products with two implementations of a few small ideas. A vector file in this folder is the one
statement of such an idea; **both** test suites read it, so the two cannot drift apart without a test failing.

| File | What it says | Written by | Read by |
|---|---|---|---|
| `schedule.json` | is a work-hours rule running at a given weekday and minute (ordinary, overnight, edges, chosen days) | the Rust test `schedule_vectors` (`UPDATE_CONFORMANCE=1 cargo test -p eyetime-core schedule_vectors` rewrites it) | the same test (it must still produce the file) and `scripts-dev/tests/conformance.test.mjs` |

A difference that is on purpose is written down in the test of its side and not hidden in the vectors: a rule whose two times are the same means *all day* in the Windows program
(documented in its README) and *no schedule* in the extension (`isScheduleActive`); the vectors hold no such rule.
