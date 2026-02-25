from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"
JOB_ROOT = Path("src/generated/jobs")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

FORBIDDEN_PATTERNS = [
    re.compile(r"\brequestspec\b", re.IGNORECASE),
    re.compile(r"\bvariantindex\b", re.IGNORECASE),
    re.compile(r"\breferencedigest\b", re.IGNORECASE),
    re.compile(r"\blayout\b", re.IGNORECASE),
    re.compile(r"\bvalidation\b", re.IGNORECASE),
    re.compile(r"\btheme-factory\b", re.IGNORECASE),
    re.compile(r"\bwebapp-testing\b", re.IGNORECASE),
]


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


def read_layout_texts(request_hash: str) -> list[dict]:
    layout_path = JOB_ROOT / request_hash / "layout.json"
    if not layout_path.exists():
        return []
    try:
        parsed = json.loads(layout_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    pages = parsed.get("pages")
    if not isinstance(pages, list):
        return []

    texts: list[dict] = []
    for page in pages:
        page_number = page.get("pageNumber")
        elements = page.get("elements")
        if not isinstance(elements, list):
            continue
        for element in elements:
            if not isinstance(element, dict):
                continue
            if element.get("type") != "text":
                continue
            if element.get("debugOnly"):
                continue
            texts.append(
                {
                    "page": page_number,
                    "id": element.get("id"),
                    "text": str(element.get("text", "")),
                }
            )
    return texts


def find_forbidden_hits(text_items: list[dict]) -> list[dict]:
    hits: list[dict] = []
    for item in text_items:
        source = item.get("text", "")
        for pattern in FORBIDDEN_PATTERNS:
            if not pattern.search(source):
                continue
            hits.append(
                {
                    "page": item.get("page"),
                    "id": item.get("id"),
                    "pattern": pattern.pattern,
                    "text": source,
                }
            )
    return hits


def has_internal_term_gate_issue(response: dict) -> bool:
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
        if "internal term leakage detected" in message:
            return True
    return False


def main() -> None:
    ensure_test_images()
    prompt = "RequestSpec variantIndex referenceDigest layout validation theme-factory webapp-testing"
    trigger_regenerate(
        {
            "jobId": "qa-no-internal-terms",
            "title": "QA_No_Internal_Terms",
            "docKind": "brochure",
            "pageCount": "exact(2)",
            "prompt": prompt,
            "variantIndex": "1",
            "seed": "147258",
            "size": "A4P",
        }
    )

    response = post_export(
        {
            "jobId": "qa-no-internal-terms",
            "title": "QA_No_Internal_Terms",
            "docKind": "brochure",
            "pageCount": "exact(2)",
            "prompt": prompt,
            "variantIndex": "1",
            "seed": "147258",
            "pageSizePreset": "A4P",
            "pageWidthMm": "210",
            "pageHeightMm": "297",
            "language": "ko",
            "tone": "concise",
        }
    )

    request_hash = (
        (response.get("headers") or {}).get("x-docfactory-request-hash")
        if response.get("status") == 200
        else ((response.get("body") or {}).get("requestHash") if isinstance(response.get("body"), dict) else None)
    )

    text_items = read_layout_texts(str(request_hash)) if isinstance(request_hash, str) else []
    forbidden_hits = find_forbidden_hits(text_items)

    passed = False
    if response.get("status") == 200:
        passed = len(forbidden_hits) == 0 and isinstance(request_hash, str)
    elif response.get("status") == 400:
        passed = has_internal_term_gate_issue(response)

    output = {
        "status": response.get("status"),
        "request_hash": request_hash,
        "forbidden_hit_count": len(forbidden_hits),
        "forbidden_hits": forbidden_hits,
        "blocked_by_internal_term_gate": has_internal_term_gate_issue(response),
        "passed": passed,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

    if not passed:
        sys.exit(1)


if __name__ == "__main__":
    main()


