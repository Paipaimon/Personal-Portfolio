const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const CanvasGames = require('../js/canvas-games.js');
const source = fs.readFileSync(path.join(__dirname, '../js/canvas-background-controller.js'), 'utf8');

function target(dataset = {}) {
    const events = new Map(), classes = new Set();
    return {
        dataset, style: {}, hidden: false, textContent: '', value: '', attributes: {}, events,
        classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) },
        addEventListener(type, listener) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(listener); },
        removeEventListener(type, listener) { events.get(type)?.delete(listener); },
        dispatch(type, event = {}) { event.target ||= this; event.preventDefault ||= () => {}; for (const listener of events.get(type) || []) listener(event); },
        closest() { return null; },
        setAttribute(key, value) { this.attributes[key] = value; }
    };
}

function harness({ width = 1200, height = 900, worker = false } = {}) {
    const ids = Object.fromEntries(['canvas-entry', 'canvas-home', 'canvas-profile', 'homepage-content', 'canvas-snake-controls', 'canvas-tetris-controls', 'snake-seed-form', 'snake-seed', 'snake-new-seed', 'snake-plan-status'].map(id => [id, target()]));
    const views = ['profile', 'snake', 'tetris', 'default'].map(canvasView => target({ canvasView }));
    const document = { body: target(), hidden: false, getElementById: id => ids[id], querySelectorAll: selector => selector === '[data-canvas-view]' ? views : [] };
    const config = { name: 'Configured Person', bio: 'From a checked-in config', links: [], snakeSeed: 'unit-seed' };
    const window = Object.assign(target(), { innerWidth: width, innerHeight: height, devicePixelRatio: 1.5, scrollY: 300, PORTFOLIO_PROFILE: config,
        matchMedia: () => ({ matches: true }), scrollTo: (_, y) => { window.scrollY = y; } });
    const frames = new Map(), workers = [], fills = [], lines = [], renders = [];
    let frameId = 0, line = [];
    const ctx = new Proxy({
        fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: ctx.fillStyle, alpha: ctx.globalAlpha }); },
        beginPath() { line = []; }, moveTo(x, y) { line.push([x, y]); }, lineTo(x, y) { line.push([x, y]); },
        stroke() { if (line.length) lines.push({ points: line.slice(), color: ctx.strokeStyle }); }
    }, { get: (object, name) => name in object ? object[name] : () => {} });
    const captures = new Set();
    const canvas = Object.assign(target(), { getContext: () => ctx, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) });
    const callbacks = new Set();
    let current = { canvas: { bgColor: '#fafafa', axisColor: '#aaa', lineColor: '#ddd', highlightColor: '#112233', highlightOpacity: 0.15, blockColor: '#fff' }, homepage: { textColor: '#112233' } };
    const themeManager = {
        onThemeChange: callback => callbacks.add(callback), offThemeChange: callback => callbacks.delete(callback),
        getCurrentTheme: () => current, getAvailableThemes: () => ['light'], getThemeConfig: () => current,
        switch() { current = { canvas: { ...current.canvas, bgColor: '#101010', highlightColor: '#eecc88' }, homepage: { textColor: '#eecc88' } }; callbacks.forEach(callback => callback()); }
    };
    class Worker {
        constructor(url) { this.url = url; workers.push(this); }
        postMessage(message) { this.message = message; }
        terminate() { this.terminated = true; }
        deliver(message) { this.onmessage?.({ data: { ...message, id: this.message.id } }); }
    }
    const math = Object.create(Math);
    math.random = () => 0; // Force the documented random-block branch without changing its production probability.
    const globals = { CanvasGames, document, window, Math: math, performance: { now: () => 1000 },
        CanvasProfile: { render: (element, profile) => renders.push({ element, profile }) },
        localStorage: { getItem() { throw Error('Profile must not read browser storage'); }, setItem() { throw Error('Profile must not write browser storage'); } },
        crypto: require('node:crypto').webcrypto,
        requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) };
    if (worker) globals.Worker = Worker;
    const context = vm.createContext(globals);
    const Controller = vm.runInContext(`${source}\nCanvasBackgroundController;`, context);
    const controller = new Controller(canvas, themeManager);
    controller.initialize();
    const pointer = (id, x, y, button = 0) => ({ pointerId: id, clientX: x, clientY: y, button, target: canvas, preventDefault() {} });
    const screen = (x, y) => ({ x: controller.state.offsetX + (x + 0.5) * 50 * controller.state.scale, y: controller.state.offsetY + (y + 0.5) * 50 * controller.state.scale });
    return { controller, canvas, window, document, ids, views, callbacks, frames, fills, lines, captures, pointer, screen, themeManager, config, workers, renders };
}

