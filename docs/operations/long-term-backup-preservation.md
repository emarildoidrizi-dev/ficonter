# FICONTER Long-Term Backup Preservation Policy

## Purpose

FICONTER recovery must remain usable beyond the life of any single SSD, computer, vendor or file format.

No individual SSD, hard drive, optical disc, cloud account or current backup technology should be assumed to remain reliable for 200 years. Long-term preservation is therefore a **migration process**, not a one-time purchase.

## Core rule

The FICONTER Owner Recovery Archive is the logical backup. Physical media are replaceable carriers.

The archive must be periodically copied, verified, test-restored and migrated to newer media and tooling as technology changes.

## Recommended preservation model

Maintain at least:

1. **Primary offline owner copy** on the current external SSD.
2. **Second encrypted physical copy** on different media stored in a separate secure location.
3. **Independent recovery-password custody** separate from both backup copies.

The owner may add further copies or institutional archival storage later, but no external provider is required for the baseline owner-controlled model.

## Media lifecycle

Do not wait for a drive to fail.

- Inspect backup media at least annually.
- Verify SHA-256 hashes of current recovery archives at least annually.
- Perform a recovery drill at least annually.
- Replace/migrate consumer SSD backup media approximately every 3-5 years, or sooner if health, compatibility or vendor support becomes uncertain.
- Copy the archive to the replacement medium, verify hashes, test archive decryption, and only then retire the old medium.
- Keep at least two independently stored verified copies during every migration.

These intervals are operational policy, not a claim that any specific SSD will fail at a particular age.

## Format preservation

Current FICONTER recovery uses broadly documented formats:

- Git bundle / Git repository history
- ZIP source snapshot
- PostgreSQL custom dump
- ordinary Storage object files/directories
- UTF-8 text manifests
- SHA-256 checksums
- AES-encrypted 7z archive

During future migrations, preserve the original archive where practical and also migrate to then-current, well-supported open/documented formats if 7z, Git or PostgreSQL tooling becomes obsolete.

## 200-year continuity principle

A 200-year strategy requires stewardship across generations or successor operators.

At every technology generation:

1. verify that the archive can still be read;
2. verify that the encryption implementation is still supported and considered secure;
3. migrate to contemporary media before existing hardware/interfaces disappear;
4. update the recovery documentation;
5. perform a complete isolated restore test;
6. preserve ownership/recovery access for domain, code, database and required service credentials;
7. transfer custody instructions securely to the next authorized owner/operator when required.

The target is **continuous recoverability**, not 200 years of untouched storage on one device.

## Trigger-on-connect backups

The Windows owner backup system is designed so that the external SSD may remain disconnected most of the time.

When the configured backup SSD changes from disconnected to connected while the owner is logged in, the watcher launches one verified encrypted backup and then waits for the drive to be disconnected before another connection can trigger a new run.

This reduces exposure of the offline backup medium while keeping the backup workflow simple.
