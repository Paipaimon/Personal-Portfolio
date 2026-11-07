'use strict';

// The world and recipes retain the original game's wood → stone → iron progression.
const TILE = 32;
const WORLD_WIDTH = 40;
const WORLD_HEIGHT = 100;
const SURFACE = 8;
const PLAYER_W = 22;
const PLAYER_H = 29;
const STEP = 1 / 120;
const SAVE_KEY = 'portfolio.deep-dig.v1';
const Block = Object.freeze({ AIR: 0, DIRT: 1, STONE: 2, COAL: 3, IRON: 4, DIAMOND: 5, BEDROCK: 6, LOG: 7, LEAVES: 8 });
const BLOCKS = {
    0: { name: '空气', color: '#193635', level: 0, time: 0 },
    1: { name: '泥土', color: '#8f6b46', level: 0, time: .36 },
    2: { name: '石头', color: '#66766d', level: 0, time: .7 },
    3: { name: '煤炭', color: '#303e38', level: 1, time: .8 },
    4: { name: '铁矿', color: '#c08e65', level: 2, time: 1 },
    5: { name: '钻石', color: '#80d5c5', level: 3, time: 1.25 },
    6: { name: '基岩', color: '#35443e', level: 99, time: Infinity },
    7: { name: '木头', color: '#88623e', level: 0, time: .45 },
    8: { name: '树叶', color: '#668c51', level: 0, time: .15 }
};
const ITEMS = [7, 1, 2, 3, 4, 5];
const TOOL_NAMES = ['徒手', '木镐', '石镐', '铁镐'];
const RECIPES = { 1: { 7: 5 }, 2: { 7: 5, 2: 15 }, 3: { 2: 30, 4: 10 } };
const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const view = { width: 800, height: 486, x: 0, y: 0, dpr: 1 };
const state = {
    grid: [], inventory: {}, seed: 0, tool: 0, mined: 0, diamonds: 0, bestDepth: 0,
    paused: false, build: false, selected: Block.DIRT, dirty: false, uiDirty: true,
    mining: null, particles: [], labels: [], lastDepth: -1, lastColumn: -1, lastRow: -1
};
const player = { x: 0, y: 0, vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuffer: 0, facing: 1 };
const keyboard = new Set();
const touchKeys = new Map();
const pointer = { x: 0, y: 0, visible: false, held: false, id: null };
const tiles = new Map();
const inventoryElements = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let previousTime = 0;
let accumulator = 0;
let uiElapsed = 0;
let saveElapsed = 0;
let saveUnavailable = false;
let resetWasPaused = false;

function randomGenerator(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function generateWorld(seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
    const random = randomGenerator(seed);
    state.seed = seed;
    state.grid = Array.from({ length: WORLD_HEIGHT }, (_, y) => Array.from({ length: WORLD_WIDTH }, () => {
        if (y < SURFACE) return Block.AIR;
        if (y === WORLD_HEIGHT - 1) return Block.BEDROCK;
        if (y < SURFACE + 3) return Block.DIRT;
        const roll = random();
        if (y < 18) return roll < .35 ? Block.STONE : Block.DIRT;
        if (y < 30) return roll < .16 ? Block.COAL : Block.STONE;
        if (y < 60) return roll < .13 ? Block.IRON : roll < .36 ? Block.COAL : Block.STONE;
        return roll < .09 ? Block.DIAMOND : roll < .3 ? Block.IRON : roll < .48 ? Block.COAL : Block.STONE;
    }));
    // Small connected pockets, with an intact bedrock floor.
    for (let y = 17; y < WORLD_HEIGHT - 3; y++) {
        for (let x = 2; x < WORLD_WIDTH - 2; x++) {
            if (random() < .012) {
                state.grid[y][x] = state.grid[y][x + 1] = state.grid[y + 1][x] = Block.AIR;
            }
        }
    }
    // Enough reachable wood for both early recipes; leave a clear spawn area.
    for (const x of [4, 10, 16, 25, 31, 36]) {
        const height = 4 + Math.floor(random() * 2);
        for (let h = 1; h <= height; h++) state.grid[SURFACE - h][x] = Block.LOG;
        for (let dy = -2; dy <= 1; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const y = SURFACE - height + dy;
                if (y >= 0 && Math.abs(dx) + Math.abs(dy) < 4 && state.grid[y][x + dx] === Block.AIR) {
                    state.grid[y][x + dx] = Block.LEAVES;
                }
            }
        }
    }
    Object.assign(state, { inventory: {}, tool: 0, mined: 0, diamonds: 0, bestDepth: 0, mining: null, particles: [], labels: [], selected: Block.DIRT, build: false, dirty: true, uiDirty: true, lastDepth: -1, lastColumn: -1 });
    returnToSurface(false);
}

