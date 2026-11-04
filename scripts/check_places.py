"""Check that every place label lies inside the image and that water labels sit on water.

Reads src/data/places.json and public/data/manifest.json + tokyo-landsat.jpg.
Water test: mean RGB of a 3x3 window must be darker than the land threshold.
Usage: python3 -I scripts/check_places.py
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
man = json.loads((ROOT / "public/data/manifest.json").read_text())
places = json.loads((ROOT / "src/data/places.json").read_text())["places"]
img = np.asarray(Image.open(ROOT / "public" / man["processing"]["output"]["file"])).astype(float)
H, W = img.shape[:2]
(w, n), _, (e, s), _ = man["coordinates"]
my = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))
WATER_MAX = 110  # mean 0-255 brightness; land in this stretch is ~120-200

ok = True
for p in places:
    x = (p["lng"] - w) / (e - w) * W
    y = (my(n) - my(p["lat"])) / (my(n) - my(s)) * H
    inside = 0 <= x < W and 0 <= y < H
    v = img[int(y) - 1:int(y) + 2, int(x) - 1:int(x) + 2].mean() if inside else float("nan")
    water = p["kind"] in ("river", "water body")
    good = inside and (v < WATER_MAX if water else True)
    ok &= good
    print(f"{'OK ' if good else 'NG '} {p['no']} {p['name']:<16} px=({x:7.1f},{y:7.1f}) brightness={v:6.1f}{'  water' if water else ''}")
sys.exit(0 if ok else 1)
