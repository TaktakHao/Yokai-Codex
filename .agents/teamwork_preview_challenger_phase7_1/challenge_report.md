# Phase 7 极限与边际用例挑战报告 (challenge_report.md)

## Challenge Summary

**Overall risk assessment**: **HIGH**

作为 Phase 7 极限与边际用例挑战者 (Challenger 1)，本报告针对 Worker 1 交付的代码（参见 `teamwork_preview_worker_phase7_1/handoff.md`）进行了严苛的实证与极限挑战测试。虽然 Worker 1 成功修复了基础黑屏问题并搭建了核心系统骨架，但实证测试在**技能 3 选 1 状态控制、保底选项逻辑闭环、经验溢出连续升级、关卡通关判定及事件监听闭环**等模块中揭露了多处重大逻辑漏洞与假实现缺陷。

---

## Challenges

### [HIGH] Challenge 1: 技能 3 选 1 面板打开时 `director.pause()` 缺失与连击/触碰伤害未隔离

- **Assumption challenged**: Worker 1 假设“打开 `SkillSelectPanel` 时游戏会自动挂机/暂停，且玩家可以在安全环境下挑选技能”。
- **Attack scenario**:
  1. 玩家在战斗中杀怪触发升级，派发 `UIEvent.LEVEL_UP` 事件。
  2. `GameManager.onPlayerLevelUpEvent()` 捕获后仅调用 `UIManager.instance.openUI('UI/SkillSelectPanel')`。
  3. `SkillSelectPanel.ts` 的 `onLoad` 与 `onEnable` 均**未调用** `director.pause()`。
  4. 敌人 `Enemy.ts` 的 `update(dt)`、追击 `handleChase` 及近战触碰伤害 `handleContactAttack` 在面板遮罩后方**继续正常运行**。
  5. 攻击范围内的敌人持续对玩家造成伤害，导致玩家在思考挑选技能时被怪物打死，面板未被正确隔离。
  6. 玩家点击卡片后调用 `director.resume()`，甚至会误将外部故意暂停的游戏强制恢复运行。
- **Blast radius**: 破坏 Roguelike 升级弹窗的核心玩法隔离机制，导致玩家在选择技能时遭遇意外死亡崩溃。
- **Mitigation**:
  1. 在 `SkillSelectPanel` 的 `onEnable()` 中显式添加 `director.pause()`；
  2. 在 `Enemy.ts` 与 `PlayerController.ts` 中加入 `director.isPaused` 或 `GameManager.currentState === GameState.PAUSED` 的更新阻断防护。

---

### [HIGH] Challenge 2: 关卡通关与胜负判定机制完全缺失

- **Assumption challenged**: Worker 1 假设“刷怪波次重构完成后，关卡能自然流畅运行并正常结算”。
- **Attack scenario**:
  1. 玩家启动关卡 `Level_1`，随着时间推移顺利击败所有 6 波怪物（包含 Wave 6 最终 BOSS `boss_millennium_tree_demon`）。
  2. 场上怪物数量清零，波次配置已全部生成完毕。
  3. 检查 `LevelManager.ts` 的 `update()` 与 `checkSpawns()`，代码中**完全没有**检测“波次是否全部完成且场上无存活敌人”的逻辑，也未调用 `GameManager.endGame(true)`！
  4. 游戏计时器 `gameTime` 无限累加，玩家永久困在空无一人的关卡场景中，无法弹出一局胜利 UI (`VictoryPanel`) 或获得通关结算奖励。
- **Blast radius**: 玩法闭环断裂，玩家无法正常通关游戏，导致局外养成与关卡循环无法衔接。
- **Mitigation**:
  在 `LevelManager.ts` 的 `update()` 中增加波次完成与存活怪物检测：若 `spawnedWaves.size === wavesData.length` 且 `monsterRoot.children.length === 0`，触发 `GameManager.instance.endGame(true)`。

---

### [MEDIUM] Challenge 3: 技能池全满级保底选项“无双气血”虚假效果（回复 100% 生命值未生效）

- **Assumption challenged**: Worker 1 假设“技能全部满级后，生成的保底卡片能正确回满玩家生命值”。
- **Attack scenario**:
  1. 玩家在单局内将 12 项技能全部分配并升级至 Lv.5 满级。
  2. 再次触发升级时，`SkillPoolManager.getRandomSkills(3)` 返回空数组 `[]`。
  3. `SkillSelectPanel.ts` (第 96-100 行) 生成保底卡片：标题“无双气血”，描述“全技能已达化境！回复 100% 生命值”。
  4. 玩家点击卡片，回调中**仅打印了一行 Log**：`log('[SkillSelectPanel] 玩家选择满级兜底奖励: 回复全额生命');`，但**完全没有**调用 `player.currentHp = player.maxHp` 或恢复血量的代码！
  5. 玩家实际血量毫未增加，保底卡片变成无效果的“空文案”。
- **Blast radius**: 极后期数值体验与承诺不符，玩家选择保底选项后无法获得血量拯救。
- **Mitigation**:
  在 `SkillSelectPanel.ts` 兜底回调中，获取场景中的 `PlayerController` 实例并显式执行 `player.currentHp = player.maxHp` 并触发 `UIEvent.UPDATE_HP` 广播。

