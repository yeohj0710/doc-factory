from __future__ import annotations

import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
TMP_DIR = Path("tmp")
QUALITY_PATTERN = re.compile(r"\[quality\] v(?P<version>\d+) failedPages=(?P<count>\d+)(?: \((?P<pages>[^)]+)\))?")


def parse_quality(lines: list[str]) -> list[dict]:
    parsed: list[dict] = []
    for line in lines:
        match = QUALITY_PATTERN.search(line)
        if not match:
            continue
        pages_raw = (match.group("pages") or "").strip()
        page_numbers = [token.strip() for token in pages_raw.split(",") if token.strip()]
        parsed.append(
            {
                "version": int(match.group("version")),
                "failed_pages": int(match.group("count")),
                "page_numbers": page_numbers,
                "raw": line,
            }
        )
    return parsed


def inspect(url: str, screenshot_name: str) -> dict:
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(450)

        export_button = page.locator("form[action='/api/export/pptx'] button").first
        disabled = export_button.is_disabled()

        status_text = page.locator(".export-state").first.inner_text()
        regenerate_label = page.locator("button:has-text('Regenerate Layout')").first.inner_text()

        logs = page.locator(".log-line").all_text_contents()
        runtime_log_present = any("[runtime]" in line and "playwright runtime validator ready" in line for line in logs)
        quality = parse_quality(logs)

        failed_cards = page.locator(".preview-state.is-fail").count()

        screenshot_path = TMP_DIR / screenshot_name
        page.screenshot(path=str(screenshot_path), full_page=True)
        browser.close()

    return {
        "url": url,
        "export_button_disabled": disabled,
        "runtime_log_present": runtime_log_present,
        "status_text": status_text,
        "regenerate_button_label": regenerate_label,
        "failed_preview_cards": failed_cards,
        "quality_passes": quality,
        "screenshot": str(screenshot_path),
    }


def main() -> None:
    release = inspect(f"{BASE}/?v=1", "runtime-proof-release.png")
    debug = inspect(f"{BASE}/?v=1&debug=1", "runtime-proof-debug.png")
    tiny = inspect(f"{BASE}/?v=1&size=CUSTOM&w=80&h=80&debug=1", "runtime-proof-tiny.png")

    print(json.dumps({"release": release, "debug": debug, "tiny_custom": tiny}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
