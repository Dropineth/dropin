import {
  canopyProofGlobalCommandCenterErrorSchema,
  canopyProofGlobalCommandCenterResponseSchema,
  type CanopyProofGlobalCommandCenterResponse,
} from "@dropin/schemas/canopyproof-global-command-center";

export type CommandCenterUnavailableCode =
  | "CANOPYPROOF_AUTH_REQUIRED"
  | "CANOPYPROOF_RBAC_DENIED"
  | "CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE"
  | "CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID"
  | "CANOPYPROOF_RATE_LIMITED"
  | "CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_SOURCE_REQUIRED"
  | "CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID";

export type CommandCenterState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly response: CanopyProofGlobalCommandCenterResponse }
  | { readonly kind: "empty"; readonly response: CanopyProofGlobalCommandCenterResponse }
  | { readonly kind: "unavailable"; readonly code: CommandCenterUnavailableCode };

export function classifyGlobalCommandCenterResponse(
  responseOk: boolean,
  payload: unknown,
): Exclude<CommandCenterState, { readonly kind: "loading" }> {
  if (!responseOk) {
    const parsedError = canopyProofGlobalCommandCenterErrorSchema.safeParse(payload);
    if (parsedError.success) return { kind: "unavailable", code: parsedError.data.error };
    if (
      typeof payload === "object" && payload !== null && "error" in payload &&
      typeof (payload as { readonly error?: unknown }).error === "string" &&
      (payload as { readonly error: string }).error.startsWith("CANOPYPROOF_RBAC_DENIED")
    ) {
      return { kind: "unavailable", code: "CANOPYPROOF_RBAC_DENIED" };
    }
    return { kind: "unavailable", code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID" };
  }
  const parsed = canopyProofGlobalCommandCenterResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return { kind: "unavailable", code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID" };
  }
  if (parsed.data.authority !== "postgresql_append_only_snapshot") {
    return {
      kind: "unavailable",
      code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_SOURCE_REQUIRED",
    };
  }
  return parsed.data.data.metrics.projectCount === 0
    ? { kind: "empty", response: parsed.data }
    : { kind: "ready", response: parsed.data };
}
