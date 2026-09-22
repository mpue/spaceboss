"""Rendert die Roh-Grafiken mit dem lokalen ComfyUI (Krea-2 Turbo GGUF), wie bei Hypersense.

    python tools/gen_assets.py              # alle Motive, je 2 Varianten
    python tools/gen_assets.py hero_arm     # nur diese
    python tools/gen_assets.py --seeds 5,7,9 hero_torso

Braucht ein laufendes ComfyUI auf 127.0.0.1:8188. Die Renders landen in art/raw/<name>_<seed>.png,
tools/key_assets.py macht aus den gewählten Varianten die Sprites unter public/assets/.
"""
import json, sys, time, urllib.request, urllib.parse
from pathlib import Path

HOST = "http://127.0.0.1:8188"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
SEEDS = [11, 23]
EXTRA_SEEDS = {"hero_torso": [11, 23, 37, 41], "hero_arm": [11, 23, 37, 41], "hero_leg": [11, 23, 37, 41],
               "hero_full": [11, 23, 37, 41], "boss_torso": [11, 23, 37], "boss_cannon": [11, 23, 37],
               "boss_claw": [11, 23, 37], "boss_leg": [11, 23, 37], "queen_torso": [11, 23, 37],
               "queen_scythe": [11, 23, 37], "queen_leg": [11, 23, 37], "queen_tail": [11, 23]}

GREEN = ("highly detailed sci-fi video game sprite, polished 3D render, sharp clean silhouette, centered, "
         "the whole object fully visible with margin around it, isolated on a flat uniform pure bright green "
         "chroma key background, no shadow, no text, no frame")
BLACK = "deep black empty background, no text, no frame"
TILE = "flat orthographic front view filling the entire frame edge to edge, even lighting, no text, no frame, no border"

# Der Held: ein muskulöser Astronaut. Er wird aus Teilen zusammengesetzt und prozedural animiert
# (Beine mit Knie-Gelenk, Waffenarm dreht sich zum Ziel), darum einzelne Teile in exakter Seitenansicht.
SUIT = ("bulky white and orange armored space suit with scuffed hard armor plates, dark grey rubber joints, "
        "orange stripes")