function blockAt(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return Block.BEDROCK;
    if (y < 0) return Block.AIR;
    return state.grid[y][x];
}

function solid(type) { return type !== Block.AIR && type !== Block.LEAVES; }

function collides(x, y) {
    const left = Math.floor((x + .001) / TILE), right = Math.floor((x + PLAYER_W - .001) / TILE);
    const top = Math.floor((y + .001) / TILE), bottom = Math.floor((y + PLAYER_H - .001) / TILE);
    for (let by = top; by <= bottom; by++) {
        for (let bx = left; bx <= right; bx++) {
            if (solid(blockAt(bx, by))) return { x: bx, y: by };
        }
    }
    return null;
}

function returnToSurface(announce = true) {
    clearInput();
    // This also repairs the landing pad if the player mined or built over spawn.
    const spawnX = Math.floor(WORLD_WIDTH / 2);
    for (let y = SURFACE - 3; y < SURFACE; y++) {
        state.grid[y][spawnX] = state.grid[y][spawnX + 1] = Block.AIR;
    }
    state.grid[SURFACE][spawnX] = state.grid[SURFACE][spawnX + 1] = Block.DIRT;
    Object.assign(player, { x: spawnX * TILE + 5, y: SURFACE * TILE - PLAYER_H, vx: 0, vy: 0, grounded: true, coyote: .1, jumpBuffer: 0 });
    state.mining = null;
    state.dirty = true;
    updateCamera(true);
    if (announce) message('已返回地表，背包和工具都在。', 'success');
}

function updateCamera(snap = false) {
    const targetX = Math.max(0, Math.min(WORLD_WIDTH * TILE - view.width, player.x + PLAYER_W / 2 - view.width / 2));
    const targetY = Math.max(0, Math.min(WORLD_HEIGHT * TILE - view.height, player.y - view.height * .43));
    view.x += (targetX - view.x) * (snap ? 1 : .12);
    view.y += (targetY - view.y) * (snap ? 1 : .12);
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    view.width = Math.max(1, Math.round(rect.width));
    view.height = Math.max(1, Math.round(rect.height));
    view.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(view.width * view.dpr);
    canvas.height = Math.round(view.height * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    updateCamera(true);
    render();
}

function update(dt) {
    const left = keyboard.has('left') || [...touchKeys.values()].includes('left');
    const right = keyboard.has('right') || [...touchKeys.values()].includes('right');
    player.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * 185;
    if (player.vx) player.facing = Math.sign(player.vx);
    player.coyote = player.grounded ? .1 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = -365; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0;
    }
    player.vy = Math.min(620, player.vy + 1000 * dt);
    let nextX = Math.max(0, Math.min(WORLD_WIDTH * TILE - PLAYER_W, player.x + player.vx * dt));
    const hitX = collides(nextX, player.y);
    if (hitX) {
        nextX = player.vx > 0 ? hitX.x * TILE - PLAYER_W : (hitX.x + 1) * TILE;
        player.vx = 0;
    }
    player.x = nextX;
    let nextY = Math.max(0, player.y + player.vy * dt);
    const hitY = collides(player.x, nextY);
    player.grounded = false;
    if (hitY) {
        player.grounded = player.vy > 0;
        nextY = player.vy > 0 ? hitY.y * TILE - PLAYER_H : (hitY.y + 1) * TILE;
        player.vy = 0;
    } else if (nextY === 0 && player.vy < 0) player.vy = 0;
    if (Math.abs(player.y - nextY) > .001 || player.vx) state.dirty = true;
    player.y = nextY;
    updateCamera();
    const depth = currentDepth();
    if (depth > state.bestDepth) { state.bestDepth = depth; state.uiDirty = true; state.dirty = true; }
    updateMining(dt);
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const label of state.labels) { label.y -= 22 * dt; label.life -= dt; }
    state.labels = state.labels.filter(label => label.life > 0);
}

