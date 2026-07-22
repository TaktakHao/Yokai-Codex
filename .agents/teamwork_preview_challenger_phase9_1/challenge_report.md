# Phase 9 挑战者黑盒测试与数值校验报告 (Challenge Report)

## Challenge Summary

**Overall risk assessment**: **CRITICAL**

对 Worker 1 第九阶段 (R1-R4) 的核心功能模块进行了黑盒测试、边界条件压力测试与实操数值校验。本次测试成功发现并捕获了 **1 项阻断级严重漏洞 (CRITICAL BUG)**、**1 项数值双重叠加异常 (MEDIUM ANOMALY)** 以及全面的边界响应校验结果。

---

## Challenges (发现的问题与挑战)

### [CRITICAL] Challenge 1: `HomeManager.ts` 扣费方法 `if (amount > 0)` 防护判断导致盲盒鉴定与宠物化形“零成本无限刷”

- **被挑战的假设**: 假定 `PetCaptureManager.ts` 在执行 `appraisePetEgg` (普通/仙露孵化) 与 `evolvePet` (5星化形) 时调用的 `homeMgr.addSpiritStones(-amount)` 和 `homeMgr.addMaterials(-amount)` 能够正确扣除玩家的灵石与修仙材料。
- **攻击场景 / 触发条件**:
  1. 玩家拥有一只 5 星宠物以及 2000 灵石、200 材料。
  2. 触发 `evolvePet(petId)`，`evolvePet` 前置校验 `spiritStones >= 2000` 且 `materials >= 200` 成功通过。
  3. `evolvePet` 接着调用 `homeMgr.addSpiritStones(-2000)` 和 `homeMgr.addMaterials(-200)` 尝试扣费。
  4. 查看 `HomeManager.ts` 第 704-720 行源码：
     ```typescript
     public addSpiritStones(amount: number) {
         if (amount > 0) {
             this._spiritStones += amount;
             this.saveData();
         }
     }
     public addMaterials(amount: number) {
         if (amount > 0) {
             this._materials += amount;
             this.saveData();
         }
     }
     ```
  5. 传入的 `-2000` 与 `-200` 均为负数，`if (amount > 0)` 结果为 `false`！
- **爆炸半径 (Blast Radius)**:
  - 灵石与材料扣费被静默忽略！
  - 玩家在孵化妖兽蛋（普通扣100、仙露扣300灵石+30材料）和 5 星化形（扣2000灵石+200材料）时，只要账户初始余额满足门槛，实际资源**完全不会被扣除**！
  - 玩家可以无限孵化盲盒、无限免费化形，游戏经济体系彻底失效。
- **修复建议 (Mitigation)**:
  - 修改 `HomeManager.ts` 中的 `addSpiritStones` 和 `addMaterials` 方法，移除 `if (amount > 0)` 硬性限制，改为支持正负数增减（并设置 0 存底防护）：
    ```typescript
    public addSpiritStones(amount: number) {
        this._spiritStones = Math.max(0, this._spiritStones + amount);
        this.saveData();
    }
    public addMaterials(amount: number) {
        this._materials = Math.max(0, this._materials + amount);
        this.saveData();
    }
    ```

---

### [MEDIUM] Challenge 2: `PetFollower.ts` 化形飞弹伤害倍率 1.5x 双重乘算叠加

- **被挑战的假设**: 假定宠物化形突破后飞弹伤害增加 50% (即 1.5 倍基础攻击)。
- **攻击场景 / 触发条件**:
  1. 宠物化形时，`PetCaptureManager.evolvePet` 已对基础属性进行提升：`pet.attack = Math.floor(pet.attack * 1.50)`。
  2. 局内 `PetFollower.ts` 发射飞弹时 (`fireProjectile`) 再次计算：
     `const evolveDamageMult = isEvolved ? 1.5 : 1.0;`
     `const damageVal = Math.floor(this.petData.attack * (1 + goldAtkBonus) * evolveDamageMult);`
  3. `this.petData.attack` 本身已经是化形后的 `BaseAtk * 1.5`，飞弹发射时又乘了 `1.5`。
- **爆炸半径 (Blast Radius)**:
  - 化形宠物的实际飞弹伤害提升到了 `1.5 * 1.5 = 2.25` 倍（即 +125% 伤害，而非设计文档要求的 +50%）。
- **修复建议 (Mitigation)**:
  - 确认设计意图：若化形 50% 加成已体现在 `pet.attack` 基础属性中，则 `PetFollower.ts` 中无须再次乘 `evolveDamageMult`；若设计意图为局内飞弹独立加成，则化形时不必重复修改 `pet.attack`。

---

## Stress Test Results (压力与数值测试矩阵)

