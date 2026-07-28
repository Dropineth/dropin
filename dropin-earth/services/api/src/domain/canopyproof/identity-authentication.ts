import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { canopyProofAccessRoles, type CanopyProofAccessRole } from "./security-policy.js";

export const canopyProofAuthenticationModes = ["development_headers", "cloudflare_access_jwt"] as const;
export type CanopyProofAuthenticationMode = (typeof canopyProofAuthenticationModes)[number];

export const canopyProofAuthenticationErrorCodes = [
  "CANOPYPROOF_AUTH_REQUIRED",
  "CANOPYPROOF_AUTH_INVALID",
  "CANOPYPROOF_AUTH_CONFIG_INVALID",
] as const;
export type CanopyProofAuthenticationErrorCode = (typeof canopyProofAuthenticationErrorCodes)[number];

export type CanopyProofAuthenticatedPrincipal = {
  readonly actorId: string;
  readonly role: CanopyProofAccessRole;
  readonly organizationId?: string;
  readonly issuer: string;
  readonly audience: readonly string[];
  readonly tokenId?: string;
  readonly authenticatedAt: string;
  readonly expiresAt?: string;
  readonly authenticationMethod: CanopyProofAuthenticationMode;
};

type CanopyProofAuthenticationConfigurationBase = {
  readonly production: boolean;
  readonly roleClaim: string;
  readonly organizationClaim: string;
};

export type CanopyProofAuthenticationConfiguration =
  | (CanopyProofAuthenticationConfigurationBase & {
      readonly mode: "development_headers";
    })
  | (CanopyProofAuthenticationConfigurationBase & {
      readonly mode: "cloudflare_access_jwt";
      readonly teamDomain: string;
      readonly audience: string;
    });

type CanopyProofAccessJwtConfiguration = Extract<CanopyProofAuthenticationConfiguration, { readonly mode: "cloudflare_access_jwt" }>;

export type CanopyProofAuthenticationStatus = {
  readonly service: "canopyproof-identity-authentication";
  readonly mode: CanopyProofAuthenticationMode | "invalid";
  readonly production: boolean;
  readonly configured: boolean;
  readonly configurationErrorCode?: CanopyProofAuthenticationErrorCode;
  readonly assertionHeader: "cf-access-jwt-assertion";
  readonly safety: {
    readonly originSignatureVerificationRequired: true;
    readonly issuerAndAudienceValidated: true;
    readonly rawActorHeadersRejectedInProduction: true;
    readonly publicKeysOnly: true;
    readonly privateKeyHandlingDisabled: true;
    readonly noAutomatedFinalAuthority: true;
  };
};

export type CanopyProofJwtVerifier = (
  token: string,
  configuration: CanopyProofAccessJwtConfiguration,
) => Promise<JWTPayload>;

export class CanopyProofAuthenticationError extends Error {
  readonly httpStatus: 401 | 503;

  constructor(
    readonly code: CanopyProofAuthenticationErrorCode,
    message: string,
    httpStatus: 401 | 503,
  ) {
    super(`${code}: ${message}`);
    this.name = "CanopyProofAuthenticationError";
    this.httpStatus = httpStatus;
  }
}

const claimNameSchema = z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/);
const actorIdSchema = z.string().trim().min(1).max(256).refine((value) => !value.toLowerCase().includes("anonymous"));
const organizationIdSchema = z.string().trim().min(1).max(256);
const tokenIdSchema = z.string().trim().min(1).max(512);
const cachedRemoteKeySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function resolveCanopyProofAuthenticationConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): CanopyProofAuthenticationConfiguration {
  const production = environment.DROPIN_CANOPYPROOF_MODE === "production" || environment.NODE_ENV === "production";
  const requestedMode = environment.DROPIN_CANOPYPROOF_AUTH_MODE?.trim();
  const mode = requestedMode || (production ? "cloudflare_access_jwt" : "development_headers");
  if (!canopyProofAuthenticationModes.includes(mode as CanopyProofAuthenticationMode)) {
    throw authenticationConfigurationError("DROPIN_CANOPYPROOF_AUTH_MODE is not recognized.");
  }
  const typedMode = mode as CanopyProofAuthenticationMode;
  if (production && typedMode !== "cloudflare_access_jwt") {
    throw authenticationConfigurationError("Production cannot trust development actor headers.");
  }

  const roleClaim = parseClaimName(environment.DROPIN_ACCESS_ROLE_CLAIM, "canopyproof_role");
  const organizationClaim = parseClaimName(environment.DROPIN_ACCESS_ORGANIZATION_CLAIM, "canopyproof_organization_id");
  if (typedMode === "development_headers") {
    return { mode: typedMode, production, roleClaim, organizationClaim };
  }

  const teamDomain = normalizeAccessTeamDomain(environment.DROPIN_ACCESS_TEAM_DOMAIN);
  const audience = environment.DROPIN_ACCESS_AUD?.trim();
  if (!audience || audience.length > 512) {
    throw authenticationConfigurationError("DROPIN_ACCESS_AUD is required and must be bounded.");
  }
  return {
    mode: typedMode,
    production,
    teamDomain,
    audience,
    roleClaim,
    organizationClaim,
  };
}

