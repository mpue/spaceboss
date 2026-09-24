"""Bilder für die Webseite (site/): Spielszenen aus tools/screenshots.js zuschneiden und verkleinern,
dazu Titelbild, Vorschaubild für Links und Favicons.

    npx electron tools/screenshots.js    # zuerst: echte Spielszenen nach site/shots/
    python tools/site_images.py          # dann: site/img/
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "site" / "shots"
IMG = ROOT / "site" / "img"

# Szene -> Name auf der Seite
PICK = {
    "crash-site-2": "l1", "hive-1": "l2", "mothership-1": "l3",
    "outbacks-3": "l4", "swamp-2": "l5", "alien-base-1": "l6",
    "spaceboss-1": "b1", "queen-3": "b2", "mothership-3": "b3",
    "devourer-4": "b4", "rotmother-1": "b5", "warlord-2": "b6",
}


def shot(name):
    im = Image.open(SHOTS / f"{name}.jpg").convert("RGB")
    # unten liegt das Demo-Band (86 px): weg damit, dann wieder auf 16:9
    h = im.height - 86
    w = round(h * 16 / 9)
    x = (im.width - w) // 2
    return im.crop((x, 0, x + w, h))


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    for src, dst in PICK.items():
        im = shot(src)
        im.resize((1600, 900), Image.LANCZOS).save(IMG / f"{dst}.webp", quality=80, method=6)
        im.resize((800, 450), Image.LANCZOS).save(IMG / f"{dst}-s.webp", quality=78, method=6)
        print("szene", dst, src)
    title = Image.open(ROOT / "public" / "assets" / "title.jpg").convert("RGB")
    title.resize((1920, 1080), Image.LANCZOS).save(IMG / "hero.webp", quality=80, method=6)
    title.resize((960, 540), Image.LANCZOS).save(IMG / "hero-s.webp", quality=78, method=6)
    # Vorschaubild für Links (Open Graph): 1200×630 aus dem Warlord-Kampf
    og = shot("warlord-2")
    ow = round(og.height * 1200 / 630)
    ox = (og.width - ow) // 2
    og.crop((ox, 0, ox + ow, og.height)).resize((1200, 630), Image.LANCZOS).save(IMG / "og.jpg", quality=84)
    icon = Image.open(ROOT / "electron" / "icon.png").convert("RGBA")
    icon.resize((64, 64), Image.LANCZOS).save(IMG / "favicon.png")
    icon.resize((180, 180), Image.LANCZOS).save(IMG / "apple-touch-icon.png")
    icon.resize((256, 256), Image.LANCZOS).save(IMG / "icon.png")
    print("fertig")


if __name__ == "__main__":
    main()