| 测试项 / 场景 | 预期行为 | 实际/预测行为 | 结论 |
|---|---|---|---|
| **R1.1 异种属吞噬拦截** | 吞噬不同 `monsterId` 宠物时拒绝吞噬 | `swallowPet` 校验 `targetPet.monsterId !== foodPet.monsterId` 返回失败信息 | **PASS** |
| **R1.2 相同宠物吞噬自身** | 传入 `targetPetId === foodPetId` 时拦截 | `swallowPet` 返回“无法吞噬宠物自身” | **PASS** |
| **R1.3 未满5星化形拦截** | 1~4 星宠物调用 `evolvePet` 时拦截 | `evolvePet` 校验 `pet.star < 5` 返回拦截 | **PASS** |
| **R1.4 资源不足化形拦截** | 灵石 < 2000 或材料 < 200 时拦截 | `evolvePet` 校验 `spiritStones < 2000 \|\| materials < 200` 返回拦截 | **PASS** |
| **R1.5 5星化形资源扣除** | 扣除 2000 灵石与 200 材料 | 由于 `HomeManager.addSpiritStones(-2000)` 内部 `if(amount>0)` 限制，**实际 0 扣除** | **FAIL (CRITICAL)** |
| **R1.6 化形前后飞弹尺寸** | 5星化形后飞弹尺寸按 1.5x 放大 | 5星未化形尺寸为 `Math.floor(14*1.4)=19`；化形后为 `Math.floor(14*1.4*1.5)=29` | **PASS** |
| **R1.7 吞噬材料宠物下阵** | 被吞噬的材料宠物自动从出战/打工列表移除 | `homeMgr.unequipPet` 与 `dispatchFarming/Mining(null)` 正确触发下阵并从背包清除 | **PASS** |
| **R2.1 盲盒孵化资源不足拦截** | 灵石 < 100 (普通) 或 灵石<300/材料<30 (仙露) 时拦截 | `appraisePetEgg` 与 `AppraisalPanel` 均有前置拦截 | **PASS** |
| **R2.2 盲盒孵化扣费校验** | 孵化成功后扣除对应灵石与材料 | `addSpiritStones(-100/-300)` 因负数判断被忽略，**实际 0 扣除** | **FAIL (CRITICAL)** |
| **R2.3 仙露孵化紫保底逻辑** | 仙露孵化普通/稀有蛋自动提升为“史诗” | `if (useElixir && (rarity==='普通'\|\|rarity==='稀有')) finalRarity = '史诗'` 正确生效 | **PASS** |
| **R2.4 AppraisalPanel 纯代码构建** | 缺失 Prefab 时纯代码兜底构建 UI | 720x1280 布局、摇晃 Tween 动画、按钮绑定及异常捕获均健全 | **PASS** |
| **R3.1 五行共鸣精准触发** | 上阵 3金/3木/3水/3火/3土 时各自激活对应加成 | `calculateElementResonance()` 统计已上阵五行，满3只精准触发对应加成 | **PASS** |
| **R3.2 局内 3木 15HP/s 回血** | 局内每秒回复 15 HP | `PlayerController.handleResonanceHpRegen` 依据 `woodHpRegen * deltaTime` 实时增加血量 | **PASS** |
| **R3.3 局内 3水 15% CDR** | 攻击冷却缩减 15% | `effectiveCooldown = attackCooldown * (1 - 0.15)` 在主角与宠物中生效 | **PASS** |
| **R3.4 局内 3火 20% 暴击率** | 暴击率由 5% 提升至 25% | `critRate = 0.05 + 0.20`，触发暴击造成 1.5 倍重创 | **PASS** |
| **R3.5 局内 3金 20% 攻击加成** | 攻击力提升 20% | `finalDamage = attackDamage * 1.20` 注入主角与宠物伤算 | **PASS** |
| **R3.6 局内 3土 20% 免伤** | 受击伤害降低 20% | `actualDamage = Math.max(1, Math.floor(damage * 0.80))` 减伤生效 | **PASS** |
| **R4.1 家具购买与扣费** | 寒玉床 (2000石/200材) 与躺椅 (1500石/150材) 购买扣费 | `buyFurniture` 直接进行 `-=` 扣费，扣费正常；重复购买拦截正常 | **PASS** |
| **R4.2 家具属性生效** | 寒玉床挂机 rate+15%，躺椅主角血量上限+50 | `getSpiritStoneRate()` 和 `PlayerController.start()` 正确叠加家具加成 | **PASS** |
| **R4.3 SaveManager 兼容补全** | 旧存档无 `furniture`, `star`, `element`, `isEvolved` 时安全反序列化补全 | `SaveManager.load()` 自动填充 `element:'金'`, `star:1`, `isEvolved:false`, `furniture:[]` 且不报错 | **PASS** |

---

## Unchallenged Areas (未挑战区域)

- **UI 复杂动画表现**：未在真实 GPU 渲染环境下测量 60FPS 帧率流畅度。
- **长时间挂机溢出测试**：`settleOfflineEarnings` 的 48 小时软上限公式已代码审查通过，但未进行真实 48 小时物理时间跨度等待。
