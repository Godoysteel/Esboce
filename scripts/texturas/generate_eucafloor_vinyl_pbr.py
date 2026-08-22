"""Gera mapas PBR dos vinílicos Eucafloor com fonte frontal oficial."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "catalogo" / "revestimentos"
SIZE = 1024
STAGGER_OFFSETS = (0.00, 0.37, 0.74, 0.18, 0.55, 0.92)
PRODUCTS = {
    "003870": {"piece_width_m": 1.219, "piece_height_m": 0.238, "plank": True, "roughness": 0.42},
    "006441": {"piece_width_m": 0.9144, "piece_height_m": 0.9144, "plank": False, "roughness": 0.46},
}


def build_albedo(source: Image.Image, spec: dict) -> Image.Image:
    inset_x = max(1, round(source.width * 0.01))
    inset_y = max(1, round(source.height * 0.01))
    source = source.crop((inset_x, inset_y, source.width - inset_x, source.height - inset_y))
    if not spec["plank"]:
        return source.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    rows = max(1, round(spec["piece_width_m"] / spec["piece_height_m"]))
    canvas = Image.new("RGB", (SIZE, SIZE))
    for row in range(rows):
        y0 = round(row * SIZE / rows)
        y1 = round((row + 1) * SIZE / rows)
        plank = source.resize((SIZE, y1 - y0), Image.Resampling.LANCZOS)
        if row % 2:
            plank = ImageOps.mirror(plank)
        if row % 4 >= 2:
            plank = ImageOps.flip(plank)
        plank = ImageChops.offset(plank, round(STAGGER_OFFSETS[row % len(STAGGER_OFFSETS)] * SIZE), 0)
        canvas.paste(plank, (0, y0))
    return canvas


def derive_maps(albedo: Image.Image, base_roughness: float):
    gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
    dy, dx = np.gradient(gray)
    nx, ny, nz = -dx * 3, dy * 3, np.ones_like(gray)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.dstack((nx / length * .5 + .5, ny / length * .5 + .5, nz / length * .5 + .5))
    smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
    detail = np.clip(np.abs(gray - smooth) * 1.5, 0, .15)
    roughness = np.clip(base_roughness + detail, .25, .72)
    ao = np.clip(.9 + (gray - smooth) * .4, .7, 1)
    return Image.fromarray(np.uint8(normal * 255), "RGB"), Image.fromarray(np.uint8(roughness * 255), "L"), Image.fromarray(np.uint8(ao * 255), "L")


for sku, spec in PRODUCTS.items():
    folder = CATALOG / sku
    source = Image.open(folder / "amostra-frontal-original.jpg").convert("RGB")
    albedo = build_albedo(source, spec)
    normal, roughness, ao = derive_maps(albedo, spec["roughness"])
    output = folder / "pbr"
    output.mkdir(exist_ok=True)
    for name, image in (("albedo", albedo), ("normal", normal), ("roughness", roughness), ("ao", ao)):
        image.save(output / f"{name}.jpg", quality=92, optimize=True)
    print(f"{sku}: módulo físico {spec['piece_width_m']:.4f} x {spec['piece_height_m']:.4f} m")
