import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log, BlockInputEvents } from 'cc';
import { VisualLoader } from '../Utils/VisualLoader';
import { GameManager } from '../Manager/GameManager';

const { ccclass } = _decorator;

/**
 * 剧情对话与新手引导 UI 面板 (DialoguePanel)
 * 纯代码防御性构建，提供精美的墨色修仙对话框、打字机动效以及点击继续/全跳过闭环
 */
@ccclass('DialoguePanel')
export class DialoguePanel extends Component {

    private speakerLabel: Label | null = null;
    private contentLabel: Label | null = null;
    private tipsLabel: Label | null = null;
    private skipBtnNode: Node | null = null;

    // 对话文本打字机控制
    private targetText: string = '';
    private currentText: string = '';
    private charIndex: number = 0;
    private typingSpeed: number = 0.04; // 字符显示速度(秒)
    private isTyping: boolean = false;
    private typingTimer: number = 0; // 累计打字时间
    private onCompleteCallback: (() => void) | null = null;
    private onSkipAllCallback: (() => void) | null = null;
    private isInitialized: boolean = false;

    onLoad() {
        this.checkInit();
    }

    private checkInit() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        console.log('====== [TRACE] DialoguePanel Initialization STARTED ======');
        this.node.layer = Layers.Enum.UI_2D;
        
