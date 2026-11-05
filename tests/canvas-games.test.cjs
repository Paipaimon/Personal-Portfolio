const test = require('node:test');
const assert = require('node:assert/strict');
const { AutoSnake, AutoTetris, planSnakeCandidates } = require('../js/canvas-games.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

function assertSnakeLegal(game) {
    const occupied = new Set();
    for (const [index, cell] of game.body.entries()) {
        assert.ok(cell.x >= 0 && cell.x < 12 && cell.y >= 0 && cell.y < 12, 'snake stays within the board');
        const key = `${cell.x},${cell.y}`;
        assert.ok(!occupied.has(key), 'snake never intersects itself');
        occupied.add(key);
        if (index) {
            const previous = game.body[index - 1];
            assert.equal(Math.abs(previous.x - cell.x) + Math.abs(previous.y - cell.y), 1, 'body remains connected');
        }
    }
    if (game.food) assert.ok(!occupied.has(`${game.food.x},${game.food.y}`), 'food occupies a free cell');
}

test('12 × 12 snake eats, fills the board without a collision and automatically restarts', () => {
    for (const seed of [1, 42, 8103]) {
        const game = new AutoSnake({ random: seededRandom(seed) });
        assert.equal(game.size, 12);
        let steps = 0;
        while (!game.won && steps++ < 21000) {
            const previousLength = game.body.length;
            const previousScore = game.score;
            game.step();
            assertSnakeLegal(game);
            assert.equal(game.body.length - previousLength, game.score - previousScore, 'growth corresponds to food eaten');
        }
        assert.ok(game.won, 'a full board is eventually reached');
        assert.equal(game.body.length, 144);
        assert.equal(game.food, null);
        assert.equal(game.score, 140);
        game.update(0.5);
        assert.ok(game.won, 'win state remains visible before restarting');
        for (let i = 0; i < 3; i++) game.update(0.5);
        assert.equal(game.rounds, 2);
        assert.equal(game.score, 0);
        assert.equal(game.body.length, 4);
        assertSnakeLegal(game);
    }
});

test('seeded food and route choices replay exactly, while different seeds produce distinct games', () => {
    const a = new AutoSnake({ seed: 'same-seed', variant: 3 });
    const b = new AutoSnake({ seed: 'same-seed', variant: 3 });
    const c = new AutoSnake({ seed: 'another-seed', variant: 3 });
    assert.deepEqual(a.food, b.food);
    const moves = [];
    const other = [];
    for (let i = 0; i < 240; i++) {
        moves.push(a.step());
        assert.equal(moves.at(-1), b.step());
        assert.deepEqual(a.food, b.food);
        other.push(c.step());
    }
    assert.notDeepEqual(moves, other);
    a.reset();
    for (const move of moves) assert.equal(a.step(), move, 'restarting the same seed reproduces the entire route');
});

test('shortest safe food path reaches a reachable apple in its Manhattan lower-bound number of moves', () => {
    const game = new AutoSnake({ seed: 'shortest' });
    game.food = { x: 5, y: 2 };
    const start = game.body[0];
    const lowerBound = Math.abs(start.x - game.food.x) + Math.abs(start.y - game.food.y);
    const route = game.findShortestFoodPath();
    assert.equal(route.length, lowerBound);
    assert.equal(route.at(-1), game.id(game.food));
    for (let step = 0; step < lowerBound; step++) {
        game.step();
        assertSnakeLegal(game);
    }
    assert.equal(game.score, 1);
    assert.equal(game.steps, lowerBound);
});

test('the opening snake reaches every possible first apple by a shortest path, including BFS ties', () => {
    for (let foodId = 4; foodId < 144; foodId++) {
        const game = new AutoSnake({ seed: 'opening-optimality' });
        game.food = game.cell(foodId);
        const head = game.body[0];
        const shortest = Math.abs(head.x - game.food.x) + Math.abs(head.y - game.food.y);
        while (!game.score && game.steps <= shortest) {
            game.step();
            assertSnakeLegal(game);
        }
        assert.equal(game.score, 1, `first apple ${foodId} is reached without a detour`);
        assert.equal(game.steps, shortest, 'planning starts with the initial apple, rather than circling first');
    }
});

test('adaptive food paths leave the original fixed circuit while preserving a legal live snake', () => {
    const game = new AutoSnake({ seed: 'adaptive-path' });
    const originalOrder = game.order.slice();
    let leftOriginalCircuit = false;
    for (let step = 0; step < 800; step++) {
        game.step();
        assertSnakeLegal(game);
        let span = 0;
        for (let i = game.body.length - 1; i > 0; i--) {
            span += (originalOrder[game.id(game.body[i - 1])] - originalOrder[game.id(game.body[i])] + 144) % 144;
        }
        if (span >= 144) leftOriginalCircuit = true;
    }
    assert.ok(leftOriginalCircuit, 'the live body is no longer constrained to the initial circuit order');
    assert.ok(game.rewires > 0);
    assert.ok(game.directPaths > 0);
    assert.ok(game.score > 20, 'adaptive motion continues eating rather than only changing a debug route');
});

test('a direct food shortcut is rejected if its grown virtual body closes the only escape', () => {
    const game = new AutoSnake({ seed: 'virtual-tail' });
    game.body = [[2, 2], [2, 1], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 4]]
        .map(([x, y]) => ({ x, y }));
    game.food = { x: 1, y: 2 };
    const before = JSON.stringify(game.body);
    assert.equal(game.escapesAfterFood([game.id(game.food)]), false, 'eating inside the enclosed pocket would trap the head');
    game.food = { x: 3, y: 2 };
    assert.equal(game.escapesAfterFood([game.id(game.food)]), true, 'an equally short route into open space retains a path to the tail');
    assert.equal(JSON.stringify(game.body), before, 'planning never mutates the real snake');
});