export function canopyProofAuthenticationStatus(
  environment: Readonly<Record<string, string | undefined>>,
): CanopyProofAuthenticationStatus {
  const production = environment.DROPIN_CANOPYPROOF_MODE === "production" || environment.NODE_ENV === "production";
  try {
    const configuration = resolveCanopyProofAuthenticationConfiguration(environment);
    return {
      service: "canopyproof-identity-authentication",
      mode: configuration.mode,
      production,
      configured: true,
      assertionHeader: "cf-access-jwt-assertion",
      safety: authenticationSafetyBoundary(),
    };
  } catch (error) {
    return {
      service: "canopyproof-identity-authentication",
      mode: "invalid",
      production,
      configured: false,
      configurationErrorCode:
        error instanceof CanopyProofAuthenticationError ? error.code : "CANOPYPROOF_AUTH_CONFIG_INVALID",
      assertionHeader: "cf-access-jwt-assertion",
      safety: authenticationSafetyBoundary(),
    };
  }
}

export async function authenticateCanopyProofRequest(
  headers: Headers,
  environment: Readonly<Record<string, string | undefined>>,
  verifyJwt: CanopyProofJwtVerifier = verifyCloudflareAccessJwt,
): Promise<CanopyProofAuthenticatedPrincipal | undefined> {
  const configuration = resolveCanopyProofAuthenticationConfiguration(environment);
  if (configuration.mode === "development_headers") {
    return developmentHeaderPrincipal(headers);
  }

  const assertion = headers.get("cf-access-jwt-assertion")?.trim();
  if (!assertion) return undefined;
  if (assertion.length > 16_384) {
    throw authenticationInvalid("Identity assertion exceeds the accepted size.");
  }

  let payload: JWTPayload;
  try {
    payload = await verifyJwt(assertion, configuration);
  } catch (error) {
    if (error instanceof CanopyProofAuthenticationError) throw error;
    throw authenticationInvalid("Identity assertion verification failed.");
  }
  return principalFromVerifiedPayload(payload, configuration);
}

export function requireCanopyProofAuthenticatedPrincipal(
  principal: CanopyProofAuthenticatedPrincipal | undefined,
): CanopyProofAuthenticatedPrincipal {
  if (!principal) {
    throw new CanopyProofAuthenticationError("CANOPYPROOF_AUTH_REQUIRED", "A verified identity assertion is required.", 401);
  }
  return principal;
}

async function verifyCloudflareAccessJwt(
  token: string,
  configuration: CanopyProofAccessJwtConfiguration,
) {
  const jwksUrl = new URL("/cdn-cgi/access/certs", configuration.teamDomain).toString();
  let keySet = cachedRemoteKeySets.get(jwksUrl);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(jwksUrl));
    cachedRemoteKeySets.set(jwksUrl, keySet);
  }
  const result = await jwtVerify(token, keySet, {
    issuer: configuration.teamDomain,
    audience: configuration.audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "iat", "exp"],
    clockTolerance: 5,
  });
  return result.payload;
}

function principalFromVerifiedPayload(
  payload: JWTPayload,
  configuration: CanopyProofAccessJwtConfiguration,
): CanopyProofAuthenticatedPrincipal {
  const actorId = actorIdSchema.safeParse(payload.sub);
  if (!actorId.success) throw authenticationInvalid("Identity assertion subject is missing or invalid.");
  const audiences = typeof payload.aud === "string" ? [payload.aud] : Array.isArray(payload.aud) ? payload.aud : [];
  if (payload.iss !== configuration.teamDomain || !audiences.includes(configuration.audience)) {
    throw authenticationInvalid("Identity assertion issuer or audience is invalid.");
  }
  const role = roleFromClaim(payload[configuration.roleClaim]);
  const organizationId = optionalOrganizationId(payload[configuration.organizationClaim]);
  const issuedAt = positiveNumericDate(payload.iat, "issued-at");
  const expiresAt = positiveNumericDate(payload.exp, "expiry");
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const notBefore = payload.nbf === undefined ? undefined : positiveNumericDate(payload.nbf, "not-before");
  if (issuedAt > nowSeconds + 5 || expiresAt <= issuedAt || expiresAt <= nowSeconds - 5 || (notBefore !== undefined && notBefore > nowSeconds + 5)) {
    throw authenticationInvalid("Identity assertion time claims are inconsistent.");
  }
  const tokenId = optionalTokenId(payload.jti);

  return {
    actorId: actorId.data,
    role,
    ...(organizationId ? { organizationId } : {}),
    issuer: configuration.teamDomain,
    audience: [configuration.audience],
    ...(tokenId ? { tokenId } : {}),
    authenticatedAt: new Date(issuedAt * 1_000).toISOString(),
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    authenticationMethod: "cloudflare_access_jwt",
  };
}

