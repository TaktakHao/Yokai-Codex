## 2026-07-22T18:08:17Z
你被派发为 Worker Agent，所有思考与沟通语言必须为中文。
你的工作目录为: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_art_1`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

【任务要求】
请在项目 `/Users/wesson/YokaiCodex` 完成以下三项核心需求：

1. **R1. 美术风格定义与文档化 (`Design/Art_Style_Guide.md`)**：
   - 创建 `Design/Art_Style_Guide.md` 文件。
   - 详细制定“简约、可爱”风格 (Chibi 2D Q版) 的具体表现规范（色彩饱和度、高明度调色板、角色头身比 Q版 2头身、2~4px 软圆润描边、五官与肢体特征、画布与留白规范）。
   - 注释全为中文，结构清晰严谨。

2. **R2. 批量生成第一关卡美术素材**：
   - 按照 R1 标准生成全套图像资产：
     - 主角：`assets/resources/Textures/Player/player.png` (256x256)
     - 无缝草地背景：`assets/resources/Textures/bg_grassland.png` (720x1280)
     - Boss 千年树妖：`assets/resources/Textures/Enemies/boss_millennium_tree_demon.png` (256x256) 及 `boss_1.png`
     - 5 种小怪：`mob_grass_sprite.png` (80x80), `mob_wood_spirit.png` (90x90), `mob_venom_snake.png` (100x100), `mob_gale_wolf.png` (100x100), `elite_grass_brute.png` (140x140)。(同步更新 `elite_gale_wolf_alpha.png`, `elite_wood_golem.png`, `monster_1.png`, `monster_2.png` 为真彩/透明 PNG)

3. **R3. 图片后处理与工程导入**：
   - 编写并运行 Python 图像处理脚本（使用 Pillow），自动去除主角/怪物图片的白色/杂色背景，转换为 32-bit RGBA 格式并包含透明 Alpha 通道（像素边缘 Alpha 平滑，杜绝纯白正方形底）。
   - 适配背景 `bg_grassland.png` 尺寸。
   - 精确覆盖到 `assets/resources/Textures/` 对应子目录。
   - 检查 `assets/Scripts/Utils/VisualLoader.ts`，修正 `ENEMY_TEXTURE_MAP` 避免将贴图强制映射回旧占位图，确保场景中直接使用新贴图。

【交付要求】
- 运行脚本自测所有 Textures 下图片，确保 `mode == 'RGBA'` (角色/怪物) 且包含 Alpha 通道透明度。
- 将变更记录到工作目录的 `changes.md` 与 `handoff.md`。
- 完成后向 Orchestrator 发送消息。