        // 强制添加 BlockInputEvents 防止点击穿透
        if (!this.node.getComponent(BlockInputEvents)) {
            this.node.addComponent(BlockInputEvents);
        }

        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        if (GameManager.instance) {
            GameManager.instance.freezeBattle();
        }
    }

    onDisable() {
        if (GameManager.instance) {
            GameManager.instance.resumeBattle();
        }
    }

    /**
     * 纯代码防御性 UI 构建
     */
    private ensureUIElements() {
        // 1. 全屏拦截遮罩：720x1280, 半透明黑 Color(0, 0, 0, 100)
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(0, 0, 0, 120);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 右上角【 跳过 】剧情按钮
        this.skipBtnNode = new Node('SkipBtn');
        this.skipBtnNode.layer = Layers.Enum.UI_2D;
        this.skipBtnNode.parent = this.node;
        this.skipBtnNode.setPosition(250, 520, 0);

        const btnTransform = this.skipBtnNode.addComponent(UITransform);
        btnTransform.setContentSize(120, 48);

        const btnSprite = this.skipBtnNode.addComponent(Sprite);
        btnSprite.color = new Color(40, 50, 70, 200); // 幽暗背景色
        void VisualLoader.applySolidSprite(btnSprite, btnSprite.color);

        this.skipBtnNode.addComponent(Button);
        this.createLabel('SkipBtnText', '跳 过', 18, new Vec3(0, 0, 0), new Color(200, 220, 255), this.skipBtnNode);

        // 3. 底部主对话框容器
        const dialogBox = new Node('DialogBox');
        dialogBox.layer = Layers.Enum.UI_2D;
        dialogBox.parent = this.node;
        dialogBox.setPosition(0, -320, 0);

        const boxTransform = dialogBox.addComponent(UITransform);
        boxTransform.setContentSize(660, 240);

        const boxSprite = dialogBox.addComponent(Sprite);
        boxSprite.color = new Color(15, 23, 42, 240); // 经典深墨色修仙背景
        void VisualLoader.applySolidSprite(boxSprite, boxSprite.color);

        // 4. 说话人名字 Label（左上角）
        this.speakerLabel = this.createLabel('SpeakerLabel', '旁白', 24, new Vec3(-300, 80, 0), new Color(255, 215, 0), dialogBox);
        const speakerTransform = this.speakerLabel.node.getComponent(UITransform);
        if (speakerTransform) {
            speakerTransform.setAnchorPoint(0, 0.5);
            speakerTransform.setContentSize(500, 40);
        }

        // 5. 对话正文 Label（居中偏下）
        this.contentLabel = this.createLabel('ContentLabel', '', 20, new Vec3(-300, 30, 0), Color.WHITE, dialogBox);
        const contentTransform = this.contentLabel.node.getComponent(UITransform);
        if (contentTransform) {
            contentTransform.setAnchorPoint(0, 1);
            contentTransform.setContentSize(600, 140);
        }
        // 允许文本自动换行
        this.contentLabel.overflow = Label.Overflow.SHRINK;

        // 6. 底部提示 Label（右下角提示）
        this.tipsLabel = this.createLabel('TipsLabel', '点击任意位置继续 ▶', 14, new Vec3(280, -90, 0), new Color(150, 160, 180), dialogBox);
        const tipsTransform = this.tipsLabel.node.getComponent(UITransform);
        if (tipsTransform) {
            tipsTransform.setAnchorPoint(1, 0.5);
            tipsTransform.setContentSize(200, 30);
        }
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
        transform.setContentSize(600, 40);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;

        return label;
    }

    /**
     * 绑定触控与按钮事件
     */
    private bindEvents() {
        // 绑定全屏点击：点击拦截遮罩以推进对话
        this.node.on(Node.EventType.TOUCH_END, this.onScreenClick, this);

        // 绑定跳过按钮
        if (this.skipBtnNode) {
            this.skipBtnNode.on(Node.EventType.TOUCH_END, this.onSkipBtnClick, this);
        }
    }

    /**
     * 外部接口：展示单条对话
     * @param speaker 说话人名称
     * @param text 对话文本内容
     * @param callback 播放完毕后的回调推进函数
     * @param onSkipAll 点击【跳过】整段剧情时的回调推进函数
     */
    public showDialogue(speaker: string, text: string, callback: () => void, onSkipAll?: () => void) {
        this.checkInit();
        console.log(`====== [TRACE] DialoguePanel showDialogue: ${speaker} - ${text} ======`);
        if (this.speakerLabel) {
            this.speakerLabel.string = speaker;
            // 如果是旁白或系统，使用灰色/蓝色区分
            if (speaker === '旁白') {
                this.speakerLabel.color = new Color(200, 200, 200);
            } else if (speaker === '系统') {
                this.speakerLabel.color = new Color(50, 180, 255);
            } else {
                this.speakerLabel.color = new Color(255, 215, 0); // 黄金色主角/NPC
            }
        }

        this.targetText = text;
        this.currentText = '';
        this.charIndex = 0;
        this.typingTimer = 0;
        this.isTyping = true;
        this.onCompleteCallback = callback;
        if (onSkipAll) {
            this.onSkipAllCallback = onSkipAll;
        }

        if (this.contentLabel) {
            this.contentLabel.string = '';
        }
    }

    /**
     * 利用 update 每帧更新来驱动打字机逻辑，彻底避开 Cocos Creator component 异步激活时的 schedule 注册失效 Bug
     */
    update(deltaTime: number) {
        if (!this.isTyping) return;

        this.typingTimer += deltaTime;
        if (this.typingTimer >= this.typingSpeed) {
            // 计算在这一步中应当输出多少个字符
            const charsToPrint = Math.floor(this.typingTimer / this.typingSpeed);
            this.typingTimer -= charsToPrint * this.typingSpeed;

            for (let i = 0; i < charsToPrint; i++) {
                if (this.charIndex < this.targetText.length) {
                    this.currentText += this.targetText[this.charIndex];
                    this.charIndex++;
                } else {
                    this.finishTyping();
                    break;
                }
            }

            if (this.contentLabel) {
                this.contentLabel.string = this.currentText;
            }
        }
    }

    /**
     * 结束打字机并展示完整文字
     */
    private finishTyping() {
        console.log('====== [TRACE] DialoguePanel finishTyping ======');
        this.isTyping = false;
        if (this.contentLabel) {
            this.contentLabel.string = this.targetText;
        }
    }

    /**
     * 全屏点击处理：若在打字则瞬间显现；若已打完则推进下一句
     */
    private onScreenClick(event: any) {
        console.log('====== [TRACE] DialoguePanel onScreenClick triggered ======');
        // 如果是点击了 Skip 按钮，直接不在这里处理，由按钮独立拦截
        if (event && event.target === this.skipBtnNode) {
            return;
        }

        if (this.isTyping) {
            console.log('====== [TRACE] DialoguePanel instantly finishing typing... ======');
            this.finishTyping();
        } else {
            if (this.onCompleteCallback) {
                console.log('====== [TRACE] DialoguePanel advancing to next callback ======');
                const cb = this.onCompleteCallback;
                this.onCompleteCallback = null;
                cb();
            } else {
                console.warn('====== [TRACE] DialoguePanel onScreenClick but onCompleteCallback is null! ======');
            }
        }
    }

    /**
     * 跳过本段整条剧情线
     */
    private onSkipBtnClick(event: any) {
        log('[DialoguePanel] 用户点击【跳过】，跳过整段剧情对话。');
        this.isTyping = false;
        
        if (this.onSkipAllCallback) {
            const skipCb = this.onSkipAllCallback;
            this.onSkipAllCallback = null;
            this.onCompleteCallback = null;
            skipCb();
        } else if (this.onCompleteCallback) {
            // 没有配置 skipAll 则回退到直接推进最后一步
            const cb = this.onCompleteCallback;
            this.onCompleteCallback = null;
            cb();
        }
    }
}
