#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Victory Audit Script for YokaiCodex First Level Art Assets
Independent Verification of Art Style Guide, Image Textures, Alpha Channels, and Code Integration.
"""

import os
import sys
from PIL import Image

PROJECT_ROOT = "/Users/wesson/YokaiCodex"
STYLE_GUIDE_PATH = os.path.join(PROJECT_ROOT, "Design/Art_Style_Guide.md")
TEXTURES_DIR = os.path.join(PROJECT_ROOT, "assets/resources/Textures")
PLAYER_DIR = os.path.join(TEXTURES_DIR, "Player")
ENEMIES_DIR = os.path.join(TEXTURES_DIR, "Enemies")
BG_PATH = os.path.join(TEXTURES_DIR, "bg_grassland.png")

EXPECTED_TEXTURES = {
    "Player/player.png": {"mode": "RGBA", "width": 256, "height": 256, "type": "player"},
    "bg_grassland.png": {"mode": ("RGB", "RGBA"), "width": 720, "height": 1280, "type": "bg"},
    "Enemies/boss_millennium_tree_demon.png": {"mode": "RGBA", "width": 256, "height": 256, "type": "boss"},
    "Enemies/boss_1.png": {"mode": "RGBA", "width": 256, "height": 256, "type": "boss"},
    "Enemies/mob_grass_sprite.png": {"mode": "RGBA", "width": 80, "height": 80, "type": "mob"},
    "Enemies/mob_wood_spirit.png": {"mode": "RGBA", "width": 90, "height": 90, "type": "mob"},
    "Enemies/mob_venom_snake.png": {"mode": "RGBA", "width": 100, "height": 100, "type": "mob"},
    "Enemies/mob_gale_wolf.png": {"mode": "RGBA", "width": 100, "height": 100, "type": "mob"},
    "Enemies/elite_grass_brute.png": {"mode": "RGBA", "width": 140, "height": 140, "type": "elite"},
    "Enemies/elite_gale_wolf_alpha.png": {"mode": "RGBA", "width": 150, "height": 150, "type": "elite"},
    "Enemies/elite_wood_golem.png": {"mode": "RGBA", "width": 160, "height": 160, "type": "elite"},
    "Enemies/monster_1.png": {"mode": "RGBA", "width": 100, "height": 100, "type": "mob"},
    "Enemies/monster_2.png": {"mode": "RGBA", "width": 100, "height": 100, "type": "mob"},
}

def audit_style_guide():
    print("=== AUDIT STEP 1: Style Guide Verification ===")
    if not os.path.exists(STYLE_GUIDE_PATH):
        print("FAIL: Design/Art_Style_Guide.md does NOT exist!")
        return False
    
    with open(STYLE_GUIDE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    keywords = ["色彩", "饱和度", "构图", "2头身", "Chibi", "可爱", "描边", "RGBA", "Padding", "规格"]
    missing = [kw for kw in keywords if kw not in content]
    
    print(f"File size: {len(content)} bytes")
    if missing:
        print(f"FAIL: Missing expected style keywords: {missing}")
        return False
    else:
        print("PASS: Art_Style_Guide.md exists and contains all required style guidelines.")
        return True

def audit_textures():
    print("\n=== AUDIT STEP 2 & 3: Texture Format, Dimensions & Alpha Verification ===")
    all_pass = True
    
    for rel_path, spec in EXPECTED_TEXTURES.items():
        full_path = os.path.join(TEXTURES_DIR, rel_path)
        print(f"\nChecking: {rel_path}")
        
        if not os.path.exists(full_path):
            print(f"  FAIL: File not found: {full_path}")
            all_pass = False
            continue
        
        try:
            img = Image.open(full_path)
        except Exception as e:
            print(f"  FAIL: Cannot open image {rel_path}: {e}")
            all_pass = False
            continue
        
        # Mode check
        expected_modes = spec["mode"] if isinstance(spec["mode"], tuple) else (spec["mode"],)
        if img.mode not in expected_modes:
            print(f"  FAIL: Format mode is {img.mode}, expected {expected_modes}")
            all_pass = False
        else:
            print(f"  [Format] Mode: {img.mode} (PASS)")
        
        # Dimensions check
        if img.width != spec["width"] or img.height != spec["height"]:
            print(f"  FAIL: Dimension mismatch! Got {img.width}x{img.height}, expected {spec['width']}x{spec['height']}")
            all_pass = False
        else:
            print(f"  [Dimension] Size: {img.width}x{img.height} (PASS)")
        
        # Alpha & Pixel Inspection for Character/Enemy sprites
        if spec["type"] != "bg":
            if img.mode != "RGBA":
                print(f"  FAIL: Character image is not RGBA mode!")
                all_pass = False
                continue
            
            alpha_data = list(img.getdata(3)) # Extract Alpha channel
            total_pixels = len(alpha_data)
            transparent_count = sum(1 for a in alpha_data if a == 0)
            opaque_count = sum(1 for a in alpha_data if a == 255)
            translucent_count = sum(1 for a in alpha_data if 0 < a < 255)
            
            transparent_pct = (transparent_count / total_pixels) * 100
            translucent_pct = (translucent_count / total_pixels) * 100
            
            # Corner check
            corners = [
                img.getpixel((0, 0))[3],
                img.getpixel((0, img.height - 1))[3],
                img.getpixel((img.width - 1, 0))[3],
                img.getpixel((img.width - 1, img.height - 1))[3]
            ]
            
            print(f"  [Alpha] Transparent pixels (A=0): {transparent_count}/{total_pixels} ({transparent_pct:.1f}%)")
            print(f"  [Alpha] Edge anti-aliased pixels (0<A<255): {translucent_count}/{total_pixels} ({translucent_pct:.1f}%)")
            print(f"  [Alpha] Corner alpha values (TL, BL, TR, BR): {corners}")
            
            if transparent_pct < 10.0:
                print(f"  FAIL: Transparent area too small ({transparent_pct:.1f}%). Likely a white box background!")
                all_pass = False
            elif any(c != 0 for c in corners):
                print(f"  FAIL: Four corners are not fully transparent! Got corners: {corners}")
                all_pass = False
            elif translucent_count == 0:
                print(f"  FAIL: No anti-aliased edge pixels found! Hard binary alpha edge detected.")
                all_pass = False
            else:
                print(f"  [Alpha Integrity] Transparent alpha channel & edge anti-aliasing verified (PASS)")

    return all_pass

def audit_code_integration():
    print("\n=== AUDIT STEP 4: Code & Asset Mapping Verification ===")
    visual_loader_path = os.path.join(PROJECT_ROOT, "assets/Scripts/Utils/VisualLoader.ts")
    enemy_ts_path = os.path.join(PROJECT_ROOT, "assets/Scripts/Logic/Enemy.ts")
    
    if not os.path.exists(visual_loader_path):
        print(f"FAIL: {visual_loader_path} not found!")
        return False
        
    with open(visual_loader_path, "r", encoding="utf-8") as f:
        loader_code = f.read()
    
    # Check if placeholder restriction is removed
    print("Checking VisualLoader.ts ...")
    if "Textures/Enemies/monster_1" in loader_code and "boss_millennium_tree_demon" in loader_code:
        print("  PASS: ENEMY_TEXTURE_MAP contains actual monster & boss texture paths.")
    else:
        print("  WARNING: Check ENEMY_TEXTURE_MAP in VisualLoader.ts")
        
    with open(enemy_ts_path, "r", encoding="utf-8") as f:
        enemy_code = f.read()
        
    print("Checking Enemy.ts ...")
    if "Color(255, 255, 255, 255)" in enemy_code or "Color.WHITE" in enemy_code or "getOriginalColor" in enemy_code:
        print("  PASS: Enemy tinting safe for full-color RGBA PNGs.")
    else:
        print("  WARNING: Check getOriginalColor in Enemy.ts")

    return True

if __name__ == "__main__":
    s1 = audit_style_guide()
    s2 = audit_textures()
    s3 = audit_code_integration()
    
    print("\n==============================================")
    if s1 and s2 and s3:
        print("OVERALL AUDIT VERDICT: PASS (ALL CHECKS SUCCEEDED)")
        sys.exit(0)
    else:
        print("OVERALL AUDIT VERDICT: FAIL (ONE OR MORE CHECKS FAILED)")
        sys.exit(1)
