"""Turn the game source (game/block-claim.html, page content only) into a full HTML document
for the Android app and the server. Run after editing the game:

    python3 tools/wrap_game.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "game" / "block-claim.html"
OUT = ROOT / "app" / "src" / "main" / "assets" / "index.html"

HEAD = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);"
    "padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,sans-serif;"
    "background:#f3f6f8}img{max-width:100%}[hidden]{display:none!important}</style></head><body>"
)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(HEAD + SRC.read_text(encoding="utf-8") + "</body></html>", encoding="utf-8")
print(f"Wrote {OUT.relative_to(ROOT)}")
