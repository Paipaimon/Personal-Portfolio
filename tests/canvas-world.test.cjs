const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const CanvasGames = require('../js/canvas-games.js');

const source = fs.readFileSync(path.join(__dirname, '../js/canvas-background-controller.js'), 'utf8');

function target(dataset = {}) {
    const events = new Map();
    const classes = new Set();
    return {
        dataset, style: {}, hidden: false, textContent: '', attributes: {}, events,
        classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) },
        addEventListener(type, listener) {
            if (!events.has(type)) events.set(type, new Set());
            events.get(type).add(listener);
        },
        removeEventListener(type, listener) { events.get(type)?.delete(listener); },
        dispatch(type, event = {}) {
            event.target ||= this;
            event.preventDefault ||= () => {};
            for (const listener of events.get(type) || []) listener(event);
        },
        closest() { return null; },
        setAttribute(key, value) { this.attributes[key] = value; }
    };
}

function harness({ saved = null, denyStorage = false, width = 1200, height = 900 } = {}) {
    const ids = Object.fromEntries(['canvas-entry', 'canvas-profile', 'canvas-nav', 'canvas-hint', 'paint-tools', 'profile-form', 'profile-status', 'canvas-explore'].map(id => [id, target()]));
    const fields = Object.fromEntries(Object.entries({ name: 60, bio: 240, location: 80, contact: 120 }).map(([name, maxLength]) => [name, { value: '', maxLength }]));
    ids['profile-form'].elements = { namedItem: name => fields[name] };
    const views = ['profile', 'snake', 'tetris', 'paint', 'overview', 'home'].map(canvasView => target({ canvasView }));
    ids['canvas-explore'].dataset.canvasView = 'overview';
    const tools = ['brush', 'erase', 'pan'].map(paintTool => target({ paintTool }));
    const actions = ['undo', 'clear'].map(paintAction => target({ paintAction }));
    const document = {
        body: target(), hidden: false,
        getElementById: id => ids[id],
        querySelectorAll(selector) {
            if (selector === '[data-canvas-view]') return [...views, ids['canvas-explore']];
            if (selector === '#canvas-nav [data-canvas-view]') return views;
            if (selector === '[data-paint-tool]') return tools;
            if (selector === '[data-paint-action]') return actions;
            return [];
        }
    };
    const window = Object.assign(target(), {
        innerWidth: width, innerHeight: height, devicePixelRatio: 1.5, scrollY: 300,
        matchMedia: () => ({ matches: true }), scrollTo: (_, y) => { window.scrollY = y; }
    });
    const storage = { 'portfolio-canvas-profile': saved };
    const localStorage = {
        getItem: key => { if (denyStorage) throw Error('Storage unavailable'); return storage[key] || null; },
        setItem: (key, value) => { if (denyStorage) throw Error('Storage unavailable'); storage[key] = value; }
    };
    const frames = new Map();
    let frameId = 0;
    const fills = [];
    const ctx = new Proxy({
        fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: ctx.fillStyle, alpha: ctx.globalAlpha }); }
    }, { get: (object, name) => name in object ? object[name] : () => {} });
    const captures = new Set();
    const canvas = Object.assign(target(), {
        getContext: () => ctx,
        setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
        releasePointerCapture: id => captures.delete(id)
    });
    const callbacks = new Set();
    let current = {
        canvas: { bgColor: '#fafafa', axisColor: '#aaa', lineColor: '#ddd', highlightColor: '#112233', highlightOpacity: 0.15, blockColor: '#fff' },
        homepage: { textColor: '#112233' }
    };
    const themeManager = {
        onThemeChange: callback => callbacks.add(callback), offThemeChange: callback => callbacks.delete(callback),
        getCurrentTheme: () => current, getAvailableThemes: () => ['light'], getThemeConfig: () => current,
        switch() {
            current = { canvas: { ...current.canvas, bgColor: '#101010', highlightColor: '#eecc88' }, homepage: { textColor: '#eecc88' } };
            callbacks.forEach(callback => callback());
        }
    };
    const context = vm.createContext({ CanvasGames, document, window, localStorage, performance: { now: () => 1000 },
        requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id) });
    const Controller = vm.runInContext(`${source}\nCanvasBackgroundController;`, context);
    const controller = new Controller(canvas, themeManager);
    controller.initialize();
    const pointer = (id, x, y, button = 0) => ({ pointerId: id, clientX: x, clientY: y, button, target: canvas });
    const screen = (x, y) => ({ x: controller.state.offsetX + (x + 0.5) * 50 * controller.state.scale, y: controller.state.offsetY + (y + 0.5) * 50 * controller.state.scale });
    return { controller, canvas, window, document, ids, fields, views, tools, actions, callbacks, frames, fills, storage, captures, pointer, screen, themeManager };
}

