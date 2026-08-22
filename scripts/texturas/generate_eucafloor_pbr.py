"""Gera mapas PBR dos laminados Eucafloor com fonte frontal oficial."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "catalogo" / "revestimentos"
SIZE = 1024
# Frações do comprimento da régua. A sequência evita coincidência entre
# fileiras vizinhas e também entre a última fileira de um atlas e a primeira
# do atlas repetido ao lado.
STAGGER_OFFSETS = (0.00, 0.37, 0.74, 0.18, 0.55, 0.92)
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
    # As imagens oficiais incluem uma borda técnica escura. Quando ela entra no
    # atlas, a repetição parece uma fuga preta no piso. Removemos somente 2% das
    # extremidades e não desenhamos junta artificial: o laminado é encaixado.
    inset_x = max(1, round(source.width * 0.02))
    inset_y = max(1, round(source.height * 0.02))
    source = source.crop((inset_x, inset_y, source.width - inset_x, source.height - inset_y))
    canvas = Image.new("RGB", (SIZE, SIZE))
    for row in range(rows):
        y0 = round(row * SIZE / rows)
        y1 = round((row + 1) * SIZE / rows)
        plank = source.resize((SIZE, y1 - y0), Image.Resampling.LANCZOS)
        # A amostra oficial representa uma régua. Invertemos sua direção de
        # forma determinística para que os nós da madeira não se alinhem em
        # todas as fileiras, sem inventar cor ou alterar a escala do produto.
        if row % 2:
            plank = ImageOps.mirror(plank)
        if row % 4 >= 2:
            plank = ImageOps.flip(plank)
        # Desencontra a emenda de topo: o wrap interno vira o encontro entre
        # duas réguas, em posição diferente em cada fileira. ImageChops.offset
        # preserva a repetição contínua nas bordas externas do atlas.
        plank = ImageChops.offset(plank, round(STAGGER_OFFSETS[row % len(STAGGER_OFFSETS)] * SIZE), 0)
        canvas.paste(plank, (0, y0))
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
