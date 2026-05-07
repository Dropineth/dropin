export class ImpactError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ImpactError";
  }
}

export class ProjectNotFoundError extends ImpactError {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
  }
}

export class EvidenceNotFoundError extends ImpactError {
  constructor(evidenceId: string) {
    super(`Evidence not found: ${evidenceId}`, "EVIDENCE_NOT_FOUND");
  }
}

export class CertificateNotFoundError extends ImpactError {
  constructor(certificateId: string) {
    super(`Impact certificate not found: ${certificateId}`, "CERTIFICATE_NOT_FOUND");
  }
}

export class EvidenceNotAcceptedError extends ImpactError {
  constructor(evidenceId: string) {
    super(`Evidence must be accepted before certificate issuance: ${evidenceId}`, "EVIDENCE_NOT_ACCEPTED");
  }
}

export class InvalidImpactTransitionError extends ImpactError {
  constructor(from: string, to: string) {
    super(`Invalid impact transition: ${from} -> ${to}`, "INVALID_IMPACT_TRANSITION");
  }
}
