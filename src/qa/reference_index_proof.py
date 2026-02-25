from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"


def trigger_regenerate(variant: int) -> None:
    url = f"{BASE_URL}/?v={variant}"
    with urllib.request.urlopen(url, timeout=600) as response:
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


def read_reference_index() -> dict | None:
    index_path = Path("src/generated/reference-index.json")
    if not index_path.exists():
        return None

    try:
        return json.loads(index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def touch_one_reference() -> str | None:
    references = sorted(
        [p for p in Path("references").rglob("*") if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}],
        key=lambda p: p.as_posix().lower(),
    )
    if not references:
        return None

    target = references[0]
    future = time.time() + 2
    os.utime(target, (future, future))
    return target.as_posix()


def has_reference_gate_issue(response: dict) -> bool:
    body = response.get("body")
    if not isinstance(body, dict):
        return False
    issues = body.get("exportAuditIssues")
    if not isinstance(issues, list):
        return False

    for issue in issues:
        if not isinstance(issue, dict):
            continue
        message = str(issue.get("message", ""))
        if "reference index must be fresh" in message:
            return True
    return False


def main() -> None:
    trigger_regenerate(1)
    initial_index = read_reference_index()

    touched = touch_one_reference()
    stale_export = post_export(
        {
            "variantIndex": "1",
            "docType": "proposal",
            "pageSizePreset": "A4P",
            "pageWidthMm": "210",
            "pageHeightMm": "297",
        }
    )

    trigger_regenerate(2)
    rebuilt_export = post_export(
        {
            "variantIndex": "1",
            "docType": "proposal",
            "pageSizePreset": "A4P",
            "pageWidthMm": "210",
            "pageHeightMm": "297",
        }
    )
    rebuilt_index = read_reference_index()

    output = {
        "reference_index_exists": initial_index is not None,
        "reference_count": (initial_index or {}).get("referenceCount"),
        "touched_reference": touched,
        "stale_export_status": stale_export.get("status"),
        "stale_blocked_by_reference_gate": has_reference_gate_issue(stale_export),
        "rebuild_export_status": rebuilt_export.get("status"),
        "rebuild_unblocked": rebuilt_export.get("status") == 200,
        "rebuild_reference_count": (rebuilt_index or {}).get("referenceCount"),
        "stale_reference_usage": (stale_export.get("body") or {}).get("referenceUsageReport"),
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

