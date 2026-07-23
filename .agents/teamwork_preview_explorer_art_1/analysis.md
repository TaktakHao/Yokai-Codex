# 第一关卡美术资产探查与代码引用深度分析报告 (Analysis Report)

## 1. 探查概述
本报告由 Explorer Agent (`teamwork_preview_explorer_art_1`) 对项目 `/Users/wesson/YokaiCodex` 中的美术贴图资源及 TypeScript 资源加载引用逻辑进行深入探查，并针对“简约、可爱”风格 (Chibi / 2D Q版可爱风) 拟定全套美术规范指南与后续生成/处理建议。

---

## 2. 贴图资源明细清单 (`assets/resources/Textures/`)

通过 Python PIL 自动化工具对 `/Users/wesson/YokaiCodex/assets/resources/Textures/` 目录下全部资源进行像素级探查，整理第一关卡涉及的所有资产属性如下：

| 资产类别 | 逻辑 ID / 文件路径 | 宽高尺寸 (px) | 格式 (Format) | 色彩模式 (Mode) | 当前用途及状态说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主角** | `Player/player.png` | 256 x 256 | PNG | RGBA (8-bit alpha) | 玩家主角基本贴图，具透明通道 |
| **背景** | `bg_grassland.png` | 720 x 1280 | PNG | RGB | 第一关无缝无边界拼贴草地背景 |
| **BOSS** | `Enemies/boss_millennium_tree_demon.png` | 256 x 256 | PNG | RGBA | 关卡终极Boss千年树妖高清贴图 |
| **小怪 1** | `Enemies/mob_grass_sprite.png` | 80 x 80 | PNG | RGBA | 青草精/小草精专用贴图 |
| **小怪 2** | `Enemies/mob_wood_spirit.png` | 90 x 90 | PNG | RGBA | 木灵专用贴图 |
| **小怪 3** | `Enemies/mob_venom_snake.png` | 100 x 100 | PNG | RGBA | 毒蛇专用贴图 |
| **小怪 4** | `Enemies/mob_gale_wolf.png` | 100 x 100 | PNG | RGBA | 疾风狼专用贴图 |
| **精英怪 1** | `Enemies/elite_grass_brute.png` | 140 x 140 | PNG | RGBA | 精英草莽蛮兽专用贴图 |
| **精英怪 2** | `Enemies/elite_gale_wolf_alpha.png` | 150 x 150 | PNG | RGBA | 精英疾风狼王专用贴图 |
| **精英怪 3** | `Enemies/elite_wood_golem.png` | 160 x 160 | PNG | RGBA | 精英树精傀儡专用贴图 |
| **占位图** | `Enemies/boss_1.png` | 1 x 1 | PNG | LA | 历史遗留占位图 |
| **占位图** | `Enemies/monster_1.png` | 1024 x 1024 | PNG | RGB | 历史遗留通用怪贴图 |
| **占位图** | `Enemies/monster_2.png` | 1 x 1 | PNG | LA | 历史遗留占位图 |
| **UI 背景** | `UI/background.png` | 768 x 1376 | PNG | RGB | 全屏 UI 面板背景 |
| **UI 纯色** | `UI/white.png` | 1 x 1 | PNG | LA | 用于 VisualLoader 降级渲染纯色块 |

---

## 3. TypeScript 代码资源加载与引用机制探查

在分析 `.ts` 代码（尤其是 `VisualLoader.ts`、`LevelManager.ts`、`Enemy.ts`、`ScrollingBackground.ts`、`PlayerController.ts`）后，梳理出以下逻辑：

### 3.1 核心加载机制 (`VisualLoader.ts`)
- **资源路径补齐**：调用 `resources.load(path, SpriteFrame)` 异步加载贴图，会自动为相对路径拼接 `/spriteFrame` 后缀（例如将 `'Textures/Player/player'` 解析为 `'Textures/Player/player/spriteFrame'`）。
- **动态节点挂载**：`VisualLoader.loadVisual(targetNode, texturePath, options)` 会自动检查并挂载名为 `'Visual'` 的子节点，附带 `Sprite` 与 `UITransform` 组件。
- **降级保护机制**：若贴图加载失败或识别为 `1x1` 像素的占位图（如 `boss_1.png`），会自动回退并挂载 `Textures/UI/white/spriteFrame` 纯色块，防止页面黑屏报错。

### 3.2 发现的关键代码隐患与逻辑不一致
1. **硬编码字典字典降级拦截** (`VisualLoader.ts` Line 20-32)：
   在 `ENEMY_TEXTURE_MAP` 中，怪物 ID 被硬编码映射到了旧占位图：
   ```typescript
   const ENEMY_TEXTURE_MAP: Record<string, string> = {
       'mob_grass_sprite': 'Textures/Enemies/monster_1',
       'mob_wood_spirit': 'Textures/Enemies/monster_1',
       'mob_venom_snake': 'Textures/Enemies/monster_2',
       'mob_gale_wolf': 'Textures/Enemies/monster_2',
       'elite_grass_brute': 'Textures/Enemies/boss_1',
       'boss_millennium_tree_demon': 'Textures/Enemies/boss_1',
       // ...
   };
   ```
   **影响**：导致即便磁盘上已存在 `boss_millennium_tree_demon.png` (256x256) 或 `mob_grass_sprite.png` (80x80)，游戏运行时也会因为该映射表强制重定向到 1x1 占位图，触发降级逻辑渲染纯色方块。后续需要移除或修正该映射。
