"""Monta o bloco `textures: {...}` (pronto pra colar no Catalog.ts) a
partir de uma pasta com os mapas PBR ja em formato de imagem comum
(jpg/png -- rode blender_convert_exr.py antes, se tiver .exr).

Convencao de nome de arquivo esperada (case-insensitive, contendo):
  diff / albedo / color / basecolor  -> map (cor base)
  nor                                -> normalMap
  rough                              -> roughnessMap
  ao / occlusion                     -> aoMap (opcional)

Uso:
  python3 build_catalog_texture.py <pasta_com_imagens> [tamanho=384] [qualidade=78]

Redimensiona cada mapa pro quadrado <tamanho>x<tamanho> (mesmo padrao
ja usado nos produtos de teste do Catalog.ts: 384x384, JPEG) e escreve
o bloco TS em <pasta_com_imagens>/textures_snippet.txt.
"""
import sys
import os
import glob
import base64
from io import BytesIO
from PIL import Image

folder = sys.argv[1]
size = int(sys.argv[2]) if len(sys.argv) > 2 else 384
quality = int(sys.argv[3]) if len(sys.argv) > 3 else 78

SLOTS = {
    'map': ['diff', 'albedo', 'basecolor', 'color'],
    'normalMap': ['nor'],
    'roughnessMap': ['rough'],
    'aoMap': ['occlusion', '_ao', '-ao'],
}

files = glob.glob(os.path.join(folder, '*.png')) + glob.glob(os.path.join(folder, '*.jpg')) + glob.glob(os.path.join(folder, '*.jpeg'))

found = {}
for slot, hints in SLOTS.items():
    for f in files:
        lower = os.path.basename(f).lower()
        if any(h in lower for h in hints):
            found[slot] = f
            break

if 'map' not in found:
    print('ERRO: nenhum arquivo de cor base (diff/albedo/color) encontrado em', folder)
    sys.exit(1)

lines = []
for slot in ['map', 'normalMap', 'roughnessMap', 'aoMap']:
    if slot not in found:
        continue
    path = found[slot]
    im = Image.open(path).convert('RGB')
    # corta pro quadrado central antes de redimensionar, evita distorcer
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    buf = BytesIO()
    im.save(buf, format='JPEG', quality=quality)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    lines.append(f"          {slot}: 'data:image/jpeg;base64,{b64}',")
    print(f'{slot}: {os.path.basename(path)} -> {len(b64)} chars base64 ({len(buf.getvalue())} bytes)')

snippet = "        textures: {\n" + "\n".join(lines) + "\n        }"
outpath = os.path.join(folder, 'textures_snippet.txt')
with open(outpath, 'w', encoding='utf-8') as f:
    f.write(snippet)
print('\nSnippet salvo em', outpath)
