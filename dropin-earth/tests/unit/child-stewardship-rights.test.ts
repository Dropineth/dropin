import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { applyRightsOperation, assertRightsInvariants, rightsReconciliation } from '../../services/api/src/domain/child-stewardship/rights.js';
import { assertDelegationNarrower, canonicalRightsJson, ChildRightsError, rightsDigest, rightsOperationBytes } from '../../services/api/src/domain/child-stewardship/authorization.js';
import type { RightsApproval, RightsDelegation, RightsOperation, RightsState } from '../../services/api/src/domain/child-stewardship/rights-types.js';
import { createSyntheticRightsFixture as fixture, now, before, after } from '../fixtures/child-stewardship-rights.js';

function rejectsUnchanged(input: RightsState, fn: () => unknown, code?: string) {
  const beforeState = canonicalRightsJson(input);
  assert.throws(fn,(error: unknown) => error instanceof ChildRightsError && (!code || error.code === code));
  assert.equal(canonicalRightsJson(input),beforeState);
}

test('canonical signed JSON is stable and rejects floating-point and unknown authorization inputs',()=>{
  assert.equal(canonicalRightsJson({z:2,a:[1,'x']}),' {"a":[1,"x"],"z":2}'.trim());
  assert.throws(()=>canonicalRightsJson({amount:0.1}),ChildRightsError);
  assert.throws(()=>canonicalRightsJson({amount:-0}),ChildRightsError);
  const f=fixture(), state=f.funded(), op=f.payment();
  rejectsUnchanged(state,()=>applyRightsOperation(state,op,[{...f.approvals(op,['g'])[0]!,verified:true} as RightsApproval],f.context),'INVALID_APPROVAL');
});

test('EX-33 actual Ed25519 signatures approve only the precise synthetic operation',()=>{
  const f=fixture(),state=f.funded(),op=f.payment();
  const result=f.apply(state,op,['g','r1','t']);
  assert.equal(result.payments['payout-a']!.status,'submitted');
  assert.equal(result.outbox.length,1); assert.equal(result.audit.length,state.audit.length+1);
  assert.equal(state.payments['payout-a'],undefined);
  const approvals=f.approvals(op,['g','r1','t']);
  const bad=structuredClone(approvals); bad[0]!.signatureBase64=Buffer.alloc(64).toString('base64');
  rejectsUnchanged(state,()=>applyRightsOperation(state,op,bad,f.context),'INVALID_SIGNATURE');
  const altered={...op,amountMinor:41};
  rejectsUnchanged(state,()=>applyRightsOperation(state,altered,approvals,f.context),'INVALID_SIGNATURE');
});

test('EX-33 valid untouched signature from another environment or service is rejected',()=>{
  const f=fixture(),state=f.funded();
  const foreign=f.payment(40,{domainSeparator:'other-service'});
  rejectsUnchanged(state,()=>f.apply(state,foreign,['g','r1','t']),'DOMAIN_MISMATCH');
  const real={...f.payment(),environment:'PRODUCTION'} as unknown as RightsOperation;
  rejectsUnchanged(state,()=>f.apply(state,real,['g','r1','t']),'REAL_VALUE_DISABLED');
});

test('RT-02 every signed semantic field modification invalidates all old approvals',()=>{
  const f=fixture(),state=f.funded(),op=f.payment(),signed=f.approvals(op,['g','r1','t']);
  const mutations: Partial<RightsOperation>[]=[{amountMinor:41},{feesMinor:1},{currency:'USD' as 'XTS'},{beneficiaryRef:'beneficiary-b'},{purposeCode:'OTHER'},{recipientBindingVersion:2},{recipientDestinationDigest:'b'.repeat(64)},{policyVersion:'policy-v2'},{expiresAt:'2028-01-01T00:00:00Z'},{evidenceBundleRef:'changed-evidence'},{fundingLotIds:['funding-b']},{entitlementIds:['entitlement-b']}];
  for(const mutation of mutations) rejectsUnchanged(state,()=>applyRightsOperation(state,{...op,...mutation},signed,f.context));
});

