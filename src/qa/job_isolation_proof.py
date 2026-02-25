from __future__ import annotations

import hashlib
import json
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
    url = f"{BASE_URL}/?{query}"
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
                "request_hash": headers.get("x-docfactory-request-hash"),
                "audit_hash": headers.get("x-docfactory-audit-hash"),
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
            "request_hash": (parsed or {}).get("requestHash"),
            "audit_hash": (parsed or {}).get("exportAuditHash"),
            "body": parsed,
        }


def sha256_file(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def qa_payload(job_id: str, seed: str) -> dict[str, str]:
    return {
        "jobId": job_id,
        "docKind": "brochure",
        "pageCount": "exact(2)",
        "title": "QA_Job_Isolation",
        "language": "ko",
        "tone": "concise",
        "constraints": "no-fabricated-numbers,bullet-centric-copy",
        "variantIndex": "1",
        "seed": seed,
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
    }


def job_files(request_hash: str) -> tuple[Path, Path]:
    job_dir = JOB_ROOT / request_hash
    return job_dir / "layout.json", job_dir / "export-audit.json"


def main() -> None:
    ensure_test_images()
    payload_a = qa_payload("qa-job-a", "11111")
    payload_b = qa_payload("qa-job-b", "22222")

    trigger_regenerate(
        {
            "jobId": payload_a["jobId"],
            "docKind": payload_a["docKind"],
            "pageCount": payload_a["pageCount"],
            "title": payload_a["title"],
            "variantIndex": payload_a["variantIndex"],
            "seed": payload_a["seed"],
            "size": "A4P",
        }
    )
    run_a = post_export(payload_a)

    hash_a = run_a.get("request_hash")
    layout_a_before = None
    audit_a_before = None
    if isinstance(hash_a, str):
        layout_file_a, audit_file_a = job_files(hash_a)
        layout_a_before = sha256_file(layout_file_a)
        audit_a_before = sha256_file(audit_file_a)

    trigger_regenerate(
        {
            "jobId": payload_b["jobId"],
            "docKind": payload_b["docKind"],
            "pageCount": payload_b["pageCount"],
            "title": payload_b["title"],
            "variantIndex": payload_b["variantIndex"],
            "seed": payload_b["seed"],
            "size": "A4P",
        }
    )
    run_b = post_export(payload_b)

    hash_b = run_b.get("request_hash")

    layout_a_after = None
    audit_a_after = None
    layout_b_exists = False
    audit_b_exists = False
    layout_a_hash_matches = False
    layout_b_hash_matches = False

    if isinstance(hash_a, str):
        layout_file_a, audit_file_a = job_files(hash_a)
        layout_a_after = sha256_file(layout_file_a)
        audit_a_after = sha256_file(audit_file_a)
        if layout_file_a.exists():
            try:
                parsed = json.loads(layout_file_a.read_text(encoding="utf-8"))
                layout_a_hash_matches = (parsed.get("params") or {}).get("requestHash") == hash_a
            except json.JSONDecodeError:
                layout_a_hash_matches = False

    if isinstance(hash_b, str):
        layout_file_b, audit_file_b = job_files(hash_b)
        layout_b_exists = layout_file_b.exists()
        audit_b_exists = audit_file_b.exists()
        if layout_file_b.exists():
            try:
                parsed = json.loads(layout_file_b.read_text(encoding="utf-8"))
                layout_b_hash_matches = (parsed.get("params") or {}).get("requestHash") == hash_b
            except json.JSONDecodeError:
                layout_b_hash_matches = False

    output = {
        "run_a": run_a,
        "run_b": run_b,
        "hashes_different": isinstance(hash_a, str) and isinstance(hash_b, str) and hash_a != hash_b,
        "job_a_files_stable": layout_a_before is not None and audit_a_before is not None and layout_a_before == layout_a_after and audit_a_before == audit_a_after,
        "job_b_files_exist": layout_b_exists and audit_b_exists,
        "layout_a_hash_matches": layout_a_hash_matches,
        "layout_b_hash_matches": layout_b_hash_matches,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

