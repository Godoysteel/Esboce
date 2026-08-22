"""Gera mapas PBR de teste a partir das amostras frontais oficiais Ceral.

Os mapas preservam a cor oficial, acrescentam uma junta neutra de 2 mm e
derivam normal/roughness/AO apenas da luminância da própria amostra. O SKU
000317 usa um atlas quadrado de 203 x 203 mm com duas peças 203 x 102 mm.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "catalogo" / "revestimentos"
SIZE = 512

PRODUCTS = {
    "003230": {"width_m": 0.43, "height_m": 0.43, "roughness": 0.48},
    "003231": {"width_m": 0.43, "height_m": 0.43, "roughness": 0.48},
    "003229": {"width_m": 0.433, "height_m": 0.433, "roughness": 0.18},
    "000317": {"width_m": 0.203, "height_m": 0.102, "roughness": 0.2, "rows": 2},
    "000291": {"width_m": 0.099, "height_m": 0.099, "roughness": 0.18},
    "000300": {"width_m": 0.099, "height_m": 0.099, "roughness": 0.18},
    "000287": {"width_m": 0.099, "height_m": 0.099, "roughness": 0.12},
    "000279": {"width_m": 0.099, "height_m": 0.099, "roughness": 0.12},
}


def fit_piece(source: Image.Image, width: int, height: int) -> Image.Image:
    source_ratio = source.width / source.height
    target_ratio = width / height
    if source_ratio > target_ratio:
        crop_width = round(source.height * target_ratio)
        left = (source.width - crop_width) // 2
        source = source.crop((left, 0, left + crop_width, source.height))
    elif source_ratio < target_ratio:
        crop_height = round(source.width / target_ratio)
        top = (source.height - crop_height) // 2
        source = source.crop((0, top, source.width, top + crop_height))
    return source.resize((width, height), Image.Resampling.LANCZOS)


def build_albedo(source: Image.Image, spec: dict) -> Image.Image:
    rows = spec.get("rows", 1)
    piece_height = SIZE // rows
    grout_px = max(2, round(SIZE * 0.002 / spec["width_m"]))
    canvas = Image.new("RGB", (SIZE, SIZE), (118, 116, 110))
    for row in range(rows):
        tile = fit_piece(source, SIZE - grout_px, piece_height - grout_px)
        canvas.paste(tile, (grout_px // 2, row * piece_height + grout_px // 2))
    return canvas


def derive_maps(albedo: Image.Image, base_roughness: float):
    gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) / 255.0
    dy, dx = np.gradient(gray)
    strength = 7.0
    nx, ny = -dx * strength, dy * strength
    nz = np.ones_like(gray)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.dstack(((nx / length * 0.5 + 0.5), (ny / length * 0.5 + 0.5), (nz / length * 0.5 + 0.5)))

    smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(5)), dtype=np.float32) / 255.0
    detail = np.clip(np.abs(gray - smooth) * 2.5, 0, 0.22)
    roughness = np.clip(base_roughness + detail, 0.08, 0.75)
    ao = np.clip(0.82 + (gray - smooth) * 0.8, 0.55, 1.0)
    return (
        Image.fromarray(np.uint8(normal * 255), "RGB"),
        Image.fromarray(np.uint8(roughness * 255), "L"),
        Image.fromarray(np.uint8(ao * 255), "L"),
    )


for sku, spec in PRODUCTS.items():
    folder = CATALOG / sku
    source = Image.open(folder / "miniatura-original.jpeg").convert("RGB")
    albedo = build_albedo(source, spec)
    normal, roughness, ao = derive_maps(albedo, spec["roughness"])
    pbr = folder / "pbr"
    pbr.mkdir(exist_ok=True)
    albedo.save(pbr / "albedo.jpg", quality=92, optimize=True)
    normal.save(pbr / "normal.jpg", quality=90, optimize=True)
    roughness.save(pbr / "roughness.jpg", quality=90, optimize=True)
    ao.save(pbr / "ao.jpg", quality=90, optimize=True)
    print(f"{sku}: {spec['width_m']:.3f} x {spec['height_m']:.3f} m")