test('EX-06 V2 actual approving subset must include independent external V3',()=>{
  const f=fixture(); let state=f.apply(f.state,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'clearing-a'}}),['r1','t']);
  state=f.apply(state,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-a'],details:{outcomeId:'outcome-a',fundingPlanId:'plan-a'}}),['r1','t']);
  const op=f.operation('CONFIRM_CONTRIBUTION',{amountMinor:50,details:{contributionId:'contribution-a',outcomeId:'outcome-a',fundingPlanId:'plan-a',participantCanonicalRef:'canonical-a',attributionNumerator:1,attributionDenominator:2,outcomeBudgetMinor:100}});
  rejectsUnchanged(state,()=>f.apply(state,op,['v1','v2']),'EXTERNAL_APPROVAL_REQUIRED');
  for(const ids of [['v1','v3'],['v2','v3']]) assert.equal(f.apply(state,op,ids).contributions['contribution-a']!.amountMinor,50);
});

test('RT-01 missing role, duplicate key/domain/actor, AI and revoked or conflicted credentials never count',()=>{
  for(const mutation of ['missing','duplicate','domain','actor','agent','revoked','conflict','expired','independence']) {
    const f=fixture(),state=f.funded(),op=f.payment();
    let ids=['g','r1','t'];
    if(mutation==='missing') ids=['g','t'];
    if(mutation==='duplicate') ids=['g','g','r1','t'];
    const r=f.context.credentials.find(key=>key.keyId==='r1')!;
    if(mutation==='domain') r.controlDomainId='domain-g';
    if(mutation==='actor') r.actorRef='actor-g';
    if(mutation==='agent') r.isAgent=true;
    if(mutation==='revoked') r.revoked=true;
    if(mutation==='conflict') r.conflictBeneficiaryRefs=['beneficiary-a'];
    if(mutation==='expired') r.expiresAt=before;
    if(mutation==='independence') r.independenceVerifiedUntil=before;
    rejectsUnchanged(state,()=>f.apply(state,op,ids));
  }
});

test('EX-07 current registry/control/conflict versions invalidate collected approvals',()=>{
  for(const field of ['signerRegistryVersion','controlDomainRegistryVersion','conflictCheckVersion'] as const) {
    const f=fixture(),state=f.funded(),op=f.payment(),signed=f.approvals(op,['g','r1','t']);
    f.context[field]='changed';
    rejectsUnchanged(state,()=>applyRightsOperation(state,op,signed,f.context),'REGISTRY_CHANGED');
  }
});

test('EX-10 current destination contents cannot change behind an approved reference',()=>{
  const f=fixture(),state=f.funded(),op=f.payment();
  state.destinations['destination-a']!.destinationDigest='b'.repeat(64);
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'DESTINATION_CHANGED');
});

test('RT-11 old backups stay closed until revocation and execution checkpoints reconcile',()=>{
  const f=fixture(),state=f.funded(),op=f.payment();
  f.context.restorationVerified=false;
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'RESTORATION_UNVERIFIED');
  f.context.restorationVerified=true;f.context.minimumEpochs['beneficiary-a']=1;
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'AUTHORIZATION_EPOCH_CHANGED');
  f.context.minimumEpochs={};f.context.executedOperationCheckpoint=[op.operationId];
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'OPERATION_REPLAY');
});

test('nonce and operation replay have no additional journal or outbox effect',()=>{
  const f=fixture(),state=f.funded(),op=f.payment(),result=f.apply(state,op,['g','r1','t']);
  rejectsUnchanged(result,()=>f.apply(result,op,['g','r1','t']),'OPERATION_REPLAY');
  const fresh={...op,operationId:'new-operation'};
  rejectsUnchanged(result,()=>f.apply(result,fresh,['g','r1','t']),'OPERATION_REPLAY');
});

