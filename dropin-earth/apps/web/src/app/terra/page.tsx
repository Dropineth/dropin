import { CanopyProofOSPage } from "@/components/canopyproof-os/CanopyProofOSPage";
import { NasaGibsViewerLoader } from "@/components/canopyproof-os/NasaGibsViewerLoader";
import { terraProofIntelligence } from "@/data/canopyproof-os";

export default function TerraProofPage() {
  return (
    <CanopyProofOSPage module={terraProofIntelligence}>
      <NasaGibsViewerLoader />
    </CanopyProofOSPage>
  );
}
