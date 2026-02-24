from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TARGET_DIRS = [Path("src"), Path("app")]
PATTERNS = [
    re.compile(r"NATURE_CAMPAIGN", re.IGNORECASE),
    re.compile(r"B2B_BROCHURE", re.IGNORECASE),
    re.compile(r"B2B_SERVICE", re.IGNORECASE),
    re.compile(r"자연을\s*사랑하자"),
    re.compile(r"자연\s*캠페인"),
    re.compile(r"임직원\s*맞춤\s*건기식"),
    re.compile(r"건기식\s*소분"),
]
ALLOWED_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}


def scan_file(path: Path) -> list[dict]:
    hits: list[dict] = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="ignore")

    lines = text.splitlines()
    for index, line in enumerate(lines, start=1):
        for pattern in PATTERNS:
            if not pattern.search(line):
                continue
            hits.append(
                {
                    "file": path.as_posix(),
                    "line": index,
                    "pattern": pattern.pattern,
                    "snippet": line.strip(),
                }
            )
    return hits


def main() -> None:
    findings: list[dict] = []

    for directory in TARGET_DIRS:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            findings.extend(scan_file(path))

    output = {
        "passed": len(findings) == 0,
        "finding_count": len(findings),
        "findings": findings,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

    if findings:
        sys.exit(1)


if __name__ == "__main__":
    main()
