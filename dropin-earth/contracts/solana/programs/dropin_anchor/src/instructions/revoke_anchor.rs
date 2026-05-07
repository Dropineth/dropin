use anchor_lang::prelude::*;

use crate::errors::DropinAnchorError;
use crate::state::{ImpactCertificateAnchor, RoundRootAnchor};

#[derive(Accounts)]
pub struct RevokeRoundAnchor<'info> {
    pub issuer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"round", round_anchor.round_id_hash.as_ref()],
        bump,
        constraint = round_anchor.issuer == issuer.key() @ DropinAnchorError::UnauthorizedIssuer
    )]
    pub round_anchor: Account<'info, RoundRootAnchor>,
}

#[derive(Accounts)]
pub struct RevokeImpactCertificateAnchor<'info> {
    pub issuer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"impact", impact_anchor.certificate_id_hash.as_ref()],
        bump,
        constraint = impact_anchor.issuer == issuer.key() @ DropinAnchorError::UnauthorizedIssuer
    )]
    pub impact_anchor: Account<'info, ImpactCertificateAnchor>,
}

pub fn revoke_round(ctx: Context<RevokeRoundAnchor>) -> Result<()> {
    let round_anchor = &mut ctx.accounts.round_anchor;
    require!(!round_anchor.revoked, DropinAnchorError::AlreadyRevoked);
    round_anchor.revoked = true;
    Ok(())
}

pub fn revoke_impact_certificate(ctx: Context<RevokeImpactCertificateAnchor>) -> Result<()> {
    let impact_anchor = &mut ctx.accounts.impact_anchor;
    require!(!impact_anchor.revoked, DropinAnchorError::AlreadyRevoked);
    impact_anchor.revoked = true;
    Ok(())
}
