"""
Builds public/fonts/NotoSans-{Regular,Bold}.ttf for the PDF export.

Stock Noto Sans has no Mathematical Operators (≥ ≤ ≠ ±…) or Arrows: since
the 2.x split, those live in Noto Sans Math, which in turn has no – or •.
jsPDF draws a cell in one font and has no per-glyph fallback, so this
copies U+2190–U+22FF from Noto Sans Math into each Noto Sans weight,
wherever Noto Sans lacks the code point. Both fonts are 1000 units per em
with TrueType outlines, so glyphs copy as they are. Noto Sans Math has a
Regular weight only; Bold gets the same glyphs.

The result stays under the SIL Open Font License 1.1 (public/fonts/OFL.txt).
Noto declares no Reserved Font Name, so the modified fonts may keep theirs.

    python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools
    /tmp/fonttools/bin/python scripts/fonts/build-pdf-fonts.py
"""

import copy
import io
import pathlib
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.ttProgram import Program

NOTO = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts"
SANS = NOTO + "/NotoSans/unhinted/ttf/NotoSans-{}.ttf"
MATH = NOTO + "/NotoSansMath/unhinted/ttf/NotoSansMath-Regular.ttf"
BLOCKS = range(0x2190, 0x2300)  # Arrows, Mathematical Operators
OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "fonts"


def fetch(url: str) -> TTFont:
    with urllib.request.urlopen(url) as r:
        return TTFont(io.BytesIO(r.read()), lazy=False)


def merge(sans: TTFont, math: TTFont) -> list[int]:
    sans_cmap = sans.getBestCmap()
    math_cmap = math.getBestCmap()
    wanted = [cp for cp in BLOCKS if cp in math_cmap and cp not in sans_cmap]

    order = sans.getGlyphOrder()
    taken = set(order)
    renamed: dict[str, str] = {}

    def copy_glyph(name: str) -> str:
        """Copies one glyph and, first, any components; returns its new name."""
        if name in renamed:
            return renamed[name]
        glyph = copy.deepcopy(math["glyf"][name])
        if glyph.isComposite():
            for c in glyph.components:
                c.glyphName = copy_glyph(c.glyphName)
        if hasattr(glyph, "program"):
            glyph.program = Program()  # Unhinted source; keep it that way.
            glyph.program.fromBytecode(b"")
        new = name if name not in taken else f"math.{name}"
        renamed[name] = new
        taken.add(new)
        order.append(new)
        sans["glyf"][new] = glyph
        sans["hmtx"][new] = math["hmtx"][name]
        return new

    added = {cp: copy_glyph(math_cmap[cp]) for cp in wanted}

    sans.setGlyphOrder(order)
    sans["glyf"].setGlyphOrder(order)
    for table in sans["cmap"].tables:
        if table.isUnicode():
            for cp, name in added.items():
                if table.format != 4 or cp <= 0xFFFF:
                    table.cmap[cp] = name

    name = sans["name"]
    version = name.getDebugName(5)
    name.setName(
        f"{version}; with U+2190-22FF from Noto Sans Math {math['name'].getDebugName(5)}",
        5, 3, 1, 0x409,
    )
    return wanted


def main() -> None:
    math = fetch(MATH)
    for weight in ("Regular", "Bold"):
        sans = fetch(SANS.format(weight))
        added = merge(sans, math)
        path = OUT / f"NotoSans-{weight}.ttf"
        sans.save(path)
        print(f"{path.name}: +{len(added)} code points, {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
