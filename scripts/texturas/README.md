# Adicionar textura PBR nova ao Catálogo

Fluxo pra transformar um pacote de textura (tipo PolyHaven/ambientCG —
`.blend.zip` com `diff`/`nor_gl`/`rough`/`ao` em `.jpg`/`.png`/`.exr`) num
produto novo em `src/core/Catalog.ts`, pronto pra usar em piso (`category:
'floor_tile'`) ou telhado/tabeira (`roof_tile`/`trim`).

## 1. Extrair e converter EXR (se tiver)

Mapas de dado (normal, roughness, ao, displacement) costumam vir em
`.exr` (HDR float) — sem suporte direto em `<img>`/`THREE.TextureLoader`.
Converte usando o próprio Blender (mais confiável que qualquer lib solta):

```bash
"/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background \
  --python scripts/texturas/blender_convert_exr.py -- <pasta_com_exr> <pasta_saida_png>
```

Detecta automaticamente se é mapa de dado (nome contém `nor`/`rough`/`ao`/
`disp`/`metal`) e grava com colorspace `Non-Color`; senão usa `sRGB`.

## 2. Redimensionar, comprimir e montar o snippet TS

Copia o(s) arquivo(s) de cor base (`diff`/`albedo`/`color`) pra MESMA
pasta dos PNG convertidos no passo 1, depois:

```bash
python3 scripts/texturas/build_catalog_texture.py <pasta_com_imagens> [tamanho=384] [qualidade=78]
```

Reconhece arquivo por nome (`diff`→`map`, `nor`→`normalMap`,
`rough`→`roughnessMap`, `ao`/`occlusion`→`aoMap`, opcional), corta pro
quadrado central, redimensiona pro `tamanho`x`tamanho` (mesmo padrão já
usado nos produtos de teste existentes: 384×384) e escreve
`<pasta>/textures_snippet.txt` com o bloco `textures: { map: 'data:...', ... }`
pronto pra colar.

## 3. Inserir no Catalog.ts

`Catalog.ts` tem linhas de dezenas de milhares de caracteres (as texturas
embutidas) — não dá pra editar à mão com segurança. Use o script, que
insere via Node (sem risco de erro de transcrição):

```bash
node scripts/texturas/insert_catalog_entry.js \
  <caminho_textures_snippet.txt> \
  <id_do_produto, ex: teste.piso.nome-pbr> \
  "<Nome de exibição>" \
  <SKU, ex: TESTE-004> \
  <colorHex, ex: #9B8063> \
  <tileMeters, ex: 2.0> \
  "<âncora — texto curto e único logo onde deve inserir>"
```

A âncora precisa ser um texto CURTO (não uma das linhas gigantes) que já
existe em `Catalog.ts`, logo ANTES de onde a entrada nova deve entrar —
ex.: `"    // --- Móveis (categoria 'furniture')"` insere um produto novo
bem antes da seção de móveis.

Depois, adicione um comentário curto acima da entrada (à mão, matando a
convenção dos outros produtos de teste PBR) explicando a origem/limitação
(sem AO, tileMeters é estimativa, etc.) e rode `npx tsc --noEmit` +
`npm test` pra validar.

## Notas

- `colorHex` é usado como fallback (produtos sem `assets.textures`) e
  como tint em alguns lugares — sample a cor média da imagem `diff` se
  não tiver um valor melhor (`PIL: Image.open(...).resize((64,64))` e
  tira a média dos pixels).
- Piso (`category: 'floor_tile'`) só usa a textura real quando o produto
  tem `assets.textures` — ver `Scene3DRenderer.ts`,
  `buildFloorTileMaterial`/`pisoHasRealTexture` (DEC-97). Sem isso, cai
  no padrão procedural de cerâmica (`buildCeramicTexture`, só cor sólida
  + linha de rejunte).
