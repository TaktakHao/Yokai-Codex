import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 技能流派标签类型
 */
export type SkillTag = '体修' | '法修' | '御兽';

/**
 * 技能数据接口定义
 */
export interface ISkill {
    /** 技能唯一标识 ID */
    id: string;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    description: string;
    /** 当前技能等级 (初始为 0) */
    level: number;
    /** 技能最大等级 */
    maxLevel: number;
    /** 技能所属流派标签 */
    tag: SkillTag;
    /** 技能图标资源路径/标识 */
    icon: string;
    /** 技能基础数值效果 */
    effectValue: number;
    /** 技能效果类型描述 (可选) */
    effectType?: string;
}

/**
 * 流派共鸣配置接口
 */
export interface IResonanceConfig {
    /** 共鸣技能/效果名称 */
    name: string;
    /** 所需流派标签数量阈值 */
    threshold: number;
    /** 共鸣描述 */
    description: string;
    /** 共鸣效果属性参数 */
    effect: Record<string, number | string>;
}

/**
 * 局内升级与流派构筑机制 (Roguelike) 管理组件
 */
@ccclass('SkillPoolManager')
export class SkillPoolManager extends Component {

    /** 完整技能池列表 */
    private _skillPool: ISkill[] = [];

    /** 玩家流派标签计数器 Map */
    private _tagCounts: Map<SkillTag, number> = new Map<SkillTag, number>();

    /** 流派共鸣规则配置表 */
    private readonly _resonanceConfigs: Record<SkillTag, IResonanceConfig[]> = {
        '体修': [
            {
                name: '金刚不坏身',
                threshold: 3,
                description: '体修功法初成，全物理减伤提升 30%，最大生命值增加 50%',
                effect: { damageReduction: 0.3, hpBonusRatio: 0.5 }
            },
            {
                name: '无上肉身',
                threshold: 5,
                description: '体修大成，获得霸体免控状态，受击时触发气血反弹',
                effect: { superArmor: 1, reflectRatio: 0.4 }
            }
        ],
        '法修': [
            {
                name: '万法归宗',
                threshold: 3,
                description: '法术融会贯通，法术伤害提高 50%，所有技能冷却缩减 20%',
                effect: { spellDamageBonusRatio: 0.5, cdReductionRatio: 0.2 }
            },
            {
                name: '天道法典',
                threshold: 5,
                description: '掌控天地法则，法术命中时附带天雷连击效果',
                effect: { lightningChainCount: 3, spellCritRateBonus: 0.3 }
            }
        ],
        '御兽': [
            {
                name: '百兽朝苍',
                threshold: 3,
                description: '御兽归心，所有灵兽全属性加成 60%，随从出战上限 +2',
                effect: { petAttributeBonusRatio: 0.6, extraPetLimit: 2 }
            },
            {
                name: '万兽降世',
                threshold: 5,
                description: '御兽巅峰，召唤兽群狂暴压制，并有概率召唤神兽领主助战',
                effect: { petFrenzy: 1, summonLordProb: 0.5 }
            }
        ]
    };

    onLoad() {
        this.initTagCounts();
        this.initSkillPool();
    }

    /**
     * 初始化流派标签计数
     */
    private initTagCounts() {
        this._tagCounts.set('体修', 0);
        this._tagCounts.set('法修', 0);
        this._tagCounts.set('御兽', 0);
    }