function currentDepth() { return Math.max(0, Math.floor((player.y + PLAYER_H) / TILE) - SURFACE); }
function targetBlock() { return { x: Math.floor((pointer.x + view.x) / TILE), y: Math.floor((pointer.y + view.y) / TILE) }; }
function inReach(x, y) { return Math.hypot((x + .5) * TILE - player.x - PLAYER_W / 2, (y + .5) * TILE - player.y - PLAYER_H / 2) <= TILE * 3.6; }
function miningError(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return '这里是世界的边界。';
    const type = blockAt(x, y);
    if (type === Block.AIR) return '这里没有可挖掘的方块。';
    if (!inReach(x, y)) return '离方块太远，走近一点再挖。';
    if (type === Block.BEDROCK) return '已经到达世界底部，基岩无法破坏。';
    if (BLOCKS[type].level > state.tool) return `采集${BLOCKS[type].name}需要${TOOL_NAMES[BLOCKS[type].level]}。`;
    return '';
}

function beginMining(announce = false) {
    const { x, y } = targetBlock();
    const error = miningError(x, y);
    if (error) { state.mining = null; if (announce && blockAt(x, y) !== Block.AIR) message(error, 'error'); return; }
    if (!state.mining || state.mining.x !== x || state.mining.y !== y) state.mining = { x, y, time: 0, type: blockAt(x, y) };
}

function updateMining(dt) {
    if (pointer.held && !state.build) beginMining();
    const mine = state.mining;
    if (!mine) return;
    // Check again at completion: movement cannot mine a distant or replaced tile.
    if (miningError(mine.x, mine.y) || blockAt(mine.x, mine.y) !== mine.type) { state.mining = null; return; }
    mine.time += dt;
    if (mine.time < miningDuration(mine.type)) return;
    const type = mine.type;
    state.grid[mine.y][mine.x] = Block.AIR;
    if (ITEMS.includes(type)) {
        state.inventory[type] = (state.inventory[type] || 0) + 1;
        if (type === Block.DIAMOND) state.diamonds++;
        if (!reducedMotion) state.labels.push({ x: (mine.x + .5) * TILE, y: mine.y * TILE, text: `+1 ${BLOCKS[type].name}`, life: .9 });
        message(type === Block.DIAMOND ? '找到钻石了！每一次向下，都值得。' : `获得 ${BLOCKS[type].name} +1`, 'success');
    }
    if (!reducedMotion) {
        for (let i = 0; i < 7 && state.particles.length < 100; i++) state.particles.push({ x: (mine.x + .5) * TILE, y: (mine.y + .5) * TILE, vx: (Math.random() - .5) * 110, vy: -Math.random() * 130, life: .45, color: BLOCKS[type].color });
    }
    state.mined++; state.mining = null; state.dirty = true; state.uiDirty = true;
}

function miningDuration(type) { return BLOCKS[type].time / (1 + state.tool * .65); }

function placeBlock() {
    const { x, y } = targetBlock();
    if (y < 0 || y >= WORLD_HEIGHT - 1 || x < 0 || x >= WORLD_WIDTH || !inReach(x, y)) return message('请在身边的空位放置方块。', 'error');
    if (blockAt(x, y) !== Block.AIR) return message('这个位置已经有方块了。', 'error');
    if (!(state.inventory[state.selected] > 0)) return message(`背包里没有${BLOCKS[state.selected].name}了。`, 'error');
    if (player.x < (x + 1) * TILE && player.x + PLAYER_W > x * TILE && player.y < (y + 1) * TILE && player.y + PLAYER_H > y * TILE) return message('这里站着你自己，换个位置吧。', 'error');
    state.grid[y][x] = state.selected;
    state.inventory[state.selected]--;
    state.mining = null; state.dirty = true; state.uiDirty = true;
    message(`放置了 1 块${BLOCKS[state.selected].name}。`);
}

function craftTool(level) {
    if (state.paused || level !== state.tool + 1 || !RECIPES[level]) return false;
    const recipe = RECIPES[level];
    if (Object.entries(recipe).some(([type, count]) => (state.inventory[type] || 0) < count)) return false;
    for (const [type, count] of Object.entries(recipe)) state.inventory[type] -= count;
    state.tool = level; state.uiDirty = true; state.dirty = true;
    message(`${TOOL_NAMES[level]}制作成功！现在可以采集${['', '煤炭', '铁矿', '钻石'][level]}了。`, 'success');
    updateUI(); saveGame();
    return true;
}

