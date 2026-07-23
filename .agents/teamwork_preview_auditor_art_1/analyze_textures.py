import os
from PIL import Image

textures_dir = '/Users/wesson/YokaiCodex/assets/resources/Textures'
report_file = '/Users/wesson/YokaiCodex/.agents/teamwork_preview_auditor_art_1/texture_analysis.txt'

out_lines = []
out_lines.append(f"=== 深度分析 {textures_dir} 下的所有图片 ===\n")

for root, dirs, files in os.walk(textures_dir):
    for f in sorted(files):
        if f.endswith('.png'):
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, textures_dir)
            size_bytes = os.path.getsize(path)
            try:
                im = Image.open(path)
                mode = im.mode
                w, h = im.size
                total_pixels = w * h
                
                if mode == 'RGBA':
                    pixels = list(im.getdata())
                    alpha_0 = 0
                    alpha_255 = 0
                    alpha_mid = 0
                    sum_r = sum_g = sum_b = 0
                    count_opaque = 0
                    
                    for r, g, b, a in pixels:
                        if a == 0:
                            alpha_0 += 1
                        elif a == 255:
                            alpha_255 += 1
                            sum_r += r
                            sum_g += g
                            sum_b += b
                            count_opaque += 1
                        else:
                            alpha_mid += 1
                            sum_r += r
                            sum_g += g
                            sum_b += b
                            count_opaque += 1
                            
                    pct_0 = alpha_0 / total_pixels * 100
                    pct_255 = alpha_255 / total_pixels * 100
                    pct_mid = alpha_mid / total_pixels * 100
                    
                    avg_r = sum_r / count_opaque if count_opaque > 0 else 0
                    avg_g = sum_g / count_opaque if count_opaque > 0 else 0
                    avg_b = sum_b / count_opaque if count_opaque > 0 else 0
                    
                    status = 'OK'
                    if size_bytes <= 100 or total_pixels <= 1:
                        status = 'WARNING: Placeholder (1x1 or <100B)'
                    elif alpha_255 == total_pixels:
                        status = 'NO_ALPHA: 100% Opaque Rect'
                    elif alpha_mid == 0:
                        status = 'NO_SMOOTHING: Hard Binary Alpha'
                        
                    out_lines.append(f"[{rel_path}] Size: {size_bytes}B | Dim: {w}x{h} | Mode: {mode}")
                    out_lines.append(f"  Alpha 0 (Transparent): {alpha_0} ({pct_0:.1f}%)")
                    out_lines.append(f"  Alpha 255 (Opaque): {alpha_255} ({pct_255:.1f}%)")
                    out_lines.append(f"  Alpha Mid (Translucent/Smooth): {alpha_mid} ({pct_mid:.1f}%)")
                    out_lines.append(f"  Avg RGB (Non-transparent): ({avg_r:.1f}, {avg_g:.1f}, {avg_b:.1f})")
                    out_lines.append(f"  Status: {status}\n")
                else:
                    out_lines.append(f"[{rel_path}] Size: {size_bytes}B | Dim: {w}x{h} | Mode: {mode}")
                    out_lines.append(f"  Alpha: NO ALPHA CHANNEL")
                    out_lines.append(f"  Status: Non-RGBA\n")
            except Exception as e:
                out_lines.append(f"[{rel_path}] ERROR reading image: {e}\n")

with open(report_file, 'w', encoding='utf-8') as f_out:
    f_out.write('\n'.join(out_lines))

print("Analysis complete. Saved to texture_analysis.txt")
