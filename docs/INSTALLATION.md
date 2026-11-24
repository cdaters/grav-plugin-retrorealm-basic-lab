# Installation, configuration and rollback

Target Grav 2 / Admin2; the local production-theme rehearsal uses Grav 2.2.32, Admin2 2.2.16 and PHP 8.3. Keep the host's own updates, permissions and backups separate from this plugin.

1. Verify release filename, SHA-256, inventory, license status and publication authority. Reject symlinks, traversal entries or extra files. Back up the entire old plugin and every site/domain/environment `retrorealm-basic-lab.yaml` outside served paths; record absence for a new installation. Preserve browser game saves separately.
2. Stage the complete directory outside the web root. If replacing, rename the old whole directory out, then install the new one as `user/plugins/retrorealm-basic-lab`. Preserve site ownership, ordinary 755/644 directory/file permissions. Never overlay a private collection with a base plugin, because unlisted game assets would remain.
3. Configure through Admin2 or `user/config/plugins/retrorealm-basic-lab.yaml`. Defaults enable BASIC Computer and route `/basic-lab`, 80 columns, green phosphor, saves/exports, source/provenance panels. Environment-specific overrides can win; inspect the merged settings if changes appear ineffective.
4. Clear the host's compiled cache using its supported cache command. For the rehearsed Grav 2.2.32 installation, `php bin/grav cache --cache-only` works; it also touches system.yaml's modification time. Check the host image-cache policy first and retain unrelated config bytes.
5. Verify catalog, Computer, manual, Worker/input, fullscreen, keyboard/mobile and Admin fields/icon. A missing historical package must have no manifest **or static asset directory**. A draft/disabled game can still be fetched through its static URL.

Admin per-package keys use `game__<id>__enabled`, `game__<id>__published`, `game__<id>__route`, `game__<id>__ruleset`, `game__<id>__columns`, `game__<id>__theme`. The server derives fields from trusted installed manifests. Flat fields override older nested `games.<id>.*` entries; do not set both casually. Publish defaults to false for a draft package. Existing real Grav content wins route collisions; choose an unused route, never an Admin/API prefix.

Rollback: quarantine the new directory outside served paths; restore the complete old plugin and exact prior config bytes/modes/ownership, or restore absence for a new install. Clear the same cache, verify the prior routes and unrelated site, and retain logs/inventories. Do not delete exported saves. Changing or removing a module does not migrate its save version.

The Computer iframe supports scripts/same origin, forms, downloads, fullscreen and a separate documentation tab. Host CSP must permit the reviewed local assets and Blob Worker. Do not weaken CSP to arbitrary remote origins to solve a loading error. Check actual responses and browser errors first.

The plugin creates virtual pages and inherits theme navigation; it does not insert a global menu item. A site owner can add a normal navigation link to `/basic-lab` using their theme/content conventions as a separately reviewed content change. No unrelated theme customization is necessary.