// Build small reusable textures once instead of generating per-tile noise every frame.
function createTextures() {
    for (let type = 1; type <= 8; type++) {
        for (let variant = 0; variant < 3; variant++) {
            const tile = document.createElement('canvas'); tile.width = tile.height = TILE;
            const c = tile.getContext('2d');
            const random = randomGenerator(type * 100 + variant);
            const base = [Block.COAL, Block.IRON, Block.DIAMOND].includes(type) ? BLOCKS[Block.STONE].color : BLOCKS[type].color;
            c.fillStyle = base; c.fillRect(0, 0, TILE, TILE);
            c.fillStyle = '#ffffff0d'; c.fillRect(0, 0, TILE, 2);
            c.fillStyle = '#102b2629'; c.fillRect(0, TILE - 2, TILE, 2); c.fillRect(TILE - 1, 0, 1, TILE);
            for (let i = 0; i < 14; i++) {
                c.fillStyle = i % 2 ? '#10271f25' : '#f7edb818';
                c.fillRect(Math.floor(random() * 14) * 2, Math.floor(random() * 14) * 2, 2 + Math.floor(random() * 3) * 2, 2);
            }
            if ([Block.COAL, Block.IRON, Block.DIAMOND].includes(type)) {
                for (const [x, y] of [[6, 8], [19, 6], [14, 21], [24, 19]]) {
                    c.fillStyle = '#2d413c'; c.fillRect(x - 2, y - 2, 9, 8);
                    c.fillStyle = BLOCKS[type].color; c.fillRect(x, y, 6, 5);
                    c.fillStyle = type === Block.COAL ? '#526254' : type === Block.IRON ? '#e0b284' : '#d0f4d9'; c.fillRect(x, y, 3, 2);
                }
            }
            if (type === Block.LOG) {
                c.fillStyle = '#b08a53'; c.fillRect(5, 0, 4, TILE); c.fillRect(20, 0, 2, TILE);
                c.fillStyle = '#533e2c'; c.fillRect(12, 6, 3, 13); c.fillRect(26, 14, 3, 14);
            }
            if (type === Block.LEAVES) {
                for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#86a967' : '#3e674a'; c.fillRect(Math.floor(random() * 6) * 4, Math.floor(random() * 6) * 4, 8, 4); }
            }
            tiles.set(`${type}:${variant}`, tile);
        }
    }
}