    /**
     * 初始化技能池，包含体修、法修、御兽三大流派的丰富技能（每流派4个）
     */
    private initSkillPool() {
        this._skillPool = [
            // ==================== 基础通用技能 ====================
            {
                id: 'basic_sword',
                name: '基础飞剑',
                description: '召唤一把飞剑自动攻击敌人，造成基础物理伤害',
                level: 0,
                maxLevel: 5,
                tag: '法修',
                icon: 'icon_basic_sword',
                effectValue: 15,
                effectType: 'physicalDamage'
            },
            {
                id: 'basic_shield',
                name: '基础护盾',
                description: '凝聚真气形成护盾，提升最大生命值并减免所受伤害',
                level: 0,
                maxLevel: 5,
                tag: '体修',
                icon: 'icon_basic_shield',
                effectValue: 50,
                effectType: 'maxHp'
            },
            {
                id: 'basic_summon',
                name: '基础召唤',
                description: '召唤一只低阶小妖协助战斗，分担敌人仇恨',
                level: 0,
                maxLevel: 5,
                tag: '御兽',
                icon: 'icon_basic_summon',
                effectValue: 1,
                effectType: 'summonWolf'
            },
            // ==================== 体修流派技能 ====================
            {
                id: 'tixiu_1',
                name: '金刚不坏',
                description: '锤炼肉身，大幅提升玩家基础生命上限与物理防御',
                level: 0,
                maxLevel: 5,
                tag: '体修',
                icon: 'icon_tixiu_1',
                effectValue: 20,
                effectType: 'maxHp'
            },
            {
                id: 'tixiu_2',
                name: '气血涌动',
                description: '体内气血如沸，提升每秒生命回复量与攻击吸血比例',
                level: 0,
                maxLevel: 5,
                tag: '体修',
                icon: 'icon_tixiu_2',
                effectValue: 15,
                effectType: 'hpRegen'
            },
            {
                id: 'tixiu_3',
                name: '巨力重击',
                description: '发劲如山，普通攻击额外造成击退效果与暴击伤害',
                level: 0,
                maxLevel: 5,
                tag: '体修',
                icon: 'icon_tixiu_3',
                effectValue: 25,
                effectType: 'physicalDamage'
            },
            {
                id: 'tixiu_4',
                name: '霸体护甲',
                description: '坚如磐石，降低所受到的伤害，并反弹受到的部分物理伤害',
                level: 0,
                maxLevel: 5,
                tag: '体修',
                icon: 'icon_tixiu_4',
                effectValue: 10,
                effectType: 'defense'
            },

            // ==================== 法修流派技能 ====================
            {
                id: 'faxiu_1',
                name: '掌心雷',
                description: '凝聚九天引雷之术，打击远距离敌人造成高额雷电伤害',
                level: 0,
                maxLevel: 5,
                tag: '法修',
                icon: 'icon_faxiu_1',
                effectValue: 30,
                effectType: 'lightningDamage'
            },
            {
                id: 'faxiu_2',
                name: '烈焰风暴',
                description: '在目标区域召唤烈焰龙卷，对范围内敌人造成持续灼烧伤害',
                level: 0,
                maxLevel: 5,
                tag: '法修',
                icon: 'icon_faxiu_2',
                effectValue: 40,
                effectType: 'fireAoE'
            },
            {
                id: 'faxiu_3',
                name: '冰霜守护',
                description: '周身环绕寒冰护盾，受到攻击时减速近身敌人',
                level: 0,
                maxLevel: 5,
                tag: '法修',
                icon: 'icon_faxiu_3',
                effectValue: 20,
                effectType: 'iceShield'
            },
            {
                id: 'faxiu_4',
                name: '灵力涌动',
                description: '沟通天地灵气，缩短所有法术技能的冷却时间并提升法伤',
                level: 0,
                maxLevel: 5,
                tag: '法修',
                icon: 'icon_faxiu_4',
                effectValue: 15,
                effectType: 'cdReduction'
            },

            // ==================== 御兽流派技能 ====================
            {
                id: 'yushou_1',
                name: '唤狼术',
                description: '召唤一只迅捷的灵狼协助作战，吸引敌人注意力',
                level: 0,
                maxLevel: 5,
                tag: '御兽',
                icon: 'icon_yushou_1',
                effectValue: 1,
                effectType: 'summonWolf'
            },
            {
                id: 'yushou_2',
                name: '兽王咆哮',
                description: '发出百兽威压，短时间内大幅提升所有召唤兽的攻击力与攻速',
                level: 0,
                maxLevel: 5,
                tag: '御兽',
                icon: 'icon_yushou_2',
                effectValue: 20,
                effectType: 'petBuff'
            },
            {
                id: 'yushou_3',
                name: '灵宠助战',
                description: '扩展驭兽空间，增加一个随从出战位，且灵宠继承主角属性',
                level: 0,
                maxLevel: 5,
                tag: '御兽',
                icon: 'icon_yushou_3',
                effectValue: 1,
                effectType: 'petCount'
            },
            {
                id: 'yushou_4',
                name: '狂暴烙印',
                description: '为灵宠施加狂暴印记，使其攻击附带撕裂流血与暴击效果',
                level: 0,
                maxLevel: 5,
                tag: '御兽',
                icon: 'icon_yushou_4',
                effectValue: 25,
                effectType: 'petCrit'
            }
        ];
    }

    /**
     * 随机抽取指定数量未满级的技能 (Roguelike 3选1)
     * 具备流派倾斜加权与全满级保底逻辑
     * @param count 抽取技能数量，默认为 3
     * @returns 随机抽取的不重复技能数组
     */
    public getRandomSkills(count: number = 3): ISkill[] {
        // 筛选出 level < maxLevel 的可升级技能
        const availableSkills = this._skillPool.filter(skill => skill.level < skill.maxLevel);

        // 如果可抽技能少于或等于请求数量，直接返回所有可用技能
        if (availableSkills.length <= count) {
            return availableSkills.map(skill => ({ ...skill }));
        }

        const candidates = [...availableSkills];
        const selectedSkills: ISkill[] = [];

        // 计算当前玩家各流派权重加成 (主修流派获得 1.5x 抽取权重)
        const getWeight = (skill: ISkill) => {
            const count = this.getTagCount(skill.tag);
            return 1.0 + count * 0.5;
        };

        for (let i = 0; i < count; i++) {
            if (candidates.length === 0) break;

            let totalWeight = 0;
            candidates.forEach(skill => {
                totalWeight += getWeight(skill);
            });

            let randomVal = Math.random() * totalWeight;
            let chosenIndex = 0;

            for (let j = 0; j < candidates.length; j++) {
                const weight = getWeight(candidates[j]);
                if (randomVal <= weight) {
                    chosenIndex = j;
                    break;
                }
                randomVal -= weight;
            }

            const chosen = candidates.splice(chosenIndex, 1)[0];
            selectedSkills.push({ ...chosen });
        }

        return selectedSkills;
    }

