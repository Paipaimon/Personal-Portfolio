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
        dataset, style: {}, hidden: false, textContent: '', attributes: {}, events,
        classList: { add: key => classes.add(key), remove: key => classes.delete(key), toggle(key, force) { if (force === undefined) force = !classes.has(key); force ? classes.add(key) : classes.delete(key); return force; }, contains: key => classes.has(key) },
        addEventListener(type, listener) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(listener); },
        removeEventListener(type, listener) { events.get(type)?.delete(listener); },
        dispatch(type, event = {}) { event.target ||= this; event.preventDefault ||= () => {}; for (const listener of events.get(type) || []) listener(event); },
        closest() { return null; },
        setAttribute(key, value) { this.attributes[key] = value; }
    };
}

function harness({ width = 1200, height = 900, worker = false, reducedMotion = true } = {}) {
    const ids = Object.fromEntries(['canvas-entry', 'canvas-home', 'canvas-snake-link', 'canvas-tetris-link', 'canvas-profile', 'homepage-content', 'canvas-snake-controls', 'canvas-tetris-controls', 'canvas-explore', 'canvas-exit', 'canvas-nav'].map(id => [id, target()]));
    ids['canvas-nav'].hidden = true;
    const views = ['profile', 'snake', 'tetris', 'overview', 'default'].map(canvasView => target({ canvasView }));
    const resets = ['snake', 'tetris'].map(canvasReset => target({ canvasReset }));
    const document = { body: target(), hidden: false, getElementById: id => ids[id], querySelectorAll: selector => selector.includes('data-canvas-view') ? views : selector.includes('data-canvas-reset') ? resets : [] };
    const config = { name: 'AckerLi', birthDate: '2004-11-16', bio: 'From checked-in configuration', links: [] };
    const window = Object.assign(target(), { innerWidth: width, innerHeight: height, devicePixelRatio: 1.5, scrollY: 300, PORTFOLIO_PROFILE: config,
        matchMedia: () => ({ matches: reducedMotion }), scrollTo: (_, y) => { window.scrollY = y; } });
    const frames = new Map(), workers = [], fills = [], lines = [], renders = [], logs = [], timers = new Map();
    let frameId = 0, line = [], now = 1000, randomId = 1;
    const ctx = new Proxy({
        fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: ctx.fillStyle, alpha: ctx.globalAlpha }); },
        beginPath() { line = []; }, moveTo(x, y) { line.push([x, y]); }, lineTo(x, y) { line.push([x, y]); },
        stroke() { if (line.length) lines.push({ points: line.slice(), color: ctx.strokeStyle }); }
    }, { get: (object, name) => name in object ? object[name] : () => {} });
    const captures = new Set();
    const canvas = Object.assign(target(), { getContext: () => ctx, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) });
    const callbacks = new Set();
    let current = { canvas: { bgColor: '#fafafa', axisColor: '#aaa', lineColor: '#ddd', highlightColor: '#112233', highlightOpacity: .15, blockColor: '#fff' }, homepage: { textColor: '#112233' } };
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
    math.random = () => 0;
    const globals = { CanvasGames, document, window, Math: math, Date, performance: { now: () => now },
        CanvasProfile: { render: (element, profile) => renders.push({ element, profile }) },
        console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })])),
        crypto: { getRandomValues(array) { array.forEach((_, i) => { array[i] = randomId++; }); return array; } },
        localStorage: { getItem() { throw Error('Profile must not read browser storage'); }, setItem() { throw Error('Profile must not write browser storage'); } },
        setInterval(callback) { const id = ++frameId; timers.set(id, callback); return id; }, clearInterval: id => timers.delete(id),
        setTimeout(callback) { const id = ++frameId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
        requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) };
    if (worker) globals.Worker = Worker;
    const Controller = vm.runInContext(`${source}\nCanvasBackgroundController;`, vm.createContext(globals));
    const controller = new Controller(canvas, themeManager);
    controller.initialize();
    const pointer = (id, x, y, button = 0) => ({ pointerId: id, clientX: x, clientY: y, button, target: canvas, preventDefault() {} });
    const screen = (x, y) => ({ x: controller.state.offsetX + (x + .5) * 50 * controller.state.scale, y: controller.state.offsetY + (y + .5) * 50 * controller.state.scale });
    const settle = () => { now += 1000; controller.loop(now); };
    return { controller, canvas, window, document, ids, views, resets, callbacks, frames, timers, fills, lines, captures, pointer, screen, themeManager, config, workers, renders, logs, settle };
}

