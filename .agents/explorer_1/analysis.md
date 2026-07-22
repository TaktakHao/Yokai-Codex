# 《万妖录：躺平修仙》代码库深入探索与分析报告 (analysis.md)

## 概述

本报告由 **Codebase Explorer** 针对项目 `/Users/wesson/YokaiCodex` 进行全面静态探查与分析产出。重点核查了目录结构、编译指令、需求 R1（局内战斗与打击感）、需求 R2（宠物跟随与葫芦抓捕/冻结机制）、需求 R3（关卡结算重置与动态资源加载）以及 Acceptance Criteria 中的剧情引导流程。

---

## 一、 项目目录结构与编译/测试指令探查

### 1. 项目根目录结构与配置文件
- `package.json`: 定义项目名称 `YokaiCodex` 及 Cocos Creator 版本 `3.8.8`。
- `tsconfig.json`: 继承 `./temp/tsconfig.cocos.json`，编译器选项 `strict: false`。
- `temp/tsconfig.cocos.json`: 配置 Cocos Creator 引擎 `3.8.8` 类型声明文件（如 `./temp/declarations/cc`）与路径映射（`db://assets/*` -> `/Users/wesson/YokaiCodex/assets/*`）。
- **编译检查 / TypeScript 静态检查命令**:
  - `npx tsc --noEmit` 或通过 Cocos Creator 3.8.8 编辑器自带的 TypeScript 校验服务。

### 2. 代码与资源目录布局
- `assets/Scripts/`: 包含 27 个 TypeScript 业务脚本，划分为：
  - `Manager/`: `GameManager.ts`（状态机中枢）、`LevelManager.ts`（波次与关卡）、`UIManager.ts`（UI栈与纯代码构建）、`SaveManager.ts`（原子存盘）、`PoolManager.ts`（对象池）、`EffectManager.ts`（特效总线）、`EventManager.ts`（全局事件）、`HomeManager.ts`（洞府与挂机）。
  - `Logic/`: `Enemy.ts`（敌人AI与触碰伤害）、`PetFollower.ts`（宠物跟随与弹道）、`PetCaptureManager.ts`（抓捕公式与盲盒鉴定）、`IdleSystem.ts`、`SkillPoolManager.ts`。
  - `UI/`: `BattleUIPanel.ts`（战斗UI与摇杆）、`DialoguePanel.ts`（剧情对话）、`VictoryPanel.ts`（通关结算）、`GameOverPanel.ts`（死亡结算）、`PausePanel.ts`（暂停小憩）、`SkillSelectPanel.ts`、`TribulationPanel.ts`、`AppraisalPanel.ts`、`EquipmentPanel.ts`、`FurniturePanel.ts`、`HomePanel.ts`。
  - `Utils/`: `VisualLoader.ts`（动态贴图加载与纯色占位兜底）。
  - Root: `PlayerController.ts`（玩家移动/自动射击/吸血）、`DialogueSystem.ts`（剧情配置加载与播放）。
- `assets/resources/`:
  - `Configs/`: `Chapter1_Dialogues.json`（剧情与引导对话库）、`Level_1_Waves.json`（关卡波次数据）。
  - `Textures/`: `Enemies/`（`boss_1.png`, `monster_1.png`, `monster_2.png`）、`Player/`（`player.png`）、`UI/`（`background.png`, `white.png`）。

---

## 二、 需求 R1 详细核查结果（局内战斗与打击感）

### 1. 怪物追逐向玩家逻辑
- **代码位置**: `assets/Scripts/Logic/Enemy.ts` 中的 `handleChase()` 与 `setupVisual()`。
- **追逐 AI 机制**:
  - `handleChase(deltaTime)` 计算敌人 `worldPosition` 与目标玩家 `targetPlayer.worldPosition` 的差值向量 `dir`，使用 `dir.normalize()` 并以 `moveSpeed * deltaTime` 步进向玩家平滑移动。
  - `findPlayerIfMissing()` 具备自动补齐寻路能力，若 `targetPlayer` 节点丢失或失效，自动在场景 `Canvas` 下重新检索 `Player` 节点。
