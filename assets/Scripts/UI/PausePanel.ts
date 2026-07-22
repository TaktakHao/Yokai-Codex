import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log } from 'cc';
import { GameManager } from '../Manager/GameManager';
import { UIManager } from '../Manager/UIManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

/**
 * 局内暂停与设置 UI 面板 (PausePanel)
 * 纯代码防御性构建，提供【继续修行】、【返回洞府】以及【音效开关】选项
 */
@ccclass('PausePanel')
export class PausePanel extends Component {

    private titleLabel: Label | null = null;
    private resumeBtnNode: Node | null = null;
    private returnBtnNode: Node | null = null;
    private soundBtnNode: Node | null = null;
    private soundBtnLabel: Label | null = null;

    private isSoundOn: boolean = true;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        
        // 读取音效本地状态
        const savedSound = localStorage.getItem('game_sound_enabled');
        this.isSoundOn = savedSound !== 'false'; // 默认开启

        this.ensureUIElements();
        this.bindEvents();
    }

    /**
     * 纯代码防御性 UI 构建
     */
    private ensureUIElements() {
        // 1. 全屏拦截遮罩：720x1280, 半透明黑 Color(0, 0, 0, 160)
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(0, 0, 0, 160);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 中部设置面板容器
        const settingCard = new Node('SettingCard');
        settingCard.layer = Layers.Enum.UI_2D;
        settingCard.parent = this.node;
        settingCard.setPosition(0, 50, 0);

        const cardTransform = settingCard.addComponent(UITransform);
        cardTransform.setContentSize(480, 500);

        const cardBg = settingCard.addComponent(Sprite);
        cardBg.color = new Color(30, 40, 60, 240); // 幽静蓝灰色卡片背景
        void VisualLoader.applySolidSprite(cardBg, cardBg.color);

        // 3. 标题
        this.titleLabel = this.createLabel('TitleLabel', '☯ 挂 机 小 憩', 28, new Vec3(0, 180, 0), new Color(255, 215, 0), settingCard);

        // 4. 【 继续修行 】按钮
        this.resumeBtnNode = new Node('ResumeBtn');
        this.resumeBtnNode.layer = Layers.Enum.UI_2D;
        this.resumeBtnNode.parent = settingCard;
        this.resumeBtnNode.setPosition(0, 70, 0);

        const resumeTransform = this.resumeBtnNode.addComponent(UITransform);
        resumeTransform.setContentSize(320, 70);

        const resumeSprite = this.resumeBtnNode.addComponent(Sprite);
        resumeSprite.color = new Color(34, 197, 94, 255); // 翡翠绿
        void VisualLoader.applySolidSprite(resumeSprite, resumeSprite.color);

        this.resumeBtnNode.addComponent(Button);
        this.createLabel('ResumeBtnText', '继 续 修 行', 22, new Vec3(0, 0, 0), Color.WHITE, this.resumeBtnNode);

        // 5. 【 音效设置 】按钮
        this.soundBtnNode = new Node('SoundBtn');
        this.soundBtnNode.layer = Layers.Enum.UI_2D;
        this.soundBtnNode.parent = settingCard;
        this.soundBtnNode.setPosition(0, -30, 0);

        const soundTransform = this.soundBtnNode.addComponent(UITransform);
        soundTransform.setContentSize(320, 70);

        const soundSprite = this.soundBtnNode.addComponent(Sprite);
        soundSprite.color = new Color(71, 85, 105, 255); // 浅灰蓝
        void VisualLoader.applySolidSprite(soundSprite, soundSprite.color);

        this.soundBtnNode.addComponent(Button);
        this.soundBtnLabel = this.createLabel('SoundBtnText', this.getSoundLabelText(), 22, new Vec3(0, 0, 0), Color.WHITE, this.soundBtnNode);

        // 6. 【 返回洞府 】按钮 (放弃本次修行)
        this.returnBtnNode = new Node('ReturnBtn');
        this.returnBtnNode.layer = Layers.Enum.UI_2D;
        this.returnBtnNode.parent = settingCard;
        this.returnBtnNode.setPosition(0, -130, 0);

        const returnTransform = this.returnBtnNode.addComponent(UITransform);
        returnTransform.setContentSize(320, 70);

        const returnSprite = this.returnBtnNode.addComponent(Sprite);
        returnSprite.color = new Color(239, 68, 68, 255); // 丹砂红
        void VisualLoader.applySolidSprite(returnSprite, returnSprite.color);

        this.returnBtnNode.addComponent(Button);
        this.createLabel('ReturnBtnText', '返 回 洞 府', 22, new Vec3(0, 0, 0), Color.WHITE, this.returnBtnNode);

        // 提示信息
        this.createLabel('PauseTip', '💡 提示: 返回洞府将放弃本次战斗收益', 14, new Vec3(0, -210, 0), new Color(180, 195, 210), settingCard);
    }

    private getSoundLabelText(): string {
        return this.isSoundOn ? '🔊 灵音妙乐: 开启' : '🔇 灵音妙乐: 关闭';
    }

    /**
     * 动态创建 Label 辅助方法
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE, parentNode?: Node): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = parentNode || this.node;
        labelNode.setPosition(pos);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(400, 50);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;

        return label;
    }

    /**
     * 绑定事件监听
     */
    private bindEvents() {
        if (this.resumeBtnNode) {
            this.resumeBtnNode.on(Node.EventType.TOUCH_END, this.onResumeClick, this);
        }
        if (this.soundBtnNode) {
            this.soundBtnNode.on(Node.EventType.TOUCH_END, this.onSoundClick, this);
        }
        if (this.returnBtnNode) {
            this.returnBtnNode.on(Node.EventType.TOUCH_END, this.onReturnClick, this);
        }
    }

    /**
     * 点击“继续修行”
     */
    private onResumeClick() {
        log('[PausePanel] 点击【继续修行】，关闭暂停面板并恢复游戏');
        // 关闭当前暂停界面
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/PausePanel');
        }
        // 调用 GameManager 恢复运行
        if (GameManager.instance) {
            GameManager.instance.resumeGame();
        }
    }

    /**
     * 点击“音效开关”
     */
    private onSoundClick() {
        this.isSoundOn = !this.isSoundOn;
        localStorage.setItem('game_sound_enabled', this.isSoundOn ? 'true' : 'false');
        
        if (this.soundBtnLabel) {
            this.soundBtnLabel.string = this.getSoundLabelText();
        }
        log(`[PausePanel] 切换音效状态: ${this.isSoundOn ? '开启' : '关闭'}`);
    }

    /**
     * 点击“返回洞府”
     */
    private onReturnClick() {
        log('[PausePanel] 点击【返回洞府】，正在清理场景并返回...');
        
        // 1. 关闭暂停界面
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/PausePanel');
        }
        
        // 2. 必须在返回前恢复 director 的时间流速，避免回到主场景依然处于卡死/暂停状态
        if (GameManager.instance) {
            GameManager.instance.resumeGame();
            GameManager.instance.returnToHome();
        }
    }
}