test('default is the full positive quadrant with no axes, explorer or drawing state', () => {
    const h = harness(), c = h.controller;
    assert.equal(c.defaultView, true);
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    assert.deepEqual({ ...c.getGridFromScreen(0, 0) }, { gridX: 0, gridY: 0 });
    assert.ok(c.getGridFromScreen(h.window.innerWidth - 1, h.window.innerHeight - 1).gridX >= 0);
    assert.ok(c.getGridFromScreen(h.window.innerWidth - 1, h.window.innerHeight - 1).gridY >= 0);
    assert.equal(c.paint, undefined);
    assert.equal(c.regions.paint, undefined);
    assert.equal(h.ids['canvas-snake-controls'].hidden, true, 'negative-world seed controls must not spill into the default quadrant');
    assert.equal(h.document.body.classList.contains('canvas-exploring'), false);
    assert.ok(!h.lines.some(line => line.points.length === 2 && line.points[0][0] === 0 && line.points[1][0] === 0));
    assert.ok(!h.lines.some(line => line.points.length === 2 && line.points[0][1] === 0 && line.points[1][1] === 0));
    assert.match(h.ids['canvas-entry'].style.transform, /translate\(0px, 0px\) scale\(1\)/);
    c.destroy();
});

test('profile, games and return cell remain fixed in world coordinates through direct focus and resize', () => {
    const h = harness(), c = h.controller;
    const { profile, snake, tetris } = c.regions;
    assert.ok(profile.x + profile.w <= 0 && profile.y + profile.h <= 0);
    assert.ok(snake.x >= 0 && snake.y + snake.h <= 0);
    assert.equal(snake.w, 12); assert.equal(snake.h, 12);
    assert.ok(tetris.x + tetris.w <= 0 && tetris.y >= 0);
    const entry = h.screen(0, 0);
    c.clickAt(entry.x, entry.y);
    assert.equal(c.focusedView, 'profile');
    assert.equal(c.defaultView, false);
    assert.equal(h.ids['canvas-profile'].hidden, false);
    assert.equal(h.document.body.classList.contains('canvas-exploring'), false);
    assert.equal(h.ids['homepage-content'].hidden, false);
    assert.equal(h.ids['homepage-content'].style.transform, h.ids['canvas-entry'].style.transform);
    const home = h.screen(-1, -1);
    assert.ok(home.x > 0 && home.x < h.window.innerWidth && home.y > 0 && home.y < h.window.innerHeight);
    h.window.innerWidth = 390; h.window.innerHeight = 844; c.resize();
    const mobileHome = h.screen(-1, -1);
    assert.ok(mobileHome.x > 0 && mobileHome.x < 390 && mobileHome.y > 0 && mobileHome.y < 844);
    c.clickAt(mobileHome.x, mobileHome.y);
    assert.equal(c.defaultView, true);
    assert.equal(h.ids['canvas-snake-controls'].hidden, true);
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    assert.equal(h.window.scrollY, 300);
    c.destroy();
});

test('random theme blocks return in the positive quadrant and are clickable without painting', () => {
    const h = harness(), c = h.controller;
    const point = h.screen(4, 4);
    c.pointerMove(h.pointer(1, point.x, point.y));
    assert.equal(c.state.erasableBlocks.length, 1);
    assert.equal(c.state.erasableBlocks[0].gridX, 4);
    assert.equal(c.state.erasableBlocks[0].gridY, 4);
    c.pointerMove(h.pointer(1, point.x, point.y));
    assert.equal(c.state.erasableBlocks.length, 1, 'moving inside a cell never duplicates its block');
    let clicked;
    c.onBlockClick(theme => { clicked = theme; });
    c.pointerDown(h.pointer(1, point.x, point.y)); c.pointerUp(h.pointer(1, point.x, point.y));
    assert.equal(clicked, 'light');
    assert.equal(c.state.erasableBlocks[0].isClicked, true);
    for (const cell of [[0, 0], [-1, -1], [-5, -5], [4, -5], [-5, 5]]) {
        const p = h.screen(...cell); c.generateInteractiveBlocks(p.x, p.y);
    }
    assert.equal(c.state.erasableBlocks.length, 1, 'entry, return and occupied regions stay clear');
    c.destroy();
});