2. **代码级 Color Tint 强行补救** (`Enemy.ts` Line 113-131)：
   因为之前贴图全是占位色块，`Enemy.ts` 内部编写了 `getOriginalColor()` 函数，通过对不同怪物路径判定并赋予不同的 RGB 染色（如草精嫩绿 `Color(120, 230, 120)`、BOSS 深血红 `Color(255, 80, 80)`）。换用真彩萌系贴图后，需关注染色是否会导致贴图变色。

---

## 4. Q 版可爱风 (Chibi 2D) 美术风格规范指南草案

为确保后续生成与替换的美术素材风格统一，规范要点如下：

### 4.1 角色头身比例 (Proportion)
- **比例标准**：严格控制为 **Q 版 2 头身 (2-head-tall Chibi)**。
- **头部特征**：头部约占全身高度的 45%~50%，五官集中在脸部中下三分之一。大眼睛占脸部面积约 30%，内含萌系双闪光高光点，面颊带微红晕。
- **身体与四肢**：极度简化四肢结构，手脚呈现圆润胶囊状/球状，不单独刻画手指/脚趾，避免硬朗线条与肌肉轮廓。

### 4.2 色彩饱和度与调色板 (Color Palette)
- **色彩倾向**：高明度 (Brightness)、中高饱和度 (Saturation)，清新明快，带有治愈感与卡通水彩/矢量画风。
- **主色调配置**：
  - 自然场景/草地：嫩草绿 (`#7BD864`)、暖阳黄 (`#FFD15C`)
  - 玩家角色：奶白、明黄、天蓝 (`#5CB8FF`)
  - 妖怪/敌方：保留萌感的同时使用代表属性的标志色（如木灵古木棕 `#C48B58`、毒蛇萌紫 `#B86DFF`、疾风狼水蓝 `#4CE0E5`）
- **阴影与暗部**：禁止使用纯灰/黑硬边阴影。阴影统一使用同色系偏冷色（如浅紫灰/浅蓝灰）的软渐变过渡。

### 4.3 线条与边缘处理 (Line & Edge Treatment)
- **外轮廓线**：使用 2px ~ 4px 的圆润有色中粗外描边 (Soft Round Colored Outline)，如深红棕、深蓝紫，避免纯黑边框。
- **内结构线**：尽量采用无内线的大色块平涂与软渐变结合。
- **转折圆滑度**：所有轮廓转角均进行圆角化处理 (Corner Rounding)，消除锐利尖角，传递无害、触感柔软的视觉感受。

### 4.4 画面尺寸与画布分辨率依赖 (Canvas Specs)

| 角色/场景类型 | 标准画布尺寸 (Canvas Size) | 主体占据区域 (Content Bounding) | 建议文件格式 | 锚点位置 (Pivot) |
| :--- | :--- | :--- | :--- | :--- |
| **玩家主角 (Player)** | 256 x 256 px | ~200 x 200 px (中央留白) | 32-bit RGBA PNG | 底部中央 (0.5, 0.0) |
| **Boss (千年树妖)** | 256 x 256 px 或 512 x 512 px | ~240 x 240 px (保持大体型高存在感) | 32-bit RGBA PNG | 底部中央 (0.5, 0.0) |
| **精英怪 (Elites)** | 140 x 140 ~ 160 x 160 px | ~130 x 130 px | 32-bit RGBA PNG | 底部中央 (0.5, 0.0) |
| **普通小怪 (Mobs)** | 80 x 80 ~ 100 x 100 px | ~75 x 75 px | 32-bit RGBA PNG | 底部中央 (0.5, 0.0) |
| **无缝背景 (Background)** | 720 x 1280 px 或 1024 x 1024 px | 全屏无缝纹理平铺 (Seamless Tile) | 24-bit RGB PNG | 几何中心 (0.5, 0.5) |

---

## 5. 后续素材生成与抠图处理建议

1. **AI 提示词 (Prompt) 生成策略**：
   - 统一提示词后缀：`2d game sprite, chibi style, cute adorable monster, 2 head tall, soft round colored outline, vibrant bright colors, white background, clean vector art, full body`
2. **背景透明化与抠图 (Alpha Cutout)**：
   - 生成后使用 Rembg 或通道算法去背景，确保边缘无白边、无杂色残影，边缘防锯齿（Anti-aliasing）。
3. **坐标轴心与对齐**：
   - 图像导出时主体居中，防裁剪，确保 Cocos 节点在施放技能、缩放与受击抖动时中心点自然。
