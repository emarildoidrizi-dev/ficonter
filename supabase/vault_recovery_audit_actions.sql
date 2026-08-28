-- FICONTER · Vault Assisted Recovery audit lifecycle
-- Keeps the recovery audit ledger aligned with all active consent and Recovery Access events.

begin;

alter table public.vault_recovery_case_audit
  drop constraint if exists vault_recovery_case_audit_action_check;

alter table public.vault_recovery_case_audit
  add constraint vault_recovery_case_audit_action_check
  check (action in (
    'created',
    'updated',
    'archived',
    'restored',
    'status_verification_pending',
    'status_consent_signed',
    'status_approved',
    'status_rejected',
    'status_cancelled',
    'consent_document_generated',
    'signed_consent_uploaded',
    'consent_document_sent_to_customer',
    'customer_electronic_consent_signed',
    'recovery_access_issued',
    'recovery_access_revoked',
    'recovery_access_claimed',
    'recovery_access_completed',
    'recovery_access_expired',
    'recovery_access_failed'
  ));

commit;

notify pgrst, 'reload schema';
