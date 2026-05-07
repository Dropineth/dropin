use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;

use crate::errors::DropinAnchorError;
use crate::state::{MerkleDropClaim, RoundRootAnchor};

use super::require_nonzero_hash;

#[derive(Accounts)]
#[instruction(round_id_hash: [u8; 32])]
pub struct ClaimMerkleDrop<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(
        seeds = [b"round", round_id_hash.as_ref()],
        bump
    )]
    pub round_anchor: Account<'info, RoundRootAnchor>,
    #[account(
        init_if_needed,
        payer = claimant,
        space = 8 + MerkleDropClaim::INIT_SPACE,
        seeds = [b"claim", round_id_hash.as_ref(), claimant.key().as_ref()],
        bump
    )]
    pub claim: Account<'info, MerkleDropClaim>,
    pub system_program: Program<'info, System>,
}

pub fn claim_merkle_drop_handler(
    ctx: Context<ClaimMerkleDrop>,
    round_id_hash: [u8; 32],
    claim_hash: [u8; 32],
    proof: Vec<[u8; 32]>,
    leaf_index: u32,
) -> Result<()> {
    require_nonzero_hash(&round_id_hash)?;
    require_nonzero_hash(&claim_hash)?;
    require!(!ctx.accounts.round_anchor.revoked, DropinAnchorError::AlreadyRevoked);
    require!(ctx.accounts.claim.claimed_at == 0, DropinAnchorError::AlreadyClaimed);
    require!(
        verify_merkle_proof(
            claim_hash,
            &proof,
            leaf_index,
            ctx.accounts.round_anchor.drop_merkle_root,
        ),
        DropinAnchorError::InvalidMerkleProof
    );

    let claim = &mut ctx.accounts.claim;
    claim.round_id_hash = round_id_hash;
    claim.claimant = ctx.accounts.claimant.key();
    claim.claim_hash = claim_hash;
    claim.claimed_at = Clock::get()?.unix_timestamp;

    Ok(())
}

fn verify_merkle_proof(
    leaf: [u8; 32],
    proof: &[[u8; 32]],
    leaf_index: u32,
    expected_root: [u8; 32],
) -> bool {
    let mut node = leaf;
    let mut index = leaf_index;

    for sibling in proof.iter() {
        node = if index % 2 == 0 {
            hashv(&[node.as_ref(), sibling.as_ref()]).to_bytes()
        } else {
            hashv(&[sibling.as_ref(), node.as_ref()]).to_bytes()
        };
        index /= 2;
    }

    node == expected_root
}
