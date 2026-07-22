# 对抗性测试与验证报告 (Challenge Report)

## Challenge Summary

**Overall risk assessment**: HIGH

通过针对《万妖录：躺平修仙》第一关核心逻辑（R1 战斗闭环与 R2 宠物抓捕机制）编写并运行对抗性测试脚本（`verify_r1_r2.py`），验证了大部分 AI 追击向量、索敌、受击红闪、伤害飘字、对象池回收、宠物 360° 环形跟随、化形飞弹与葫芦斩杀抓捕公式的正确性。

同时，实证测试成功定位到 **2 项影响 BOSS 视觉呈现的 HIGH 级别缺陷**：由于 `Enemy.ts` 中 `isElite` 条件的判断顺序优先于 BOSS 的专属判定，导致波次配置中带有 `is_elite: true` 的 BOSS 节点的专属深血红 Color Tint 与 2.2x 缩放尺寸被强制覆盖为精英怪的金色与 1.5x 尺寸。

---

## Challenges

### [HIGH] Challenge 1: BOSS 专属 Color Tint 被精英怪金色覆盖 (FINDING-01)

- **Assumption challenged**: 假设在 `Level_1_Waves.json` 中配置了 `is_elite: true` 的 BOSS 怪物（如 `boss_millennium_tree_demon`）能够正常显示设计要求的深血红色 (RGB: 255, 80, 80)。
- **Attack Scenario**:
  当关卡刷出 600s 的终极 BOSS `boss_millennium_tree_demon` 时，`Enemy.ts` 调用 `getOriginalColor()` 获取固有 Tint 颜色。
  源码第 115 行优先判定 `if (this.isElite)`，由于 BOSS 在波次配置中标记了 `is_elite: true`，代码在第 116 行直接返回了精英怪的金色 `Color(255, 215, 80, 255)`，永远无法走到第 126 行 `else if (path.includes('boss'))` 返回深血红色的分支。
- **Blast Radius**: 第一关终极 BOSS 丧失专属深血红视觉辨识度，呈现为普通金色精英怪色彩。
- **Mitigation**: 修改 `Enemy.ts` 中 `getOriginalColor()` 的判定顺序，将 `path.includes('boss')` 的特化判定移至 `if (this.isElite)` 之前。

```ts
// 建议修复方案 (Enemy.ts):
public getOriginalColor(): Color {
    const path = this.texturePath || '';
    if (path.includes('boss')) {
        return new Color(255, 80, 80, 255);   // BOSS 特化：深血红
    }
    if (this.isElite) {
        return new Color(255, 215, 80, 255);  // 精英怪：金黄色
    }
    ...
}
```

---

### [HIGH] Challenge 2: BOSS 专属 2.2x 缩放与 96x96 尺寸被精英怪 1.5x 覆盖 (FINDING-02)

- **Assumption challenged**: 假设 BOSS 怪物能在场景中展现 2.2x 巨大化 (96x96) 的霸气视觉体型。
- **Attack Scenario**:
  `Enemy.ts` 的 `setupVisual()` 函数中：
  第 142 行 `if (path.includes('boss'))` 将 `size` 设为 `Size(96, 96)`，`scale` 设为 `Vec3(2.2, 2.2, 1)`。
  紧接着在第 148 行执行 `if (this.isElite)`，重新将 `size` 覆盖为 `Size(64, 64)`，`scale` 覆盖为 `Vec3(1.5, 1.5, 1)`。
- **Blast Radius**: BOSS 视觉体型缩水 32%，无法展现关卡终极 BOSS 应有的巨型压迫感。
- **Mitigation**: 调整 `setupVisual()` 中 `isElite` 与 `boss` 判定的优先次序，或在 `isElite` 赋值前排除 `boss` 路径。

---

## Stress Test Results (实证测试断言结果)