test('adaptive live routing fills the board for diverse random seeds without a replay plan', () => {
    for (const seed of ['adaptive-0', 'adaptive-1', 'adaptive-2', 'adaptive-3', '随机路线', '🌱', 'negative-1', 'longer-seed-2026']) {
        const game = new AutoSnake({ seed });
        while (!game.won && game.steps < 21000) {
            game.step();
            assertSnakeLegal(game);
        }
        assert.equal(game.plan, null, 'the no-Worker fallback computes decisions from live state');
        assert.ok(game.won, `seed ${seed} eventually fills the board`);
        assert.equal(game.score, 140);
        assert.ok(game.rewires > 0, 'the safety circuit changes during the round');
    }
});

test('seed search chooses the fewest-step winning candidate and its replay fills the board legally', () => {
    for (const seed of ['canvas-2026', '42', '8103']) {
        const progress = [];
        const plan = planSnakeCandidates(seed, { onProgress: item => progress.push(item) });
        assert.equal(plan.candidates, 8);
        assert.equal(progress.length, 8);
        assert.equal(progress.at(-1).completed, 8);
        assert.equal(plan.steps, Math.min(...plan.candidateSteps));
        assert.equal(plan.moves.length, plan.steps);
        assert.ok(plan.steps < 12000, 'safe food shortcuts improve on long fixed-cycle sweeps');
        const game = new AutoSnake();
        game.applyPlan(plan);
        while (!game.won) {
            game.step();
            assertSnakeLegal(game);
        }
        assert.equal(game.score, 140);
        assert.equal(game.steps, plan.steps);
        game.reset();
        for (let i = 0; i < 100; i++) assert.equal(game.step(), plan.moves[i]);
        game.reset('a-new-seed');
        assert.equal(game.plan, null, 'changing seed cannot reuse a stale replay');
        assert.equal(game.status, 'live', 'a live seeded game runs without a Worker or precomputed plan');
    }
});

