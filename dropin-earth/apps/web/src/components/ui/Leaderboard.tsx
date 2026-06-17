import type { LeaderboardEntry } from "@dropin/schemas";
import { Leaderboard as SharedLeaderboard } from "@dropin/ui";

export function Leaderboard({
  entries,
  title = "Global / Regional Leaderboard",
}: {
  entries: LeaderboardEntry[];
  title?: string;
}) {
  return <SharedLeaderboard entries={entries} title={title} />;
}