test('default shows positive-grid random blocks and exploration entry, without seed or drawing UI', () => {
    const h = harness(), c = h.controller;
    assert.equal(c.defaultView, true);
    assert.equal(c.exploring, false);
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    assert.deepEqual({ ...c.getGridFromScreen(0, 0) }, { gridX: 0, gridY: 0 });
    assert.equal(c.paint, undefined);
    assert.equal(c.regions.paint, undefined);
    assert.equal(h.ids['canvas-explore'].hidden, false);
    assert.equal(h.ids['canvas-nav'].hidden, true);
    assert.ok(!h.lines.some(line => line.points.length === 2 && line.points.every(point => point[0] === 0)));
    assert.ok(!h.lines.some(line => line.points.length === 2 && line.points.every(point => point[1] === 0)));
    const point = h.screen(4, 4);
    c.pointerMove(h.pointer(1, point.x, point.y));
    assert.equal(c.state.erasableBlocks.length, 1);
    let clicked;
    c.onBlockClick(theme => { clicked = theme; });
    c.pointerDown(h.pointer(1, point.x, point.y)); c.pointerUp(h.pointer(1, point.x, point.y));
    assert.equal(clicked, 'light');
    for (const cell of [[0, 0], [-1, -1], [0, -1], [-1, 0], [-5, -5], [4, -5], [-5, 5]]) {
        const p = h.screen(...cell); c.generateInteractiveBlocks(p.x, p.y);
    }
    assert.equal(c.state.erasableBlocks.length, 1, 'all four corner links and occupied regions stay clear');
    c.destroy();
});

test('normal mode blocks wheel, Ctrl-wheel, direct zoom and pinch, including after corner navigation', () => {
    const h = harness(), c = h.controller;
    for (const view of ['default', 'profile', 'snake', 'tetris']) {
        c.focusRegion(view);
        assert.equal(c.state.scale, 1, 'navigation outside exploration only pans');
        for (const ctrlKey of [false, true]) h.canvas.dispatch('wheel', { clientX: 300, clientY: 300, deltaY: -300, ctrlKey });
        c.zoomAt(300, 300, 1.8);
        c.pointerDown(h.pointer(1, 300, 300)); c.pointerDown(h.pointer(2, 500, 300)); c.pointerMove(h.pointer(2, 650, 300));
        c.pointerUp(h.pointer(2, 650, 300)); c.pointerUp(h.pointer(1, 300, 300));
        assert.equal(c.state.scale, 1);
        assert.equal(c.exploring, false);
    }
    c.destroy();
});

