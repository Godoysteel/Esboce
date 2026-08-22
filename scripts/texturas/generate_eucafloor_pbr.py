"""Gera mapas PBR dos laminados Eucafloor com fonte frontal oficial."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "catalogo" / "revestimentos"
SIZE = 1024
PRODUCTS = {
    "003712": {"plank_width_m": 0.357, "roughness": 0.34},
    "000359": {"plank_width_m": 0.292, "roughness": 0.38},
    "003193": {"plank_width_m": 0.292, "roughness": 0.38},
    "003423": {"plank_width_m": 0.217, "roughness": 0.4},
    "003898": {"plank_width_m": 0.217, "roughness": 0.4},
    "005813": {"plank_width_m": 0.217, "roughness": 0.4},
    "006316": {"plank_width_m": 0.217, "roughness": 0.4},
    "001142": {"plank_width_m": 0.217, "roughness": 0.4},
}


def build_albedo(source: Image.Image, plank_width_m: float) -> Image.Image:
    rows = max(1, round(1.357 / plank_width_m))
    row_height = SIZE // rows
    joint = max(1, round(SIZE * 0.0015 / 1.357))
    source = source.resize((SIZE, row_height - joint), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), (75, 66, 56))
    for row in range(rows):
        canvas.paste(source, (0, row * row_height + joint // 2))
    return canvas


def derive_maps(albedo: Image.Image, base_roughness: float):
    gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
    dy, dx = np.gradient(gray)
    nx, ny, nz = -dx * 4, dy * 4, np.ones_like(gray)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.dstack((nx / length * .5 + .5, ny / length * .5 + .5, nz / length * .5 + .5))
    smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
    detail = np.clip(np.abs(gray - smooth) * 1.8, 0, .18)
    roughness = np.clip(base_roughness + detail, .2, .7)
    ao = np.clip(.88 + (gray - smooth) * .5, .65, 1)
    return Image.fromarray(np.uint8(normal * 255), "RGB"), Image.fromarray(np.uint8(roughness * 255), "L"), Image.fromarray(np.uint8(ao * 255), "L")


for sku, spec in PRODUCTS.items():
    folder = CATALOG / sku
    source = Image.open(folder / "amostra-frontal-original.jpg").convert("RGB")
    albedo = build_albedo(source, spec["plank_width_m"])
    normal, roughness, ao = derive_maps(albedo, spec["roughness"])
    output = folder / "pbr"
    output.mkdir(exist_ok=True)
    for name, image in (("albedo", albedo), ("normal", normal), ("roughness", roughness), ("ao", ao)):
        image.save(output / f"{name}.jpg", quality=92, optimize=True)
    print(f"{sku}: módulo físico 1.357 x {spec['plank_width_m']:.3f} m")