function renderBackground() {
    ctx.fillStyle = '#1c3433'; ctx.fillRect(0, 0, view.width, view.height);
    const groundY = SURFACE * TILE - Math.round(view.y);
    if (groundY < 0) return;
    const sky = ctx.createLinearGradient(0, -view.y, 0, groundY);
    sky.addColorStop(0, '#b4d4c9'); sky.addColorStop(1, '#e4e6bb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, view.width, Math.min(view.height, groundY));
    const sunX = view.width * .78 - view.x * .06, sunY = 65 - view.y * .5;
    ctx.fillStyle = '#faf1bc'; ctx.fillRect(sunX, sunY, 32, 32);
    for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? '#97b5a0' : '#a5c3b0';
        ctx.beginPath(); ctx.moveTo(0, groundY);
        for (let x = -80; x <= view.width + 80; x += 16) {
            const h = 55 + Math.sin((x + view.x * .18) / 105 + layer * 4) * 27 + Math.cos(x / 52 + layer) * 12;
            ctx.lineTo(x, groundY - h + layer * 25);
        }
        ctx.lineTo(view.width + 80, groundY); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#f4f3d9';
    for (let i = 0; i < 5; i++) {
        const x = (i * 237 + 42 - view.x * .25) % (view.width + 160) - 60;
        const y = 40 + i % 3 * 28 - view.y * .7;
        ctx.fillRect(x, y, 50, 10); ctx.fillRect(x + 12, y - 7, 25, 7);
    }
}

function renderPlayer() {
    const x = Math.round(player.x - view.x), y = Math.round(player.y - view.y);
    const walk = player.grounded && player.vx ? Math.sin(player.x * .3) * 2 : 0;
    ctx.fillStyle = '#14352c40'; ctx.fillRect(x - 3, y + PLAYER_H - 1, 29, 3);
    ctx.fillStyle = '#253f3d'; ctx.fillRect(x + 3, y + 15, 16, 11);
    ctx.fillStyle = '#c39465'; ctx.fillRect(x + 4, y + 6, 15, 11);
    ctx.fillStyle = '#e6c568'; ctx.fillRect(x + 2, y + 2, 18, 7); ctx.fillRect(x, y + 8, 23, 3);
    ctx.fillStyle = '#f5f0c2'; ctx.fillRect(x + (player.facing > 0 ? 16 : 2), y + 4, 5, 5);
    ctx.fillStyle = '#243931'; ctx.fillRect(x + (player.facing > 0 ? 16 : 5), y + 12, 3, 3);
    ctx.fillStyle = '#7daeb0'; ctx.fillRect(x + 6, y + 17, 10, 8);
    ctx.fillStyle = '#2d3d36'; ctx.fillRect(x + 3, y + 25, 6, 4 + walk); ctx.fillRect(x + 14, y + 25, 6, 4 - walk);
    ctx.fillStyle = '#ad8052'; ctx.fillRect(x - 1, y + 17, 4, 7); ctx.fillRect(x + 19, y + 17, 4, 7);
    if (state.tool || state.mining) {
        ctx.save(); ctx.translate(x + (player.facing > 0 ? 25 : -3), y + 21);
        ctx.rotate(player.facing * (state.mining ? Math.sin(state.mining.time * 28) * .7 : -.3));
        ctx.fillStyle = '#bd9159'; ctx.fillRect(-1, -8, 3, 16);
        ctx.fillStyle = ['#b99d68', '#b99d68', '#b1b9a1', '#d4e5d3'][state.tool]; ctx.fillRect(-6, -9, 14, 4); ctx.fillRect(5, -6, 3, 4);
        ctx.restore();
    }
}

function render() {
    if (!state.grid.length) return;
    renderBackground();
    const ox = Math.round(view.x), oy = Math.round(view.y);
    const startX = Math.max(0, Math.floor(ox / TILE)), endX = Math.min(WORLD_WIDTH, Math.ceil((ox + view.width) / TILE));
    const startY = Math.max(0, Math.floor(oy / TILE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((oy + view.height) / TILE));
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const type = state.grid[y][x]; if (!type) continue;
            ctx.drawImage(tiles.get(`${type}:${(x * 7 + y * 11) % 3}`), x * TILE - ox, y * TILE - oy);
            if (type === Block.DIRT && y === SURFACE) {
                ctx.fillStyle = '#668b4d'; ctx.fillRect(x * TILE - ox, y * TILE - oy, TILE, 5);
                ctx.fillStyle = '#a0b465'; ctx.fillRect(x * TILE - ox, y * TILE - oy, TILE, 2);
                if (x % 3 === 1) { ctx.fillStyle = '#6a9258'; ctx.fillRect(x * TILE + 10 - ox, y * TILE - 5 - oy, 2, 5); ctx.fillRect(x * TILE + 16 - ox, y * TILE - 3 - oy, 2, 3); }
            }
        }
    }
    // A subtle underground vignette leaves ores and navigation readable.
    if (view.y > SURFACE * TILE) {
        const light = ctx.createRadialGradient(player.x - view.x, player.y - view.y, 70, player.x - view.x, player.y - view.y, view.width * .8);
        light.addColorStop(0, '#09232200'); light.addColorStop(1, '#09232266');
        ctx.fillStyle = light; ctx.fillRect(0, 0, view.width, view.height);
    }
    renderPlayer();
    if (pointer.visible && !state.paused) {
        const { x, y } = targetBlock();
        if (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT) {
            ctx.strokeStyle = inReach(x, y) ? '#f5df8c' : '#e9a18b'; ctx.lineWidth = 2;
            ctx.strokeRect(x * TILE - ox + 1, y * TILE - oy + 1, TILE - 2, TILE - 2);
            if (state.build && blockAt(x, y) === Block.AIR && inReach(x, y)) {
                ctx.globalAlpha = .45; ctx.drawImage(tiles.get(`${state.selected}:0`), x * TILE - ox, y * TILE - oy); ctx.globalAlpha = 1;
            }
        }
    }
    if (state.mining) {
        const mine = state.mining, ratio = Math.min(1, mine.time / miningDuration(mine.type));
        const x = mine.x * TILE - ox, y = mine.y * TILE - oy;
        ctx.fillStyle = `rgba(244,223,140,${ratio * .25})`; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#293b32'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 16, y + 2); ctx.lineTo(x + 13, y + 13); ctx.lineTo(x + 21, y + 18); ctx.lineTo(x + 12, y + 29); ctx.stroke();
        ctx.fillStyle = '#14382d'; ctx.fillRect(x, y + 34, TILE, 4);
        ctx.fillStyle = '#efd786'; ctx.fillRect(x, y + 34, TILE * ratio, 4);
    }
    for (const p of state.particles) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - view.x), Math.round(p.y - view.y), 4, 4); }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
    for (const label of state.labels) { ctx.globalAlpha = Math.min(1, label.life * 3); ctx.fillStyle = '#142e25'; ctx.fillText(label.text, label.x - view.x + 1, label.y - view.y + 1); ctx.fillStyle = '#f5e6ac'; ctx.fillText(label.text, label.x - view.x, label.y - view.y); }
    ctx.globalAlpha = 1;
}