test('drag and anchored zoom move the camera without changing object coordinates or creating drawings', () => {
    const h = harness(), c = h.controller;
    const regions = JSON.stringify(c.regions);
    c.pointerDown(h.pointer(1, 500, 450)); c.pointerMove(h.pointer(1, 620, 510)); c.pointerUp(h.pointer(1, 620, 510));
    assert.deepEqual([c.state.offsetX, c.state.offsetY], [120, 60]);
    const anchor = { x: 391, y: 402 };
    const before = { x: (anchor.x - c.state.offsetX) / c.state.scale, y: (anchor.y - c.state.offsetY) / c.state.scale };
    c.zoomAt(anchor.x, anchor.y, c.state.scale * 1.7);
    assert.ok(Math.abs((anchor.x - c.state.offsetX) / c.state.scale - before.x) < 1e-8);
    assert.ok(Math.abs((anchor.y - c.state.offsetY) / c.state.scale - before.y) < 1e-8);
    assert.equal(JSON.stringify(c.regions), regions);
    assert.equal(c.state.erasableBlocks.length, 0);
    assert.equal(c.paint, undefined);
    assert.equal(c.pointers.size, 0); assert.equal(h.captures.size, 0);
    c.destroy();
});

test('pinching preserves the midpoint anchor, then the remaining finger continues panning', () => {
    const h = harness(), c = h.controller;
    c.focusRegion('tetris');
    const anchor = { x: (500 - c.state.offsetX) / c.state.scale, y: (400 - c.state.offsetY) / c.state.scale };
    c.pointerDown(h.pointer(1, 400, 400)); c.pointerDown(h.pointer(2, 600, 400)); c.pointerMove(h.pointer(2, 700, 400));
    assert.ok(Math.abs((550 - c.state.offsetX) / c.state.scale - anchor.x) < 1e-8);
    assert.ok(Math.abs((400 - c.state.offsetY) / c.state.scale - anchor.y) < 1e-8);
    c.pointerUp(h.pointer(2, 700, 400));
    const offset = { x: c.state.offsetX, y: c.state.offsetY };
    c.pointerMove(h.pointer(1, 423, 417));
    assert.equal(c.state.offsetX, offset.x + 23); assert.equal(c.state.offsetY, offset.y + 17);
    h.window.dispatch('keydown', { key: 'Escape' });
    assert.equal(c.pointers.size, 0); assert.equal(h.captures.size, 0);
    c.pointerMove(h.pointer(1, 450, 450)); c.pointerUp(h.pointer(1, 450, 450));
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    c.destroy();
});

test('the profile is rendered from public configuration without reading or saving browser data', () => {
    const h = harness();
    assert.equal(h.renders.length, 1);
    assert.equal(h.renders[0].profile, h.config);
    assert.equal(h.renders[0].element, h.ids['canvas-profile']);
    assert.equal(h.ids['snake-seed'].value, 'unit-seed');
    assert.equal(h.controller.snake.seed, 'unit-seed');
    assert.equal(h.controller.snakePlanning, false, 'unavailable workers fall back to real-time seeded safe search');
    assert.match(h.ids['snake-plan-status'].textContent, /实时安全寻路/);
    h.controller.destroy();
});

test('new seed requests terminate obsolete workers and ignore stale results', () => {
    const h = harness({ worker: true }), c = h.controller;
    const old = h.workers[0];
    c.planSnake('next-seed');
    const active = h.workers[1];
    assert.equal(old.terminated, true);
    old.deliver({ type: 'complete', plan: null });
    assert.equal(c.snakePlanning, true);
    active.deliver({ type: 'progress', completed: 3, total: 8, bestSteps: 2500 });
    assert.match(h.ids['snake-plan-status'].textContent, /3 \/ 8/);
    const plan = CanvasGames.planSnakeCandidates('next-seed', { candidates: 1 });
    active.deliver({ type: 'complete', plan });
    assert.equal(c.snakePlanning, false);
    assert.equal(c.snake.plan.steps, plan.steps);
    assert.equal(active.terminated, true);
    assert.match(h.ids['snake-plan-status'].textContent, /同一种子可复现/);
    c.destroy();
});

test('destroy removes subscriptions, cancels animation and terminates pending planning', () => {
    const h = harness({ worker: true });
    assert.equal(h.callbacks.size, 1); assert.equal(h.frames.size, 1);
    h.controller.destroy();
    assert.equal(h.callbacks.size, 0); assert.equal(h.frames.size, 0);
    assert.equal(h.workers[0].terminated, true);
    const targets = [h.canvas, h.window, ...Object.values(h.ids), ...h.views];
    assert.ok(targets.every(node => [...node.events.values()].every(listeners => listeners.size === 0)));
    assert.equal(h.controller.running, false);
});
