import { PrismaClient } from "@prisma/client";
import { hashJson, merkleRoot } from "@dropin/crypto";
import { seedRegions, seedSpecies } from "@dropin/schemas";

process.env.DATABASE_URL ??= "postgresql://dropin:dropin@localhost:5432/dropin_earth";

const prisma = new PrismaClient();

async function main() {
  for (const region of seedRegions) {
    await prisma.region.upsert({
      where: { id: region.id },
      update: {
        name: region.name,
        slug: region.slug,
        country: region.country,
        restorationType: region.restorationType,
        restorationPriority: region.restorationPriority,
        requiredTreesLow: region.requiredTreesLow,
        requiredTreesHigh: region.requiredTreesHigh,
        verifiedTrees: region.verifiedTrees,
        estimatedCo2eTonnes: region.estimatedCo2eTonnes,
        survivalRateEstimate: region.survivalRateEstimate,
      },
      create: {
        id: region.id,
        name: region.name,
        slug: region.slug,
        country: region.country,
        restorationType: region.restorationType,
        restorationPriority: region.restorationPriority,
        requiredTreesLow: region.requiredTreesLow,
        requiredTreesHigh: region.requiredTreesHigh,
        verifiedTrees: region.verifiedTrees,
        estimatedCo2eTonnes: region.estimatedCo2eTonnes,
        survivalRateEstimate: region.survivalRateEstimate,
      },
    });
  }

  for (const species of seedSpecies) {
    await prisma.species.upsert({
      where: { id: species.id },
      update: species,
      create: species,
    });
  }

  const createdAt = new Date();
  await prisma.lotteryRound.upsert({
    where: { id: "round_v1_ggw_demo" },
    update: {
      status: "open",
      entryMerkleRoot: null,
      randomnessCertificateId: null,
      roundCertificateHash: null,
      entryCount: 0,
      totalAmount: "0",
      updatedAt: createdAt,
    },
    create: {
      id: "round_v1_ggw_demo",
      chain: "solana",
      regionId: "region_ggw_sahel",
      title: "Great Green Wall V1 Canary Round",
      status: "open",
      ticketPriceAmount: "1",
      ticketPriceSymbol: "USDC",
      prizePoolBps: 2500,
      treeFundBps: 5000,
      canopyDropBps: 700,
      rwaFragmentDropBps: 500,
      referralBps: 500,
      operationsBps: 500,
      challengePoolBps: 300,
      opensAt: createdAt,
      closesAt: new Date(Date.now() + 86_400_000),
      entryCount: 0,
      totalAmount: "0",
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.project.upsert({
    where: { id: "project_v1_ggw_demo" },
    update: {
      title: "Great Green Wall Demo Project",
      status: "approved",
    },
    create: {
      id: "project_v1_ggw_demo",
      title: "Great Green Wall Demo Project",
      regionId: "region_ggw_sahel",
      operator: "Great Green Wall Local Operator",
      targetTreeCount: 10000,
      targetSpecies: ["Faidherbia albida", "Acacia senegal"],
      budgetAmount: "25000",
      status: "approved",
    },
  });

  await prisma.projectMilestone.upsert({
    where: { id: "milestone_v1_ggw_demo_1" },
    update: {
      title: "Plant first 1,000 drought-resistant trees",
      amount: "2500",
      status: "approved",
    },
    create: {
      id: "milestone_v1_ggw_demo_1",
      projectId: "project_v1_ggw_demo",
      title: "Plant first 1,000 drought-resistant trees",
      amount: "2500",
      status: "approved",
    },
  });

  const evidenceOneHash = "a".repeat(64);
  const evidenceTwoHash = "b".repeat(64);
  await prisma.evidenceObject.upsert({
    where: { id: "evidence_v1_ggw_demo_photo" },
    update: {
      sha256Hash: evidenceOneHash,
      status: "accepted",
    },
    create: {
      id: "evidence_v1_ggw_demo_photo",
      projectId: "project_v1_ggw_demo",
      treeClusterId: "cluster_v1_ggw_demo",
      kind: "photo",
      uri: "r2://dropin/evidence/ggw-photo-001.jpg",
      sha256Hash: evidenceOneHash,
      submittedBy: "validator_ggw_1",
      status: "accepted",
    },
  });

  await prisma.evidenceObject.upsert({
    where: { id: "evidence_v1_ggw_demo_gps" },
    update: {
      sha256Hash: evidenceTwoHash,
      status: "accepted",
    },
    create: {
      id: "evidence_v1_ggw_demo_gps",
      projectId: "project_v1_ggw_demo",
      treeClusterId: "cluster_v1_ggw_demo",
      kind: "gps",
      uri: "r2://dropin/evidence/ggw-gps-001.json",
      sha256Hash: evidenceTwoHash,
      submittedBy: "validator_ggw_1",
      status: "accepted",
    },
  });

  const evidenceRoot = merkleRoot([evidenceOneHash, evidenceTwoHash].sort());
  await prisma.certificateEvidence.deleteMany({
    where: { certificateId: "cert_v1_ggw_demo" },
  });
  await prisma.impactCertificate.upsert({
    where: { id: "cert_v1_ggw_demo" },
    update: {
      evidenceRoot,
      status: "issued",
    },
    create: {
      id: "cert_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      treeClusterId: "cluster_v1_ggw_demo",
      regionId: "region_ggw_sahel",
      certificateLevel: "impact_certificate",
      evidenceRoot,
      methodologyVersion: "impact-v1-pre-mrv",
      verifiedTreeCount: 800,
      survivalRateEstimate: "0.72",
      estimatedCo2eLow: "120",
      estimatedCo2eHigh: "210",
      confidenceScore: 72,
      validatorSignatures: ["validator_sig_ggw_1"],
      status: "issued",
      issuedAt: createdAt,
      createdAt,
    },
  });
  await prisma.certificateEvidence.createMany({
    data: [
      {
        certificateId: "cert_v1_ggw_demo",
        evidenceId: "evidence_v1_ggw_demo_photo",
      },
      {
        certificateId: "cert_v1_ggw_demo",
        evidenceId: "evidence_v1_ggw_demo_gps",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.riskEvent.upsert({
    where: { id: "risk_event_v1_manual_review_demo" },
    update: {
      status: "open",
      riskLevel: "medium",
      score: "0.61",
      recommendedAction: "manual_review",
      reasonCodes: ["rwa_fragment_requires_manual_review"],
    },
    create: {
      id: "risk_event_v1_manual_review_demo",
      subjectType: "rwa_fragment",
      subjectId: "fragment_v1_manual_review_demo",
      riskLevel: "medium",
      score: "0.61",
      recommendedAction: "manual_review",
      reasonCodes: ["rwa_fragment_requires_manual_review"],
      status: "open",
    },
  });

  await prisma.challengeCase.upsert({
    where: { id: "challenge_v1_cert_demo" },
    update: {
      status: "bonded",
      result: "pending",
    },
    create: {
      id: "challenge_v1_cert_demo",
      targetType: "impact_certificate",
      targetId: "cert_v1_ggw_demo",
      challenger: "red_team_demo",
      severity: "medium",
      title: "Demo evidence root review",
      attackScenario: "A red-team reviewer requests a second look at the evidence root before public reliance.",
      evidenceHash: "demo-challenge-evidence-hash",
      bondAmount: "5",
      status: "bonded",
      result: "pending",
    },
  });

  await prisma.challengeBond.upsert({
    where: { id: "challenge_bond_v1_cert_demo" },
    update: {
      status: "locked",
    },
    create: {
      id: "challenge_bond_v1_cert_demo",
      challengeId: "challenge_v1_cert_demo",
      challengerUserId: "red_team_demo",
      amount: "5",
      currency: "USDC",
      status: "locked",
    },
  });

  const treasuryAccounts = [
    ["treasury_payment_clearing_usdc", "payment_clearing", "Payment Clearing"],
    ["treasury_prize_pool_usdc", "prize_pool", "Prize Pool"],
    ["treasury_tree_planting_fund_usdc", "tree_planting_fund", "Tree Planting Fund"],
    ["treasury_operations_usdc", "operations", "Operations"],
    ["treasury_insurance_challenge_pool_usdc", "insurance_challenge_pool", "Insurance Challenge Pool"],
    ["treasury_referral_growth_usdc", "referral_growth", "Referral Growth"],
    ["treasury_protocol_reserve_usdc", "protocol_reserve", "Protocol Reserve"],
    ["treasury_round_escrow_usdc_global", "round_escrow", "Round Escrow Global"],
    ["treasury_project_escrow_usdc_project_v1_ggw_demo", "project_escrow", "Project escrow project_v1_ggw_demo"],
  ] as const;
  for (const [id, type, name] of treasuryAccounts) {
    await prisma.treasuryAccount.upsert({
      where: { id },
      update: { type, name, currency: "USDC", status: "active" },
      create: { id, type, name, currency: "USDC", status: "active" },
    });
  }

  await prisma.treasuryTransaction.upsert({
    where: { id: "treasury_tx_v1_ggw_tree_fund_demo" },
    update: {
      amount: "0",
      status: "posted",
    },
    create: {
      id: "treasury_tx_v1_ggw_tree_fund_demo",
      type: "lottery_allocation",
      debitAccountId: "treasury_round_escrow_usdc_global",
      creditAccountId: "treasury_tree_planting_fund_usdc",
      amount: "0",
      currency: "USDC",
      sourceType: "lottery_round",
      sourceId: "round_v1_ggw_demo",
      status: "posted",
      memo: "Seeded Tree Fund allocation placeholder",
      postedAt: createdAt,
    },
  });

  await prisma.fundAllocation.upsert({
    where: { id: "fund_allocation_v1_ggw_tree_fund_demo" },
    update: {
      status: "approved",
      ledgerTransactionId: "treasury_tx_v1_ggw_tree_fund_demo",
    },
    create: {
      id: "fund_allocation_v1_ggw_tree_fund_demo",
      sourceType: "lottery_round",
      sourceId: "round_v1_ggw_demo",
      allocationType: "tree_fund",
      projectId: "project_v1_ggw_demo",
      amount: "0",
      currency: "USDC",
      status: "approved",
      ledgerTransactionId: "treasury_tx_v1_ggw_tree_fund_demo",
    },
  });

  await prisma.treasuryTransaction.upsert({
    where: { id: "treasury_tx_v1_ggw_milestone_release_demo" },
    update: {
      amount: "2500",
      status: "posted",
    },
    create: {
      id: "treasury_tx_v1_ggw_milestone_release_demo",
      type: "milestone_release",
      debitAccountId: "treasury_tree_planting_fund_usdc",
      creditAccountId: "treasury_project_escrow_usdc_project_v1_ggw_demo",
      amount: "2500",
      currency: "USDC",
      sourceType: "project_milestone",
      sourceId: "milestone_v1_ggw_demo_1",
      status: "posted",
      memo: "Seeded milestone release placeholder",
      postedAt: createdAt,
    },
  });

  await prisma.projectMilestoneRelease.upsert({
    where: { id: "milestone_release_v1_ggw_demo" },
    update: {
      status: "settled",
      ledgerTransactionId: "treasury_tx_v1_ggw_milestone_release_demo",
    },
    create: {
      id: "milestone_release_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      milestoneId: "milestone_v1_ggw_demo_1",
      allocationId: "fund_allocation_v1_ggw_tree_fund_demo",
      amount: "2500",
      currency: "USDC",
      status: "settled",
      ledgerTransactionId: "treasury_tx_v1_ggw_milestone_release_demo",
    },
  });

  const settlementHash = hashJson({
    kind: "dropin-settlement-certificate-v1",
    projectId: "project_v1_ggw_demo",
    milestoneId: "milestone_v1_ggw_demo_1",
    evidenceRoot,
    amount: "2500",
    currency: "USDC",
    certificateId: "cert_v1_ggw_demo",
    finalSettlement: true,
  });
  await prisma.settlementCertificate.upsert({
    where: { id: "settlement_v1_ggw_demo" },
    update: {
      evidenceRoot,
      settlementHash,
      status: "issued",
    },
    create: {
      id: "settlement_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      milestoneId: "milestone_v1_ggw_demo_1",
      releaseId: "milestone_release_v1_ggw_demo",
      evidenceRoot,
      amount: "2500",
      currency: "USDC",
      certificateId: "cert_v1_ggw_demo",
      settlementHash,
      finalSettlement: true,
      status: "issued",
    },
  });

  await prisma.paymentIntent.upsert({
    where: { id: "payment_intent_v1_ggw_demo" },
    update: {
      status: "confirmed",
      confirmedTxHash: "mock_tx_v1_ggw_demo",
      treasuryTransactionId: "treasury_tx_v1_ggw_payment_demo",
    },
    create: {
      id: "payment_intent_v1_ggw_demo",
      userId: "demo-user",
      wallet: "solana_demo_wallet_7xDropinEarthV1",
      purpose: "lottery_entry",
      purposeId: "round_v1_ggw_demo",
      chain: "manual",
      currency: "USDC",
      amount: "1",
      status: "confirmed",
      expectedRecipient: "manual://dropin/usdc/round_v1_ggw_demo",
      submittedTxHash: "mock_tx_v1_ggw_demo",
      confirmedTxHash: "mock_tx_v1_ggw_demo",
      confirmedAt: createdAt,
      expiresAt: new Date(Date.now() + 86_400_000),
      metadata: { seed: true },
      treasuryTransactionId: "treasury_tx_v1_ggw_payment_demo",
    },
  });

  await prisma.paymentEvent.upsert({
    where: { id: "payment_event_v1_ggw_demo_confirmed" },
    update: {
      txHash: "mock_tx_v1_ggw_demo",
    },
    create: {
      id: "payment_event_v1_ggw_demo_confirmed",
      paymentIntentId: "payment_intent_v1_ggw_demo",
      type: "payment_confirmed",
      txHash: "mock_tx_v1_ggw_demo",
      metadata: { seed: true },
    },
  });

  await prisma.treasuryTransaction.upsert({
    where: { id: "treasury_tx_v1_ggw_payment_demo" },
    update: {
      amount: "1",
      status: "posted",
    },
    create: {
      id: "treasury_tx_v1_ggw_payment_demo",
      type: "payment_confirmation",
      debitAccountId: "treasury_payment_clearing_usdc",
      creditAccountId: "treasury_round_escrow_usdc_global",
      amount: "1",
      currency: "USDC",
      sourceType: "payment_intent",
      sourceId: "payment_intent_v1_ggw_demo",
      status: "posted",
      memo: "Seeded confirmed payment intent placeholder",
      postedAt: createdAt,
    },
  });

  await prisma.paymentIntent.upsert({
    where: { id: "payment_intent_v1_ton_testnet_demo" },
    update: {
      status: "awaiting_payment",
      expectedRecipient: "ton-testnet://dropin-treasury-placeholder",
      expectedMemo: "DROPIN:payment_intent_v1_ton_testnet_demo:nonce_v1_ton_demo",
      paymentNonce: "nonce_v1_ton_demo",
    },
    create: {
      id: "payment_intent_v1_ton_testnet_demo",
      userId: "demo-user",
      wallet: "ton_testnet_wallet_dropin_demo",
      purpose: "lottery_entry",
      purposeId: "round_v1_ggw_demo",
      chain: "ton",
      currency: "TON",
      amount: "1",
      status: "awaiting_payment",
      expectedRecipient: "ton-testnet://dropin-treasury-placeholder",
      paymentNonce: "nonce_v1_ton_demo",
      expectedMemo: "DROPIN:payment_intent_v1_ton_testnet_demo:nonce_v1_ton_demo",
      expiresAt: new Date(Date.now() + 86_400_000),
      metadata: { seed: true, network: "testnet", adapter: "ton_testnet" },
    },
  });

  await prisma.telegramAccount.upsert({
    where: { telegramUserId: "10001" },
    update: {
      username: "dropin_demo",
      firstName: "Dropin",
      lastName: "Demo",
      languageCode: "en",
      linkedUserId: "telegram_10001",
      wallet: "ton_testnet_wallet_dropin_demo",
    },
    create: {
      id: "telegram_account_v1_demo",
      telegramUserId: "10001",
      username: "dropin_demo",
      firstName: "Dropin",
      lastName: "Demo",
      languageCode: "en",
      linkedUserId: "telegram_10001",
      wallet: "ton_testnet_wallet_dropin_demo",
    },
  });

  await prisma.referralCode.upsert({
    where: { code: "DPNGGWDEMO" },
    update: {
      ownerUserId: "demo-user",
      sourceType: "round",
      sourceId: "round_v1_ggw_demo",
      status: "active",
    },
    create: {
      id: "referral_code_v1_ggw_demo",
      code: "DPNGGWDEMO",
      ownerUserId: "demo-user",
      sourceType: "round",
      sourceId: "round_v1_ggw_demo",
      status: "active",
    },
  });

  await prisma.referralEvent.upsert({
    where: {
      code_referredTelegramUserId: {
        code: "DPNGGWDEMO",
        referredTelegramUserId: "10002",
      },
    },
    update: {
      status: "claimed",
      leafPoints: 20,
    },
    create: {
      id: "referral_event_v1_ggw_demo",
      code: "DPNGGWDEMO",
      referrerUserId: "demo-user",
      referredTelegramUserId: "10002",
      roundId: "round_v1_ggw_demo",
      status: "claimed",
      riskScoreSnapshot: {
        score: 0.62,
        riskLevel: "medium",
        recommendedAction: "delay",
        reasons: ["seeded_referral_demo"],
      },
      leafPoints: 20,
    },
  });

  await prisma.shareCard.upsert({
    where: { id: "share_card_v1_ggw_demo" },
    update: {
      referralCode: "DPNGGWDEMO",
      status: "created",
    },
    create: {
      id: "share_card_v1_ggw_demo",
      ticketId: "ticket_v1_ggw_demo",
      roundId: "round_v1_ggw_demo",
      ownerUserId: "demo-user",
      referralCode: "DPNGGWDEMO",
      title: "Dropin Earth Climate Proof Card",
      copy: "I planted into the Great Green Wall through Dropin Earth. My tree is waiting for proof. Co-plant with me.",
      url: "https://t.me/dropin_earth_bot/dropin?startapp=DPNGGWDEMO",
      status: "created",
    },
  });

  await prisma.campaign.upsert({
    where: { id: "campaign_v1_ggw_testnet" },
    update: {
      title: "Great Green Wall Testnet Co-Plant",
      slug: "great-green-wall-testnet",
      regionId: "region_ggw_sahel",
      status: "active",
      roundId: "round_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      fundingGoalAmount: "1000",
      fundingGoalCurrency: "USDC",
      treeGoal: 10000,
    },
    create: {
      id: "campaign_v1_ggw_testnet",
      title: "Great Green Wall Testnet Co-Plant",
      slug: "great-green-wall-testnet",
      regionId: "region_ggw_sahel",
      status: "active",
      startsAt: createdAt,
      endsAt: new Date(Date.now() + 14 * 86_400_000),
      fundingGoalAmount: "1000",
      fundingGoalCurrency: "USDC",
      treeGoal: 10000,
      roundId: "round_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
    },
  });

  await prisma.campaignRound.upsert({
    where: {
      campaignId_roundId: {
        campaignId: "campaign_v1_ggw_testnet",
        roundId: "round_v1_ggw_demo",
      },
    },
    update: {},
    create: {
      id: "campaign_round_v1_ggw_demo",
      campaignId: "campaign_v1_ggw_testnet",
      roundId: "round_v1_ggw_demo",
    },
  });

  await prisma.campaignProject.upsert({
    where: {
      campaignId_projectId: {
        campaignId: "campaign_v1_ggw_testnet",
        projectId: "project_v1_ggw_demo",
      },
    },
    update: {},
    create: {
      id: "campaign_project_v1_ggw_demo",
      campaignId: "campaign_v1_ggw_testnet",
      projectId: "project_v1_ggw_demo",
    },
  });

  await prisma.campaignParticipant.upsert({
    where: {
      campaignId_userId: {
        campaignId: "campaign_v1_ggw_testnet",
        userId: "demo-user",
      },
    },
    update: {
      status: "joined",
      wallet: "solana_demo_wallet_7xDropinEarthV1",
    },
    create: {
      id: "campaign_participant_v1_demo",
      campaignId: "campaign_v1_ggw_testnet",
      userId: "demo-user",
      wallet: "solana_demo_wallet_7xDropinEarthV1",
      status: "joined",
    },
  });

  await prisma.campaignParticipant.upsert({
    where: {
      campaignId_userId: {
        campaignId: "campaign_v1_ggw_testnet",
        userId: "telegram_10002",
      },
    },
    update: {
      status: "joined",
      referralCode: "DPNGGWDEMO",
    },
    create: {
      id: "campaign_participant_v1_referral_demo",
      campaignId: "campaign_v1_ggw_testnet",
      userId: "telegram_10002",
      referralCode: "DPNGGWDEMO",
      status: "joined",
    },
  });

  await prisma.leafPointsAccount.upsert({
    where: {
      campaignId_userId: {
        campaignId: "campaign_v1_ggw_testnet",
        userId: "demo-user",
      },
    },
    update: {
      balance: 35,
    },
    create: {
      id: "leaf_account_campaign_v1_ggw_testnet_demo-user",
      campaignId: "campaign_v1_ggw_testnet",
      userId: "demo-user",
      balance: 35,
    },
  });

  await prisma.leafPointsTransaction.upsert({
    where: {
      userId_sourceType_sourceId: {
        userId: "demo-user",
        sourceType: "seed",
        sourceId: "campaign_v1_ggw_testnet_seed",
      },
    },
    update: {
      amount: 35,
      status: "posted",
    },
    create: {
      id: "leaf_tx_v1_ggw_seed_demo",
      accountId: "leaf_account_campaign_v1_ggw_testnet_demo-user",
      campaignId: "campaign_v1_ggw_testnet",
      userId: "demo-user",
      amount: 35,
      sourceType: "seed",
      sourceId: "campaign_v1_ggw_testnet_seed",
      reason: "Seeded testnet campaign points",
      status: "posted",
    },
  });

  await prisma.campaignReport.upsert({
    where: { id: "campaign_report_v1_ggw_demo" },
    update: {
      participantCount: 2,
      ticketCount: 0,
      confirmedPaymentIntentCount: 1,
      totalConfirmedPaymentAmount: "1",
      evidenceCount: 2,
      challengeCount: 1,
      riskEventCount: 1,
      leaderboard: [
        { rank: 1, userId: "demo-user", campaignId: "campaign_v1_ggw_testnet", leafPoints: 35 },
      ],
    },
    create: {
      id: "campaign_report_v1_ggw_demo",
      campaignId: "campaign_v1_ggw_testnet",
      status: "published",
      participantCount: 2,
      ticketCount: 0,
      confirmedPaymentIntentCount: 1,
      totalConfirmedPaymentAmount: "1",
      fundingGoalAmount: "1000",
      fundingGoalCurrency: "USDC",
      treeGoal: 10000,
      evidenceCount: 2,
      challengeCount: 1,
      riskEventCount: 1,
      fundAllocations: [{ id: "fund_allocation_v1_ggw_tree_fund_demo", amount: "0", status: "approved" }],
      projectMilestones: [{ id: "milestone_v1_ggw_demo_1", status: "approved", amount: "2500" }],
      impactCertificateStatuses: { issued: 1 },
      leaderboard: [
        { rank: 1, userId: "demo-user", campaignId: "campaign_v1_ggw_testnet", leafPoints: 35 },
      ],
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Dropin Earth seed complete.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
