import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, log, Layers, tween, Button } from 'cc';
import { HomeManager } from '../Manager/HomeManager';
import { PetCaptureManager, PetEgg, AppraisedPet } from '../Logic/PetCaptureManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass, property } = _decorator;

/**
 * 局外宠物盲盒孵化鉴定 UI 面板 (AppraisalPanel)
 * 纯代码防御性构建，支持普通孵化 (100灵石) 与仙露孵化 (300灵石+30材料)，展现摇晃解封仪式与变异/五行结果广播
 */
@ccclass('AppraisalPanel')
export class AppraisalPanel extends Component {

    private titleLabel: Label | null = null;
    private resourceLabel: Label | null = null;
    private eggInfoLabel: Label | null = null;
    private resultLabel: Label | null = null;
    private eggDisplayNode: Node | null = null;

    private normalBtnNode: Node | null = null;
    private elixirBtnNode: Node | null = null;
    private closeBtnNode: Node | null = null;

    private isHatching: boolean = false;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        this.refreshDisplay();
    }

    /**
     * 防御性 UI 纯代码生成逻辑，确保缺失预制体资产时能自动补齐运行
     */
    private ensureUIElements() {
        // 1. 720x1280 暗黑紫半透明背景
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 头部标题
        if (!this.titleLabel) {
            this.titleLabel = this.createLabel('TitleLabel', '【 妖兽盲盒孵化鉴定 】', 28, new Vec3(0, 480, 0), new Color(255, 215, 0, 255));
        }

        // 3. 资源储备状态显示
        if (!this.resourceLabel) {
            this.resourceLabel = this.createLabel('ResourceLabel', '灵石: 0  |  材料: 0  |  持有妖兽蛋: 0', 18, new Vec3(0, 420, 0), Color.WHITE);
        }

        // 4. 中央蛋孵化展示容器节点
        if (!this.eggDisplayNode) {
            const eggNode = new Node('EggDisplayNode');
            eggNode.layer = Layers.Enum.UI_2D;
            eggNode.parent = this.node;
            eggNode.setPosition(0, 120, 0);

            const eggTrans = eggNode.addComponent(UITransform);
            eggTrans.setContentSize(140, 160);

            const eggSprite = eggNode.addComponent(Sprite);
            eggSprite.color = new Color(255, 180, 50, 255); // 金蛋外观
            void VisualLoader.applySolidSprite(eggSprite, eggSprite.color);

            this.eggDisplayNode = eggNode;
        }

        // 5. 待孵化蛋详情显示
        if (!this.eggInfoLabel) {
            this.eggInfoLabel = this.createLabel('EggInfoLabel', '正在读取准备孵化的妖兽蛋...', 18, new Vec3(0, -40, 0), Color.LIGHT_GRAY);
        }

        // 6. 孵化鉴定结果展示框
        if (!this.resultLabel) {
            this.resultLabel = this.createLabel('ResultLabel', '点击下方按钮开始解封灵蛋仪式！', 20, new Vec3(0, -120, 0), new Color(100, 255, 200, 255));
        }

        // 7. 普通孵化按钮 (100 灵石, 5% 变异率)
        if (!this.normalBtnNode) {
            this.normalBtnNode = this.createButton('NormalHatchBtn', '普通孵化 (100灵石)', new Vec3(-160, -280, 0), new Color(60, 140, 220, 255));
        }

        // 8. 仙露孵化按钮 (300 灵石 + 30 材料, 15% 变异率, 史诗保底)
        if (!this.elixirBtnNode) {
            this.elixirBtnNode = this.createButton('ElixirHatchBtn', '仙露孵化 (300灵石+30材料)', new Vec3(160, -280, 0), new Color(180, 60, 220, 255));
        }

        // 9. 关闭按钮
        if (!this.closeBtnNode) {
            this.closeBtnNode = this.createButton('CloseBtn', '✖ 关闭', new Vec3(0, -420, 0), new Color(160, 50, 50, 255), new Vec3(160, 50, 1));
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
        lTransform.setContentSize(640, 50);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.lineHeight = fontSize + 4;
        
        return label;
    }

    /**
     * 创建 Button 工厂方法
     */
    private createButton(name: string, title: string, pos: Vec3, bgColor: Color, sizeScale: Vec3 = new Vec3(280, 60, 1)): Node {
        const btnNode = new Node(name);
        btnNode.layer = Layers.Enum.UI_2D;
        btnNode.parent = this.node;
        btnNode.setPosition(pos);

        const bt = btnNode.addComponent(UITransform);
        bt.setContentSize(sizeScale.x, sizeScale.y);

        const sprite = btnNode.addComponent(Sprite);
        sprite.color = bgColor;
        void VisualLoader.applySolidSprite(sprite, sprite.color);

        btnNode.addComponent(Button);

        // 按钮文本
        const labelNode = new Node('Title');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = btnNode;
        const lt = labelNode.addComponent(UITransform);
        lt.setContentSize(sizeScale.x - 10, sizeScale.y - 10);

        const label = labelNode.addComponent(Label);
        label.string = title;
        label.fontSize = 18;
        label.color = Color.WHITE;

        return btnNode;
    }

    /**
     * 绑定交互事件
     */
    private bindEvents() {
        if (this.normalBtnNode) {
            this.normalBtnNode.on(Button.EventType.CLICK, () => this.startHatchRitual(false), this);
        }
        if (this.elixirBtnNode) {
            this.elixirBtnNode.on(Button.EventType.CLICK, () => this.startHatchRitual(true), this);
        }
        if (this.closeBtnNode) {
            this.closeBtnNode.on(Button.EventType.CLICK, () => {
                this.node.active = false;
            }, this);
        }
    }

    /**
     * 刷新界面资源与蛋信息
     */
    public refreshDisplay() {
        const homeMgr = HomeManager.instance;
        const petMgr = PetCaptureManager.instance;

        const stones = homeMgr ? homeMgr.spiritStones : 0;
        const mats = homeMgr ? homeMgr.materials : 0;
        const eggs = petMgr ? petMgr.getPetEggs() : [];

        if (this.resourceLabel) {
            this.resourceLabel.string = `灵石: ${stones}  |  修仙材料: ${mats}  |  未鉴定妖兽蛋: ${eggs.length} 只`;
        }

        if (this.eggInfoLabel) {
            if (eggs.length > 0) {
                const currentEgg = eggs[0];
                this.eggInfoLabel.string = `待孵化: [${currentEgg.rarity}] ${currentEgg.monsterType}  (五行预置: ${currentEgg.element || '金'})`;
            } else {
                this.eggInfoLabel.string = '背包中暂无未鉴定的妖兽蛋，快去局内抓捕吧！';
            }
        }
    }

    /**
     * 触发摇晃解封仪式并执行鉴定
     */
    private startHatchRitual(useElixir: boolean) {
        if (this.isHatching) return;

        const petMgr = PetCaptureManager.instance;
        if (!petMgr || petMgr.getEggCount() === 0) {
            if (this.resultLabel) {
                this.resultLabel.string = '孵化失败：背包中没有未鉴定的妖兽蛋！';
            }
            return;
        }

        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            if (useElixir) {
                if (homeMgr.spiritStones < 300 || homeMgr.materials < 30) {
                    if (this.resultLabel) this.resultLabel.string = '资源不足！仙露孵化需要 300 灵石 + 30 材料。';
                    return;
                }
            } else {
                if (homeMgr.spiritStones < 100) {
                    if (this.resultLabel) this.resultLabel.string = '资源不足！普通孵化需要 100 灵石。';
                    return;
                }
            }
        }

        const eggToAppraise = petMgr.getPetEggs()[0];
        this.isHatching = true;

        if (this.resultLabel) {
            this.resultLabel.string = useElixir ? '✨ 注入天地仙露，触发破茧出世仪式...' : '🌀 激活灵石阵法，破解妖符中...';
        }

        // 播放摇晃与缩放动画
        if (this.eggDisplayNode) {
            tween(this.eggDisplayNode)
                .to(0.1, { scale: new Vec3(1.2, 0.8, 1.0) })
                .to(0.1, { scale: new Vec3(0.8, 1.2, 1.0) })
                .to(0.1, { scale: new Vec3(1.1, 0.9, 1.0) })
                .to(0.1, { scale: new Vec3(0.95, 1.05, 1.0) })
                .to(0.1, { scale: new Vec3(1.0, 1.0, 1.0) })
                .start();
        }

        this.scheduleOnce(() => {
            try {
                const pet: AppraisedPet = petMgr.appraisePetEgg(eggToAppraise, useElixir);
                this.showHatchResult(pet);
            } catch (err: any) {
                if (this.resultLabel) {
                    this.resultLabel.string = `孵化异常: ${err.message || err}`;
                }
            } finally {
                this.isHatching = false;
                this.refreshDisplay();
            }
        }, 0.55);
    }

    /**
     * 展示鉴定出库结果
     */
    private showHatchResult(pet: AppraisedPet) {
        if (!pet || !this.resultLabel) return;

        const mutateText = pet.isMutated ? ' ✨【发生天道变异！属性翻倍！】' : '';
        const evolvedText = pet.isEvolved ? ' 🌟【满星化形破茧！】' : '';

        this.resultLabel.string = `🎉 恭喜获得 [${pet.rarity}] 宠物【${pet.name}】！\n五行属性: [${pet.element}] | 攻击: ${pet.attack} | 生命: ${pet.hp} | 速度: ${pet.speed}${mutateText}${evolvedText}`;
        log(`[AppraisalPanel] 宠物盲盒鉴定完成: ${pet.name}, 稀有度: ${pet.rarity}, 五行: ${pet.element}, 变异: ${pet.isMutated}`);
    }
}
