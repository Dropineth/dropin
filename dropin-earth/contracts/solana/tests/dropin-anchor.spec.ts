import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";

type RpcBuilder = {
  accounts(accounts: Record<string, unknown>): {
    rpc(): Promise<string>;
  };
};

type RoundRootAnchorAccount = {
  roundIdHash: number[];
  dropMerkleRoot: number[];
  issuer: web3.PublicKey;
  revoked: boolean;
};

type ImpactCertificateAnchorAccount = {
  certificateIdHash: number[];
  evidenceRoot: number[];
  issuer: web3.PublicKey;
  revoked: boolean;
};

type MerkleDropClaimAccount = {
  roundIdHash: number[];
  claimant: web3.PublicKey;
  claimHash: number[];
};

type DropinProgram = Program<anchor.Idl> & {
  methods: {
    anchorRoundRoot(
      roundIdHash: number[],
      entryMerkleRoot: number[],
      randomnessCertificateHash: number[],
      winnerMerkleRoot: number[],
      dropMerkleRoot: number[],
    ): RpcBuilder;
    anchorDropRoot(dropMerkleRoot: number[]): RpcBuilder;
    anchorImpactCertificate(
      certificateIdHash: number[],
      projectIdHash: number[],
      evidenceRoot: number[],
      certificateHash: number[],
      methodologyHash: number[],
    ): RpcBuilder;
    revokeRoundAnchor(): RpcBuilder;
    revokeImpactCertificateAnchor(): RpcBuilder;
    claimMerkleDrop(
      roundIdHash: number[],
      claimHash: number[],
      proof: number[][],
      leafIndex: number,
    ): RpcBuilder;
  };
  account: {
    roundRootAnchor: {
      fetch(address: web3.PublicKey): Promise<RoundRootAnchorAccount>;
    };
    impactCertificateAnchor: {
      fetch(address: web3.PublicKey): Promise<ImpactCertificateAnchorAccount>;
    };
    merkleDropClaim: {
      fetch(address: web3.PublicKey): Promise<MerkleDropClaimAccount>;
    };
  };
};

