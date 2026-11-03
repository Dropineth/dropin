import { canonicalRightsJson, requireRights, rightsDigest, rightsTime, validateRightsOperation } from './authorization.js';
import { applyRightsOperation } from './rights.js';
import type { RightsApproval, RightsContext, RightsOperation, RightsState } from './rights-types.js';

/** Structural adapter for the pinned DeepSeek Trigger contract, not AHIN wire bytes.
 * Only the trusted application builds these private, synthetic proposal events.
 * Source admission, a mandate, model output and this event grant no authority.
 */
export function createCaiChildTrigger(workId: string, at: string, operation: RightsOperation) {
  requireRights(typeof workId === 'string' && /^cai-[a-f0-9]{32}$/.test(workId), 'INVALID_CAI_WORK_ID');
  rightsTime(at);
  validateRightsOperation(operation);
  return {
    id: workId,
    source: 'canopyproof-child-proposal',
    threads: [{ source: 'canopyproof-child-proposal', id: workId }],
    actor: { source: 'canopyproof-child-proposal', id: 'application-proposal-service' },
    human: false,
    at,
    text: 'Review a synthetic child-account proposal. No execution authority is granted.',
    meta: {
      schema: 'CanopyProof-CAI-Proposal/1',
      operationDigest: rightsDigest(operation),
      operationType: operation.operationType,
      finalAuthority: false,
      syntheticOnly: true,
    },
  };
}

export type CaiChildTrigger = ReturnType<typeof createCaiChildTrigger>;

/** Server-side review port. Never expose context/credentials/state to a model.
 * Caller reloads current state and context; no enqueue-time authorization is
 * cached. This is a pure simulation: even its calculated state is discarded.
 * Real execution must still enter the existing transactional command endpoint
 * with its own current consent, authority, replay and restore checks.
 */
export function reviewCaiChildProposal(input: {
  mode: 'synthetic-review' | 'ahin-execution';
  trigger: CaiChildTrigger;
  operation: RightsOperation;
  approvals: RightsApproval[];
}, current: { state: RightsState; context: RightsContext }) {
  requireRights(input.mode === 'synthetic-review', 'AHIN_AUTHORITY_UNAVAILABLE');
  const expected = createCaiChildTrigger(input.trigger.id, input.trigger.at, input.operation);
  // Reject modified content, extra metadata, cross-work references and operation substitution.
  requireRights(canonicalRightsJson(input.trigger) === canonicalRightsJson(expected), 'CAI_PROPOSAL_CHANGED');
  requireRights(rightsTime(input.trigger.at) <= rightsTime(current.context.now), 'CAI_EVENT_FROM_FUTURE');
  applyRightsOperation(current.state, input.operation, input.approvals, current.context);
  return {
    schema: 'CanopyProof-CAI-Review/1' as const,
    workId: input.trigger.id,
    operationDigest: expected.meta.operationDigest,
    reviewedAt: current.context.now,
    status: 'simulation-passed-requires-current-execution-check' as const,
    finalAuthority: false as const,
    syntheticOnly: true as const,
    executionEnabled: false as const,
  };
}
