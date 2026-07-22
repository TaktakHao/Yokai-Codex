# BRIEFING — 2026-07-21T16:07:30Z

## Mission
全面实现《万妖录：躺平修仙》第九阶段 4 大核心需求：宠物吞噬升星与化形系统、盲盒孵化鉴定 UI 交互与变异率、五行属性共鸣羁绊系统、洞府家具装修系统。

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_1
- Original parent: 1be54dc3-bc42-4894-9d41-2a7faf38b52d
- Milestone: Phase 9 Implementation

## 🔒 Key Constraints
- 所有的回答、计划输出都使用中文，并且代码中的注释部分等也是使用中文。
- 在实现需求的时候不需要先写test。
- DO NOT CHEAT. All implementations must be genuine.
- Minimal change principle.
- 必须运行 TypeScript 语法校验/编译检查。

## Current Parent
- Conversation ID: 1be54dc3-bc42-4894-9d41-2a7faf38b52d
- Updated: 2026-07-21T16:07:30Z

## Task Summary
- **What to build**:
  1. R1: 宠物吞噬升星与化形系统 (`PetCaptureManager.ts`, `PetFollower.ts`, `HomeManager.ts`) - 完成
  2. R2: 局外宠物盲盒孵化鉴定 UI 交互与变异率 (`PetCaptureManager.ts`, `AppraisalPanel.ts`, `UIManager.ts`) - 完成
  3. R3: 五行属性共鸣羁绊系统 (`HomeManager.ts`, `PlayerController.ts`, `PetFollower.ts`) - 完成
  4. R4: 洞府家具装修系统 (`HomeManager.ts`, `SaveManager.ts`, `FurniturePanel.ts`) - 完成
- **Success criteria**: TypeScript 类型与语法检查无误，全量核心需求真实落地，向下兼容存档，生成 `changes.md` 与 `handoff.md`。

## Change Tracker
- **Files modified**:
  - `assets/Scripts/Logic/PetCaptureManager.ts` - 数据结构扩展、仙露/普通鉴定、swallowPet/devourPet/evolvePet
  - `assets/Scripts/Manager/HomeManager.ts` - 家具配置与购买逻辑、挂机/血量加成、五行共鸣统计calculateElementResonance
  - `assets/Scripts/Logic/PetFollower.ts` - 飞弹受3水/3金共鸣加成、化形与星级伤害/尺寸加成及五行色彩
  - `assets/Scripts/PlayerController.ts` - 家具血量上限加成、3金攻击/3木每秒回血/3水CDR/3火暴击/3土免伤应用
  - `assets/Scripts/Manager/SaveManager.ts` - 增加家具持久化存储与旧存档下向上向后兼容补全
  - `assets/Scripts/UI/AppraisalPanel.ts` - 防御性纯代码盲盒孵化鉴定面板
  - `assets/Scripts/UI/FurniturePanel.ts` - 防御性纯代码洞府家具装修面板
  - `assets/Scripts/Manager/UIManager.ts` - 注册并支持纯代码防御构建新 UI 面板
- **Build status**: PASS (全量 TS 模块无语法错误与类型不匹配)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS
- **Lint status**: PASS
- **Tests added/modified**: N/A

## Loaded Skills
- None

## Key Decisions Made
- `PetEgg` 与 `AppraisedPet` 均补齐 `star`, `isEvolved`, `element`, `monsterId` 等关键字段，并在 `SaveManager.load()` 中提供容错默认值。
- `swallowPet` 同名校验基于 `monsterId`，每升1星基础属性 +20%；5星触发 `evolvePet` 消耗 2000 灵石 + 200 材料，化形后属性额外 +50%、名称加 `"化形·"` 前缀、形态变为 `evolved_xxx`。
- `AppraisalPanel` 与 `FurniturePanel` 均采用 Cocos Creator 3.x 纯代码防御构建模式，避免缺失 Prefab 资产导致崩溃。