describe("dropin_anchor", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const programId = new web3.PublicKey("D27zujuVZsAZdS1SHS2Lpi6573ioTQAvjrpWSXV3k1ks");
  const program = new Program(dropinAnchorIdl(programId), provider) as DropinProgram;
  const issuer = provider.wallet.publicKey;
  let nonce = 0;

  async function waitForProgramDeployed() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const account = await provider.connection.getAccountInfo(program.programId);
      if (account?.executable) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Program ${program.programId.toBase58()} was not deployed on local validator.`);
  }

  async function rpcWithDeployRetry(call: () => Promise<string>) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await waitForProgramDeployed();
      try {
        return await call();
      } catch (error) {
        if (String(error).includes("Program is not deployed")) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw error;
      }
    }
    return call();
  }

  before(async () => {
    await waitForProgramDeployed();
  });

  function hash(label: string) {
    return createHash("sha256").update(label).digest();
  }

  function uniqueHash(label: string) {
    nonce += 1;
    return hash(`${label}-${nonce}`);
  }

  function bytes(value: Buffer) {
    return Array.from(value);
  }

  function equalBytes(left: number[] | Uint8Array, right: Buffer) {
    assert.equal(Buffer.from(left).toString("hex"), right.toString("hex"));
  }

  function roundPda(roundIdHash: Buffer) {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("round"), roundIdHash],
      program.programId,
    )[0];
  }

  function impactPda(certificateIdHash: Buffer) {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("impact"), certificateIdHash],
      program.programId,
    )[0];
  }

  function claimPda(roundIdHash: Buffer, claimant: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), roundIdHash, claimant.toBuffer()],
      program.programId,
    )[0];
  }

  function pairHash(left: Buffer, right: Buffer) {
    return createHash("sha256").update(Buffer.concat([left, right])).digest();
  }

  async function anchorRound(dropMerkleRoot = uniqueHash("drop-root")) {
    const roundIdHash = uniqueHash("round");
    const roundAnchor = roundPda(roundIdHash);
    await rpcWithDeployRetry(() =>
      program.methods
        .anchorRoundRoot(
          bytes(roundIdHash),
          bytes(uniqueHash("entry-root")),
          bytes(uniqueHash("randomness-cert")),
          bytes(uniqueHash("winner-root")),
          bytes(dropMerkleRoot),
        )
        .accounts({
          issuer,
          roundAnchor,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc(),
    );
    return { roundIdHash, roundAnchor, dropMerkleRoot };
  }

  it("anchors a round root", async () => {
    const { roundIdHash, roundAnchor, dropMerkleRoot } = await anchorRound();
    const account = await program.account.roundRootAnchor.fetch(roundAnchor);

    equalBytes(account.roundIdHash, roundIdHash);
    equalBytes(account.dropMerkleRoot, dropMerkleRoot);
    assert.equal(account.issuer.toBase58(), issuer.toBase58());
    assert.equal(account.revoked, false);
  });

  it("rejects duplicate round root anchors", async () => {
    const { roundIdHash, roundAnchor } = await anchorRound();

    await assert.rejects(
      () => rpcWithDeployRetry(() => program.methods
        .anchorRoundRoot(
          bytes(roundIdHash),
          bytes(uniqueHash("entry-root-duplicate")),
          bytes(uniqueHash("randomness-cert-duplicate")),
          bytes(uniqueHash("winner-root-duplicate")),
          bytes(uniqueHash("drop-root-duplicate")),
        )
        .accounts({
          issuer,
          roundAnchor,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()),
      /AlreadyAnchored|already been anchored/,
    );
  });

  it("revokes a round root anchor", async () => {
    const { roundAnchor } = await anchorRound();

    await rpcWithDeployRetry(() =>
      program.methods
        .revokeRoundAnchor()
        .accounts({
          issuer,
          roundAnchor,
        })
        .rpc(),
    );

    const account = await program.account.roundRootAnchor.fetch(roundAnchor);
    assert.equal(account.revoked, true);
  });

  it("anchors an impact certificate hash", async () => {
    const certificateIdHash = uniqueHash("cert");
    const evidenceRoot = uniqueHash("evidence-root");
    const impactAnchor = impactPda(certificateIdHash);

    await rpcWithDeployRetry(() =>
      program.methods
        .anchorImpactCertificate(
          bytes(certificateIdHash),
          bytes(uniqueHash("project")),
          bytes(evidenceRoot),
          bytes(uniqueHash("certificate-hash")),
          bytes(uniqueHash("methodology")),
        )
        .accounts({
          issuer,
          impactAnchor,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc(),
    );

    const account = await program.account.impactCertificateAnchor.fetch(impactAnchor);
    equalBytes(account.certificateIdHash, certificateIdHash);
    equalBytes(account.evidenceRoot, evidenceRoot);
    assert.equal(account.revoked, false);
  });

  it("rejects duplicate impact certificate anchors", async () => {
    const certificateIdHash = uniqueHash("cert-duplicate");
    const impactAnchor = impactPda(certificateIdHash);
    const firstCall = () =>
      rpcWithDeployRetry(() => program.methods
        .anchorImpactCertificate(
          bytes(certificateIdHash),
          bytes(uniqueHash("project")),
          bytes(uniqueHash("evidence-root")),
          bytes(uniqueHash("certificate-hash")),
          bytes(uniqueHash("methodology")),
        )
        .accounts({
          issuer,
          impactAnchor,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc());

    await firstCall();
    await assert.rejects(firstCall, /AlreadyAnchored|already been anchored/);
  });

  it("revokes an impact certificate anchor", async () => {
    const certificateIdHash = uniqueHash("cert-revoke");
    const impactAnchor = impactPda(certificateIdHash);

    await rpcWithDeployRetry(() =>
      program.methods
        .anchorImpactCertificate(
          bytes(certificateIdHash),
          bytes(uniqueHash("project")),
          bytes(uniqueHash("evidence-root")),
          bytes(uniqueHash("certificate-hash")),
          bytes(uniqueHash("methodology")),
        )
        .accounts({
          issuer,
          impactAnchor,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc(),
    );

    await rpcWithDeployRetry(() =>
      program.methods
        .revokeImpactCertificateAnchor()
        .accounts({
          issuer,
          impactAnchor,
        })
        .rpc(),
    );

    const account = await program.account.impactCertificateAnchor.fetch(impactAnchor);
    assert.equal(account.revoked, true);
  });

  it("claims a Merkle drop", async () => {
    const claimHash = uniqueHash("claim-0");
    const siblingHash = uniqueHash("claim-1");
    const dropRoot = pairHash(claimHash, siblingHash);
    const { roundIdHash, roundAnchor } = await anchorRound(dropRoot);
    const claim = claimPda(roundIdHash, issuer);

    await rpcWithDeployRetry(() =>
      program.methods
        .claimMerkleDrop(bytes(roundIdHash), bytes(claimHash), [bytes(siblingHash)], 0)
        .accounts({
          claimant: issuer,
          roundAnchor,
          claim,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc(),
    );

    const account = await program.account.merkleDropClaim.fetch(claim);
    equalBytes(account.roundIdHash, roundIdHash);
    equalBytes(account.claimHash, claimHash);
    assert.equal(account.claimant.toBase58(), issuer.toBase58());
  });

  it("rejects duplicate Merkle claims", async () => {
    const claimHash = uniqueHash("claim-duplicate-0");
    const siblingHash = uniqueHash("claim-duplicate-1");
    const dropRoot = pairHash(claimHash, siblingHash);
    const { roundIdHash, roundAnchor } = await anchorRound(dropRoot);
    const claim = claimPda(roundIdHash, issuer);
    const claimCall = () =>
      rpcWithDeployRetry(() => program.methods
        .claimMerkleDrop(bytes(roundIdHash), bytes(claimHash), [bytes(siblingHash)], 0)
        .accounts({
          claimant: issuer,
          roundAnchor,
          claim,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc());

    await claimCall();
    await assert.rejects(claimCall, /AlreadyClaimed|already been claimed/);
  });

  it("rejects invalid Merkle proof", async () => {
    const claimHash = uniqueHash("claim-invalid-0");
    const siblingHash = uniqueHash("claim-invalid-1");
    const dropRoot = pairHash(claimHash, siblingHash);
    const { roundIdHash, roundAnchor } = await anchorRound(dropRoot);
    const claim = claimPda(roundIdHash, issuer);

    await assert.rejects(
      () => rpcWithDeployRetry(() => program.methods
        .claimMerkleDrop(bytes(roundIdHash), bytes(claimHash), [bytes(uniqueHash("wrong-sibling"))], 0)
        .accounts({
          claimant: issuer,
          roundAnchor,
          claim,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()),
      /InvalidMerkleProof|Merkle proof/,
    );
  });
});

function discriminator(namespace: string, name: string) {
  return Array.from(createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8));
}

function fixedBytes32() {
  return {
    array: ["u8", 32],
  };
}

function dropinAnchorIdl(programId: web3.PublicKey): anchor.Idl {
  const pubkeyField = (name: string) => ({ name, type: "pubkey" });
  const bytesField = (name: string) => ({ name, type: fixedBytes32() });
  const boolField = (name: string) => ({ name, type: "bool" });
  const i64Field = (name: string) => ({ name, type: "i64" });

  return {
    address: programId.toBase58(),
    metadata: {
      name: "dropin_anchor",
      version: "0.1.0",
      spec: "0.1.0",
      description: "Dropin Earth proof root anchoring program",
    },
    instructions: [
      {
        name: "anchorRoundRoot",
        discriminator: discriminator("global", "anchor_round_root"),
        accounts: [
          { name: "issuer", writable: true, signer: true },
          { name: "roundAnchor", writable: true },
          { name: "systemProgram", address: web3.SystemProgram.programId.toBase58() },
        ],
        args: [
          bytesField("roundIdHash"),
          bytesField("entryMerkleRoot"),
          bytesField("randomnessCertificateHash"),
          bytesField("winnerMerkleRoot"),
          bytesField("dropMerkleRoot"),
        ],
      },
      {
        name: "anchorDropRoot",
        discriminator: discriminator("global", "anchor_drop_root"),
        accounts: [
          { name: "issuer", signer: true },
          { name: "roundAnchor" },
        ],
        args: [bytesField("dropMerkleRoot")],
      },
      {
        name: "anchorImpactCertificate",
        discriminator: discriminator("global", "anchor_impact_certificate"),
        accounts: [
          { name: "issuer", writable: true, signer: true },
          { name: "impactAnchor", writable: true },
          { name: "systemProgram", address: web3.SystemProgram.programId.toBase58() },
        ],
        args: [
          bytesField("certificateIdHash"),
          bytesField("projectIdHash"),
          bytesField("evidenceRoot"),
          bytesField("certificateHash"),
          bytesField("methodologyHash"),
        ],
      },
      {
        name: "revokeRoundAnchor",
        discriminator: discriminator("global", "revoke_round_anchor"),
        accounts: [
          { name: "issuer", signer: true },
          { name: "roundAnchor", writable: true },
        ],
        args: [],
      },
      {
        name: "revokeImpactCertificateAnchor",
        discriminator: discriminator("global", "revoke_impact_certificate_anchor"),
        accounts: [
          { name: "issuer", signer: true },
          { name: "impactAnchor", writable: true },
        ],
        args: [],
      },
      {
        name: "claimMerkleDrop",
        discriminator: discriminator("global", "claim_merkle_drop"),
        accounts: [
          { name: "claimant", writable: true, signer: true },
          { name: "roundAnchor" },
          { name: "claim", writable: true },
          { name: "systemProgram", address: web3.SystemProgram.programId.toBase58() },
        ],
        args: [
          bytesField("roundIdHash"),
          bytesField("claimHash"),
          {
            name: "proof",
            type: {
              vec: fixedBytes32(),
            },
          },
          { name: "leafIndex", type: "u32" },
        ],
      },
    ],
    accounts: [
      {
        name: "roundRootAnchor",
        discriminator: discriminator("account", "RoundRootAnchor"),
      },
      {
        name: "impactCertificateAnchor",
        discriminator: discriminator("account", "ImpactCertificateAnchor"),
      },
      {
        name: "merkleDropClaim",
        discriminator: discriminator("account", "MerkleDropClaim"),
      },
    ],
    types: [
      {
        name: "roundRootAnchor",
        type: {
          kind: "struct",
          fields: [
            bytesField("roundIdHash"),
            bytesField("entryMerkleRoot"),
            bytesField("randomnessCertificateHash"),
            bytesField("winnerMerkleRoot"),
            bytesField("dropMerkleRoot"),
            pubkeyField("issuer"),
            i64Field("createdAt"),
            boolField("revoked"),
          ],
        },
      },
      {
        name: "impactCertificateAnchor",
        type: {
          kind: "struct",
          fields: [
            bytesField("certificateIdHash"),
            bytesField("projectIdHash"),
            bytesField("evidenceRoot"),
            bytesField("certificateHash"),
            bytesField("methodologyHash"),
            pubkeyField("issuer"),
            i64Field("createdAt"),
            boolField("revoked"),
          ],
        },
      },
      {
        name: "merkleDropClaim",
        type: {
          kind: "struct",
          fields: [
            bytesField("roundIdHash"),
            pubkeyField("claimant"),
            bytesField("claimHash"),
            i64Field("claimedAt"),
          ],
        },
      },
    ],
    errors: [
      { code: 6000, name: "AlreadyAnchored", msg: "Proof root has already been anchored." },
      { code: 6001, name: "AlreadyRevoked", msg: "Proof anchor has already been revoked." },
      { code: 6002, name: "InvalidMerkleProof", msg: "Merkle proof does not resolve to the anchored drop root." },
      { code: 6003, name: "AlreadyClaimed", msg: "Merkle drop has already been claimed by this wallet." },
      { code: 6004, name: "UnauthorizedIssuer", msg: "Only the original issuer can mutate this anchor." },
      { code: 6005, name: "InvalidRoot", msg: "Proof root cannot be the zero hash." },
    ],
  } as unknown as anchor.Idl;
}
