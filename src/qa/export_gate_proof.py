from __future__ import annotations

import json
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:3000/api/export/pptx"


def post_form(payload: dict[str, str]) -> dict:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(BASE, data=data, method="POST")

    try:
      with urllib.request.urlopen(request, timeout=120) as response:
          headers = {key.lower(): value for key, value in response.headers.items()}
          return {
              "status": response.status,
              "content_type": headers.get("content-type"),
              "content_disposition": headers.get("content-disposition"),
          }
    except urllib.error.HTTPError as error:
      body = error.read().decode("utf-8", errors="ignore")
      return {
          "status": error.code,
          "body": body,
      }


def main() -> None:
    normal = post_form(
        {
            "variantIndex": "1",
            "docType": "proposal",
            "pageSizePreset": "A4P",
            "pageWidthMm": "210",
            "pageHeightMm": "297",
        }
    )
    blocked = post_form(
        {
            "variantIndex": "1",
            "docType": "proposal",
            "pageSizePreset": "CUSTOM",
            "pageWidthMm": "80",
            "pageHeightMm": "80",
        }
    )

    print(json.dumps({"normal_export": normal, "blocked_export": blocked}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
