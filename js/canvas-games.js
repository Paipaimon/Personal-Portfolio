/* Automatic game models shared by the homepage canvas and their Node checks. */
(function (root) {
    'use strict';

    function seededRandom(seed) {
        let value = 2166136261;
        for (const character of String(seed)) value = Math.imul(value ^ character.codePointAt(0), 16777619) >>> 0;
        return () => {
            value = (value + 0x6D2B79F5) >>> 0;
            let mixed = Math.imul(value ^ (value >>> 15), value | 1);
            mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
            return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
        };
    }

    class AutoSnake {
        constructor({ seed = 'canvas-2026', variant = 0, random = null } = {}) {
            this.seed = String(seed).slice(0, 80);
            this.variant = variant;
            this.randomOverride = random;
            this.size = 12;
            this.rounds = 0;
            this.interval = 0.045;
            // Cycle order is the safety invariant. Shortcuts may skip empty
            // cells, but cannot overtake the tail or the next piece of food.
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
            this.order = Array(this.size * this.size);
            this.cycle.forEach((cell, index) => { this.order[this.id(cell)] = index; });
            this.plan = null;
            this.reset();
        }

        id(cell) { return cell.y * this.size + cell.x; }
        cell(id) { return { x: id % this.size, y: Math.floor(id / this.size) }; }
        distance(from, to) { return (this.order[to] - this.order[from] + this.cycle.length) % this.cycle.length; }

        reset(seed = this.seed) {
            this.seed = String(seed).slice(0, 80);
            if (this.plan && this.plan.seed !== this.seed) this.plan = null;
            if (this.plan) this.variant = this.plan.variant;
            this.random = this.randomOverride || seededRandom(this.seed);
            const choose = seededRandom(`${this.seed} / route / ${this.variant}`);
            this.directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (let i = this.directions.length - 1; i > 0; i--) {
                const j = Math.floor(choose() * (i + 1));
                [this.directions[i], this.directions[j]] = [this.directions[j], this.directions[i]];
            }
            this.rounds++;
            this.headIndex = 3;
            this.body = [3, 2, 1, 0].map(index => ({ ...this.cycle[index] }));
            this.score = 0;
            this.steps = 0;
            this.won = false;
            this.elapsed = 0;
            this.restartIn = 1.8;
            this.route = [];
            this.replayIndex = 0;
            this.lastPathLength = null;
            this.status = this.plan ? 'ready' : 'live';
            this.placeFood();
        }

        placeFood() {
            const occupied = new Set(this.body.map(cell => this.id(cell)));
            const available = [];
            for (let id = 0; id < this.cycle.length; id++) if (!occupied.has(id)) available.push(id);
            this.food = available.length ? this.cell(available[Math.floor(this.random() * available.length)]) : null;
            this.route = [];
        }

        neighbors(id) {
            const { x, y } = this.cell(id);
            return this.directions.flatMap(([dx, dy]) => {
                const nx = x + dx, ny = y + dy;
                return nx >= 0 && nx < this.size && ny >= 0 && ny < this.size ? [ny * this.size + nx] : [];
            });
        }

        findShortestFoodPath() {
            if (!this.food) return [];
            const head = this.id(this.body[0]), food = this.id(this.food);
            const occupied = new Set(this.body.slice(1).map(cell => this.id(cell)));
            const limit = Math.min(this.distance(head, food), this.distance(head, this.id(this.body.at(-1))) - 1);
            const parent = new Int16Array(this.cycle.length).fill(-1);
            const queue = [head];
            parent[head] = head;
            for (let i = 0; i < queue.length && parent[food] < 0; i++) {
                const current = queue[i];
                for (const next of this.neighbors(current)) {
                    const advance = this.distance(head, next);
                    if (parent[next] >= 0 || occupied.has(next) || advance > limit || advance <= this.distance(head, current)) continue;
                    parent[next] = current;
                    queue.push(next);
                }
            }
            if (parent[food] < 0) return [];
            const path = [];
            for (let current = food; current !== head; current = parent[current]) path.push(current);
            return path.reverse();
        }

        chooseMove() {
            if (!this.route.length) {
                this.route = this.findShortestFoodPath();
                this.lastPathLength = this.route.length || null;
            }
            if (this.route.length) return this.route.shift();
            const head = this.id(this.body[0]), tail = this.id(this.body.at(-1)), food = this.id(this.food);
            const occupied = new Set(this.body.slice(0, -1).map(cell => this.id(cell)));
            const tailDistance = this.distance(head, tail), foodDistance = this.distance(head, food);
            let best = null, largestAdvance = 0;
            for (const next of this.neighbors(head)) {
                const advance = this.distance(head, next);
                if (occupied.has(next) || !advance || advance > foodDistance || advance > tailDistance || (next === food && advance === tailDistance)) continue;
                if (advance > largestAdvance) { best = next; largestAdvance = advance; }
            }
            if (best === null) throw new Error('Snake cycle-order invariant failed');
            return best;
        }

        applyPlan(plan) {
            if (!plan || typeof plan.seed !== 'string' || !Number.isInteger(plan.variant) || !Array.isArray(plan.moves)
                || !plan.moves.length || !plan.moves.every(id => Number.isInteger(id) && id >= 0 && id < this.cycle.length)) {
                throw new Error('Invalid seeded snake plan');
            }
            this.plan = { ...plan, moves: plan.moves.slice() };
            this.randomOverride = null;
            this.reset(plan.seed);
        }

        step() {
            if (this.won) return null;
            const nextId = this.plan ? this.plan.moves[this.replayIndex++] : this.chooseMove();
            const next = this.cell(nextId);
            const eating = this.food && next.x === this.food.x && next.y === this.food.y;
            const head = this.body[0];
            if (!Number.isInteger(nextId) || Math.abs(head.x - next.x) + Math.abs(head.y - next.y) !== 1
                || this.body.slice(0, eating ? undefined : -1).some(cell => this.id(cell) === nextId)) {
                throw new Error('Invalid snake replay move');
            }
            this.headIndex = this.order[nextId];
            this.body.unshift(next);
            if (eating) {
                this.score++;
                this.won = this.body.length === this.size * this.size;
                this.placeFood();
            } else {
                this.body.pop();
            }
            this.steps++;
            return nextId;
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

    function planSnakeCandidates(seed, { candidates = 8, onProgress = () => {} } = {}) {
        seed = String(seed).slice(0, 80);
        candidates = Math.max(1, Math.min(24, Math.floor(candidates) || 8));
        let best = null;
        const candidateSteps = [];
        for (let variant = 0; variant < candidates; variant++) {
            const trial = new AutoSnake({ seed, variant });
            const moves = [];
            // Without passing food or overtaking the tail, each apple takes at
            // most one full 144-cell circuit; this is also a bounded watchdog.
            while (!trial.won && trial.steps < 21000) moves.push(trial.step());
            if (!trial.won) throw new Error('Seeded snake candidate did not fill the board');
            candidateSteps.push(trial.steps);
            if (!best || trial.steps < best.steps) best = { seed, variant, moves, steps: trial.steps };
            onProgress({ completed: variant + 1, total: candidates, bestSteps: best.steps });
        }
        return { ...best, candidates, candidateSteps, strategy: 'BFS shortest safe food paths; shortest winning candidate' };
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

    const games = { AutoSnake, AutoTetris, planSnakeCandidates };
    root.CanvasGames = games;
    if (typeof module !== 'undefined' && module.exports) module.exports = games;
})(typeof globalThis !== 'undefined' ? globalThis : window);
