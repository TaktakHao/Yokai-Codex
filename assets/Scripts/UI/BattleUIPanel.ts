import { _decorator, Component, Node, ProgressBar, Label, EventTouch, UITransform, Vec2, Vec3, Color, Sprite, log, Layers, tween, Tween, director, Size, Widget } from 'cc';
import { EventManager, UIEvent } from '../Manager/EventManager';
import { VisualLoader } from '../Utils/VisualLoader';
import { DialogueSystem } from '../DialogueSystem';
import { PetCaptureManager } from '../Logic/PetCaptureManager';
const { ccclass, property } = _decorator;

/**
 * 战斗 UI 面板组件
 * 阶段六 R3 & 阶段七 R1/R3 改进：增加纯代码 UI 构建机制，赋予 UI_2D 层级，使用 tween 提供平滑数值插值
 */
@ccclass('BattleUIPanel')
export class BattleUIPanel extends Component {

    @property(ProgressBar)
    public hpBar: ProgressBar | null = null;

    @property(Label)
    public hpLabel: Label | null = null;

    @property(ProgressBar)
    public expBar: ProgressBar | null = null;

    @property(Label)
    public expLabel: Label | null = null;

    @property(Label)
    public timerLabel: Label | null = null;

    @property(Label)
    public scoreLabel: Label | null = null; // 扩展：得分文本

    @property(Node)
    public captureBtn: Node | null = null;

    @property(Label)
    public captureBtnLabel: Label | null = null;

    private captureCooldown: number = 5.0; // 5秒冷却
    private captureTimer: number = 0;

    // ----- 对话框UI节点 -----
    @property(Node)
    public dialoguePanel: Node | null = null;

    @property(Label)
    public speakerLabel: Label | null = null;

    @property(Label)
    public dialogueTextLabel: Label | null = null;

    // ----- 摇杆UI节点 -----
    @property(Node)
    public joystickBg: Node | null = null;

    @property(Node)
    public joystickKnob: Node | null = null;

    // 摇杆最大拖拽半径
    private joystickMaxRadius: number = 100;
    
    // 当前摇杆输入方向（可提供给 PlayerController 使用）
    public currentInputDirection: Vec3 = new Vec3(0, 0, 0);