test('EX-12 unknown payment retains reserves; changed request id cannot blindly repay',()=>{
  const f=fixture(),op=f.payment();let state=f.apply(f.funded(),op,['g','r1','t']);
  state=f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'unknown',providerOperationRef:'provider-a',receiptRef:'receipt-unknown'}}),['t']);
  assert.equal(rightsReconciliation(state).submittedMinor,40); assert.equal(state.entitlements['entitlement-a']!.paidMinor,0);
  const replay=f.payment(40,{evidenceBundleRef:op.evidenceBundleRef,details:{payoutId:'changed-id'}});
  rejectsUnchanged(state,()=>f.apply(state,replay,['g','r1','t']),'ECONOMIC_REPLAY');
  assert.equal(state.outbox.length,1);assert.equal(state.payments['payout-a']!.submissionCount,1);
  const confirmation=f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'provider-a',receiptRef:'receipt-final'}});
  state=f.apply(state,confirmation,['t']);
  assert.equal(rightsReconciliation(state).assetsMinor,60);assert.equal(state.entitlements['entitlement-a']!.paidMinor,40);
  rejectsUnchanged(state,()=>f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'processing',providerOperationRef:'provider-a',receiptRef:'receipt-old'}}),['t']),'PAYMENT_FINAL');
});

test('EX-16 unfunded vested legal obligations survive disputes and get funded without disappearing',()=>{
  const f=fixture();let state=f.apply(f.state,f.operation('RECORD_OBLIGATION',{amountMinor:100,entitlementIds:['entitlement-a'],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:after,contributionRequired:false}}),['r1','t']);
  state=f.apply(state,f.operation('VEST',{amountMinor:100,entitlementIds:['entitlement-a']}),['r1','t']);
  assert.equal(rightsReconciliation(state).unfundedMinor,100);
  state=f.apply(state,f.operation('PAUSE',{entitlementIds:['entitlement-a'],details:{disputeId:'dispute-a'}}),['g']);
  assert.equal(rightsReconciliation(state).legalOutstandingMinor,100);
  state=f.apply(state,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'clearing-a'}}),['r1','t']);
  state=f.apply(state,f.operation('RESERVE_FUNDING',{amountMinor:100,entitlementIds:['entitlement-a'],fundingLotIds:['funding-a']}),['r1','t']);
  assert.equal(rightsReconciliation(state).unfundedMinor,0);
  rejectsUnchanged(state,()=>f.apply(state,f.payment(),['g','r1','t']),'PAYMENT_BLOCKED');
  assert.equal(state.entitlements['entitlement-a']!.amountMinor,100);
});

test('EX-11 separate payments and delegations share authoritative cumulative beneficiary limits',()=>{
  const f=fixture();f.context.policy.beneficiaryPeriodLimitMinor=100;
  let state=f.funded(200);
  state=f.apply(state,f.payment(60),['g','r1','t']);
  rejectsUnchanged(state,()=>f.apply(state,f.payment(60,{details:{payoutId:'payout-b'}}),['g','r1','t']),'CUMULATIVE_LIMIT');
  assert.equal(rightsReconciliation(state).submittedMinor,60);
});

test('EX-17 refunds restore the original protected obligation and reject a replacement destination',()=>{
  const f=fixture();let state=f.apply(f.funded(),f.payment(),['g','r1','t']);
  state=f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'provider-a',receiptRef:'settled-a'}}),['t']);
  const refund=f.operation('REFUND',{amountMinor:10,recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:'payout-a',receiptRef:'refund-a'}});
  rejectsUnchanged(state,()=>f.apply(state,{...refund,recipientBindingRef:'guardian-free-account'},['r1','t']),'REFUND_DESTINATION_CHANGED');
  state=f.apply(state,refund,['r1','t']);
  assert.equal(state.entitlements['entitlement-a']!.paidMinor,30);assert.equal(rightsReconciliation(state).assetsMinor,70);assert.equal(rightsReconciliation(state).vestedMinor,70);
});