    /**
     * 玩家选择/学习指定 ID 的技能
     * 被选择后对应技能等级 level + 1，且对应的流派标签计数 +1
     * @param skillId 技能唯一标识 ID
     * @returns 选择是否成功
     */
    public selectSkill(skillId: string): boolean {
        const skill = this._skillPool.find(s => s.id === skillId);
        if (!skill) {
            console.warn(`[SkillPoolManager] 找不到 ID 为 ${skillId} 的技能`);
            return false;
        }

        if (skill.level >= skill.maxLevel) {
            console.warn(`[SkillPoolManager] 技能 ${skill.name} (${skillId}) 已达到最大等级 ${skill.maxLevel}`);
            return false;
        }

        // 技能等级 + 1
        skill.level += 1;

        // 对应流派标签计数 + 1
        const currentCount = this._tagCounts.get(skill.tag) || 0;
        const newCount = currentCount + 1;
        this._tagCounts.set(skill.tag, newCount);

        console.log(`[SkillPoolManager] 成功升级技能: ${skill.name} (Lv.${skill.level}/${skill.maxLevel}), 流派【${skill.tag}】累计: ${newCount}`);

        // 检查是否触发最新共鸣
        const resonanceResult = this.checkResonance(skill.tag);
        if (resonanceResult.isTriggered) {
            console.log(`[SkillPoolManager] 流派【${skill.tag}】触发共鸣终极技:`, resonanceResult.activeResonances);
        }

        return true;
    }

    /**
     * 检查某个流派的共鸣（终极技）是否激活
     * @param tag 流派标签 ('体修' | '法修' | '御兽')
     * @param requiredCount 所需标签阈值，默认为 3
     * @returns 是否已激活该门槛共鸣
     */
    public isResonanceActive(tag: string, requiredCount: number = 3): boolean {
        const count = this.getTagCount(tag);
        return count >= requiredCount;
    }

    /**
     * 触发“流派共鸣（终极技）”的检测接口
     * @param tag 可选参数。若传入则仅检测指定流派；若不传则检测所有三大流派。
     * @returns 共鸣检测结果，包含是否触发、已生效的共鸣技能名称数组以及详细数据
     */
    public checkResonance(tag?: SkillTag): {
        isTriggered: boolean;
        activeResonances: string[];
        details: Record<string, {
            count: number;
            resonances: IResonanceConfig[];
        }>;
    } {
        const activeResonances: string[] = [];
        const details: Record<string, { count: number; resonances: IResonanceConfig[] }> = {};

        const tagsToCheck: SkillTag[] = tag ? [tag] : ['体修', '法修', '御兽'];

        for (const currentTag of tagsToCheck) {
            const count = this.getTagCount(currentTag);
            const configs = this._resonanceConfigs[currentTag] || [];
            const activeConfigs: IResonanceConfig[] = [];

            for (const cfg of configs) {
                if (count >= cfg.threshold) {
                    activeResonances.push(cfg.name);
                    activeConfigs.push(cfg);
                }
            }

            details[currentTag] = {
                count: count,
                resonances: activeConfigs
            };
        }

        return {
            isTriggered: activeResonances.length > 0,
            activeResonances: activeResonances,
            details: details
        };
    }

    /**
     * 获取指定流派标签的数量
     * @param tag 流派标签名称
     * @returns 当前已获得的标签数量
     */
    public getTagCount(tag: string): number {
        return this._tagCounts.get(tag as SkillTag) || 0;
    }

    /**
     * 获取体修流派标签数量
     */
    public get tiXiuCount(): number {
        return this.getTagCount('体修');
    }

    /**
     * 获取法修流派标签数量
     */
    public get faXiuCount(): number {
        return this.getTagCount('法修');
    }

    /**
     * 获取御兽流派标签数量
     */
    public get yuShouCount(): number {
        return this.getTagCount('御兽');
    }

    /**
     * 获取流派标签计数 Map 副本
     */
    public get tagCounts(): Map<string, number> {
        return new Map(this._tagCounts);
    }

    /**
     * 获取完整的技能池列表副本
     */
    public getAllSkills(): ISkill[] {
        return this._skillPool.map(skill => ({ ...skill }));
    }

    /**
     * 获取玩家已选/已升级的所有技能列表
     */
    public getLearnedSkills(): ISkill[] {
        return this._skillPool
            .filter(skill => skill.level > 0)
            .map(skill => ({ ...skill }));
    }

    /**
     * 根据 ID 获取技能数据
     * @param skillId 技能 ID
     */
    public getSkillById(skillId: string): ISkill | null {
        const skill = this._skillPool.find(s => s.id === skillId);
        return skill ? { ...skill } : null;
    }

    /**
     * 重置技能池状态与流派标签计数 (供重新开局或重置时使用)
     */
    public resetSkillPool() {
        for (const skill of this._skillPool) {
            skill.level = 0;
        }
        this.initTagCounts();
        console.log('[SkillPoolManager] 技能池与流派标签计数已重置');
    }
}
