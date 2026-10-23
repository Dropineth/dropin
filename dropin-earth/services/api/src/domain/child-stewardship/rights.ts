import { assertDelegationNarrower, authorizeRightsOperation, assertRightsReference, canonicalRightsJson, ChildRightsError, requireRights, rightsDigest, rightsInteger, rightsTime } from './authorization.js';
import type { RightsApproval, RightsContext, RightsEntitlement, RightsFundingLot, RightsOperation, RightsState } from './rights-types.js';
export * from './rights-types.js';
export { ChildRightsError, authorizeRightsOperation, canonicalRightsJson, rightsDigest };

export function createEmptyRightsState(): RightsState {
  return { schemaVersion: 1, mode: 'synthetic-demo', beneficiaries: {}, destinations: {}, entitlements: {}, fundingLots: {}, contributions: {}, outcomeBudgets: {}, payments: {}, delegations: {}, consumedNonces: [], executedOperations: {}, approvalRecords: {}, economicKeys: [], cumulativeAmounts: {}, outbox: [], audit: [] };
}
function requiredRef(value: unknown): string { assertRightsReference(value); return value; }
function safeSum(values: number[]): number {
  const sum = values.reduce((total, value) => { rightsInteger(value); return total + value; }, 0);
  rightsInteger(sum, 'AMOUNT_OVERFLOW'); return sum;
}
function entitlement(state: RightsState, operation: RightsOperation): RightsEntitlement {
  requireRights(operation.entitlementIds.length === 1, 'ONE_ENTITLEMENT_REQUIRED');
  const item = state.entitlements[operation.entitlementIds[0]!];
  requireRights(item && item.beneficiaryRef === operation.beneficiaryRef && item.currency === operation.currency, 'ENTITLEMENT_UNAVAILABLE');
  return item;
}
function fundingLot(state: RightsState, operation: RightsOperation): RightsFundingLot {
  requireRights(operation.fundingLotIds.length === 1, 'ONE_FUNDING_LOT_REQUIRED');
  const item = state.fundingLots[operation.fundingLotIds[0]!];
  requireRights(item && item.currency === operation.currency, 'FUNDING_UNAVAILABLE'); return item;
}
function allocation(lot: RightsFundingLot, id: string) {
  return lot.allocations[id] ?? (lot.allocations[id] = { reservedMinor: 0, vestedMinor: 0, submittedMinor: 0 });
}
function unspent(state: RightsState, id: string): number {
  return safeSum(Object.values(state.fundingLots).map(lot => { const item = lot.allocations[id]; return item ? safeSum([item.reservedMinor,item.vestedMinor,item.submittedMinor]) : 0; }));
}
function economicKey(state: RightsState, components: string[]): void {
  const key = rightsDigest(components);
  requireRights(!state.economicKeys.includes(key), 'ECONOMIC_REPLAY'); state.economicKeys.push(key);
}
/** Accounting is separate from legal status: unfunded and disputed obligations still count. */
export function rightsReconciliation(state: RightsState) {
  const assetsMinor = safeSum(Object.values(state.fundingLots).map(lot => lot.clearedAssetsMinor));
  const unallocatedMinor = safeSum(Object.values(state.fundingLots).map(lot => lot.unallocatedMinor));
  const allocations = Object.values(state.fundingLots).flatMap(lot => Object.values(lot.allocations));
  const reservedMinor = safeSum([...allocations.map(item => item.reservedMinor),...Object.values(state.fundingLots).flatMap(lot => Object.values(lot.outcomeReserves))]);
  const vestedMinor = safeSum(allocations.map(item => item.vestedMinor));
  const submittedMinor = safeSum(allocations.map(item => item.submittedMinor));
  const legalOutstandingMinor = safeSum(Object.values(state.entitlements).map(item => item.amountMinor - item.paidMinor));
  return { currency: 'XTS' as const, synthetic: true as const, assetsMinor, unallocatedMinor, reservedMinor, vestedMinor, submittedMinor, legalOutstandingMinor, unfundedMinor: Math.max(0, legalOutstandingMinor - safeSum([reservedMinor,vestedMinor,submittedMinor])), differenceMinor: assetsMinor - safeSum([unallocatedMinor,reservedMinor,vestedMinor,submittedMinor]) };
}
export function assertRightsInvariants(state: RightsState): void {
  requireRights(state.schemaVersion === 1 && state.mode === 'synthetic-demo', 'INVALID_STATE');
  for (const item of Object.values(state.entitlements)) {
    rightsInteger(item.amountMinor); rightsInteger(item.paidMinor);
    requireRights(item.paidMinor <= item.amountMinor, 'OVERPAYMENT');
    requireRights(item.currency === 'XTS' && !!state.beneficiaries[item.beneficiaryRef], 'INVALID_ENTITLEMENT');
    requireRights(unspent(state,item.id) <= item.amountMinor - item.paidMinor, 'EXCESS_RESERVATION');
  }
  for (const lot of Object.values(state.fundingLots)) {
    requireRights(lot.currency === 'XTS', 'CURRENCY_MISMATCH'); rightsInteger(lot.clearedAssetsMinor); rightsInteger(lot.unallocatedMinor);
    const buckets = Object.entries(lot.allocations).map(([id, item]) => {
      requireRights(!!state.entitlements[id], 'ORPHAN_ALLOCATION');
      return safeSum([item.reservedMinor,item.vestedMinor,item.submittedMinor]);
    });
    requireRights(lot.clearedAssetsMinor === safeSum([lot.unallocatedMinor,...buckets,...Object.values(lot.outcomeReserves)]), 'CONSERVATION_FAILED');
  }
  requireRights(rightsReconciliation(state).differenceMinor === 0, 'CONSERVATION_FAILED');
  requireRights(new Set(state.consumedNonces).size === state.consumedNonces.length && new Set(state.economicKeys).size === state.economicKeys.length, 'REPLAY_STATE_CORRUPTED');
  for (const payment of Object.values(state.payments)) {
    rightsInteger(payment.amountMinor); rightsInteger(payment.refundedMinor);
    requireRights(payment.refundedMinor <= payment.amountMinor && payment.submissionCount === 1, 'INVALID_PAYMENT');
    requireRights(!!state.entitlements[payment.entitlementId] && !!state.fundingLots[payment.fundingLotId], 'ORPHAN_PAYMENT');
  }
}
function noticeWait(operation: RightsOperation, context: RightsContext, kind: 'recovery' | 'policy', minimum: number): void {
  const notice = context.notices[requiredRef(operation.details.notificationEvidenceRef)];
  requireRights(notice?.kind === kind && notice.beneficiaryRef === operation.beneficiaryRef && notice.operationDigest === rightsDigest(operation) && rightsTime(context.now) - rightsTime(notice.issuedAt) >= minimum, 'WAIT_PERIOD');
}
/** Pure, atomic transition. Persist result and outbox in one transaction after comparing state version.
 * No network request, production credential or provider adapter exists in this module.
 * A successful synthetic transition is never proof of an external legal/funding fact.
 */
