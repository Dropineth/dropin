use anchor_lang::prelude::*;

use crate::errors::DropinAnchorError;
use crate::state::RoundRootAnchor;

use super::require_nonzero_hash;

#[derive(Accounts)]
pub struct AnchorDropRoot<'info> {
    pub issuer: Signer<'info>,
    #[account(
        seeds = [b"round", round_anchor.round_id_hash.as_ref()],
        bump,
        constraint = round_anchor.issuer == issuer.key() @ DropinAnchorError::UnauthorizedIssuer
    )]
    pub round_anchor: Account<'info, RoundRootAnchor>,
}

pub fn anchor_drop_root_handler(ctx: Context<AnchorDropRoot>, drop_merkle_root: [u8; 32]) -> Result<()> {
    require_nonzero_hash(&drop_merkle_root)?;
    require!(!ctx.accounts.round_anchor.revoked, DropinAnchorError::AlreadyRevoked);
    require!(
        ctx.accounts.round_anchor.drop_merkle_root == drop_merkle_root,
        DropinAnchorError::InvalidRoot
    );
    Ok(())
}
