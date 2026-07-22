import { _decorator, Component, JsonAsset, resources, error, log, Prefab, instantiate, Node, director, Layers } from 'cc';
import { PoolManager } from './Manager/PoolManager';
import { Enemy } from './Logic/Enemy';
import { EventManager, CombatEvent } from './Manager/EventManager';
import { GameManager } from './Manager/GameManager';
import { DialogueSystem } from './DialogueSystem';
const { ccclass, property } = _decorator;

/** 掉落配置接口 */
export interface IDropConfig {
    spirit_stones?: number;
    materials?: number;
    drop_chest?: boolean;
}

/** 单组怪物刷怪配置接口 */
export interface IMonsterGroupConfig {
    monster_id: string;
    spawn_count: number;
    base_hp: number;
    attack_damage: number;
    move_speed: number;
    exp_value?: number;
    spawn_interval?: number;
    is_elite?: boolean;
    drop_config?: IDropConfig;
}

/** 波次数据接口 (兼容嵌套与旧扁平格式) */
export interface IWaveConfig {
    wave_index?: number;
    spawn_time: number;
    monster_groups?: IMonsterGroupConfig[];

    // 兼容旧格式一维扁平属性
    monster_id?: string;
    spawn_count?: number;
    base_hp?: number;
    attack_damage?: number;
    move_speed?: number;
    exp_value?: number;
    is_elite?: boolean;
    drop_config?: IDropConfig;
}

/** 关卡配置完整接口定义 */
export interface ILevelConfig {
    level_id?: string;
    level_name?: string;
    waves: IWaveConfig[];
}

@ccclass('LevelManager')
export class LevelManager extends Component {

    private static _instance: LevelManager | null = null;

    /** 单例访问接口 */
    public static get instance(): LevelManager | null {
        return LevelManager._instance;
    }

    @property({ type: Prefab })
    public monsterPrefab: Prefab | null = null;
    
    @property({ type: Node })
    public monsterRoot: Node | null = null;

    /** 记录当前游戏经过的时间（秒） */
    private gameTime: number = 0;
    
    /** 所有波次数据 */
    private wavesData: IWaveConfig[] = [];
    
    /** 已经生成过的波次索引，避免重复生成 */
    private spawnedWaves: Set<number> = new Set();

    private get wavesSet(): Set<number> {
        if (!this.spawnedWaves) {
            this.spawnedWaves = new Set<number>();
        }
        return this.spawnedWaves;
    }

    /** 游戏是否开始 */
    private isPlaying: boolean = false;

    /** 当前关卡 ID */
    private currentLevelId: string = '';

    /** 维护全局活怪计数 */
    private activeEnemyCount: number = 0;

    onLoad() {
        if (!this.spawnedWaves) {
            this.spawnedWaves = new Set<number>();
        }
        if (LevelManager._instance === null) {
            LevelManager._instance = this;
        } else if (LevelManager._instance !== this) {
            this.node.destroy();
            return;
        }
    }

