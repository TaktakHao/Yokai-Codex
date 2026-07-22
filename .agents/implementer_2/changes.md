# Changes Report

## 修改文件列表
- `assets/Scripts/Logic/Enemy.ts`

## 详细修改说明与设计决策

### 1. 修复 FINDING-01 (`getOriginalColor`)
- **文件**: `assets/Scripts/Logic/Enemy.ts`
- **原代码逻辑问题**:
  原代码在 `getOriginalColor()` 中优先对 `this.isElite` 进行判定（第 115-117 行），若怪物被标记为精英怪（`this.isElite === true`），会直接返回金色 `Color(255, 215, 80, 255)`。导致当怪物为 BOSS（路径包含 `'boss'`）且同时拥有 `isElite` 标记时，BOSS 专属的深血红色 `Color(255, 80, 80, 255)` 被精英怪金色覆盖。
- **修改方案**:
  重构 `getOriginalColor()` 的判断顺序，优先判定 `path.includes('boss')`。当怪物为 BOSS 时，无论 `this.isElite` 状态如何，统一且优先返回 BOSS 专属深血红 `Color(255, 80, 80, 255)`。

### 2. 修复 FINDING-02 (`setupVisual`)
- **文件**: `assets/Scripts/Logic/Enemy.ts`
- **原代码逻辑问题**:
  原代码在 `setupVisual()` 中先判定 `if (path.includes('boss'))` 设置 2.2x 巨化尺寸 `Size(96, 96)` 与 `Vec3(2.2, 2.2, 1)`（第 142-145 行），随后紧接着运行独立的 `if (this.isElite)` 块（第 148-152 行）。若 BOSS 的 `isElite` 属性为 true，其尺寸与缩放会被精英怪 1.5x `Size(64, 64)` / `Vec3(1.5, 1.5, 1)` 重新覆盖。
- **修改方案**:
  将 `setupVisual()` 中 `isElite` 判定调整为 `else if (this.isElite)` 结构。优先执行 `path.includes('boss')` 分支；若为 BOSS，应用 `Size(96, 96)` 与 `Vec3(2.2, 2.2, 1)` 后跳过 `isElite` 分支，彻底避免 BOSS 尺寸与缩放被精英怪配置覆盖。
