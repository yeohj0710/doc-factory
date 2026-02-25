from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = "http://127.0.0.1:3000"
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
        target = images_dir / f"qa-density-{index:03d}{source.suffix.lower()}"
        target.write_bytes(source.read_bytes())

    created = [path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTS]
    return len(created)


def latest_job() -> tuple[str | None, float]:
    if not JOB_ROOT.exists():
        return None, 0.0

    candidates: list[tuple[float, str]] = []
    for child in JOB_ROOT.iterdir():
        if not child.is_dir():
            continue
        layout = child / "layout.json"
        if not layout.exists():
            continue
        candidates.append((layout.stat().st_mtime, child.name))

    if not candidates:
        return None, 0.0

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1], candidates[0][0]


def trigger_regenerate(params: dict[str, str]) -> None:
    query = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{BASE_URL}/?{query}", timeout=600) as response:
        response.read(4096)


def element_area(element: dict[str, Any]) -> float:
    if element.get("type") == "line":
        return 0.0
    return max(0.0, float(element.get("wMm", 0) or 0) * float(element.get("hMm", 0) or 0))


def density_group_key(element: dict[str, Any], index: int) -> str:
    collision = str(element.get("collisionGroup") or "").strip()
    if collision:
        return collision
    element_id = str(element.get("id") or "").strip()
    if element_id:
        return element_id
    return f"{element.get('type', 'unknown')}-{index}"


def page_density(page: dict[str, Any]) -> dict[str, Any]:
    width = max(1.0, float(page.get("widthMm", 1) or 1))
    height = max(1.0, float(page.get("heightMm", 1) or 1))
    page_area = width * height

    text_chars = 0
    groups: dict[str, float] = {}

    for idx, element in enumerate(page.get("elements", [])):
        if not isinstance(element, dict):
            continue
        if element.get("debugOnly") is True:
            continue

        role = str(element.get("role") or "")
        if role in {"background", "header", "footer", "decorative"}:
            continue

        if element.get("type") == "text":
            text = str(element.get("text") or "")
            text_chars += len(" ".join(text.split()))

        area = element_area(element)
        if area <= 0:
            continue
        key = density_group_key(element, idx)
        groups[key] = max(groups.get(key, 0.0), area)

    coverage = sum(groups.values()) / page_area
    return {
        "page_number": page.get("pageNumber"),
        "role": str(page.get("pageRole") or ""),
        "template": str(page.get("templateId") or ""),
        "text_chars": text_chars,
        "coverage_ratio": round(coverage, 4),
        "content_groups": len(groups),
    }


def validate_page(density: dict[str, Any]) -> tuple[bool, str | None]:
    role = density["role"].lower()
    template = density["template"].upper()
    text_chars = int(density["text_chars"])
    coverage = float(density["coverage_ratio"])
    groups = int(density["content_groups"])

    if template == "SECTION_DIVIDER" or role == "section-divider":
        if text_chars < 70 or coverage < 0.22 or groups < 3:
            return False, "section-divider density below threshold"
        return True, None

    if role == "text-only":
        if text_chars < 78 or coverage < 0.22 or groups < 3:
            return False, "text-only density below threshold"
        return True, None

    if text_chars < 58 or coverage < 0.18 or groups < 2:
        return False, "general density below threshold"

    return True, None


def main() -> None:
    image_count = ensure_test_images()
    _before_hash, _before_mtime = latest_job()

    query = {
        "jobId": "qa-density-brochure",
        "docKind": "brochure",
        "pageCount": "exact(8)",
        "title": "QA_Density_Brochure",
        "prompt": "한국어 브로슈어 소개서 생성",
        "contentBrief": "서비스 가치와 실행 근거 중심으로 구성",
        "language": "ko",
        "tone": "concise",
        "variantIndex": "1",
        "seed": "92001",
        "debug": "1",
    }

    trigger_regenerate(query)

    request_hash, _request_mtime = latest_job()
    if not request_hash:
        print(json.dumps({"passed": False, "reason": "no new layout artifact"}, ensure_ascii=False, indent=2))
        sys.exit(1)

    layout_path = JOB_ROOT / request_hash / "layout.json"
    if not layout_path.exists():
        print(json.dumps({"passed": False, "reason": "layout artifact missing", "request_hash": request_hash}, ensure_ascii=False, indent=2))
        sys.exit(1)

    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    pages = layout.get("pages", []) if isinstance(layout, dict) else []

    densities = []
    failures = []
    density_issues = []

    for page in pages:
        if not isinstance(page, dict):
            continue

        density = page_density(page)
        densities.append(density)

        meta = page.get("meta") if isinstance(page.get("meta"), dict) else {}
        validation = meta.get("validation") if isinstance(meta.get("validation"), dict) else {}
        issues = validation.get("issues") if isinstance(validation.get("issues"), list) else []
        has_density_issue = any(isinstance(issue, dict) and issue.get("code") == "content-density" for issue in issues)
        if has_density_issue:
            density_issues.append(page.get("pageNumber"))

        passed, reason = validate_page(density)
        if not passed:
            failures.append({
                "page_number": density["page_number"],
                "role": density["role"],
                "template": density["template"],
                "reason": reason,
                "text_chars": density["text_chars"],
                "coverage_ratio": density["coverage_ratio"],
                "content_groups": density["content_groups"],
            })

    passed = len(failures) == 0 and len(density_issues) == 0 and len(densities) >= 4

    print(
        json.dumps(
            {
                "passed": passed,
                "request_hash": request_hash,
                "image_count": image_count,
                "page_count": len(densities),
                "density_issues": density_issues,
                "failures": failures,
                "densities": densities,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    if not passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
