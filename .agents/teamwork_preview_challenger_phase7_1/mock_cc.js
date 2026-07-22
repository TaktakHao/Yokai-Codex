// Mock Cocos Creator ('cc') environment for Node.js empirical testing
class Node {
    constructor(name = 'Node') {
        this.name = name;
        this.layer = 1073741824; // DEFAULT layer
        this.active = true;
        this.children = [];
        this.parent = null;
        this.components = new Map();
        this.position = { x: 0, y: 0, z: 0 };
        this.worldPosition = { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) };
        this.isValid = true;
        this.listeners = new Map();
    }

    addComponent(compClass) {
        let comp;
        if (typeof compClass === 'function') {
            comp = new compClass();
        } else {
            comp = { __name: compClass };
        }
        comp.node = this;
        this.components.set(compClass, comp);
        if (comp.onLoad) comp.onLoad();
        if (comp.onEnable) comp.onEnable();
        return comp;
    }

    getComponent(compClass) {
        if (this.components.has(compClass)) return this.components.get(compClass);
        for (let [k, v] of this.components.entries()) {
            if (typeof compClass === 'string' && (k.name === compClass || v.__name === compClass)) return v;
        }
        return null;
    }

    getChildByName(name) {
        return this.children.find(c => c.name === name) || null;
    }

    setParent(parent) {
        if (this.parent) {
            const idx = this.parent.children.indexOf(this);
            if (idx >= 0) this.parent.children.splice(idx, 1);
        }
        this.parent = parent;
        if (parent) parent.children.push(this);
    }

    setPosition(x, y, z) {
        this.position = { x, y, z };
    }

    setWorldPosition(pos) {
        this.worldPosition = pos;
    }

    setScale(s) {
        this.scale = s;
    }

    removeAllChildren() {
        this.children.forEach(c => c.parent = null);
        this.children = [];
    }

    destroy() {
        this.isValid = false;
        if (this.parent) {
            const idx = this.parent.children.indexOf(this);
            if (idx >= 0) this.parent.children.splice(idx, 1);
        }
    }

    on(event, callback, target) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push({ callback, target });
    }

    emit(event, ...args) {
        const list = this.listeners.get(event) || [];
        list.forEach(item => item.callback.apply(item.target, args));
    }

    getComponentInChildren(compClass) {
        const found = this.getComponent(compClass);
        if (found) return found;
        for (let child of this.children) {
            const res = child.getComponentInChildren(compClass);
            if (res) return res;
        }
        return null;
    }

    setSiblingIndex(idx) {}
}

const mockLocalStorage = {
    _data: {},
    getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

const directorEvents = new Map();
const director = {
    isPaused: false,
    pause() { this.isPaused = true; },
    resume() { this.isPaused = false; },
    getScene() { return mockScene; },
    addPersistRootNode(n) {},
    on(evt, cb, target) {
        if (!directorEvents.has(evt)) directorEvents.set(evt, []);
        directorEvents.get(evt).push({ cb, target });
    },
    off(evt, cb, target) {
        if (!directorEvents.has(evt)) return;
        const list = directorEvents.get(evt).filter(item => item.cb !== cb);
        directorEvents.set(evt, list);
    },
    emit(evt, ...args) {
        const list = directorEvents.get(evt) || [];
        list.forEach(item => item.cb.apply(item.target, args));
    }
};

const mockScene = new Node('Scene');
const mockCanvas = new Node('Canvas');
mockCanvas.setParent(mockScene);
const mockEnemyLayer = new Node('EnemyLayer');
mockEnemyLayer.setParent(mockCanvas);
const mockUILayer = new Node('UILayer');
mockUILayer.setParent(mockCanvas);

const sys = {
    localStorage: mockLocalStorage
};

const Layers = {
    Enum: {
        DEFAULT: 1073741824,
        UI_2D: 33554432
    }
};

class Color {
    constructor(r=255, g=255, b=255, a=255) { this.r=r; this.g=g; this.b=b; this.a=a; }
    static WHITE = new Color(255,255,255,255);
}

class Vec3 {
    constructor(x=0, y=0, z=0) { this.x=x; this.y=y; this.z=z; }
    lengthSqr() { return this.x*this.x + this.y*this.y + this.z*this.z; }
    length() { return Math.sqrt(this.lengthSqr()); }
    clone() { return new Vec3(this.x, this.y, this.z); }
    normalize() { return this; }
    set(x,y,z) { this.x=x; this.y=y; this.z=z; }
    static distance(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z||0) - (b.z||0);
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
    }
    static multiplyScalar(out, a, b) { out.x = a.x*b; out.y = a.y*b; out.z = a.z*b; return out; }
    static add(out, a, b) { out.x = a.x+b.x; out.y = a.y+b.y; out.z = a.z+b.z; return out; }
    static subtract(out, a, b) { out.x = a.x-b.x; out.y = a.y-b.y; out.z = a.z-b.z; return out; }
}

class Vec2 {
    constructor(x=0, y=0) { this.x=x; this.y=y; }
    length() { return Math.sqrt(this.x*this.x + this.y*this.y); }
    normalize() { return this; }
    multiplyScalar(s) { this.x*=s; this.y*=s; return this; }
}

class Size {
    constructor(width=0, height=0) { this.width=width; this.height=height; }
}

class Component {
    constructor() { this.node = null; }
}

class UITransform extends Component {
    setContentSize(w, h) { this.size = { w, h }; }
    setAnchorPoint(x, y) {}
    convertToNodeSpaceAR(v) { return new Vec3(0,0,0); }
}

class Sprite extends Component {
    static SizeMode = { CUSTOM: 0, TRIMMED: 1, RAW: 2 };
}

class Label extends Component {
    static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
}

class ProgressBar extends Component {
    static Mode = { HORIZONTAL: 0, VERTICAL: 1, FILLED: 2 };
}

class Button extends Component {
    static EventType = { CLICK: 'click' };
}

const game = {
    on() {}, off() {}
};

const gameObj = { EVENT_HIDE: 'EVENT_HIDE', EVENT_SHOW: 'EVENT_SHOW' };

const resources = {
    load(path, type, cb) {
        if (typeof type === 'function') cb = type;
        // Mock async load failure or success depending on tests
        setTimeout(() => cb(null, { json: {} }), 1);
    }
};

class JsonAsset {}
class Prefab {}

function instantiate(prefab) {
    return new Node('InstantiatedPrefab');
}

function tween(target) {
    return {
        to() { return this; },
        start() { return this; },
        stop() { return this; }
    };
}

const _decorator = {
    ccclass: () => (target) => target,
    property: () => (target, key) => {}
};

module.exports = {
    Node,
    sys,
    director,
    Layers,
    Color,
    Vec3,
    Vec2,
    Size,
    Component,
    UITransform,
    Sprite,
    Label,
    ProgressBar,
    Button,
    game,
    Game: gameObj,
    resources,
    JsonAsset,
    Prefab,
    instantiate,
    tween,
    _decorator,
    log: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    mockLocalStorage,
    mockScene,
    mockCanvas
};