function message(text, tone = '') {
    const box = $('message-box');
    if (box.textContent !== text) box.textContent = text;
    box.dataset.tone = tone;
}

function initInventory() {
    for (const type of ITEMS) {
        const button = document.createElement('button');
        button.className = 'inventory-item'; button.dataset.item = type;
        const icon = document.createElement('span'); icon.className = 'block-icon'; icon.style.background = BLOCKS[type].color;
        const name = document.createElement('span'); name.textContent = BLOCKS[type].name;
        const count = document.createElement('span'); count.className = 'item-count'; count.textContent = '0';
        button.append(icon, name, count);
        const buildable = type === Block.DIRT || type === Block.STONE;
        button.disabled = !buildable;
        if (buildable) button.addEventListener('click', () => { state.selected = type; state.uiDirty = true; updateUI(); message(`已选择${BLOCKS[type].name}，右键放置，或切换建造模式。`); });
        $('inventory-list').appendChild(button); inventoryElements.set(type, { button, count });
    }
}

function updateUI() {
    const depth = currentDepth(), column = Math.floor(player.x / TILE), row = Math.floor(player.y / TILE);
    if (depth !== state.lastDepth || column !== state.lastColumn || row !== state.lastRow) {
        $('depth-value').textContent = depth;
        $('coordinate-label').textContent = `X ${column} / Y ${row}`;
        $('zone-label').textContent = depth < 10 ? '地表 · 微风与树影' : depth < 22 ? '浅层 · 煤炭的踪迹' : depth < 52 ? '岩层 · 寻找铁矿' : '深处 · 钻石的微光';
        state.lastDepth = depth; state.lastColumn = column; state.lastRow = row;
    }
    if (!state.uiDirty) return;
    state.uiDirty = false;
    $('world-seed').textContent = '#' + state.seed.toString(16).padStart(8, '0').toUpperCase();
    $('current-tool').textContent = `${TOOL_NAMES[state.tool]} · Lv.${state.tool}`;
    $('best-depth').textContent = state.bestDepth; $('mined-count').textContent = state.mined; $('diamond-count').textContent = state.diamonds;
    let total = 0;
    for (const [type, { button, count }] of inventoryElements) {
        const amount = state.inventory[type] || 0; total += amount;
        count.textContent = amount; button.classList.toggle('selected', type === state.selected);
        button.setAttribute('aria-label', `${BLOCKS[type].name}，${amount} 个${type === 1 || type === 2 ? '，选择为建造材料' : ''}`);
        if (type === 1 || type === 2) button.setAttribute('aria-pressed', String(type === state.selected));
    }
    $('inventory-total').textContent = `${total} 件`;
    $('build-button').textContent = state.build ? '▦ 建造' : '⛏ 挖掘'; $('build-button').setAttribute('aria-pressed', String(state.build));
    for (const button of document.querySelectorAll('[data-level]')) {
        const level = Number(button.dataset.level), owned = state.tool >= level;
        const enough = Object.entries(RECIPES[level]).every(([type, count]) => (state.inventory[type] || 0) >= count);
        button.disabled = state.paused || owned || level !== state.tool + 1 || !enough;
        button.classList.toggle('owned', owned);
        button.querySelector('.craft-state').textContent = owned ? '已拥有 ✓' : level > state.tool + 1 ? '待解锁' : enough ? '制作 →' : '材料不足';
    }
    const goals = [
        ['一切从木头开始', '收集木头，打造第一把木镐。'],
        ['让工具更坚实', '收集木头与石头，升级为石镐。'],
        ['向更深处前进', '寻找铁矿，打造一把可靠的铁镐。'],
        ['遇见地底的微光', '前往 52 m 以下，采集你的第一颗钻石。']
    ];
    const complete = state.tool === 3 && state.diamonds > 0;
    $('objective-title').textContent = complete ? '这是你的第一道光' : goals[state.tool][0];
    $('objective-copy').textContent = complete ? '已找到钻石！继续探索，留下更深的足迹。' : goals[state.tool][1];
    $('objective-step').textContent = `0${state.tool + 1} / 04`;
    let progress, progressText;
    if (state.tool < 3) {
        const recipe = Object.entries(RECIPES[state.tool + 1]);
        progress = recipe.reduce((sum, [type, count]) => sum + Math.min(1, (state.inventory[type] || 0) / count), 0) / recipe.length;
        progressText = recipe.map(([type, count]) => `${BLOCKS[type].name} ${Math.min(count, state.inventory[type] || 0)}/${count}`).join(' · ');
    } else { progress = complete ? 1 : Math.min(.95, state.bestDepth / 55); progressText = complete ? '钻石已发现 ✓' : `最深 ${state.bestDepth} m · 目标：钻石`; }
    const percent = Math.round(progress * 100); $('objective-fill').style.width = percent + '%'; $('objective-progress').setAttribute('aria-valuenow', percent); $('objective-progress-text').textContent = progressText;
}