test('game edges stay two cells from both axes and reset controls follow their boards', () => {
    const h = harness(), c = h.controller;
    assert.deepEqual({ ...c.regions.snake }, { x: -14, y: 2, w: 12, h: 12 });
    assert.deepEqual({ ...c.regions.tetris }, { x: 2, y: -18, w: 10, h: 16 });
    assert.equal(c.tetris.rows, 16);
    c.enterExploration(); c.focusRegion('snake');
    const snake = c.regions.snake;
    const sx = c.state.offsetX + snake.x * 50 * c.state.scale;
    const sy = c.state.offsetY + (snake.y + snake.h + .2) * 50 * c.state.scale;
    assert.equal(h.ids['canvas-snake-controls'].style.transform, `translate(${sx}px, ${sy}px) scale(${c.state.scale})`);
    const seed = c.snake.seed;
    c.snake.steps = 40; c.snake.score = 3;
    h.resets[0].dispatch('click');
    assert.notEqual(c.snake.seed, seed);
    assert.equal(c.snake.steps, 0); assert.equal(c.snake.score, 0);
    const subtitles = [];
    const drawRegion = c.drawRegion.bind(c);
    c.drawRegion = (name, title, subtitle, theme) => { if (name === 'snake') subtitles.push(subtitle); drawRegion(name,title,subtitle,theme); };
    c.snake.score = 7; c.draw();
    assert.equal(subtitles.at(-1), '12 × 12 · 得分 7');
    c.tetris.board[15].fill(5); c.tetris.lines = 3; c.tetris.score = 100;
    h.resets[1].dispatch('click');
    assert.equal(c.tetris.lines, 0); assert.equal(c.tetris.score, 0);
    assert.ok(c.tetris.board.every(row => row.every(cell => cell === 0)));
    h.window.scrollY = 500;
    c.focusRegion('default');
    assert.equal(h.window.scrollY, 0, 'default navigation always returns to the homepage introduction');
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    c.destroy();
});

test('all four origin corner links animate to their target while preserving normal-mode scale', () => {
    const h = harness({ reducedMotion: false }), c = h.controller;
    const regions = JSON.stringify(c.regions);
    for (const [x, y, view] of [[0, 0, 'profile'], [0, -1, 'tetris'], [-1, 0, 'snake'], [-1, -1, 'default']]) {
        const point = h.screen(x, y);
        const before = [c.state.offsetX, c.state.offsetY, c.state.scale];
        c.clickAt(point.x, point.y);
        assert.equal(c.focusedView, view);
        assert.ok(c.camera, `${view} has a camera movement animation`);
        assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], before, 'animation starts at current position');
        assert.equal(c.camera.target.scale, 1);
        h.settle();
        assert.equal(c.camera, null);
        assert.equal(c.state.scale, 1);
    }
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    assert.equal(JSON.stringify(c.regions), regions);
    assert.equal(h.ids['canvas-home'].hidden, true);
    c.destroy();
});

test('exploration alone permits anchored wheel and pinch zoom and exits cleanly to default', () => {
    const h = harness(), c = h.controller;
    c.enterExploration();
    assert.equal(c.exploring, true);
    assert.equal(h.ids['canvas-nav'].hidden, false);
    assert.equal(h.ids['canvas-explore'].hidden, true);
    const anchor = { x: 391, y: 402 };
    const before = { x: (anchor.x - c.state.offsetX) / c.state.scale, y: (anchor.y - c.state.offsetY) / c.state.scale };
    const scale = c.state.scale;
    h.canvas.dispatch('wheel', { clientX: anchor.x, clientY: anchor.y, deltaY: -200 });
    assert.ok(c.state.scale > scale);
    assert.ok(Math.abs((anchor.x - c.state.offsetX) / c.state.scale - before.x) < 1e-8);
    assert.ok(Math.abs((anchor.y - c.state.offsetY) / c.state.scale - before.y) < 1e-8);
    const pinchScale = c.state.scale;
    c.pointerDown(h.pointer(1, 400, 300)); c.pointerDown(h.pointer(2, 600, 300)); c.pointerMove(h.pointer(2, 700, 300));
    assert.ok(c.state.scale > pinchScale);
    c.pointerUp(h.pointer(2, 700, 300));
    const offset = { x: c.state.offsetX, y: c.state.offsetY };
    c.pointerMove(h.pointer(1, 423, 317));
    assert.equal(c.state.offsetX, offset.x + 23); assert.equal(c.state.offsetY, offset.y + 17);
    c.exitExploration();
    assert.equal(c.exploring, false);
    assert.equal(c.defaultView, true);
    assert.equal(h.ids['canvas-nav'].hidden, true);
    assert.equal(c.pointers.size, 0); assert.equal(h.captures.size, 0);
    assert.deepEqual([c.state.offsetX, c.state.offsetY, c.state.scale], [0, 0, 1]);
    c.destroy();
});

