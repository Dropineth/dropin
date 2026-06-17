import type { Region } from "@dropin/schemas";
import { GlobalRegionMap } from "@dropin/ui";

export function GlobalMap({
  regions,
  selectedRegionId,
}: {
  regions: Region[];
  selectedRegionId?: string;
}) {
  return (
    <GlobalRegionMap
      basePath="/campaigns/campaign_v1_ggw_testnet"
      regions={regions}
      {...(selectedRegionId ? { selectedRegionId } : {})}
    />
  );
}
