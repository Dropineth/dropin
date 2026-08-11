import { CanopyProofOSPage } from "@/components/canopyproof-os/CanopyProofOSPage";
import { esgReportingEngine } from "@/data/canopyproof-os";

export default function EsgReportingPage() {
  return <CanopyProofOSPage module={esgReportingEngine} />;
}
