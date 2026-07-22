## 2026-07-21T16:04:20Z

请作为 Phase 9 代码实现 Worker (teamwork_preview_worker)，全面实现《万妖录：躺平修仙》第九阶段的 4 大核心需求：

1. 工作目录：`/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_1`
2. 参考设计文档：`/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1/analysis.md`
3. 必须严格遵循以下需求与约束进行代码编写（工作目录为项目根目录 `/Users/wesson/YokaiCodex`）：

   **R1. 宠物吞噬升星与化形系统 (`PetCaptureManager.ts`, `PetFollower.ts`, `HomeManager.ts`)**:
   - `PetEgg` 与 `AppraisedPet` 补充 `star` (1-5星, 默认1星或0~5星，升星最高5星)、`isEvolved: boolean`、`element: '金'|'木'|'水'|'火'|'土'`、`monsterId: string`。
   - `PetCaptureManager.ts` 实现吞噬同名宠物(同 monsterId)升星接口 `swallowPet(targetPetId, foodPetId)` 或 `devourPet`，每升1星基础属性 (攻击、生命、速度) +20%。
   - 满星 5 星触发“化形 (Evolve)”接口 `evolvePet(petId)`，校验并消耗 `HomeManager.ts` 中的挂机灵石 (2000) 与材料 (200)。
   - 化形后属性额外 +50%，名称加前缀 `"化形·"`，外观标识 `form` 变更为 `evolved_xxx`。
   - `PetFollower.ts` 飞弹投射物伤害与尺寸在化形后额外 +50%。

   **R2. 局外宠物盲盒孵化鉴定 UI 交互与变异率 (`PetCaptureManager.ts`, `AppraisalPanel.ts`, `UIManager.ts`)**:
   - `PetCaptureManager.ts` 鉴定孵化接口：
     - 普通孵化 (消耗 100 灵石, 5% 变异率)
     - 仙露孵化 (消耗 300 灵石 + 30 材料, 15% 变异率, 紫色史诗或以上保底)
   - 构建 `AppraisalPanel`（在 `UIManager.ts` 中注册并支持纯代码防御性构建）：选择待孵化蛋，摇晃/滚动仪式，展示宠物名字、稀有度、五行与变异状态。

   **R3. 五行属性共鸣羁绊系统 (`HomeManager.ts`, `PlayerController.ts`, `PetFollower.ts`)**:
   - 宠物鉴定出库时赋予五行属性 (`element: '金' | '木' | '水' | '火' | '土'`)。
   - `HomeManager.ts` 统计已上阵 (最多5只) 宠物五行属性，同系满 3 只激活共鸣：
     - 3金: 全员基础攻击 +20%
     - 3木: 主角与宠物每秒恢复 15 HP
     - 3水: CDR / 宠物攻速 +15%
     - 3火: 暴击率 +20%
     - 3土: 防御力 +20% / 免伤 20%
   - 局内 `PlayerController.ts` 与 `PetFollower.ts` 的实际数值计算中检测并应用共鸣加成。

   **R4. 洞府家具装修系统 (`HomeManager.ts`, `SaveManager.ts`, UI/主界面)**:
   - `HomeManager.ts` 增加家具购买与持久化逻辑：
     - 极品寒玉床: 挂机收益速率 +15%
     - 红木躺椅: 主角初始生命上限 +50
   - 保存至 `SaveManager.ts` 本地存档，并在主界面/Home UI 支持购买操作。

4. **MANDATORY INTEGRITY WARNING**:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

5. **编译与验证**:
   在实现后，请运行代码语法与编译校验，确保无 TypeScript 类型报错或运行错误。将修改明细写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_1/changes.md`，并将 Handoff 报告写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_1/handoff.md`，随后通过 `send_message` 向 Orchestrator 汇报。
