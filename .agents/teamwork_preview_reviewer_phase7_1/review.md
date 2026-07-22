# Phase 7 代码与架构审查报告 (review.md)

**审查员**: Reviewer 1 (Phase 7 Reviewer & Critic)  
**工作目录**: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_reviewer_phase7_1`  
**审查目标**: Worker 1 交付的代码与配置改动 (R1~R4)  
**最终结论**: **APPROVE (批准通过)**

---

## 1. Review Summary (审查摘要)

Worker 1 在 Phase 7 交付的代码与配置涵盖了渲染黑屏修复 (R1)、Roguelike 3选1升阶与挂机数值闭环 (R2)、UI Tween 插值与怪物特色视觉 (R3) 以及 JSON 关卡波次难度重构 (R4)。

通过对相关 TypeScript 源文件与 JSON 配置文件进行全量逐行静态代码审查、逻辑推演与对抗性攻防测试：
- 未发现任何硬编码测试结果、伪实现 (Facade)、逻辑绕过或自评造假等 Integrity Violation 情况。
- 所有代码均完备实现了项目需求，架构设计清晰且防御性机制健全。

---

## 2. Findings (维度审查详细结果)

### 【R1 渲染与黑屏审查】— VERDICT: PASS
- **`UIManager.ts`**:
  - 第 1 行已完备导入 `director` 与 `Layers` 模块。
  - 在纯代码回退节点创建 (Line 57) 及预制体实例化 (Line 71) 分支均显式设置 `uiNode.layer = Layers.Enum.UI_2D`。
  - 正确挂载 `BattleUIPanel` 与 `SkillSelectPanel` 组件。
- **`VisualLoader.ts`**:
  - 在 `loadVisual()` 中对 `targetNode` 与生成的 `visualNode` 显式校验并赋予 `Layers.Enum.UI_2D`。
- **`BattleUIPanel.ts`**:
  - 在 `onLoad()` 及所有纯代码动态辅助工厂方法 (`createProgressBar`, `createLabel`, `ensureUIElements`) 中，为所有的 UI 节点、子节点（HpBar, ExpBar, TimerLabel, ScoreLabel, DialoguePanel, Joystick）显式覆盖赋予了 `Layers.Enum.UI_2D`。
- **`LevelManager.ts` / `PlayerController.ts` / `Enemy.ts`**:
  - 刷怪父节点与怪物节点、玩家节点在其 `start()` / `onEnable()` / `init()` 生命周期中均健全赋值 `Layers.Enum.UI_2D` (`33554432`)，彻底解决了 Cocos Creator 3.x 2D Camera 渲染剔除黑屏问题。

### 【R2 玩法与数值审查】— VERDICT: PASS
- **`SkillPoolManager.ts` & `SkillSelectPanel.ts`**:
  - **3选1抽取算法**: `getRandomSkills(3)` 准确筛选 `level < maxLevel` 的技能，采用基于玩家已选流派 Tag 数量的加权抽样算法（主修流派权重为 `1.0 + count * 0.5`，即 1.5x+ 倾斜）。
  - **全满级兜底 (Fallback)**: 当可抽技能数组为空时，`SkillSelectPanel.ts` 自动触发 `createFallbackCard` 产生“无双气血”全额恢复生命兜底选项，并正常闭环游戏挂起与恢复流程。
  - **挂起/恢复链路**: 升级触发 `UIEvent.LEVEL_UP` -> `GameManager` 捕获后执行 `director.pause()` -> 打开 `SkillSelectPanel` -> 点击卡片调用 `selectSkill(id)` 并执行 `director.resume()` 恢复游戏运行。
- **`HomeManager.ts` & `SaveManager.ts`**:
  - **24h+24h 软上限算式**: `settleOfflineEarnings()` 采用 `fullRateTime = Math.min(offlineSeconds, 86400)` + `decayTime = Math.max(0, Math.min(offlineSeconds - 86400, 86400)) * 0.2`，精确实现 0~24h 100% 收益、24h~48h 20% 衰减收益、>48h 收益封顶的数学公式。
  - **数据持久化**: `SaveManager.ts` 完整封装 `sys.localStorage` 操作，与 `HomeManager` 建立灵石、修仙材料、境界索引及 `lastOfflineTime` 的内存与磁盘双向同步闭环。

### 【R3 视觉与动效审查】— VERDICT: PASS
- **`BattleUIPanel.ts` (Tween 插值)**:
  - `updateHpBar()` 与 `updateExpBar()` 采用 `tween(state).to(0.25, { progress }, { easing: 'quadOut' })` 进行数值平滑插值过渡，且在启动新补间前显式调用 `.stop()` 停止旧动画，防止补间冲撞与内存泄露。
- **`VisualLoader.ts` & `Enemy.ts` (视觉管线)**:
  - `ENEMY_TEXTURE_MAP` 字典准确映射了草精、木灵、毒蛇、疾风狼、精英怪与 BOSS 的磁盘贴图路径，并包含自动降级机制。
  - `Enemy.ts` 在 `setupVisual()` 中为草精 (嫩绿)、木灵 (金褐)、毒蛇 (毒紫)、疾风狼 (青蓝) 绑定个性化 Color Tint；为精英怪应用 1.5x 视觉 Scale + 金色光泽；为 BOSS 应用 2.2x 视觉 Scale + 深血红光泽。

### 【R4 关卡波次审查】— VERDICT: PASS
- **`Level_1_Waves.json`**:
  - JSON 格式合法规范。
  - 前三波 (0s, 60s, 180s) 怪物基础 HP (40 -> 55 -> 80/100)、ATK (8 -> 10 -> 15/18) 与移速阶梯递增；180s 成功配置精英怪 `elite_grass_brute` (HP 1200, ATK 35, `is_elite: true`) 及其掉落配置 `drop_config`。
- **`LevelManager.ts`**:
  - 完备定义 `ILevelConfig` / `IWaveConfig` / `IMonsterGroupConfig` 接口，支持旧扁平格式与新嵌套 Schema 的向后兼容解析。
  - 在 `spawnMonsterGroup()` 中将攻防速、经验值、精英标识及 `drop_config` 完整透传给 `Enemy.init()`。

---

## 3. Verified Claims (验证声明)

| 声明项 | 验证方式 | 结论 |
|---|---|---|
| UIManager.ts 导入 director 与 Layers 模块 | 代码逐行审查 (Line 1) | PASS |
| 所有纯代码 UI/Visual/Enemy/Player 节点 node.layer 设置 | 全局跨文件 `node.layer` 搜索与赋值逻辑审查 | PASS |
| SkillPoolManager 3选1加权与全满级兜底 | 逻辑推演 & 边界条件构造测试 | PASS |
| 离线挂机 24h+24h 软上限算式数学正确性 | 数学用例代入推导 (1h/24h/36h/48h/72h) | PASS |
| UI Tween 平滑动效与 stop 机制 | 代码审查 (BattleUIPanel.ts:270-309) | PASS |
| Level_1_Waves.json 格式与波次属性透传 | JSON 解析与 LevelManager.ts 属性注入链追踪 | PASS |

---

## 4. Adversarial Attack Surface & Stress-Test (对抗性 stress-test 总结)

1. **时钟篡改/时区跨越攻击**:
   - 假设玩家恶意将设备时间大幅前调（如跨越 2 年）：`HomeManager.ts` 中的 `Math.min(offlineSeconds - 86400, 86400)` 会将离线收益严格限制在 48 小时收益上限（103,680 秒有效时长），攻击失效。
   - 假设玩家将设备时间后调：`Math.max(0, currentTime - this._lastOfflineTime)` 确保离线秒数为 0，不会产生负收益或异常。
2. **技能池提前抽空攻击**:
   - 当玩家提前升满所有技能后，`getRandomSkills()` 返回空数组，`SkillSelectPanel.ts` 触发 `createFallbackCard` 弹框提供全额生命回复，不卡死不崩溃。

---

## 5. Improvement Suggestions (改进建议)

1. **[Minor Style/Maintainability]**: `Enemy.ts` 与 `LevelManager.ts` 中部分类型使用了 `any`（如 `dropConfig: any`）。后续版本建议将 `dropConfig` 强类型标注为 `IDropConfig`。
2. **[Minor UX]**: 当前超大经验奖励（如击杀 BOSS 获得 2000 EXP）会让剩余经验保留在 `currentExp` 中，在下次击杀怪物时继续触发升阶。目前设计避免了连续多重 UI 弹窗死锁，体验较好，可继续保持。
