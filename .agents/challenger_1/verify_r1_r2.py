#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《万妖录：躺平修仙》第一关 R1/R2 核心逻辑实证测试与验证脚本
Adversarial Challenger 1 Empirical Test Suite
"""

import sys
import math
import random

class Color:
    def __init__(self, r, g, b, a=255):
        self.r = r
        self.g = g
        self.b = b
        self.a = a

    def __eq__(self, other):
        return isinstance(other, Color) and self.r == other.r and self.g == other.g and self.b == other.b and self.a == other.a

    def __repr__(self):
        return f"Color({self.r}, {self.g}, {self.b}, {self.a})"

class Size:
    def __init__(self, width, height):
        self.width = width
        self.height = height
    def __eq__(self, other):
        return isinstance(other, Size) and self.width == other.width and self.height == other.height
    def __repr__(self):
        return f"Size({self.width}, {self.height})"

class Vec3:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x = float(x)
        self.y = float(y)
        self.z = float(z)

    def length(self):
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)

    def normalize(self):
        l = self.length()
        if l > 0:
            self.x /= l
            self.y /= l
            self.z /= l
        return self

    def clone(self):
        return Vec3(self.x, self.y, self.z)

    def distance(self, other):
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2 + (self.z - other.z)**2)

    def __eq__(self, other):
        return isinstance(other, Vec3) and abs(self.x - other.x) < 0.001 and abs(self.y - other.y) < 0.001 and abs(self.z - other.z) < 0.001

    def __repr__(self):
        return f"Vec3({self.x:.2f}, {self.y:.2f}, {self.z:.2f})"

# ----------------------------------------------------
# 精确 1:1 镜像 Enemy.ts 原版逻辑（包括已知 Bug 逻辑）
# ----------------------------------------------------
class RawEnemy:
    def __init__(self, monster_id, name, base_hp, move_speed, attack_damage, is_elite=False):
        self.monster_id = monster_id
        self.name = name
        self.max_hp = base_hp
        self.current_hp = base_hp
        self.move_speed = move_speed
        self.attack_damage = attack_damage
        self.is_elite = is_elite
        self.texture_path = f"Textures/Enemies/{monster_id}"
        self.world_position = Vec3(0, 0, 0)
        self.is_dead = False
        self.sprite_color = self.get_original_color()
        self.size = Size(48, 48)
        self.scale = Vec3(1, 1, 1)
        self.setup_visual()

    def apply_relic_speed_bonus(self, has_relic_treasure_bowl=False):
        if has_relic_treasure_bowl:
            self.move_speed *= 1.2

    def get_original_color(self):
        # 原版 Enemy.ts lines 113-130
        path = self.texture_path or ''
        if self.is_elite:
            return Color(255, 215, 80, 255)  # 精英怪：金黄色
        if 'grass_sprite' in path:
            return Color(120, 230, 120, 255) # 草精：嫩绿
        elif 'wood_spirit' in path:
            return Color(210, 180, 120, 255) # 木灵：金褐
        elif 'venom_snake' in path:
            return Color(190, 110, 230, 255) # 毒蛇：毒紫
        elif 'gale_wolf' in path:
            return Color(110, 210, 255, 255) # 疾风狼：青蓝
        elif 'boss' in path:
            return Color(255, 80, 80, 255)   # BOSS：深血红
        return Color(255, 255, 255, 255)

    def setup_visual(self):
        # 原版 Enemy.ts lines 136-160
        size = Size(48, 48)
        scale = Vec3(1, 1, 1)
        color = self.get_original_color()

        path = self.texture_path
        if 'boss' in path:
            size = Size(96, 96)
            scale = Vec3(2.2, 2.2, 1)

        if self.is_elite:
            size = Size(64, 64)
            scale = Vec3(1.5, 1.5, 1)

        self.size = size
        self.scale = scale
        self.sprite_color = color

    def handle_chase(self, target_pos, delta_time):
        if self.is_dead:
            return
        dir_vec = Vec3(target_pos.x - self.world_position.x,
                       target_pos.y - self.world_position.y,
                       target_pos.z - self.world_position.z)
        dist = dir_vec.length()
        if dist > 5.0:
            dir_vec.normalize()
            self.world_position.x += dir_vec.x * self.move_speed * delta_time
            self.world_position.y += dir_vec.y * self.move_speed * delta_time
            self.world_position.z += dir_vec.z * self.move_speed * delta_time

    def play_hit_flash(self):
        self.sprite_color = Color(255, 60, 60, 255)

    def restore_original_color(self):
        self.sprite_color = self.get_original_color()

    def take_damage(self, amount):
        if amount <= 0 or self.is_dead:
            return
        self.current_hp = max(0, self.current_hp - amount)
        self.play_hit_flash()
        if self.current_hp <= 0:
            self.is_dead = True

# ----------------------------------------------------
# 模拟 EffectManager.ts & PoolManager.ts
# ----------------------------------------------------
class MockPoolManager:
    def __init__(self):
        self.pools = {}

    def put_node(self, pool_key, node_id):
        if pool_key not in self.pools:
            self.pools[pool_key] = []
        self.pools[pool_key].append(node_id)

    def get_node(self, pool_key):
        if pool_key in self.pools and len(self.pools[pool_key]) > 0:
            return self.pools[pool_key].pop()
        return None

class MockEffectManager:
    def __init__(self, pool_mgr):
        self.pool_mgr = pool_mgr
        self.active_damage_texts = []

    def show_damage_text(self, pos, damage, is_critical=False):
        spawn_pos = Vec3(pos.x, pos.y + 40, pos.z)
        reused_node = self.pool_mgr.get_node('DamageText')
        node_id = reused_node if reused_node else f"DamageText_{len(self.active_damage_texts)+1}"
        
        font_size = 28 if is_critical else 20
        label_str = f"【暴击】-{damage}" if is_critical else f"-{damage}"
        label_color = Color(255, 30, 30, 255) if is_critical else Color(255, 60, 60, 255)
        scale = (1.3, 1.3, 1.0) if is_critical else (1.0, 1.0, 1.0)

        record = {
            'id': node_id,
            'spawn_pos': spawn_pos,
            'target_y': spawn_pos.y + 60,
            'font_size': font_size,
            'label_str': label_str,
            'label_color': label_color,
            'scale': scale,
            'duration': 0.6,
            'is_reused': reused_node is not None
        }
        self.active_damage_texts.append(record)
        return record

    def complete_tween_and_recycle(self, record):
        self.active_damage_texts.remove(record)
        self.pool_mgr.put_node('DamageText', record['id'])

# ----------------------------------------------------
# 模拟 PlayerController.ts
# ----------------------------------------------------
class MockPlayerController:
    def __init__(self, pos=Vec3(0, 0, 0)):
        self.position = pos
        self.attack_range = 300.0
        self.attack_damage = 10.0
        self.attack_cooldown = 1.0
        self.current_hp = 100
        self.max_hp = 100

    def find_nearest_enemy(self, enemies):
        target = None
        min_dist = self.attack_range
        for enemy in enemies:
            if enemy.is_dead:
                continue
            dist = self.position.distance(enemy.world_position)
            if dist <= min_dist:
                min_dist = dist
                target = enemy
        return target, min_dist

    def execute_auto_attack(self, enemies, gold_atk_bonus=0.0, fire_crit_bonus=0.0, has_vampire_sword=False, force_crit=None):
        target, dist = self.find_nearest_enemy(enemies)
        if not target:
            return None

        effective_base_atk = self.attack_damage * 0.5 if has_vampire_sword else self.attack_damage
        final_damage = math.floor(effective_base_atk * (1 + gold_atk_bonus))

        crit_rate = 0.05 + fire_crit_bonus
        is_crit = force_crit if force_crit is not None else (random.random() < crit_rate)

        if is_crit:
            final_damage = math.floor(final_damage * 1.5)

        target.take_damage(final_damage)

        healed = 0
        if has_vampire_sword and final_damage > 0:
            healed = max(1, math.floor(final_damage * 0.05))
            self.current_hp = min(self.max_hp, self.current_hp + healed)

        return {
            'target': target,
            'damage': final_damage,
            'is_crit': is_crit,
            'dist': dist,
            'healed': healed
        }

# ----------------------------------------------------
# 模拟 PetFollower.ts
# ----------------------------------------------------
class MockPetFollower:
    def __init__(self, pet_index, total_pets, pet_data):
        self.pet_index = pet_index
        self.total_pets = total_pets
        self.pet_data = pet_data
        self.position = Vec3(0, 0, 0)

    def calculate_target_offset(self, player_pos):
        angle_step = 360.0 / max(1, self.total_pets)
        angle_rad = (self.pet_index * angle_step) * math.pi / 180.0
        radius = 64.0
        target_x = player_pos.x + math.cos(angle_rad) * radius
        target_y = player_pos.y + math.sin(angle_rad) * radius
        return Vec3(target_x, target_y, player_pos.z)

    def follow_player(self, player_pos, lerp_factor=0.08):
        target_pos = self.calculate_target_offset(player_pos)
        self.position.x = self.position.x + (target_pos.x - self.position.x) * lerp_factor
        self.position.y = self.position.y + (target_pos.y - self.position.y) * lerp_factor
        self.position.z = self.position.z + (target_pos.z - self.position.z) * lerp_factor
        return self.position

    def calculate_projectile_size(self):
        star = self.pet_data.get('star', 1)
        is_evolved = self.pet_data.get('isEvolved', False)
        star_bonus = 1.0 + (star - 1) * 0.1
        evolved_scale = 1.5 if is_evolved else 1.0
        return math.floor(14 * star_bonus * evolved_scale)

    def get_projectile_color(self):
        element = self.pet_data.get('element')
        rarity = self.pet_data.get('rarity')

        if element:
            if element == '金': return Color(255, 215, 0, 255)
            elif element == '木': return Color(60, 220, 100, 255)
            elif element == '水': return Color(80, 180, 255, 255)
            elif element == '火': return Color(255, 70, 70, 255)
            elif element == '土': return Color(210, 160, 60, 255)
        
        if rarity == '传说': return Color(255, 200, 50, 255)
        elif rarity == '神话': return Color(255, 50, 50, 255)
        elif rarity == '史诗': return Color(200, 100, 255, 255)
        return Color(120, 255, 120, 255)

# ----------------------------------------------------
# 模拟 PetCaptureManager.ts
# ----------------------------------------------------
class MockPetCaptureManager:
    def __init__(self):
        self.base_capture_rate = 0.1
        self.execute_bonus_weight = 0.5
        self.gourd_fail_count = 0
        self.pet_eggs = []

    def calculate_capture_rate(self, current_hp, max_hp, item_bonus=0.0, has_gourd=False):
        if max_hp <= 0: return 0.0
        curr_hp = max(0, min(current_hp, max_hp))
        hp_loss_ratio = 1.0 - (curr_hp / max_hp)
        extra_gourd = (self.gourd_fail_count * 0.05) if has_gourd else 0.0
        total_rate = self.base_capture_rate + (hp_loss_ratio * self.execute_bonus_weight) + item_bonus + extra_gourd
        return min(1.0, max(0.0, total_rate))

    def attempt_capture(self, monster, item_bonus=0.0, has_gourd=False, force_roll=None):
        rate = self.calculate_capture_rate(monster['currentHp'], monster['maxHp'], item_bonus, has_gourd)
        roll = force_roll if force_roll is not None else random.random()
        if roll < rate:
            if has_gourd:
                self.gourd_fail_count = 0
            egg = {
                'eggId': f"egg_{len(self.pet_eggs)+1}",
                'monsterType': monster.get('name', '未知妖兽'),
                'rarity': monster.get('rarity', '普通'),
                'star': 1,
                'isEvolved': False
            }
            self.pet_eggs.append(egg)
            return egg
        else:
            if has_gourd:
                self.gourd_fail_count += 1
            return None

# ====================================================
# TEST RUNNER & ASSERTIONS
# ====================================================
def run_tests():
    print("=== 开始对抗性实证测试 (Adversarial Empirical Test Suite) ===\n")
    passed_count = 0
    total_tests = 0
    findings = []

    def assert_test(condition, name, details=""):
        nonlocal passed_count, total_tests
        total_tests += 1
        if condition:
            passed_count += 1
            print(f"[PASS] {name} - {details}")
        else:
            print(f"[FAIL] {name} - {details}")

    # ------------------------------------------------
    # 1. R1 需求闭环实证测试
    # ------------------------------------------------
    print("--- [R1.1] 怪物 AI 追击向量、速度与 Color Tint 测试 ---")

    # Grass Sprite
    grass = RawEnemy('mob_grass_sprite', '草精', base_hp=40, move_speed=90, attack_damage=8)
    assert_test(grass.get_original_color() == Color(120, 230, 120, 255), "草精 Tint 恢复", f"RGB={grass.get_original_color()}")
    assert_test(grass.scale == Vec3(1, 1, 1) and grass.size == Size(48, 48), "草精 Scale/Size", f"Size={grass.size}, Scale={grass.scale}")

    # Wood Spirit
    wood = RawEnemy('mob_wood_spirit', '木灵', base_hp=80, move_speed=85, attack_damage=15)
    assert_test(wood.get_original_color() == Color(210, 180, 120, 255), "木灵 Tint 恢复", f"RGB={wood.get_original_color()}")

    # Elite Monster
    elite = RawEnemy('elite_grass_brute', '精英草精', base_hp=1200, move_speed=110, attack_damage=35, is_elite=True)
    assert_test(elite.get_original_color() == Color(255, 215, 80, 255), "精英怪 金色 Tint 恢复", f"RGB={elite.get_original_color()}")
    assert_test(elite.scale == Vec3(1.5, 1.5, 1) and elite.size == Size(64, 64), "精英怪 1.5x 放大", f"Size={elite.size}, Scale={elite.scale}")

    # BOSS Test (Testing for Overwrite Bug!)
    boss = RawEnemy('boss_millennium_tree_demon', '千年树妖', base_hp=25000, move_speed=75, attack_damage=120, is_elite=True)

    # Empirical check on Boss Tint: Expected blood red (255, 80, 80) vs actual (255, 215, 80)
    actual_boss_color = boss.get_original_color()
    is_boss_color_correct = (actual_boss_color == Color(255, 80, 80, 255))
    assert_test(is_boss_color_correct, "BOSS 专属深血红 Tint (Enemy.ts:115 is_elite 优先判定缺陷)", f"Actual RGB={actual_boss_color}, Expected RGB=Color(255, 80, 80)")
    if not is_boss_color_correct:
        findings.append("【缺陷 FINDING-01】Enemy.ts 中 getOriginalColor() 的 isElite 条件在前，导致带 is_elite=true 的 BOSS 无法取得 deep blood red (255, 80, 80)，而被覆盖为精英怪金色 (255, 215, 80)。")

    # Empirical check on Boss Scale/Size: Expected 2.2x & 96x96 vs actual 1.5x & 64x64
    is_boss_scale_correct = (boss.scale == Vec3(2.2, 2.2, 1) and boss.size == Size(96, 96))
    assert_test(is_boss_scale_correct, "BOSS 专属 2.2x 尺寸放大 (Enemy.ts:148 setupVisual 被 isElite 覆盖缺陷)", f"Actual Size={boss.size}, Scale={boss.scale}; Expected Size=96x96, Scale=2.2x")
    if not is_boss_scale_correct:
        findings.append("【缺陷 FINDING-02】Enemy.ts 中 setupVisual() 中 isElite 逻辑在 boss 逻辑之后执行，导致 is_elite=true 的 BOSS 的 2.2x 放大与 96x96 尺寸被强制覆盖为 1.5x 放大与 64x64 尺寸。")

    # Relic Speed Bonus
    grass.apply_relic_speed_bonus(has_relic_treasure_bowl=True)
    assert_test(abs(grass.move_speed - 108.0) < 0.001, "聚宝盆移速提升 20%", f"Original 90 -> {grass.move_speed}")

    # Chase AI Test
    grass.world_position = Vec3(0, 0, 0)
    target = Vec3(100, 0, 0)
    dt = 0.1 # 100ms step
    grass.handle_chase(target, dt)
    expected_x = 108.0 * 0.1 # 10.8
    assert_test(abs(grass.world_position.x - expected_x) < 0.001, "AI 追击向量步骤", f"Expected x={expected_x}, Actual x={grass.world_position.x}")

    # Minimum stop distance check (> 5.0)
    grass.world_position = Vec3(96, 0, 0) # dist = 4.0 <= 5.0
    prev_pos_x = grass.world_position.x
    grass.handle_chase(target, dt)
    assert_test(grass.world_position.x == prev_pos_x, "AI 最小停止距离(<=5px不位移)", f"Position unchanged at dist 4.0")

    print("\n--- [R1.2] 玩家 300px 最邻近索敌与自动射击判定测试 ---")
    player = MockPlayerController(Vec3(0, 0, 0))
    e1 = RawEnemy('m1', 'Far Enemy', 100, 100, 10)
    e1.world_position = Vec3(400, 0, 0) # > 300px

    e2 = RawEnemy('m2', 'Near Enemy 1', 100, 100, 10)
    e2.world_position = Vec3(250, 0, 0) # <= 300px

    e3 = RawEnemy('m3', 'Nearest Enemy', 100, 100, 10)
    e3.world_position = Vec3(150, 0, 0) # <= 300px

    target_found, dist = player.find_nearest_enemy([e1, e2, e3])
    assert_test(target_found == e3 and abs(dist - 150.0) < 0.001, "最邻近 300px 索敌", f"Found {target_found.name} at dist {dist}")

    # Attack execution with 3-Gold (+20% ATK) and 3-Fire (+20% Crit)
    res = player.execute_auto_attack([e1, e2, e3], gold_atk_bonus=0.20, fire_crit_bonus=0.20, force_crit=True)
    assert_test(res['damage'] == 18, "自动攻击与共鸣暴击计算", f"Damage={res['damage']} (Base 10 -> Gold 12 -> Crit 18)")
    assert_test(e3.current_hp == 82, "敌人扣减 HP", f"HP=100 - 18 = {e3.current_hp}")

    # Vampire sword test
    player.current_hp = 50
    res_vamp = player.execute_auto_attack([e3], has_vampire_sword=True, force_crit=False)
    assert_test(res_vamp['damage'] == 5, "吸血魔剑攻击力减半", f"Damage = {res_vamp['damage']}")
    assert_test(res_vamp['healed'] == 1 and player.current_hp == 51, "吸血魔剑 5% 吸血恢复", f"Player HP = {player.current_hp}")

    print("\n--- [R1.3] 受击红闪与伤害飘字 (EffectManager & PoolManager) 测试 ---")
    assert_test(e3.sprite_color == Color(255, 60, 60, 255), "Enemy 受击红闪 0.1s Flash Color", f"Color={e3.sprite_color}")
    e3.restore_original_color()
    assert_test(e3.sprite_color == Color(255, 255, 255, 255), "Enemy 恢复固有 Color Tint", f"Color={e3.sprite_color}")

    pool_mgr = MockPoolManager()
    effect_mgr = MockEffectManager(pool_mgr)
    hit_pos = Vec3(100, 100, 0)
    rec_normal = effect_mgr.show_damage_text(hit_pos, 10, is_critical=False)
    assert_test(rec_normal['label_str'] == "-10" and rec_normal['spawn_pos'].y == 140.0 and rec_normal['label_color'] == Color(255, 60, 60, 255),
                "普通受击飘字生成", f"Text='{rec_normal['label_str']}', Y={rec_normal['spawn_pos'].y}")

    rec_crit = effect_mgr.show_damage_text(hit_pos, 25, is_critical=True)
    assert_test(rec_crit['label_str'] == "【暴击】-25" and rec_crit['font_size'] == 28 and rec_crit['scale'] == (1.3, 1.3, 1.0),
                "暴击飘字 1.3x 缩放与红色字体", f"Text='{rec_crit['label_str']}'")

    effect_mgr.complete_tween_and_recycle(rec_normal)
    assert_test('DamageText' in pool_mgr.pools and len(pool_mgr.pools['DamageText']) == 1, "0.6s 淡出后回收至 PoolManager", "Pool count = 1")

    rec_reused = effect_mgr.show_damage_text(hit_pos, 15, is_critical=False)
    assert_test(rec_reused['is_reused'] is True, "对象池 Node 复用成功", f"Reused Node ID={rec_reused['id']}")

    # ------------------------------------------------
    # 2. R2 宠物与抓捕机制实证测试
    # ------------------------------------------------
    print("\n--- [R2.1] 多宠物 360° 环形偏置跟随与飞弹尺寸/颜色化形测试 ---")
    player_pos = Vec3(100, 100, 0)
    total_pets = 4

    # Pet 0 (0 degrees)
    pet0 = MockPetFollower(0, total_pets, {'star': 1, 'isEvolved': False, 'element': '金'})
    target_p0 = pet0.calculate_target_offset(player_pos)
    assert_test(abs(target_p0.x - 164.0) < 0.001 and abs(target_p0.y - 100.0) < 0.001, "0° 环形偏置点", f"Target={target_p0}")

    # Pet 1 (90 degrees)
    pet1 = MockPetFollower(1, total_pets, {'star': 3, 'isEvolved': False, 'element': '木'})
    target_p1 = pet1.calculate_target_offset(player_pos)
    assert_test(abs(target_p1.x - 100.0) < 0.001 and abs(target_p1.y - 164.0) < 0.001, "90° 环形偏置点", f"Target={target_p1}")

    # Interpolation跟随
    pet0.position = Vec3(100, 100, 0)
    pos_after_lerp = pet0.follow_player(player_pos, lerp_factor=0.08)
    assert_test(abs(pos_after_lerp.x - 105.12) < 0.001, "插值缓动跟随 (lerp=0.08)", f"Pos x={pos_after_lerp.x}")

    # Projectile Size Calculations
    assert_test(pet0.calculate_projectile_size() == 14, "1星普通飞弹尺寸 (14px)", f"Size={pet0.calculate_projectile_size()}")

    pet_max = MockPetFollower(2, total_pets, {'star': 5, 'isEvolved': True, 'element': '水'})
    assert_test(pet_max.calculate_projectile_size() == 29, "5星化形飞弹尺寸突破 (+50% 化形放大 = 29px)", f"Size={pet_max.calculate_projectile_size()}")

    # Projectile Colors
    assert_test(pet0.get_projectile_color() == Color(255, 215, 0, 255), "金系飞弹颜色", f"Color={pet0.get_projectile_color()}")
    assert_test(pet1.get_projectile_color() == Color(60, 220, 100, 255), "木系飞弹颜色", f"Color={pet1.get_projectile_color()}")
    assert_test(pet_max.get_projectile_color() == Color(80, 180, 255, 255), "水系飞弹颜色", f"Color={pet_max.get_projectile_color()}")

    print("\n--- [R2.2] 葫芦抓捕公式 (HP < 10% 斩杀概率) 与对象池回收测试 ---")
    capture_mgr = MockPetCaptureManager()

    rate_full = capture_mgr.calculate_capture_rate(100, 100)
    assert_test(abs(rate_full - 0.10) < 0.001, "满血抓捕率 (10%)", f"Rate={rate_full}")

    rate_10pct = capture_mgr.calculate_capture_rate(10, 100)
    assert_test(abs(rate_10pct - 0.55) < 0.001, "10% HP 斩杀抓捕率 (55%)", f"Rate={rate_10pct}")

    rate_5pct = capture_mgr.calculate_capture_rate(5, 100)
    assert_test(abs(rate_5pct - 0.575) < 0.001, "5% HP (<10%) 斩杀抓捕率 (57.5%)", f"Rate={rate_5pct}")

    monster_input = {'currentHp': 5, 'maxHp': 100, 'name': '精英草精', 'rarity': '稀有'}
    egg = capture_mgr.attempt_capture(monster_input, force_roll=0.30)
    assert_test(egg is not None and egg['monsterType'] == '精英草精' and egg['rarity'] == '稀有',
                "抓捕成功生成盲盒妖兽蛋 PetEgg", f"Egg={egg}")
    assert_test(len(capture_mgr.pet_eggs) == 1, "妖兽蛋加入背包", f"Egg count={len(capture_mgr.pet_eggs)}")

    capture_mgr.attempt_capture(monster_input, has_gourd=True, force_roll=0.99)
    assert_test(capture_mgr.gourd_fail_count == 1, "吞天葫芦抓捕失败计数 +1", f"Fail count={capture_mgr.gourd_fail_count}")

    rate_with_gourd_bonus = capture_mgr.calculate_capture_rate(5, 100, has_gourd=True)
    assert_test(abs(rate_with_gourd_bonus - 0.625) < 0.001, "吞天葫芦失败后 5% 概率叠加", f"Rate={rate_with_gourd_bonus}")

    print(f"\n====================================================")
    print(f"实证测试完成！测试用例总计: {total_tests}, 通过: {passed_count}, 缺陷项: {len(findings)}")
    print(f"====================================================")
    if findings:
        print("\n发现的实际缺陷列表 (Discovered Findings):")
        for f in findings:
            print(f"- {f}")

if __name__ == '__main__':
    run_tests()
