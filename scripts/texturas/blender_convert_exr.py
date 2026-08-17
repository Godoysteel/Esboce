"""Converte todo .exr de uma pasta pra .png, usando o proprio Blender (via
bpy) pra ler o arquivo -- mais confiavel que qualquer lib Python solta,
ja que e a MESMA leitura que o .blend original usaria.

Uso (fora do Blender, via linha de comando):
  blender.exe --background --python blender_convert_exr.py -- <pasta_origem> <pasta_destino>

Mapas de dado (normal, roughness, ao, displacement, metalness) sao
gravados com colorspace Non-Color, sem nenhuma transformacao de cor —
sao PNG 8-bit, entao ha perda de precisao vindo de EXR float, mas
suficiente pra uso em tempo real (nao pra deslocamento fisico real).
"""
import bpy
import sys
import os
import glob

src_dir = sys.argv[sys.argv.index('--') + 1]
out_dir = sys.argv[sys.argv.index('--') + 2]
os.makedirs(out_dir, exist_ok=True)

DATA_MAP_HINTS = ['nor', 'rough', 'ao', 'disp', 'height', 'metal', 'metalness', 'ambient']

exr_files = glob.glob(os.path.join(src_dir, '*.exr'))
if not exr_files:
    print('nenhum .exr encontrado em', src_dir)

for path in exr_files:
    fname = os.path.basename(path)
    lower = fname.lower()
    is_data = any(hint in lower for hint in DATA_MAP_HINTS)
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color' if is_data else 'sRGB'
    img.pixels[0]  # forca carregamento completo dos dados
    outname = os.path.splitext(fname)[0] + '.png'
    outpath = os.path.join(out_dir, outname)
    img.file_format = 'PNG'
    img.filepath_raw = outpath
    img.save()
    print(f'convertido: {fname} -> {outname} ({img.size[0]}x{img.size[1]}, colorspace={img.colorspace_settings.name})')

print('DONE')