test('worker reports bounded search progress and returns a reproducible winning plan', () => {
    const messages = [];
    const worker = {
        self: { postMessage: message => messages.push(message) },
        importScripts: filename => {
            assert.equal(filename, 'canvas-games.js');
            worker.CanvasGames = { AutoSnake, AutoTetris, planSnakeCandidates };
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/canvas-snake-worker.js'), 'utf8'), worker);
    worker.self.onmessage({ data: { id: 17, seed: 'worker-seed' } });
    assert.equal(messages.filter(message => message.type === 'progress').length, 8);
    const complete = messages.at(-1);
    assert.equal(complete.id, 17);
    assert.equal(complete.type, 'complete');
    assert.equal(complete.plan.seed, 'worker-seed');
    const game = new AutoSnake();
    game.applyPlan(complete.plan);
    while (!game.won) game.step();
    assert.equal(game.steps, complete.plan.steps);
    worker.CanvasGames.planSnakeCandidates = () => { throw new Error('test failure'); };
    worker.self.onmessage({ data: { id: 18, seed: 'error' } });
    assert.equal(messages.at(-1).type, 'error');
    assert.equal(messages.at(-1).id, 18);
});

test('snake fixed time steps do not depend on frame rate or advance on invalid time', () => {
    const a = new AutoSnake({ random: seededRandom(12) });
    const b = new AutoSnake({ random: seededRandom(12) });
    for (let i = 0; i < 160; i++) a.update(0.01);
    for (let i = 0; i < 20; i++) b.update(0.08);
    assert.deepEqual(a.body, b.body);
    assert.equal(a.score, b.score);
    const snapshot = JSON.stringify(a.body);
    for (const dt of [NaN, Infinity, -1, 0]) a.update(dt);
    assert.equal(JSON.stringify(a.body), snapshot);
});

test('tetris clears complete rows, preserves partial rows and awards multi-line scores', () => {
    const game = new AutoTetris({ random: seededRandom(1) });
    assert.equal(game.columns, 10);
    assert.equal(game.rows, 16);
    game.board[15].fill(2);
    game.board[14].fill(3);
    game.board[13][4] = 5;
    assert.equal(game.clearLines(), 2);
    assert.equal(game.lines, 2);
    assert.equal(game.score, 300);
    assert.equal(game.board.length, 16);
    assert.equal(game.board[15][4], 5);
    assert.equal(game.board[15].filter(Boolean).length, 1);
    assert.ok(game.board[0].every(cell => !cell));
});

test('tetris planner completes an available line and visibly drops its piece before locking', () => {
    const game = new AutoTetris({ random: seededRandom(2) });
    game.board[15] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1];
    const plan = game.planPiece([[1, 1, 1, 1]]);
    assert.equal(plan.x, 3);
    assert.equal(plan.y, 15);
    assert.equal(plan.matrix.length, 1);
    game.piece = { matrix: plan.matrix, x: plan.x, y: -1, color: 1 };
    const initialY = game.piece.y;
    game.update(game.interval);
    assert.equal(game.piece.y, initialY + 1, 'one update advances one row');
    assert.equal(game.pieces, 0, 'piece is not instantly locked at its target');
    while (!game.pieces) game.step();
    assert.equal(game.lines, 1);
    assert.ok(game.board.every(row => row.every(cell => !cell)));
});

test('tetris detects walls, floor and occupied cells; a top-out starts a clean round', () => {
    const game = new AutoTetris({ random: seededRandom(4) });
    assert.equal(game.fits([[1, 1]], -1, 0), false);
    assert.equal(game.fits([[1, 1]], 9, 0), false);
    assert.equal(game.fits([[1]], 0, 16), false);
    game.board[15][0] = 4;
    assert.equal(game.fits([[1]], 0, 15), false);
    game.board = Array.from({ length: 16 }, () => Array(10).fill(1));
    game.spawnPiece();
    assert.equal(game.rounds, 2);
    assert.equal(game.lines, 0);
    assert.ok(game.board.every(row => row.every(cell => !cell)));
    assert.ok(game.fits(game.piece.matrix, game.piece.x, game.piece.y));
});

test('tetris runs for thousands of falling steps with valid pieces, cells and line clears', () => {
    for (const seed of [11, 93, 710]) {
        const game = new AutoTetris({ random: seededRandom(seed) });
        let observedLines = 0;
        let previousLines = 0;
        let previousRound = game.rounds;
        for (let step = 0; step < 12000; step++) {
            game.step();
            assert.equal(game.board.length, 16);
            assert.ok(game.board.every(row => row.length === 10 && row.every(cell => Number.isInteger(cell) && cell >= 0 && cell <= 7)));
            assert.ok(game.board.every(row => row.some(cell => !cell)), 'completed rows are removed');
            assert.ok(game.fits(game.piece.matrix, game.piece.x, game.piece.y), 'falling pieces remain legal');
            if (game.rounds === previousRound) observedLines += game.lines - previousLines;
            previousLines = game.lines;
            previousRound = game.rounds;
        }
        assert.ok(observedLines > 100, 'AI repeatedly clears lines during continuous play');
    }
});
