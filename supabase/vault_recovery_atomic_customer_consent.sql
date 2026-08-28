-- Atomic authenticated Vault recovery consent submission.
create or replace function public.customer_submit_vault_recovery_consent(
  p_recovery_request_id uuid,
  p_user_id uuid,
  p_signature text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns table(document_id text, signed_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_document public.vault_recovery_documents%rowtype;
  v_now timestamptz := clock_timestamp();
  v_signature text := btrim(coalesce(p_signature,''));
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;
  if length(v_signature) < 2 or length(v_signature) > 500 then
    raise exception 'Add your electronic signature before submitting the document.';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request metadata.'; end if;
  if p_user_agent_hash is not null and p_user_agent_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request metadata.'; end if;

  select * into v_request from public.vault_recovery_requests r
  where r.id = p_recovery_request_id and r.user_id = p_user_id for update;
  if not found then raise exception 'Recovery request not found.'; end if;
  if v_request.archived_at is not null then raise exception 'This recovery request is no longer active.'; end if;
  if v_request.status <> 'consent_pending' then raise exception 'This recovery request is not awaiting consent.'; end if;

  select * into v_document from public.vault_recovery_documents d
  where d.recovery_request_id = p_recovery_request_id and d.sent_to_customer_at is not null
  order by d.generated_at desc limit 1 for update;
  if not found then raise exception 'No consent document has been sent to this account.'; end if;
  if coalesce(v_document.customer_signed_at,v_document.signed_at,v_document.signed_uploaded_at) is not null then
    raise exception 'This consent document has already been signed.';
  end if;

  update public.vault_recovery_documents
  set status='signed', customer_signed_at=v_now, customer_signed_by=p_user_id,
      customer_signature=v_signature, customer_signature_method='authenticated_electronic_signature',
      customer_submission_ip_hash=p_ip_hash,
      customer_submission_user_agent_hash=p_user_agent_hash, signed_at=v_now
  where id=v_document.id;

  update public.vault_recovery_requests
  set status='consent_signed', updated_by=p_user_id, updated_at=v_now
  where id=p_recovery_request_id;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values(p_recovery_request_id,'customer_electronic_consent_signed',p_user_id,
    jsonb_build_object('document_id',v_document.document_id,'sent_at',v_document.sent_to_customer_at,
      'signed_at',v_now,'signature_method','authenticated_electronic_signature',
      'ip_hash_recorded',p_ip_hash is not null,'user_agent_hash_recorded',p_user_agent_hash is not null));

  insert into public.user_notifications(user_id,kind,title,body,href,metadata)
  values(p_user_id,'system','Vault recovery consent submitted',
    'Your signed Vault recovery consent was received by FICONTER.',
    '/dashboard/inbox/vault-recovery/' || p_recovery_request_id::text,
    jsonb_build_object('recovery_request_id',p_recovery_request_id,'document_id',v_document.document_id));

  return query select v_document.document_id,v_now;
end;
$$;

revoke all on function public.customer_submit_vault_recovery_consent(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.customer_submit_vault_recovery_consent(uuid,uuid,text,text,text) to service_role;
