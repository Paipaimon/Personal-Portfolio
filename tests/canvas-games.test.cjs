const test = require('node:test');
const assert = require('node:assert/strict');
const { AutoSnake, AutoTetris } = require('../js/canvas-games.js');

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
        for (let i = 0; i < 4; i++) game.update(0.5);
        assert.equal(game.rounds, 2);
        assert.equal(game.score, 0);
        assert.equal(game.body.length, 4);
        assertSnakeLegal(game);
    }
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
    game.board[19].fill(2);
    game.board[18].fill(3);
    game.board[17][4] = 5;
    assert.equal(game.clearLines(), 2);
    assert.equal(game.lines, 2);
    assert.equal(game.score, 300);
    assert.equal(game.board.length, 20);
    assert.equal(game.board[19][4], 5);
    assert.equal(game.board[19].filter(Boolean).length, 1);
    assert.ok(game.board[0].every(cell => !cell));
});

test('tetris planner completes an available line and visibly drops its piece before locking', () => {
    const game = new AutoTetris({ random: seededRandom(2) });
    game.board[19] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1];
    const plan = game.planPiece([[1, 1, 1, 1]]);
    assert.equal(plan.x, 3);
    assert.equal(plan.y, 19);
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
    assert.equal(game.fits([[1]], 0, 20), false);
    game.board[19][0] = 4;
    assert.equal(game.fits([[1]], 0, 19), false);
    game.board = Array.from({ length: 20 }, () => Array(10).fill(1));
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
            assert.equal(game.board.length, 20);
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
