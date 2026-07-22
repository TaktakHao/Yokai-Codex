# Phase 7 渲染与视觉勘测交接报告 (handoff.md)

## 1. Observation (直接观察)

1. **`UIManager.ts` 缺失 `director` 模块导入**
   - 文件路径: `assets/Scripts/Manager/UIManager.ts`
   - 第 1 行: `import { _decorator, Component, Node, Prefab, instantiate, resources, error } from 'cc';`
   - 第 69 行: `const scene = director.getScene();`
   - 报错表现: 当 `resources.load('UI/BattleUIPanel', ...)` 触发 fallback 纯代码构建分支时，在 `director.getScene()` 行抛出 `ReferenceError: director is not defined` 运行时致命异常。

2. **动态节点层级 (Node.layer) 未设为 `Layers.Enum.UI_2D`**
   - 文件路径: `assets/Scripts/Utils/VisualLoader.ts` (第 48 行)
     - `visualNode = new Node(childName);` 创建的 `Visual` 子节点未赋予 `layer`，默认值为 `1073741824` (`Layers.Enum.DEFAULT`)。
   - 文件路径: `assets/Scripts/UI/BattleUIPanel.ts` (第 67-141 行)
     - `ensureUIElements()` 动态创建的 `barNode`、`fillNode`、`labelNode`、`panelNode`、`bgNode`、`knobNode` 等节点未设置 `node.layer`。
   - 文件路径: `assets/Scripts/LevelManager.ts` (第 188 行)
     - `spawnMonster()` 动态创建的 `monster = new Node(...)` 未设置 `layer`。
   - 渲染机制: Cocos Creator 3.x 2D UI 渲染批次管线仅渲染 `node.layer == Layers.Enum.UI_2D` (`33554432`) 的节点，默认 `DEFAULT` 层级在 2D Canvas 下会被剔除，导致节点隐形。

3. **关卡 Monster ID 与磁盘纹理资源路径不一致**
   - 配置路径: `assets/resources/Configs/Level_1_Waves.json`
   - 配置条目: `mob_grass_sprite`, `mob_wood_spirit`, `mob_venom_snake`, `mob_gale_wolf`, `boss_millennium_tree_demon` 等 10 种。
   - 磁盘纹理目录: `assets/resources/Textures/Enemies/` 仅有 `monster_1.png`, `monster_2.png`, `boss_1.png`。
   - 结果: `VisualLoader.ts` 动态加载 `Textures/Enemies/mob_grass_sprite/spriteFrame` 抛出 404 错误 `[VisualLoader] 加载贴图失败`，导致 `spriteFrame` 为 `null`。

4. **Camera 清屏颜色为纯黑**
   - 场景文件: `assets/Scenes/MainScene.scene` (Camera 组件 id 4)
   - 第 188-194 行: `_color: { r: 0, g: 0, b: 0, a: 255 }`。
   - 结果: 在所有 2D UI 与 Sprite 渲染被剔除或报错后，全屏仅保留 Camera 的黑色背景，画面运行全黑。

5. **`BattleUIPanel.ts` 缺乏 UI 数值平滑补间动画**
   - 第 259-278 行: `updateHpBar` 与 `updateExpBar` 采用硬切数值 `this.hpBar.progress = currentHp / maxHp`。

---

## 2. Logic Chain (推理链条)

1. **黑屏问题**：
   `MainScene` 启动 ➔ `GameManager` 在 0.5s 后调用 `startGame('Level_1')` ➔ `UIManager.openUI('UI/BattleUIPanel')` 被调用 ➔ 由于不存在 `UI/BattleUIPanel.prefab` 预制体，执行 fallback 分支 ➔ 分支内部调用 `director.getScene()` ➔ `UIManager.ts` 未导入 `director`，抛出 `ReferenceError` 致命崩溃 ➔ 导致 UI 节点无法挂载。
   同时，即使跳过崩溃，`VisualLoader`、`BattleUIPanel` 和 `LevelManager` 创建的所有 `new Node()` 节点的 `layer` 均保持默认值 `1073741824` (`DEFAULT`)，而场景中的 2D Canvas 仅绘制 `33554432` (`UI_2D`) 层级 ➔ 2D Render Batch 剔除所有 UI 和怪物 ➔ 配合 Camera 清屏纯黑 `Color(0,0,0,255)` ➔ 导致终态为**全黑画面 (Black Screen)**。

