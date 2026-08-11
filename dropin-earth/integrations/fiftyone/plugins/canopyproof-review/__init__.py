from __future__ import annotations

from collections.abc import Mapping
from typing import Final

import fiftyone.operators as foo
import fiftyone.operators.types as types

from .canopyproof_client import (
    CanopyProofReviewClient,
    LoopbackReviewProxyTransport,
    ReviewActionRequest,
)

_CLIENT: Final = CanopyProofReviewClient(LoopbackReviewProxyTransport())


class _CanopyProofOperator(foo.Operator):
    action: str
    label: str
    description: str

    @property
    def config(self) -> foo.OperatorConfig:
        return foo.OperatorConfig(
            name=self.action.lower(),
            label=self.label,
            description=self.description,
            allow_immediate_execution=True,
            allow_delegated_execution=False,
            allow_distributed_execution=False,
        )

    def resolve_input(self, ctx: foo.ExecutionContext) -> types.Property:
        del ctx
        inputs = types.Object()
        inputs.str("manifest_id", label="Review manifest ID", required=True)
        inputs.str("idempotency_key", label="Idempotency key", required=True)
        inputs.obj("payload", label="Typed action payload", required=True)
        return types.Property(inputs)

    def execute(self, ctx: foo.ExecutionContext) -> Mapping[str, object]:
        params = ctx.params
        payload = params.get("payload")
        if not isinstance(payload, dict):
            raise ValueError("typed action payload must be an object")
        return _CLIENT.execute(
            ReviewActionRequest(
                action=self.action,
                manifest_id=str(params.get("manifest_id", "")),
                idempotency_key=str(params.get("idempotency_key", "")),
                payload=payload,
            )
        )


class LoadReviewQueue(_CanopyProofOperator):
    action = "LOAD_REVIEW_QUEUE"
    label = "Load assigned review queue"
    description = "Loads one immutable CanopyProof review queue snapshot."


class InspectCandidateProvenance(_CanopyProofOperator):
    action = "INSPECT_CANDIDATE_PROVENANCE"
    label = "Inspect candidate provenance"
    description = "Reads a bounded provenance summary for an assigned candidate."


class AppendReviewDecision(_CanopyProofOperator):
    action = "APPEND_REVIEW_DECISION"
    label = "Submit review decision"
    description = "Requests an append-only CanopyProof human review decision."


class RequestSecondReview(_CanopyProofOperator):
    action = "REQUEST_SECOND_REVIEW"
    label = "Request second review"
    description = "Requests independent assignment without selecting a reviewer."


class CreateFieldVerificationTask(_CanopyProofOperator):
    action = "CREATE_FIELD_VERIFICATION_TASK"
    label = "Request field verification"
    description = "Requests a bounded, policy-reviewed field task."


class OpenChallengeDraft(_CanopyProofOperator):
    action = "OPEN_CHALLENGE_DRAFT"
    label = "Open challenge draft"
    description = "Creates a non-final challenge draft in CanopyProof."


class RegisterHardNegative(_CanopyProofOperator):
    action = "REGISTER_HARD_NEGATIVE"
    label = "Register hard negative"
    description = "Preserves a human-rejected candidate for allowed evaluation use."


def register(plugin: foo.PluginDefinition) -> None:
    plugin.register(LoadReviewQueue)
    plugin.register(InspectCandidateProvenance)
    plugin.register(AppendReviewDecision)
    plugin.register(RequestSecondReview)
    plugin.register(CreateFieldVerificationTask)
    plugin.register(OpenChallengeDraft)
    plugin.register(RegisterHardNegative)
