# RetroRealm BASIC Lab

A reusable Grav 2 / Admin 2 platform for interactive programs, native game modules and historical software exhibits. It includes a locally bundled, version-pinned RetroRealm BASIC Computer with seven original examples and an HTML manual. No runtime GitHub/CDN access is required.

**v0.7.2 public beta · beta1.** Apache-2.0, copyright Craig Daters; see [LICENSE](LICENSE) and [NOTICE](NOTICE). [Release downloads](https://github.com/cdaters/grav-plugin-retrorealm-basic-lab/releases/tag/v0.7.2). Historical games are separately installed content, not part of this repository or its software license. The original Signal Station extension example is included under `examples/`, not automatically published.

## Install and review

Extract the complete plugin package as `user/plugins/retrorealm-basic-lab`. Back up the entire previous directory and site/environment config outside the web root; never overlay a private collection build, because old static assets could survive. The source checkout also contains the verified generated Computer mirror and can be installed without Node.

Defaults enable `/basic-lab` and `/basic-lab/session/basic-session`. In Admin2, enable the plugin/Computer and choose an unused catalog prefix. Installed manifest packages automatically receive enable/publish/route/edition/columns/phosphor controls. The theme supplies normal branding and global navigation; plugin templates/styles stay scoped. There is no required global theme edit.

[Installation and rollback](docs/INSTALLATION.md) · [Adding programs and native modules](docs/EXTENDING.md) · [Dependency updates/builds](docs/MAINTAINING.md) · [Security and privacy](docs/SECURITY.md).

## Independent projects

RetroRealm BASIC owns the tokenizer, parser, engine, profiles, devices, browser Computer, source editor, examples and language manual. BASIC Lab owns catalogs, exhibit/player pages, trusted registration, Admin settings and iframe integration. A site collection owns each game's code, instructions, attribution, rights and data. Removing Grav leaves the Computer and standalone players usable.

`basic-runtime.lock.json` pins BASIC 0.7.1 to its source commit and upstream inventory hash; `vendor/retrorealm-basic` is the exact local release. The build verifies all bytes before producing `assets/environments/basic-session` and the plugin package. It never fetches code. Operator-installed native modules can have their own release/save versions and standalone builds.

## Build and test

Node 22+, PHP 8.3+ and Python 3 are the tested maintenance tools. No production npm dependencies or framework installation are needed.

```sh
npm run build
npm test
npm run package
```

The plugin package contains runtime files, documentation and the original extension example, not source tests/build tools/vendor duplication. The separate source archive includes the maintainable build/test inputs and pinned vendor. `dist/manifest.json` and `dist/archives.json` record exact inventories/hashes. GitHub releases are separate from GPM indexing; no GPM submission is included in this beta.

No historical source, adapted game database, scans, ROM, production theme/configuration or private history is included. Admin publish controls are navigation controls, not access control for files. Install only content authorized for the destination. Retain `LICENSE`, `NOTICE` and bundled BASIC notices. Feedback: [craig@daters.net](mailto:craig@daters.net) or [GitHub issues](https://github.com/cdaters/grav-plugin-retrorealm-basic-lab/issues). Human VoiceOver and physical-device testing remain public-beta follow-up work.
