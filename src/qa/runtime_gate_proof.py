from __future__ import annotations

import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"


def inspect(url: str) -> dict:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")

        export_button = page.locator("button:has-text('Export PPTX')").first
        disabled = export_button.is_disabled()

        logs = page.locator(".page-card .page-brief .page-brief-line").all_text_contents()
        runtime_log_present = any("[runtime]" in line and "playwright runtime validator ready" in line for line in logs)

        status_text = page.locator(".status-panel").inner_text()

        browser.close()

    return {
        "url": url,
        "export_button_disabled": disabled,
        "runtime_log_present": runtime_log_present,
        "status_text": status_text,
    }


def main() -> None:
    normal = inspect(f"{BASE}/?v=1")
    tiny = inspect(f"{BASE}/?v=1&size=CUSTOM&w=80&h=80")

    print(json.dumps({"normal": normal, "tiny_custom": tiny}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
