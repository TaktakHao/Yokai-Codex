#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YokaiCodex 贴图引用完整性与渲染路径自动化校验脚本
用于校验 VisualLoader.ts, LevelManager.ts, ScrollingBackground.ts 以及 JSON 配置文件中的贴图 Key 引用。
"""

import os
import re
import json
import struct
import sys

PROJECT_ROOT = "/Users/wesson/YokaiCodex"
ASSETS_RESOURCES_DIR = os.path.join(PROJECT_ROOT, "assets", "resources")
TEXTURES_DIR = os.path.join(ASSETS_RESOURCES_DIR, "Textures")
VISUAL_LOADER_PATH = os.path.join(PROJECT_ROOT, "assets", "Scripts", "Utils", "VisualLoader.ts")
LEVEL_MANAGER_PATH = os.path.join(PROJECT_ROOT, "assets", "Scripts", "LevelManager.ts")
SCROLLING_BG_PATH = os.path.join(PROJECT_ROOT, "assets", "Scripts", "ScrollingBackground.ts")

def get_png_dimensions(file_path):
    """读取 PNG 文件头获取 width 和 height"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(24)
            if len(header) >= 24 and header.startswith(b'\x89PNG\r\n\x1a\n'):
                width, height = struct.unpack('>II', header[16:24])
                return width, height
    except Exception as e:
        print(f"读取 PNG {file_path} 尺寸出错: {e}")
    return None, None

def parse_enemy_texture_map(ts_path):
    """解析 VisualLoader.ts 中的 ENEMY_TEXTURE_MAP 字典"""
    with open(ts_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'const\s+ENEMY_TEXTURE_MAP\s*:\s*Record<string,\s*string>\s*=\s*(\{[\s\S]*?\});', content)
    if not match:
        raise ValueError("未能从 VisualLoader.ts 中解析出 ENEMY_TEXTURE_MAP")
    
    map_str = match.group(1)
    pairs = re.findall(r"['\"]([^'\"]+)['\"]\s*:\s*['\"]([^'\"]+)['\"]", map_str)
    return dict(pairs)

def parse_solid_sprite_path(ts_path):
    """解析 VisualLoader.ts 中的 SOLID_SPRITE_FRAME_PATH"""
    with open(ts_path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r"const\s+SOLID_SPRITE_FRAME_PATH\s*=\s*['\"]([^'\"]+)['\"]", content)
    return match.group(1) if match else None

def scan_disk_textures(textures_dir):
    """扫描磁盘上的 Textures 目录中的所有文件及 .meta 文件"""
    disk_files = {}
    meta_files = set()
    
    for root, dirs, files in os.walk(textures_dir):
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), ASSETS_RESOURCES_DIR)
            if f.endswith('.meta'):
                meta_files.add(rel_path)
            elif f.endswith('.png') or f.endswith('.jpg'):
                full_path = os.path.join(root, f)
                w, h = get_png_dimensions(full_path)
                disk_files[rel_path] = {
                    'full_path': full_path,
                    'width': w,
                    'height': h,
                    'rel_path_no_ext': os.path.splitext(rel_path)[0]
                }
    return disk_files, meta_files

def resolve_texture_path(texture_path, enemy_map):
    """模拟 VisualLoader.ts 的路径解析逻辑"""
    mapped_path = texture_path
    path_parts = texture_path.split('/')
    raw_name = path_parts[-1]
    
    if raw_name in enemy_map:
        mapped_path = enemy_map[raw_name]
    elif texture_path in enemy_map:
        mapped_path = enemy_map[texture_path]
        
    return mapped_path

