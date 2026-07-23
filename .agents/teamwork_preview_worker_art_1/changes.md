# 变更记录 (Changes Log)

## 1. 新增/修改的文件清单

| 文件路径 | 操作类型 | 变更摘要 |
| :--- | :--- | :--- |
| `Design/Art_Style_Guide.md` | 新增 | 详细制定 YokaiCodex 简约可爱 Q版 (Chibi 2D) 美术风格规范指南 |
| `generate_and_process_art.py` | 新增 | 自动化生成与 Pillow 后处理第一关卡全套 2D RGBA 图像资产脚本 |
| `assets/resources/Textures/Player/player.png` | 修改/覆盖 | 256x256 RGBA Q版主角修仙者贴图 (带平滑 Alpha 通道) |
| `assets/resources/Textures/bg_grassland.png` | 修改/覆盖 | 720x1280 RGB 关卡无缝草地背景贴图 |
| `assets/resources/Textures/Enemies/boss_millennium_tree_demon.png` | 修改/覆盖 | 256x256 RGBA Boss 千年树妖贴图 |
| `assets/resources/Textures/Enemies/boss_1.png` | 修改/覆盖 | 256x256 RGBA Boss 占位兼容贴图 |
| `assets/resources/Textures/Enemies/mob_grass_sprite.png` | 修改/覆盖 | 80x80 RGBA 小怪-青草精贴图 |
| `assets/resources/Textures/Enemies/mob_wood_spirit.png` | 修改/覆盖 | 90x90 RGBA 小怪-木灵贴图 |
| `assets/resources/Textures/Enemies/mob_venom_snake.png` | 修改/覆盖 | 100x100 RGBA 小怪-毒液蛇贴图 |
| `assets/resources/Textures/Enemies/mob_gale_wolf.png` | 修改/覆盖 | 100x100 RGBA 小怪-疾风狼贴图 |
| `assets/resources/Textures/Enemies/elite_grass_brute.png` | 修改/覆盖 | 140x140 RGBA 精英怪-草莽蛮兽贴图 |
| `assets/resources/Textures/Enemies/elite_gale_wolf_alpha.png` | 修改/覆盖 | 150x150 RGBA 精英怪-疾风狼王贴图 |
| `assets/resources/Textures/Enemies/elite_wood_golem.png` | 修改/覆盖 | 160x160 RGBA 精英怪-树精傀儡贴图 |
| `assets/resources/Textures/Enemies/monster_1.png` | 修改/覆盖 | 100x100 RGBA 通用小怪占位贴图 |
| `assets/resources/Textures/Enemies/monster_2.png` | 修改/覆盖 | 100x100 RGBA 通用小怪占位贴图 |
| `assets/Scripts/Utils/VisualLoader.ts` | 修改 | 更新 `ENEMY_TEXTURE_MAP` 字典，去除旧占位图强制重定向，指向磁盘真实专属贴图 |
| `assets/Scripts/Logic/Enemy.ts` | 修改 | 更新 `getOriginalColor()` 返回 `Color(255, 255, 255, 255)`，呈现真彩 RGBA 贴图 |

## 2. 设计与技术决策 rationale
- **抗锯齿与 Alpha 平滑**：在 `generate_and_process_art.py` 中引入 4x 超采样 (Supersampling) 与 Lanczos 降采样算法，自动生成自带边缘 Alpha 平滑的 32-bit RGBA 图像，彻底杜绝锯齿与纯白底色。
- **解绑占位图重定向**：修正 `VisualLoader.ts` 中的路径字典，使每个怪物/Boss 都能正确加载其专属的高清全彩 PNG。
