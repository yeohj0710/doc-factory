from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"


def trigger_regenerate(params: dict[str, str]) -> None:
    query = urllib.parse.urlencode(params)
    url = f"{BASE_URL}/?{query}"
    with urllib.request.urlopen(url, timeout=180) as response:
        response.read(2048)


def post_export(payload: dict[str, str]) -> dict:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(EXPORT_URL, data=data, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            _ = response.read(64)
            return {
                "status": response.status,
                "audit_hash": headers.get("x-docfactory-audit-hash"),
                "request_hash": headers.get("x-docfactory-request-hash"),
                "reference_status": headers.get("x-docfactory-reference-index-status"),
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
            "audit_hash": (parsed or {}).get("exportAuditHash"),
            "request_hash": (parsed or {}).get("requestHash"),
            "reference_status": (parsed or {}).get("referenceUsageReport", {}).get("referenceIndexStatus"),
            "body": parsed,
        }


def qa_payload() -> dict[str, str]:
    return {
        "jobId": "qa-determinism-1",
        "docKind": "brochure",
        "pageCount": "exact(2)",
        "title": "QA_Determinism",
        "language": "ko",
        "tone": "concise",
        "constraints": "no-fabricated-numbers,bullet-centric-copy",
        "variantIndex": "1",
        "seed": "424242",
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
    }


def main() -> None:
    payload = qa_payload()

    trigger_regenerate(
        {
            "jobId": payload["jobId"],
            "docKind": payload["docKind"],
            "pageCount": payload["pageCount"],
            "title": payload["title"],
            "variantIndex": payload["variantIndex"],
            "seed": payload["seed"],
            "size": "A4P",
        }
    )

    run_a = post_export(payload)
    run_b = post_export(payload)

    same_request_hash = (
        run_a.get("request_hash") is not None
        and run_a.get("request_hash") == run_b.get("request_hash")
    )

    same_audit_hash = (
        run_a.get("audit_hash") is not None
        and run_a.get("audit_hash") == run_b.get("audit_hash")
    )

    output = {
        "run_a": run_a,
        "run_b": run_b,
        "same_request_hash": same_request_hash,
        "same_audit_hash": same_audit_hash,
        "determinism_passed": run_a.get("status") == 200 and run_b.get("status") == 200 and same_request_hash and same_audit_hash,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
