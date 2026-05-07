# Solana Anchor Proof Layer

Phase 5 anchors Dropin proof roots on Solana.

```text
Off-chain deterministic computation
→ certificate hash / Merkle roots
→ Solana PDA anchor
→ public verification
→ revoke if challenged or invalid
```

## Toolchain

Install Solana and Anchor:

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.31.1
avm use 0.31.1
```

Verify:

```bash
solana --version
anchor --version
```

## Localnet

```bash
cd /Users/lee/Dropin/dropin-earth
npm install
npm run anchor:build
npm run anchor:test
```

Equivalent direct command for this local Solana 1.18 toolchain:

```bash
cd /Users/lee/Dropin/dropin-earth/contracts/solana
rm -rf test-ledger
COPYFILE_DISABLE=1 anchor build --no-idl
mkdir -p target/idl target/types
cp idl/dropin_anchor.json target/idl/dropin_anchor.json
cp idl/dropin_anchor.ts target/types/dropin_anchor.ts
COPYFILE_DISABLE=1 anchor test --skip-build --no-idl
```

The `COPYFILE_DISABLE=1` flag avoids macOS AppleDouble files corrupting the local validator
genesis archive. The `--no-idl` flow avoids an Anchor 0.31 IDL-build incompatibility with
Solana 1.18 / Rust 1.75 SBF tooling. A locked `contracts/solana/Cargo.lock` is committed with
lockfile version 3 for the same reason.

If you upgrade to Solana 2.x and a matching Anchor toolchain, raw `anchor test` can be restored
after verifying IDL generation.

If the generated program keypair does not match `declare_id!`, run:

```bash
anchor keys sync
```

## Devnet E2E Skeleton

Required environment:

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export DROPIN_SOLANA_PROGRAM_ID=<deployed-program-id>
export DROPIN_SOLANA_ISSUER_KEYPAIR_PATH=/absolute/path/to/issuer-keypair.json
export DROPIN_API_URL=http://localhost:8787
export DROPIN_ROUND_ID=round_v1_ggw_demo
export DROPIN_CERTIFICATE_ID=cert_v1_ggw_demo
```

Run:

```bash
npm run anchor:devnet:e2e
```

The current script prepares payloads and intentionally stops before submitting a transaction.
That keeps issuer key management explicit.

## PDA Seeds

```text
round_anchor:  ["round", round_id_hash]
impact_anchor: ["impact", certificate_id_hash]
claim:         ["claim", round_id_hash, claimant]
```

## State

```text
RoundRootAnchor
- round_id_hash
- entry_merkle_root
- randomness_certificate_hash
- winner_merkle_root
- drop_merkle_root
- issuer
- created_at
- revoked

ImpactCertificateAnchor
- certificate_id_hash
- project_id_hash
- evidence_root
- certificate_hash
- methodology_hash
- issuer
- created_at
- revoked

MerkleDropClaim
- round_id_hash
- claimant
- claim_hash
- claimed_at
```

## Security Boundary

```text
No complex lottery logic on-chain.
No carbon credit claims on-chain.
No RWA yield logic on-chain.
No carbon tax logic on-chain.
Issuer authority must be explicit.
Revoke requires the original issuer.
```
