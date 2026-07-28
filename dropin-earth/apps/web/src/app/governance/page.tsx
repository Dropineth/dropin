import { CanopyProofOSPage } from "@/components/canopyproof-os/CanopyProofOSPage";
import { governanceOperatingLayer } from "@/data/canopyproof-os";

export default function GovernancePage() {
  return <CanopyProofOSPage module={governanceOperatingLayer} />;
}
