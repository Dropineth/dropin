import { Hono, type Context } from "hono";
import { satelliteProofReplayFixtureSchema } from "@dropin/schemas/satellite-proof";
import { DeterministicSatelliteIngestor } from "@dropin/satellite-ingestor";
import {
  assertCanopyProofAuthorizationAssurance,
  requireCanopyProofAuthorizationBinding,
  type CanopyProofAuthorizationBinding,
} from "../../domain/canopyproof/authorization-binding.js";
import {
  requireCanopyProofAuthenticatedPrincipal,
  type CanopyProofAuthenticatedPrincipal,
} from "../../domain/canopyproof/identity-authentication.js";
import type { CanopyProofAccessRole } from "../../domain/canopyproof/security-policy.js";

type SatelliteRouteEnvironment = {
  Variables: {
    canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
    canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
  };
};

export type CanopyProofSatelliteRouteOptions = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly ingestor?: DeterministicSatelliteIngestor | undefined;
};

const readRoles: readonly CanopyProofAccessRole[] = [
  "owner",
  "admin",
  "verifier",
  "researcher",
  "community",
  "observer",
  "agent",
];
const replayRoles: readonly CanopyProofAccessRole[] = ["owner", "admin", "verifier", "researcher", "agent"];

function requireSatelliteRole(
  context: Context<SatelliteRouteEnvironment>,
  allowedRoles: readonly CanopyProofAccessRole[],
): CanopyProofAuthenticatedPrincipal {
  const principal = requireCanopyProofAuthenticatedPrincipal(context.get("canopyProofPrincipal"));
  const binding = requireCanopyProofAuthorizationBinding(
    context.get("canopyProofAuthorizationBinding"),
    principal,
  );
  if (!allowedRoles.includes(principal.role)) {
    throw new Error(`CANOPYPROOF_RBAC_DENIED: role ${principal.role} cannot access satellite proof replay.`);
  }
  assertCanopyProofAuthorizationAssurance(binding, "participant");
  return principal;
}

export function createCanopyProofSatelliteRoutes(options: CanopyProofSatelliteRouteOptions) {
  const routes = new Hono<SatelliteRouteEnvironment>();
  const ingestor = options.ingestor ?? new DeterministicSatelliteIngestor();
  const productionUnlockEnabled = (): boolean => options.environment.CANOPY_PRODUCTION_UNLOCK === "true";

  routes.get("/status", (context) => {
    requireSatelliteRole(context, readRoles);
    return context.json({
      ok: true,
      data: {
        service: "canopyproof-three-layer-satellite-proof",
        implementationGate: ingestor.implementationGate,
        liveProviderCallsEnabled: false,
        productionUnlockEnabled: productionUnlockEnabled(),
        protocolWritePathBlocked: !productionUnlockEnabled(),
        layers: {
          baseline: ["sentinel-1", "sentinel-2", "landsat"],
          observation: ["planet", "iceye", "capella"],
          audit: ["maxar", "airbus", "drone", "field_validator"],
        },
        safety: {
          deterministicFixturesOnly: true,
          satelliteDataIsNotFinalProof: true,
          auditRequiredForCertificate: true,
          unresolvedChallengesBlockCertificates: true,
          noProductionClaims: true,
        },
      },
    });
  });

  routes.post("/replay", async (context) => {
    const principal = requireSatelliteRole(context, replayRoles);
    const fixture = satelliteProofReplayFixtureSchema.parse(await context.req.json());
    const result = ingestor.replayFixture(fixture, {
      CANOPY_PRODUCTION_UNLOCK: productionUnlockEnabled(),
    });
    return context.json({
      ok: true,
      data: {
        actorId: principal.actorId,
        productionWritePerformed: false,
        implementationGate: ingestor.implementationGate,
        records: {
          baseline: result.baseline,
          observation: result.observation,
          audit: result.audit,
        },
        replay: result.replay,
      },
    });
  });

  return routes;
}