| 编号 | 测试场景 | 预期行为 | 实际行为 | 测试结果 |
|---|---|---|---|---|
| TC-1.1 | 普通草精 Tint 恢复与尺寸 | Color(120,230,120), Size 48x48 | Color(120,230,120), Size 48x48 | **PASS** |
| TC-1.2 | 木灵 Tint 恢复 | Color(210,180,120) | Color(210,180,120) | **PASS** |
| TC-1.3 | 精英草怪 Tint 恢复与尺寸 | Color(255,215,80), Scale 1.5x | Color(255,215,80), Scale 1.5x | **PASS** |
| TC-1.4 | BOSS 专属深血红 Tint 判定 | Color(255,80,80) | Color(255,215,80) (金色) | **FAIL (Finding-01)** |
| TC-1.5 | BOSS 2.2x 巨化尺寸判定 | Scale 2.2x, Size 96x96 | Scale 1.5x, Size 64x64 | **FAIL (Finding-02)** |
| TC-1.6 | 聚宝盆法宝 20% 怪物移速加成 | 基础 90 -> 108 px/s | 108.0 px/s | **PASS** |
| TC-1.7 | AI 追击向量与 5px 停止距离 | 距离 > 5.0 时朝玩家步进，<= 5.0 时保持静止 | 满足步进与<=5.0静止防震荡 | **PASS** |
| TC-2.1 | 玩家 300px 最邻近敌人索敌 | 过滤>300px节点，精确选取最近敌人 | 正确选取 150px 处敌人 | **PASS** |
| TC-2.2 | 自动攻击、3金攻击与3火暴击 | Base 10 -> 3金(12) -> 暴击(18) | 造成 18 伤害，目标 HP 100->82 | **PASS** |
| TC-2.3 | 吸血魔剑 50% 攻击削减与 5% 吸血 | Base 10->5 伤害, Player HP+1 | 造成 5 伤害, 恢复 1 HP | **PASS** |
| TC-2.4 | 受击红闪 (0.1s Flash) | 受击变为 Color(255,60,60), 0.1s 后恢复 | 成功变红并定时恢复固有色 | **PASS** |
| TC-2.5 | UI 伤害飘字 (EffectManager & Pool) | 普通 `-10`(y+40), 暴击 `【暴击】-25`(1.3x) | 格式、位置、0.6s淡出回收一致 | **PASS** |
| TC-3.1 | 多宠物 360° 环形偏置点计算 | 4宠物: 0°, 90°, 180°, 270° (R=64) | 正确算出 offset 坐标 | **PASS** |
| TC-3.2 | 宠物 0.08 插值缓动跟随 | Vec3.lerp(curr, target, 0.08) | 平滑插值更新坐标 | **PASS** |
| TC-3.3 | 飞弹尺寸计算 (1星 vs 5星化形) | 1星=14px, 5星化形=29px | 1星 14px, 5星化形 29px | **PASS** |
| TC-3.4 | 飞弹五行/稀有度色彩赋予 | 金:RGB(255,215,0), 木:RGB(60,220,100), 水:RGB(80,180,255) | 色彩正确匹配五行定义 | **PASS** |
| TC-4.1 | 葫芦抓捕公式 (满血 vs 10% HP vs 5% HP) | 100%HP:10%, 10%HP:55%, 5%HP:57.5% | 精确符合公式 `0.1 + (1-hp/max)*0.5` | **PASS** |
| TC-4.2 | 抓捕成功生成盲盒妖兽蛋 `PetEgg` | 产生包含 monsterType, rarity, baseStats 的蛋 | 成功生成并放入背包 | **PASS** |
| TC-4.3 | 吞天葫芦失败 5% 概率保底叠加 | 每次失败 +5% 成功率，成功时重置 | 计数器与叠加成功率计算正确 | **PASS** |
| TC-4.4 | 抓捕成功扣除怪物并归还对象池 | 触发 `CombatEvent_Enemy_Captured` 并 `PoolManager.putNode()` | 怪物节点成功隐退归还 | **PASS** |

---

## Unchallenged Areas

- **Cocos Creator WebGL/Canvas 实际渲染帧率与 GPU 压力**: 未包含在本次 TypeScript 纯逻辑与算法断言测试中。
- **声音与音频系统 (AudioSource / SFX)**: 局内声音播放未进行实时声卡输出断言。