---

### [MEDIUM] Challenge 4: 单次巨额经验获利时连续升级逻辑失效 (`if` 替代 `while`)

- **Assumption challenged**: Worker 1 假设“玩家每次获得经验只会提升 1 级”。
- **Attack scenario**:
  1. 当前玩家 Lv.1 (最大经验 `maxExp = 100`)，击杀 BOSS 获得大额经验 +1500。
  2. `PlayerController.ts` 第 180 行执行 `if (this.currentExp >= this.maxExp) { this.levelUp(); }`。
  3. `levelUp()` 将等级提升至 Lv.2 (`currentExp` 变为 1400，`maxExp` 变为 150)。
  4. 由于是 `if` 条件而非 `while` 循环，`addExp` 仅触发了 1 次升级，剩余 1400 Exp 滞留在经验条中，无法连续唤起 3 选 1 技能选择面板。
  5. 玩家必须再次击杀一个小怪触发下一次 `addExp(1)` 时，才会补触发下一次升级。
- **Blast radius**: 高额经验奖励（如 BOSS 经验）无法及时转化为连续升级与技能选取，破坏升级爽快感。
- **Mitigation**:
  在 `PlayerController.ts` 中将 `if (this.currentExp >= this.maxExp)` 改为 `while (this.currentExp >= this.maxExp)` 循环判定升级。

---

### [MEDIUM] Challenge 5: 精英怪死亡广播 `Event_Chest_Dropped` 事件挂空（无监听器）

- **Assumption challenged**: Worker 1 假设“在 `Enemy.ts` 中广播 `Event_Chest_Dropped` 即完成了宝箱掉落机制”。
- **Attack scenario**:
  1. 关卡第 180 秒刷出精英怪 `elite_grass_brute` (配置包含 `"drop_chest": true`)。
  2. 玩家击杀精英怪，`Enemy.ts` 第 276 行派发 `director.emit('Event_Chest_Dropped', { enemyNode: this.node })`。
  3. 全局搜索 `Event_Chest_Dropped`，除 `Enemy.ts` 自身派发外，**无任何 Manager 或 UI 注册监听**。
  4. 宝箱掉落广播丢入虚空，场景中未实例化宝箱 Node，玩家也无法拾取宝箱。
- **Blast radius**: 精英怪宝箱掉落机制沦为摆设，玩家击杀精英怪无法获得宝箱交互体验。
- **Mitigation**:
  在 `LevelManager` 或 `EffectManager` 中注册 `Event_Chest_Dropped` 监听，生成可拾取的宝箱 Prefab / 节点或弹出宝箱获得 UI。

---

## Stress Test Results

| 测试场景 / 场景用例 | 预期行为 | 实际/实测行为 | 判定 (Pass/Fail) |
|---|---|---|---|
| **技能面板打开/关闭** | 面板打开自动 pause 游戏，阻断敌人伤害；关闭 resume | 面板打开未调用 `director.pause()`，敌人继续咬死玩家 | **FAIL** |
| **技能全满级保底选择** | 选择“无双气血”卡片后恢复 100% 生命值 | 仅打印 Log，玩家血量未增加 | **FAIL** |
| **高额经验单次注入 (1000Exp)** | 连续触发多次升级并逐次弹窗选取技能 | 仅升 1 级，剩余大额经验滞留在经验条中 | **FAIL** |
| **关卡所有波次清空 (Wave 6)** | BOSS 死亡且全怪灭绝后自动结算通关胜利 | 无法检测胜利，无限停留在空场景中 | **FAIL** |
| **精英怪宝箱掉落事件** | 精英怪死亡生成宝箱实体或弹框 | 派发 `Event_Chest_Dropped` 无任何系统监听 | **FAIL** |
| **离线挂机 0 秒 / 时钟倒退** | 不产生负收益或异常累加，收益为 0 | 收益为 0，`_lastOfflineTime` 正常更新 | **PASS** |
| **离线挂机 24h (86,400s)** | 100% 全额挂机收益 | 有效秒数 86,400s，准确发放 | **PASS** |
| **离线挂机 36h (129,600s)** | 24h全额 + 12h 20% 衰减收益 | 有效秒数 95,040s，准确发放 | **PASS** |
| **离线挂机 >48h (如 7 天)** | 收益在 48h 处平滑封顶 | 有效秒数封顶 103,680s (28.8h)，准确发放 | **PASS** |
| **首次无存档初始化** | 挂机时间戳初始化为当前时间，不派发异常收益 | 首次挂机收益 0，时间戳稳定保存 | **PASS** |
| **UI/Visual 2D 层级 (33554432)** | 纯代码节点具备 `UI_2D` 层级，摄像机正常渲染 | `node.layer = Layers.Enum.UI_2D` 正常生效，无黑屏 | **PASS** |

---

## Unchallenged Areas

- **Cocos Creator WebGL/Canvas 实际 GPU 帧率压测**: 受限于 Node.js 静态/模拟测试环境，无 GPU 硬件环境下的真实 Render Pipeline 帧率降级未进行图形物理层面压测（静态逻辑与层级设置已全量验证）。