- **怪物种类视觉区分**:
  - 普通小草精 (`mob_grass_sprite`): 嫩绿染色 `Color(120, 230, 120)`，尺寸 48x48。
  - 木灵 (`mob_wood_spirit`): 金褐染色 `Color(210, 180, 120)`，尺寸 48x48。
  - 毒蛇 (`mob_venom_snake`): 毒紫染色 `Color(190, 110, 230)`。
  - 疾风狼 (`mob_gale_wolf`): 青蓝染色 `Color(110, 210, 255)`。
  - 精英怪 (`isElite = true`): 金黄染色 `Color(255, 215, 80)`，1.5x 视觉放大，尺寸 64x64。
  - 关底树妖王/BOSS (`boss_millennium_tree_demon`): 深血红染色 `Color(255, 80, 80)`，2.2x 视觉放大，尺寸 96x96。

### 2. 自动索敌与最邻近怪物射击机制
- **代码位置**: `assets/Scripts/PlayerController.ts` 中的 `handleAutoAttack()` 与 `executeAutoAttack()`。
- **索敌与攻击属性**:
  - 默认攻击范围 `attackRange = 300` 像素，基础冷却 `attackCooldown = 1.0` 秒（受 3 水羁绊 CDR 缩减）。
  - 每帧在 `monsterRoot` (EnemyLayer) 子节点中遍历非死亡敌人，锁定 `minDistance <= attackRange` 且距离最近的敌人。
  - 触发攻击时计算 3 金共鸣加成（+20% 攻击力）与 3 火共鸣加成（+20% 暴击率）。支持吸血魔剑 (`relic_sword_vampire`) 5% 造成伤害回血。
  - 发送 `CombatEvent.PLAYER_ATTACKED` 事件并直接调用 `enemyComp.takeDamage(finalDamage)`。

### 3. 打击感表现核查（受击红闪与浮动伤害数字）
- **代码位置**: `assets/Scripts/Manager/EffectManager.ts` 与 `assets/Scripts/Logic/Enemy.ts`。
- **缺陷 / 未实现点 (Bug 1)**:
  - `EffectManager.ts` 订阅了 `CombatEvent.ENEMY_DAMAGED` 事件并在 `onEnemyDamaged` 中调用 `showDamageText(pos, damage, isCritical)`。
  - 然而，`showDamageText` 函数体内**仅执行了 `log('[EffectManager] 伤害飘字...')` 调试日志打印**，未从 `PoolManager` 或纯代码实例化伤害飘字 UI 节点（Label），没有动画上升淡出效果！
  - 敌人受击时，`Enemy.ts` 与 `EffectManager.ts` 中**完全缺失受击红闪 (Hit Red Flash) 逻辑**（如受击瞬间将 Sprite 颜色临时变为红色 `Color.RED` 并通过 Tween 渐变恢复）。

---

## 三、 需求 R2 详细核查结果（宠物跟随、葫芦抓捕与剧情冻结）

### 1. 宠物跟随插值与多宠物环形偏置算法
- **代码位置**: `assets/Scripts/Logic/PetFollower.ts` 中的 `followPlayer()`。
- **环形偏置算法**:
  - 根据宠物在队列中的 `petIndex` 和上阵总数 `totalPetsCount` 计算角度：
    `angleRad = ((petIndex * (360 / totalPetsCount)) * Math.PI) / 180`
  - 偏置半径为 64 像素，算出目标点 `(targetX, targetY)`。
- **跟随插值**:
  - 使用 `Vec3.lerp(newPos, currentPos, targetPos, 0.08)` 进行缓动插值，实现具有弹性感的浮游炮跟随体验。

### 2. 投射物飞弹颜色/大小挂钩星级化形
- **代码位置**: `assets/Scripts/Logic/PetFollower.ts` 中的 `fireProjectile()`。
- **飞弹大小公式**:
  - `projSize = Math.floor(14 * (1 + (star - 1) * 0.1) * (isEvolved ? 1.5 : 1.0))`，结合了星级增量 (+10%/星) 与化形突破增量 (+50%)。
