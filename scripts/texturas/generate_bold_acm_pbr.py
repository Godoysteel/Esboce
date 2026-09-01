"""Gera mapas PBR compactos para os acabamentos ACM Bold usados no Esboce.

Os albedos-base foram gerados com image_gen em 01/09/2026 e ficam ao lado
dos mapas finais para preservar a procedência. O script não inventa relevo
de chapa: deriva somente a microvariação do coating/estampa e calibra a
rugosidade por acabamento.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2] / "public" / "textures" / "acm" / "bold"
SIZE = 1024

MATERIALS = {
    "azul-cobalto-fosco": {"roughness": 178, "metalness": 54, "normal": 0.30},
    "grafite-metalico": {"roughness": 86, "metalness": 205, "normal": 0.22},
    "laranja-brilho": {"roughness": 48, "metalness": 42, "normal": 0.14},
    "dourado-metalico": {"roughness": 78, "metalness": 214, "normal": 0.20},
    "branco-brilho": {"roughness": 42, "metalness": 38, "normal": 0.10},
    "madeira-clara": {"roughness": 104, "metalness": 48, "normal": 0.32},
    "cimento-queimado": {"roughness": 132, "metalness": 48, "normal": 0.20},
}


def normalized_luma(image: Image.Image) -> np.ndarray:
    gray = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    gray = np.asarray(Image.fromarray(np.uint8(gray * 255)).filter(ImageFilter.GaussianBlur(1.15)), dtype=np.float32) / 255.0
    return (gray - gray.mean()) / max(float(gray.std()), 0.025)


def normal_map(height: np.ndarray, strength: float) -> Image.Image:
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    normal = np.dstack((-dx, dy, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    return Image.fromarray(np.uint8(np.clip(normal * 0.5 + 0.5, 0, 1) * 255), "RGB")


for slug, config in MATERIALS.items():
    folder = ROOT / slug
    source = Image.open(folder / "albedo-source.png").convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    source.save(folder / "albedo.jpg", quality=90, optimize=True, progressive=True)

    micro = normalized_luma(source)
    rough = np.clip(config["roughness"] + micro * 7.0, 8, 245).astype(np.uint8)
    Image.fromarray(rough, "L").save(folder / "roughness.jpg", quality=90, optimize=True)
    Image.new("L", (SIZE, SIZE), config["metalness"]).save(folder / "metalness.jpg", quality=90, optimize=True)
    Image.new("L", (SIZE, SIZE), 255).save(folder / "ao.jpg", quality=88, optimize=True)
    normal_map(micro, config["normal"]).save(folder / "normal.jpg", quality=90, optimize=True)

print(f"Gerados {len(MATERIALS)} conjuntos PBR em {ROOT}")
