from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final, Protocol
from urllib.parse import urlparse

ACTION_PATHS: Final[Mapping[str, str]] = {
    "LOAD_REVIEW_QUEUE": "/v1/review-queue",
    "INSPECT_CANDIDATE_PROVENANCE": "/v1/candidate-provenance",
    "APPEND_REVIEW_DECISION": "/v1/reviews",
    "REQUEST_SECOND_REVIEW": "/v1/second-reviews",
    "CREATE_FIELD_VERIFICATION_TASK": "/v1/field-checks",
    "OPEN_CHALLENGE_DRAFT": "/v1/challenge-drafts",
    "REGISTER_HARD_NEGATIVE": "/v1/hard-negatives",
}

FORBIDDEN_ACTIONS: Final[frozenset[str]] = frozenset(
    {
        "VERIFY_ENVIRONMENTAL_PROOF",
        "ISSUE_CERTIFICATE",
        "PUBLISH_ESG_METRIC",
        "RELEASE_FUNDING",
        "MODIFY_RAW_EVIDENCE",
        "MODIFY_REVIEW_QUEUE_SNAPSHOT",
        "CHANGE_LICENSE_POLICY",
        "CHANGE_GOVERNANCE",
    }
)

_OPAQUE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$")
_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9_.:-]{16,256}$")
_FORBIDDEN_KEY = re.compile(
    r"secret|password|private.?key|credential|authorization|cookie|access.?token|"
    r"refresh.?token|signed.?url|database.?url|bucket|object.?prefix",
    re.IGNORECASE,
)
_FORBIDDEN_VALUE = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:postgres|mongodb|mysql)://|"
    r"[?&](?:token|signature|sig|key)=",
    re.IGNORECASE,
)


class ReviewProxyTransport(Protocol):
    def post(
        self,
        *,
        path: str,
        manifest_id: str,
        idempotency_key: str,
        payload: Mapping[str, object],
    ) -> Mapping[str, object]: ...


@dataclass(frozen=True)
class ReviewActionRequest:
    action: str
    manifest_id: str
    idempotency_key: str
    payload: Mapping[str, object]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> None:
        del req, fp, code, msg, headers, newurl
        return None


def _assert_no_forbidden_material(value: object, path: str = "payload") -> None:
    if isinstance(value, str):
        if _FORBIDDEN_VALUE.search(value):
            raise ValueError(f"forbidden material at {path}")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _assert_no_forbidden_material(item, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str) or _FORBIDDEN_KEY.search(key):
                raise ValueError(f"forbidden key at {path}")
            _assert_no_forbidden_material(item, f"{path}.{key}")


def _review_proxy_origin() -> str:
    origin = os.environ.get("CANOPYPROOF_REVIEW_PROXY_ORIGIN", "http://127.0.0.1:8788")
    parsed = urlparse(origin)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise RuntimeError("review proxy origin must be an uncredentialed loopback HTTP origin")
    port = parsed.port
    if port is None or port < 1024 or port > 65535:
        raise RuntimeError("review proxy origin requires an explicit unprivileged port")
    return f"http://127.0.0.1:{port}"


class LoopbackReviewProxyTransport:
    def __init__(self, *, timeout_seconds: float = 3.0, max_response_bytes: int = 65_536) -> None:
        if timeout_seconds <= 0 or timeout_seconds > 10:
            raise ValueError("timeout_seconds must be in (0, 10]")
        if max_response_bytes <= 0 or max_response_bytes > 1_048_576:
            raise ValueError("max_response_bytes must be in (0, 1048576]")
        self._origin = _review_proxy_origin()
        self._timeout_seconds = timeout_seconds
        self._max_response_bytes = max_response_bytes
        self._opener = urllib.request.build_opener(_NoRedirect())

    def post(
        self,
        *,
        path: str,
        manifest_id: str,
        idempotency_key: str,
        payload: Mapping[str, object],
    ) -> Mapping[str, object]:
        if path not in ACTION_PATHS.values():
            raise ValueError("review proxy path is not allowlisted")
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        request = urllib.request.Request(
            f"{self._origin}{path}",
            method="POST",
            data=body,
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "x-canopyproof-review-manifest-id": manifest_id,
                "idempotency-key": idempotency_key,
            },
        )
        try:
            with self._opener.open(request, timeout=self._timeout_seconds) as response:
                content_type = response.headers.get_content_type()
                if content_type != "application/json":
                    raise RuntimeError("review proxy returned a non-JSON response")
                raw = response.read(self._max_response_bytes + 1)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"review proxy rejected action with status {error.code}") from error
        except urllib.error.URLError as error:
            raise RuntimeError("review proxy is unavailable") from error
        if len(raw) > self._max_response_bytes:
            raise RuntimeError("review proxy response exceeds the configured limit")
        decoded = json.loads(raw)
        if not isinstance(decoded, dict):
            raise RuntimeError("review proxy response must be an object")
        _assert_no_forbidden_material(decoded, "response")
        return decoded


class CanopyProofReviewClient:
    def __init__(self, transport: ReviewProxyTransport) -> None:
        self._transport = transport

    def execute(self, request: ReviewActionRequest) -> Mapping[str, object]:
        if request.action in FORBIDDEN_ACTIONS:
            raise PermissionError(f"action {request.action} is permanently forbidden")
        path = ACTION_PATHS.get(request.action)
        if path is None:
            raise PermissionError(f"action {request.action} is not allowlisted")
        if not _OPAQUE_ID.fullmatch(request.manifest_id):
            raise ValueError("manifest_id is invalid")
        if not _IDEMPOTENCY_KEY.fullmatch(request.idempotency_key):
            raise ValueError("idempotency_key is invalid")
        _assert_no_forbidden_material(request.payload)
        return self._transport.post(
            path=path,
            manifest_id=request.manifest_id,
            idempotency_key=request.idempotency_key,
            payload=request.payload,
        )