- **飞弹颜色绑定**:
  - 根据五行属性绑定：金 (璀璨金 `255,215,0`)、木 (翡翠绿 `60,220,100`)、水 (寒冰蓝 `80,180,255`)、火 (烈焰红 `255,70,70`)、土 (大地黄 `210,160,60`)。

### 3. 葫芦抓捕玩法与残血捕获
- **代码位置**: `assets/Scripts/Logic/PetCaptureManager.ts` 与 `assets/Scripts/UI/BattleUIPanel.ts`。
- **捕获概率公式**:
  - `totalRate = baseCaptureRate (0.1) + (1 - currentHp / maxHp) * executeBonusWeight (0.5) + itemBonus + extraGourdRate (0.05 * failCount)`
- **虚弱判定 (<10% HP)**:
  - 血量低于 10% 时，斩杀加成 `(1 - currentHp / maxHp) > 0.9` 达到最大加成。
  - `BattleUIPanel.ts` 的 `onCaptureBtnClick()` 会在玩家周围 300 像素内寻找最残血的目标。若无符合条件怪物则弹窗提示。
  - 抓捕成功后，从场景中移除怪物并归还对象池，生成未鉴定 `PetEgg` 存入背包。

### 4. 剧情对话弹出期间的战斗“冻结”机制
- **代码位置**: `assets/Scripts/UI/DialoguePanel.ts`、`assets/Scripts/DialogueSystem.ts`、`assets/Scripts/Manager/GameManager.ts`。
- **严重缺陷 / 未实现点 (Bug 2)**:
  - 在 `DialogueSystem.ts` 触发剧情对话并打开 `DialoguePanel.ts` 期间，**系统没有任何暂停或冻结战斗的逻辑**（既未调用 `director.pause()`，也未设置战斗暂停 Flag 停止 `Enemy.ts` 和 `PlayerController.ts` 的 `update`）。
  - 这导致在战斗中弹出新手引导对话（如遭遇精英怪 `Tutorial_Catch` 或首次击杀 `First_Monster_Kill`）时，**怪物仍在后台正常移动并对玩家造成触碰伤害**，玩家处于无防备被攻击状态，体验极差！

---

## 四、 需求 R3 详细核查结果（关卡结算、彻底重置与动态资源加载）

### 1. 关卡胜利/失败结算与重置切回洞府
- **代码位置**: `assets/Scripts/UI/VictoryPanel.ts`、`assets/Scripts/UI/GameOverPanel.ts`、`assets/Scripts/Manager/GameManager.ts` (`returnToHome`)、`assets/Scripts/LevelManager.ts`。
- **通关与死亡结算**:
  - 胜利通关：`LevelManager.ts` 在所有波次刷完且活怪清零时触发 `GameManager.instance.endGame(true)`，发放 +200 灵石 / +20 材料。
  - 玩家死亡：`PlayerController.ts` `die()` 派发 `GAME_OVER` 事件，触发 `GameManager.instance.endGame(false)`，发放 +50 灵石 / +5 材料。
  - 自动调用 `SaveManager.instance.save()` 保存存档。
- **彻底重置与安全切回 (`returnToHome`)**:
  - 1) 优先清理 `monsterRoot` 和 `EnemyLayer` 下的所有活怪节点，归还对象池。
  - 2) 销毁所有随行宠物 (`Follower_`) 和飞弹投射物节点，将玩家重置至原点 `(0, 0, 0)` 并恢复满血。
  - 3) 停止关卡刷怪与计时，调用 `LevelManager.ts` 的 `resetLevel()` 清空 `spawnedWaves` 和 `activeEnemyCount`。
  - 4) 安全关闭所有局内面板 (`BattleUIPanel`, `VictoryPanel`, `GameOverPanel`, `SkillSelectPanel`, `PausePanel`) 并打开 `HomePanel` 主界面。