function saveGame(manual = false) {
    if (!state.grid.length) return false;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, grid: state.grid, inventory: state.inventory, seed: state.seed, tool: state.tool, mined: state.mined, diamonds: state.diamonds, bestDepth: state.bestDepth, player: { x: player.x, y: player.y } }));
        state.dirty = false; saveUnavailable = false;
        $('save-status').textContent = '进度已保存 ✓';
        if (manual) message('已保存到当前浏览器，下次打开可继续。', 'success');
        return true;
    } catch (_) {
        saveUnavailable = true; $('save-status').textContent = '存档不可用';
        if (manual) message('浏览器未允许本地存储，本次仍可正常游玩。', 'error');
        return false;
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
        const data = JSON.parse(raw);
        const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
        if (!data || data.version !== 1 || !Array.isArray(data.grid) || data.grid.length !== WORLD_HEIGHT || data.grid.some(row => !Array.isArray(row) || row.length !== WORLD_WIDTH || row.some(type => !integer(type, 0, 8)))) return false;
        if (!integer(data.seed, 0, 4294967295) || !integer(data.tool, 0, 3) || !integer(data.mined, 0, 1e9) || !integer(data.diamonds, 0, 1e9) || !integer(data.bestDepth, 0, WORLD_HEIGHT - SURFACE)) return false;
        if (!data.inventory || Array.isArray(data.inventory) || typeof data.inventory !== 'object' || Object.entries(data.inventory).some(([type, count]) => !ITEMS.includes(Number(type)) || !integer(count, 0, 1e9))) return false;
        if (!data.player || !Number.isFinite(data.player.x) || !Number.isFinite(data.player.y) || data.player.x < 0 || data.player.x > WORLD_WIDTH * TILE - PLAYER_W || data.player.y < 0 || data.player.y > (WORLD_HEIGHT - 1) * TILE - PLAYER_H) return false;
        if (data.grid[WORLD_HEIGHT - 1].some(type => type !== Block.BEDROCK)) return false;
        for (const key of ['grid', 'inventory', 'seed', 'tool', 'mined', 'diamonds', 'bestDepth']) state[key] = data[key];
        Object.assign(player, { x: data.player.x, y: data.player.y, vx: 0, vy: 0 });
        if (collides(player.x, player.y)) returnToSurface(false);
        state.uiDirty = true;
        message('欢迎回来，上次的世界已为你保留。', 'success');
        $('save-status').textContent = '已读取本地存档';
        return true;
    } catch (_) { return false; }
}

function clearInput() {
    keyboard.clear(); touchKeys.clear(); pointer.held = false; pointer.id = null; player.jumpBuffer = 0; player.vx = 0; state.mining = null;
}

function setPaused(paused) {
    state.paused = paused; clearInput(); accumulator = 0; previousTime = 0;
    $('pause-overlay').hidden = !paused;
    $('pause-button').textContent = paused ? '▶ 继续' : 'Ⅱ 暂停';
    $('pause-button').setAttribute('aria-pressed', String(paused));
    $('pause-button').setAttribute('aria-label', paused ? '继续游戏' : '暂停游戏');
    state.uiDirty = true; updateUI(); render();
    if (paused) { saveGame(); $('resume-button').focus({ preventScroll: true }); }
    else canvas.focus({ preventScroll: true });
}

function toggleBuild() {
    state.build = !state.build; state.mining = null; state.uiDirty = true; updateUI();
    message(state.build ? `建造模式：点击空位放置${BLOCKS[state.selected].name}。` : '挖掘模式：点击挖一块，按住连续挖掘。');
}

function readPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) * view.width / rect.width;
    pointer.y = (event.clientY - rect.top) * view.height / rect.height;
    pointer.visible = true;
}

