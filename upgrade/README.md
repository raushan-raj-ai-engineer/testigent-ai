# V6 upgrade bundle contract

`APPLY_UPGRADE.sh <target>` upgrades only files whose current bytes still match the recorded baseline. It preflights all conflicts before copying anything, keeps backups outside the repository, and is idempotent. `VERIFY_UPGRADE.sh <target>` verifies the desired V6 hashes.

For a fresh install, use the full framework ZIP instead of the upgrade script. For an existing customized installation, commit/back up local work first; the script refuses to overwrite divergent files.
