"""Entfernt die eingebackene Rauchfahne über dem Wrack aus desert_bg, der Rauch wird im Spiel animiert.

    python tools/desmoke.py      # vor tools/key_assets.py
"""
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SRC = str(Path(__file__).resolve().parent.parent / 'art' / 'raw' / 'desert_bg_11.png')
OUT = SRC.replace('desert_bg_11.png', 'desert_bg_clean.png')
im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
H, W, _ = im.shape

# Rauchfahne (grosszuegig), in Pixeln des 1536x864-Renders
smoke = [(1188, 342), (1190, 300), (1206, 250), (1222, 200), (1262, 160), (1300, 120), (1326, 76), (1366, 26), (1440, 4),
         (1536, 4), (1536, 305), (1472, 282), (1402, 292), (1342, 322), (1304, 350)]
mask_img = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask_img).polygon(smoke, fill=255)
mask = np.asarray(mask_img) > 0

# Stuetzpunkte fuer den Himmel: Nachbarschaft ohne Rauch, ohne Wrack, ohne die kleinen Wolken
yy, xx = np.mgrid[0:H, 0:W]
region = (xx >= 900) & (yy <= 335)
wreck = ((xx < 1180) & (yy > 268)) | ((xx >= 1180) & (yy > 330))
clouds = (xx > 1030) & (xx < 1140) & (yy < 40)
keep = region & ~wreck & ~clouds & ~np.asarray(mask_img.filter(ImageFilter.MaxFilter(31))).astype(bool)
ys, xs = yy[keep], xx[keep]
u, v = (xs - 1200) / 340.0, ys / 340.0

def basis(u, v):
    return np.stack([u ** i * v ** j for i in range(4) for j in range(4) if i + j <= 3], axis=1)

A = basis(u, v)
fill = np.zeros_like(im)
uu, vv = (xx - 1200) / 340.0, yy / 340.0
B = basis(uu.ravel(), vv.ravel())
for ch in range(3):
    coef, *_ = np.linalg.lstsq(A, im[..., ch][keep], rcond=None)
    fill[..., ch] = (B @ coef).reshape(H, W)
# etwas Korn, damit die Flaeche nicht zu glatt wirkt
rng = np.random.default_rng(3)
fill += rng.normal(0, 1.2, fill.shape)

soft = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(14))).astype(np.float64)[..., None] / 255.0
out = im * (1 - soft) + fill * soft
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT)
print('ok', W, H)
