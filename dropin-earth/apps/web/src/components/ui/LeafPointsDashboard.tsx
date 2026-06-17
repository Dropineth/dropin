import { LeafPointsDashboard as SharedLeafPointsDashboard, type LeafPointsActivity, type PoccAhinActivity } from "@dropin/ui";

export function LeafPointsDashboard(props: {
  userId?: string;
  leafPoints: number;
  rwaTokens: number;
  rank?: number;
  activities?: readonly LeafPointsActivity[];
  poccEvents?: readonly PoccAhinActivity[];
  title?: string;
}) {
  return <SharedLeafPointsDashboard {...props} />;
}
