# Handoff Report — Phase 9 缺陷修复交接报告

## 1. Observation (观察事实)
- **问题 1 资源扣减失效**:
  - `assets/Scripts/Manager/HomeManager.ts` 第 705 与 717 行原代码：
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
  - `assets/Scripts/Logic/PetCaptureManager.ts` 尝试传入负数扣除资源：
    - 普通孵化（第 224 行）：`homeMgr.addSpiritStones(-100)`
    - 仙露孵化（第 217-218 行）：`homeMgr.addSpiritStones(-300)` 与 `homeMgr.addMaterials(-30)`
    - 5星化形（第 532-533 行）：`homeMgr.addSpiritStones(-2000)` 与 `homeMgr.addMaterials(-200)`
  - 由于 `amount > 0` 校验，负数输入全被静默拦截，导致资源扣减无效。

- **问题 2 化形飞弹伤害二次乘算**:
  - `assets/Scripts/Logic/PetCaptureManager.ts` 第 540 行：`pet.attack = Math.floor(pet.attack * 1.50)`，化形时属性已自带 1.5 倍（+50%）。
  - `assets/Scripts/Logic/PetFollower.ts` 第 241-242 行原代码：
    ```typescript
    const evolveDamageMult = isEvolved ? 1.5 : 1.0;
    const damageVal = Math.floor(this.petData.attack * (1 + goldAtkBonus) * evolveDamageMult);
    ```
  - 飞弹计算二次乘上了 `evolveDamageMult = 1.5`，导致攻击力实际乘算了 `1.5 * 1.5 = 2.25` 倍（+125% 伤害）。

## 2. Logic Chain (推理链条)
- **针对问题 1**:
  - 扣除资源是孵化与化形机制的关键交易约束。如果 `addSpiritStones` 和 `addMaterials` 不接受负数，则直接调用该方法扣减资源会失效。
  - 将条件改为 `if (amount !== 0)`，并通过 `Math.max(0, current + amount)` 保证资源下限不小于 0，同时新增 `deductSpiritStones(amount)` 与 `deductMaterials(amount)` 辅助方法，即可确保孵化与化形扣除精确生效。
- **针对问题 2**:
  - 宠物化形属性提升应为固定的额外 +50%。
  - `petData.attack` 在 `PetCaptureManager.ts` 中完成化形突破时已被乘以 1.50。
  - `PetFollower.ts` 中生成飞弹时，`isEvolved` 仅需用于投射物尺寸放缩 (`evolvedScale`)，伤害计算公式中移除 `evolveDamageMult` 二次乘法，直接使用 `Math.floor(this.petData.attack * (1 + goldAtkBonus))`，即可保证化形伤害属性为精确的 +50%。

## 3. Caveats (注意事项与假设)
- 没有修改任何非相关的游戏逻辑与配置，符合最小修改原则。
- 依赖 `HomeManager` 内部的 `sys.localStorage` 进行离线与资源状态持久化，未改动存储 key 与规则。
- 没有其他地方在伤害公式之外依赖 `evolveDamageMult`。

## 4. Conclusion (最终结论)
- 两项 Phase 9 核心缺陷已全部修复完成，代码无硬编码，逻辑真实准确。
- `HomeManager.ts` 的资源扣除方法已支持负值且具备 0 下限保护；`PetFollower.ts` 飞弹伤害去除了重复的 1.5 倍乘法，化形伤害恢复为精准的 +50%。

## 5. Verification Method (验证方法)
1. **代码检查**:
   - 检查 `assets/Scripts/Manager/HomeManager.ts` 中的 `addSpiritStones` 与 `addMaterials` 方法，确认 `if (amount !== 0)` 与 `Math.max(0, ...)` 均已生效。
   - 检查 `assets/Scripts/Logic/PetFollower.ts` 中的 `fireProjectile` 方法，确认已移除 `evolveDamageMult` 乘算。
2. **逻辑流程验证**:
   - 校验当 `PetCaptureManager.ts` 执行 `homeMgr.addSpiritStones(-100)`、`homeMgr.addSpiritStones(-300)`、`homeMgr.addSpiritStones(-2000)` 时，`HomeManager._spiritStones` 扣除对应值且保存。
   - 校验化形后的宠物在 `PetFollower.ts` 触发开火时，其输出伤害 `damageVal` 为 `petData.attack * (1 + goldAtkBonus)`，不存在二次 1.5 倍乘算。