ASSETS = {
    "hero_torso": ("the upper body of a very muscular heroic astronaut space marine in a " + SUIT + ", huge "
                   "armored shoulders and broad chest, round helmet with a glowing gold reflective visor, big life "
                   "support backpack with two small thruster nozzles, without arms, torso ends at the belt, exact "
                   "side view profile facing to the right", GREEN, 1024, 1024),
    "hero_arm": ("a huge muscular armored astronaut arm in a " + SUIT + ", from the shoulder pad to the gloved hand, "
                 "the hand gripping a massive heavy sci-fi plasma assault rifle with a glowing cyan energy barrel, "
                 "arm stretched straight out horizontally, rifle pointing to the right, exact side view",
                 GREEN, 1536, 768),
    "hero_leg": ("a single armored astronaut leg from the hip to a heavy magnetic space boot, " + SUIT + ", big knee "
                 "pad, leg perfectly straight and vertical, exact side view, boot toe pointing to the right, "
                 "nothing else", GREEN, 768, 1536),
    "hero_full": ("a very muscular heroic astronaut space marine in a " + SUIT + ", round helmet with a glowing gold "
                  "reflective visor, life support backpack, holding a massive sci-fi plasma assault rifle with a "
                  "glowing cyan barrel, full body, confident heroic standing pose, three quarter view",
                  GREEN, 1024, 1536),
    # Gegner (Aliens und ihre Maschinen), Blick nach links
    "crawler": ("the body of a biomechanical alien bug creature without legs, armored glossy dark purple carapace "
                "with glowing toxic green eyes, sharp mandibles and green glowing slits, facing to the left, exact "
                "side view profile", GREEN, 1024, 1024),
    "drone": ("a hovering alien attack drone, dark purple and black armored shell with a single big glowing red "
              "eye in the center, small antigravity thrusters and two stubby plasma cannons, front view",
              GREEN, 1024, 1024),
    "jelly": ("a floating alien space jellyfish creature, translucent glowing pink and violet bioluminescent bell "
              "with bright spots and long glowing tentacles hanging down, front view", GREEN, 1024, 1024),
    "turret": ("a compact alien biomechanical gun turret on a heavy armored base, dark purple metal with glowing "
               "green energy lines and a long plasma cannon barrel pointing to the left, exact side view",
               GREEN, 1024, 1024),
    "brute": ("a heavy armored alien hover tank mech with a huge plasma cannon, dark purple and black armor plates "
              "with glowing green lights, hovering on glowing antigravity jets, facing to the left, exact side "
              "view profile", GREEN, 1536, 1024),
    "pod": ("an organic alien hive egg sack growing from the ground, glossy dark purple leathery skin with pulsing "
            "glowing green veins and a slimy opening on top", GREEN, 1024, 1024),
    # Requisiten
    "crate": ("a sturdy sci-fi military supply crate, grey metal box with orange hazard stripes and small glowing "
              "cyan lights, front view", GREEN, 1024, 1024),
    "barrel": ("an explosive red sci-fi fuel barrel with yellow hazard symbols and a glowing warning light, front "
               "view", GREEN, 1024, 1024),
    "capsule": ("a small glowing futuristic weapon power-up capsule, chrome metal pod with a bright orange energy "
                "crystal inside", GREEN, 1024, 1024),
    "medkit": ("a small futuristic medkit capsule, white metal pod with a bright glowing green cross", GREEN,
               1024, 1024),
    "platform": ("a floating sci-fi metal platform, long horizontal thick armored slab with warning stripes on the "
                 "edges and glowing cyan lights underneath, perfectly flat straight top edge, exact side view",
                 GREEN, 1536, 384),
    # Welt: Kachel-Texturen, Hintergrund, Kulissen
    "ground": ("alien planet ground texture, dark basalt rock with embedded riveted metal plates and glowing green "
               "crystal veins, " + TILE, "", 1024, 1024),
    "metal": ("sci-fi military base wall texture, heavy dark grey riveted metal panels, pipes, vents and a few small "
              "glowing orange lights, " + TILE, "", 1024, 1024),
    "sky": ("an alien planet sky panorama, a huge ringed gas giant planet and two small moons in a dark teal and "
            "violet sky full of nebula clouds and stars, above a far horizon of jagged dark mountains, cinematic, "
            "wide angle", "no text, no frame, no people", 1536, 864),
    "colony": ("a long skyline of a ruined sci-fi mining colony, industrial towers, domes, cranes, smokestacks and "
               "antennas with small lights, exact side view, wide panoramic", GREEN, 1536, 640),
    "spires": ("a row of jagged alien rock spires and cliffs with big glowing cyan and violet crystals, exact side view, "
               "wide panoramic", GREEN, 1536, 640),
    "wreck": ("a crashed wrecked spaceship half buried, broken white hull with burning orange embers, exact side "
              "view", GREEN, 1536, 768),
    "title": ("epic cinematic poster art of a very muscular astronaut space marine in a " + SUIT + " with a glowing "
              "gold visor, firing a huge plasma rifle, standing on an alien planet, giant explosions and alien "
              "creatures in the background, a huge ringed planet in the sky, dramatic orange and teal lighting",
              "no text, no letters, no logo, no frame", 1536, 864),
    # Der Spaceboss in Einzelteilen (wie der Held zusammengesetzt und prozedural animiert).
    # Alle Teile in exakter Seitenansicht nach rechts, im Spiel gespiegelt.
    "boss_torso": ("the armless and legless torso of a colossal biomechanical alien war machine, heavy dark purple and "
                   "black armor plates, a big glowing green reactor core in the chest, a menacing skull-like head with "
                   "glowing green eyes and horns on top, thick cables and tubes, torso ends at the hips, without arms, "
                   "without legs, exact side view profile facing to the right", GREEN, 1024, 1024),
    "boss_cannon": ("a gigantic armored alien mech arm holding a huge triple barrel plasma cannon, dark purple and "
                    "black armor with glowing green energy coils, from the round shoulder joint to the muzzle, arm "
                    "stretched straight out horizontally, cannon pointing to the right, exact side view",
                    GREEN, 1536, 768),
    "boss_claw": ("a gigantic armored alien mech arm ending in huge curved talons, dark purple and black armor with "
                  "glowing green seams, from the round shoulder joint to the claw tips, arm stretched straight out "
                  "horizontally, claws pointing to the right, exact side view", GREEN, 1536, 768),
    "boss_leg": ("a single gigantic armored alien mech leg with a reverse digitigrade knee, from the hip joint to a "
                 "heavy three toed clawed foot, dark purple and black armor with glowing green seams, standing "
                 "straight and vertical, exact side view, foot pointing to the right, nothing else", GREEN, 768, 1536),
    # Die Hive Queen in Einzelteilen, ebenfalls Seitenansicht nach rechts
    "queen_torso": ("the armless and legless torso of a colossal alien hive queen, glossy black and dark purple "
                    "exoskeleton, long elongated backward crested head with many glowing magenta eyes and fanged "
                    "jaws, ribbed chest with a glowing pink core, dripping slime, torso ends at the hips, without "
                    "arms, without legs, exact side view profile facing to the right", GREEN, 1024, 1024),
    "queen_scythe": ("a gigantic alien scythe arm of a hive queen, from the round shoulder joint to the long curved "
                     "blade tip, glossy black and purple chitin with glowing magenta seams, arm stretched straight "
                     "out horizontally, blade pointing to the right, exact side view", GREEN, 1536, 768),
    "queen_leg": ("a single gigantic alien hive queen leg with a reverse digitigrade knee, from the hip joint to a "
                  "sharp clawed foot, glossy black and purple chitin with glowing magenta seams, standing straight "
                  "and vertical, exact side view, claw pointing to the right, nothing else", GREEN, 768, 1536),
    "queen_tail": ("a long segmented alien queen tail with a glowing magenta stinger at the tip, glossy black and "
                   "purple chitin, stretched out straight horizontally, tip pointing to the right, exact side view, "
                   "nothing else", GREEN, 1536, 768),
    # Level 2: Hive Caverns
    "spitter": ("a squat biomechanical alien spitter creature with a swollen glowing acid sac on its back, dark purple "
                "armored hide, wide open fanged mouth and glowing green eyes, crouching on short legs, facing to the "
                "left, exact side view profile", GREEN, 1024, 1024),
    "bat": ("a flying alien bat creature with wide spread leathery membrane wings, dark purple skin with glowing pink "
            "veins, glowing magenta eyes and sharp claws, front view, wings fully spread", GREEN, 1024, 1024),
    "cave": ("organic alien cave rock texture, dark purple and black wet stone with fleshy veins, small glowing pink "
             "bioluminescent spots, " + TILE, "", 1024, 1024),
    "cave_bg": ("a vast dark underground alien hive cavern, huge organic pillars and ribbed walls, glowing pink and "
                "cyan bioluminescent fungi, misty depths, distant glowing egg clusters, cinematic, wide angle",
                "no text, no frame, no people", 1536, 864),
    "fungi": ("a wide row of giant alien mushrooms and tall organic stalks with glowing pink and cyan caps, exact side "
              "view, wide panoramic", GREEN, 1536, 640),
    # Level 3: Mothership
    "saucer": ("a small alien flying saucer bomber drone, dark gunmetal and purple disc hull with a glowing red dome "
               "and a ring of orange lights, a bomb bay underneath, seen slightly from below, side view",
               GREEN, 1024, 1024),
    "sentinel": ("a hovering alien sentinel robot with a big curved glowing violet energy shield plate on its front "
                 "side, dark armored purple body, single cyan eye, antigravity thruster below, facing to the left, "
                 "exact side view profile", GREEN, 1024, 1024),
    "hull": ("alien mothership interior wall texture, dark violet and gunmetal biomechanical metal panels with ribs, "
             "cables and thin glowing magenta lines, " + TILE, "", 1024, 1024),
    "ship_bg": ("interior of a colossal alien mothership hangar, huge ribbed dark violet biomechanical walls, "
                "gigantic windows showing a blue planet and stars outside, glowing magenta light strips, hazy depth, "
                "cinematic, wide angle", "no text, no frame, no people", 1536, 864),
    "machinery": ("a long row of gigantic alien biomechanical machinery, reactor towers, huge pipes, pistons and "
                  "cables with small magenta lights, exact side view, wide panoramic", GREEN, 1536, 640),
    # Leuchtbilder (auf Schwarz, additiv gezeichnet)
    "explosion": ("a single bright fiery explosion burst, orange and yellow fireball with glowing sparks and smoke, "
                  "centered", BLACK, 1024, 1024),
    "plasma": ("a single bright glowing green plasma energy explosion burst with electric sparks, centered",
               BLACK, 1024, 1024),
}


