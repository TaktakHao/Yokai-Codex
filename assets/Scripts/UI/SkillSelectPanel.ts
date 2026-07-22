import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, director, Layers, log } from 'cc';
import { SkillPoolManager, ISkill } from '../Logic/SkillPoolManager';
import { GameManager } from '../Manager/GameManager';
import { UIManager } from '../Manager/UIManager';
import { EventManager, UIEvent } from '../Manager/EventManager';
import { PlayerController } from '../PlayerController';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass, property } = _decorator;

/**
 * Roguelike 三选一技能面板组件 (SkillSelectPanel)
 * 纯代码防御性 UI 构建，支持升级弹窗、技能抽选、按钮交互与游戏暂停/恢复控制
 */
@ccclass('SkillSelectPanel')
export class SkillSelectPanel extends Component {

    private _skillPoolManager: SkillPoolManager | null = null;
    private _cardsRoot: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUI();
    }

    onEnable() {
        // 弹出三选一技能界面时暂停游戏主循环，隔离背景怪物追击
        director.pause();
        this.findSkillPoolManager();
        this.refreshSkillOptions();
    }

    onDisable() {
        // 关闭/隐藏面板时恢复游戏主循环
        director.resume();
    }

    /**
     * 防御性构建三选一面板基础结构
     */
    private ensureUI() {
        const uiTransform = this.getComponent(UITransform) || this.addComponent(UITransform);
        uiTransform.setContentSize(800, 600);

        // 1. 半透明遮罩背景
        const maskNode = new Node('Mask');
        maskNode.layer = Layers.Enum.UI_2D;
        maskNode.parent = this.node;
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(1280, 720);
        const maskSprite = maskNode.addComponent(Sprite);
        maskSprite.color = new Color(0, 0, 0, 210);
        void VisualLoader.applySolidSprite(maskSprite, maskSprite.color);

        // 2. 标题 Label
        const titleNode = new Node('TitleLabel');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.parent = this.node;
        titleNode.setPosition(0, 200, 0);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(600, 60);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '境界突破！请选择领悟一项功法';
        titleLabel.fontSize = 28;
        titleLabel.lineHeight = 34;
        titleLabel.color = new Color(255, 215, 0, 255);

        // 3. 卡片容器节点
        this._cardsRoot = new Node('CardsRoot');
        this._cardsRoot.layer = Layers.Enum.UI_2D;
        this._cardsRoot.parent = this.node;
        this._cardsRoot.setPosition(0, -20, 0);
    }

    /**
     * 获取场景中的 SkillPoolManager 实例
     */
    private findSkillPoolManager() {
        if (GameManager.instance && GameManager.instance.skillPoolManager) {
            this._skillPoolManager = GameManager.instance.skillPoolManager;
        } else {
            const scene = director.getScene();
            this._skillPoolManager = scene?.getComponentInChildren(SkillPoolManager) || null;
        }
    }

    /**
     * 刷新三选一技能卡片
     */
    public refreshSkillOptions() {
        if (!this._cardsRoot) return;

        // 清除旧卡片
        this._cardsRoot.removeAllChildren();

        if (!this._skillPoolManager) {
            log('[SkillSelectPanel] 未能找到 SkillPoolManager，无法抽选技能');
            return;
        }

        // 抽取 3 个可选技能
        const options: ISkill[] = this._skillPoolManager.getRandomSkills(3);
        log(`[SkillSelectPanel] 成功抽选 3 选 1 技能:`, options.map(s => s.name));

        if (options.length === 0) {
            // 所有技能已满级的兜底提示
            this.createFallbackCard(0, '无双气血', '全技能已达化境！回复 100% 生命值', () => {
                log('[SkillSelectPanel] 玩家选择满级兜底奖励: 回复全额生命');
                
                // 执行生命值满血恢复逻辑，并派发 HP 变更事件
                const scene = director.getScene();
                const canvas = scene?.getChildByName('Canvas');
                const playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren(PlayerController)?.node;
                if (playerNode) {
                    const playerComp = playerNode.getComponent(PlayerController);
                    if (playerComp) {
                        playerComp.restoreFullHp();
                    }
                }

                director.resume();
                if (UIManager.instance) UIManager.instance.closeUI('UI/SkillSelectPanel');
            });
            return;
        }

        const startX = -((options.length - 1) * 220) / 2;

        options.forEach((skill, index) => {
            const posX = startX + index * 220;
            this.createSkillCard(posX, skill);
        });
    }

    /**
     * 创建单张技能卡片 UI
     */
    private createSkillCard(posX: number, skill: ISkill) {
        if (!this._cardsRoot) return;

        const cardNode = new Node(`SkillCard_${skill.id}`);
        cardNode.layer = Layers.Enum.UI_2D;
        cardNode.parent = this._cardsRoot;
        cardNode.setPosition(posX, 0, 0);

        const cardTransform = cardNode.addComponent(UITransform);
        cardTransform.setContentSize(190, 260);

        // 卡片背景
        const bgSprite = cardNode.addComponent(Sprite);
        bgSprite.color = this.getTagBgColor(skill.tag);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 按钮交互组件
        const btn = cardNode.addComponent(Button);
        btn.target = cardNode;

        // 流派 Tag 标签
        const tagNode = new Node('TagLabel');
        tagNode.layer = Layers.Enum.UI_2D;
        tagNode.parent = cardNode;
        tagNode.setPosition(0, 100, 0);
        const tagLabel = tagNode.addComponent(Label);
        tagLabel.string = `【${skill.tag}】`;
        tagLabel.fontSize = 16;
        tagLabel.color = new Color(255, 230, 150, 255);

        // 技能名称 Label
        const nameNode = new Node('NameLabel');
        nameNode.layer = Layers.Enum.UI_2D;
        nameNode.parent = cardNode;
        nameNode.setPosition(0, 65, 0);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = skill.name;
        nameLabel.fontSize = 20;
        nameLabel.color = Color.WHITE;

        // 等级/变更 Label
        const lvlNode = new Node('LevelLabel');
        lvlNode.layer = Layers.Enum.UI_2D;
        lvlNode.parent = cardNode;
        lvlNode.setPosition(0, 35, 0);
        const lvlLabel = lvlNode.addComponent(Label);
        lvlLabel.string = `Lv.${skill.level} -> Lv.${skill.level + 1}`;
        lvlLabel.fontSize = 14;
        lvlLabel.color = new Color(180, 255, 180, 255);

        // 技能描述 Label
        const descNode = new Node('DescLabel');
        descNode.layer = Layers.Enum.UI_2D;
        descNode.parent = cardNode;
        descNode.setPosition(0, -40, 0);
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(170, 100);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = skill.description;
        descLabel.fontSize = 13;
        descLabel.lineHeight = 17;
        descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLabel.color = new Color(220, 220, 220, 255);

        // 选择按钮底部提示
        const hintNode = new Node('HintLabel');
        hintNode.layer = Layers.Enum.UI_2D;
        hintNode.parent = cardNode;
        hintNode.setPosition(0, -105, 0);
        const hintLabel = hintNode.addComponent(Label);
        hintLabel.string = '[ 点击参悟 ]';
        hintLabel.fontSize = 14;
        hintLabel.color = new Color(255, 215, 0, 255);

        // 点击事件绑定
        cardNode.on(Button.EventType.CLICK, () => {
            this.onSelectSkill(skill);
        }, this);
    }

    /**
     * 兜底卡片生成
     */
    private createFallbackCard(posX: number, title: string, desc: string, onSelect: () => void) {
        if (!this._cardsRoot) return;

        const cardNode = new Node('FallbackCard');
        cardNode.layer = Layers.Enum.UI_2D;
        cardNode.parent = this._cardsRoot;
        cardNode.setPosition(posX, 0, 0);

        const cardTransform = cardNode.addComponent(UITransform);
        cardTransform.setContentSize(200, 260);

        const bgSprite = cardNode.addComponent(Sprite);
        bgSprite.color = new Color(60, 60, 80, 230);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        const btn = cardNode.addComponent(Button);
        btn.target = cardNode;

        const nameNode = new Node('NameLabel');
        nameNode.layer = Layers.Enum.UI_2D;
        nameNode.parent = cardNode;
        nameNode.setPosition(0, 60, 0);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = title;
        nameLabel.fontSize = 20;
        nameLabel.color = Color.WHITE;

        const descNode = new Node('DescLabel');
        descNode.layer = Layers.Enum.UI_2D;
        descNode.parent = cardNode;
        descNode.setPosition(0, -20, 0);
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(180, 100);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = desc;
        descLabel.fontSize = 14;
        descLabel.color = new Color(200, 200, 200, 255);

        cardNode.on(Button.EventType.CLICK, onSelect, this);
    }

    /**
     * 根据流派 Tag 返回个性化背景颜色
     */
    private getTagBgColor(tag: string): Color {
        switch (tag) {
            case '体修':
                return new Color(100, 40, 40, 235); // 炽红
            case '法修':
                return new Color(40, 60, 110, 235); // 幽蓝
            case '御兽':
                return new Color(40, 90, 50, 235);  // 翡翠绿
            default:
                return new Color(50, 50, 60, 235);
        }
    }

    /**
     * 玩家确认选择技能
     */
    private onSelectSkill(skill: ISkill) {
        log(`[SkillSelectPanel] 玩家选择了技能: ${skill.name} (ID: ${skill.id}), 当前等级 Lv.${skill.level + 1}`);

        if (this._skillPoolManager) {
            this._skillPoolManager.selectSkill(skill.id);
        }

        // 恢复游戏进度
        director.resume();

        // 关闭面板
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/SkillSelectPanel');
        } else {
            this.node.active = false;
        }
    }
}
