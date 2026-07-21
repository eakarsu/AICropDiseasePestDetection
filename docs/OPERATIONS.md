# CropGuard operations

`start.sh` only starts this repository's two processes and terminates only the PIDs it created. It does not install packages, claim ports, create schemas, migrate, or seed.

1. Run `scripts/bootstrap.sh` once and replace every placeholder in `.env`.
2. Run `scripts/migrate.sh`. It applies numbered migrations to an existing baseline. The legacy base schema is destructive and runs only with `APPLY_DESTRUCTIVE_LEGACY_BASELINE=yes` outside production; use that switch solely for a new disposable database.
3. Create a tenant and explicit `cg_tenant_memberships`; there is no implicit cross-farm access.
4. Run `start.sh`. Demo data requires both a non-production environment and `CONFIRM_DEMO_SEED=yes`.

The governed workflow stores observation fingerprints, immutable evidence hashes, provider-sync failures, optimistic versions, audit snapshots, and an outbox. Recommendations cannot be dispatched until an independent agronomist approves them and an operator accepts safety constraints. Model output is advisory evidence only. Weather, GIS, remote-sensing, lab, equipment, calendar and notification adapters remain disabled until credentials and contract fixtures are supplied. Agronomic, pesticide-label and regional regulatory validation remain external release gates.
