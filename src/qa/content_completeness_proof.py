from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"
JOB_ROOT = Path("src/generated/jobs")
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
        raw_body = error.read().decode("utf-8", errors="ignore")
        parsed: dict | None = None
        try:
            parsed = json.loads(raw_body)
        except json.JSONDecodeError:
            parsed = None
        return {
            "status": error.code,
            "headers": {key.lower(): value for key, value in error.headers.items()},
            "body": parsed,
            "raw_body": raw_body,
        }


def load_layout(request_hash: str) -> dict | None:
    layout_path = JOB_ROOT / request_hash / "layout.json"
    if not layout_path.exists():
        return None
    try:
        return json.loads(layout_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def page_has_minimum_content(page: dict) -> bool:
    elements = page.get("elements")
    if not isinstance(elements, list):
        return False

    title_count = 0
    body_or_callout_count = 0

    for element in elements:
        if not isinstance(element, dict):
            continue
        if element.get("type") != "text":
            continue
        if element.get("debugOnly"):
            continue

        text = str(element.get("text", "")).strip()
        if len(text) < 2:
            continue

        element_id = str(element.get("id", "")).lower()
        if "title" in element_id and "subtitle" not in element_id:
            title_count += 1
        if "body" in element_id or "callout" in element_id or text.startswith("- "):
            body_or_callout_count += 1

    return title_count >= 1 and body_or_callout_count >= 1


def run_case(case: dict[str, str]) -> dict:
    query = {
        "jobId": case["job_id"],
        "title": case["title"],
        "prompt": case["prompt"],
        "variantIndex": case["variant"],
        "seed": case["seed"],
        "size": "A4P",
    }
    if case.get("docKind"):
        query["docKind"] = case["docKind"]
    if case.get("pageCount"):
        query["pageCount"] = case["pageCount"]

    trigger_regenerate(query)

    payload = {
        "jobId": case["job_id"],
        "title": case["title"],
        "prompt": case["prompt"],
        "variantIndex": case["variant"],
        "seed": case["seed"],
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
        "language": "ko",
        "tone": "concise",
    }
    if case.get("docKind"):
        payload["docKind"] = case["docKind"]
    if case.get("pageCount"):
        payload["pageCount"] = case["pageCount"]

    response = post_export(payload)

    request_hash = (
        (response.get("headers") or {}).get("x-docfactory-request-hash")
        if response.get("status") == 200
        else ((response.get("body") or {}).get("requestHash") if isinstance(response.get("body"), dict) else None)
    )

    layout = load_layout(str(request_hash)) if isinstance(request_hash, str) else None
    pages = layout.get("pages") if isinstance(layout, dict) else None
    page_checks: list[bool] = []
    if isinstance(pages, list):
        page_checks = [page_has_minimum_content(page) for page in pages if isinstance(page, dict)]

    gate_proof = None
    if response.get("status") == 200:
        gate_proof = {
            "internal_terms": (response.get("headers") or {}).get("x-docfactory-content-internal-terms"),
            "completeness": (response.get("headers") or {}).get("x-docfactory-content-completeness"),
            "reference_usage": (response.get("headers") or {}).get("x-docfactory-reference-usage"),
        }

    export_issues = []
    if isinstance(response.get("body"), dict):
        export_issues = (response.get("body") or {}).get("exportAuditIssues") or []

    passed = response.get("status") == 200 and len(page_checks) > 0 and all(page_checks)
    if gate_proof:
        passed = passed and gate_proof.get("completeness") == "pass" and gate_proof.get("internal_terms") == "pass"

    return {
        "name": case["name"],
        "status": response.get("status"),
        "request_hash": request_hash,
        "page_checks": page_checks,
        "gate_proof": gate_proof,
        "export_issue_count": len(export_issues) if isinstance(export_issues, list) else 0,
        "passed": passed,
    }


def main() -> None:
    ensure_test_images()
    cases = [
        {
            "name": "empty-content",
            "job_id": "qa-complete-empty",
            "title": "QA_Content_Empty",
            "prompt": "",
            "docKind": "poster",
            "pageCount": "exact(1)",
            "variant": "1",
            "seed": "33001",
        },
        {
            "name": "poster-two-pages",
            "job_id": "qa-complete-poster2",
            "title": "QA_Content_Poster2",
            "prompt": "\uD3EC\uC2A4\uD130 2\uC7A5 \uB9CC\uB4E4\uC5B4\uC918",
            "variant": "1",
            "seed": "33002",
        },
        {
            "name": "friend-intro",
            "job_id": "qa-complete-friend",
            "title": "QA_Content_Friend",
            "prompt": "\uCE5C\uAD6C \uC18C\uAC1C \uD3EC\uC2A4\uD130 \uB9CC\uB4E4\uC5B4\uC918",
            "variant": "1",
            "seed": "33003",
        },
    ]

    results = [run_case(case) for case in cases]
    passed = all(result.get("passed") for result in results)

    output = {
        "passed": passed,
        "results": results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

    if not passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
