"""Macht aus den gewählten Roh-Renders in art/raw die Sprites unter public/assets/ (wie bei Hypersense).

    python tools/key_assets.py

Greenscreen-Renders werden freigestellt (Alpha aus der Grün-Dominanz, Grün-Überstrahlung entfernt),
auf das Objekt beschnitten und skaliert. Schwarz-Renders werden JPGs für additives Zeichnen,
Texturen werden zu Kacheln (8×8 Kacheln pro Textur, nahtlos gespiegelt).
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
OUT = ROOT / "public" / "assets"

# name: (Roh-Datei, max. Breite, max. Höhe)
SPRITES = {
    "hero_torso": ("hero_torso_11", 420, 420),
    "hero_arm": ("hero_arm_23", 600, 300),
    "hero_leg": ("hero_leg_23", 200, 460),
    "hero_full": ("hero_full_23", 400, 600),
    "crawler": ("crawler_11", 300, 300),
    "drone": ("drone_11", 240, 240),
    "jelly": ("jelly_11", 280, 280),
    "turret": ("turret_11", 260, 260),
    "brute": ("brute_11", 520, 360),
    "pod": ("pod_11", 280, 280),
    "crate": ("crate_23", 160, 160),
    "barrel": ("barrel_23", 160, 160),
    "capsule": ("capsule_11", 160, 160),
    "medkit": ("medkit_23", 160, 160),
    "platform": ("platform_11", 800, 200),
    "colony": ("colony_11", 1536, 640),
    "spires": ("spires_11", 1536, 640),
    "wreck": ("wreck_23", 1000, 500),
    # Level 2 und 3
    "spitter": ("spitter_11", 300, 300),
    "bat": ("bat_11", 300, 200),
    "saucer": ("saucer_11", 300, 200),
    "sentinel": ("sentinel_11", 260, 300),
    # Level 6: Alien Base
    "trooper_body": ("trooper_body_11", 360, 360),
    "trooper_leg": ("trooper_leg_11", 200, 400),
    "hmine": ("hmine_23", 200, 200),
    "warper": ("warper_23", 300, 300),
    "citadel": ("citadel_23", 1536, 640),
    "pylons": ("pylons_11", 1536, 640),
    # Der Warlord in Einzelteilen
    "war_torso": ("war_torso_53", 700, 700),
    "war_cannon": ("war_cannon_11", 900, 450),
    "war_blade": ("war_blade_37", 900, 450),
    "war_leg": ("war_leg_23", 380, 760),
    # Extras
    "pu_jet": ("pu_jet_11", 200, 200),
    "pu_shield": ("pu_shield_11", 200, 200),
    "pu_over": ("pu_over_11", 200, 200),
    "pu_magnet": ("pu_magnet_23", 200, 200),
    # Laufgegner in Einzelteilen (Rumpf und Bein, prozedural animiert)
    "mortar_body": ("mortar_body_51", 460, 320),
    "mortar_leg": ("mortar_leg_23", 200, 400),
    "mudhulk_body": ("mudhulk_body_23", 460, 460),
    "mudhulk_leg": ("mudhulk_leg_37", 200, 400),
    # Spaceboss in Einzelteilen (wird im Spiel zusammengesetzt und animiert)
    "boss_torso": ("boss_torso_23", 700, 700),
    "boss_cannon": ("boss_cannon_23", 900, 450),
    "boss_claw": ("boss_claw_11", 900, 450),
    "boss_leg": ("boss_leg_11", 380, 760),
    # Hive Queen in Einzelteilen
    "queen_torso": ("queen_torso_23", 700, 700),
    "queen_scythe": ("queen_scythe_23", 900, 450),
    "queen_leg": ("queen_leg_37", 380, 760),
    "queen_tail": ("queen_tail_23", 900, 450),
    # Level 4: The Outbacks
    "sandworm": ("sandworm_23", 320, 360),
    "skimmer": ("skimmer_23", 420, 220),
    "thorn": ("thorn_11", 260, 320),
    "mortar": ("mortar_11", 460, 320),
    "dev_maw": ("dev_maw_23", 700, 700),
    "dev_seg": ("dev_seg_11", 700, 360),
    "dev_tail": ("dev_tail_11", 800, 400),
    "dev_arm": ("dev_arm_23", 800, 400),
    "dunes": ("dunes_23", 1536, 640),
    "debris": ("debris_11", 1536, 640),
    # Level 5: The Swamp
    "leech": ("leech_11", 320, 220),
    "stingfly": ("stingfly_11", 300, 280),
    "sporepod": ("sporepod_23", 280, 340),
    "mudhulk": ("mudhulk_11", 480, 340),
    "mom_body": ("mom_body_23", 800, 800),
    "mom_seg": ("mom_seg_11", 300, 300),
    "mom_tip": ("mom_tip_11", 700, 350),
    "trees": ("trees_11", 1536, 640),
    "reeds": ("reeds_11", 1536, 640),
    "fungi": ("fungi_11", 1536, 640),
    "machinery": ("machinery_11", 1536, 640),
}
ADDITIVE = {"explosion": ("explosion_11", 512), "plasma": ("plasma_11", 512)}
BACKDROPS = {"sky": ("sky_11", 1920), "title": ("title_23", 1920), "cave_bg": ("cave_bg_11", 1920),
             "ship_bg": ("ship_bg_11", 1920), "desert_bg": ("desert_bg_clean", 1920),
             "swamp_bg": ("swamp_bg_11", 1920), "base_bg": ("base_bg_11", 1920)}
TEXTURES = {"ground": "ground_23", "metal": "metal_11", "cave": "cave_11", "hull": "hull_23",
            "sand": "sand_11", "rust": "rust_23", "mud": "mud_11", "bark": "bark_11",
            "alien_floor": "alien_floor_23", "alien_wall": "alien_wall_11"}


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def key_green(im):
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = g - np.maximum(r, b)
    alpha = 1 - smoothstep(25, 90, dom)
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def crop_fit(im, mw, mh, pad=4):
    bbox = im.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
    im.thumbnail((mw, mh), Image.LANCZOS)
    return im


def crush_black(im, floor=14):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    a = np.clip((a - floor) * 255 / (255 - floor), 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGB")


def tileable(im, size=512):
    """Nahtlos: halbe Größe, dann 2×2 gespiegelt zusammengesetzt."""
    half = im.convert("RGB").resize((size // 2, size // 2), Image.LANCZOS)
    out = Image.new("RGB", (size, size))
    out.paste(half, (0, 0))
    out.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (size // 2, 0))
    out.paste(half.transpose(Image.FLIP_TOP_BOTTOM), (0, size // 2))
    out.paste(half.transpose(Image.ROTATE_180), (size // 2, size // 2))
    return out


# Symbol der Desktop-App: quadratisch mit runden Ecken
ICON = ("app_icon_37", 512)


def app_icon():
    src, size = ICON
    f = RAW / f"{src}.png"
    if not f.exists():
        print("missing", f.name); return
    from PIL import ImageDraw
    im = Image.open(f).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 // 6, fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    out = ROOT / "electron" / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, optimize=True)
    print("icon", out.name, im.size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    app_icon()
    for name, (src, mw, mh) in SPRITES.items():
        f = RAW / f"{src}.png"
        if not f.exists():
            print("missing", f.name); continue
        im = crop_fit(key_green(Image.open(f)), mw, mh)
        im.save(OUT / f"{name}.png", optimize=True)
        print("sprite", name, im.size)
    for name, (src, mw) in ADDITIVE.items():
        f = RAW / f"{src}.png"
        if not f.exists():
            print("missing", f.name); continue
        im = crush_black(Image.open(f))
        im.thumbnail((mw, mw), Image.LANCZOS)
        im.save(OUT / f"{name}.jpg", quality=88)
        print("additive", name)
    for name, (src, mw) in BACKDROPS.items():
        f = RAW / f"{src}.png"
        if not f.exists():
            print("missing", f.name); continue
        im = Image.open(f).convert("RGB")
        im = im.resize((mw, round(mw * im.height / im.width)), Image.LANCZOS)
        im.save(OUT / f"{name}.jpg", quality=86)
        print("backdrop", name)
    for name, src in TEXTURES.items():
        f = RAW / f"{src}.png"
        if not f.exists():
            print("missing", f.name); continue
        tileable(Image.open(f)).save(OUT / f"{name}.jpg", quality=86)
        print("texture", name)


if __name__ == "__main__":
    main()
