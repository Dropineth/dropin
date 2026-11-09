import {z} from 'zod';
import {ChildApiError,type ChildSnapshot} from './store.js';
import type {LearningState} from './learning-types.js';

// These validate the existing learning ledger, not a credit issuance standard.
// Strict objects prevent additional monetary/certification claims surviving a
// durable read or being smuggled into a future projection of these records.
const text=z.string(),nullable=text.nullable();
const observation=z.object({id:text,assignmentId:text,treeId:text,observerRef:text,enteredBy:text,
 sourceType:z.literal('synthetic-reference'),sampleId:z.enum(['demo-leaf-green','demo-leaf-yellow']),
 answer:z.enum(['green','yellow','uncertain']),capturedAtClaimed:text,receivedAt:text,captureTimeVerified:z.literal(false),
 digest:text,state:z.enum(['pending_review','accepted_for_learning','needs_review']),evidenceLevel:z.literal('E0'),duplicateOf:nullable}).strict();
const review=z.object({id:text,observationId:text,reviewerId:text,methodVersion:text,
 decision:z.enum(['insufficient_for_survival','learning_observation_accepted','needs_more_information']),
 reason:z.enum(['synthetic_source','time_unverified','identity_uncertain','conflicting_observation']),decidedAt:text,supersedesId:nullable}).strict();
const assessment=z.object({id:text,treeId:text,asOf:text,validUntil:text,reviewIds:z.array(text),state:z.literal('unknown'),
 evidenceLevel:z.literal('E0'),limitations:z.tuple([z.literal('synthetic_source'),z.literal('not_field_evidence')])}).strict();
const contribution=z.object({id:text,canonicalKey:text,participantRef:text,canonicalParticipantRef:text,sourceObservationId:text,
 reviewId:text,activityInstance:text,kind:z.literal('careful_observation'),policyVersion:text,acceptedScope:z.literal('learning_only'),
 amount:z.union([z.literal(0),z.literal(1)]),unit:z.literal('EDU_FEEDBACK'),entryType:z.enum(['grant','correction']),correctionOf:nullable,
 reason:z.enum(['reviewed_learning','record_corrected']),attributedAt:text,transferable:z.literal(false),cashValue:z.literal(false)}).strict();
const ledgers=z.object({observations:z.record(text,observation),reviews:z.record(text,review),assessments:z.record(text,assessment),contributions:z.array(contribution)});

export function assertLearningLedgerBoundaries(state:LearningState):void{
 if(!ledgers.safeParse(state).success)throw new ChildApiError('LEARNING_LEDGER_BOUNDARY_INVALID',503);
}
export function assertChildSnapshotLedgerBoundaries(snapshot:ChildSnapshot):void{
 assertLearningLedgerBoundaries(snapshot.learning);
 // Keep accounting/conservation checks in their existing domain/SQL gates.
 // This boundary only checks ledger denomination and entitlement category.
 const rights=snapshot.rights;
 if(rights.mode!=='synthetic-demo'
  ||Object.values(rights.entitlements).some(item=>item.currency!=='XTS'||!['contractual_grant','lawful_service_benefit'].includes(item.rightKind))
  ||Object.values(rights.fundingLots).some(item=>item.currency!=='XTS')
  ||Object.values(rights.payments).some(item=>item.currency!=='XTS'))throw new ChildApiError('RIGHTS_LEDGER_BOUNDARY_INVALID',503);
}
