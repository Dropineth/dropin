-- Route-closed canonical project lifecycle source-composition prerequisites.
-- This migration adds no route, scheduler, writer grant, or production activation.
BEGIN;

ALTER TABLE governance.proof_policy_versions
  DROP CONSTRAINT IF EXISTS proof_policy_versions_subject_check;

ALTER TABLE governance.proof_policy_versions
  ADD CONSTRAINT proof_policy_versions_subject_check CHECK (
    subject IN ('methodology_publication', 'environmental_proof_record', 'project_lifecycle')
  ) NOT VALID;

ALTER TABLE governance.proof_policy_versions
  VALIDATE CONSTRAINT proof_policy_versions_subject_check;

CREATE OR REPLACE FUNCTION governance.validate_proof_policy_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  predecessor governance.proof_policy_versions%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  latest_sequence bigint;
  policy_stream_id text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  IF transaction_actor_id IS NULL OR transaction_actor_id <> NEW.creator_id THEN
    RAISE EXCEPTION 'governed policy requires matching app.actor_id' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT verification.actor_snapshot_is_valid(
    NEW.creator_snapshot, NEW.creator_id, NEW.governance_organization_id,
    'human', ARRAY['owner', 'admin']::text[]
  ) OR NEW.creator_snapshot->>'role' NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'governed policy creator authority is invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT audit.is_sorted_unique_text_array(NEW.allowed_reviewer_roles)
     OR NOT (NEW.allowed_reviewer_roles <@ ARRAY['admin', 'owner', 'researcher', 'verifier']::text[])
     OR NOT ('verifier' = ANY(NEW.allowed_reviewer_roles))
     OR (
       NEW.subject = 'environmental_proof_record'
       AND NOT (NEW.allowed_reviewer_roles && ARRAY['admin', 'owner']::text[])
     )
     OR (
       NEW.subject IN ('methodology_publication', 'project_lifecycle')
       AND NOT (NEW.allowed_reviewer_roles && ARRAY['admin', 'owner', 'researcher']::text[])
     ) THEN
    RAISE EXCEPTION 'governed policy constitutional reviewer quorum is invalid' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.supersedes_policy_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM governance.proof_policy_versions prior WHERE prior.subject = NEW.subject) THEN
      RAISE EXCEPTION 'governed policy subject already has authority and requires exact supersession' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    SELECT * INTO STRICT predecessor
    FROM governance.proof_policy_versions WHERE id = NEW.supersedes_policy_id FOR SHARE;
    IF predecessor.policy_root <> NEW.supersedes_policy_root
       OR predecessor.subject <> NEW.subject
       OR predecessor.governance_organization_id <> NEW.governance_organization_id
       OR NEW.created_at <= predecessor.created_at
       OR EXISTS (
         SELECT 1 FROM governance.proof_policy_versions successor
         WHERE successor.supersedes_policy_id = predecessor.id
       ) THEN
      RAISE EXCEPTION 'governed policy supersession authority is invalid or forked' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  policy_stream_id := 'governed_policy:' || NEW.subject;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT max(sequence_no) INTO latest_sequence
  FROM audit.domain_events WHERE stream_id = policy_stream_id;
  IF semantic_event.stream_id <> policy_stream_id
     OR semantic_event.sequence_no <> latest_sequence
     OR semantic_event.previous_root <> COALESCE(predecessor.audit_event_root, audit.genesis_root())
     OR semantic_event.actor_id <> NEW.creator_id
     OR semantic_event.entity_type <> 'governed_policy_authority'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.created_at <> NEW.created_at
     OR semantic_event.rationale <> 'An immutable governed policy version was recorded under constitutional human-quorum invariants.' THEN
    RAISE EXCEPTION 'governed policy semantic event binding is invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.safety <> governance.methodology_governance_safety_canonical()
     OR projects.contains_unsafe_claim(ARRAY[NEW.id, NEW.title])
     OR NEW.command_hash <> governance.proof_policy_command_hash(NEW)
     OR NEW.id <> 'cp_governed_policy_' || left(NEW.command_hash, 24)
     OR NEW.policy_hash <> governance.proof_policy_hash(NEW)
     OR NEW.policy_root <> governance.proof_policy_root(NEW)
     OR semantic_event.payload_hash <> governance.proof_policy_payload_hash(NEW) THEN
    RAISE EXCEPTION 'governed policy canonical hash or safety lineage is invalid' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
