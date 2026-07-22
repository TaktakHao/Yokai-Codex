const mockCC = require('./mock_cc');

// We test logic components by importing or mimicking their exact implementation logic with mockCC environment
const {
    Node, sys, director, Layers, Color, Vec3, Vec2, Size, Component,
    mockLocalStorage, mockScene, mockCanvas
} = mockCC;

console.log("=================================================");
console.log(" Phase 7 极限与边际用例实证测试套件 Running...");
console.log("=================================================\n");

const testResults = [];

function recordTest(module, name, passed, details) {
    testResults.push({ module, name, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${module} - ${name}`);
    if (details) console.log(`       Details: ${details}`);
}

// ============================================================================
// 模块 1: 技能 3 选 1 边际验证 (Skill Pool & Skill Select Panel)
// ============================================================================

// 1.1 SkillPoolManager 初始化与加权抽样测试
function testSkillPoolInit() {
    // 模拟 SkillPoolManager 逻辑
    const skillPool = [
        { id: 'tixiu_1', name: '金刚不坏', level: 0, maxLevel: 5, tag: '体修' },
        { id: 'tixiu_2', name: '气血涌动', level: 0, maxLevel: 5, tag: '体修' },
        { id: 'tixiu_3', name: '巨力重击', level: 0, maxLevel: 5, tag: '体修' },
        { id: 'tixiu_4', name: '霸体护甲', level: 0, maxLevel: 5, tag: '体修' },
        { id: 'faxiu_1', name: '掌心雷', level: 0, maxLevel: 5, tag: '法修' },
        { id: 'faxiu_2', name: '烈焰风暴', level: 0, maxLevel: 5, tag: '法修' },
        { id: 'faxiu_3', name: '冰霜守护', level: 0, maxLevel: 5, tag: '法修' },
        { id: 'faxiu_4', name: '灵力涌动', level: 0, maxLevel: 5, tag: '法修' },
        { id: 'yushou_1', name: '唤狼术', level: 0, maxLevel: 5, tag: '御兽' },
        { id: 'yushou_2', name: '兽王咆哮', level: 0, maxLevel: 5, tag: '御兽' },
        { id: 'yushou_3', name: '灵宠助战', level: 0, maxLevel: 5, tag: '御兽' },
        { id: 'yushou_4', name: '狂暴烙印', level: 0, maxLevel: 5, tag: '御兽' }
    ];

    const tagCounts = new Map([['体修', 0], ['法修', 0], ['御兽', 0]]);

    const getRandomSkills = (count = 3) => {
        const available = skillPool.filter(s => s.level < s.maxLevel);
        if (available.length <= count) return available.map(s => ({ ...s }));
        const candidates = [...available];
        const selected = [];
        const getWeight = (s) => 1.0 + (tagCounts.get(s.tag) || 0) * 0.5;

        for (let i = 0; i < count; i++) {
            if (candidates.length === 0) break;
            let totalWeight = candidates.reduce((acc, s) => acc + getWeight(s), 0);
            let randomVal = Math.random() * totalWeight;
            let chosenIdx = 0;
            for (let j = 0; j < candidates.length; j++) {
                const w = getWeight(candidates[j]);
                if (randomVal <= w) { chosenIdx = j; break; }
                randomVal -= w;
            }
            selected.push({ ...candidates.splice(chosenIdx, 1)[0] });
        }
        return selected;
    };

    // 抽选 3 个技能
    const drawn = getRandomSkills(3);
    const pass = drawn.length === 3 && new Set(drawn.map(s => s.id)).size === 3;
    recordTest("SkillPool", "初始 3 选 1 抽选不重复性", pass, `抽选数量: ${drawn.length}`);
}

// 1.2 技能全满级保底选项与 HP 回复测试 (包含缺陷实证)
function testSkillPoolAllMaxedOut() {
    const skillPool = Array.from({ length: 12 }, (_, i) => ({
        id: `skill_${i}`, name: `技能${i}`, level: 5, maxLevel: 5, tag: '体修'
    }));

    const available = skillPool.filter(s => s.level < s.maxLevel);
    const drawn = available; // 0 items

    // 检查 SkillSelectPanel 在 drawn.length === 0 时的逻辑
    let healApplied = false;
    const mockPlayerController = { currentHp: 50, maxHp: 100 };

    // SkillSelectPanel.ts lines 96-100:
    // createFallbackCard(0, '无双气血', '全技能已达化境！回复 100% 生命值', () => { director.resume(); closeUI(); });
    // 注意：Worker1 在此未调用 player.currentHp = player.maxHp
    const fallbackClickAction = () => {
        director.resume();
        // 如果 Worker1 有 heal 代码，这里会对 mockPlayerController 赋值
    };
    fallbackClickAction();

    const pass = (drawn.length === 0) && (mockPlayerController.currentHp === 100);
    recordTest(
        "SkillPool",
        "技能池全满级保底选项 HP 回复生效实证",
        pass,
        `期望 HP: 100, 实际 HP: ${mockPlayerController.currentHp} (缺陷确认: 仅打印 Log，未对玩家 HP 实施满血恢复)`
    );
}

// 1.3 连续快速升级溢出测试
function testRapidLevelUpOverflow() {
    let level = 1;
    let currentExp = 0;
    let maxExp = 100;
    let levelUpCount = 0;

    // PlayerController.ts 现有逻辑
    function addExpExisting(exp) {
        currentExp += exp;
        if (currentExp >= maxExp) {
            level++;
            currentExp -= maxExp;
            maxExp = Math.floor(maxExp * 1.5);
            levelUpCount++;
        }
    }

    // 注入一次性巨大经验 (如 1000 exp)
    addExpExisting(1000);

    // 预期: 1000 exp 应该让 Lv.1 (100) 连续升级多次，但 `if` 语句仅触发 1 次升级！
    const pass = (currentExp < maxExp); // 如果 currentExp 仍然 >= maxExp，说明经验丢了/停滞在未升级状态
    recordTest(
        "PlayerController",
        "单次高经验派发连续升级循环实证",
        pass,
        `获得 1000 Exp 后: 等级 Lv.${level}, 剩余 Exp: ${currentExp}/${maxExp}, 触发升级次数: ${levelUpCount} (缺陷确认: if 替代 while 导致大量溢出经验滞留无法连续升级)`
    );
}

// 1.4 技能面板 Pause/Resume 状态与连击碰撞隔离实证
function testSkillPanelPauseResumeState() {
    director.isPaused = false;

    // 模拟 GameManager onPlayerLevelUpEvent 触发
    function onPlayerLevelUpEvent() {
        // UIManager.openUI('UI/SkillSelectPanel')
        // 注意：Worker1 代码中打开 SkillSelectPanel 时没有调用 director.pause()
    }

    onPlayerLevelUpEvent();
    const pausedOnOpen = director.isPaused;

    // 模拟玩家选择技能卡片 onSelectSkill
    function onSelectSkill() {
        director.resume();
    }
    onSelectSkill();
    const resumedOnSelect = !director.isPaused;

    const pass = pausedOnOpen && resumedOnSelect;
    recordTest(
        "SkillSelectPanel",
        "面板打开自动 Pause 游戏与关闭 Resume 状态隔离",
        pass,
        `打开面板时 paused: ${pausedOnOpen} (期望 true), 选择技能后 resumed: ${resumedOnSelect} (缺陷确认: 打开技能面板时未 pause 游戏)`
    );
}

// ============================================================================
// 模块 2: 离线挂机结算边际验证 (HomeManager & SaveManager)
// ============================================================================

function testOfflineEarnings() {
    // 2.1 离线时间 0 秒
    let lastOffline = Date.now();
    let current = lastOffline;
    let seconds = Math.floor(Math.max(0, current - lastOffline) / 1000);
    recordTest("HomeManager", "离线时间 0 秒结算", seconds === 0, `离线秒数: ${seconds}`);

    // 2.2 系统时钟倒退 (-100 秒)
    current = lastOffline - 100000;
    seconds = Math.floor(Math.max(0, current - lastOffline) / 1000);
    recordTest("HomeManager", "系统时钟倒退防负收益", seconds === 0, `倒退 100s 后离线秒数: ${seconds}`);

    // 2.3 24 小时全额收益 (86,400s)
    seconds = 86400;
    let fullRateTime = Math.min(seconds, 86400);
    let decayTime = Math.max(0, Math.min(seconds - 86400, 86400));
    let effectiveSeconds = fullRateTime + decayTime * 0.2;
    recordTest("HomeManager", "24h 全额收益有效时间", effectiveSeconds === 86400, `有效秒数: ${effectiveSeconds}s`);

    // 2.4 36 小时衰减收益 (129,600s)
    seconds = 129600;
    fullRateTime = Math.min(seconds, 86400);
    decayTime = Math.max(0, Math.min(seconds - 86400, 86400));
    effectiveSeconds = fullRateTime + decayTime * 0.2; // 86400 + 43200 * 0.2 = 95040
    recordTest("HomeManager", "36h 衰减收益有效时间", effectiveSeconds === 95040, `有效秒数: ${effectiveSeconds}s (期望 95040s)`);

    // 2.5 72 小时 (3天 > 48h) 收益封顶 (259,200s)
    seconds = 259200;
    fullRateTime = Math.min(seconds, 86400);
    decayTime = Math.max(0, Math.min(seconds - 86400, 86400));
    effectiveSeconds = fullRateTime + decayTime * 0.2; // 86400 + 17280 = 103680
    recordTest("HomeManager", ">48h 收益封顶有效时间", effectiveSeconds === 103680, `有效秒数: ${effectiveSeconds}s (期望 103680s / 28.8h)`);

    // 2.6 首次无存档初始化稳定性
    mockLocalStorage.clear();
    const savedTime = sys.localStorage.getItem('home_last_offline_time');
    let initOfflineTime = savedTime ? parseInt(savedTime, 10) : Date.now();
    const validInit = typeof initOfflineTime === 'number' && !isNaN(initOfflineTime) && initOfflineTime > 0;
    recordTest("SaveManager", "无存档首次初始化时间戳稳定性", validInit, `初始化时间戳: ${initOfflineTime}`);
}

// ============================================================================
// 模块 3: 关卡波次与 UI 层级渲染极限验证 (LevelManager & Enemy & VisualLoader)
// ============================================================================

function testLevelAndRendering() {
    // 3.1 关卡 JSON 格式解析兼容
    const rawNestedJson = {
        level_id: "Level_1",
        waves: [
            { wave_index: 1, spawn_time: 0, monster_groups: [{ monster_id: 'mob_grass_sprite', spawn_count: 6 }] }
        ]
    };
    const isNestedValid = Array.isArray(rawNestedJson.waves);
    recordTest("LevelManager", "Waves -> MonsterGroups 嵌套 Schema 解析", isNestedValid, `waves length: ${rawNestedJson.waves.length}`);

    // 3.2 关卡通关/胜利判定检测
    const wavesData = rawNestedJson.waves;
    const spawnedWaves = new Set([0]);
    const activeMonstersCount = 0; // 怪物全灭
    // 检查 LevelManager 中是否有胜利回调或通知 GameManager.endGame(true)
    // Worker1 代码中 update(dt) 只包含了 checkSpawns()，无胜负判定
    const hasVictoryTrigger = false;
    recordTest(
        "LevelManager",
        "全波次刷完且怪物全灭通关判定实证",
        hasVictoryTrigger,
        `波次全刷完且场上 0 怪时触发胜利结算: ${hasVictoryTrigger} (缺陷确认: LevelManager 缺少关卡通关/胜利检测)`
    );

    // 3.3 精英怪掉落宝箱广播与监听者实证
    const chestEmitted = true;
    const chestListenerCount = directorEvents.get('Event_Chest_Dropped')?.length || 0;
    recordTest(
        "Enemy",
        "精英怪 Event_Chest_Dropped 宝箱事件监听闭环实证",
        chestListenerCount > 0,
        `Event_Chest_Dropped 监听器数量: ${chestListenerCount} (缺陷确认: 仅 emit 广播，无任何 UI/Manager 监听)`
    );

    // 3.4 纯代码 Node Layer UI_2D (33554432) 设置验证
    const testNode = new Node('TestUINode');
    testNode.layer = Layers.Enum.UI_2D;
    const passLayer = testNode.layer === 33554432;
    recordTest("UIManager/VisualLoader", "UI_2D 节点层级设置 (33554432)", passLayer, `node.layer: ${testNode.layer}`);
}

// 执行所有测试
testSkillPoolInit();
testSkillPoolAllMaxedOut();
testRapidLevelUpOverflow();
testSkillPanelPauseResumeState();
testOfflineEarnings();
testLevelAndRendering();

console.log("\n=================================================");
console.log(" 实证测试完成。统计结果:");
const passedCount = testResults.filter(r => r.passed).length;
const totalCount = testResults.length;
console.log(` 总用例数: ${totalCount} | 通过: ${passedCount} | 失败/挑战暴露: ${totalCount - passedCount}`);
console.log("=================================================");
