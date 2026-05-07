pub mod anchor_drop_root;
pub mod anchor_impact_certificate;
pub mod anchor_round_root;
pub mod claim_merkle_drop;
pub mod revoke_anchor;

pub use anchor_drop_root::*;
pub use anchor_impact_certificate::*;
pub use anchor_round_root::*;
pub use claim_merkle_drop::*;
pub use revoke_anchor::*;

use anchor_lang::prelude::*;

use crate::errors::DropinAnchorError;

pub fn require_nonzero_hash(value: &[u8; 32]) -> Result<()> {
    require!(*value != [0_u8; 32], DropinAnchorError::InvalidRoot);
    Ok(())
}
