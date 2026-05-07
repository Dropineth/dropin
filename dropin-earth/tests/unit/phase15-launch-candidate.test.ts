import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("Phase 15 launch decision records GO with testnet constraints", () => {
  const source = file("docs/launch-decision-record.md");

  assert.match(source, /Decision: GO, with testnet-only constraints/);
  assert.match(source, /No mainnet funds/);
  assert.match(source, /Leaf Points are non-transferable testnet points/);
  assert.match(source, /Impact Certificate is not a certified carbon credit/);
});

test("Release notes define v0.15.0-testnet-campaign", () => {
  const changelog = file("CHANGELOG.md");
  const release = file("docs/release/v0.15.0-testnet-campaign.md");

  assert.match(changelog, /v0\.15\.0-testnet-campaign/);
  assert.match(release, /Public Testnet Launch Candidate/);
  assert.match(release, /70\/20\/10 allocation/);
});

test("First testers invite includes feedback and red-team links", () => {
  const source = file("docs/launch-pack/first-testers-invite.md");

  assert.match(source, /First Testers Invite/);
  assert.match(source, /http:\/\/localhost:3001\/feedback/);
  assert.match(source, /http:\/\/localhost:3001\/red-team/);
});

test("Daily operator report includes payment risk and challenge checks", () => {
  const source = file("docs/testnet-operator-daily-report.md");

  assert.match(source, /open risk events/);
  assert.match(source, /open challenge cases/);
  assert.match(source, /payment reconciliation mismatches/);
  assert.match(source, /Decision: CONTINUE \| PAUSE PROMOTION \| INCIDENT RESPONSE/);
});
