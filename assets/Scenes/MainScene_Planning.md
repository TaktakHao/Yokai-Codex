# 游戏主场景 (MainScene) 节点树与架构规划文档

本文档描述了 Cocos Creator 中主场景 `MainScene` 的节点结构、UI 分层以及核心组件的挂载设计，指导后续在编辑器中进行场景的实际搭建。

## 1. 场景节点层次结构 (Node Hierarchy)

建议的主场景节点树如下：

```text
MainScene (Scene)
├── Canvas (Canvas 组件, Widget 组件)
│   ├── Camera (Camera 组件 - 负责 2D UI 与场景渲染)
│   ├── BackgroundLayer (节点 - 游戏背景层)
│   │   └── Sprite_BG (Sprite 组件 - 背景底图)
│   ├── GameLayer (节点 - 核心游戏元素层)
│   │   └── IdleEntity (空节点 - 挂载逻辑)
│   ├── UILayer (节点 - UI基础层)
│   │   └── UIRoot (空节点 - 挂载 UIManager.ts)
│   │       ├── MainPanel (节点/预制体实例 - 主界面UI，包含常驻HUD)
│   │       │   ├── Label_ResourceCount (Label 组件 - 显示当前累积资源)
│   │       │   └── Button_Upgrade (Button 组件 - 资源消耗与升级交互)
│   ├── PopupLayer (节点 - 弹窗层，用于放置对话框、确认框等)
│   └── TopLayer (节点 - 顶层，用于常驻通知、系统广播、加载动画)
└── GlobalManager (节点 - 全局常驻节点, 挂载跨场景管理系统，可选)
```

## 2. 各层级说明与组件挂载说明

### Canvas 层
- **作用**：2D 渲染的根节点，自动适配不同屏幕分辨率和设备。
- **组件要求**：必须挂载 `Canvas` 和 `Widget` 组件，`Widget` 的 Top/Bottom/Left/Right 边距应设为 0，以确保完美适配全屏。

### BackgroundLayer (背景层)
- **作用**：存放游戏最底层的静态背景资源或视差滚动的远景。此层在渲染层级最下方，不参与交互逻辑。

### GameLayer (核心玩法逻辑层)
- **作用**：游戏玩法的核心载体，所有的 2D 实体或者逻辑控制器都放在此处。
- **核心节点 `IdleEntity`**：
  - **组件挂载**：`IdleSystem.ts`。
  - **功能机制**：负责游戏核心的“放置产出逻辑”。当场景被加载时，`IdleSystem` 的 `onLoad` 将自动计算离线收益并开启 `update` 循环实现每帧的资源在线积累。

### UILayer (界面系统层)
- **作用**：管理游戏常规的 UI 面板和视图。
- **核心节点 `UIRoot`**：
  - **组件挂载**：`UIManager.ts`。
  - **功能机制**：作为所有面板的父容器，所有需要被动态加载和打开的面板预制体 (Prefab) 都会被实例化并作为 `UIRoot` 的子节点。管理器会通过 SiblingIndex 或者 Z-Index 来调整界面的层级覆盖关系。

### PopupLayer & TopLayer (弹窗与置顶层)
- **作用**：独立出来的层级用于确保重要弹窗或全屏 Loading 界面绝对不被常规的 UI 面板（UILayer）所遮挡。
- **扩展**：未来 `UIManager` 可以进一步扩展，通过参数控制目标面板是放入 `UILayer` 还是 `PopupLayer`。

### GlobalManager (系统控制层)
- **作用**：若项目后续扩充至多场景，可创建一个独立于 Canvas 的全局节点。
- **功能机制**：挂载持久化管理脚本，结合 `game.addPersistRootNode(node)` 保证在场景切换时该节点和数据不被销毁。
