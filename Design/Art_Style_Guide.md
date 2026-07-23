# YokaiCodex 美术风格指南 (Art Style Guide)

## 1. 美术风格概述 (Overview)

本指南旨在为 《YokaiCodex》 确定统一的 **“简约、可爱” (Chibi 2D Q版)** 美术视觉基调。
游戏整体画面风格定位于清新、治愈、萌系而充满活力的 2D Q版 修仙与妖怪世界。通过明快的色彩调性、夸张可爱的 2 头身比例、圆润流畅的描边线条以及极简精致的视觉元素，为玩家呈现一个轻松愉悦的修仙伏魔视觉体验。

---

## 2. 色彩饱和度与调色板规范 (Color & Brightness Palette)

### 2.1 色彩调性原则
- **高明度 (High Lightness/Value)**：色彩整体保持清亮高明度（HSL 中 L 值在 60% ~ 85% 之间），避免暗沉、灰脏或阴暗的死板配色。
- **高/中饱和度 (Vivid & Pastel Saturation)**：主体颜色采用明快饱满的色调（S 值在 60% ~ 90% 之间），搭配温柔的粉彩（Pastel Colors）进行渐变与过渡。
- **软阴影 (Soft Shadow Tint)**：阴影部分不使用纯黑色或灰色，而是使用主体色彩的同色系暗色或补色软色调（如草绿色的阴影采用翠绿/橄榄绿，皮肤阴影采用暖橘粉）。

### 2.2 核心色卡定义 (Core Palette Table)

| 适用对象 | 角色/资产类型 | 主色 (Base Color) | 辅色/阴影色 (Secondary/Shadow) | 高光/亮色 (Highlight/Accent) |
| :--- | :--- | :--- | :--- | :--- |
| **主角 (Player)** | 小仙侠/修者 | 天水蓝 `#7DD3FC` / 纯白 `#FFFFFF` | 靛青 `#0284C7` / 暖橘 `#F97316` | 暖金黄 `#FDE047` |
| **草地背景** | 关卡无缝草地 | 嫩草绿 `#4ADE80` / 活力绿 `#22C55E` | 墨绿 `#166534` / 黄绿 `#A3E635` | 明黄 `#FEF08A` |
| **草精 (Mob Grass)** | 青草精 / 草莽蛮兽 | 苹果绿 `#86EFAC` / 翠绿 `#4ADE80` | 深绿 `#15803D` | 柠檬黄 `#FEF08A` |
| **木灵 (Mob Wood)** | 木灵 / 树精傀儡 | 暖木棕 `#D97706` / 原木 `#F59E0B` | 深木褐 `#78350F` | 幼芽绿 `#86EFAC` |
| **毒蛇 (Mob Snake)** | 毒液蛇 | 萌紫 `#C084FC` / 薄荷绿 `#34D399` | 毒液紫 `#7E22CE` | 荧光黄 `#FACC15` |
| **疾风狼 (Gale Wolf)**| 疾风狼 / 狼王 | 冰蓝 `#38BDF8` / 银灰 `#E2E8F0` | 疾风蓝 `#1D4ED8` | 闪电粉 `#F472B6` |
| **Boss 千年树妖** | 千年树妖 | 巨木褐 `#92400E` / 翠绿树冠 `#16A34A` | 古木暗 brown `#451A03` | 妖异橙 `#FB923C` |

---

## 3. 角色头身比规范 (Head-to-Body Ratio & Proportions)

### 3.1 Q版 2头身 (2-Head-Tall Chibi) 架构
所有角色（主角、小怪、精英怪及 Boss）必须严格遵循 **Q版 2头身 (2-Head-Tall)** 比例结构：
- **头部 (Head)**：占角色整体高度的 **50%**。头型饱满圆润，稍微呈略微椭圆或苹果形。
- **身体与肢体 (Body & Limbs)**：占角色整体高度的 **50%**。躯干小巧圆胖，呈水滴形或圆筒形。

```
  +-----------------------+ --- 顶部 0%
  |       (  O  O  )      |  |
  |        \  --  /       |  +-- 头部 (Head) 占 50%
  +-----------------------+ --- 50%
  |        /  ||  \       |  |
  |       (   ||   )      |  +-- 身体与肢体 (Body & Limbs) 占 50%
  +-----------------------+ --- 底部 100%
```

### 3.2 肢体简化原则
- **手部与足部**：极简软萌化处理。手部呈圆球状（无复杂五指关节点，仅在特殊姿势下可有简易大拇指点缀）；足部呈简易圆润小短腿或小短靴。
- **关节动态**：肢体摆动幅度夸张萌系，突出弹性与活泼感。

---

## 4. 描边与线条规范 (Outline & Contour Standards)

### 4.1 描边尺寸 (Stroke Width)
- 所有角色与怪物图像需包含 **2~4px 软圆润外描边 (Soft Rounded Colored Outer Outline)**。
- 描边粗细随画布分辨率等比适配：
  - 80x80 ~ 100x100 图像：采用 **2px** 描边。
  - 140x140 ~ 160x160 图像：采用 **3px** 描边。
  - 256x256 图像：采用 **4px** 描边。

