import { _decorator, Component, Node, director, game, Game, log, warn, error, view, ResolutionPolicy } from 'cc';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { HomeManager } from './HomeManager';
import { LevelManager } from '../LevelManager';
import { PetCaptureManager } from '../Logic/PetCaptureManager';
import { SkillPoolManager } from '../Logic/SkillPoolManager';
import { PoolManager } from './PoolManager';
import { EffectManager } from './EffectManager';
import { EventManager, UIEvent, CombatEvent } from './EventManager';
import { DialogueSystem } from '../DialogueSystem';

const { ccclass, property } = _decorator;

/** 游戏全局状态枚举 */
export enum GameState {
    INIT = 'INIT',
    MAIN_MENU = 'MAIN_MENU',
    HOME = 'HOME',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER',
    VICTORY = 'VICTORY'
}

/**
 * 全局业务逻辑中枢管理器 (GameManager)
 * 继承 Component 的单例，挂载于常驻根节点 (director.addPersistRootNode)
 */
@ccclass('GameManager')
export class GameManager extends Component {

    private static _instance: GameManager | null = null;

    /** 单例访问接口 */
    public static get instance(): GameManager {
        if (!this._instance) {
            warn('[GameManager] GameManager 尚未初始化或未挂载于场景节点。');
        }
        return this._instance!;
    }

    /** 当前游戏状态 */
    private _currentState: GameState = GameState.INIT;

    /** 战斗冻结开关 (用于剧情对话弹窗期间防攻防/移动 Tick) */
    private _isBattleFrozen: boolean = false;

    /** 获取当前战斗是否处于冻结状态 */
    public get isBattleFrozen(): boolean {
        return this._isBattleFrozen;
    }

    /** 触发战斗冻结 */
    public freezeBattle(): void {
        this._isBattleFrozen = true;
        log('[GameManager] 剧情对话触发，战斗进入防性冻结状态 (freezeBattle)');
    }

    /** 解除战斗冻结 */
    public resumeBattle(): void {
        this._isBattleFrozen = false;
        log('[GameManager] 剧情对话结束/跳过，解除战斗冻结 (resumeBattle)');
    }

    /** 关联的关卡管理器引用 */
    @property(LevelManager)
    public levelManager: LevelManager | null = null;

    /** 关联的抓捕管理器引用 */
    @property(PetCaptureManager)
    public petCaptureManager: PetCaptureManager | null = null;

    /** 关联的技能池管理器引用 */
    @property(SkillPoolManager)
    public skillPoolManager: SkillPoolManager | null = null;

    onLoad() {
        if (GameManager._instance === null) {
            GameManager._instance = this;
        } else if (GameManager._instance !== this) {
            this.node.destroy();
            return;
        }
    }

