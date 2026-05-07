use anchor_lang::prelude::*;

use crate::errors::DropinAnchorError;
use crate::state::RoundRootAnchor;

use super::require_nonzero_hash;

#[derive(Accounts)]
#[instruction(round_id_hash: [u8; 32])]
pub struct AnchorRoundRoot<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = issuer,
        space = 8 + RoundRootAnchor::INIT_SPACE,
        seeds = [b"round", round_id_hash.as_ref()],
        bump
    )]
    pub round_anchor: Account<'info, RoundRootAnchor>,
    pub system_program: Program<'info, System>,
}

pub fn anchor_round_root_handler(
    ctx: Context<AnchorRoundRoot>,
    round_id_hash: [u8; 32],
    entry_merkle_root: [u8; 32],
    randomness_certificate_hash: [u8; 32],
    winner_merkle_root: [u8; 32],
    drop_merkle_root: [u8; 32],
) -> Result<()> {
    require_nonzero_hash(&round_id_hash)?;
    require_nonzero_hash(&entry_merkle_root)?;
    require_nonzero_hash(&randomness_certificate_hash)?;
    require_nonzero_hash(&winner_merkle_root)?;
    require_nonzero_hash(&drop_merkle_root)?;

    let round_anchor = &mut ctx.accounts.round_anchor;
    require!(round_anchor.created_at == 0, DropinAnchorError::AlreadyAnchored);

    round_anchor.round_id_hash = round_id_hash;
    round_anchor.entry_merkle_root = entry_merkle_root;
    round_anchor.randomness_certificate_hash = randomness_certificate_hash;
    round_anchor.winner_merkle_root = winner_merkle_root;
    round_anchor.drop_merkle_root = drop_merkle_root;
    round_anchor.issuer = ctx.accounts.issuer.key();
    round_anchor.created_at = Clock::get()?.unix_timestamp;
    round_anchor.revoked = false;

    Ok(())
}
