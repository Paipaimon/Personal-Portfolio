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
            // This initial cycle is only a safety scaffold. It is rewired around
            // the live snake as food changes; it is not the scoring route.
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
            this.baseCycle = this.cycle.map(cell => ({ ...cell }));
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
            this.choose = seededRandom(`${this.seed} / route / ${this.variant}`);
            this.cycle = this.baseCycle.map(cell => ({ ...cell }));
            this.cycle.forEach((cell, index) => { this.order[this.id(cell)] = index; });
            this.directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (let i = this.directions.length - 1; i > 0; i--) {
                const j = Math.floor(this.choose() * (i + 1));
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
            this.rewires = 0;
            this.directPaths = 0;
            this.nextPlanAt = 0;
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

        foodPath(restrictCycle = false) {
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
                    if (parent[next] >= 0 || occupied.has(next)) continue;
                    if (restrictCycle && (advance > limit || advance <= this.distance(head, current))) continue;
                    parent[next] = current;
                    queue.push(next);
                }
            }
            if (parent[food] < 0) return [];
            const path = [];
            for (let current = food; current !== head; current = parent[current]) path.push(current);
            return path.reverse();
        }

        cycleAdmits(path) {
            if (!path.length || !this.food) return false;
            const head = this.id(this.body[0]);
            const limit = Math.min(this.distance(head, this.id(this.food)), this.distance(head, this.id(this.body.at(-1))) - 1);
            let previous = 0;
            for (const id of path) {
                const advance = this.distance(head, id);
                if (advance <= previous || advance > limit) return false;
                previous = advance;
            }
            return true;
        }

        escapesAfterFood(path) {
            if (!path.length) return false;
            const body = this.body.map(cell => this.id(cell));
            for (let step = 0; step < path.length; step++) {
                const next = path[step], eating = step === path.length - 1;
                if (body.slice(0, eating ? undefined : -1).includes(next)) return false;
                body.unshift(next);
                if (!eating) body.pop();
            }
            if (body.length === this.cycle.length) return true;
            // A short route to food is rejected if its grown virtual body seals
            // the head away from its moving tail.
            const tail = body.at(-1), blocked = new Set(body.slice(1, -1));
            const reached = new Set([body[0]]), queue = [body[0]];
            for (let i = 0; i < queue.length; i++) {
                for (const next of this.neighbors(queue[i])) {
                    if (next === tail) return true;
                    if (!blocked.has(next) && !reached.has(next)) { reached.add(next); queue.push(next); }
                }
            }
            return false;
        }

        findShortestFoodPath() {
            const shortest = this.foodPath();
            if (this.cycleAdmits(shortest) && this.escapesAfterFood(shortest)) return shortest;
            const safe = this.foodPath(true);
            return this.escapesAfterFood(safe) ? safe : [];
        }

        rewire() {
            const total = this.cycle.length, side = this.size - 1;
            const edges = Array.from({ length: total }, () => []);
            for (let i = 0; i < total; i++) {
                const a = this.id(this.cycle[i]), b = this.id(this.cycle[(i + 1) % total]);
                edges[a].push(b); edges[b].push(a);
            }
            const square = index => {
                const a = Math.floor(index / side) * this.size + index % side, b = a + 1, c = a + this.size, d = c + 1;
                const has = (u, v) => edges[u].includes(v);
                if (has(a, b) && has(c, d) && !has(a, c) && !has(b, d)) return [[a, b], [c, d], [a, c], [b, d]];
                if (has(a, c) && has(b, d) && !has(a, b) && !has(c, d)) return [[a, c], [b, d], [a, b], [c, d]];
                return null;
            };
            const flip = pairs => {
                for (const [a, b] of pairs.slice(0, 2)) {
                    edges[a].splice(edges[a].indexOf(b), 1); edges[b].splice(edges[b].indexOf(a), 1);
                }
                for (const [a, b] of pairs.slice(2)) { edges[a].push(b); edges[b].push(a); }
            };
            const first = square(Math.floor(this.choose() * side * side));
            if (!first) return false;
            flip(first);
            const reached = new Set([0]), queue = [0];
            for (let i = 0; i < queue.length; i++) for (const next of edges[queue[i]]) {
                if (!reached.has(next)) { reached.add(next); queue.push(next); }
            }
            // Two local edge exchanges split and rejoin the circuit in another
            // shape. The live snake's cyclic order must survive the exchange.
            if (reached.size === total) return false;
            const start = Math.floor(this.choose() * side * side);
            let joined = false;
            for (let i = 0; i < side * side; i++) {
                const next = square((start + i) % (side * side));
                if (next && reached.has(next[0][0]) !== reached.has(next[1][0])) { flip(next); joined = true; break; }
            }
            if (!joined) return false;
            let candidate = [0], previous = -1, current = 0;
            for (let i = 1; i < total; i++) {
                const next = edges[current].find(id => id !== previous);
                candidate.push(next); previous = current; current = next;
            }
            if (new Set(candidate).size !== total) return false;
            const head = this.id(this.body[0]), food = this.id(this.food);
            const oldDistance = this.distance(head, food);
            for (let direction = 0; direction < 2; direction++, candidate.reverse()) {
                const order = Array(total);
                candidate.forEach((id, i) => { order[id] = i; });
                let span = 0;
                for (let i = this.body.length - 1; i > 0; i--) {
                    span += (order[this.id(this.body[i - 1])] - order[this.id(this.body[i])] + total) % total;
                }
                const foodDistance = (order[food] - order[head] + total) % total;
                if (span >= total || foodDistance > oldDistance) continue;
                this.cycle = candidate.map(id => this.cell(id));
                this.order = order;
                this.rewires++;
                return true;
            }
            return false;
        }

        planRoute() {
            const shortest = this.foodPath();
            const canEscape = this.escapesAfterFood(shortest);
            let best = null;
            const consider = () => {
                const route = canEscape && this.cycleAdmits(shortest) ? shortest : this.foodPath(true);
                if (!route.length || !this.escapesAfterFood(route)) return false;
                if (!best || route.length < best.route.length) {
                    best = { route, cycle: this.cycle.slice(), order: this.order.slice() };
                }
                return route.length === shortest.length;
            };
            // A BFS can have several equally short paths. Keep a safe shortest
            // one immediately, rather than distorting it to admit one arbitrary
            // tie-break. When safety requires a detour, rewire the live backbone
            // and retain the best admissible path and its matching circuit.
            let optimal = consider();
            for (let i = 0; !optimal && i < 32; i++) {
                if (this.rewire() && shortest.length) optimal = consider();
            }
            if (best) {
                this.cycle = best.cycle;
                this.order = best.order;
                this.route = best.route;
                if (optimal) this.directPaths++;
            } else this.route = [];
            this.lastPathLength = this.route.length || null;
            this.nextPlanAt = this.steps + 8;
        }

        chooseMove() {
            if (!this.route.length && this.steps >= this.nextPlanAt) this.planRoute();
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
                this.nextPlanAt = 0;
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
            // Rewiring cannot increase distance to the current apple, and every
            // move reduces it; each apple still takes at most 144 moves.
            while (!trial.won && trial.steps < 21000) moves.push(trial.step());
            if (!trial.won) throw new Error('Seeded snake candidate did not fill the board');
            candidateSteps.push(trial.steps);
            if (!best || trial.steps < best.steps) best = { seed, variant, moves, steps: trial.steps, rewires: trial.rewires, directPaths: trial.directPaths };
            onProgress({ completed: variant + 1, total: candidates, bestSteps: best.steps });
        }
        return { ...best, candidates, candidateSteps, strategy: 'Adaptive cycle rewiring and BFS shortest food paths; fewest-step winning candidate' };
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
            this.rows = 16;
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
