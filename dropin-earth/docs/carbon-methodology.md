# Carbon Methodology Boundary

Dropin Earth V1 only issues Impact Certificates.

An Impact Certificate can include:

- Accepted evidence hashes.
- A deterministic evidence root.
- Verified tree count.
- Survival rate estimate.
- Estimated CO2e low/high range.
- Methodology version.
- Validator signatures.
- Challenge status.

An Impact Certificate cannot be represented as:

- A certified carbon credit.
- A tax offset.
- A retired climate claim.
- A guaranteed RWA yield instrument.

## V1 Methodology

The seeded demo uses `impact-v1-pre-mrv`.

```text
Evidence hashes
→ deterministic Merkle evidenceRoot
→ verifiedTreeCount
→ survivalRateEstimate
→ estimatedCo2eLow / estimatedCo2eHigh
→ Impact Certificate
```

The estimated CO2e range is an estimated impact field only. It must remain separate from
MRV-certified carbon credits until a recognized MRV and registry workflow exists.

## Upgrade Gates

```text
No MRV, no carbon credit.
No retirement, no offset claim.
No survival proof, no carbon estimate upgrade.
No challenge window, no final trust.
```