### 4.2 描边颜色与圆角 (Color & Corner Smoothing)
- **非纯黑描边**：禁止使用纯硬黑 (`#000000`) 描边。必须采用主体颜色的同色系加深颜色（如深蓝 `#0F172A`、深褐 `#451A03` 或深绿 `#14532D`），使角色边缘自然融入画面。
- **转折圆滑**：所有边缘轮廓与折角处进行抗锯齿 (Anti-Aliasing) 圆角化处理，杜绝锐利的直角或硬像素阶梯。

---

## 5. 五官与肢体特征规范 (Facial & Anatomical Design)

### 5.1 眼睛设计 (Eyes)
- **水汪汪萌系大眼**：眼睛尺寸占脸部面积约 1/3。
- **高光与虹膜**：虹膜采用双色渐变（如深蓝到天蓝），右上角带有 1~2 个纯白圆形高光点 (Highlight Dots)，传达灵动感。
- **怪异与可爱并存**：小怪与 Boss 同样遵循萌化处理，即使是敌人也通过大圆眼、呆萌或小怒眉来体现可爱感而非惊悚感。

### 5.2 嘴部与面部表情 (Mouth & Facial Expression)
- **嘴部**：简易弧形小嘴角 (`w` 形、`o` 形或简易小弧线)，配合粉嫩圆形腮红 (Blush Spots) 贴于双颊。

---

## 6. 画布、留白与格式规范 (Canvas & Anti-Aliasing Specifications)

### 6.1 资产尺寸与留白分布表 (Asset Specification Table)

| 资产文件路径 | 规格尺寸 (Width x Height) | 模式 (Format Mode) | 留白比例 (Padding Margin) | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `assets/resources/Textures/Player/player.png` | `256 x 256 px` | 32-bit `RGBA` | 15% ~ 20% (居中) | 主角 Q版小仙侠，透明背景 |
| `assets/resources/Textures/bg_grassland.png` | `720 x 1280 px` | 24-bit `RGB` | 0% (全屏无缝) | 关卡无缝草地背景，9宫格循环拼贴 |
| `assets/resources/Textures/Enemies/boss_millennium_tree_demon.png` | `256 x 256 px` | 32-bit `RGBA` | 10% ~ 15% (居中) | Boss 千年树妖，透明背景 |
| `assets/resources/Textures/Enemies/boss_1.png` | `256 x 256 px` | 32-bit `RGBA` | 10% ~ 15% (居中) | Boss 兼容映射贴图，透明背景 |
| `assets/resources/Textures/Enemies/mob_grass_sprite.png` | `80 x 80 px` | 32-bit `RGBA` | 10% (居中) | 小怪 - 青草精，透明背景 |
| `assets/resources/Textures/Enemies/mob_wood_spirit.png` | `90 x 90 px` | 32-bit `RGBA` | 10% (居中) | 小怪 - 木灵，透明背景 |
| `assets/resources/Textures/Enemies/mob_venom_snake.png` | `100 x 100 px` | 32-bit `RGBA` | 10% (居中) | 小怪 - 毒液蛇，透明背景 |
| `assets/resources/Textures/Enemies/mob_gale_wolf.png` | `100 x 100 px` | 32-bit `RGBA` | 10% (居中) | 小怪 - 疾风狼，透明背景 |
| `assets/resources/Textures/Enemies/elite_grass_brute.png` | `140 x 140 px` | 32-bit `RGBA` | 10% (居中) | 精英怪 - 草莽蛮兽，透明背景 |
| `assets/resources/Textures/Enemies/elite_gale_wolf_alpha.png` | `150 x 150 px` | 32-bit `RGBA` | 10% (居中) | 精英怪 - 疾风狼王，透明背景 |
| `assets/resources/Textures/Enemies/elite_wood_golem.png` | `160 x 160 px` | 32-bit `RGBA` | 10% (居中) | 精英怪 - 树精傀儡，透明背景 |
| `assets/resources/Textures/Enemies/monster_1.png` | `100 x 100 px` | 32-bit `RGBA` | 10% (居中) | 小怪通用占位/映射贴图，透明背景 |
| `assets/resources/Textures/Enemies/monster_2.png` | `100 x 100 px` | 32-bit `RGBA` | 10% (居中) | 小怪通用占位/映射贴图，透明背景 |

### 6.2 Alpha 通道与透明度平滑 (Alpha Channel Anti-Aliasing)
1. **纯透明 Alpha 通道**：所有角色与怪物图像必须导出为带有透明 Alpha 通道的 32-bit `RGBA` 格式（透明背景 `(0, 0, 0, 0)`）。
2. **边缘 Alpha 平滑 (Alpha Anti-Aliasing)**：图像轮廓边缘必须经过 Alpha 通道渐变平滑处理，Alpha 值在轮廓外边缘由 255 递减过渡到 0，杜绝纯白正方形底色、黑边杂色或锯齿硬边缘。
3. **安全留白 (Safe Padding)**：主体图案四周必须保留足够的透明边缘（10%~20% Padding），防止游戏引擎在精灵裁切或渲染动画时出现边缘像素截断。

---

## 7. 总结与执行规范

所有后续生成的 2D 美术素材（包括手动绘制与 Python 自动化渲染/后处理脚本）均需遵循上述 R1 标准。后处理脚本需自动检验色彩模式 (`RGBA`)、尺寸精确性以及 Alpha 通道的平滑度，确保工程导入后游戏画面呈现一致且高质感 Q版 视觉风格。
