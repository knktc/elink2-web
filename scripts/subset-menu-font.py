#!/usr/bin/env python3
"""Regenerate the bundled bitmap subset from the upstream 2026.10.25 BDF ZIP.

Download fusion-pixel-font-12px-proportional-bdf-v2026.10.25.zip from
https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.10.25
then run: python3 scripts/subset-menu-font.py /path/to/archive.zip
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as bundle:
    source = bundle.read("fusion-pixel-12px-proportional-zh_hans.bdf")
    if hashlib.sha256(source).hexdigest() != "06362b84fb05d06c2c5802e303ca65cdcd8a35849c954e29abceab3c6cf10e56":
        raise SystemExit("Unexpected BDF source; use the pinned 2026.10.25 release")
    glyphs = {}
    for block in source.decode().split("STARTCHAR ")[1:]:
        codepoint = int(re.search(r"\nENCODING (\d+)", block)[1])
        character = chr(codepoint)
        try:
            character.encode("gbk")
        except UnicodeEncodeError:
            continue
        if codepoint < 32 or codepoint == 127:
            continue
        advance = int(re.search(r"\nDWIDTH (\d+)", block)[1])
        bounds = [int(value) for value in re.search(r"\nBBX ([^\n]+)", block)[1].split()]
        bitmap = "".join(block.split("BITMAP\n", 1)[1].split("ENDCHAR", 1)[0].split())
        glyphs[character] = [advance, *bounds, bitmap]
    (root / "src/menu-font.json").write_text(
        json.dumps(glyphs, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    licenses = root / "public/menu-font-licenses"
    licenses.mkdir(exist_ok=True)
    for name in ("OFL.txt", "LICENSES/ark-pixel/OFL.txt", "LICENSES/cubic-11/OFL.txt", "LICENSES/galmuri/LICENSE.txt"):
        (licenses / name.replace("/", "-")).write_bytes(bundle.read(name))
    print(f"Wrote {len(glyphs)} bitmap glyphs")