2. **视觉消失问题**：
   `LevelManager` 依据 JSON 配置请求加载 `Textures/Enemies/mob_grass_sprite` ➔ 磁盘无对应文件 ➔ `VisualLoader` 资源加载失败 ➔ `Sprite.spriteFrame` 未赋值 (null) ➔ 即使解决 layer 依然无法显示画面。通过引入 Mapping Table 与 Fallback 机制可一次性解决所有怪物的辨识度与显示问题。

3. **UI Tween 补间动画**：
   在受击/获得经验时，通过 Cocos Creator 原生 `tween()` 在 0.25~0.3s 内补间 `ProgressBar.progress`，并配以 `quadOut` / `sineOut` 缓动函数，可提供平滑的视觉过渡。

---

## 3. Caveats (注意事项与假设)

1. **未勘测领域**：
   - 未进行自定义 2D Shader (.effect) 编写（当前优先采用 Color Tint + Scale + Texture Mapping 矩阵方案，零着色器开销，兼容性极高）。
   - 未针对 1000+ 节点高压力碰撞下的 Batching DrawCall 进行 GPU 性能压测。
2. **假设与前提**：
   - 假设后续 Implementer 按照本次报告修复 `UIManager.ts`、`VisualLoader.ts`、`BattleUIPanel.ts`、`LevelManager.ts`。

---

## 4. Conclusion (结论与代码修补指令)

### 4.1 代码修补指令 (供 Implementer 部署)

#### 1) 修复 `assets/Scripts/Manager/UIManager.ts`
- 顶部 import 补齐 `director`：
  ```typescript
  import { _decorator, Component, Node, Prefab, instantiate, resources, error, director } from 'cc';
  ```

#### 2) 修复与增强 `assets/Scripts/Utils/VisualLoader.ts`
- 引入 `Layers` 并将 `visualNode.layer` 设置为 `targetNode.layer || Layers.Enum.UI_2D`。
- 添加 `ENEMY_TEXTURE_MAP` 字典映射与 Fallback 降级加载逻辑。

#### 3) 修复与增强 `assets/Scripts/UI/BattleUIPanel.ts`
- 引入 `Layers` 并将所有动态创建节点设置 `node.layer = Layers.Enum.UI_2D`。
- 引入 `tween`，重构 `updateHpBar` 与 `updateExpBar` 实现 0.25s~0.3s 缓动补间。

#### 4) 修复 `assets/Scripts/LevelManager.ts`
- 引入 `Layers` 并将动态创建的 `monster.layer` 设置为 `parentNode.layer || Layers.Enum.UI_2D`。

---

## 5. Verification Method (独立验证方法)

1. **代码检查**：
   - 查看 `assets/Scripts/Manager/UIManager.ts` 确认 `director` 已在 `'cc'` 导入列表中。
   - 查看 `VisualLoader.ts`、`BattleUIPanel.ts`、`LevelManager.ts` 确认所有 `new Node()` 均显式赋予了 `Layers.Enum.UI_2D` 层级。
2. **运行验证**：
   - 在 Cocos Creator 编辑器或浏览器中运行 `MainScene.scene`。
   - 验证游戏启动 0.5s 后，画面正常呈现（非黑屏），虚拟摇杆、血条 (HpBar)、经验条 (ExpBar) 正常渲染。
   - 验证波次刷新时，`mob_grass_sprite`、`mob_wood_spirit`、`boss_millennium_tree_demon` 等不同怪物拥有鲜明颜色与体型差异。
   - 验证主角受击或击杀怪物获得经验时，血条与经验条呈现平滑滑动的 Tween 过渡效果。
