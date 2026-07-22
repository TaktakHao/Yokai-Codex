import os
from PIL import Image, ImageDraw

def create_seamless_bg(path, width=720, height=1280):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Base color: Light green for grassland
    img = Image.new('RGB', (width, height), color=(144, 238, 144))
    d = ImageDraw.Draw(img)
    
    # Draw seamless grid lines
    grid_size = 160
    for y in range(0, height, grid_size):
        d.line([(0, y), (width, y)], fill=(34, 139, 34), width=4)
    for x in range(0, width, grid_size):
        d.line([(x, 0), (x, height)], fill=(34, 139, 34), width=4)
    
    # Draw some repeating shapes (grass tufts) that tile perfectly
    # To ensure it's tileable, we make sure the pattern repeats evenly based on the grid_size
    for y in range(grid_size // 2, height, grid_size):
        for x in range(grid_size // 2, width, grid_size):
            # A simple "V" shape for grass
            d.line([(x - 10, y - 10), (x, y), (x + 10, y - 10)], fill=(0, 100, 0), width=3)
            
    img.save(path)
    print(f"Successfully generated seamless background at: {path}")

if __name__ == '__main__':
    target_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets/resources/Textures/bg_grassland.png')
    create_seamless_bg(target_path)
