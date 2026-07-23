import os
import sys
from PIL import Image

TEXTURE_DIR = "/Users/wesson/YokaiCodex/assets/resources/Textures"
DESIGN_FILE = "/Users/wesson/YokaiCodex/Design/Art_Style_Guide.md"

def test_character_and_monster_textures():
    print("=" * 60)
    print("[TEST 1 & 2] Character & Monster PNG Texture Validation")
    print("=" * 60)
    
    char_monster_dirs = [
        os.path.join(TEXTURE_DIR, "Player"),
        os.path.join(TEXTURE_DIR, "Enemies")
    ]
    
    png_files = []
    for d in char_monster_dirs:
        if os.path.exists(d):
            for root, _, files in os.walk(d):
                for f in files:
                    if f.lower().endswith(".png"):
                        png_files.append(os.path.join(root, f))
    
    if not png_files:
        print("FAIL: No PNG files found in Player/ or Enemies/ directories!")
        return False

    all_passed = True
    
    for file_path in sorted(png_files):
        rel_path = os.path.relpath(file_path, TEXTURE_DIR)
        print(f"\nAnalyzing texture: {rel_path}")
        
        try:
            with Image.open(file_path) as img:
                mode = img.mode
                size = img.size
                print(f"  Mode: {mode}, Size: {size}")
                
                # Rule 1: Mode must be RGBA
                if mode != "RGBA":
                    print(f"  ❌ FAIL: Image mode is '{mode}', expected 'RGBA'")
                    all_passed = False
                    continue
                else:
                    print(f"  ✅ PASS: Image mode is RGBA")
                
                # Rule 2: Alpha channel checks
                # Get alpha channel data
                alpha_data = list(img.getchannel("A").getdata())
                total_pixels = len(alpha_data)
                
                zero_alpha_count = sum(1 for a in alpha_data if a == 0)
                smooth_alpha_count = sum(1 for a in alpha_data if 0 < a < 255)
                full_alpha_count = sum(1 for a in alpha_data if a == 255)
                
                zero_pct = (zero_alpha_count / total_pixels) * 100
                smooth_pct = (smooth_alpha_count / total_pixels) * 100
                full_pct = (full_alpha_count / total_pixels) * 100
                
                print(f"  Alpha distribution:")
                print(f"    - Fully transparent (alpha == 0): {zero_alpha_count} ({zero_pct:.2f}%)")
                print(f"    - Edge smoothing (0 < alpha < 255): {smooth_alpha_count} ({smooth_pct:.2f}%)")
                print(f"    - Fully opaque (alpha == 255): {full_alpha_count} ({full_pct:.2f}%)")
                
                has_zero_alpha = zero_alpha_count > 0
                has_smooth_alpha = smooth_alpha_count > 0
                
                # Check for white background bounding box
                # Check 4 corners
                corners = [
                    img.getpixel((0, 0)),
                    img.getpixel((size[0] - 1, 0)),
                    img.getpixel((0, size[1] - 1)),
                    img.getpixel((size[0] - 1, size[1] - 1))
                ]
                white_corners = sum(1 for c in corners if c[:3] == (255, 255, 255) and c[3] == 255)
                
                img_passed = True
                if not has_zero_alpha:
                    print(f"  ❌ FAIL: No fully transparent pixels (alpha == 0) found!")
                    img_passed = False
                if not has_smooth_alpha:
                    print(f"  ❌ FAIL: No anti-aliased/edge smoothing pixels (0 < alpha < 255) found!")
                    img_passed = False
                if white_corners > 0:
                    print(f"  ❌ FAIL: Solid white opaque corners detected! ({white_corners}/4 corners are solid white)")
                    img_passed = False
                    
                if img_passed:
                    print(f"  ✅ PASS: Valid transparent Alpha channel with edge anti-aliasing.")
                else:
                    all_passed = False

        except Exception as e:
            print(f"  ❌ ERROR reading image: {e}")
            all_passed = False
            
    return all_passed

def test_bg_grassland_size():
    print("\n" + "=" * 60)
    print("[TEST 3] bg_grassland.png Resolution Verification")
    print("=" * 60)
    
    bg_path = os.path.join(TEXTURE_DIR, "bg_grassland.png")
    if not os.path.exists(bg_path):
        print(f"❌ FAIL: File not found: {bg_path}")
        return False
        
    try:
        with Image.open(bg_path) as img:
            width, height = img.size
            print(f"File: bg_grassland.png")
            print(f"Actual Resolution: {width}x{height}")
            print(f"Expected Resolution: 720x1280")
            
            if (width, height) == (720, 1280):
                print(f"✅ PASS: bg_grassland.png meets 720x1280 specification.")
                return True
            else:
                print(f"❌ FAIL: bg_grassland.png resolution {width}x{height} does not match 720x1280!")
                return False
    except Exception as e:
        print(f"❌ ERROR reading bg_grassland.png: {e}")
        return False

def test_art_style_guide():
    print("\n" + "=" * 60)
    print("[TEST 4] Design/Art_Style_Guide.md Existence & Non-empty Check")
    print("=" * 60)
    
    print(f"File path: {DESIGN_FILE}")
    if not os.path.exists(DESIGN_FILE):
        print("❌ FAIL: Design/Art_Style_Guide.md does not exist!")
        return False
        
    size = os.path.getsize(DESIGN_FILE)
    print(f"File size: {size} bytes")
    
    with open(DESIGN_FILE, "r", encoding="utf-8") as f:
        content = f.read().strip()
        
    line_count = len(content.splitlines())
    print(f"Line count: {line_count}")
    
    if size > 0 and len(content) > 0:
        print(f"✅ PASS: Design/Art_Style_Guide.md exists and is non-empty.")
        return True
    else:
        print(f"❌ FAIL: Design/Art_Style_Guide.md is empty!")
        return False

if __name__ == "__main__":
    t1_pass = test_character_and_monster_textures()
    t3_pass = test_bg_grassland_size()
    t4_pass = test_art_style_guide()
    
    print("\n" + "=" * 60)
    print("OVERALL SUMMARY")
    print("=" * 60)
    print(f"Character/Monster Textures RGBA & Alpha Test: {'PASS' if t1_pass else 'FAIL'}")
    print(f"bg_grassland.png 720x1280 Size Test:           {'PASS' if t3_pass else 'FAIL'}")
    print(f"Design/Art_Style_Guide.md Check:               {'PASS' if t4_pass else 'FAIL'}")
    
    overall = t1_pass and t3_pass and t4_pass
    print(f"\nFINAL RESULT: {'PASS' if overall else 'FAIL'}")
    sys.exit(0 if overall else 1)