    onEnable() {
        // 统一使用 EventManager 订阅怪物死亡事件，避免 director 通道重复监听导致活怪计数双倍扣减
        EventManager.on(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
    }

    onDisable() {
        EventManager.off(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
    }

    onDestroy() {
        if (LevelManager._instance === this) {
            LevelManager._instance = null;
        }
        this.onDisable();
    }

    start() {
        // 移除 start 内隐式自动加载，等待 GameManager 显式调用 loadLevelConfig
    }

    /**
     * 动态异步加载关卡配置文件
     * @param levelId 关卡ID (如 'Level_1')
     * @param onComplete 加载完成回调
     */
    public loadLevelConfig(levelId: string, onComplete?: (success: boolean) => void) {
        this.currentLevelId = levelId;
        const configPath = `Configs/${levelId}_Waves`;
        log(`[LevelManager] 开始动态加载关卡配置: ${configPath}`);

        resources.load(configPath, JsonAsset, (err, jsonAsset: JsonAsset) => {
            if (err) {
                error(`[LevelManager] 加载关卡配置失败 [${configPath}]: `, err);
                if (onComplete) onComplete(false);
                return;
            }

            if (!jsonAsset || !jsonAsset.json) {
                error(`[LevelManager] 关卡配置文件内容为空 [${configPath}]`);
                if (onComplete) onComplete(false);
                return;
            }

            // 校验与向后兼容解析
            const rawJson = jsonAsset.json;
            let loadedWaves: IWaveConfig[] = [];

            if (Array.isArray(rawJson)) {
                // 兼容旧版扁平 Array
                loadedWaves = rawJson.map((item: any) => ({
                    spawn_time: item.spawn_time || 0,
                    monster_groups: [{
                        monster_id: item.monster_id || 'mob_grass_sprite',
                        spawn_count: item.spawn_count || 1,
                        base_hp: item.base_hp || 50,
                        attack_damage: item.attack_damage || 10,
                        move_speed: item.move_speed || 100,
                        exp_value: item.exp_value || 10,
                        is_elite: item.is_elite || false,
                        drop_config: item.drop_config
                    }]
                }));
            } else if (typeof rawJson === 'object' && rawJson !== null && Array.isArray((rawJson as any).waves)) {
                // 标准 Meta -> Waves -> MonsterGroups 规范
                loadedWaves = (rawJson as any).waves as IWaveConfig[];
            } else {
                error(`[LevelManager] 关卡配置 JSON 格式非法: ${configPath}`);
                if (onComplete) onComplete(false);
                return;
            }

            // 注入内存
            this.setWaveData(loadedWaves);
            log(`[LevelManager] 关卡配置 [${levelId}] 加载成功，共 ${this.wavesData.length} 波数据。`);

            if (onComplete) {
                onComplete(true);
            }
        });
    }

    /**
     * 注入波次配置数据
     * @param waves 波次数据数组
     */
    public setWaveData(waves: IWaveConfig[]) {
        this.wavesData = waves || [];
    }

    /**
     * 开始游戏计时
     */
    public startGame() {
        this.gameTime = 0;
        this.wavesSet.clear();
        this.activeEnemyCount = 0;
        this.isPlaying = true;

        // 预热对象池
        if (this.monsterPrefab && PoolManager.instance) {
            PoolManager.instance.prewarm(this.monsterPrefab, 10);
        }

        log(`[LevelManager] 关卡 [${this.currentLevelId}] 刷怪逻辑启动，计时开始。`);
    }

    /**
     * 重置关卡刷怪与计时数据
     */
    public resetLevel() {
        this.isPlaying = false;
        this.gameTime = 0;
        this.wavesSet.clear();
        this.activeEnemyCount = 0;
        log('[LevelManager] 关卡数据已重置，停止刷怪与计时。');
    }

    update(deltaTime: number) {
        if (!this.isPlaying) return;
        if (GameManager.instance && GameManager.instance.isBattleFrozen) return;

        // 累加游戏时间
        this.gameTime += deltaTime;

        this.checkSpawns();
        this.checkVictory();
    }

    /**
     * 检查并执行刷怪逻辑
     */
    private checkSpawns() {
        for (let i = 0; i < this.wavesData.length; i++) {
            const wave = this.wavesData[i];
            
            // 如果到达了生成时间，且该波次还未生成
            if (this.gameTime >= wave.spawn_time && !this.wavesSet.has(i)) {
                this.spawnWave(wave);
                this.wavesSet.add(i);
            }
        }
    }

    /**
     * 生成整波怪物的逻辑
     * @param wave 波次数据
     */
    private spawnWave(wave: IWaveConfig) {
        log(`[刷怪波次触发] 时间: ${wave.spawn_time}s | 波次索引: ${wave.wave_index || 0}`);

        // 如果存在 monster_groups 包含多组怪物
        if (wave.monster_groups && wave.monster_groups.length > 0) {
            for (const group of wave.monster_groups) {
                this.spawnMonsterGroup(group, wave.spawn_time);
            }
        } else if (wave.monster_id) {
            // 兼容一维扁平格式
            const fallbackGroup: IMonsterGroupConfig = {
                monster_id: wave.monster_id,
                spawn_count: wave.spawn_count || 1,
                base_hp: wave.base_hp || 50,
                attack_damage: wave.attack_damage || 10,
                move_speed: wave.move_speed || 100,
                exp_value: wave.exp_value || 10,
                is_elite: wave.is_elite || false,
                drop_config: wave.drop_config
            };
            this.spawnMonsterGroup(fallbackGroup, wave.spawn_time);
        }
    }

    /**
     * 生成具体怪物组
     * @param group 怪物组数据
     * @param spawnTime 刷怪时间
     */
    private spawnMonsterGroup(group: IMonsterGroupConfig, spawnTime: number) {
        log(`[刷怪] 时间: ${spawnTime}s | 怪物ID: ${group.monster_id} | 数量: ${group.spawn_count} | HP: ${group.base_hp} | ATK: ${group.attack_damage} | Speed: ${group.move_speed} | 精英: ${group.is_elite ? '是' : '否'}`);
        
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const parentNode = this.monsterRoot || canvas?.getChildByName('EnemyLayer') || canvas || this.node;
        
        // 确保父节点为 UI_2D 层级
        if (!parentNode.layer || parentNode.layer === Layers.Enum.DEFAULT) {
            parentNode.layer = Layers.Enum.UI_2D;
        }

        const texturePath = group.monster_id ? `Textures/Enemies/${group.monster_id}` : 'Textures/Enemies/monster_1';
        
        for (let i = 0; i < group.spawn_count; i++) {
            let monster: Node;
            if (this.monsterPrefab) {
                if (PoolManager.instance) {
                    monster = PoolManager.instance.getNode(this.monsterPrefab);
                } else {
                    monster = instantiate(this.monsterPrefab);
                }
            } else {
                // 如果没有预制体，纯代码动态生成 Node
                monster = new Node(`DynamicMonster_${group.monster_id}_${i}`);
                
                // 挂载 Enemy 逻辑脚本
                if (Enemy && !monster.getComponent(Enemy)) {
                    monster.addComponent(Enemy);
                }
            }

            monster.layer = parentNode.layer || Layers.Enum.UI_2D;
            monster.setParent(parentNode);
            monster.name = `${group.monster_id}_${i}`;
            
            // 随机环形/矩形位置
            const randomX = (Math.random() - 0.5) * 500;
            const randomY = (Math.random() - 0.5) * 500;
            monster.setPosition(randomX, randomY, 0);
            
            // 初始化 Enemy 组件的所有攻防速与精英怪特质参数
            const enemyComp = monster.getComponent(Enemy) || monster.getComponent('Enemy');
            if (enemyComp && typeof (enemyComp as any).init === 'function') {
                (enemyComp as any).init(
                    group.base_hp,
                    group.move_speed,
                    undefined,
                    texturePath,
                    group.attack_damage,
                    group.exp_value,
                    group.is_elite,
                    group.drop_config
                );
            }

            // 维护全局活怪计数
            this.activeEnemyCount++;
        }

        // 精英怪刷出新手抓捕剧情触发
        if (group.is_elite) {
            const hasPlayedCatch = localStorage.getItem('played_tutorial_catch_elite') === 'true';
            if (!hasPlayedCatch) {
                localStorage.setItem('played_tutorial_catch_elite', 'true');
                if (DialogueSystem.instance) {
                    DialogueSystem.instance.triggerDialogue('Tutorial_Catch');
                }
            }
        }
    }

    private hasTriggeredFirstKill: boolean = false;

    /**
     * 敌人死亡事件响应
     */
    private onEnemyDied() {
        if (!this.isPlaying) return;
        this.activeEnemyCount = Math.max(0, this.activeEnemyCount - 1);
        log(`[LevelManager] 捕获敌人死亡，剩余活怪计数: ${this.activeEnemyCount}`);

        // 首次击杀新手引导触发
        if (!this.hasTriggeredFirstKill) {
            const hasPlayedKill = localStorage.getItem('played_tutorial_first_kill') === 'true';
            if (!hasPlayedKill) {
                this.hasTriggeredFirstKill = true;
                localStorage.setItem('played_tutorial_first_kill', 'true');
                if (DialogueSystem.instance) {
                    DialogueSystem.instance.triggerDialogue('First_Monster_Kill');
                }
            }
        }

        this.checkVictory();
    }

    /**
     * 关卡通关胜负判定机制
     * 当所有波次已刷完且场上活跃怪物全部清零时，自动调用 GameManager.instance.endGame(true) 触发通关胜利结算流程
     */
    private checkVictory() {
        if (!this.isPlaying) return;

        // 判定所有波次是否都已经生成完毕
        const allWavesSpawned = this.wavesData.length > 0 && this.wavesSet.size >= this.wavesData.length;

        // 防御性校验活怪计数与场景节点树真实 Enemy 数量
        const realEnemyCount = this.getRealActiveEnemyCount();
        if (allWavesSpawned && (this.activeEnemyCount <= 0 || realEnemyCount === 0)) {
            log('[LevelManager] 所有波次已刷完且场上活跃怪物全部清零！自动触发通关胜利结算流程！');
            this.isPlaying = false;
            if (GameManager.instance) {
                GameManager.instance.endGame(true);
            }
        }
    }

    /**
     * 获取场景中真实存活的 Enemy 节点数量
     */
    private getRealActiveEnemyCount(): number {
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const parentNode = this.monsterRoot || canvas?.getChildByName('EnemyLayer') || canvas || this.node;
        if (!parentNode) return 0;
        let count = 0;
        for (const child of parentNode.children) {
            if (child.active) {
                const enemy = child.getComponent(Enemy) || child.getComponent('Enemy');
                if (enemy) {
                    count++;
                }
            }
        }
        return count;
    }
}

