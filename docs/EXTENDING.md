# Registering programs, games and exhibits

The plugin is a trusted-package host, not an arbitrary code uploader. Install a vetted module's manifest and its standalone assets together. No routing/Admin core change is needed for another ID.

## Original working example

`examples/signal-station/` contains a complete newly written native player, instructions and manifest. Open its `index.html` directly to try STATUS/TOGGLE/RESET. It has no network, persistence or portable saves; do not advertise unsupported capabilities.

To install on an isolated development site, copy `manifest.json` to `games/signal-station.json`, then copy `index.html`, `game.js`, `player.css` and `manual.html` into `assets/games/signal-station/`. Create those directories if absent. Clear host cache. Admin now shows Signal Station settings. Enable and publish it explicitly to expose `/basic-lab/signal-station` and `/basic-lab/signal-station/play`. The catalog discovers it automatically. Unpublish/remove the manifest and complete asset directory to remove it. Keep backups outside served paths.

## Manifest contract (version 1)

Start with the working example. Filename and `id` must match `[a-z][a-z0-9-]{0,63}`. Required descriptive fields are `title`, `description`, `author`, `version`, `edition`, `licensingStatus`; each is bounded plain text. Keep attribution in the package, not in title-specific shared templates.

Set `adapter` to `native` or `basic-interpreter` to describe execution, not to load remote code. Declare positive integer `saveVersion`, nonempty `rulesets`, a matching `defaultRuleset` and ordered `editions` mapping. `active`, `draft`, `downloadsPermitted` are booleans. Reference links must be HTTPS. The canonical entrypoint is exactly `assets/games/<id>/index.html`. The old player/0.1.0 path is a narrowly retained compatibility exception, not a new module convention.

Optional `exhibit` contains plain-text `heading`, `description`, and up to 12 `facts` with `label`/`value`. These are validated and HTML-escaped. Every module can supply its own computing roots, edition and control explanation. `manual.html` is trusted build-time editorial HTML; review/sanitize it yourself before installation. Never generate it from imported save data or unrestricted Admin HTML.

The plugin creates a catalog card, exhibit and iframe player using the validated local entrypoint. Its Admin2 API hook and blueprint callable derive enable/publish/route/edition/columns/phosphor settings. The native player owns rules, input, rendering, deterministic random behavior and versioned saves. The URL query supplies `ruleset`, `columns`, `theme`, `saves`, `exports`, `sources` and `provenance`; a player should implement or explicitly document unsupported options. Save validation must be module-specific; the plugin does not deserialize game states.

## BASIC programs

The Computer's original example shelf is owned by the pinned BASIC release. To add a new shelf entry, modify/test that upstream example registry and ship a new pinned release. Do not edit the generated vendored bundle in place.

A separately packaged BASIC exhibit can use `adapter: basic-interpreter` and a self-contained local host at the canonical game entrypoint. That host must execute the actual BASIC program using a pinned interpreter and yield at INPUT/STOP boundaries; do not silently substitute a native implementation. Include the program's rights/attribution and exact source identity. Use a Worker with unchanged budgets/message validation, and separate source/workspace/media formats from any custom game snapshot. The current plugin does not promise a universal save-state adapter for arbitrary BASIC source.

## Standalone and iframe behavior

Each player should run independently from Grav. Use native labeled controls, visible focus, escaped output and keyboard-accessible transcript navigation. The Computer and existing integration support 40/80 columns and three phosphors; respect mobile touch targets. For auto-resize, the bundled parent bridge implements the documented channel/token/origin/source protocol; the corresponding child helper is maintained in RetroRealm BASIC's `packages/player/embed.js`. Reuse the pinned version rather than inventing a wildcard postMessage handler. A static-height module must make any internal scrolling accessible and predictable.

No PHP, core route switch or Admin field list should be added for a new game. Tests demonstrate native and BASIC-program manifest discovery. Do not infer publication rights from the adapter type, magazine availability or platform license; preserve module notices and publish only after the site owner authorizes that exact content.
