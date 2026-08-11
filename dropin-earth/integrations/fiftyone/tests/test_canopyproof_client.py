from __future__ import annotations

import importlib.util
import os
import sys
import unittest
from collections.abc import Mapping
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "plugins" / "canopyproof-review" / "canopyproof_client.py"
SPEC = importlib.util.spec_from_file_location("canopyproof_client", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("unable to load CanopyProof FiftyOne client")
CLIENT_MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CLIENT_MODULE
SPEC.loader.exec_module(CLIENT_MODULE)


class RecordingTransport:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def post(
        self,
        *,
        path: str,
        manifest_id: str,
        idempotency_key: str,
        payload: Mapping[str, object],
    ) -> Mapping[str, object]:
        self.calls.append(
            {
                "path": path,
                "manifest_id": manifest_id,
                "idempotency_key": idempotency_key,
                "payload": dict(payload),
            }
        )
        return {"ok": True, "authority_state": "PENDING_IMPORT"}


class CanopyProofClientTest(unittest.TestCase):
    def test_allowlisted_action_uses_fixed_path(self) -> None:
        transport = RecordingTransport()
        client = CLIENT_MODULE.CanopyProofReviewClient(transport)
        result = client.execute(
            CLIENT_MODULE.ReviewActionRequest(
                action="APPEND_REVIEW_DECISION",
                manifest_id="cp_fiftyone_manifest_1234567890",
                idempotency_key="review-idempotency-0001",
                payload={"candidate_id": "cp_candidate_001", "decision": "REJECT_FALSE_POSITIVE"},
            )
        )
        self.assertEqual(result["authority_state"], "PENDING_IMPORT")
        self.assertEqual(transport.calls[0]["path"], "/v1/reviews")

    def test_proof_and_esg_actions_are_forbidden(self) -> None:
        client = CLIENT_MODULE.CanopyProofReviewClient(RecordingTransport())
        for action in ("VERIFY_ENVIRONMENTAL_PROOF", "ISSUE_CERTIFICATE", "PUBLISH_ESG_METRIC", "RELEASE_FUNDING"):
            with self.subTest(action=action), self.assertRaises(PermissionError):
                client.execute(
                    CLIENT_MODULE.ReviewActionRequest(
                        action=action,
                        manifest_id="cp_fiftyone_manifest_1234567890",
                        idempotency_key="review-idempotency-0002",
                        payload={},
                    )
                )

    def test_secret_and_arbitrary_endpoint_material_is_rejected(self) -> None:
        client = CLIENT_MODULE.CanopyProofReviewClient(RecordingTransport())
        for payload in (
            {"database_url": "postgres://example.invalid/db"},
            {"nested": {"access_token": "value"}},
            {"media": "https://example.invalid/file?signature=secret"},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                client.execute(
                    CLIENT_MODULE.ReviewActionRequest(
                        action="LOAD_REVIEW_QUEUE",
                        manifest_id="cp_fiftyone_manifest_1234567890",
                        idempotency_key="review-idempotency-0003",
                        payload=payload,
                    )
                )

    def test_proxy_origin_must_be_loopback_and_uncredentialed(self) -> None:
        prior = os.environ.get("CANOPYPROOF_REVIEW_PROXY_ORIGIN")
        credentialed_origin = "http://identity" + ":credential@127.0.0.1:8788"
        try:
            for origin in (
                "https://api.example.invalid",
                "http://169.254.169.254:8080",
                credentialed_origin,
                "http://127.0.0.1:80",
            ):
                os.environ["CANOPYPROOF_REVIEW_PROXY_ORIGIN"] = origin
                with self.subTest(origin=origin), self.assertRaises(RuntimeError):
                    CLIENT_MODULE.LoopbackReviewProxyTransport()
        finally:
            if prior is None:
                os.environ.pop("CANOPYPROOF_REVIEW_PROXY_ORIGIN", None)
            else:
                os.environ["CANOPYPROOF_REVIEW_PROXY_ORIGIN"] = prior


if __name__ == "__main__":
    unittest.main()
