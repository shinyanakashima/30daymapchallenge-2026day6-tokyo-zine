"""Fetch a small RGB preview of the Tokyo window for several Landsat 4/5 TM scenes.

Source: Landsat Collection 2 Level-2 COGs mirrored by Microsoft Planetary Computer
(identical USGS products, public domain). Output: data/candidates/<id>.png
"""
import json, sys, urllib.request
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from PIL import Image

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2/items/"
SAS = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsateuwest/landsat-c2"
BBOX = (139.55, 35.45, 140.00, 35.82)
OUT = Path(__file__).resolve().parent.parent / "data" / "candidates"


def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def main(ids):
    OUT.mkdir(parents=True, exist_ok=True)
    token = get_json(SAS)["token"]
    for item_id in ids:
        item = get_json(STAC + item_id)
        bands = []
        for key in ("red", "green", "blue"):
            href = item["assets"][key]["href"] + "?" + token
            with rasterio.open(href) as src:
                b = transform_bounds("EPSG:4326", src.crs, *BBOX)
                win = from_bounds(*b, transform=src.transform)
                arr = src.read(1, window=win, out_shape=(int(win.height) // 4, int(win.width) // 4))
            bands.append(arr.astype("float32"))
        rgb = np.stack(bands, -1)
        refl = rgb * 0.0000275 - 0.2
        refl[rgb == 0] = np.nan
        lo, hi = np.nanpercentile(refl, 1), np.nanpercentile(refl, 99)
        img = np.clip((refl - lo) / (hi - lo), 0, 1) ** 0.8
        img = np.nan_to_num(img * 255).astype("uint8")
        Image.fromarray(img).save(OUT / f"{item_id}.png")
        print(item_id, item["properties"]["datetime"], img.shape)


if __name__ == "__main__":
    main(sys.argv[1:])
