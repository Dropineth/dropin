use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RoundRootAnchor {
    pub round_id_hash: [u8; 32],
    pub entry_merkle_root: [u8; 32],
    pub randomness_certificate_hash: [u8; 32],
    pub winner_merkle_root: [u8; 32],
    pub drop_merkle_root: [u8; 32],
    pub issuer: Pubkey,
    pub created_at: i64,
    pub revoked: bool,
}

#[account]
#[derive(InitSpace)]
pub struct ImpactCertificateAnchor {
    pub certificate_id_hash: [u8; 32],
    pub project_id_hash: [u8; 32],
    pub evidence_root: [u8; 32],
    pub certificate_hash: [u8; 32],
    pub methodology_hash: [u8; 32],
    pub issuer: Pubkey,
    pub created_at: i64,
    pub revoked: bool,
}

#[account]
#[derive(InitSpace)]
pub struct MerkleDropClaim {
    pub round_id_hash: [u8; 32],
    pub claimant: Pubkey,
    pub claim_hash: [u8; 32],
    pub claimed_at: i64,
}