test('EX-21 policy and request id changes cannot duplicate canonical outcome attribution',()=>{
  const f=fixture();let state=f.apply(f.state,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'clearing-a'}}),['r1','t']);
  state=f.apply(state,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-a'],details:{outcomeId:'outcome-a',fundingPlanId:'plan-a'}}),['r1','t']);
  const op=f.operation('CONFIRM_CONTRIBUTION',{amountMinor:50,details:{contributionId:'contribution-a',outcomeId:'outcome-a',fundingPlanId:'plan-a',participantCanonicalRef:'canonical-a',attributionNumerator:1,attributionDenominator:2,outcomeBudgetMinor:100}});
  state=f.apply(state,op,['v1','v3']);f.context.policy.version='policy-v2';
  const again=f.operation('CONFIRM_CONTRIBUTION',{amountMinor:50,details:{...op.details,contributionId:'contribution-b'}});
  rejectsUnchanged(state,()=>f.apply(state,again,['v1','v3']),'ECONOMIC_REPLAY');
});

test('EX-23 money attribution requires prefunding and keeps exact rounding remainder protected',()=>{
  const f=fixture();const details={contributionId:'contribution-a',outcomeId:'outcome-a',fundingPlanId:'plan-a',participantCanonicalRef:'canonical-a',attributionNumerator:1,attributionDenominator:3,outcomeBudgetMinor:100};
  rejectsUnchanged(f.state,()=>f.apply(f.state,f.operation('CONFIRM_CONTRIBUTION',{amountMinor:33,details}),['v1','v3']),'OUTCOME_NOT_PREFUNDED');
  let state=f.apply(f.state,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'clearing-a'}}),['r1','t']);
  state=f.apply(state,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-a'],details:{outcomeId:'outcome-a',fundingPlanId:'plan-a'}}),['r1','t']);
  state=f.apply(state,f.operation('CONFIRM_CONTRIBUTION',{amountMinor:33,details}),['v1','v3']);
  assert.equal(state.contributions['contribution-a']!.amountMinor,33);assert.equal(rightsReconciliation(state).assetsMinor,100);
  rejectsUnchanged(state,()=>f.apply(state,f.operation('CONFIRM_CONTRIBUTION',{amountMinor:101,details:{...details,contributionId:'bad',attributionNumerator:101,attributionDenominator:100}}),['v1','v3']),'ATTRIBUTION_LIMIT');
});

test('RT-03 delegation ancestors, narrower scopes, current epoch and total usage are enforced',()=>{
  const f=fixture(),state=f.funded();
  const root:RightsDelegation={id:'delegation-a',parentId:null,issuerActorRef:'actor-g',delegateActorRef:'actor-helper',beneficiaryRef:'beneficiary-a',epoch:0,operationTypes:['PAY_PROTECTED'],entitlementIds:['entitlement-a'],destinationRefs:['destination-a'],purposeCodes:['LEARNING_SUPPORT'],currency:'XTS',validAfter:'2026-10-01T00:00:00Z',expiresAt:'2026-10-30T00:00:00Z',perCallLimitMinor:50,cumulativeLimitMinor:50,maximumCalls:2,consumedMinor:0,consumedCalls:0,revoked:false,allowRedelegation:true,approvalDigest:'a'.repeat(64)};
  state.delegations[root.id]=root;
  const child={...root,id:'delegation-b',parentId:root.id,issuerActorRef:root.delegateActorRef,allowRedelegation:false};
  state.delegations[child.id]=child;
  assert.throws(()=>assertDelegationNarrower({...child,perCallLimitMinor:51},root),ChildRightsError);
  const result=f.apply(state,f.payment(40,{delegationId:child.id}),['g','r1','t']);
  assert.equal(result.delegations[root.id]!.consumedMinor,40);assert.equal(result.delegations[child.id]!.consumedMinor,40);
  state.delegations[root.id]!.revoked=true;
  rejectsUnchanged(state,()=>f.apply(state,f.payment(40,{delegationId:child.id}),['g','r1','t']),'DELEGATION_REVOKED');
});

