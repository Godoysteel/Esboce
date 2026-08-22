"""Gera mapas PBR do Ruffino R31031 a partir do atlas frontal oficial."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "public" / "catalogo" / "revestimentos" / "000042"
SIZE = 1024

source = Image.open(FOLDER / "amostra-frontal-original.jpg").convert("RGB")
# A imagem oficial já é um atlas frontal com réguas e emendas desencontradas.
# Preservá-la evita fabricar faces ou fazer coincidir as emendas de topo.
albedo = source.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
gray = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
dy, dx = np.gradient(gray)
nx, ny, nz = -dx * 3.0, dy * 3.0, np.ones_like(gray)
length = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = Image.fromarray(np.uint8(np.dstack((nx / length * .5 + .5, ny / length * .5 + .5, nz / length * .5 + .5)) * 255), "RGB")
smooth = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
detail = np.clip(np.abs(gray - smooth) * 1.5, 0, .15)
roughness = Image.fromarray(np.uint8(np.clip(.44 + detail, .28, .72) * 255), "L")
ao = Image.fromarray(np.uint8(np.clip(.90 + (gray - smooth) * .4, .70, 1) * 255), "L")

output = FOLDER / "pbr"
output.mkdir(exist_ok=True)
for name, image in (("albedo", albedo), ("normal", normal), ("roughness", roughness), ("ao", ao)):
    image.save(output / f"{name}.jpg", quality=92, optimize=True)
print("000042: régua física 1.2192 x 0.1778 m; atlas oficial preservado")
