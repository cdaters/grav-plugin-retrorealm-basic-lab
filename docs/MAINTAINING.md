# Versioned dependency and release maintenance

The checked-in `vendor/retrorealm-basic/computer` is a complete local BASIC release. `basic-runtime.lock.json` records exact version, build, source commit, upstream manifest SHA-256 and every Computer file. `npm run build` fails on drift, then recreates the generated root mirror and `dist/plugin`. It does not access sibling projects or any network service.

To upgrade deliberately, obtain and verify an approved BASIC release locally, then run:

```
node scripts/vendor-basic.mjs /local/path/to/basic/dist/manifest.json --update
npm run build
npm test
```

Review the entire lock/vendor/generated diff, license/notice changes and compatibility reports. Do not modify vendor files to patch behavior; make the change upstream, release it, then repin. The current accepted version is 0.7.0. Change the explicit allowed version in the vendor verifier only as part of a tested upgrade. This is a data/build dependency, not a Grav GPM plugin dependency; the end-user runtime is already bundled.

Keep root PHP/classes/templates/pages/blueprint/docs as authoritative platform source. The distribution allowlist excludes scripts/tests/vendor duplication but includes installer docs and the original module example. The source package includes maintainable tests/build inputs and the pin. A source checkout is installable because generated Computer assets are checked in. Rebuild before commit and verify the mirror matches the vendor; packaging requires a clean committed tree and refuses to overwrite a differing ZIP.

Update package/release/blueprint/CHANGELOG consistently. Public repository: `https://github.com/cdaters/grav-plugin-retrorealm-basic-lab`. Public release/tag/GPM indexing and website installation are distinct actions. Apache-2.0 covers original project materials; preserve all included LICENSE and NOTICE files.

Use PHP tests for manifest/exhibit/route rejection and Node tests for exact dependency/mirror pinning. Browser integration needs a separately installed Grav site and development-only Playwright. A production-like fixture must remain private if it uses a proprietary theme or site content. Never export that fixture, local accounts, or historical collection assets into this repository.
