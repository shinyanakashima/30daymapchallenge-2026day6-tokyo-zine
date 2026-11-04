"""Build the display RGB image and manifest for TOKYO MAP (Day 6 Vintage).

Steps
  1. Read SR_B3 / SR_B2 / SR_B1 / QA_PIXEL of one Landsat 5 TM C2 L2 scene
     (cloud-optimised GeoTIFF, EPSG:32654, 30 m) for the window BBOX only.
  2. Convert DN to surface reflectance (DN * 0.0000275 - 0.2), nodata = 0.
  3. Natural-colour composite R=B3 G=B2 B=B1, one linear percentile stretch shared
     by all three bands (keeps the colour balance) + gamma.
  4. Reproject to EPSG:3857 (MapLibre display CRS) with bilinear resampling,
     snap to the lon/lat BBOX, and write public/data/tokyo-landsat.jpg.
  5. Write public/data/manifest.json (scene metadata + processing record).

Usage: python3 -I scripts/build_rgb.py
"""
import json, urllib.request, datetime as dt
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import transform_bounds, reproject, Resampling
from rasterio.windows import from_bounds
from rasterio.transform import from_bounds as tf_from_bounds
from PIL import Image

ITEM_ID = "LT05_L2SP_107035_19870521_02_T1"
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2/items/"
USGS_STAC = "https://landsatlook.usgs.gov/stac-server/collections/landsat-c2l2-sr/items/"
SAS = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsateuwest/landsat-c2"
BBOX = (139.55, 35.45, 140.00, 35.82)  # W, S, E, N (EPSG:4326)
SCALE, OFFSET = 0.0000275, -0.2
P_LO, P_HI, GAMMA = 0.5, 99.5, 0.85
ROOT = Path(__file__).resolve().parent.parent
OUT_IMG = ROOT / "public" / "data" / "tokyo-landsat.jpg"
OUT_MANIFEST = ROOT / "public" / "data" / "manifest.json"


def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def main():
    item = get_json(STAC + ITEM_ID)
    token = get_json(SAS)["token"]
    props = item["properties"]

    def read(key):
        with rasterio.open(item["assets"][key]["href"] + "?" + token) as src:
            b = transform_bounds("EPSG:4326", src.crs, *BBOX, densify_pts=21)
            win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
            return src.read(1, window=win), src.window_transform(win), src.crs

    r, tr, crs = read("red")
    g, _, _ = read("green")
    b, _, _ = read("blue")
    qa, _, _ = read("qa_pixel")

    nodata = (r == 0) | (g == 0) | (b == 0)
    # QA_PIXEL bits: 1 dilated cloud, 3 cloud, 4 cloud shadow
    cloudy = ((qa >> 1) & 1) | ((qa >> 3) & 1) | ((qa >> 4) & 1)
    valid = ~nodata
    cloud_pct = float(cloudy[valid].mean() * 100)

    refl = np.stack([r, g, b]).astype("float32") * SCALE + OFFSET
    refl[:, nodata] = np.nan
    lo = float(np.nanpercentile(refl, P_LO))
    hi = float(np.nanpercentile(refl, P_HI))
    img = np.clip((refl - lo) / (hi - lo), 0, 1) ** GAMMA
    img = np.nan_to_num(img, nan=0.0).astype("float32")

    # reproject to Web Mercator, snapped to BBOX
    mb = transform_bounds("EPSG:4326", "EPSG:3857", *BBOX)
    res = 30.0 / np.cos(np.radians((BBOX[1] + BBOX[3]) / 2))  # ~30 m on the ground
    W = int(round((mb[2] - mb[0]) / res))
    H = int(round((mb[3] - mb[1]) / res))
    dst_tr = tf_from_bounds(*mb, W, H)
    out = np.zeros((3, H, W), "float32")
    for i in range(3):
        reproject(img[i], out[i], src_transform=tr, src_crs=crs,
                  dst_transform=dst_tr, dst_crs="EPSG:3857", resampling=Resampling.bilinear)
    rgb = (np.moveaxis(out, 0, -1) * 255).round().astype("uint8")
    OUT_IMG.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb).save(OUT_IMG, quality=90, optimize=True, progressive=True)

    w, s, e, n = BBOX
    manifest = {
        "title": "TOKYO MAP — Landsat 5 TM natural-colour composite",
        "scene": {
            "product_id": "LT05_L2SP_107035_19870521_20201014_02_T1",
            "landsat_scene_id": props["landsat:scene_id"],
            "satellite": props["platform"].replace("landsat-", "Landsat "),
            "sensor": "Thematic Mapper (TM)",
            "acquired_utc": props["datetime"][:19] + "Z",
            "acquired_date": props["datetime"][:10],
            "wrs_path_row": f"{props['landsat:wrs_path']}/{props['landsat:wrs_row']}",
            "scene_cloud_cover_pct": props["eo:cloud_cover"],
            "window_cloud_pct_qa_pixel": round(cloud_pct, 3),
            "sun_elevation_deg": round(props["view:sun_elevation"], 2),
            "processing_level": "Collection 2 Level-2 Surface Reflectance (L2SP), Tier 1",
            "source_crs": f"EPSG:{props['proj:epsg']}",
            "native_resolution_m": 30,
            "doi": props["sci:doi"],
            "usgs_stac": USGS_STAC + "LT05_L2SP_107035_19870521_20201014_02_T1_SR",
            "data_access": "Microsoft Planetary Computer mirror of USGS Landsat C2 L2 (STAC item " + ITEM_ID + ")",
        },
        "processing": {
            "bands": {"R": "SR_B3 (0.63-0.69 µm)", "G": "SR_B2 (0.52-0.60 µm)", "B": "SR_B1 (0.45-0.52 µm)"},
            "composite": "natural colour (no near-infrared)",
            "reflectance": f"DN * {SCALE} + ({OFFSET}); DN 0 = nodata",
            "stretch": f"shared linear stretch {P_LO}-{P_HI} percentile ({lo:.4f}-{hi:.4f} reflectance), gamma {GAMMA}",
            "reprojection": "EPSG:32654 -> EPSG:3857, bilinear",
            "crop_bbox_wgs84": list(BBOX),
            "output": {"file": "data/tokyo-landsat.jpg", "width": W, "height": H, "format": "JPEG q90"},
            "notes": "Colours are a display stretch of surface reflectance, not calibrated true colour. 30 m pixels: individual buildings are not resolvable.",
        },
        "coordinates": [[w, n], [e, n], [e, s], [w, s]],
        "credit": "Landsat 5 TM imagery courtesy of the U.S. Geological Survey / NASA Landsat Program",
        "license": "Public domain (USGS Landsat data have no restrictions on use)",
        "retrieved": dt.date.today().isoformat(),
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"W": W, "H": H, "cloud_pct": cloud_pct, "lo": lo, "hi": hi}))


if __name__ == "__main__":
    main()
