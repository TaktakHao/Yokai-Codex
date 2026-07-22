## 2026-07-21T08:03:22Z
请针对《万妖录：躺平修仙》第九阶段的 4 大核心需求进行项目代码库的技术探查与分析：

1. 工作目录：`/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1`
2. 需求核查范围：
   - R1. 宠物吞噬升星与化形系统 (`PetCaptureManager.ts`, `PetFollower.ts`, `HomeManager.ts`)
   - R2. 局外宠物盲盒孵化鉴定 UI 交互与变异率 (`PetCaptureManager.ts`, `UIManager.ts`, `AppraisalPanel.ts`)
   - R3. 五行属性共鸣羁绊系统 (`PetCaptureManager.ts`, `HomeManager.ts`, `PlayerController.ts`, `PetFollower.ts`)
   - R4. 洞府家具装修系统 (`HomeManager.ts`, `SaveManager.ts`, UI)

3. 请深入查阅 `assets/Scripts/` 目录下相关的 TypeScript 代码结构、接口与字段定义，分析：
   - 现有 `PetData` / 宠物属性数据结构中缺少哪些字段 (如 star, isEvolved, element, rarity, isMutated 等)。
   - `HomeManager.ts` 目前如何管理资源 (灵石、材料) 和上阵宠物列表，如何增加家具购买持久化与共鸣统计。
   - `PetFollower.ts` 的投射物/飞弹伤害和尺寸计算逻辑。
   - `PlayerController.ts` 数值属性计算点（攻击力、每秒回血、CDR、暴击率、防御力/免伤）。
   - `UIManager.ts` 如何注册和弹框渲染 UI 面板，如何防御性纯代码构建 `AppraisalPanel`。
   - `SaveManager.ts` 目前的序列化与反序列化机制，如何保存和读取宠物星级/化形/五行与洞府家具。

4. 输出要求：
   - 将完整的技术探查与重构落地方案写入文件：`/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1/analysis.md`
   - 完成后写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1/handoff.md`，并通过 `send_message` 向 Orchestrator 汇报。