function developmentHeaderPrincipal(headers: Headers): CanopyProofAuthenticatedPrincipal | undefined {
  const actorIdValue = headers.get("x-dropin-actor-id")?.trim();
  const roleValue = headers.get("x-dropin-actor-role")?.trim().toLowerCase();
  const organizationValue = headers.get("x-dropin-organization-id")?.trim();
  if (!actorIdValue && !roleValue && !organizationValue) return undefined;
  const actorId = actorIdSchema.safeParse(actorIdValue);
  if (!actorId.success || !roleValue || !canopyProofAccessRoles.includes(roleValue as CanopyProofAccessRole)) {
    throw authenticationInvalid("Development identity headers are incomplete or invalid.");
  }
  const organizationId = organizationValue ? organizationIdSchema.safeParse(organizationValue) : undefined;
  if (organizationId && !organizationId.success) {
    throw authenticationInvalid("Development organization identity header is invalid.");
  }
  return {
    actorId: actorId.data,
    role: roleValue as CanopyProofAccessRole,
    ...(organizationId?.success ? { organizationId: organizationId.data } : {}),
    issuer: "urn:canopyproof:development-headers",
    audience: ["canopyproof-development"],
    authenticatedAt: new Date(0).toISOString(),
    authenticationMethod: "development_headers",
  };
}

function roleFromClaim(value: unknown): CanopyProofAccessRole {
  const candidates = typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  const recognized = [
    ...new Set(
      candidates
        .map((candidate) => candidate.trim().toLowerCase())
        .filter((candidate): candidate is CanopyProofAccessRole => canopyProofAccessRoles.includes(candidate as CanopyProofAccessRole)),
    ),
  ];
  if (candidates.length !== 1 || recognized.length !== 1) {
    throw authenticationInvalid("Identity assertion must contain exactly one recognized CanopyProof role.");
  }
  return recognized[0]!;
}

function optionalOrganizationId(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = organizationIdSchema.safeParse(value);
  if (!parsed.success) throw authenticationInvalid("Identity assertion organization claim is invalid.");
  return parsed.data;
}

function optionalTokenId(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = tokenIdSchema.safeParse(value);
  if (!parsed.success) throw authenticationInvalid("Identity assertion token ID is invalid.");
  return parsed.data;
}

function positiveNumericDate(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw authenticationInvalid(`Identity assertion ${label} claim is invalid.`);
  }
  return value;
}

function normalizeAccessTeamDomain(value: string | undefined) {
  if (!value?.trim()) throw authenticationConfigurationError("DROPIN_ACCESS_TEAM_DOMAIN is required.");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw authenticationConfigurationError("DROPIN_ACCESS_TEAM_DOMAIN must be an absolute HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(url.hostname === "cloudflareaccess.com" || url.hostname.endsWith(".cloudflareaccess.com"))
  ) {
    throw authenticationConfigurationError("DROPIN_ACCESS_TEAM_DOMAIN must be a root cloudflareaccess.com HTTPS URL.");
  }
  return url.origin;
}

function parseClaimName(value: string | undefined, fallback: string) {
  const parsed = claimNameSchema.safeParse(value?.trim() || fallback);
  if (!parsed.success) throw authenticationConfigurationError("Identity claim names must be bounded top-level JWT claim identifiers.");
  return parsed.data;
}

function authenticationInvalid(message: string) {
  return new CanopyProofAuthenticationError("CANOPYPROOF_AUTH_INVALID", message, 401);
}

function authenticationConfigurationError(message: string) {
  return new CanopyProofAuthenticationError("CANOPYPROOF_AUTH_CONFIG_INVALID", message, 503);
}

function authenticationSafetyBoundary() {
  return {
    originSignatureVerificationRequired: true as const,
    issuerAndAudienceValidated: true as const,
    rawActorHeadersRejectedInProduction: true as const,
    publicKeysOnly: true as const,
    privateKeyHandlingDisabled: true as const,
    noAutomatedFinalAuthority: true as const,
  };
}
