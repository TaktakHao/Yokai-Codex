# Phase 10 代码对抗性验证与测试报告 (Challenge Report)

## Challenge Summary

**Overall risk assessment**: MEDIUM

本报告对 Worker 1 完成的 Phase 10 核心代码进行了经验逻辑推演、AST/代码路径追踪与对抗性极限测试。测试覆盖了三大初始神器（吸血魔剑、聚宝盆、吞天葫芦）、装备面板（穿脱、升级扣除、合成升星）以及 SaveManager 存档读取/兜底机制。

测试结论：基础功能满足 Phase 10 核心需求，但在静态/动态移速加成、法宝升级联动、吞天葫芦保底持久化以及 SaveManager 空指针防御方面存在 4 项漏洞与设计缺陷。

---

## Challenges

### [Medium] Challenge 1: Enemy 移动速度提升 20% 无法作用于场景静态敌人与未传参 init()

- **Assumption challenged**: 假设穿戴聚宝盆后，所有生成的怪物基础移动速度都能提升 20%。
- **Attack scenario**:
  1. 场景中预设或动态加载的敌人 node，若通过 Cocos Creator `onEnable()` 生命周期直接激活（未手动调用 `init(hp, speed...)`），移速保持默认 `moveSpeed = 100`，聚宝盆加成失效。
  2. 若在游戏进行中中途穿戴聚宝盆，已存在的 Enemy 节点的 `moveSpeed` 不会自动更新。
  3. 调用 `init(100)` 时若未显式传递 `speed` 参数，`speed !== undefined` 为 false，移速加成逻辑被直接跳过。
- **Blast radius**: 聚宝盆法宝“怪物移速提升 20%”被动在多个常规游戏场景下静默失效，导致游戏难度与描述不符。
- **Mitigation**: 在 `Enemy.ts` 的 `update` 或 `onEnable` / `start` 中统一从 `HomeManager.instance` 动态计算最终移速，或在 `HomeManager` 穿脱法宝时派发事件更新所有活跃敌人移速。

### [Medium] Challenge 2: 吞天葫芦抓捕失败计数器未持久化且解卸载未重置

- **Assumption challenged**: 假设吞天葫芦的“抓捕失败成功率累加（失败计数可叠加）”能在游戏重启与穿脱装备过程中维持一致性。
- **Attack scenario**:
  1. 玩家抓捕失败 5 次后（积累 +25% 成功率），游戏退出或崩溃重新加载，`_gourdFailCount` 在 `PetCaptureManager` 内存中重置为 0，玩家丢失保底加成。
  2. 玩家抓捕失败 5 次后，卸下吞天葫芦，使用常规道具抓捕成功。由于 `attemptCapture` 中判定 `isGourdEquipped` 为 false，`this._gourdFailCount = 0` 未被执行。玩家再次装备吞天葫芦时，依然残留上次的 5 次失败计数。
- **Blast radius**: 存档丢失保底次数影响玩家体验；通过穿脱法宝可以刷取保底加成漏洞。
- **Mitigation**: 将 `_gourdFailCount` 纳入 `ISaveData` 进行持久化存储，并在卸下吞天葫芦时或全局明确重置条件。

### [Low] Challenge 3: SaveManager 数组解析中缺少 null/undefined 空指针防御

- **Assumption challenged**: 假设旧存档或本地 `sys.localStorage` 中解析出的数组数据项均为合法 JSON 对象。
- **Attack scenario**:
  若 `sys.localStorage` 中的 `relicInventory` 或 `pets.eggs` / `pets.appraised` 数组中因历史版本残留或外部修改混入了 `null` 项（如 `[ null, { id: 'relic_1' } ]`），`SaveManager.ts` 在 `rawRelicInv.map(r => ({ id: r.id ... }))` 中试图读取 `r.id` 会直接抛出 `TypeError: Cannot read properties of null`。
- **Blast radius**: 触发 `catch (e)` 导致 SaveManager 将**整个存档完全抹除并重置为默认初始存档**，造成玩家进度全丢。
- **Mitigation**: 在 `.map()` 处理前增加 `.filter(r => r && typeof r === 'object')` 空节点过滤。

