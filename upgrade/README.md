# TestigentAI v1.2.0 upgrade bundle contract

`APPLY_UPGRADE.sh <target>` upgrades an existing TestigentAI v1.1.2 stable installation to the v1.2.0 declarative-authoring release only when each target file still matches the recorded supported baseline. The supported baseline includes the v1.1.2 PR CI hardening and TodoMVC declarative-route hotfix that were merged after the original v1.1.2 ZIP.

The script preflights all conflicts before copying anything, keeps backups outside the repository, and is idempotent. `VERIFY_UPGRADE.sh <target>` verifies the desired installed hashes.

The bundle metadata files `upgrade/v6-manifest.json` and `release/RELEASE-MANIFEST.sha256` are intentionally not installed through the manifest because hashing either into itself would create a cyclic contract. They remain part of the full release ZIP.

For a fresh install, use the full framework ZIP instead of the upgrade script. For an existing customized installation, commit/back up local work first; the script refuses to overwrite divergent files.
