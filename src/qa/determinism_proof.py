from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "http://127.0.0.1:3000"
EXPORT_URL = f"{BASE_URL}/api/export/pptx"


def trigger_regenerate(variant: int) -> None:
    url = f"{BASE_URL}/?v={variant}"
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
                "reference_digest": headers.get("x-docfactory-reference-digest"),
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
            "reference_digest": None,
            "reference_status": (parsed or {}).get("referenceUsageReport", {}).get("referenceIndexStatus"),
            "body": parsed,
        }


def export_payload(variant_index: int) -> dict[str, str]:
    return {
        "variantIndex": str(variant_index),
        "docType": "proposal",
        "pageSizePreset": "A4P",
        "pageWidthMm": "210",
        "pageHeightMm": "297",
    }


def main() -> None:
    trigger_regenerate(1)

    scan_results: dict[str, dict] = {}
    successful_variants: list[int] = []

    for variant in range(1, 11):
        result = post_export(export_payload(variant))
        scan_results[f"v{variant}"] = result
        if result.get("status") == 200 and result.get("audit_hash"):
            successful_variants.append(variant)
        if len(successful_variants) >= 2:
            break

    if successful_variants:
        base_variant = successful_variants[0]
    else:
        base_variant = 1

    run_a = post_export(export_payload(base_variant))
    run_b = post_export(export_payload(base_variant))

    if len(successful_variants) >= 2:
        compare_variant = successful_variants[1]
    else:
        compare_variant = base_variant + 1
    run_c = post_export(export_payload(compare_variant))

    same_variant_same_hash = (
        run_a.get("audit_hash") is not None
        and run_a.get("audit_hash") == run_b.get("audit_hash")
    )

    variant_change_changes_hash = (
        run_a.get("audit_hash") is not None
        and run_c.get("audit_hash") is not None
        and run_a.get("audit_hash") != run_c.get("audit_hash")
    )

    gates_kept_for_variants = (
        run_a.get("status") == 200
        and run_b.get("status") == 200
        and run_c.get("status") == 200
    )

    output = {
        "selected_base_variant": base_variant,
        "selected_compare_variant": compare_variant,
        "scan_results": scan_results,
        "run_a": run_a,
        "run_b": run_b,
        "run_c": run_c,
        "same_variant_same_hash": same_variant_same_hash,
        "variant_change_changes_hash": variant_change_changes_hash,
        "gates_kept_for_variants": gates_kept_for_variants,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