### 2. 动态资源加载与占位渲染
- **代码位置**: `assets/Scripts/Utils/VisualLoader.ts`。
- **路径映射字典**: `ENEMY_TEXTURE_MAP` 将怪物 ID 映射至 `Textures/Enemies/monster_1` 等实际贴图路径。
- **防卡死与占位兜底机制**:
  - 当资源缺失、加载报错或检测到 1x1 占位图片时，自动调用 `applySolidSprite`，使用纯色图片 `Textures/UI/white/spriteFrame` 配合 `color` 进行着色渲染。
  - 包含异步安全检查：在回调中校验 `targetNode.isValid` 和 `sprite.isValid`，防止节点销毁引发空指针报错。

---

## 五、 Acceptance Criteria 剧情与引导表现核查

### 1. 首次启动自动开启 8 段剧情
- **配置资源**: `assets/resources/Configs/Chapter1_Dialogues.json`。
- **播放逻辑**: `GameManager.ts` 检查 `localStorage.getItem('played_opening_cutscene')`。未播放过则按顺序触发 `Game_Start` -> `Intro_Scene_1` -> ... -> `Intro_Scene_7` 共 8 段剧情。支持全屏点击推进与右上角【跳过】按钮。

### 2. 关卡内 5 大触发点剧情
- 首次移动 (`Tutorial_Move`): 打开 `BattleUIPanel` 时检查并触发。
- 首次击杀 (`First_Monster_Kill`): `LevelManager.ts` 的 `onEnemyDied()` 检查并触发。
- 遭遇精英怪 (`Tutorial_Catch`): `LevelManager.ts` 的 `spawnMonsterGroup()` 在精英怪刷出时检查并触发。
- 首次抛葫芦 (`Tutorial_Throw_Gourd`): `BattleUIPanel.ts` 点击抛葫芦按钮时检查并触发。
- 首次抓捕成功 (`Tutorial_Catch_Success` -> `Tutorial_End`): 抓捕成功时检查并触发。
- **缺陷**: 剧情对话弹出期间，缺少防御性战斗“冻结”（暂停怪物更新与玩家受伤检测）。

---

## 六、 Bug / 体验缺陷清单与修改建议

| 编号 | 缺陷描述 | 受影响文件 | 严重等级 | 代码修改建议 |
|---|---|---|---|---|
| **BUG-01** | `EffectManager.ts` 收到受击事件仅 log 输出，**未产生伤害飘字 Node/Label**，且敌人受击**缺失红闪 (Hit Red Flash)** 表现。 | `EffectManager.ts`, `Enemy.ts` | **高** | 1) 在 `EffectManager.ts` 的 `showDamageText` 中，通过纯代码或 `PoolManager` 创建 Label 节点挂载在受击位置，设置红色/金黄色文本并使用 tween 执行向上漂移淡出；<br>2) 在 `Enemy.ts` 的 `takeDamage` 中，对 Sprite 进行 0.1s 红色 `Color(255, 100, 100)` 染色 Tween，随后恢复原色。 |
| **BUG-02** | 剧情对话 (`DialoguePanel.ts`) 弹出期间**未冻结战斗**，怪物继续移动攻击玩家，导致对话中受击或死亡。 | `DialogueSystem.ts`, `DialoguePanel.ts`, `GameManager.ts` | **高** | 1) 在 `DialogueSystem.ts` 打开 `DialoguePanel` 时，调用 `director.pause()` 或触发全局事件将 `isPlaying` 设为 false；<br>2) 对话播放完毕或点击【跳过】关闭 `DialoguePanel` 时，调用 `director.resume()` 恢复战斗更新。 |
| **BUG-03** | 某些手动创建的 `Node` 在挂载 Sprite 后如果没有 `UITransform` 可能会导致 2D 渲染异常。 | `BattleUIPanel.ts`, `PetFollower.ts` | **中** | 确保所有动态创建的 `UI_2D` 节点在 `addComponent(Sprite)` 时显式挂载并配置 `UITransform`。 |