test('RT-09 recovery preserves entitlement and destination but revokes old key and epoch',()=>{
  const f=fixture(),state=f.funded();const oldKey=f.context.credentials.find(key=>key.keyId==='g')!;
  const pair=generateKeyPairSync('ed25519');f.secrets.set('g-new',pair.privateKey);
  f.context.credentials.push({...oldKey,keyId:'g-new',publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString()});
  const op=f.operation('RECOVER_GUARDIAN_KEY',{details:{newControllerRef:'g-new',notificationEvidenceRef:'notice-recovery'}});
  const result=f.apply(state,op,['b','r1','r2']);
  assert.deepEqual(result.entitlements,state.entitlements);assert.deepEqual(result.destinations,state.destinations);
  assert.equal(result.beneficiaries['beneficiary-a']!.authorizationEpoch,1);
  rejectsUnchanged(result,()=>f.apply(result,f.payment(),['g','r1','t']),'AUTHORIZATION_EPOCH_CHANGED');
  rejectsUnchanged(result,()=>f.apply(result,f.payment(40,{authorizationEpoch:1}),['g','r1','t']),'GUARDIAN_KEY_REVOKED');
  assert.equal(f.apply(result,f.payment(40,{authorizationEpoch:1}),['g-new','r1','t']).payments['payout-a']!.status,'submitted');
});

test('waiting periods cannot be bypassed by backdating signed validity or inventing a notice',()=>{
  const f=fixture(),state=f.funded();f.context.notices['notice-payment']!.issuedAt=now;
  const op=f.payment(40,{operationType:'PAY_EXCEPTIONAL',validAfter:before,details:{payoutId:'payout-a',notificationEvidenceRef:'notice-payment'}});
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','r2','t']),'WAIT_PERIOD');
});

test('RT-12 legal correction preserves paid and unpaid totals and never clones an entitlement',()=>{
  const f=fixture();let state=f.apply(f.funded(),f.payment(),['g','r1','t']);
  state=f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'provider-a',receiptRef:'settled-a'}}),['t']);
  state.beneficiaries['beneficiary-b']={...state.beneficiaries['beneficiary-a']!,ref:'beneficiary-b',legalSubjectRef:'canonical-b'};
  const totals=rightsReconciliation(state);
  const op=f.operation('LEGAL_CORRECTION',{entitlementIds:['entitlement-a'],amountMinor:100,details:{replacesBeneficiaryRef:'beneficiary-b',legalDecisionRef:'decision-synthetic'}});
  state=f.apply(state,op,['a','b','r1','r2','t']);
  assert.equal(Object.keys(state.entitlements).length,1);assert.equal(state.entitlements['entitlement-a']!.beneficiaryRef,'beneficiary-b');assert.equal(state.entitlements['entitlement-a']!.paidMinor,40);
  assert.deepEqual(rightsReconciliation(state),totals);
  rejectsUnchanged(state,()=>f.apply(state,op,['a','b','r1','r2','t']),'OPERATION_REPLAY');
});

test('policy governance cannot modify existing vested rights, fees or thresholds',()=>{
  const f=fixture(),state=f.funded();const op=f.operation('POLICY_CHANGE',{details:{nextPolicyVersion:'policy-v2',notificationEvidenceRef:'notice-policy',policyEffectiveAfter:after}});
  rejectsUnchanged(state,()=>f.apply(state,op,['o','x','community','t']),'GOVERNANCE_INDEPENDENCE_REQUIRED');
  const result=f.apply(state,op,['r1','r2','t','community']);
  assert.deepEqual(result.entitlements,state.entitlements);assert.deepEqual(result.fundingLots,state.fundingLots);
});

