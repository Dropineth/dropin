use anchor_lang::prelude::*;

#[error_code]
pub enum DropinAnchorError {
    #[msg("Proof root has already been anchored.")]
    AlreadyAnchored,
    #[msg("Proof anchor has already been revoked.")]
    AlreadyRevoked,
    #[msg("Merkle proof does not resolve to the anchored drop root.")]
    InvalidMerkleProof,
    #[msg("Merkle drop has already been claimed by this wallet.")]
    AlreadyClaimed,
    #[msg("Only the original issuer can mutate this anchor.")]
    UnauthorizedIssuer,
    #[msg("Proof root cannot be the zero hash.")]
    InvalidRoot,
}