function bindInputs() {
    const keyActions = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'jump', ArrowUp: 'jump', Space: 'jump' };
    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable=true]') || $('reset-dialog').open) return;
        // Preserve native Space/Enter activation when a button or summary has focus.
        if ((event.code === 'Space' || event.code === 'Enter') && event.target.closest('button,summary,a')) return;
        const action = keyActions[event.code];
        if (action) { event.preventDefault(); if (state.paused) return; if (action === 'jump') { if (!event.repeat) player.jumpBuffer = .15; } else keyboard.add(action); }
        if (event.repeat) return;
        if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); setPaused(!state.paused); }
        if (state.paused) return;
        if (event.code === 'KeyR') returnToSurface();
        if (event.code === 'KeyB') toggleBuild();
        if (event.code === 'Digit1' || event.code === 'Digit2') { state.selected = event.code === 'Digit1' ? Block.DIRT : Block.STONE; state.uiDirty = true; }
    });
    document.addEventListener('keyup', event => { const action = keyActions[event.code]; if (action) keyboard.delete(action); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
        if (state.paused || pointer.id !== null || (event.button !== 0 && event.button !== 2)) return;
        event.preventDefault(); canvas.focus({ preventScroll: true }); readPointer(event);
        pointer.id = event.pointerId; canvas.setPointerCapture(event.pointerId);
        if (event.button === 2 || state.build) placeBlock();
        else { pointer.held = true; beginMining(true); }
    });
    canvas.addEventListener('pointermove', event => { if (pointer.id === null || pointer.id === event.pointerId) readPointer(event); });
    canvas.addEventListener('pointerup', event => { if (pointer.id !== event.pointerId) return; pointer.held = false; pointer.id = null; if (event.pointerType === 'touch') pointer.visible = false; });
    const cancelPointer = event => { if (pointer.id !== null && pointer.id !== event.pointerId) return; pointer.held = false; pointer.id = null; state.mining = null; };
    canvas.addEventListener('pointercancel', cancelPointer);
    canvas.addEventListener('lostpointercapture', event => { if (pointer.id === event.pointerId) cancelPointer(event); });
    canvas.addEventListener('pointerleave', () => { if (pointer.id === null) pointer.visible = false; });
    for (const [id, action] of [['control-left', 'left'], ['control-right', 'right'], ['control-jump', 'jump']]) {
        const button = $(id);
        button.addEventListener('pointerdown', event => { if (state.paused) return; event.preventDefault(); button.setPointerCapture(event.pointerId); touchKeys.set(event.pointerId, action); if (action === 'jump') player.jumpBuffer = .15; });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => touchKeys.delete(event.pointerId));
    }
    $('pause-button').addEventListener('click', () => setPaused(!state.paused));
    $('resume-button').addEventListener('click', () => setPaused(false));
    $('save-button').addEventListener('click', () => saveGame(true));
    $('surface-button').addEventListener('click', () => { if (!state.paused) returnToSurface(); });
    $('build-button').addEventListener('click', () => { if (!state.paused) toggleBuild(); });
    for (const button of document.querySelectorAll('[data-level]')) button.addEventListener('click', () => craftTool(Number(button.dataset.level)));
    $('reset-button').addEventListener('click', () => { resetWasPaused = state.paused; setPaused(true); $('reset-dialog').returnValue = 'cancel'; $('reset-dialog').showModal(); });
    $('reset-dialog').addEventListener('close', () => {
        if ($('reset-dialog').returnValue === 'reset') { generateWorld(); message('新世界已就绪。从第一块木头开始吧。'); saveGame(); setPaused(false); }
        else setPaused(resetWasPaused);
    });
    window.addEventListener('blur', () => { if (!$('reset-dialog').open && !state.paused) setPaused(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { setPaused(true); saveGame(); } });
    window.addEventListener('pagehide', () => { if (state.dirty) saveGame(); });
    new ResizeObserver(resizeCanvas).observe($('canvas-wrap'));
}

function frame(time) {
    const dt = previousTime ? Math.min(.1, Math.max(0, (time - previousTime) / 1000)) : 0;
    previousTime = time;
    if (!state.paused) {
        accumulator += dt;
        while (accumulator >= STEP) { update(STEP); accumulator -= STEP; }
        render();
        uiElapsed += dt; saveElapsed += dt;
        if (uiElapsed >= .1) { updateUI(); uiElapsed = 0; }
        if (saveElapsed >= 5) { if (state.dirty && !saveUnavailable) saveGame(); saveElapsed = 0; }
    }
    requestAnimationFrame(frame);
}

createTextures();
initInventory();
if (!loadGame()) generateWorld();
bindInputs();
resizeCanvas();
updateUI();
requestAnimationFrame(frame);