test('randomized synthetic settle/refund sequences preserve exact assets and liabilities',()=>{
  const f=fixture();let state=f.funded(10_000);let random=17;
  for(let i=0;i<40;i++) {
    random=(random*48271)%2147483647;const amount=1+random%100;const id=`payout-${i}`;
    state=f.apply(state,f.payment(amount,{details:{payoutId:id}}),['g','r1','t']);
    state=f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:amount,details:{payoutId:id,paymentStatus:i%3===0?'failed':'settled',providerOperationRef:`provider-${i}`,receiptRef:`settled-${i}`}}),['t']);
    if(i%3!==0 && i%2===0) state=f.apply(state,f.operation('REFUND',{amountMinor:Math.max(1,Math.floor(amount/2)),recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:id,receiptRef:`refund-${i}`}}),['r1','t']);
    assertRightsInvariants(state);const result=rightsReconciliation(state);assert.equal(result.differenceMinor,0);assert.equal(result.assetsMinor,result.legalOutstandingMinor);
  }
  assert.equal(state.outbox.length,40);assert.equal(Object.values(state.payments).every(item=>item.submissionCount===1),true);
});

test('EDU_POINT and retirement records cannot be substituted for legal cash obligations',()=>{
  const f=fixture();
  for(const kind of ['EDU_POINT','retirement_recognition']) rejectsUnchanged(f.state,()=>f.apply(f.state,f.operation('RECORD_OBLIGATION',{amountMinor:100,entitlementIds:['entitlement-a'],details:{rightKind:kind as 'contractual_grant',obligorRef:'obligor-a',dueAt:after,contributionRequired:false}}),['r1','t']),'RIGHT_KIND_INVALID');
});

test('without a synthetic reviewed legal basis, valid signatures do not establish a right',()=>{
  const f=fixture(),state=f.funded(),op=f.payment();f.context.legalEvidenceRefs=[];
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'LEGAL_BASIS_UNVERIFIED');
});

test('hashes identify canonical exact operation payloads, never replace signature validation',()=>{
  const f=fixture(),state=f.funded(),op=f.payment();
  assert.equal(rightsDigest(op).length,64);
  rejectsUnchanged(state,()=>applyRightsOperation(state,op,[{keyId:'g',algorithm:'SHA256',payloadBase64:Buffer.from(rightsOperationBytes(op)).toString('base64'),signatureBase64:Buffer.from(rightsDigest(op)).toString('base64')}],f.context),'INVALID_SIGNATURE');
});

test('independent review: old notice cannot authorize a different amount, destination, recovery key or future policy',()=>{
  const f=fixture(),state=f.funded();
  const payment=f.payment(40,{operationType:'PAY_EXCEPTIONAL',details:{payoutId:'payout-a',notificationEvidenceRef:'notice-payment'}});
  rejectsUnchanged(state,()=>f.apply(state,{...payment,amountMinor:41},['g','r1','r2','t']),'WAIT_PERIOD');
  state.destinations['destination-b']={...state.destinations['destination-a']!,ref:'destination-b',destinationDigest:'b'.repeat(64)};
  rejectsUnchanged(state,()=>f.apply(state,{...payment,recipientBindingRef:'destination-b',recipientDestinationDigest:'b'.repeat(64)},['g','r1','r2','t']),'WAIT_PERIOD');
  const recovery=f.operation('RECOVER_GUARDIAN_KEY',{details:{newControllerRef:'g-new',notificationEvidenceRef:'notice-recovery'}});
  rejectsUnchanged(state,()=>f.apply(state,{...recovery,details:{...recovery.details,newControllerRef:'attacker-key'}},['b','r1','r2']),'WAIT_PERIOD');
  const policy=f.operation('POLICY_CHANGE',{details:{nextPolicyVersion:'policy-v2',notificationEvidenceRef:'notice-policy',policyEffectiveAfter:after}});
  rejectsUnchanged(state,()=>f.apply(state,{...policy,details:{...policy.details,nextPolicyVersion:'attacker-policy'}},['r1','r2','t','community']),'WAIT_PERIOD');
});

