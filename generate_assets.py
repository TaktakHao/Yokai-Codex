import os
from PIL import Image, ImageDraw

def create_image(path, size, bg_color, draw_func):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.new('RGBA', size, color=bg_color)
    d = ImageDraw.Draw(img)
    draw_func(d, size[0], size[1])
    img.save(path)
    print(f"Generated {path}")

def draw_player(d, w, h):
    # Player character (Cultivator) - cool modern pixel-like geometric style
    # Head
    d.ellipse([w//2-20, h//2-40, w//2+20, h//2], fill=(255, 224, 189))
    # Hair
    d.polygon([(w//2-22, h//2-20), (w//2, h//2-50), (w//2+22, h//2-20)], fill=(30, 30, 30))
    # Body (robe)
    d.polygon([(w//2-30, h), (w//2, h//2), (w//2+30, h)], fill=(200, 230, 255))
    # Belt
    d.rectangle([w//2-20, h//2+20, w//2+20, h//2+30], fill=(50, 100, 200))
    # Sword on back
    d.line([(w//2-25, h//2-10), (w//2-40, h//2-30)], fill=(180, 180, 180), width=6)
    d.ellipse([w//2-45, h//2-35, w//2-35, h//2-25], fill=(200, 150, 50))
    # Eyes
    d.line([(w//2-10, h//2-25), (w//2-5, h//2-25)], fill=(0, 0, 0), width=2)
    d.line([(w//2+5, h//2-25), (w//2+10, h//2-25)], fill=(0, 0, 0), width=2)

def draw_mob_grass(d, w, h):
    # Grass sprite (slime-like)
    d.ellipse([10, h//2, w-10, h-10], fill=(100, 255, 100))
    d.ellipse([w//2-15, h//2+10, w//2-5, h//2+20], fill=(0, 100, 0))
    d.ellipse([w//2+5, h//2+10, w//2+15, h//2+20], fill=(0, 100, 0))
    # Leaf on top
    d.polygon([(w//2, h//2-10), (w//2-10, h//2+5), (w//2+10, h//2+5)], fill=(34, 139, 34))

def draw_mob_wood(d, w, h):
    # Wood spirit (blocky)
    d.rectangle([20, 20, w-20, h-10], fill=(139, 69, 19))
    d.rectangle([25, 25, w-25, h-15], fill=(160, 82, 45))
    # Eyes glowing
    d.ellipse([30, 40, 45, 55], fill=(255, 255, 0))
    d.ellipse([w-45, 40, w-30, 55], fill=(255, 255, 0))

def draw_elite_grass(d, w, h):
    # Big grass brute
    d.ellipse([5, 20, w-5, h-5], fill=(50, 200, 50))
    d.rectangle([10, h-20, w-10, h], fill=(30, 150, 30))
    # Angry eyes
    d.line([(30, 40), (50, 50)], fill=(255, 0, 0), width=4)
    d.line([(w-30, 40), (w-50, 50)], fill=(255, 0, 0), width=4)

def draw_gale_wolf(d, w, h):
    # Wolf (sharp shapes)
    d.polygon([(10, h//2), (w//2, 20), (w-10, h//2), (w//2, h-10)], fill=(150, 150, 160))
    # Ears
    d.polygon([(w//2-20, 40), (w//2-30, 10), (w//2-5, 30)], fill=(100, 100, 110))
    d.polygon([(w//2+20, 40), (w//2+30, 10), (w//2+5, 30)], fill=(100, 100, 110))
    # Eyes
    d.ellipse([w//2-15, h//2-10, w//2-5, h//2], fill=(0, 255, 255))
    d.ellipse([w//2+5, h//2-10, w//2+15, h//2], fill=(0, 255, 255))

def draw_elite_wolf(d, w, h):
    # Elite Wolf
    d.polygon([(5, h//2), (w//2, 10), (w-5, h//2), (w//2, h-5)], fill=(80, 80, 90))
    # Glowing aura lines
    d.line([(20, 20), (40, 40)], fill=(0, 255, 255), width=3)
    d.line([(w-20, 20), (w-40, 40)], fill=(0, 255, 255), width=3)
    d.ellipse([w//2-20, h//2-15, w//2-5, h//2], fill=(255, 0, 0))
    d.ellipse([w//2+5, h//2-15, w//2+20, h//2], fill=(255, 0, 0))

def draw_venom_snake(d, w, h):
    # Snake
    d.line([(20, h-20), (40, h-40), (60, h-20), (80, h-50), (w//2, 30)], fill=(100, 50, 150), width=15)
    # Head
    d.ellipse([w//2-15, 15, w//2+15, 45], fill=(120, 60, 180))
    # Fangs
    d.line([(w//2-5, 45), (w//2-5, 55)], fill=(255, 255, 255), width=2)
    d.line([(w//2+5, 45), (w//2+5, 55)], fill=(255, 255, 255), width=2)

def draw_elite_golem(d, w, h):
    d.rectangle([10, 10, w-10, h-10], fill=(100, 90, 80))
    # Rock textures
    d.rectangle([20, 20, 50, 50], fill=(120, 110, 100))
    d.rectangle([w-60, h-60, w-20, h-20], fill=(80, 70, 60))
    d.ellipse([w//2-25, 40, w//2-5, 60], fill=(255, 100, 0))
    d.ellipse([w//2+5, 40, w//2+25, 60], fill=(255, 100, 0))

def draw_boss_tree(d, w, h):
    # Big tree demon boss
    # Trunk
    d.rectangle([30, h//2-20, w-30, h-10], fill=(80, 40, 20))
    # Canopy
    d.ellipse([0, 0, w, h//2+20], fill=(20, 100, 20))
    d.ellipse([20, -10, w-20, h//2], fill=(30, 120, 30))
    # Evil face on trunk
    d.polygon([(50, h//2+20), (70, h//2+40), (40, h//2+50)], fill=(255, 50, 0))
    d.polygon([(w-50, h//2+20), (w-70, h//2+40), (w-40, h//2+50)], fill=(255, 50, 0))
    # Mouth
    d.rectangle([50, h//2+70, w-50, h//2+85], fill=(0, 0, 0))

def draw_bg(d, w, h):
    # Nice stylized grassland background
    # Base
    d.rectangle([0, 0, w, h], fill=(120, 200, 120))
    # Grid/Paths
    for y in range(0, h, 100):
        d.line([(0, y), (w, y)], fill=(100, 180, 100), width=2)
    for x in range(0, w, 100):
        d.line([(x, 0), (x, h)], fill=(100, 180, 100), width=2)
    # Patches of darker grass
    for i in range(20):
        x = (i * 137) % w
        y = (i * 251) % h
        d.ellipse([x, y, x+40, y+20], fill=(100, 190, 100))

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    res = os.path.join(base, 'assets/resources/Textures')
    
    # Generate player
    create_image(os.path.join(res, 'Player/player.png'), (120, 120), (0,0,0,0), draw_player)
    
    # Generate enemies
    edir = os.path.join(res, 'Enemies')
    create_image(os.path.join(edir, 'mob_grass_sprite.png'), (80, 80), (0,0,0,0), draw_mob_grass)
    create_image(os.path.join(edir, 'mob_wood_spirit.png'), (90, 90), (0,0,0,0), draw_mob_wood)
    create_image(os.path.join(edir, 'elite_grass_brute.png'), (140, 140), (0,0,0,0), draw_elite_grass)
    create_image(os.path.join(edir, 'mob_gale_wolf.png'), (100, 100), (0,0,0,0), draw_gale_wolf)
    create_image(os.path.join(edir, 'elite_gale_wolf_alpha.png'), (150, 150), (0,0,0,0), draw_elite_wolf)
    create_image(os.path.join(edir, 'mob_venom_snake.png'), (100, 100), (0,0,0,0), draw_venom_snake)
    create_image(os.path.join(edir, 'elite_wood_golem.png'), (160, 160), (0,0,0,0), draw_elite_golem)
    create_image(os.path.join(edir, 'boss_millennium_tree_demon.png'), (250, 250), (0,0,0,0), draw_boss_tree)
    
    # Generate background
    create_image(os.path.join(res, 'bg_grassland.png'), (720, 1280), (120, 200, 120, 255), draw_bg)