test('normal dragging and responsive layout keep grid coordinates stable without allowing scale changes', () => {
    const h = harness(), c = h.controller;
    const regions = JSON.stringify(c.regions);
    c.pointerDown(h.pointer(1, 500, 450)); c.pointerMove(h.pointer(1, 620, 510)); c.pointerUp(h.pointer(1, 620, 510));
    assert.deepEqual([c.state.offsetX, c.state.offsetY], [120, 60]);
    assert.equal(c.state.scale, 1);
    c.focusRegion('profile');
    h.window.innerWidth = 390; h.window.innerHeight = 844; c.resize();
    assert.equal(c.state.scale, 1);
    assert.equal(JSON.stringify(c.regions), regions);
    h.window.dispatch('keydown', { key: 'Escape' });
    assert.equal(c.exploring, false);
    assert.equal(c.state.scale, 1);
    c.destroy();
});

test('interrupting an animated exploration exit cannot leave normal mode at a zoomed scale', () => {
    const h = harness({ reducedMotion: false }), c = h.controller;
    c.enterExploration(); h.settle();
    c.zoomAt(400, 300, 0.6);
    c.exitExploration();
    assert.equal(c.exploring, false);
    assert.ok(c.camera);
    c.pointerDown(h.pointer(1, 600, 300));
    assert.equal(c.state.scale, 1);
    c.pointerUp(h.pointer(1, 600, 300));
    h.canvas.dispatch('wheel', { clientX: 300, clientY: 300, deltaY: -250, ctrlKey: true });
    assert.equal(c.state.scale, 1);
    c.destroy();
});

test('profile uses source configuration and random snake seeds are console-only', () => {
    const h = harness(), c = h.controller;
    assert.equal(h.renders[0].profile, h.config);
    assert.equal(h.renders[0].element, h.ids['canvas-profile']);
    assert.equal(c.snakePlanning, false, 'no Worker falls back to live automatic pathfinding');
    assert.ok(h.logs.length > 0, 'seed and fallback details are emitted to the console');
    const before = c.snake.seed;
    h.window.canvasSnakeDebug.newSeed();
    assert.notEqual(c.snake.seed, before);
    assert.ok(h.window.canvasSnakeDebug);
    c.destroy();
});

test('new random seed requests terminate obsolete workers and ignore stale results', () => {
    const h = harness({ worker: true }), c = h.controller;
    const old = h.workers[0];
    c.planSnake('qa-seed');
    const active = h.workers[1];
    assert.equal(old.terminated, true);
    old.deliver({ type: 'complete', plan: null });
    assert.equal(c.snakePlanning, true);
    active.deliver({ type: 'progress', completed: 3, total: 8, bestSteps: 2500 });
    const plan = CanvasGames.planSnakeCandidates('qa-seed', { candidates: 1 });
    active.deliver({ type: 'complete', plan });
    assert.equal(c.snakePlanning, false);
    assert.equal(c.snake.plan.steps, plan.steps);
    assert.equal(active.terminated, true);
    c.destroy();
});

test('destroy clears subscriptions, animation, age refresh timers, planning and console helpers', () => {
    const h = harness({ worker: true }), c = h.controller;
    assert.equal(h.callbacks.size, 1);
    c.destroy();
    assert.equal(h.callbacks.size, 0);
    assert.equal(h.workers[0].terminated, true);
    assert.equal(h.timers.size, 0);
    assert.equal(h.window.canvasSnakeDebug, undefined);
    const targets = [h.canvas, h.window, ...Object.values(h.ids), ...h.views, ...h.resets];
    assert.ok(targets.every(node => [...node.events.values()].every(listeners => listeners.size === 0)));
    assert.equal(c.running, false);
});
