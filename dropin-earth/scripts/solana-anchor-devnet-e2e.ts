type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

type RoundResults = {
  proof?: {
    entryMerkleRoot?: string;
    winnerMerkleRoot?: string;
    dropMerkleRoot?: string;
    finalSeed?: string;
  };
};

type ImpactCertificate = {
  id: string;
  evidenceRoot: string;
  certificateHash: string;
  methodologyVersion: string;
};

const apiUrl = process.env.DROPIN_API_URL ?? "http://localhost:8787";
const roundId = process.env.DROPIN_ROUND_ID ?? "round_v1_ggw_demo";
const certificateId = process.env.DROPIN_CERTIFICATE_ID ?? "cert_v1_ggw_demo";

async function getApi<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }
  return payload.data;
}

async function main() {
  const requiredEnv = [
    "SOLANA_RPC_URL",
    "DROPIN_SOLANA_PROGRAM_ID",
    "DROPIN_SOLANA_ISSUER_KEYPAIR_PATH",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.log(`Devnet E2E dry run only. Missing env: ${missing.join(", ")}`);
    console.log("Set the env vars before fetching API proofs or submitting Solana transactions.");
    return;
  }

  const roundResults = await getApi<RoundResults>(`/lottery/rounds/${roundId}/results`);
  const certificate = await getApi<ImpactCertificate>(`/impact-certificates/${certificateId}`);

  console.log("Prepared Solana anchor payloads:");
  console.log({
    roundId,
    roundProof: roundResults.proof,
    certificateId,
    certificateProof: {
      evidenceRoot: certificate.evidenceRoot,
      certificateHash: certificate.certificateHash,
      methodologyVersion: certificate.methodologyVersion,
    },
  });
  console.log("Submit step is intentionally not automated until issuer keypair and devnet policy are configured.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
