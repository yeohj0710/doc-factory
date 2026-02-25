from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

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
    )[:10]

    for index, source in enumerate(references, start=1):
        target = images_dir / f"qa-copy-{index:03d}{source.suffix.lower()}"
        target.write_bytes(source.read_bytes())

    created = [path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTS]
    return len(created)


def post_export(payload: dict[str, str]) -> dict[str, Any]:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(EXPORT_URL, data=data, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            _ = response.read(128)
            return {
                "status": response.status,
                "headers": headers,
                "body": None,
            }
    except urllib.error.HTTPError as error:
        raw_body = error.read().decode("utf-8", errors="ignore")
        parsed: dict[str, Any] | None = None
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


def load_layout(request_hash: str) -> dict[str, Any] | None:
    layout_path = JOB_ROOT / request_hash / "layout.json"
    if not layout_path.exists():
        return None

    try:
        return json.loads(layout_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def collect_page_density(page: dict[str, Any]) -> dict[str, Any]:
    text_chars = 0
    text_blocks = 0
    body_font_min_pt: float | None = None

    for element in page.get("elements", []):
        if not isinstance(element, dict):
            continue
        if element.get("type") != "text":
            continue
        if element.get("debugOnly"):
            continue

        role = str(element.get("role") or "")
        if role in {"header"}:
            continue

        text = " ".join(str(element.get("text") or "").split()).strip()
        if not text:
            continue

        text_chars += len(text)
        text_blocks += 1

        element_id = str(element.get("id") or "").lower()
        is_body_like = any(token in element_id for token in ("body", "callout", "table", "flow"))
        if is_body_like:
            font_size = float(element.get("fontSizePt") or 0)
            if body_font_min_pt is None:
                body_font_min_pt = font_size
            else:
                body_font_min_pt = min(body_font_min_pt, font_size)

    return {
        "page_number": page.get("pageNumber"),
        "template": page.get("templateId"),
        "text_chars": text_chars,
        "text_blocks": text_blocks,
        "body_font_min_pt": round(body_font_min_pt or 0, 2),
    }


def run_case(case: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "jobId": case["job_id"],
        "docKind": case["doc_kind"],
        "pageCount": case["page_count"],
        "title": case["title"],
        "prompt": case["prompt"],
        "copywriterMode": "local",
        "variantIndex": "1",
        "seed": case["seed"],
        "language": "ko",
        "tone": "concise",
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
    }

    response = post_export(payload)
    headers = response.get("headers") if isinstance(response.get("headers"), dict) else {}
    body = response.get("body") if isinstance(response.get("body"), dict) else {}

    request_hash = None
    if response.get("status") == 200:
        request_hash = headers.get("x-docfactory-request-hash")
    else:
        request_hash = body.get("requestHash")

    layout = load_layout(str(request_hash)) if isinstance(request_hash, str) else None
    pages = layout.get("pages") if isinstance(layout, dict) else []
    densities = [collect_page_density(page) for page in pages if isinstance(page, dict)]

    min_chars = int(case["threshold"]["min_chars"])
    min_blocks = int(case["threshold"]["min_blocks"])
    min_body_font = float(case["threshold"]["min_body_font_pt"])

    failures = []
    for density in densities:
        if density["text_chars"] < min_chars:
            failures.append({**density, "reason": f"text_chars<{min_chars}"})
            continue
        if density["text_blocks"] < min_blocks:
            failures.append({**density, "reason": f"text_blocks<{min_blocks}"})
            continue
        if float(density["body_font_min_pt"]) < min_body_font:
            failures.append({**density, "reason": f"body_font_min_pt<{min_body_font}"})
            continue

    export_issues = body.get("exportAuditIssues") if isinstance(body.get("exportAuditIssues"), list) else []
    export_issue_messages = []
    for issue in export_issues:
        if not isinstance(issue, dict):
            continue
        message = str(issue.get("message") or "")
        if message:
            export_issue_messages.append(message)
    page_errors = body.get("pageErrors") if isinstance(body.get("pageErrors"), list) else []
    page_error_codes: list[str] = []
    for page_error in page_errors:
        if not isinstance(page_error, dict):
            continue
        issues = page_error.get("issues")
        if not isinstance(issues, list):
            continue
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            code = str(issue.get("code") or "")
            if code:
                page_error_codes.append(code)

    return {
        "name": case["name"],
        "status": response.get("status"),
        "request_hash": request_hash,
        "copywriter_mode": headers.get("x-docfactory-copywriter-mode"),
        "copywriter_cache_hit": headers.get("x-docfactory-copywriter-cache-hit"),
        "copywriter_cache_key": headers.get("x-docfactory-copywriter-cache-key"),
        "threshold": case["threshold"],
        "densities": densities,
        "failures": failures,
        "export_issue_count": len(export_issues),
        "export_issue_messages": export_issue_messages,
        "page_error_count": len(page_errors),
        "page_error_codes": page_error_codes,
        "passed": response.get("status") == 200 and len(densities) > 0 and len(failures) == 0,
    }


def main() -> None:
    ensure_test_images()

    cases = [
        {
            "name": "poster_set_3p",
            "job_id": "qa-copy-density-poster-set",
            "doc_kind": "poster_set",
            "page_count": "exact(3)",
            "title": "QA_CopyDensity_PosterSet",
            "prompt": "포스터 3장으로 핵심 메시지와 실행 항목을 자세히 정리해줘",
            "seed": "561001",
            "threshold": {
                "min_chars": 220,
                "min_blocks": 4,
                "min_body_font_pt": 16,
            },
        },
        {
            "name": "onepager_1p",
            "job_id": "qa-copy-density-onepager",
            "doc_kind": "onepager",
            "page_count": "exact(1)",
            "title": "QA_CopyDensity_Onepager",
            "prompt": "원페이지 문서로 소개와 근거, 다음 단계까지 충분히 작성해줘",
            "seed": "561002",
            "threshold": {
                "min_chars": 180,
                "min_blocks": 4,
                "min_body_font_pt": 12,
            },
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
