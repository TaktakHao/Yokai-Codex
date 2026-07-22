# 修改记录 (Changes Log)

## 变更文件列表 (Files Modified)
1. `assets/Scripts/Manager/HomeManager.ts`
2. `assets/Scripts/Logic/PetFollower.ts`

---

## 详细修改说明 (Detailed Modification Details)

### 1. `assets/Scripts/Manager/HomeManager.ts`
- **修改位置**: 行 701 - 740
- **修改内容**:
  - 修改 `addSpiritStones(amount: number)`：将原有的 `if (amount > 0)` 更改为 `if (amount !== 0)`，使用 `Math.max(0, this._spiritStones + amount)` 限制资源下限为 0，支持传入负数进行实际资源扣除，并更新持久化数据 `saveData()`。
  - 修改 `addMaterials(amount: number)`：将原有的 `if (amount > 0)` 更改为 `if (amount !== 0)`，使用 `Math.max(0, this._materials + amount)` 限制资源下限为 0，支持传入负数进行实际资源扣除，并更新持久化数据 `saveData()`。
  - 新增 `deductSpiritStones(amount: number)`：提供显式的灵石扣减辅助接口，当 `amount > 0` 时转调用 `addSpiritStones(-amount)`。
  - 新增 `deductMaterials(amount: number)`：提供显式的修仙材料扣减辅助接口，当 `amount > 0` 时转调用 `addMaterials(-amount)`。
- **修改原因**: 原有的 `if (amount > 0)` 校验导致 `PetCaptureManager.ts` 孵化与化形扣除负数灵石/材料（如 `-100`, `-300`, `-2000` 灵石与 `-30`, `-200` 材料）时被静默忽略。修改后支持负数扣减且确保资源不低于 0。

### 2. `assets/Scripts/Logic/PetFollower.ts`
- **修改位置**: 行 234 - 243
- **修改内容**:
  - 在 `fireProjectile` 方法中，移除了 `const evolveDamageMult = isEvolved ? 1.5 : 1.0;` 以及伤害计算公式 `Math.floor(this.petData.attack * (1 + goldAtkBonus) * evolveDamageMult)` 中的二次乘算。
  - 调整后的飞弹伤害计算为 `Math.floor(this.petData.attack * (1 + goldAtkBonus))`。
- **修改原因**: `PetCaptureManager.ts` 中的 `evolvePet` 方法在宠物化形突破时已将基础攻击力提升 50%（`pet.attack = Math.floor(pet.attack * 1.50)`），`this.petData.attack` 已包含化形加成。`PetFollower.ts` 再次乘以 `evolveDamageMult = 1.5` 会导致最终伤害变为 2.25 倍。移除二次乘法后保证化形攻击力加成为精确的 +50%。

---

## 构建/语法检查 (Build & Syntax Check Status)
- 语法与逻辑检查：通过
- 遵守 minimal change 原则，注释均为中文，无虚假实现。
