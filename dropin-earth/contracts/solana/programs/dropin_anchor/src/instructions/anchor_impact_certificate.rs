use anchor_lang::prelude::*;

use crate::errors::DropinAnchorError;
use crate::state::ImpactCertificateAnchor;

use super::require_nonzero_hash;

#[derive(Accounts)]
#[instruction(certificate_id_hash: [u8; 32])]
pub struct AnchorImpactCertificate<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = issuer,
        space = 8 + ImpactCertificateAnchor::INIT_SPACE,
        seeds = [b"impact", certificate_id_hash.as_ref()],
        bump
    )]
    pub impact_anchor: Account<'info, ImpactCertificateAnchor>,
    pub system_program: Program<'info, System>,
}

pub fn anchor_impact_certificate_handler(
    ctx: Context<AnchorImpactCertificate>,
    certificate_id_hash: [u8; 32],
    project_id_hash: [u8; 32],
    evidence_root: [u8; 32],
    certificate_hash: [u8; 32],
    methodology_hash: [u8; 32],
) -> Result<()> {
    require_nonzero_hash(&certificate_id_hash)?;
    require_nonzero_hash(&project_id_hash)?;
    require_nonzero_hash(&evidence_root)?;
    require_nonzero_hash(&certificate_hash)?;
    require_nonzero_hash(&methodology_hash)?;

    let impact_anchor = &mut ctx.accounts.impact_anchor;
    require!(impact_anchor.created_at == 0, DropinAnchorError::AlreadyAnchored);

    impact_anchor.certificate_id_hash = certificate_id_hash;
    impact_anchor.project_id_hash = project_id_hash;
    impact_anchor.evidence_root = evidence_root;
    impact_anchor.certificate_hash = certificate_hash;
    impact_anchor.methodology_hash = methodology_hash;
    impact_anchor.issuer = ctx.accounts.issuer.key();
    impact_anchor.created_at = Clock::get()?.unix_timestamp;
    impact_anchor.revoked = false;

    Ok(())
}
