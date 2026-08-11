# CanopyProof Agent Framework

Status: implemented compatibility slice

Dropin is the human + AI coordination layer. CanopyProof agents are the Earth
impact application layer. They do not replace human authority; they produce
auditable AHIN events for evidence, verification, ESG, funding, risk, and
community workflows.

CanopyProof memory is the Dropin OS read-model layer for agent and human
coordination history. Agents may append memory records when authorized, but
memory recall is not proof issuance, not governance approval, and not a final
environmental claim.

## Required Agents

- Evidence Agent
- Verification Agent
- ESG Agent
- Funding Agent
- Risk Agent
- Community Agent

## AHIN Event Actions

```text
ASSERT
REASON
DELEGATE
FULFILL
CHALLENGE
```

Every agent event has:

- agent ID
- accountable actor ID
- AHIN action
- subject type and subject ID
- payload hash
- source root
- confidence score
- rationale
- audit event

## API Surface

```text
GET  /canopyproof/agents/status
GET  /canopyproof/agents
GET  /canopyproof/agents/:agentId
GET  /canopyproof/agents/events
POST /canopyproof/agents/events
GET  /canopyproof/memory/status
POST /canopyproof/memory/records
GET  /canopyproof/memory/records
POST /canopyproof/memory/recall
```

Read routes require CanopyProof RBAC except the public status route. Event writes
accept `owner`, `admin`, `verifier`, `researcher`, `community`, and `agent`.

When the verified request principal role is `agent`, its signed subject must
equal the submitted `agentId`; one agent cannot submit events as another agent.

## Safety Boundaries

- Agents are never final authority.
- Proof-record fulfillment remains human-review bounded.
- AI cannot issue certified carbon credits.
- AI cannot create tax offsets or guaranteed-yield claims.
- Every mutation appends a hash-linked audit event.
- Memory recall is a read model with `finalAuthority=false`.

## Database Contract

The target PostgreSQL contract includes:

```text
identity.agent_profiles
audit.agent_events
audit.memory_records
```

These tables bind agent identity, capabilities, allowed AHIN actions, and event
lineage without duplicating Dropin's broader identity or trust systems. Memory
records bind source IDs, payload hashes, retention class, scope, and event roots
for institutional recall without creating a new authority path.
