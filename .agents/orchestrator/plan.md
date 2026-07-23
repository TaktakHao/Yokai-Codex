# Orchestration Plan: 《万妖录：躺平修仙》第一关“简约可爱风”美术资源重构与替换

## 任务目标
完成《万妖录：躺平修仙》第一关美术风格规范定义、素材生成、抠图/后处理转透明 RGBA PNG 以及工程导入，替换 `assets/resources/Textures/` 对应子目录素材，并通过全流程审评与诚信审计。

## 编排架构 (Project Pattern)

### 阶段 0: 资源映射与代码依赖探查 (Exploration Phase)
- 调度 `teamwork_preview_explorer` 探查现有的 `assets/resources/Textures/` 目录结构、图片尺寸、Alpha 通道状态以及代码/预制体中对各贴图资源的直接依赖关系。

### 阶段 1: 美术风格制定 (M_ART_1)
- 调度 Worker / Explorer 制定“简约、可爱”风格的具体规范（色彩饱和度、角色头身比、线条特征、美术指南），输出至 `Design/Art_Style_Guide.md`。

### 阶段 2: 美术素材生成与后处理导入 (M_ART_2 & M_ART_3)
- 调度 `teamwork_preview_worker` 批量生成 1 个主角、1 张无缝草地背景 `bg_grassland.png`、1 个 Boss 千年树妖、5 种小怪素材。
- 编写/运行 Python 脚本（Pillow 库）对角色与怪物素材进行白色背景自动抠除，转换为 RGBA 透明通道 PNG；对草地背景进行缩放适配，并精准覆盖 `assets/resources/Textures/` 对应路径。

### 阶段 3: 严格评审、测试与防作弊取证审计 (M_ART_4)
- 调度 `teamwork_preview_reviewer` 进行文件规范与贴图参数（RGBA、Alpha 通道、尺寸）独立审查。
- 调度 `teamwork_preview_challenger` 编写脚本检测所有 PNG 像素透明度与边界。
- 调度 `teamwork_preview_auditor` 执行取证诚信审计，确保真实替换且无假白底/硬编码作弊。
- 门禁全通后生成 `victory_report.md` 并向 Parent Sentinel 汇报。
