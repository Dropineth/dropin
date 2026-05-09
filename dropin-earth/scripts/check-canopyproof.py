#!/usr/bin/env python3
"""CanopyProof production DNS/TLS/Worker smoke checker.

This script is intentionally dependency-free so GitHub Actions can run it before
or after deployment without installing Python packages. It treats DNS, TLS, and
Worker admin blocking as launch gates because a beautiful frontend is still dark
to users when the domain is unbound or the edge route is unsafe.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


DEFAULT_DOMAIN = "canopyproof.org"
DEFAULT_WWW_DOMAIN = "www.canopyproof.org"
DEFAULT_RESOLVER_URL = "https://cloudflare-dns.com/dns-query"
DEFAULT_API_READY_PATH = "/api/ready"
DEFAULT_ADMIN_PATH = "/api/admin/launch/readiness"


@dataclass
class CheckResult:
    name: str
    status: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


def dns_query(name: str, record_type: str, resolver_url: str, timeout: float) -> dict[str, Any]:
    query = urllib.parse.urlencode({"name": name, "type": record_type})
    request = urllib.request.Request(
        f"{resolver_url}?{query}",
        headers={"accept": "application/dns-json", "user-agent": "dropin-canopyproof-smoke/1.0"},
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def answer_values(response: dict[str, Any]) -> list[str]:
    return [answer.get("data", "") for answer in response.get("Answer", []) if answer.get("data")]


def is_reserved_or_fake_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return False

    fake_ip_range = ipaddress.ip_network("198.18.0.0/15")
    return (
        ip in fake_ip_range
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_private
        or ip.is_reserved
        or ip.is_unspecified
    )


def check_dns_host(
    host: str,
    resolver_url: str,
    timeout: float,
    expected_cname_suffix: str | None,
    required: bool,
) -> CheckResult:
    details: dict[str, Any] = {"host": host, "resolver": resolver_url}

    try:
        a_response = dns_query(host, "A", resolver_url, timeout)
        cname_response = dns_query(host, "CNAME", resolver_url, timeout)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        status = "fail" if required else "warn"
        return CheckResult("dns", status, f"DNS lookup failed for {host}: {exc}", details)

    a_records = answer_values(a_response)
    cname_records = [value.rstrip(".") for value in answer_values(cname_response)]
    details.update(
        {
            "a_status": a_response.get("Status"),
            "cname_status": cname_response.get("Status"),
            "a_records": a_records,
            "cname_records": cname_records,
        }
    )

    bad_ips = [ip for ip in a_records if is_reserved_or_fake_ip(ip)]
    if bad_ips:
        return CheckResult("dns", "fail", f"{host} resolves to reserved or fake IPs: {', '.join(bad_ips)}", details)

    if expected_cname_suffix:
        matching_cnames = [cname for cname in cname_records if cname.endswith(expected_cname_suffix.rstrip("."))]
        if cname_records and not matching_cnames:
            status = "fail" if required else "warn"
            return CheckResult(
                "dns",
                status,
                f"{host} CNAME does not match expected suffix {expected_cname_suffix}",
                details,
            )

    if a_records or cname_records:
        return CheckResult("dns", "pass", f"{host} has public DNS answers", details)

    status = "fail" if required else "warn"
    return CheckResult("dns", status, f"{host} has no public A or CNAME answer", details)


def fetch_status(url: str, timeout: float) -> tuple[int | None, str | None]:
    request = urllib.request.Request(url, headers={"user-agent": "dropin-canopyproof-smoke/1.0"})
    context = ssl.create_default_context()

    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            return response.status, None
    except urllib.error.HTTPError as exc:
        return exc.code, None
    except (urllib.error.URLError, TimeoutError, ssl.SSLError) as exc:
        return None, str(exc)


def check_http_status(name: str, url: str, timeout: float, allowed_statuses: set[int]) -> CheckResult:
    status_code, error = fetch_status(url, timeout)
    details: dict[str, Any] = {"url": url, "status_code": status_code}

    if error:
        details["error"] = error
        return CheckResult(name, "fail", f"{url} request failed: {error}", details)

    if status_code in allowed_statuses:
        return CheckResult(name, "pass", f"{url} returned HTTP {status_code}", details)

    return CheckResult(name, "fail", f"{url} returned HTTP {status_code}, expected {sorted(allowed_statuses)}", details)


def print_report(results: list[CheckResult]) -> None:
    print("=== CanopyProof DNS / TLS / Worker Smoke Check ===")
    for result in results:
        marker = {"pass": "PASS", "warn": "WARN", "fail": "FAIL"}[result.status]
        print(f"[{marker}] {result.name}: {result.message}")
        if result.details:
            print(f"       {json.dumps(result.details, sort_keys=True)}")

    failures = sum(1 for result in results if result.status == "fail")
    warnings = sum(1 for result in results if result.status == "warn")
    print(f"Summary: failures={failures} warnings={warnings} checks={len(results)}")


def write_json_report(path: str, results: list[CheckResult]) -> None:
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "failures": sum(1 for result in results if result.status == "fail"),
            "warnings": sum(1 for result in results if result.status == "warn"),
            "checks": len(results),
        },
        "results": [result.__dict__ for result in results],
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def self_test() -> int:
    results = [
        CheckResult("dns", "pass", "canopyproof.org has public DNS answers", {"a_records": ["104.21.1.1"]}),
        CheckResult("http", "pass", "https://canopyproof.org/ returned HTTP 200", {"status_code": 200}),
        CheckResult("api", "pass", "https://canopyproof.org/api/ready returned HTTP 200", {"status_code": 200}),
        CheckResult("admin", "pass", "https://canopyproof.org/api/admin/launch/readiness returned HTTP 403", {"status_code": 403}),
    ]
    print_report(results)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Check CanopyProof DNS, TLS/HTTP, and API Worker route health.")
    parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    parser.add_argument("--www-domain", default=DEFAULT_WWW_DOMAIN)
    parser.add_argument("--resolver-url", default=DEFAULT_RESOLVER_URL)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--api-ready-path", default=DEFAULT_API_READY_PATH)
    parser.add_argument("--admin-path", default=DEFAULT_ADMIN_PATH)
    parser.add_argument("--expected-root-cname-suffix", default="")
    parser.add_argument("--expected-www-cname-suffix", default="")
    parser.add_argument("--require-www", action="store_true")
    parser.add_argument("--json-report", default="")
    parser.add_argument("--self-test", action="store_true", help="Run a deterministic no-network smoke check for CI unit tests.")
    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    root_url = f"https://{args.domain}/"
    ready_url = f"https://{args.domain}{args.api_ready_path}"
    admin_url = f"https://{args.domain}{args.admin_path}"

    results = [
        check_dns_host(
            args.domain,
            args.resolver_url,
            args.timeout,
            args.expected_root_cname_suffix or None,
            required=True,
        ),
        check_dns_host(
            args.www_domain,
            args.resolver_url,
            args.timeout,
            args.expected_www_cname_suffix or args.domain,
            required=args.require_www,
        ),
        check_http_status("http", root_url, args.timeout, set(range(200, 400))),
        check_http_status("api", ready_url, args.timeout, set(range(200, 300))),
        check_http_status("admin", admin_url, args.timeout, {401, 403}),
    ]

    print_report(results)

    if args.json_report:
        write_json_report(args.json_report, results)

    return 1 if any(result.status == "fail" for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