    start() {
        if (GameManager._instance === this) {
            // 设置为跨场景常驻节点
            if (this.node.parent !== director.getScene()) {
                this.node.removeFromParent();
                director.getScene()?.addChild(this.node);
            }
            director.addPersistRootNode(this.node);
            
            this.initSystem();
        }
    }

    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
        this.unregisterEvents();
    }

    /**
     * 系统全局初始化
     */
    public initSystem() {
        console.log('====== [TRACE] GameManager initSystem STARTED ======');
        log('[GameManager] 正在初始化全局游戏系统中枢...');
        
        // 确保屏幕自适应，兼容小屏手机防截断
        const frameSize = view.getFrameSize();
        console.log(`====== [TRACE] Frame Size: ${frameSize.width}x${frameSize.height} ======`);
        if (frameSize.width < frameSize.height) {
            // 竖屏设备
            view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
            console.log('====== [TRACE] Applied ResolutionPolicy.FIXED_WIDTH ======');
        } else {
            // 横屏设备
            view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT);
            console.log('====== [TRACE] Applied ResolutionPolicy.FIXED_HEIGHT ======');
        }
        
        this._currentState = GameState.INIT;

        console.log('====== [TRACE] Checking Runtime Dependencies... ======');
        this.ensureRuntimeDependencies();

        console.log('====== [TRACE] Loading SaveManager... ======');
        // 1. 加载本地持久化存档
        SaveManager.instance.load();

        console.log('====== [TRACE] Settling HomeManager Earnings... ======');
        // 2. 结算离线挂机收益
        if (HomeManager.instance) {
            HomeManager.instance.settleOfflineEarnings();
        }

        console.log('====== [TRACE] Registering Events... ======');
        // 3. 注册全局事件监听 (切后台自动保存、UI/Combat事件)
        this.registerEvents();

        // 4. 切换状态至 MAIN_MENU，默认显示 MainMenuPanel
        this._currentState = GameState.MAIN_MENU;
        console.log('====== [TRACE] Transitioning to MAIN_MENU, opening MainMenuPanel... ======');
        log('[GameManager] 全局系统初始化完成，进入启动界面状态 (MAIN_MENU)。显示 MainMenuPanel。');
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/MainMenuPanel', () => {
                console.log('====== [TRACE] MainMenuPanel opened successfully! ======');
            });
        } else {
            console.error('====== [TRACE] ERROR: UIManager.instance is NULL! ======');
        }
    }

    /**
     * 注册全局事件
     */
    private registerEvents() {
        // 应用前后台切换监听
        game.on(Game.EVENT_HIDE, this.onAppHide, this);
        game.on(Game.EVENT_SHOW, this.onAppShow, this);

        // 绑定全局事件总线 (统一使用 EventManager 订阅宝箱掉落事件，清理 director 通道重复监听)
        EventManager.on(UIEvent.GAME_OVER, this.onGameOverEvent, this);
        EventManager.on(UIEvent.LEVEL_UP, this.onPlayerLevelUpEvent, this);
        EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);

        // 兼容原有的 director.on 广播
        director.on('UI_Event_Game_Over', this.onGameOverEvent, this);
        director.on('UI_Event_Level_Up', this.onPlayerLevelUpEvent, this);
        director.on('Dialogue_System_Finished', this.onDialogueFinished, this);
    }

    /**
     * 注销全局事件
     */
    private unregisterEvents() {
        game.off(Game.EVENT_HIDE, this.onAppHide, this);
        game.off(Game.EVENT_SHOW, this.onAppShow, this);

        EventManager.off(UIEvent.GAME_OVER, this.onGameOverEvent, this);
        EventManager.off(UIEvent.LEVEL_UP, this.onPlayerLevelUpEvent, this);
        EventManager.off('Event_Chest_Dropped', this.onChestDropped, this);

        director.off('UI_Event_Game_Over', this.onGameOverEvent, this);
        director.off('UI_Event_Level_Up', this.onPlayerLevelUpEvent, this);
        director.off('Dialogue_System_Finished', this.onDialogueFinished, this);
    }

    /**
     * 开始游戏/进入指定关卡
     * @param levelId 关卡ID (如 'Level_1')
     */
    public startGame(levelId: string = 'Level_1') {
        log(`[GameManager] 开始游戏流程，准备加载关卡: ${levelId}`);

        const lvlMgr = this.ensureLevelManager();
        if (!lvlMgr) {
            error('[GameManager] 无法获取 LevelManager 实例！');
            return;
        }

        // 异步加载 JSON 配置文件并在回调中启动各系统
        lvlMgr.loadLevelConfig(levelId, (success: boolean) => {
            if (!success) {
                error(`[GameManager] 关卡配置 [${levelId}] 加载失败，无法启动游戏。`);
                return;
            }

            // 状态切换为 PLAYING
            this._currentState = GameState.PLAYING;

            // 重置技能池
            const skillMgr = this.skillPoolManager || this.getComponentInChildren(SkillPoolManager) || this.node.addComponent(SkillPoolManager);
            this.skillPoolManager = skillMgr;
            if (skillMgr) {
                skillMgr.resetSkillPool();
            }

            // 启动关卡刷怪逻辑
            lvlMgr.startGame();

            // 重新初始化并生成主角随行宠物 (Follower_ 节点)
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            const playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
            if (playerNode) {
                const playerComp = playerNode.getComponent('PlayerController') as any;
                if (playerComp && typeof playerComp.initEquippedPets === 'function') {
                    playerComp.initEquippedPets();
                }
            }

            // 关闭主界面并打开局内战斗 UI
            if (UIManager.instance) {
                UIManager.instance.closeUI('UI/HomePanel');
                UIManager.instance.openUI('UI/BattleUIPanel', () => {
                    const hasPlayedStart = localStorage.getItem('played_tutorial_start') === 'true';
                    if (!hasPlayedStart) {
                        localStorage.setItem('played_tutorial_start', 'true');
                        this.scheduleOnce(() => {
                            if (DialogueSystem.instance) {
                                DialogueSystem.instance.triggerDialogue('Tutorial_Start');
                            }
                        }, 1.0);
                    }
                });
            }

            log(`[GameManager] 关卡 [${levelId}] 加载并启动成功！`);
        });
    }

    /**
     * 暂停游戏
     */
    public pauseGame() {
        if (this._currentState !== GameState.PLAYING) return;
        
        this._currentState = GameState.PAUSED;
        director.pause();
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/PausePanel');
        }
        log('[GameManager] 游戏已暂停。');
    }

    /**
     * 恢复游戏
     */
    public resumeGame() {
        if (this._currentState !== GameState.PAUSED) return;

        director.resume();
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/PausePanel');
        }
        this._currentState = GameState.PLAYING;
        log('[GameManager] 游戏已恢复。');
    }

    /**
     * 结束游戏 (胜利或失败结算)
     * @param isVictory 是否关卡胜利
     */
    public endGame(isVictory: boolean) {
        if (this._currentState === GameState.GAME_OVER || this._currentState === GameState.VICTORY) return;

        this._currentState = isVictory ? GameState.VICTORY : GameState.GAME_OVER;
        log(`[GameManager] 关卡结束，判定为: ${isVictory ? '胜利 (VICTORY)' : '失败 (GAME_OVER)'}`);

        // 结算局内战利品与灵石/材料
        this.settleBattleRewards(isVictory);

        // 自动触发原子数据存档
        SaveManager.instance.save();

        // 调起对应结算 UI 面板
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/BattleUIPanel');
            const resultPanel = isVictory ? 'UI/VictoryPanel' : 'UI/GameOverPanel';
            UIManager.instance.openUI(resultPanel);
        }
    }

    /**
     * 结算局内获得的战利品并写入 HomeManager 内存
     */
    private settleBattleRewards(isVictory: boolean) {
        if (HomeManager.instance) {
            const rewardStones = isVictory ? 200 : 50;
            const rewardMaterials = isVictory ? 20 : 5;
            HomeManager.instance.addSpiritStones(rewardStones);
            HomeManager.instance.addMaterials(rewardMaterials);
            log(`[GameManager] 结算战利品: 灵石 +${rewardStones}, 材料 +${rewardMaterials}`);
        }
    }

    /**
     * 返回主界面/洞府 (局内外切换闭环)
     * 1. 销毁/回收场上所有怪物节点及飞弹投射物节点
     * 2. 销毁主角随行宠物节点 (Follower_ 节点) 及复位主角状态
     * 3. 停止关卡计时与波次刷怪逻辑，重置 LevelManager.ts 数据 (resetLevel)
     * 4. 关闭局内 UI 与结算面板，重新拉起 HomePanel 主界面
     */
    public returnToHome() {
        log('[GameManager] 执行 returnToHome() 返回洞府主界面...');

        // 1. 优先、精准清理 LevelManager.instance.monsterRoot 节点下的所有怪物，并兜底清理 enemyLayer 残留怪物节点
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const monsterRoot = LevelManager.instance ? LevelManager.instance.monsterRoot : null;
        const enemyLayer = canvas?.getChildByName('EnemyLayer') || canvas;

        const nodesToClean: Node[] = [];
        if (monsterRoot && monsterRoot.isValid) {
            nodesToClean.push(...monsterRoot.children);
        }
        if (enemyLayer && enemyLayer.isValid && enemyLayer !== monsterRoot) {
            for (const child of enemyLayer.children) {
                if (!nodesToClean.includes(child)) {
                    nodesToClean.push(child);
                }
            }
        }

        for (const childNode of nodesToClean) {
            if (childNode && childNode.isValid && childNode.active) {
                const isEnemy = childNode.name.includes('Monster') || childNode.name.includes('mob_') || childNode.name.includes('Dynamic') || childNode.getComponent('Enemy');
                if (isEnemy) {
                    if (PoolManager.instance) {
                        PoolManager.instance.putNode(childNode);
                    } else {
                        childNode.destroy();
                    }
                }
            }
        }

        // 2. 销毁主角随行宠物节点 (Follower_ 节点) 与投射物，并复位主角状态
        if (canvas) {
            const canvasChildren = [...canvas.children];
            for (const child of canvasChildren) {
                if (child.name.startsWith('Follower_') || child.name === 'PetSpellProjectile' || child.name.includes('Projectile')) {
                    child.destroy();
                }
            }

            const playerNode = canvas.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
            if (playerNode) {
                const playerComp = playerNode.getComponent('PlayerController') as any;
                if (playerComp) {
                    if (typeof playerComp.restoreFullHp === 'function') {
                        playerComp.restoreFullHp();
                    } else if (typeof playerComp.currentHp !== 'undefined') {
                        playerComp.currentHp = playerComp.maxHp || 100;
                    }
                }
                playerNode.setPosition(0, 0, 0);
            }
        }

        // 3. 停止关卡计时与波次刷怪逻辑，重置 LevelManager
        const lvlMgr = this.ensureLevelManager();
        if (lvlMgr) {
            lvlMgr.resetLevel();
        }

        // 4. 关闭局内 UI 与结算面板，重新拉起 HomePanel
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/BattleUIPanel');
            UIManager.instance.closeUI('UI/VictoryPanel');
            UIManager.instance.closeUI('UI/GameOverPanel');
            UIManager.instance.closeUI('UI/SkillSelectPanel');
            UIManager.instance.closeUI('UI/PausePanel');
            UIManager.instance.openUI('UI/HomePanel');
        }

        // 状态切换为 HOME 且解冻战斗
        this._currentState = GameState.HOME;
        this._isBattleFrozen = false;

        // 触发离线/在线收益结算并触发数据保存
        if (HomeManager.instance) {
            HomeManager.instance.settleOfflineEarnings();
        }
        SaveManager.instance.save();

        log('[GameManager] 成功返回洞府主界面！');
    }

    private onGameOverEvent() {
        log('[GameManager] 捕获玩家死亡/游戏结束事件。');
        this.endGame(false);
    }

    private onPlayerLevelUpEvent(newLevel?: number) {
        log(`[GameManager] 捕获玩家升级事件${newLevel ? `: Lv.${newLevel}` : ''}`);
        
        // 触发新手升级说明对话
        const hasPlayed = localStorage.getItem('played_tutorial_levelup') === 'true';
        if (!hasPlayed) {
            localStorage.setItem('played_tutorial_levelup', 'true');
            if (DialogueSystem.instance) {
                DialogueSystem.instance.triggerDialogue('Tutorial_LevelUp');
            }
        }

        // 挂起局内 Roguelike 3选1 技能 UI 面板
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/SkillSelectPanel');
        }
    }

    /**
     * 检查并播放开场剧情动画
     */
    public checkAndPlayOpeningCutscene() {
        const hasPlayed = localStorage.getItem('played_opening_cutscene') === 'true';
        if (!hasPlayed) {
            log('[GameManager] 检测到首次进入游戏，启动开场剧情对话流程...');
            this.scheduleOnce(() => {
                if (DialogueSystem.instance) {
                    DialogueSystem.instance.triggerDialogue('Game_Start');
                }
            }, 0.5);
        }
    }

    /**
     * 剧情对话流程完毕回调，用于级联触发多波次新手对话
     */
    private onDialogueFinished(payload: any) {
        // 兼容处理以防传入的不是对象
        let condition = '';
        let isSkippedAll = false;
        if (payload && typeof payload === 'object') {
            condition = payload.condition;
            isSkippedAll = payload.isSkippedAll;
        } else {
            condition = payload as string;
        }

        log(`[GameManager] 接收到剧情对话推进完毕事件: ${condition}, 是否全跳过: ${isSkippedAll}`);

        if (isSkippedAll) {
            // 如果是在开场剧情线中，点击了【跳过】，则直接终止链式弹出并标记已阅读
            if (condition === 'Game_Start' || condition.startsWith('Intro_Scene_')) {
                log('[GameManager] 用户点击跳过开场剧情，写入本地持久化并终止后续弹出。');
                localStorage.setItem('played_opening_cutscene', 'true');
            }
            return;
        }

        if (condition === 'Game_Start') {
            if (DialogueSystem.instance) DialogueSystem.instance.triggerDialogue('Intro_Scene_1');
        } else if (condition.startsWith('Intro_Scene_')) {
            const index = parseInt(condition.replace('Intro_Scene_', ''));
            if (index < 7) {
                if (DialogueSystem.instance) DialogueSystem.instance.triggerDialogue(`Intro_Scene_${index + 1}`);
            } else {
                log('[GameManager] 开场剧情对话全部播放完毕，写入本地存盘。');
                localStorage.setItem('played_opening_cutscene', 'true');
            }
        } else if (condition === 'Tutorial_Start') {
            if (DialogueSystem.instance) DialogueSystem.instance.triggerDialogue('Tutorial_Move');
        } else if (condition === 'Tutorial_Catch_Success') {
            if (DialogueSystem.instance) DialogueSystem.instance.triggerDialogue('Tutorial_End');
        }
    }

    /**
     * 响应精英怪宝箱掉落事件 Event_Chest_Dropped
     */
    private onChestDropped(payload?: any) {
        log('[GameManager] 接收到【聚灵宝箱】掉落事件 Event_Chest_Dropped');
        
        // 首次击杀精英怪弹出文本框并暂停游戏
        const hasPlayedTutorialCatch = localStorage.getItem('played_tutorial_catch') === 'true';
        if (!hasPlayedTutorialCatch) {
            localStorage.setItem('played_tutorial_catch', 'true');
            if (DialogueSystem.instance) {
                DialogueSystem.instance.triggerDialogue('Tutorial_Catch');
            }
        }

        // 给予玩家高额灵石与材料奖励
        if (HomeManager.instance) {
            HomeManager.instance.addSpiritStones(500);
            HomeManager.instance.addMaterials(50);
            log('[GameManager] 聚灵宝箱奖励结算生效: 灵石 +500, 修仙材料 +50');
        }

        // 给予玩家高额经验加成
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
        if (playerNode) {
            const playerComp = playerNode.getComponent('PlayerController') as any;
            if (playerComp && typeof playerComp.addExp === 'function') {
                playerComp.addExp(200);
                log('[GameManager] 聚灵宝箱奖励结算生效: 玩家获得高额经验 +200');
            }
        }
    }

    /**
     * 应用切入后台：自动暂停游戏并保存数据
     */
    private onAppHide() {
        log('[GameManager] 监测到应用切入后台，自动保存游戏存档数据。');
        if (this._currentState === GameState.PLAYING) {
            this.pauseGame();
        }
        SaveManager.instance.save();
    }

    /**
     * 应用切回前台
     */
    private onAppShow() {
        log('[GameManager] 应用切回前台。');
    }

    /**
     * 获取当前游戏状态
     */
    public get currentState(): GameState {
        return this._currentState;
    }

    /**
     * 运行时补齐关键系统，避免场景里少挂一个组件就直接黑屏/空场景
     */
    private ensureRuntimeDependencies() {
        this.ensureHomeManager();
        this.ensureUIManager();
        this.ensureSkillPoolManager();
        this.ensurePetCaptureManager();
        this.ensureLevelManager();
        this.ensureScrollingBackground();
    }

    private ensureHomeManager(): HomeManager | null {
        if (HomeManager.instance) {
            return HomeManager.instance;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        let runtimeNode = scene.getChildByName('RuntimeHomeManager');
        if (!runtimeNode) {
            runtimeNode = new Node('RuntimeHomeManager');
            scene.addChild(runtimeNode);
        }

        const homeManager = runtimeNode.getComponent(HomeManager) || runtimeNode.addComponent(HomeManager);
        log('[GameManager] 场景中未找到 HomeManager，已自动创建运行时实例。');
        return homeManager;
    }

    private ensureUIManager(): UIManager | null {
        if ((UIManager as any)._instance) {
            return (UIManager as any)._instance;
        }

        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const uiLayer = canvas?.getChildByName('UILayer') || canvas || scene || null;
        if (!uiLayer) {
            return null;
        }

        const uiManager = uiLayer.getComponent(UIManager) || uiLayer.addComponent(UIManager);
        (UIManager as any)._instance = uiManager;
        log('[GameManager] 场景中未找到 UIManager，已自动创建运行时实例并同步绑定单例指针。');
        return uiManager;
    }

    private ensureSkillPoolManager(): SkillPoolManager | null {
        if (this.skillPoolManager) {
            return this.skillPoolManager;
        }

        const skillManager = this.getComponent(SkillPoolManager) || this.node.addComponent(SkillPoolManager);
        this.skillPoolManager = skillManager;
        log('[GameManager] 场景中未绑定 SkillPoolManager，已自动创建运行时实例。');
        return skillManager;
    }

    private ensurePetCaptureManager(): PetCaptureManager | null {
        if (this.petCaptureManager) {
            return this.petCaptureManager;
        }

        const petManager = this.getComponent(PetCaptureManager) || this.node.addComponent(PetCaptureManager);
        this.petCaptureManager = petManager;
        log('[GameManager] 场景中未绑定 PetCaptureManager，已自动创建运行时实例。');
        return petManager;
    }

    private ensureLevelManager(): LevelManager | null {
        if (LevelManager.instance) {
            this.levelManager = LevelManager.instance;
            return LevelManager.instance;
        }

        if (this.levelManager) {
            return this.levelManager;
        }

        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const enemyLayer = canvas?.getChildByName('EnemyLayer') || canvas || this.node;
        const levelManager = enemyLayer.getComponent(LevelManager) || enemyLayer.addComponent(LevelManager);
        this.levelManager = levelManager;
        log('[GameManager] 场景中未找到 LevelManager，已自动挂载到 EnemyLayer。');
        return levelManager;
    }

    private ensureScrollingBackground() {
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        if (!canvas) return;
        
        let bgComp = canvas.getComponent('ScrollingBackground');
        if (!bgComp) {
            canvas.addComponent('ScrollingBackground');
            log('[GameManager] 场景中未找到 ScrollingBackground，已自动挂载到 Canvas。');
        }
    }
}
