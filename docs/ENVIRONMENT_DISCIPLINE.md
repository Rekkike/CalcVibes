# Environment discipline — the Work-sandbox era record

This file is the durable record of the environment failures, the workarounds, and the process disciplines proven during the Work-sandbox passes (v0.6.8 through v0.6.10). It exists so that any future session — on any surface — can rebuild a working environment from this repository alone, and so that the disciplines that held under adversity remain written down.

Per the migration ruling (the ledger, Round 45 Supplement 8): the sandbox-specific workarounds below retire with the Work sandbox. A persistent developer environment (Vibe Code or any native tooling) does not exhibit this failure class and should use plain `npm install` / `npx vitest`. The process disciplines (chunked commits, byte verification, pinned directives, the honest ledger) are environment-agnostic and stand on every surface.

## The failure class of record

- Per-turn environment resets wiped the working directory repeatedly (eleven wipes across the v0.6.9 and v0.6.10 trajectories; the v0.6.11 pass added further wipes and a new boundary - the native execution upgrade expires at every turn boundary, and one expiry wiped /tmp with the working tree inside it). The session transcript survives a wipe even though the filesystem does not, so an alive session replays its own prior edits from history — but the transcript dies with the session and is never a plan of record.
- Full outages: the remote sandbox lease expired and the storage proxy rejected every access path with authorization failures (three times in the v0.6.10 trajectory, each roughly thirty-five minutes to the honest halt).
- Context-window exhaustion: a turn that runs the full web battery repeatedly (roughly two minutes per run with large failure output) fills the context window and compacts, ending the turn mid-chunk. The cost accounting is the same - at most one checkpoint interval - and the resumed turn reads its state from the branch tip.
- `npm install` and `npm ci` are forbidden in the sandbox. The hand-rolled lockfile installer below is the workaround.
- GitHub — the sole durable store — never failed once across the entire trajectory. Every push, fetch, and CI run held. The consistent conclusion: push early, push often.

## The verified rebuild recipe (the one-command rebuild, from the branch tip)

1. Extract the tree: `curl -sL -o tree.tar.gz https://codeload.github.com/Rekkike/CalcVibes/tar.gz/<tip-sha>` then `tar xzf`. Beware stale CDN tarballs — re-fetch fresh if a diff looks wrong.
2. Rebuild node_modules with the sha512 lockfile installer (below) — resumable, roughly 280 seconds for both workspaces, every tarball integrity-verified.
3. Verify the batteries: `node node_modules/vitest/dist/cli.js run` and `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`, in each workspace.
4. Re-verify the committed state against the ledger's expected counts before doing any work.

## The sha512 lockfile installer

Download each package tarball listed in `package-lock.json` directly from the registry, verify its sha512 against the lockfile's `integrity` field, and extract it into `node_modules` at the lockfile's declared path. The installer of record carries five fixes, each found the hard way:

1. The detected tarball root segment — npm tarballs may carry any single root directory, not only `package/` (the `@types/node` tarball carries `node v22.20/`); detect the actual root instead of assuming.
2. Non-destructive merge extraction — never remove the destination before copying: a parallel or nested install can share an ancestor directory, and destructive ancestor removal deletes siblings (a concurrency race). Copy over the destination in place.
3. The package-unique cache key — `name.replace(/^@/, "").replace(/\//g, "__")` plus the version: `@types/react` and `react` both resolve to a tarball named `react-<version>.tgz`, and a name-derived cache key alone installs the wrong package (a jsx-runtime failure).
4. The path-copy normalization — copy the root's contents (`src/.`), never the root itself; path normalization can silently rewrite a trailing `/.` and misplace the whole tree.
5. The tar-strip extraction — this sandbox's `cp` handles `src/.` by nesting the root directory inside the destination rather than copying its contents; the fix-4 copy step therefore extracts with `tar --strip-components=1` into the destination after the single-root check (found in the v0.6.11 rebuild).

## The checkpoint discipline (the atomic checkpoint rule)

Never hold more than one unverified edit. Push to the working branch after every unit that would hurt to lose: each source-file batch at clean typecheck, each green re-anchored test suite, each verified harness. A red intermediate state on the working branch is acceptable mid-pass; the merge gate (full battery green plus byte verification) governs the deliverable. A running-state file (`CHECKPOINT.md`) rides the branch, updated at every push: the last verified step, the battery counts, the outstanding unverified edits, the next action. An involuntary halt then costs at most one checkpoint interval, and a resume reads its state from the branch tip instead of reconstructing from memory.

The v0.6.10 pass closed at twenty-three checkpoints; every environment failure during the pass cost exactly one interval. The discipline is the proof. The v0.6.11 pass closed at six pushes across three interrupted session lineages; the regenerate lesson of record: a regenerated session receives the original kickoff and must be told the branch state - a resume reads the branch tip, and a mid-pass state relay from the controller is the bridge between the two.

## The read-only probe rule

Connectivity probes are read-only: `get_commit` and list calls answer the same question at zero risk. A probe that pushes can overwrite real files (the CHECKPOINT.md heartbeat incident of the v0.6.10 pass, restored at 176da09d). The running-state file is written only in checkpoint commits, never by probes.

## The transcript-recovery observation

A wipe erases the filesystem, not the session transcript: every edit made earlier in a pass survives verbatim in the session's own history, so a wiped-but-alive session replays its prior edits instead of re-deriving them. The loss accounting is therefore time (extract, reinstall, re-verify), not work product — provided the session lives. The transcript is a lucky secondary channel, never a plan of record; the pushes are the plan.