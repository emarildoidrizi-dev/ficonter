FICONTER Phase 1 QA migration correction

The migration now drops the existing RPC function signatures inside the same transaction before recreating them. This resolves PostgreSQL error 42P13: cannot remove parameter defaults from existing function.

Run the complete corrected file:
supabase/phase1_qa_finalization.sql

Do not run only a partial selection. The previous failed run was rolled back because the migration is wrapped in BEGIN/COMMIT.
