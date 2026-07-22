import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, log, Layers, Button } from 'cc';
import { HomeManager, RelicSlotType, IRelicData, RELIC_CONFIGS } from '../Manager/HomeManager';
import { UIManager } from '../Manager/UIManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

/**
 * 局外法宝装备穿戴、升级与合成面板 (EquipmentPanel)
 * 纯代码防御性构建，包含 3 大部位槽位展示、背包列表、装备/脱下、升级扣减灵石材料、合成升星校验 (消耗 2 同配置同星级胚子)
 */
@ccclass('EquipmentPanel')
export class EquipmentPanel extends Component {

    private titleLabel: Label | null = null;
    private resourceLabel: Label | null = null;
    private statusMessageLabel: Label | null = null;
    private equippedContainer: Node | null = null;
    private inventoryContainer: Node | null = null;
    private closeBtnNode: Node | null = null;

    /** 槽位节点引用 */
    private slotNodes: Record<RelicSlotType, { node: Node; infoLabel: Label; actionBtn: Node }> = {} as any;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        this.refreshDisplay();
    }

    /**
     * 纯代码防御性构建 UI 布局
     */
    private ensureUIElements() {
        // 1. 全屏 720x1280 暗黑半透明背景
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 顶栏标题
        if (!this.titleLabel) {
            this.titleLabel = this.createLabel('TitleLabel', '【 仙器法宝 炼制与装备 】', 28, new Vec3(0, 540, 0), new Color(255, 215, 0, 255));
        }

        // 3. 资源储备显示
        if (!this.resourceLabel) {
            this.resourceLabel = this.createLabel('ResourceLabel', '灵石: 0  |  修仙材料: 0', 18, new Vec3(0, 490, 0), Color.WHITE);
        }

        // 4. 已穿戴槽位区域
        this.createLabel('EquippedSectionTitle', '--- 已穿戴法宝槽位 ---', 20, new Vec3(0, 440, 0), new Color(180, 220, 255, 255));

        if (!this.equippedContainer) {
            this.equippedContainer = new Node('EquippedContainer');
            this.equippedContainer.layer = Layers.Enum.UI_2D;
            this.equippedContainer.parent = this.node;
            this.equippedContainer.setPosition(0, 310, 0);

            const slotConfigs: { slot: RelicSlotType; name: string; pos: Vec3 }[] = [
                { slot: RelicSlotType.WEAPON, name: '【主武器】', pos: new Vec3(-210, 0, 0) },
                { slot: RelicSlotType.ACCESSORY, name: '【配饰】', pos: new Vec3(0, 0, 0) },
                { slot: RelicSlotType.GOURD, name: '【祖传葫芦】', pos: new Vec3(210, 0, 0) }
            ];

            for (const cfg of slotConfigs) {
                const card = new Node(`SlotCard_${cfg.slot}`);
                card.layer = Layers.Enum.UI_2D;
                card.parent = this.equippedContainer;
                card.setPosition(cfg.pos);

                const cardTrans = card.addComponent(UITransform);
                cardTrans.setContentSize(190, 180);

                const cardSp = card.addComponent(Sprite);
                cardSp.color = new Color(40, 45, 65, 255);
                void VisualLoader.applySolidSprite(cardSp, cardSp.color);

                // 槽位名称
                this.createLabel(`SlotTitle_${cfg.slot}`, cfg.name, 16, new Vec3(0, 65, 0), new Color(255, 200, 100, 255), card);

                // 槽位信息文本
                const infoLbl = this.createLabel(`SlotInfo_${cfg.slot}`, '未装备', 14, new Vec3(0, 15, 0), Color.LIGHT_GRAY, card);

                // 脱下按钮
                const unequipBtn = this.createButton(`UnequipBtn_${cfg.slot}`, '脱下', new Vec3(0, -55, 0), new Color(180, 60, 60, 255), new Vec3(120, 36, 1), card);

                this.slotNodes[cfg.slot] = {
                    node: card,
                    infoLabel: infoLbl,
                    actionBtn: unequipBtn
                };
            }
        }

        // 5. 背包列表区域
        this.createLabel('InventorySectionTitle', '--- 法宝背包 (可装备 / 升级 / 消耗2胚子合成升星) ---', 20, new Vec3(0, 180, 0), new Color(180, 220, 255, 255));

        if (!this.inventoryContainer) {
            this.inventoryContainer = new Node('InventoryContainer');
            this.inventoryContainer.layer = Layers.Enum.UI_2D;
            this.inventoryContainer.parent = this.node;
            this.inventoryContainer.setPosition(0, 0, 0);

            const invTrans = this.inventoryContainer.addComponent(UITransform);
            invTrans.setContentSize(680, 320);
        }

        // 6. 操作结果/提示文本
        if (!this.statusMessageLabel) {
            this.statusMessageLabel = this.createLabel('StatusMessageLabel', '点击按钮可进行装备、强化或合成升星操作！', 16, new Vec3(0, -480, 0), new Color(100, 255, 180, 255));
        }

        // 7. 关闭按钮
        if (!this.closeBtnNode) {
            this.closeBtnNode = this.createButton('ClosePanelBtn', '关闭面板', new Vec3(0, -540, 0), new Color(120, 120, 120, 255), new Vec3(200, 50, 1));
        }
    }

    /**
     * 绑定按钮事件监听
     */
    private bindEvents() {
        // 关闭按钮
        if (this.closeBtnNode) {
            this.closeBtnNode.on(Button.EventType.CLICK, () => {
                UIManager.instance.closeUI('EquipmentPanel');
            }, this);
        }

        // 绑定各部位脱下按钮
        for (const slotKey in this.slotNodes) {
            const slot = slotKey as RelicSlotType;
            const btn = this.slotNodes[slot].actionBtn;
            btn.on(Button.EventType.CLICK, () => {
                const homeMgr = HomeManager.instance;
                if (homeMgr) {
                    const success = homeMgr.unequipRelic(slot);
                    if (success && this.statusMessageLabel) {
                        this.statusMessageLabel.string = `已成功卸下部位 [${slot}] 的法宝！`;
                    }
                    this.refreshDisplay();
                }
            }, this);
        }
    }

    /**
     * 刷新面板界面显示
     */
    public refreshDisplay() {
        const homeMgr = HomeManager.instance;
        if (!homeMgr) return;

        // 1. 刷新资源
        if (this.resourceLabel) {
            this.resourceLabel.string = `灵石: ${homeMgr.spiritStones}  |  修仙材料: ${homeMgr.materials}`;
        }

        // 2. 刷新已装备槽位
        const equippedRelics = homeMgr.getEquippedRelics();
        for (const slotKey of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD]) {
            const slotData = this.slotNodes[slotKey];
            const relic = equippedRelics[slotKey];

            if (slotData) {
                if (relic) {
                    const stars = '★'.repeat(relic.star);
                    slotData.infoLabel.string = `${relic.name}\n${stars}\nLv.${relic.level} (加成:${relic.baseBonus})`;
                    slotData.actionBtn.active = true;
                } else {
                    slotData.infoLabel.string = '【空槽位】\n未装备';
                    slotData.actionBtn.active = false;
                }
            }
        }

        // 3. 刷新背包法宝列表
        if (this.inventoryContainer) {
            // 清理旧卡片
            this.inventoryContainer.destroyAllChildren();

            const inventory = homeMgr.getRelicInventory();
            if (inventory.length === 0) {
                this.createLabel('EmptyLabel', '法宝背包暂无法宝', 18, new Vec3(0, 0, 0), Color.GRAY, this.inventoryContainer);
                return;
            }

            // 渲染背包物品卡片
            const startY = 110;
            const itemHeight = 90;

            for (let i = 0; i < inventory.length; i++) {
                const relic = inventory[i];
                const card = new Node(`RelicCard_${relic.id}`);
                card.layer = Layers.Enum.UI_2D;
                card.parent = this.inventoryContainer;
                card.setPosition(0, startY - i * itemHeight, 0);

                const cardTrans = card.addComponent(UITransform);
                cardTrans.setContentSize(640, 80);

                const cardSp = card.addComponent(Sprite);
                cardSp.color = new Color(30, 35, 50, 255);
                void VisualLoader.applySolidSprite(cardSp, cardSp.color);

                // 名字与星级
                const stars = '★'.repeat(relic.star);
                const isEquipped = this.isRelicEquipped(relic.id);
                const statusTag = isEquipped ? ' [已穿戴]' : '';
                this.createLabel(`CardText_${relic.id}`, `${relic.name}${statusTag}\n${stars} Lv.${relic.level} (加成: ${relic.baseBonus})`, 14, new Vec3(-180, 0, 0), new Color(255, 230, 150, 255), card);

                // 升级成本
                const costStones = relic.level * 100;
                const costMats = relic.level * 10;

                // 按钮组：装备、升级、合成升星
                const equipBtn = this.createButton(`EquipBtn_${relic.id}`, isEquipped ? '已穿戴' : '装备', new Vec3(40, 0, 0), isEquipped ? new Color(80, 80, 80, 255) : new Color(50, 160, 80, 255), new Vec3(90, 38, 1), card);
                const upgradeBtn = this.createButton(`UpgradeBtn_${relic.id}`, `升级\n(${costStones}石)`, new Vec3(140, 0, 0), new Color(60, 120, 200, 255), new Vec3(90, 38, 1), card);
                const synthBtn = this.createButton(`SynthBtn_${relic.id}`, '合成升星\n(需2胚子)', new Vec3(240, 0, 0), new Color(180, 80, 180, 255), new Vec3(90, 38, 1), card);

                if (isEquipped) {
                    equipBtn.getComponent(Button)!.interactable = false;
                } else {
                    equipBtn.on(Button.EventType.CLICK, () => {
                        homeMgr.equipRelic(relic.id, relic.type);
                        if (this.statusMessageLabel) {
                            this.statusMessageLabel.string = `成功穿戴法宝 [${relic.name}] 到部位 [${relic.type}]！`;
                        }
                        this.refreshDisplay();
                    }, this);
                }

                upgradeBtn.on(Button.EventType.CLICK, () => {
                    const res = homeMgr.upgradeRelic(relic.id);
                    if (this.statusMessageLabel) {
                        this.statusMessageLabel.string = res.message;
                    }
                    this.refreshDisplay();
                }, this);

                synthBtn.on(Button.EventType.CLICK, () => {
                    this.handleSynthesize(relic);
                }, this);
            }
        }
    }

    /**
     * 处理合成升星点击：在背包中寻找 2 个相同配置相同星级的胚子
     */
    private handleSynthesize(targetRelic: IRelicData) {
        const homeMgr = HomeManager.instance;
        if (!homeMgr) return;

        if (targetRelic.star >= 5) {
            if (this.statusMessageLabel) {
                this.statusMessageLabel.string = `法宝 [${targetRelic.name}] 已达最高 5 星！`;
            }
            return;
        }

        const inventory = homeMgr.getRelicInventory();
        // 查找与 targetRelic 同配置、同星级且非 targetRelic 自身的材料胚子
        const matchingFoods = inventory.filter(r => r.id !== targetRelic.id && r.configId === targetRelic.configId && r.star === targetRelic.star);

        if (matchingFoods.length < 2) {
            if (this.statusMessageLabel) {
                this.statusMessageLabel.string = `合成失败：法宝背包中缺少 2 个同配置(${targetRelic.name})同星级(${targetRelic.star}星)的材料胚子！`;
            }
            return;
        }

        const mat1 = matchingFoods[0];
        const mat2 = matchingFoods[1];
        const res = homeMgr.synthesizeRelic(targetRelic.id, mat1.id, mat2.id);
        if (this.statusMessageLabel) {
            this.statusMessageLabel.string = res.message;
        }
        this.refreshDisplay();
    }

    /**
     * 判定指定 ID 的法宝是否处于穿戴状态
     */
    private isRelicEquipped(relicId: string): boolean {
        const homeMgr = HomeManager.instance;
        if (!homeMgr) return false;
        const equipped = homeMgr.getEquippedRelics();
        return (equipped.WEAPON?.id === relicId || equipped.ACCESSORY?.id === relicId || equipped.GOURD?.id === relicId);
    }

    /**
     * 创建 Label 文本节点通用辅助函数
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color, parent?: Node): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent || this.node;
        node.setPosition(pos);

        const trans = node.addComponent(UITransform);
        trans.setContentSize(400, 50);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;

        return label;
    }

    /**
     * 创建 Button 交互按钮节点通用辅助函数
     */
    private createButton(name: string, text: string, pos: Vec3, color: Color, scale: Vec3 = new Vec3(160, 44, 1), parent?: Node): Node {
        const btnNode = new Node(name);
        btnNode.layer = Layers.Enum.UI_2D;
        btnNode.parent = parent || this.node;
        btnNode.setPosition(pos);

        const trans = btnNode.addComponent(UITransform);
        trans.setContentSize(scale.x, scale.y);

        const sprite = btnNode.addComponent(Sprite);
        sprite.color = color;
        void VisualLoader.applySolidSprite(sprite, sprite.color);

        btnNode.addComponent(Button);

        const lblNode = new Node(`${name}_Label`);
        lblNode.layer = Layers.Enum.UI_2D;
        lblNode.parent = btnNode;
        lblNode.setPosition(0, 0, 0);

        const lblTrans = lblNode.addComponent(UITransform);
        lblTrans.setContentSize(scale.x, scale.y);

        const label = lblNode.addComponent(Label);
        label.string = text;
        label.fontSize = 13;
        label.lineHeight = 16;
        label.color = Color.WHITE;

        return btnNode;
    }
}
