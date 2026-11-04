/* Automatic game models shared by the homepage canvas and their Node checks. */
(function (root) {
    'use strict';

    class AutoSnake {
        constructor({ random = Math.random } = {}) {
            this.random = random;
            this.size = 12;
            this.rounds = 0;
            this.interval = 0.08;
            // A closed route visits every cell once. Following it leaves no traps,
            // even when the snake fills the entire 12 × 12 board.
            this.cycle = [];
            for (let x = 0; x < this.size; x++) this.cycle.push({ x, y: 0 });
            for (let y = 1; y < this.size; y++) {
                if (y % 2) {
                    for (let x = this.size - 1; x >= 1; x--) this.cycle.push({ x, y });
                } else {
                    for (let x = 1; x < this.size; x++) this.cycle.push({ x, y });
                }
            }
            for (let y = this.size - 1; y >= 1; y--) this.cycle.push({ x: 0, y });
            this.reset();
        }

        reset() {
            this.rounds++;
            this.headIndex = 3;
            this.body = [3, 2, 1, 0].map(index => ({ ...this.cycle[index] }));
            this.score = 0;
            this.won = false;
            this.elapsed = 0;
            this.restartIn = 1.8;
            this.placeFood();
        }

        placeFood() {
            const occupied = new Set(this.body.map(cell => cell.y * this.size + cell.x));
            const available = this.cycle.filter(cell => !occupied.has(cell.y * this.size + cell.x));
            this.food = available.length ? { ...available[Math.floor(this.random() * available.length)] } : null;
        }

        step() {
            if (this.won) return;
            this.headIndex = (this.headIndex + 1) % this.cycle.length;
            const next = { ...this.cycle[this.headIndex] };
            const eating = this.food && next.x === this.food.x && next.y === this.food.y;
            this.body.unshift(next);
            if (eating) {
                this.score++;
                this.won = this.body.length === this.size * this.size;
                this.placeFood();
            } else {
                this.body.pop();
            }
        }

        update(dt) {
            if (!Number.isFinite(dt) || dt <= 0) return;
            // Do not fast-forward a hidden tab through several minutes of play.
            dt = Math.min(dt, 0.5);
            if (this.won) {
                this.restartIn -= dt;
                if (this.restartIn <= 0) this.reset();
                return;
            }
            this.elapsed += dt;
            while (this.elapsed >= this.interval) {
                this.elapsed -= this.interval;
                this.step();
                if (this.won) break;
            }
        }
    }

    const SHAPES = [
        [[1, 1, 1, 1]],
        [[1, 1], [1, 1]],
        [[0, 1, 0], [1, 1, 1]],
        [[0, 1, 1], [1, 1, 0]],
        [[1, 1, 0], [0, 1, 1]],
        [[1, 0, 0], [1, 1, 1]],
        [[0, 0, 1], [1, 1, 1]]
    ];

    function rotate(matrix) {
        return matrix[0].map((_, x) => matrix.map(row => row[x]).reverse());
    }

    class AutoTetris {
        constructor({ random = Math.random } = {}) {
            this.random = random;
            this.columns = 10;
            this.rows = 20;
            this.interval = 0.075;
            this.rounds = 0;
            this.reset();
        }

        reset() {
            this.rounds++;
            this.board = Array.from({ length: this.rows }, () => Array(this.columns).fill(0));
            this.lines = 0;
            this.score = 0;
            this.pieces = 0;
            this.elapsed = 0;
            this.bag = [];
            this.spawnPiece();
        }

        nextShape() {
            if (!this.bag.length) {
                this.bag = [0, 1, 2, 3, 4, 5, 6];
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
            }
            return this.bag.pop();
        }

        fits(matrix, x, y, board = this.board) {
            return matrix.every((row, dy) => row.every((cell, dx) => {
                if (!cell) return true;
                const bx = x + dx;
                const by = y + dy;
                return bx >= 0 && bx < this.columns && by < this.rows && (by < 0 || !board[by][bx]);
            }));
        }

        planPiece(shape) {
            let matrix = shape;
            let best = null;
            const seen = new Set();
            for (let rotation = 0; rotation < 4; rotation++, matrix = rotate(matrix)) {
                const signature = JSON.stringify(matrix);
                if (seen.has(signature)) continue;
                seen.add(signature);
                for (let x = 0; x <= this.columns - matrix[0].length; x++) {
                    let y = -matrix.length;
                    while (this.fits(matrix, x, y + 1)) y++;
                    // A placement that leaves a cell above the board tops out.
                    if (matrix.some((row, dy) => row.some(cell => cell && y + dy < 0))) continue;
                    const board = this.board.map(row => row.slice());
                    matrix.forEach((row, dy) => row.forEach((cell, dx) => {
                        if (cell) board[y + dy][x + dx] = 1;
                    }));
                    const remaining = board.filter(row => row.some(cell => !cell));
                    const cleared = this.rows - remaining.length;
                    while (remaining.length < this.rows) remaining.unshift(Array(this.columns).fill(0));
                    const heights = Array(this.columns).fill(0);
                    let holes = 0;
                    for (let column = 0; column < this.columns; column++) {
                        let filled = false;
                        for (let row = 0; row < this.rows; row++) {
                            if (remaining[row][column]) {
                                if (!filled) heights[column] = this.rows - row;
                                filled = true;
                            } else if (filled) holes++;
                        }
                    }
                    const totalHeight = heights.reduce((sum, height) => sum + height, 0);
                    const bumpiness = heights.slice(1).reduce((sum, height, i) => sum + Math.abs(height - heights[i]), 0);
                    const score = cleared * 7 - holes * 4 - totalHeight * 0.51
                        - bumpiness * 0.36 - Math.max(...heights) * 0.4;
                    if (!best || score > best.score) best = { matrix, x, y, score };
                }
            }
            return best;
        }

        spawnPiece() {
            const shapeIndex = this.nextShape();
            const plan = this.planPiece(SHAPES[shapeIndex]);
            if (!plan) {
                this.reset();
                return;
            }
            this.piece = { matrix: plan.matrix, x: plan.x, y: -plan.matrix.length, color: shapeIndex + 1 };
        }

        clearLines() {
            const remaining = this.board.filter(row => row.some(cell => !cell));
            const cleared = this.rows - remaining.length;
            while (remaining.length < this.rows) remaining.unshift(Array(this.columns).fill(0));
            this.board = remaining;
            this.lines += cleared;
            this.score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
            return cleared;
        }

        lockPiece() {
            const { matrix, x, y, color } = this.piece;
            if (matrix.some((row, dy) => row.some(cell => cell && y + dy < 0))) {
                this.reset();
                return;
            }
            matrix.forEach((row, dy) => row.forEach((cell, dx) => {
                if (cell) this.board[y + dy][x + dx] = color;
            }));
            this.pieces++;
            this.clearLines();
            this.spawnPiece();
        }

        step() {
            const { matrix, x, y } = this.piece;
            if (this.fits(matrix, x, y + 1)) this.piece.y++;
            else this.lockPiece();
        }

        update(dt) {
            if (!Number.isFinite(dt) || dt <= 0) return;
            this.elapsed += Math.min(dt, 0.5);
            while (this.elapsed >= this.interval) {
                this.elapsed -= this.interval;
                this.step();
            }
        }
    }

    const games = { AutoSnake, AutoTetris };
    root.CanvasGames = games;
    if (typeof module !== 'undefined' && module.exports) module.exports = games;
})(typeof globalThis !== 'undefined' ? globalThis : window);