def run_tests():
    print("==================================================")
    print("      YokaiCodex 贴图与引用完整性校验运行中       ")
    print("==================================================")
    
    test_results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # 1. 扫描磁盘
    disk_textures, meta_files = scan_disk_textures(TEXTURES_DIR)
    print(f"\n[1/5] 磁盘贴图扫描完成: 找到 {len(disk_textures)} 个图像文件, {len(meta_files)} 个 .meta 文件")
    
    # 验证磁盘图片是否都有对应的 .meta
    missing_meta = []
    for rel_path in disk_textures:
        expected_meta = rel_path + '.meta'
        if expected_meta not in meta_files:
            missing_meta.append(rel_path)
            
    test_results['total'] += 1
    if not missing_meta:
        test_results['passed'] += 1
        print("  ✅ [PASS] 所有磁盘 PNG 图片均拥有对应的 .meta 配置文件")
    else:
        test_results['failed'] += 1
        print(f"  ❌ [FAIL] 存在缺少 .meta 的图片: {missing_meta}")
    
    # 2. 解析 VisualLoader.ts
    enemy_map = parse_enemy_texture_map(VISUAL_LOADER_PATH)
    solid_path = parse_solid_sprite_path(VISUAL_LOADER_PATH)
    print(f"\n[2/5] VisualLoader.ts 解析完成:")
    print(f"  - ENEMY_TEXTURE_MAP 包含 {len(enemy_map)} 个映射条目")
    print(f"  - SOLID_SPRITE_FRAME_PATH: '{solid_path}'")
    
    # 校验 ENEMY_TEXTURE_MAP 中的每个目标路径在磁盘上是否存在
    missing_in_map = []
    placeholder_in_map = []
    
    for key, target_rel in enemy_map.items():
        test_results['total'] += 1
        expected_png_rel = target_rel + '.png'
        if expected_png_rel in disk_textures:
            info = disk_textures[expected_png_rel]
            if info['width'] <= 1 and info['height'] <= 1:
                placeholder_in_map.append((key, target_rel, info['width'], info['height']))
                test_results['failed'] += 1
                print(f"  ❌ [FAIL] 映射 Key '{key}' -> '{target_rel}' 对应的磁盘图片为 1x1 占位图 ({info['width']}x{info['height']})")
            else:
                test_results['passed'] += 1
                print(f"  ✅ [PASS] 映射 Key '{key}' -> '{target_rel}' 匹配成功 ({info['width']}x{info['height']}px)")
        else:
            missing_in_map.append((key, target_rel))
            test_results['failed'] += 1
            print(f"  ❌ [FAIL] 映射 Key '{key}' -> '{target_rel}' 磁盘文件不存在! (期待 '{expected_png_rel}')")

    # 3. 校验兜底纯色占位图路径 SOLID_SPRITE_FRAME_PATH
    test_results['total'] += 1
    solid_base_path = solid_path.replace('/spriteFrame', '') + '.png'
    if solid_base_path in disk_textures:
        test_results['passed'] += 1
        print(f"  ✅ [PASS] 兜底纯色占位图 '{solid_base_path}' 磁盘存在 ({disk_textures[solid_base_path]['width']}x{disk_textures[solid_base_path]['height']}px)")
    else:
        test_results['failed'] += 1
        print(f"  ❌ [FAIL] 兜底纯色占位图 '{solid_base_path}' 在磁盘上不存在！降级回退会引发二次错误！")

    # 4. 校验 LevelManager.ts & 关卡配置中的怪物 ID
    print(f"\n[3/5] 关卡配置与 LevelManager 刷怪路径校验:")
    config_dir = os.path.join(ASSETS_RESOURCES_DIR, "Configs")
    monster_ids_in_configs = set()
    
    for root, dirs, files in os.walk(config_dir):
        for f in files:
            if f.endswith('.json'):
                json_path = os.path.join(root, f)
                try:
                    with open(json_path, 'r', encoding='utf-8') as jf:
                        data = json.load(jf)
                    if isinstance(data, dict):
                        waves = data.get('waves', [])
                        for wave in waves:
                            groups = wave.get('monster_groups', [])
                            for g in groups:
                                if 'monster_id' in g:
                                    monster_ids_in_configs.add(g['monster_id'])
                            if 'monster_id' in wave:
                                monster_ids_in_configs.add(wave['monster_id'])
                except Exception as e:
                    print(f"  警告: 解析关卡配置 JSON {f} 失败: {e}")

    print(f"  - 从关卡配置文件中提取到 {len(monster_ids_in_configs)} 个怪物 ID: {sorted(list(monster_ids_in_configs))}")
    
    for m_id in sorted(list(monster_ids_in_configs)):
        test_results['total'] += 1
        raw_path = f"Textures/Enemies/{m_id}"
        resolved = resolve_texture_path(raw_path, enemy_map)
        expected_png = resolved + '.png'
        
        if expected_png in disk_textures:
            info = disk_textures[expected_png]
            test_results['passed'] += 1
            print(f"  ✅ [PASS] 关卡怪物 ID '{m_id}' -> 解析路径 '{resolved}' -> 磁盘文件找到 ({info['width']}x{info['height']}px)")
        else:
            test_results['failed'] += 1
            print(f"  ❌ [FAIL] 关卡怪物 ID '{m_id}' -> 解析路径 '{resolved}' -> 磁盘文件 '{expected_png}' 不存在！")

    # 校验 Enemy.ts / PlayerController.ts / PetFollower.ts 代码硬编码默认路径
    code_default_paths = [
        ("Enemy.ts default", "Textures/Enemies/monster_1"),
        ("PlayerController.ts default", "Textures/Player/player"),
        ("PetFollower.ts default", "Textures/Enemies/monster_1"),
        ("ScrollingBackground.ts default", "Textures/bg_grassland")
    ]
    
    print(f"\n[4/5] 脚本默认硬编码贴图路径校验:")
    for label, raw_path in code_default_paths:
        test_results['total'] += 1
        resolved = resolve_texture_path(raw_path, enemy_map)
        expected_png = resolved + '.png'
        if expected_png in disk_textures:
            info = disk_textures[expected_png]
            test_results['passed'] += 1
            print(f"  ✅ [PASS] [{label}] '{raw_path}' -> 解析路径 '{resolved}' -> 磁盘存在 ({info['width']}x{info['height']}px)")
        else:
            test_results['failed'] += 1
            print(f"  ❌ [FAIL] [{label}] '{raw_path}' -> 解析路径 '{resolved}' -> 磁盘不存在 '{expected_png}'！")

    # 5. 校验无缝背景 bg_grassland.png 的缩放与渲染路径
    print(f"\n[5/5] 无缝背景 bg_grassland.png 缩放与渲染路径专项校验:")
    bg_rel_png = "Textures/bg_grassland.png"
    test_results['total'] += 1
    if bg_rel_png in disk_textures:
        info = disk_textures[bg_rel_png]
        print(f"  - 磁盘文件: {info['full_path']}")
        print(f"  - 原始尺寸: {info['width']}x{info['height']}px")
        
        with open(SCROLLING_BG_PATH, 'r', encoding='utf-8') as f:
            bg_code = f.read()
            
        tile_size_match = re.search(r"private\s+tileSize\s*:\s*number\s*=\s*(\d+);", bg_code)
        tile_size = int(tile_size_match.group(1)) if tile_size_match else 0
        
        print(f"  - ScrollingBackground.ts 设定切片尺寸 tileSize = {tile_size}px")
        
        if tile_size > 0 and info['width'] > 1 and info['height'] > 1:
            test_results['passed'] += 1
            print(f"  ✅ [PASS] bg_grassland.png 存在，尺寸为 {info['width']}x{info['height']}px，将在 3x3 九宫格中缩放到 {tile_size}x{tile_size}px 进行无缝拼接渲染。")
        else:
            test_results['failed'] += 1
            print(f"  ❌ [FAIL] bg_grassland.png 尺寸异常或 tileSize 解析失败！")
    else:
        test_results['failed'] += 1
        print(f"  ❌ [FAIL] bg_grassland.png 磁盘文件不存在！")

    # Summary
    print("\n==================================================")
    print(f"  校验完成! 总测试数: {test_results['total']} | 通过: {test_results['passed']} | 失败: {test_results['failed']}")
    print("==================================================")
    
    return test_results

if __name__ == '__main__':
    results = run_tests()
    if results['failed'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)
