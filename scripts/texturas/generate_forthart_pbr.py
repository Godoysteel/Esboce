"""Prepara a amostra limpa e os mapas PBR do ForthArt Pátina Polar."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "public" / "catalogo" / "revestimentos" / "002884"
SIZE = 1024

source = Image.open(FOLDER / "produto-original.png").convert("RGB")
# A prancha oficial tem a legenda de variação tonal no canto inferior direito.
# O maior quadrado ancorado à esquerda contém somente a superfície do produto.
clean = source.crop((0, 0, source.height, source.height))
clean.save(FOLDER / "amostra-frontal-original.jpg", quality=94, optimize=True)
albedo = clean.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
dy, dx = np.gradient(gray)
nx, ny, nz = -dx * 3.0, dy * 3.0, np.ones_like(gray)
length = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = Image.fromarray(np.uint8(np.dstack((nx / length * .5 + .5, ny / length * .5 + .5, nz / length * .5 + .5)) * 255), "RGB")
smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
detail = np.clip(np.abs(gray - smooth) * 1.5, 0, .15)
roughness = Image.fromarray(np.uint8(np.clip(.46 + detail, .30, .74) * 255), "L")
ao = Image.fromarray(np.uint8(np.clip(.91 + (gray - smooth) * .4, .72, 1) * 255), "L")

output = FOLDER / "pbr"
output.mkdir(exist_ok=True)
for name, image in (("albedo", albedo), ("normal", normal), ("roughness", roughness), ("ao", ao)):
    image.save(output / f"{name}.jpg", quality=92, optimize=True)
print("002884: regua fisica 1.2192 x 0.2286 m; atlas oficial preservado")