test('four regions stay in their quadrants, and focus, zoom and dragging preserve world coordinates', () => {
    const h = harness();
    const c = h.controller;
    const { profile, snake, tetris, paint } = c.regions;
    assert.ok(profile.x + profile.w <= 0 && profile.y + profile.h <= 0);
    assert.ok(snake.x >= 0 && snake.y + snake.h <= 0);
    assert.equal(snake.w, 12);
    assert.equal(snake.h, 12);
    assert.ok(tetris.x + tetris.w <= 0 && tetris.y >= 0);
    assert.equal(tetris.w, c.tetris.columns);
    assert.equal(tetris.h, c.tetris.rows);
    assert.ok(paint.x >= 0 && paint.y >= 0);
    const entryCell = h.screen(0, 0);
    c.clickAt(entryCell.x, entryCell.y);
    assert.equal(c.exploring, true);
    assert.equal(c.focusedView, 'profile');
    assert.equal(h.ids['canvas-profile'].hidden, false);
    const anchor = { x: 391, y: 402 };
    const before = { x: (anchor.x - c.state.offsetX) / c.state.scale, y: (anchor.y - c.state.offsetY) / c.state.scale };
    c.zoomAt(anchor.x, anchor.y, c.state.scale * 1.7);
    assert.ok(Math.abs((anchor.x - c.state.offsetX) / c.state.scale - before.x) < 1e-8);
    assert.ok(Math.abs((anchor.y - c.state.offsetY) / c.state.scale - before.y) < 1e-8);
    c.setTool('pan');
    const offset = { x: c.state.offsetX, y: c.state.offsetY };
    c.pointerDown(h.pointer(1, 500, 450));
    c.pointerMove(h.pointer(1, 620, 510));
    c.pointerUp(h.pointer(1, 620, 510));
    assert.equal(c.state.offsetX, offset.x + 120);
    assert.equal(c.state.offsetY, offset.y + 60);
    assert.equal(c.pointers.size, 0);
    assert.equal(h.captures.size, 0);
    c.focusRegion('home');
    assert.equal(c.exploring, false);
    assert.equal(h.window.scrollY, 300);
    c.destroy();
});

test('fast drawing strokes stay continuous, stop at the quadrant boundary and support erase, undo and clear', () => {
    const h = harness();
    const c = h.controller;
    c.focusRegion('paint');
    const a = h.screen(2, 2), b = h.screen(8, 2), outside = h.screen(-2, 2);
    c.pointerDown(h.pointer(1, a.x, a.y));
    c.pointerMove(h.pointer(1, b.x, b.y));
    c.pointerMove(h.pointer(1, outside.x, outside.y));
    c.pointerUp(h.pointer(1, outside.x, outside.y));
    for (let x = 0; x <= 8; x++) assert.ok(c.paint.has(`${x},2`), `stroke fills skipped cell ${x}`);
    assert.ok([...c.paint.keys()].every(key => Number(key.split(',')[0]) >= 0), 'drawing cannot cross the world axis');
    c.setTool('erase');
    const middle = h.screen(4, 2);
    c.pointerDown(h.pointer(2, middle.x, middle.y));
    c.pointerUp(h.pointer(2, middle.x, middle.y));
    assert.equal(c.paint.has('4,2'), false);
    c.paintAction('undo');
    assert.equal(c.paint.has('4,2'), true);
    const drawing = [...c.paint.keys()].sort().join('|');
    c.paintAction('clear');
    assert.equal(c.paint.size, 0);
    c.paintAction('undo');
    assert.equal([...c.paint.keys()].sort().join('|'), drawing);
    c.paintAction('undo');
    assert.equal(c.paint.size, 0, 'undo reverses the complete original stroke as one action');
    c.destroy();
});

test('undo while holding a brush never breaks continued input or prevents a subsequent stroke', () => {
    const h = harness();
    const c = h.controller;
    c.focusRegion('paint');
    const a = h.screen(2, 2), b = h.screen(3, 2), next = h.screen(4, 3);
    c.pointerDown(h.pointer(1, a.x, a.y));
    h.window.dispatch('keydown', { key: 'z', ctrlKey: true });
    assert.doesNotThrow(() => c.pointerMove(h.pointer(1, b.x, b.y)));
    c.pointerUp(h.pointer(1, b.x, b.y));
    c.pointerDown(h.pointer(2, next.x, next.y));
    c.pointerUp(h.pointer(2, next.x, next.y));
    assert.equal(c.paint.has('4,3'), true);
    c.destroy();
});

