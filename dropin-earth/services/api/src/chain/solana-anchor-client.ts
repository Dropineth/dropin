export type SolanaAnchorConfig = {
  rpcUrl: string;
  programId: string;
  issuerKeypairPath: string;
};

export type AnchorSubmission =
  | {
      kind: "round_root";
      roundId: string;
      status: "prepared";
      config: Omit<SolanaAnchorConfig, "issuerKeypairPath">;
    }
  | {
      kind: "impact_certificate";
      certificateId: string;
      status: "prepared";
      config: Omit<SolanaAnchorConfig, "issuerKeypairPath">;
    }
  | {
      kind: "merkle_drop_claim";
      roundId: string;
      wallet: string;
      proof: readonly string[];
      status: "prepared";
      config: Omit<SolanaAnchorConfig, "issuerKeypairPath">;
    };

export class SolanaAnchorClient {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  anchorRoundRoot(roundId: string): AnchorSubmission {
    return {
      kind: "round_root",
      roundId,
      status: "prepared",
      config: this.publicConfig(),
    };
  }

  anchorImpactCertificate(certificateId: string): AnchorSubmission {
    return {
      kind: "impact_certificate",
      certificateId,
      status: "prepared",
      config: this.publicConfig(),
    };
  }

  claimDrop(roundId: string, wallet: string, proof: readonly string[]): AnchorSubmission {
    return {
      kind: "merkle_drop_claim",
      roundId,
      wallet,
      proof,
      status: "prepared",
      config: this.publicConfig(),
    };
  }

  requireConfig(): SolanaAnchorConfig {
    const rpcUrl = this.env.SOLANA_RPC_URL;
    const programId = this.env.DROPIN_SOLANA_PROGRAM_ID;
    const issuerKeypairPath = this.env.DROPIN_SOLANA_ISSUER_KEYPAIR_PATH;

    if (!rpcUrl || !programId || !issuerKeypairPath) {
      throw new Error(
        "Solana anchor client requires SOLANA_RPC_URL, DROPIN_SOLANA_PROGRAM_ID, and DROPIN_SOLANA_ISSUER_KEYPAIR_PATH.",
      );
    }

    return {
      rpcUrl,
      programId,
      issuerKeypairPath,
    };
  }

  private publicConfig() {
    const config = this.requireConfig();
    return {
      rpcUrl: config.rpcUrl,
      programId: config.programId,
    };
  }
}

export const solanaAnchorClient = new SolanaAnchorClient();

export function anchorRoundRoot(roundId: string) {
  return solanaAnchorClient.anchorRoundRoot(roundId);
}

export function anchorImpactCertificate(certificateId: string) {
  return solanaAnchorClient.anchorImpactCertificate(certificateId);
}

export function claimDrop(roundId: string, wallet: string, proof: readonly string[]) {
  return solanaAnchorClient.claimDrop(roundId, wallet, proof);
}
