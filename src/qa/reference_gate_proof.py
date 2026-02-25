from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def ensure_test_images() -> int:
    images_dir = Path("images")
    images_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted([path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTS])
    if existing:
        return len(existing)

    references = sorted(
        [path for path in Path("references").rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTS],
        key=lambda item: item.as_posix().lower(),
    )[:8]
    for index, source in enumerate(references, start=1):
        target = images_dir / f"qa-{index:03d}{source.suffix.lower()}"
        target.write_bytes(source.read_bytes())

    created = [path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTS]
    return len(created)


def trigger_regenerate(params: dict[str, str]) -> None:
    query = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{BASE_URL}/?{query}", timeout=600) as response:
        response.read(2048)


def post_export(payload: dict[str, str]) -> dict:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(EXPORT_URL, data=data, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            _ = response.read(64)
            return {
                "status": response.status,
                "headers": headers,
                "body": None,
            }
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        parsed: dict | None = None
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = None
        return {
            "status": error.code,
            "headers": {key.lower(): value for key, value in error.headers.items()},
            "body": parsed,
            "raw_body": body,
        }


def has_reference_source_gate_issue(response: dict) -> bool:
    body = response.get("body")
    if not isinstance(body, dict):
        return False

    issues = body.get("exportAuditIssues")
    if not isinstance(issues, list):
        return False

    expected_markers = [
        "stylePreset.source must be references",
        "layoutPlan.source must be references",
    ]

    messages = [str(issue.get("message", "")) for issue in issues if isinstance(issue, dict)]
    return all(any(marker in message for message in messages) for marker in expected_markers)


def export_payload(disable_reference_usage: bool) -> dict[str, str]:
    payload = {
        "jobId": "qa-reference-gate",
        "docKind": "brochure",
        "pageCount": "exact(2)",
        "title": "QA_Reference_Gates",
        "language": "ko",
        "tone": "concise",
        "variantIndex": "1",
        "seed": "99991",
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
    }
    if disable_reference_usage:
        payload["qaDisableReferenceUsage"] = "1"
    return payload


def main() -> None:
    ensure_test_images()
    trigger_regenerate(
        {
            "jobId": "qa-reference-gate",
            "docKind": "brochure",
            "pageCount": "exact(2)",
            "title": "QA_Reference_Gates",
            "variantIndex": "1",
            "seed": "99991",
            "size": "A4P",
        }
    )

    blocked = post_export(export_payload(disable_reference_usage=True))
    allowed = post_export(export_payload(disable_reference_usage=False))

    output = {
        "blocked_status": blocked.get("status"),
        "blocked_by_reference_source_gate": has_reference_source_gate_issue(blocked),
        "blocked_body": blocked.get("body"),
        "allowed_status": allowed.get("status"),
        "allowed_audit_hash": (allowed.get("headers") or {}).get("x-docfactory-audit-hash"),
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

