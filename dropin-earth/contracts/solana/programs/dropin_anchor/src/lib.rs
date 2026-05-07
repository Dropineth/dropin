use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("D27zujuVZsAZdS1SHS2Lpi6573ioTQAvjrpWSXV3k1ks");

#[program]
pub mod dropin_anchor {
    use super::*;

    pub fn anchor_round_root(
        ctx: Context<AnchorRoundRoot>,
        round_id_hash: [u8; 32],
        entry_merkle_root: [u8; 32],
        randomness_certificate_hash: [u8; 32],
        winner_merkle_root: [u8; 32],
        drop_merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::anchor_round_root::anchor_round_root_handler(
            ctx,
            round_id_hash,
            entry_merkle_root,
            randomness_certificate_hash,
            winner_merkle_root,
            drop_merkle_root,
        )
    }

    pub fn anchor_drop_root(ctx: Context<AnchorDropRoot>, drop_merkle_root: [u8; 32]) -> Result<()> {
        instructions::anchor_drop_root::anchor_drop_root_handler(ctx, drop_merkle_root)
    }

    pub fn anchor_impact_certificate(
        ctx: Context<AnchorImpactCertificate>,
        certificate_id_hash: [u8; 32],
        project_id_hash: [u8; 32],
        evidence_root: [u8; 32],
        certificate_hash: [u8; 32],
        methodology_hash: [u8; 32],
    ) -> Result<()> {
        instructions::anchor_impact_certificate::anchor_impact_certificate_handler(
            ctx,
            certificate_id_hash,
            project_id_hash,
            evidence_root,
            certificate_hash,
            methodology_hash,
        )
    }

    pub fn revoke_round_anchor(ctx: Context<RevokeRoundAnchor>) -> Result<()> {
        instructions::revoke_anchor::revoke_round(ctx)
    }

    pub fn revoke_impact_certificate_anchor(ctx: Context<RevokeImpactCertificateAnchor>) -> Result<()> {
        instructions::revoke_anchor::revoke_impact_certificate(ctx)
    }

    pub fn claim_merkle_drop(
        ctx: Context<ClaimMerkleDrop>,
        round_id_hash: [u8; 32],
        claim_hash: [u8; 32],
        proof: Vec<[u8; 32]>,
        leaf_index: u32,
    ) -> Result<()> {
        instructions::claim_merkle_drop::claim_merkle_drop_handler(ctx, round_id_hash, claim_hash, proof, leaf_index)
    }
}