def workflow(text, w, h, seed, prefix):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "krea2_turbo_bf16-Q4_0.gguf"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors",
                                                      "type": "krea2", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "Qwen_Image-VAE.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": text}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
                                                    "latent_image": ["6", 0], "seed": seed, "steps": 8, "cfg": 1.0,
                                                    "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def post(path, body):
    req = urllib.request.Request(HOST + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))


def get(path):
    return urllib.request.urlopen(HOST + path).read()


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    seeds = None
    if args[:1] == ["--seeds"]:
        seeds = [int(s) for s in args[1].split(",")]
        args = args[2:]
    names = args or list(ASSETS)
    jobs = []
    for name in names:
        subject, style, w, h = ASSETS[name]
        text = subject + (", " + style if style else "")
        for seed in seeds or EXTRA_SEEDS.get(name, SEEDS):
            pid = post("/prompt", {"prompt": workflow(text, w, h, seed, "spaceboss/" + name)})["prompt_id"]
            jobs.append((name, seed, pid))
    print(f"{len(jobs)} jobs queued", flush=True)
    for name, seed, pid in jobs:
        while True:
            hist = json.loads(get("/history/" + pid)).get(pid)
            if hist and hist.get("outputs"):
                break
            if hist and hist.get("status", {}).get("status_str") == "error":
                print(f"FAILED {name} {seed}", flush=True)
                hist = None
                break
            time.sleep(1)
        if not hist:
            continue
        img = hist["outputs"]["9"]["images"][0]
        q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
        (RAW / f"{name}_{seed}.png").write_bytes(get("/view?" + q))
        print(f"ok {name}_{seed}", flush=True)


if __name__ == "__main__":
    main()