test('independent review: current v2 policy retains v1 vested payout terms and current revocations',()=>{
  const f=fixture(),state=f.funded();
  const original=structuredClone(f.context.policy);
  f.context.entitlementPolicies[original.version]=original;
  f.context.policy={...structuredClone(original),version:'policy-v2'};
  const op=f.payment(40,{policyVersion:'policy-v1'});
  const result=f.apply(state,op,['g','r1','t']);
  assert.equal(result.entitlements['entitlement-a']!.policyVersion,'policy-v1');
  assert.equal(result.entitlements['entitlement-a']!.amountMinor,100);
  assert.equal(result.payments['payout-a']!.amountMinor,40);
  f.context.credentials.find(key=>key.keyId==='g')!.revoked=true;
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'CREDENTIAL_UNAVAILABLE');
});

test('signed bounded delegation creation and ancestor revocation preserve independent payment approval',()=>{
  const f=fixture();let state=f.funded();
  const delegation:RightsDelegation={id:'grant-a',parentId:null,issuerActorRef:'actor-g',delegateActorRef:'actor-x',beneficiaryRef:'beneficiary-a',epoch:0,operationTypes:['PAY_PROTECTED'],entitlementIds:['entitlement-a'],destinationRefs:['destination-a'],purposeCodes:['LEARNING_SUPPORT'],currency:'XTS',validAfter:now,expiresAt:'2026-11-01T00:00:00Z',perCallLimitMinor:50,cumulativeLimitMinor:50,maximumCalls:2,consumedMinor:0,consumedCalls:0,revoked:false,allowRedelegation:false,approvalDigest:''};
  const grant=f.operation('GRANT_DELEGATION',{details:{delegation}});
  rejectsUnchanged(state,()=>f.apply(state,grant,['g']),'ROLE_QUORUM_MISSING');
  state=f.apply(state,grant,['g','r1','t']);
  assert.equal(state.delegations['grant-a']!.approvalDigest,rightsDigest(grant));
  state=f.apply(state,f.operation('REVOKE_DELEGATION',{details:{revokeDelegationId:'grant-a'}}),['c']);
  rejectsUnchanged(state,()=>f.apply(state,f.payment(40,{delegationId:'grant-a'}),['g','r1','t']),'DELEGATION_REVOKED');
  assert.equal(state.outbox.length,0);assert.equal(state.entitlements['entitlement-a']!.amountMinor,100);
});

test('guardian change uses legal evidence and independent B/R2/T without old guardian veto',()=>{
  const f=fixture(),state=f.funded();
  const old=f.context.credentials.find(key=>key.keyId==='g')!,pair=generateKeyPairSync('ed25519');f.secrets.set('g-other',pair.privateKey);
  f.context.credentials.push({...old,keyId:'g-other',actorRef:'actor-g-other',controlDomainId:'domain-g-other',publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString()});
  const op=f.operation('CHANGE_GUARDIAN',{details:{guardianActorRef:'actor-g-other',newControllerRef:'g-other',legalDecisionRef:'decision-synthetic'}});
  const result=f.apply(state,op,['b','r1','r2','t']);
  assert.equal(result.beneficiaries['beneficiary-a']!.guardianActorRef,'actor-g-other');assert.deepEqual(result.entitlements,state.entitlements);
  rejectsUnchanged(result,()=>f.apply(result,f.payment(40,{authorizationEpoch:1}),['g','r1','t']),'GUARDIAN_MISMATCH');
});

test('capacity transfer requires reviewed local evidence and new independent key, preserving obligations',()=>{
  const f=fixture(),state=f.funded();
  const old=f.context.credentials.find(key=>key.keyId==='c')!,pair=generateKeyPairSync('ed25519');f.secrets.set('c-new',pair.privateKey);
  f.context.credentials.push({...old,keyId:'c-new',publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString()});
  const op=f.operation('CAPACITY_TRANSFER',{details:{capacityEvidenceRef:'capacity-synthetic',newControllerRef:'c-new'}});
  const result=f.apply(state,op,['c','b','r1','t']);
  assert.equal(result.beneficiaries['beneficiary-a']!.guardianKeyId,null);assert.equal(result.beneficiaries['beneficiary-a']!.participantKeyId,'c-new');assert.deepEqual(result.entitlements,state.entitlements);
  rejectsUnchanged(result,()=>f.apply(result,f.operation('PAUSE',{authorizationEpoch:1,entitlementIds:['entitlement-a'],details:{disputeId:'dispute-new'}}),['c']),'PARTICIPANT_KEY_REVOKED');
});