export function applyRightsOperation(input: RightsState, operation: RightsOperation, approvals: RightsApproval[], context: RightsContext): RightsState {
  assertRightsInvariants(input);
  const authorization = authorizeRightsOperation(operation, approvals, context, input);
  const state = structuredClone(input);
  const details = operation.details;
  const amount = operation.amountMinor;
  const beneficiary = state.beneficiaries[operation.beneficiaryRef];
  switch (operation.operationType) {
    case 'REGISTER_BENEFICIARY': {
      const guardianActorRef = requiredRef(details.guardianActorRef);
      const signer = authorization.signers.find(item => item.role === 'G' && item.actorRef === guardianActorRef)!;
      state.beneficiaries[operation.beneficiaryRef] = { ref: operation.beneficiaryRef, legalSubjectRef: requiredRef(details.legalSubjectRef), guardianActorRef, guardianKeyId: signer.keyId, controllerRef: requiredRef(details.newControllerRef), participantKeyId: null, authorizationEpoch: 0, legalBasisRef: operation.legalBasisRef, status: 'active' };
      break;
    }
    case 'CONFIRM_CONTRIBUTION': {
      const id = requiredRef(details.contributionId), outcomeId = requiredRef(details.outcomeId), plan = requiredRef(details.fundingPlanId), participant = requiredRef(details.participantCanonicalRef);
      requireRights(!state.contributions[id], 'CONTRIBUTION_EXISTS');
      const numerator = details.attributionNumerator, denominator = details.attributionDenominator, budget = details.outcomeBudgetMinor;
      rightsInteger(numerator); rightsInteger(denominator); rightsInteger(budget);
      requireRights(denominator > 0 && denominator <= 1_000_000 && numerator <= denominator, 'ATTRIBUTION_LIMIT');
      const outcomeKey = rightsDigest([outcomeId,plan]);
      const reservedOutcome = state.outcomeBudgets[outcomeKey];
      requireRights(reservedOutcome && reservedOutcome.maximumMinor === budget, 'OUTCOME_NOT_PREFUNDED');
      const peers = Object.values(state.contributions).filter(item => item.outcomeId === outcomeId && item.fundingPlanId === plan);
      requireRights(peers.every(item => item.outcomeBudgetMinor === budget), 'OUTCOME_BUDGET_CHANGED');
      // Exact integer arithmetic; floor remainder stays in the children's unallocated pool.
      const reward = Number(BigInt(budget) * BigInt(numerator) / BigInt(denominator));
      requireRights(amount === reward, 'ATTRIBUTION_AMOUNT_MISMATCH');
      let n = BigInt(numerator), d = BigInt(denominator);
      for (const peer of peers) { n = n * BigInt(peer.denominator) + BigInt(peer.numerator) * d; d *= BigInt(peer.denominator); }
      requireRights(n <= d && safeSum([...peers.map(item => item.amountMinor),amount]) <= budget, 'ATTRIBUTION_LIMIT');
      // This ref must come from the protected project-local canonical subject map.
      requireRights(participant === beneficiary!.legalSubjectRef, 'CANONICAL_PARTICIPANT_MISMATCH');
      economicKey(state, ['contribution',outcomeId,plan,participant]);
      state.contributions[id] = { id, beneficiaryRef: operation.beneficiaryRef, participantCanonicalRef: participant, outcomeId, fundingPlanId: plan, amountMinor: amount, numerator, denominator, outcomeBudgetMinor: budget, policyVersion: operation.policyVersion, confirmedAt: context.now, objectionEndsAt: new Date(rightsTime(context.now) + context.policy.contributionObjectionMs).toISOString() };
      break;
    }
    case 'RECORD_OBLIGATION': {
      requireRights(operation.entitlementIds.length === 1 && amount > 0, 'INVALID_OBLIGATION');
      const id = operation.entitlementIds[0]!;
      requireRights(!state.entitlements[id], 'ENTITLEMENT_EXISTS');
      requireRights(details.rightKind === 'contractual_grant' || details.rightKind === 'lawful_service_benefit', 'RIGHT_KIND_INVALID');
      requireRights(typeof details.contributionRequired === 'boolean', 'CONTRIBUTION_CONDITION_REQUIRED');
      const contributionId = details.contributionRequired ? requiredRef(details.contributionId) : null;
      if (contributionId) {
        const contribution = state.contributions[contributionId];
        requireRights(contribution?.beneficiaryRef === operation.beneficiaryRef && amount <= contribution.amountMinor, 'CONTRIBUTION_UNAVAILABLE');
        economicKey(state, ['contribution-obligation',contributionId]);
      }
      const dueAt = requiredRef(details.dueAt); rightsTime(dueAt);
      economicKey(state, ['obligation',beneficiary!.legalSubjectRef,operation.legalBasisRef,operation.evidenceBundleRef]);
      state.entitlements[id] = { id, beneficiaryRef: operation.beneficiaryRef, obligorRef: requiredRef(details.obligorRef), legalBasisRef: operation.legalBasisRef, rightKind: details.rightKind, policyVersion: operation.policyVersion, currency: 'XTS', amountMinor: amount, paidMinor: 0, dueAt, legalState: 'legally_committed', contributionRequired: details.contributionRequired, contributionId, disputeIds: [] };
      break;
    }
    case 'RECORD_CLEARED_FUNDING': {
      const id = requiredRef(details.fundingLotId), receipt = requiredRef(details.clearingReceiptRef);
      requireRights(amount > 0 && !state.fundingLots[id], 'FUNDING_EXISTS');
      economicKey(state, ['clearing-receipt',receipt]);
      state.fundingLots[id] = { id, currency: 'XTS', clearedAssetsMinor: amount, unallocatedMinor: amount, allocations: {}, outcomeReserves: {}, clearingReceiptRef: receipt };
      break;
    }
    case 'RESERVE_OUTCOME': {
      const lot = fundingLot(state,operation), outcomeId = requiredRef(details.outcomeId), plan = requiredRef(details.fundingPlanId);
      const key = rightsDigest([outcomeId,plan]);
      requireRights(amount > 0 && !state.outcomeBudgets[key] && lot.unallocatedMinor >= amount, 'OUTCOME_RESERVATION_FAILED');
      lot.unallocatedMinor -= amount; lot.outcomeReserves[key] = amount;
      state.outcomeBudgets[key] = { outcomeId, fundingPlanId: plan, fundingLotId: lot.id, maximumMinor: amount };
      break;
    }
    case 'RESERVE_FUNDING': {
      const item = entitlement(state,operation), lot = fundingLot(state,operation);
      requireRights(amount > 0 && unspent(state,item.id) + amount <= item.amountMinor - item.paidMinor, 'INSUFFICIENT_FUNDING');
      if (item.contributionRequired) {
        const contribution = state.contributions[item.contributionId!]!;
        const key = rightsDigest([contribution.outcomeId,contribution.fundingPlanId]);
        requireRights(state.outcomeBudgets[key]?.fundingLotId === lot.id && (lot.outcomeReserves[key] ?? 0) >= amount, 'INSUFFICIENT_OUTCOME_FUNDING');
        lot.outcomeReserves[key]! -= amount;
      } else { requireRights(lot.unallocatedMinor >= amount, 'INSUFFICIENT_FUNDING'); lot.unallocatedMinor -= amount; }
      const bucket = allocation(lot,item.id);
      if (item.legalState === 'vested') bucket.vestedMinor += amount; else bucket.reservedMinor += amount;
      break;
    }
    case 'VEST': {
      const item = entitlement(state,operation);
      requireRights(item.legalState !== 'vested' && item.disputeIds.length === 0, 'VESTING_BLOCKED');
      requireRights(operation.legalBasisRef === item.legalBasisRef, 'LEGAL_BASIS_MISMATCH');
      if (item.contributionRequired) {
        const contribution = state.contributions[item.contributionId!];
        requireRights(contribution && rightsTime(context.now) >= rightsTime(contribution.objectionEndsAt), 'OBJECTION_WINDOW');
        requireRights(item.amountMinor <= contribution.amountMinor, 'CONTRIBUTION_BUDGET_EXCEEDED');
      }
      requireRights(amount === item.amountMinor, 'AMOUNT_MISMATCH');
      // Existing legal obligations are retained even when unfunded; no fake assets are added.
      item.legalState = 'vested';
      for (const lot of Object.values(state.fundingLots)) { const bucket = lot.allocations[item.id]; if (bucket) { bucket.vestedMinor += bucket.reservedMinor; bucket.reservedMinor = 0; } }
      break;
    }
    case 'PAY_PROTECTED': case 'PAY_EXCEPTIONAL': case 'PAY_EMERGENCY': {
      const item = entitlement(state,operation), lot = fundingLot(state,operation), bucket = allocation(lot,item.id);
      requireRights(item.legalState === 'vested' && item.disputeIds.length === 0, 'PAYMENT_BLOCKED');
      requireRights(operation.policyVersion === item.policyVersion && operation.policyVersion === authorization.termsPolicy.version && operation.legalBasisRef === item.legalBasisRef, 'VESTED_TERMS_CHANGED');
      requireRights(bucket.vestedMinor >= amount && item.amountMinor - item.paidMinor >= amount, 'INSUFFICIENT_FUNDING');
      const id = requiredRef(details.payoutId), destination = state.destinations[operation.recipientBindingRef!]!;
      requireRights(!state.payments[id], 'PAYMENT_EXISTS');
      economicKey(state, ['payment',item.id,operation.evidenceBundleRef,operation.purposeCode]);
      // Count both the immutable funding cycle and the current safety window. Policy rotation
      // cannot erase usage already charged to an old entitlement's original funding cycle.
      for (const period of new Set([context.policy.periodId,authorization.termsPolicy.periodId])) {
        const beneficiaryKey = canonicalRightsJson(['beneficiary',beneficiary!.legalSubjectRef,period,operation.currency]);
        const destinationKey = canonicalRightsJson(['destination',destination.cumulativeGroupRef,period,operation.currency]);
        const beneficiaryTotal = safeSum([state.cumulativeAmounts[beneficiaryKey] ?? 0,amount]);
        const destinationTotal = safeSum([state.cumulativeAmounts[destinationKey] ?? 0,amount]);
        requireRights(beneficiaryTotal <= Math.min(context.policy.beneficiaryPeriodLimitMinor,authorization.termsPolicy.beneficiaryPeriodLimitMinor) && destinationTotal <= Math.min(context.policy.destinationPeriodLimitMinor,authorization.termsPolicy.destinationPeriodLimitMinor), 'CUMULATIVE_LIMIT');
        state.cumulativeAmounts[beneficiaryKey] = beneficiaryTotal; state.cumulativeAmounts[destinationKey] = destinationTotal;
      }
      bucket.vestedMinor -= amount; bucket.submittedMinor += amount;
      state.payments[id] = { id, operationId: operation.operationId, beneficiaryRef: operation.beneficiaryRef, entitlementId: item.id, fundingLotId: lot.id, recipientBindingRef: destination.ref, recipientBindingVersion: destination.version, recipientDestinationDigest: destination.destinationDigest, amountMinor: amount, currency: 'XTS', status: 'submitted', providerOperationRef: null, receiptRefs: [], refundedMinor: 0, submissionCount: 1 };
      state.outbox.push({ id: operation.operationId, kind: 'synthetic-payment', payoutId: id, status: 'pending' });
      break;
    }
    case 'PAYMENT_RESULT': {
      const payout = state.payments[requiredRef(details.payoutId)];
      requireRights(payout && payout.beneficiaryRef === operation.beneficiaryRef && amount === payout.amountMinor, 'PAYMENT_UNAVAILABLE');
      const status = details.paymentStatus, receipt = requiredRef(details.receiptRef), providerRef = requiredRef(details.providerOperationRef);
      requireRights(['accepted','processing','unknown','settled','failed'].includes(status ?? ''), 'PAYMENT_STATUS_INVALID');
      requireRights(!['settled','failed','returned'].includes(payout.status), 'PAYMENT_FINAL');
      requireRights(!payout.providerOperationRef || payout.providerOperationRef === providerRef, 'PROVIDER_OPERATION_CHANGED');
      requireRights(!payout.receiptRefs.includes(receipt), 'RECEIPT_REPLAY');
      if (payout.status === 'processing') requireRights(status !== 'accepted', 'STALE_RECEIPT');
      if (payout.status === 'unknown') requireRights(status === 'settled' || status === 'failed' || status === 'unknown', 'RECONCILIATION_REQUIRED');
      payout.providerOperationRef = providerRef; payout.receiptRefs.push(receipt);
      const lot = state.fundingLots[payout.fundingLotId]!, bucket = allocation(lot,payout.entitlementId), item = state.entitlements[payout.entitlementId]!;
      if (status === 'settled') { bucket.submittedMinor -= amount; lot.clearedAssetsMinor -= amount; item.paidMinor += amount; }
      if (status === 'failed') { bucket.submittedMinor -= amount; bucket.vestedMinor += amount; }
      payout.status = status as 'accepted' | 'processing' | 'unknown' | 'settled' | 'failed';
      const outbox = state.outbox.find(item => item.payoutId === payout.id)!; outbox.status = 'delivered';
      break;
    }
    case 'REFUND': {
      const payout = state.payments[requiredRef(details.payoutId)];
      requireRights(payout && ['settled','returned'].includes(payout.status), 'PAYMENT_NOT_SETTLED');
      const item = state.entitlements[payout.entitlementId]!, lot = state.fundingLots[payout.fundingLotId]!;
      requireRights(item.beneficiaryRef === operation.beneficiaryRef && amount > 0 && payout.refundedMinor + amount <= payout.amountMinor, 'INVALID_REFUND');
      requireRights(operation.recipientBindingRef === payout.recipientBindingRef && operation.recipientBindingVersion === payout.recipientBindingVersion && operation.recipientDestinationDigest === payout.recipientDestinationDigest, 'REFUND_DESTINATION_CHANGED');
      economicKey(state, ['refund',payout.id,requiredRef(details.receiptRef)]);
      payout.refundedMinor += amount; payout.status = 'returned';
      item.paidMinor -= amount; lot.clearedAssetsMinor += amount; allocation(lot,item.id).vestedMinor += amount;
      break;
    }
    case 'PAUSE': {
      const item = entitlement(state,operation), id = requiredRef(details.disputeId);
      // A repeat cannot reset or erase a case, nor affect an unrelated entitlement.
      requireRights(!item.disputeIds.includes(id), 'DISPUTE_ALREADY_OPEN'); item.disputeIds.push(id); break;
    }
    case 'RESUME': {
      const item = entitlement(state,operation), id = requiredRef(details.disputeId);
      requireRights(item.disputeIds.includes(id) && !!details.resolutionRef && context.legalEvidenceRefs.includes(details.resolutionRef), 'DISPUTE_UNRESOLVED');
      item.disputeIds = item.disputeIds.filter(ref => ref !== id); break;
    }
    case 'ROTATE_GUARDIAN_KEY': case 'RECOVER_GUARDIAN_KEY': {
      noticeWait(operation,context,'recovery',context.policy.recoveryWaitMs);
      const newKeyId = requiredRef(details.newControllerRef);
      const newKey = context.credentials.find(key => key.keyId === newKeyId);
      requireRights(newKey && newKey.role === 'G' && newKey.actorRef === beneficiary!.guardianActorRef && !newKey.revoked && !newKey.isAgent && rightsTime(context.now) >= rightsTime(newKey.validAfter) && rightsTime(context.now) < rightsTime(newKey.expiresAt), 'RECOVERY_KEY_INVALID');
      requireRights(newKeyId !== beneficiary!.guardianKeyId, 'RECOVERY_NO_CHANGE');
      beneficiary!.guardianKeyId = newKeyId; beneficiary!.authorizationEpoch += 1; break;
    }
    case 'CHANGE_GUARDIAN': {
      requireRights(!!details.legalDecisionRef, 'GUARDIAN_LEGAL_BASIS_REQUIRED');
      const key = context.credentials.find(item => item.keyId === details.newControllerRef);
      requireRights(key && key.role === 'G' && !key.revoked && !key.isAgent && rightsTime(context.now) >= rightsTime(key.validAfter) && rightsTime(context.now) < rightsTime(key.expiresAt) && key.actorRef === details.guardianActorRef, 'GUARDIAN_KEY_INVALID');
      beneficiary!.guardianActorRef = key.actorRef; beneficiary!.guardianKeyId = key.keyId; beneficiary!.authorizationEpoch += 1; break;
    }
    case 'CAPACITY_TRANSFER': {
      requireRights(!!details.capacityEvidenceRef && context.legalEvidenceRefs.includes(details.capacityEvidenceRef), 'CAPACITY_UNVERIFIED');
      const key = context.credentials.find(item => item.keyId === details.newControllerRef);
      requireRights(key && key.role === 'C' && key.actorRef === beneficiary!.controllerRef && !key.revoked && !key.isAgent && rightsTime(context.now) >= rightsTime(key.validAfter) && rightsTime(context.now) < rightsTime(key.expiresAt), 'CAPACITY_KEY_INVALID');
      requireRights(key.keyId !== authorization.signers.find(signer => signer.role === 'C')?.keyId && key.controlDomainId !== context.credentials.find(signer => signer.keyId === beneficiary!.guardianKeyId)?.controlDomainId, 'INDEPENDENT_NEW_CAPACITY_KEY_REQUIRED');
      beneficiary!.guardianActorRef = 'no-current-guardian'; beneficiary!.guardianKeyId = null; beneficiary!.participantKeyId = key.keyId;
      beneficiary!.authorizationEpoch += 1; break;
    }
    case 'LEGAL_CORRECTION': {
      requireRights(!!details.legalDecisionRef, 'LEGAL_DECISION_REQUIRED');
      const target = state.beneficiaries[requiredRef(details.replacesBeneficiaryRef)];
      requireRights(target?.status === 'active' && target.ref !== operation.beneficiaryRef && operation.entitlementIds.length > 0, 'CORRECTION_TARGET_INVALID');
      const items = operation.entitlementIds.map(id => state.entitlements[id]);
      requireRights(items.every(item => item && item.beneficiaryRef === operation.beneficiaryRef), 'CORRECTION_SCOPE_INVALID');
      requireRights(safeSum(items.map(item => item!.amountMinor)) === amount, 'CORRECTION_AMOUNT_MISMATCH');
      requireRights(!Object.values(state.payments).some(payout => operation.entitlementIds.includes(payout.entitlementId) && ['submitted','accepted','processing','unknown'].includes(payout.status)), 'PAYMENT_RECONCILIATION_REQUIRED');
      for (const item of items) item!.beneficiaryRef = target.ref;
      // Keep conservative rolling usage through identity correction: never reopen a spent limit.
      for (const [key, consumed] of Object.entries(state.cumulativeAmounts)) {
        const parts: unknown = JSON.parse(key);
        if (Array.isArray(parts) && parts[0] === 'beneficiary' && parts[1] === beneficiary!.legalSubjectRef) {
          const targetKey = canonicalRightsJson(['beneficiary',target.legalSubjectRef,parts[2],parts[3]]);
          if (targetKey !== key) state.cumulativeAmounts[targetKey] = safeSum([state.cumulativeAmounts[targetKey] ?? 0, consumed]);
        }
      }
      // Preserve entitlement IDs, paid totals, obligations, disputes and all funding allocations.
      beneficiary!.authorizationEpoch += 1; target.authorizationEpoch += 1;
      if (!Object.values(state.entitlements).some(item => item.beneficiaryRef === beneficiary!.ref)) beneficiary!.status = 'superseded';
      break;
    }
    case 'GRANT_DELEGATION': {
      const grant = details.delegation;
      requireRights(grant && Object.keys(grant).length === 21 && Object.keys(grant).every(key => ['id','parentId','issuerActorRef','delegateActorRef','beneficiaryRef','epoch','operationTypes','entitlementIds','destinationRefs','purposeCodes','currency','validAfter','expiresAt','perCallLimitMinor','cumulativeLimitMinor','maximumCalls','consumedMinor','consumedCalls','revoked','allowRedelegation','approvalDigest'].includes(key)), 'INVALID_DELEGATION');
      requiredRef(grant.id); requiredRef(grant.issuerActorRef); requiredRef(grant.delegateActorRef);
      requireRights(!state.delegations[grant.id] && grant.beneficiaryRef === beneficiary!.ref && grant.epoch === beneficiary!.authorizationEpoch && grant.currency === 'XTS' && grant.consumedMinor === 0 && grant.consumedCalls === 0 && grant.revoked === false && grant.approvalDigest === '', 'INVALID_DELEGATION');
      [grant.perCallLimitMinor,grant.cumulativeLimitMinor,grant.maximumCalls].forEach(value => rightsInteger(value));
      requireRights(grant.maximumCalls > 0 && grant.perCallLimitMinor > 0 && grant.cumulativeLimitMinor >= grant.perCallLimitMinor && grant.perCallLimitMinor <= context.policy.perPaymentLimitMinor && grant.cumulativeLimitMinor <= context.policy.beneficiaryPeriodLimitMinor, 'DELEGATION_LIMIT');
      requireRights(rightsTime(grant.validAfter) >= rightsTime(context.now) && rightsTime(grant.expiresAt) > rightsTime(grant.validAfter) && rightsTime(grant.expiresAt) - rightsTime(grant.validAfter) <= 30 * 86_400_000, 'DELEGATION_EXPIRED');
      requireRights(grant.operationTypes.length > 0 && grant.operationTypes.every(type => type === 'PAY_PROTECTED') && grant.entitlementIds.length > 0 && grant.entitlementIds.every(id => state.entitlements[id]?.beneficiaryRef === beneficiary!.ref) && grant.destinationRefs.length > 0 && grant.destinationRefs.every(id => state.destinations[id]?.beneficiaryRef === beneficiary!.ref && state.destinations[id]!.protected && state.destinations[id]!.active) && grant.purposeCodes.length > 0 && grant.purposeCodes.every(code => context.policy.allowedPurposes.includes(code)), 'DELEGATION_SCOPE');
      requireRights(context.credentials.some(key => key.actorRef === grant.delegateActorRef && !key.isAgent && !key.revoked && rightsTime(context.now) >= rightsTime(key.validAfter) && rightsTime(context.now) < rightsTime(key.expiresAt)), 'DELEGATE_UNAVAILABLE');
      if (grant.parentId) {
        const parent = state.delegations[grant.parentId];
        requireRights(parent && !parent.revoked && parent.epoch === beneficiary!.authorizationEpoch, 'DELEGATION_REVOKED');
        assertDelegationNarrower(grant,parent);
      } else requireRights(grant.issuerActorRef === beneficiary!.guardianActorRef, 'DELEGATION_ISSUER_MISMATCH');
      state.delegations[grant.id] = { ...structuredClone(grant), approvalDigest: authorization.digest };
      break;
    }
    case 'REVOKE_DELEGATION': {
      const delegation = state.delegations[requiredRef(details.revokeDelegationId)];
      requireRights(delegation && delegation.beneficiaryRef === operation.beneficiaryRef, 'DELEGATION_UNAVAILABLE');
      delegation.revoked = true;
      break;
    }
    case 'POLICY_CHANGE': {
      noticeWait(operation,context,'policy',context.policy.policyNoticeMs);
      requiredRef(details.nextPolicyVersion);
      requireRights(!!details.policyEffectiveAfter && rightsTime(details.policyEffectiveAfter) > rightsTime(context.now), 'POLICY_NOT_PROSPECTIVE');
      // This records the approved proposal only. Server governance registry publication is separate.
      // No current entitlement, budget, destination, role or threshold is modified.
      break;
    }
    default: throw new ChildRightsError('OPERATION_UNSUPPORTED');
  }
  for (const item of authorization.delegationChain) { const delegation = state.delegations[item.id]!; delegation.consumedCalls += 1; delegation.consumedMinor += amount; }
  state.approvalRecords[operation.operationId] = { operation: structuredClone(operation), approvals: structuredClone(approvals), approvalDigest: authorization.digest };
  state.consumedNonces.push(operation.nonce); state.executedOperations[operation.operationId] = authorization.digest;
  assertRightsInvariants(state);
  state.audit.push({ operationId: operation.operationId, type: operation.operationType, digest: authorization.digest, previousDigest: rightsDigest(input), stateDigest: rightsDigest(state), at: context.now, result: 'synthetic-applied' });
  return state;
}
