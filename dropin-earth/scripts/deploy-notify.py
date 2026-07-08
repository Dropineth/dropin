#!/usr/bin/env python3
"""Send Dropin deployment notifications to Slack and Telegram.

The script is dependency-free for GitHub Actions runners. Empty notification
secrets are treated as "channel disabled" so deployments do not fail because an
operator has not configured every optional alert sink.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class NotifyResult:
    channel: str
    delivered: bool
    detail: str


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Notify Slack and Telegram about a Dropin deployment.")
    parser.add_argument("--slack", default="", help="Slack incoming webhook URL.")
    parser.add_argument("--telegram-token", default="", help="Telegram bot token.")
    parser.add_argument("--telegram-chat", default="", help="Telegram chat id.")
    parser.add_argument("--domain", required=True, help="Production domain.")
    parser.add_argument("--sha", required=True, help="Git commit SHA.")
    parser.add_argument("--status", default="success", choices=["success", "failure", "cancelled", "skipped"])
    parser.add_argument("--environment", default="production")
    parser.add_argument("--api-ready-path", default="/api/ready")
    parser.add_argument("--admin-readiness-path", default="/api/admin/launch/readiness")
    parser.add_argument("--smoke-report", default="")
    parser.add_argument("--pocc-report", default="")
    parser.add_argument("--testdata-report", default="")
    parser.add_argument("--run-url", default="")
    return parser


def load_json(path: str) -> dict[str, Any] | None:
    if not path:
        return None

    report_path = Path(path)
    if not report_path.exists():
        return None

    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    return payload if isinstance(payload, dict) else None


def compact_report_lines(args: argparse.Namespace) -> list[str]:
    lines: list[str] = []
    smoke = load_json(args.smoke_report)
    if smoke:
        summary = smoke.get("summary", {})
        if isinstance(summary, dict):
            lines.append(
                "Smoke: "
                f"failures={summary.get('failures', 'n/a')} "
                f"warnings={summary.get('warnings', 'n/a')} "
                f"checks={summary.get('checks', 'n/a')}"
            )

    pocc = load_json(args.pocc_report)
    if pocc:
        network = pocc.get("network", {})
        events = pocc.get("events", {})
        latency = pocc.get("latency", {})
        if isinstance(network, dict) and isinstance(events, dict) and isinstance(latency, dict):
            lines.append(
                "PoCC/AHIN: "
                f"status={network.get('status', 'n/a')} "
                f"nodes={network.get('nodeCount', 'n/a')} "
                f"proof={events.get('proofVerificationSuccess', 'n/a')} "
                f"conflicts={events.get('conflicts', 'n/a')} "
                f"latencyMs={latency.get('consensusMs', 'n/a')}"
            )

    testdata = load_json(args.testdata_report)
    if testdata:
        summary = testdata.get("summary", {})
        if isinstance(summary, dict):
            lines.append(
                "Test Data: "
                f"leafPoints={summary.get('leafPointsIssued', 'n/a')} "
                f"rwaFragments={summary.get('rwaFragmentCount', 'n/a')}"
            )

    return lines


def deployment_message(args: argparse.Namespace) -> str:
    base_url = f"https://{args.domain}".rstrip("/")
    lines = [
        "Dropin deployment",
        f"Status: {args.status}",
        f"Environment: {args.environment}",
        f"Domain: {args.domain}",
        f"Commit: {args.sha[:7]}",
        f"Check: {base_url}/",
        f"API Ready: {base_url}{args.api_ready_path}",
        f"Admin Launch Readiness: {base_url}{args.admin_readiness_path}",
    ]
    lines.extend(compact_report_lines(args))

    if args.run_url:
        lines.append(f"Run: {args.run_url}")

    return "\n".join(lines)


def post_json(url: str, payload: dict[str, object], timeout: float = 10.0) -> None:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "user-agent": "dropin-deploy-notify/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        response.read()


def notify_slack(webhook_url: str, message: str) -> NotifyResult:
    if not webhook_url:
        return NotifyResult("slack", False, "skipped: SLACK_WEBHOOK_URL is empty")

    try:
        post_json(webhook_url, {"text": message})
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return NotifyResult("slack", False, f"failed: {exc}")

    return NotifyResult("slack", True, "delivered")


def notify_telegram(token: str, chat_id: str, message: str) -> NotifyResult:
    if not token or not chat_id:
        return NotifyResult("telegram", False, "skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is empty")

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": True,
    }

    try:
        post_json(url, payload)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return NotifyResult("telegram", False, f"failed: {exc}")

    return NotifyResult("telegram", True, "delivered")


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    message = deployment_message(args)
    results = [
        notify_slack(args.slack, message),
        notify_telegram(args.telegram_token, args.telegram_chat, message),
    ]

    for result in results:
        print(f"{result.channel}: {result.detail}")

    # Notification delivery should be observable but non-blocking. The deploy
    # gate is build/test/smoke; alert transport failures should not roll back a
    # good release.
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