    // 补间动画句柄
    private _hpTween: Tween<{ progress: number }> | null = null;
    private _expTween: Tween<{ progress: number }> | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        // 执行防御性 UI 节点与组件自动构建逻辑
        this.ensureUIElements();
    }

    onEnable() {
        // 统一使用 EventManager 订阅宝箱掉落事件，清理 director 重复监听
        EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);
    }

    onDisable() {
        EventManager.off('Event_Chest_Dropped', this.onChestDropped, this);
    }

    start() {
        this.initJoystick();
        this.hideDialogue();
    }

    /**
     * 响应精英怪宝箱掉落事件
     */
    private onChestDropped(payload?: any) {
        log('[BattleUIPanel] 收到聚灵宝箱掉落广播，显示收获提示对话框');
        this.showDialogue('【聚灵宝箱】', '击杀精英怪，喜获【聚灵宝箱】！获得丰厚灵石、材料与高额经验加成！');
        this.scheduleOnce(() => {
            this.hideDialogue();
        }, 3.0);
    }

    /**
     * 防御性检查与纯代码 UI 自动构建逻辑
     * 当检测到任何 UI 节点/组件引用为 null 时，自动实例化 Node 并补齐对应的 UI 组件
     */
    private ensureUIElements() {
        // 0. 背景已交由 ScrollingBackground 处理，不再创建静态 UIBackground 以免遮挡游戏画面

        // 1. 防御性补齐血条 (HpBar) 与血量文本 (HpLabel)
        if (!this.hpBar) {
            this.hpBar = this.createProgressBar('HpBar', new Vec3(-300, 260, 0), new Color(220, 50, 50, 255));
        }
        if (!this.hpLabel) {
            this.hpLabel = this.createLabel('HpLabel', '100 / 100', 16, new Vec3(-300, 260, 0));
        }

        // 2. 防御性补齐经验条 (ExpBar) 与经验文本 (ExpLabel)
        if (!this.expBar) {
            this.expBar = this.createProgressBar('ExpBar', new Vec3(-300, 230, 0), new Color(50, 200, 255, 255));
        }
        if (!this.expLabel) {
            this.expLabel = this.createLabel('ExpLabel', '0 / 100', 14, new Vec3(-300, 230, 0));
        }

        // 3. 防御性补齐计时文本 (TimerLabel)
        if (!this.timerLabel) {
            this.timerLabel = this.createLabel('TimerLabel', '00:00', 24, new Vec3(0, 270, 0), new Color(255, 255, 255, 255));
        }

        // 4. 防御性补齐得分文本 (ScoreLabel)
        if (!this.scoreLabel) {
            this.scoreLabel = this.createLabel('ScoreLabel', '得分: 0', 20, new Vec3(300, 270, 0), new Color(255, 215, 0, 255));
        }

        // 5. 防御性补齐对话框 (DialoguePanel) 及其子节点
        if (!this.dialoguePanel) {
            const panelNode = new Node('DialoguePanel');
            panelNode.layer = Layers.Enum.UI_2D;
            panelNode.parent = this.node;
            const transform = panelNode.addComponent(UITransform);
            transform.setContentSize(600, 120);
            panelNode.setPosition(0, -180, 0);

            const bgSprite = panelNode.addComponent(Sprite);
            bgSprite.color = new Color(0, 0, 0, 200); // 半透明黑色背景
            void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

            this.dialoguePanel = panelNode;
        }

        if (!this.speakerLabel && this.dialoguePanel) {
            this.speakerLabel = this.createLabel('SpeakerLabel', '发言人', 18, new Vec3(-250, 35, 0), new Color(255, 215, 0, 255), this.dialoguePanel);
        }

        if (!this.dialogueTextLabel && this.dialoguePanel) {
            this.dialogueTextLabel = this.createLabel('DialogueTextLabel', '对话内容...', 16, new Vec3(0, -10, 0), new Color(255, 255, 255, 255), this.dialoguePanel);
        }

        // 6. 防御性补齐虚拟摇杆 (Joystick)
        if (!this.joystickBg) {
            const bgNode = new Node('JoystickBg');
            bgNode.layer = Layers.Enum.UI_2D;
            bgNode.parent = this.node;
            const bgTransform = bgNode.addComponent(UITransform);
            bgTransform.setContentSize(150, 150);

            const bgSprite = bgNode.addComponent(Sprite);
            bgSprite.color = new Color(100, 100, 100, 120); // 摇杆背景半透明灰色
            void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

            // 屏幕自适应：左下角对齐
            const widget = bgNode.addComponent(Widget);
            widget.isAlignLeft = true;
            widget.isAlignBottom = true;
            widget.left = 50;
            widget.bottom = 50;

            this.joystickBg = bgNode;
        }

        if (!this.joystickKnob && this.joystickBg) {
            const knobNode = new Node('JoystickKnob');
            knobNode.layer = Layers.Enum.UI_2D;
            knobNode.parent = this.joystickBg;
            const knobTransform = knobNode.addComponent(UITransform);
            knobTransform.setContentSize(60, 60);
            knobNode.setPosition(0, 0, 0);

            const knobSprite = knobNode.addComponent(Sprite);
            knobSprite.color = new Color(220, 220, 220, 200); // 摇杆滑块亮灰色
            void VisualLoader.applySolidSprite(knobSprite, knobSprite.color);

            this.joystickKnob = knobNode;
        }

        // 7. 防御性补齐抛葫芦捕获按钮
        if (!this.captureBtn) {
            const btnNode = new Node('CaptureBtn');
            btnNode.layer = Layers.Enum.UI_2D;
            btnNode.parent = this.node;
            const btnTransform = btnNode.addComponent(UITransform);
            btnTransform.setContentSize(120, 50);

            const bgSprite = btnNode.addComponent(Sprite);
            bgSprite.color = new Color(220, 160, 40, 255); // 金黄色葫芦背景
            void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

            // 屏幕自适应：右下角对齐
            const widget = btnNode.addComponent(Widget);
            widget.isAlignRight = true;
            widget.isAlignBottom = true;
            widget.right = 50;
            widget.bottom = 50;

            this.captureBtn = btnNode;
            
            // 绑定点击事件
            btnNode.on(Node.EventType.TOUCH_END, this.onCaptureBtnClick, this);
        }

        if (!this.captureBtnLabel && this.captureBtn) {
            this.captureBtnLabel = this.createLabel('CaptureBtnLabel', '抛葫芦', 18, new Vec3(0, 0, 0), Color.WHITE, this.captureBtn);
            const transform = this.captureBtnLabel.getComponent(UITransform);
            if (transform) {
                transform.setAnchorPoint(0.5, 0.5);
                transform.setContentSize(120, 50);
            }
        }
    }

    /**
     * 动态辅助工厂方法：创建 ProgressBar 节点与组件
     */
    private createProgressBar(name: string, pos: Vec3, fillColor: Color): ProgressBar {
        const barNode = new Node(name);
        barNode.layer = Layers.Enum.UI_2D;
        barNode.parent = this.node;
        barNode.setPosition(pos);

        const barTransform = barNode.addComponent(UITransform);
        barTransform.setContentSize(200, 20);

        const bgSprite = barNode.addComponent(Sprite);
        bgSprite.color = new Color(40, 40, 40, 180);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 创建填充子节点
        const fillNode = new Node(`${name}_Fill`);
        fillNode.layer = Layers.Enum.UI_2D;
        fillNode.parent = barNode;
        
        const fillTransform = fillNode.addComponent(UITransform);
        fillTransform.setAnchorPoint(0, 0.5);
        fillTransform.setContentSize(200, 20);
        fillNode.setPosition(-100, 0, 0);

        const fillSprite = fillNode.addComponent(Sprite);
        fillSprite.color = fillColor;
        void VisualLoader.applySolidSprite(fillSprite, fillSprite.color);

        const progressBar = barNode.addComponent(ProgressBar);
        progressBar.totalLength = 200;
        progressBar.mode = ProgressBar.Mode.HORIZONTAL;
        progressBar.barSprite = fillSprite;
        progressBar.progress = 1.0;

        return progressBar;
    }

    /**
     * 动态辅助工厂方法：创建 Label 节点与组件
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE, parentNode?: Node): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = parentNode || this.node;
        labelNode.setPosition(pos);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(200, 30);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;

        return label;
    }

    private initJoystick() {
        if (!this.joystickBg || !this.joystickKnob) {
            log('摇杆节点未绑定！');
            return;
        }

        // 获取或添加UITransform确保全屏触摸范围
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
        }
        // 设置一个足够大的尺寸以覆盖全屏，或者依赖于Widget，但作为根UI节点通常已经拉满
        uiTransform.setContentSize(720, 1280);

        // 监听整个屏幕（this.node）的触摸事件，以避免无形UI阻挡或者摇杆区域太小的问题
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch) {
        this.updateJoystickKnobPosition(event);
    }

    private onTouchMove(event: EventTouch) {
        this.updateJoystickKnobPosition(event);
    }

    private onTouchEnd(event: EventTouch) {
        // 重置摇杆中心
        if (this.joystickKnob) {
            this.joystickKnob.setPosition(0, 0, 0);
        }
        this.currentInputDirection.set(0, 0, 0);
    }

    private updateJoystickKnobPosition(event: EventTouch) {
        if (!this.joystickBg || !this.joystickKnob) return;

        const uiTransform = this.joystickBg.getComponent(UITransform);
        if (!uiTransform) return;

        // 将触摸点屏幕坐标转换为摇杆背景内的局部坐标
        const uiLoc = event.getUILocation();
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0));
        
        let dir = new Vec2(localPos.x, localPos.y);
        const distance = dir.length();

        // 限制摇杆拖动范围
        if (distance > this.joystickMaxRadius) {
            dir.multiplyScalar(this.joystickMaxRadius / distance);
            localPos.x = dir.x;
            localPos.y = dir.y;
        }

        this.joystickKnob.setPosition(localPos.x, localPos.y, 0);

        // 标准化方向向量
        dir.normalize();
        this.currentInputDirection.set(dir.x, dir.y, 0);
    }

    /**
     * 更新血条UI (Cocos tween 平滑过渡)
     */
    public updateHpBar(currentHp: number, maxHp: number) {
        const targetProgress = Math.max(0, Math.min(1, currentHp / Math.max(1, maxHp)));
        if (this.hpBar) {
            if (this._hpTween) this._hpTween.stop();
            const state = { progress: this.hpBar.progress };
            this._hpTween = tween(state)
                .to(0.25, { progress: targetProgress }, {
                    onUpdate: () => {
                        if (this.hpBar) this.hpBar.progress = state.progress;
                    },
                    easing: 'quadOut'
                })
                .start();
        }
        if (this.hpLabel) {
            this.hpLabel.string = `${Math.ceil(Math.max(0, currentHp))} / ${maxHp}`;
        }
    }

    /**
     * 更新经验条UI (Cocos tween 平滑过渡)
     */
    public updateExpBar(currentExp: number, maxExp: number) {
        const targetProgress = Math.max(0, Math.min(1, currentExp / Math.max(1, maxExp)));
        if (this.expBar) {
            if (this._expTween) this._expTween.stop();
            const state = { progress: this.expBar.progress };
            this._expTween = tween(state)
                .to(0.25, { progress: targetProgress }, {
                    onUpdate: () => {
                        if (this.expBar) this.expBar.progress = state.progress;
                    },
                    easing: 'quadOut'
                })
                .start();
        }
        if (this.expLabel) {
            this.expLabel.string = `${Math.ceil(currentExp)} / ${maxExp}`;
        }
    }

    /**
     * 更新时间轴UI
     */
    public updateTimer(gameTimeSeconds: number) {
        if (!this.timerLabel) return;
        
        const minutes = Math.floor(gameTimeSeconds / 60);
        const seconds = Math.floor(gameTimeSeconds % 60);
        const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
        const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
        
        this.timerLabel.string = `${minStr}:${secStr}`;
    }

    /**
     * 更新得分UI
     */
    public updateScore(score: number) {
        if (this.scoreLabel) {
            this.scoreLabel.string = `得分: ${score}`;
        }
    }

    /**
     * 显示对话框面板
     */
    public showDialogue(speaker: string, text: string) {
        if (!this.dialoguePanel) return;
        
        this.dialoguePanel.active = true;
        if (this.speakerLabel) {
            this.speakerLabel.string = speaker;
        }
        if (this.dialogueTextLabel) {
            this.dialogueTextLabel.string = text;
        }
    }

    /**
     * 隐藏对话框面板
     */
    public hideDialogue() {
        if (this.dialoguePanel) {
            this.dialoguePanel.active = false;
        }
    }

    /**
     * 用户点击继续对话按钮
     */
    public onNextDialogueBtnClick() {
        log('[UI] 点击继续对话');
    }

    update(deltaTime: number) {
        if (this.captureTimer > 0) {
            this.captureTimer -= deltaTime;
            if (this.captureTimer <= 0) {
                this.captureTimer = 0;
                if (this.captureBtnLabel) {
                    this.captureBtnLabel.string = '抛葫芦';
                }
                if (this.captureBtn) {
                    const sprite = this.captureBtn.getComponent(Sprite);
                    if (sprite) sprite.color = new Color(220, 160, 40, 255);
                }
            } else {
                if (this.captureBtnLabel) {
                    this.captureBtnLabel.string = `冷却(${this.captureTimer.toFixed(1)}s)`;
                }
            }
        }
    }

    /**
     * 点击抛投葫芦，尝试捕获场内残血怪
     */
    private onCaptureBtnClick() {
        if (this.captureTimer > 0) {
            log('[BattleUIPanel] 葫芦法宝冷却中...');
            return;
        }

        // 1. 寻找玩家节点
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
        if (!playerNode || !playerNode.isValid) {
            log('[BattleUIPanel] 未找到有效玩家节点，无法抓捕。');
            return;
        }

        // 2. 寻找怪物根节点
        const monsterRoot = canvas?.getChildByName('EnemyLayer') || null;
        if (!monsterRoot || monsterRoot.children.length === 0) {
            log('[BattleUIPanel] 战场上没有可抓捕的妖兽。');
            this.showDialogue('【系统提示】', '战场上没有检测到可以抓捕的妖兽！');
            this.scheduleOnce(() => this.hideDialogue(), 2.0);
            return;
        }

        // 3. 寻找最近且残血的怪物作为目标 (射程 300 像素内)
        const enemies = monsterRoot.children;
        let targetEnemy: Node | null = null;
        let minDistance = 300.0;
        let lowestHpRatio = 1.0;

        for (let i = 0; i < enemies.length; i++) {
            const enemyNode = enemies[i];
            const enemyComp = enemyNode.getComponent('Enemy') as any;
            if (!enemyComp || enemyComp.isDead) continue;

            const dist = Vec3.distance(playerNode.position, enemyNode.position);
            if (dist <= minDistance) {
                const hpRatio = enemyComp.currentHp / enemyComp.maxHp;
                if (hpRatio < lowestHpRatio) {
                    lowestHpRatio = hpRatio;
                    targetEnemy = enemyNode;
                } else if (!targetEnemy) {
                    targetEnemy = enemyNode;
                }
            }
        }

        if (!targetEnemy) {
            log('[BattleUIPanel] 范围内没有符合抓捕条件的妖兽。');
            this.showDialogue('【系统提示】', '附近没有处于虚弱状态的妖兽！请将怪物打至残血再试。');
            this.scheduleOnce(() => this.hideDialogue(), 2.0);
            return;
        }

        const enemyComp = targetEnemy.getComponent('Enemy') as any;
        if (!enemyComp) return;

        // 4. 触发冷却
        this.captureTimer = this.captureCooldown;
        if (this.captureBtn) {
            const sprite = this.captureBtn.getComponent(Sprite);
            if (sprite) sprite.color = new Color(100, 100, 100, 255);
        }

        // 5. 触发抓捕动画与盲盒概率结算 (晃动 1.5s 后判定)
        const monsterName = targetEnemy.name.replace('Follower_', '').replace('Runtime_', '');
        log(`[BattleUIPanel] 抛出乾坤盲盒葫芦！目标: ${monsterName}`);
        this.showDialogue('【抓捕中】', `抛出【乾坤盲盒葫芦】，法光笼罩 [${monsterName}]，正在全力收服中...`);

        // 首次抛葫芦引导剧情
        const hasPlayedGourd = localStorage.getItem('played_tutorial_throw_gourd') === 'true';
        if (!hasPlayedGourd) {
            localStorage.setItem('played_tutorial_throw_gourd', 'true');
            if (DialogueSystem.instance) {
                DialogueSystem.instance.triggerDialogue('Tutorial_Throw_Gourd');
            }
        }

        this.scheduleOnce(() => {
            if (!targetEnemy || !targetEnemy.isValid) {
                this.showDialogue('【抓捕失败】', '目标在挣扎中意外消散！');
                this.scheduleOnce(() => this.hideDialogue(), 2.0);
                return;
            }

            const monsterInput = {
                currentHp: enemyComp.currentHp,
                maxHp: enemyComp.maxHp,
                name: monsterName,
                id: enemyComp.texturePath ? enemyComp.texturePath.split('/').pop() : 'monster_unknown',
                rarity: enemyComp.isElite ? '稀有' : '普通' as any,
                baseHp: enemyComp.maxHp,
                baseAttack: enemyComp.attackDamage,
                baseSpeed: enemyComp.moveSpeed
            };

            if (PetCaptureManager.instance) {
                const egg = PetCaptureManager.instance.attemptCapture(monsterInput);
                if (egg) {
                    log(`[BattleUIPanel] 抓捕成功！获得: ${egg.monsterType}蛋`);
                    this.showDialogue('【抓捕成功】', `成功收服 [${egg.monsterType}]！已获得一枚 [${egg.rarity}] 妖兽蛋！`);

                    // 首次抓捕成功新手引导剧情
                    const hasPlayedCatchSuccess = localStorage.getItem('played_tutorial_catch_success') === 'true';
                    if (!hasPlayedCatchSuccess) {
                        localStorage.setItem('played_tutorial_catch_success', 'true');
                        if (DialogueSystem.instance) {
                            DialogueSystem.instance.triggerDialogue('Tutorial_Catch_Success');
                        }
                    }

                    // 抓捕成功扣除怪物并回收
                    const pos = targetEnemy.worldPosition.clone();
                    EventManager.emit('CombatEvent_Enemy_Captured', { enemyNode: targetEnemy, position: pos });
                    
                    const poolMgr = scene?.getComponentInChildren('PoolManager') as any;
                    if (poolMgr && typeof poolMgr.putNode === 'function') {
                        poolMgr.putNode(targetEnemy);
                    } else {
                        targetEnemy.destroy();
                    }
                } else {
                    log('[BattleUIPanel] 抓捕失败，妖兽挣脱了束缚！');
                    this.showDialogue('【抓捕失败】', `可惜！[${monsterName}] 挣脱了葫芦，收服失败！`);
                }
            } else {
                log('[BattleUIPanel] 未找到 PetCaptureManager 实例！');
            }

            this.scheduleOnce(() => this.hideDialogue(), 2.0);
        }, 1.5);
    }
}
