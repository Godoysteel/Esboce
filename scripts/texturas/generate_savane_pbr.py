"""Gera mapas PBR para porcelanatos Savane com amostra frontal validada."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "catalogo" / "revestimentos"
SIZE = 1024

PRODUCTS = {
    "000333": {"width_m": 0.91, "height_m": 0.91, "roughness": 0.52},
    "000253": {"width_m": 0.91, "height_m": 0.91, "roughness": 0.5},
    "006558": {"width_m": 1.13, "height_m": 0.18, "roughness": 0.68, "plank": True},
}


def fit_square(source: Image.Image) -> Image.Image:
    side = min(source.width, source.height)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    return source.crop((left, top, left + side, top + side)).resize(
        (SIZE, SIZE), Image.Resampling.LANCZOS
    )


def build_plank_atlas(source: Image.Image) -> Image.Image:
    gray = np.asarray(source.convert("L"))
    mask = gray < 245
    ys, xs = np.where(mask)
    source = source.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    if source.height > source.width:
        source = source.transpose(Image.Transpose.ROTATE_90)
    rows = 6
    offsets = (0.0, 0.37, 0.74, 0.18, 0.55, 0.92)
    canvas = Image.new("RGB", (SIZE, SIZE))
    for row in range(rows):
        y0 = round(row * SIZE / rows)
        y1 = round((row + 1) * SIZE / rows)
        plank = source.resize((SIZE, y1 - y0), Image.Resampling.LANCZOS)
        if row % 2:
            plank = ImageOps.mirror(plank)
        plank = ImageChops.offset(plank, round(offsets[row] * SIZE), 0)
        canvas.paste(plank, (0, y0))
    return canvas


def derive_maps(albedo: Image.Image, base_roughness: float):
    gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.9)), dtype=np.float32) / 255.0
    dy, dx = np.gradient(gray)
    strength = 4.5
    nx, ny = -dx * strength, dy * strength
    nz = np.ones_like(gray)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.dstack((nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, nz / length * 0.5 + 0.5))

    smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(7)), dtype=np.float32) / 255.0
    detail = np.clip(np.abs(gray - smooth) * 1.8, 0, 0.16)
    roughness = np.clip(base_roughness + detail, 0.35, 0.76)
    ao = np.clip(0.9 + (gray - smooth) * 0.45, 0.72, 1.0)
    return (
        Image.fromarray(np.uint8(normal * 255), "RGB"),
        Image.fromarray(np.uint8(roughness * 255), "L"),
        Image.fromarray(np.uint8(ao * 255), "L"),
    )


for sku, spec in PRODUCTS.items():
    folder = CATALOG / sku
    source = Image.open(folder / "amostra-frontal-original.jpg").convert("RGB")
    albedo = build_plank_atlas(source) if spec.get("plank") else fit_square(source)
    normal, roughness, ao = derive_maps(albedo, spec["roughness"])
    pbr = folder / "pbr"
    pbr.mkdir(exist_ok=True)
    for name, image in (("albedo", albedo), ("normal", normal), ("roughness", roughness), ("ao", ao)):
        image.save(pbr / f"{name}.jpg", quality=91, optimize=True)
    print(f"{sku}: {spec['width_m']:.2f} x {spec['height_m']:.2f} m")