test('pinching anchors the world under the moving midpoint and transitions into one-finger panning', () => {
    const h = harness();
    const c = h.controller;
    c.focusRegion('tetris');
    const anchor = { x: (500 - c.state.offsetX) / c.state.scale, y: (400 - c.state.offsetY) / c.state.scale };
    c.pointerDown(h.pointer(1, 400, 400));
    c.pointerDown(h.pointer(2, 600, 400));
    c.pointerMove(h.pointer(2, 700, 400));
    assert.ok(Math.abs((550 - c.state.offsetX) / c.state.scale - anchor.x) < 1e-8);
    assert.ok(Math.abs((400 - c.state.offsetY) / c.state.scale - anchor.y) < 1e-8);
    c.pointerUp(h.pointer(2, 700, 400));
    const offset = { x: c.state.offsetX, y: c.state.offsetY };
    c.pointerMove(h.pointer(1, 423, 417));
    assert.equal(c.state.offsetX, offset.x + 23);
    assert.equal(c.state.offsetY, offset.y + 17);
    c.pointerUp(h.pointer(1, 423, 417));
    assert.equal(c.pointers.size, 0);
    assert.equal(h.captures.size, 0);
    c.destroy();
});

test('leaving the canvas during a held stroke ends drawing before the home view returns', () => {
    const h = harness();
    const c = h.controller;
    c.focusRegion('paint');
    const point = h.screen(2, 2);
    c.pointerDown(h.pointer(1, point.x, point.y));
    h.window.dispatch('keydown', { key: 'Escape' });
    const drawing = [...c.paint.keys()].sort().join('|');
    c.pointerMove(h.pointer(1, point.x + 300, point.y + 300));
    c.pointerUp(h.pointer(1, point.x + 300, point.y + 300));
    assert.equal(c.exploring, false);
    assert.equal([...c.paint.keys()].sort().join('|'), drawing);
    c.destroy();
});

test('theme changes recolor existing paint while preserving its world cells', () => {
    const h = harness();
    const c = h.controller;
    c.focusRegion('paint');
    const point = h.screen(2, 2);
    c.pointerDown(h.pointer(1, point.x, point.y));
    c.pointerUp(h.pointer(1, point.x, point.y));
    c.draw();
    assert.ok(h.fills.some(fill => fill.x === 102 && fill.y === 102 && fill.color === '#112233'));
    h.fills.length = 0;
    h.themeManager.switch();
    assert.ok(h.fills.some(fill => fill.x === 102 && fill.y === 102 && fill.color === '#eecc88'));
    assert.equal([...c.paint.keys()].join(','), '2,2');
    c.destroy();
});

test('malformed or denied profile storage does not prevent editing; saving reports success or failure', () => {
    for (const saved of ['{bad json', 'null', 'true', '123', '[]', '{"name":3,"bio":"ok"}']) {
        const h = harness({ saved });
        assert.equal(h.fields.name.value, 'Jlands');
        assert.equal(typeof h.fields.bio.value, 'string');
        h.fields.name.value = ' New name ';
        h.ids['profile-form'].dispatch('submit');
        assert.equal(JSON.parse(h.storage['portfolio-canvas-profile']).name, 'New name');
        assert.match(h.ids['profile-status'].textContent, /已保存/);
        h.controller.destroy();
    }
    const h = harness({ denyStorage: true });
    h.fields.name.value = 'Editable';
    assert.doesNotThrow(() => h.ids['profile-form'].dispatch('submit'));
    assert.equal(h.fields.name.value, 'Editable');
    assert.match(h.ids['profile-status'].textContent, /无法保存/);
    h.controller.destroy();
});

test('destroy removes input and theme subscriptions and cancels the animation frame', () => {
    const h = harness();
    assert.equal(h.callbacks.size, 1);
    assert.equal(h.frames.size, 1);
    h.controller.destroy();
    assert.equal(h.callbacks.size, 0);
    assert.equal(h.frames.size, 0);
    const targets = [h.canvas, h.window, ...Object.values(h.ids), ...h.views, ...h.tools, ...h.actions];
    assert.ok(targets.every(node => [...node.events.values()].every(listeners => listeners.size === 0)));
    assert.equal(h.controller.running, false);
});