test('project-local aliases cannot reset cumulative spending for the same legal subject',()=>{
  const f=fixture();f.context.policy.beneficiaryPeriodLimitMinor=100;
  let state=f.funded(200);
  state=f.apply(state,f.payment(60),['g','r1','t']);
  state.beneficiaries['alias-a']={...state.beneficiaries['beneficiary-a']!,ref:'alias-a'};
  state.destinations['destination-alias']={...state.destinations['destination-a']!,ref:'destination-alias',beneficiaryRef:'alias-a'};
  state=f.apply(state,f.operation('RECORD_OBLIGATION',{beneficiaryRef:'alias-a',amountMinor:100,entitlementIds:['entitlement-alias'],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:after,contributionRequired:false}}),['r1','t']);
  state=f.apply(state,f.operation('VEST',{beneficiaryRef:'alias-a',amountMinor:100,entitlementIds:['entitlement-alias']}),['r1','t']);
  state=f.apply(state,f.operation('RECORD_CLEARED_FUNDING',{beneficiaryRef:'alias-a',amountMinor:100,details:{fundingLotId:'funding-alias',clearingReceiptRef:'clearing-alias'}}),['r1','t']);
  state=f.apply(state,f.operation('RESERVE_FUNDING',{beneficiaryRef:'alias-a',amountMinor:100,entitlementIds:['entitlement-alias'],fundingLotIds:['funding-alias']}),['r1','t']);
  const op=f.payment(60,{beneficiaryRef:'alias-a',entitlementIds:['entitlement-alias'],fundingLotIds:['funding-alias'],recipientBindingRef:'destination-alias',details:{payoutId:'payout-alias'}});
  rejectsUnchanged(state,()=>f.apply(state,op,['g','r1','t']),'CUMULATIVE_LIMIT');
});

test('policy period rotation cannot reset the immutable funding-cycle cumulative cap',()=>{
  const f=fixture();f.context.policy.beneficiaryPeriodLimitMinor=100;
  let state=f.funded(200);state=f.apply(state,f.payment(60),['g','r1','t']);
  const old=structuredClone(f.context.policy);f.context.entitlementPolicies[old.version]=old;
  f.context.policy={...structuredClone(old),version:'policy-v2',periodId:'new-window'};
  rejectsUnchanged(state,()=>f.apply(state,f.payment(60,{policyVersion:'policy-v1',details:{payoutId:'payout-new-window'}}),['g','r1','t']),'CUMULATIVE_LIMIT');
});

test('institution accepted and processing receipts never mark funds finally received',()=>{
  const f=fixture();let state=f.apply(f.funded(),f.payment(),['g','r1','t']);
  for(const status of ['accepted','processing'] as const) {
    state=f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:status,providerOperationRef:'provider-a',receiptRef:`receipt-${status}`}}),['t']);
    assert.equal(state.entitlements['entitlement-a']!.paidMinor,0);assert.equal(rightsReconciliation(state).submittedMinor,40);assert.equal(rightsReconciliation(state).assetsMinor,100);
  }
  rejectsUnchanged(state,()=>f.apply(state,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'accepted',providerOperationRef:'provider-a',receiptRef:'late-accepted'}}),['t']),'STALE_RECEIPT');
});

test('canonical input limits reject cycles and excessive nesting without signature or ledger effects',()=>{
  const cycle: Record<string,unknown>={};cycle['self']=cycle;
  assert.throws(()=>canonicalRightsJson(cycle),ChildRightsError);
  let nested: unknown=0;for(let i=0;i<40;i++) nested=[nested];
  assert.throws(()=>canonicalRightsJson(nested),ChildRightsError);
});