### [Low] Challenge 4: 吸血魔剑强化/升星后 baseBonus 增加与 Lifesteal 回复比例硬编码解耦问题

- **Assumption challenged**: 假设法宝强化升级与合成升星后，所有面板加成均能动态反映在战斗被动中。
- **Attack scenario**:
  在 `PlayerController.ts` 的 `triggerVampireLifesteal()` 中，恢复量固定计算为 `Math.floor(damage * 0.05)`。即便玩家将吸血魔剑强化至 Lv.10 或合成至 5 星（`baseBonus` 从 0.05 提升至 0.10+），吸血比例依然锁定为 5%。
- **Blast radius**: 法宝强化与合成升星对吸血魔剑核心回复被动无提升，降低了装备培养的价值反馈。
- **Mitigation**: 修改 `triggerVampireLifesteal`，动态获取装备的 `IRelicData.baseBonus` 作为吸血百分比。

---

## Stress Test Results

| 测试场景 | 预期行为 | 实际/预测行为 | 测试结果 |
|---|---|---|---|
| 1. 吸血魔剑攻击力削减 50% | 装备吸血魔剑时，Player 基础攻击力由 10 削减为 5 | `getEffectiveAttackDamage()` 计算得出 5 | PASS |
| 2. 吸血魔剑造成伤害与飞弹命中恢复 5% HP | 造成 100 点伤害时，主角恢复 5 HP 并在控制台打印日志 | `triggerVampireLifesteal` 恢复 5 HP，`console.log` 打印日志 | PASS |
| 3. 聚宝盆怪物移速提升 20% (init 显式调用) | 传入 baseSpeed=100 时，`Enemy.moveSpeed` 变为 120 | `init` 函数正确将移速乘以 1.2 赋值 120 | PASS |
| 4. 聚宝盆灵石掉落翻倍 | 精英怪掉落灵石由 50 变为 100 | `Enemy.die()` 中 `dropAmount *= 2` 正确结算为 100 | PASS |
| 5. 吞天葫芦抓捕失败成功率按 5% 递增 | 抓捕失败 2 次，额外成功率加成 +10% | `calculateCaptureRate` 加上 `2 * 0.05` | PASS |
| 6. 吞天葫芦抓捕成功重置计数 | 抓捕成功后 `_gourdFailCount` 清零 | `attemptCapture` 成功分支正确置 `_gourdFailCount = 0` | PASS |
| 7. 装备面板穿脱法宝 | 支持主武器、配饰、葫芦三部位穿脱 | `equipRelic` 与 `unequipRelic` 正确更新 `_equippedRelics` | PASS |
| 8. 装备面板升级扣除资源 | 强化 Lv.1 法宝消耗 100 灵石 / 10 材料，等级 +1 | 正确扣除 100 灵石与 10 材料，等级变为 2 | PASS |
| 9. 装备面板合成升星消耗 2 胚子 | 消耗 2 个同配置同星级胚子，目标升至 2 星并彻底删除原料 | 目标 `star` 变 2，`_relicInventory` 中删除了 2 个原料胚子 | PASS |
| 10. 合成升星 5 星封顶校验 | 5 星目标法宝提示无法合成 | 返回 `success: false` 并提示已达最高 5 星 | PASS |
| 11. 旧存档容错合并 | 缺失 `equippedRelics`/`relicInventory` 的旧存档平滑合并默认值 | 成功解析并填充默认法宝槽位与背包 | PASS |
| 12. 损坏 JSON 解析降级 | 非法 JSON 字符串降级使用 `getDefaultSaveData()` | 捕获 SyntaxError 并初始化默认存档 | PASS |

---

## Unchallenged Areas

- **UI 渲染真实画质与动画帧率** — 受限于 Code-only CLI 环境，未进行 Cocos Creator GPU 渲染与 WebGL 帧率测试。
- **并发多线程存储冲突** — `sys.localStorage` 在单线程 JS 引擎下运行，不存在多线程竞态，无需深入竞态测试。
