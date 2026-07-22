import { _decorator, Component, Node, ProgressBar, Label, EventTouch, UITransform, Vec3, Color, Sprite, log, Layers, tween, randomRange } from 'cc';
import { HomeManager } from '../Manager/HomeManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass, property } = _decorator;

/**
 * 境界突破雷劫挑战 UI 面板 (TribulationPanel)
 * 纯代码防御性构建，10 秒内拖动小人闪避随机雷击的雷劫小游戏，判定渡劫胜负并与 HomeManager 联动
 */
@ccclass('TribulationPanel')
export class TribulationPanel extends Component {

    @property(ProgressBar)
    public hpBar: ProgressBar | null = null;

    @property(Label)
    public timeLabel: Label | null = null;

    @property(Label)
    public tipLabel: Label | null = null;

    @property(Node)
    public playerAvatar: Node | null = null;

    private playDuration: number = 10; // 雷劫倒计时 10 秒
    private currentHp: number = 100;
    private maxHp: number = 100;
    
    private gameActive: boolean = false;
    private gameTimer: number = 0;
    private spawnTimer: number = 0;
    private spawnInterval: number = 0.65; // 每隔 0.65 秒酝酿一次雷击

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.initInteraction();
    }

    onEnable() {
        this.startChallenge();
    }

    /**
     * 防御性 UI 纯代码生成逻辑，确保缺失资产能正常补齐运行
     */
    private ensureUIElements() {
        // 1. 背景铺设
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 补齐血条
        if (!this.hpBar) {
            const barNode = new Node('TribulationHpBar');
            barNode.layer = Layers.Enum.UI_2D;
            barNode.parent = this.node;
            barNode.setPosition(0, 300, 0);

            const barTransform = barNode.addComponent(UITransform);
            barTransform.setContentSize(300, 20);

            const barBg = barNode.addComponent(Sprite);
            barBg.color = new Color(50, 20, 20, 200);
            void VisualLoader.applySolidSprite(barBg, barBg.color);

            const fillNode = new Node('TribulationHpBar_Fill');
            fillNode.layer = Layers.Enum.UI_2D;
            fillNode.parent = barNode;
            
            const fillTransform = fillNode.addComponent(UITransform);
            fillTransform.setAnchorPoint(0, 0.5);
            fillTransform.setContentSize(300, 20);
            fillNode.setPosition(-150, 0, 0);

            const fillSprite = fillNode.addComponent(Sprite);
            fillSprite.color = new Color(240, 50, 50, 255); // 鲜红色生命值
            void VisualLoader.applySolidSprite(fillSprite, fillSprite.color);

            const barComp = barNode.addComponent(ProgressBar);
            barComp.totalLength = 300;
            barComp.mode = ProgressBar.Mode.HORIZONTAL;
            barComp.barSprite = fillSprite;
            barComp.progress = 1.0;

            this.hpBar = barComp;
        }

        // 3. 补齐倒计时文字
        if (!this.timeLabel) {
            this.timeLabel = this.createLabel('TimeLabel', '避雷劫倒计时: 10s', 26, new Vec3(0, 350, 0), Color.YELLOW);
        }

        // 4. 补齐提示文字
        if (!this.tipLabel) {
            this.tipLabel = this.createLabel('TipLabel', '【雷劫挑战】滑动屏幕左右移动绿色化身，躲避雷云闪电！', 16, new Vec3(0, 240, 0));
        }

        // 5. 补齐玩家避雷绿色化身
        if (!this.playerAvatar) {
            const playerNode = new Node('PlayerAvatar');
            playerNode.layer = Layers.Enum.UI_2D;
            playerNode.parent = this.node;
            playerNode.setPosition(0, -320, 0);

            const pTransform = playerNode.addComponent(UITransform);
            pTransform.setContentSize(44, 44);

            const pSprite = playerNode.addComponent(Sprite);
            pSprite.color = new Color(60, 220, 60, 255); // 绿色防雷化身
            void VisualLoader.applySolidSprite(pSprite, pSprite.color);

            this.playerAvatar = playerNode;
        }
    }

    /**
     * 创建 Label 工厂方法
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = this.node;
        labelNode.setPosition(pos);

        const lTransform = labelNode.addComponent(UITransform);
        lTransform.setContentSize(600, 40);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.lineHeight = fontSize + 4;
        
        return label;
    }

    /**
     * 初始化触摸移动交互
     */
    private initInteraction() {
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    }

    private onTouchMove(event: EventTouch) {
        if (!this.gameActive || !this.playerAvatar) return;

        const delta = event.getDelta();
        const curPos = this.playerAvatar.position;
        // 限制其左右在屏幕 -280 到 280 范围内移动
        const nextX = Math.max(-280, Math.min(280, curPos.x + delta.x));
        this.playerAvatar.setPosition(nextX, curPos.y, curPos.z);
    }

    /**
     * 开启雷劫挑战
     */
    public startChallenge() {
        log('[TribulationPanel] 雷劫挑战开启，准备降下天劫！');
        this.currentHp = this.maxHp;
        if (this.hpBar) this.hpBar.progress = 1.0;
        
        this.gameTimer = 0;
        this.spawnTimer = 0;
        this.gameActive = true;
        
        if (this.playerAvatar) {
            this.playerAvatar.setPosition(0, -320, 0);
        }
        
        if (this.timeLabel) {
            this.timeLabel.string = `避雷劫倒计时: ${this.playDuration}s`;
        }
        if (this.tipLabel) {
            this.tipLabel.string = '左右拖动下方小人躲避落雷！';
        }
    }

    update(deltaTime: number) {
        if (!this.gameActive) return;

        // 1. 维护游戏倒计时
        this.gameTimer += deltaTime;
        const timeLeft = Math.max(0, this.playDuration - this.gameTimer);
        
        if (this.timeLabel) {
            this.timeLabel.string = `避雷劫倒计时: ${timeLeft.toFixed(1)}s`;
        }

        if (this.gameTimer >= this.playDuration) {
            this.endChallenge(true);
            return;
        }

        // 2. 酝酿和降下雷电闪击
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            // 随着时间推移，后期落雷酝酿稍微提速
            this.spawnInterval = Math.max(0.4, 0.65 - (this.gameTimer * 0.02));
            this.spawnLightningStrike();
        }
    }

    /**
     * 酝酿并在屏幕上方降下红色落雷区
     */
    private spawnLightningStrike() {
        if (!this.gameActive) return;

        // 随机在 X 轴 -260 到 260 像素之间产生落雷
        const strikeX = randomRange(-260, 260);

        // 1. 酝酿预警光圈 (红色高亮半透明圈)
        const warnNode = new Node('LightningWarning');
        warnNode.layer = Layers.Enum.UI_2D;
        warnNode.parent = this.node;
        warnNode.setPosition(strikeX, -320, 0); // 落地线

        const wt = warnNode.addComponent(UITransform);
        wt.setContentSize(70, 70);

        const ws = warnNode.addComponent(Sprite);
        ws.color = new Color(255, 50, 50, 100); // 红色警戒
        void VisualLoader.applySolidSprite(ws, ws.color);

        // 2. 0.45秒后，雷霆劈下
        this.scheduleOnce(() => {
            if (!this.gameActive) {
                warnNode.destroy();
                return;
            }

            // 闪电打击表现 (长条形黄色节点遮罩)
            const boltNode = new Node('LightningBolt');
            boltNode.layer = Layers.Enum.UI_2D;
            boltNode.parent = this.node;
            boltNode.setPosition(strikeX, 0, 0); // 纵贯全屏

            const bt = boltNode.addComponent(UITransform);
            bt.setContentSize(16, 800); // 宽16高800的电火花

            const bs = boltNode.addComponent(Sprite);
            bs.color = new Color(255, 230, 80, 255); // 黄色雷霆
            void VisualLoader.applySolidSprite(bs, bs.color);

            // 伤害碰撞判定
            if (this.playerAvatar) {
                const distanceX = Math.abs(this.playerAvatar.position.x - strikeX);
                if (distanceX < 36) { // 判定雷击命中半径 36 像素
                    this.takeDamage(25);
                }
            }

            // 0.15 秒后销毁雷电跟预警圈
            this.scheduleOnce(() => {
                boltNode.destroy();
                warnNode.destroy();
            }, 0.15);
        }, 0.45);
    }

    /**
     * 承受天劫雷击伤害
     */
    private takeDamage(amount: number) {
        if (!this.gameActive) return;

        this.currentHp = Math.max(0, this.currentHp - amount);
        log(`[TribulationPanel] 遭受天雷直击！受到伤害: ${amount}, 剩余气血: ${this.currentHp}%`);

        if (this.hpBar) {
            this.hpBar.progress = this.currentHp / this.maxHp;
        }

        // 屏幕瞬间白光闪烁滤镜表现
        const flashNode = new Node('LightningFlash');
        flashNode.layer = Layers.Enum.UI_2D;
        flashNode.parent = this.node;
        const ft = flashNode.addComponent(UITransform);
        ft.setContentSize(720, 1280);
        const fs = flashNode.addComponent(Sprite);
        fs.color = new Color(255, 255, 255, 120);
        void VisualLoader.applySolidSprite(fs, fs.color);
        this.scheduleOnce(() => flashNode.destroy(), 0.08);

        if (this.currentHp <= 0) {
            this.endChallenge(false);
        }
    }

    /**
     * 结算天劫结果
     * @param isVictory 是否存活通过
     */
    private endChallenge(isVictory: boolean) {
        if (!this.gameActive) return;
        this.gameActive = false;

        log(`[TribulationPanel] 天劫结束。判定结果: ${isVictory ? '晋级成功' : '渡劫失败'}`);
        
        if (this.tipLabel) {
            this.tipLabel.string = isVictory ? '【天劫退散】恭喜你，渡劫成功！境界得以突破！' : '【天道反噬】哎呀，渡劫身陨！修为受损！';
        }

        // 联动 HomeManager 正式更新境界
        if (HomeManager.instance) {
            HomeManager.instance.completeTribulation(isVictory);
        }

        // 2秒后自动关闭面板
        this.scheduleOnce(() => {
            this.node.active = false;
        }, 2.0);
    }
}
