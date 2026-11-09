/** The profile and automatic games share the background grid coordinates. */
class CanvasBackgroundController {
    constructor(canvas, themeManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.themeManager = themeManager;
        this.state = {
            width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1,
            isDragging: false, hasMouse: false, hoverX: 0, hoverY: 0,
            erasableBlocks: [], maxErasableBlocks: 400, frameCount: 0, fps: 60
        };
        // Grid-cell bounds, independent of viewport size or camera position.
        this.regions = {
            profile: { x: -12, y: -10, w: 10, h: 9 },
            snake: { x: -14, y: 2, w: 12, h: 12 },
            tetris: { x: 2, y: -18, w: 10, h: 16 },
            profileView: { x: -12, y: -10, w: 12, h: 10 },
            overview: { x: -16, y: -20, w: 30, h: 36 }
        };
        this.snake = new CanvasGames.AutoSnake();
        this.tetris = new CanvasGames.AutoTetris();
        this.defaultView = true;
        this.exploring = false;
        this.focusedView = 'default';
        this.planRequest = 0;
        this.listeners = [];
        this.pointers = new Map();
        this.onThemeChange = () => this.draw();
        this.loop = this.loop.bind(this);
    }

    listen(target, type, callback, options) {
        target.addEventListener(type, callback, options);
        this.listeners.push(() => target.removeEventListener(type, callback, options));
    }

    initialize() {
        this.entry = document.getElementById('canvas-entry');
        this.homeButton = document.getElementById('canvas-home');
        this.snakeLink = document.getElementById('canvas-snake-link');
        this.tetrisLink = document.getElementById('canvas-tetris-link');
        this.exploreButton = document.getElementById('canvas-explore');
        this.nav = document.getElementById('canvas-nav');
        this.profile = document.getElementById('canvas-profile');
        this.snakeControls = document.getElementById('canvas-snake-controls');
        this.tetrisControls = document.getElementById('canvas-tetris-controls');
        CanvasProfile.render(this.profile, window.PORTFOLIO_PROFILE);
        this.listen(document.getElementById('homepage-content'), 'dragstart', event => event.preventDefault());
        this.listen(this.entry, 'click', () => this.focusRegion('profile'));
        this.listen(this.exploreButton, 'click', () => this.enterExploration());
        document.querySelectorAll('[data-canvas-view]').forEach(button => {
            this.listen(button, 'click', () => this.focusRegion(button.dataset.canvasView));
        });
        document.querySelectorAll('[data-canvas-reset]').forEach(button => {
            this.listen(button, 'click', () => this.resetGame(button.dataset.canvasReset));
        });
        this.listen(this.canvas, 'pointerdown', event => this.pointerDown(event));
        this.listen(this.canvas, 'pointermove', event => this.pointerMove(event));
        this.listen(this.canvas, 'pointerup', event => this.pointerUp(event));
        this.listen(this.canvas, 'pointercancel', event => this.pointerUp(event, true));
        this.listen(this.canvas, 'lostpointercapture', event => this.pointerUp(event, true));
        this.listen(this.canvas, 'pointerleave', () => { this.state.hasMouse = false; });
        this.listen(this.canvas, 'wheel', event => {
            if (!this.exploring) {
                if (event.ctrlKey) event.preventDefault();
                return;
            }
            event.preventDefault();
            this.camera = null;
            this.zoomAt(event.clientX, event.clientY, this.state.scale * Math.exp(-event.deltaY * 0.001));
        }, { passive: false });
        this.listen(window, 'keydown', event => {
            if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
            if (event.key === 'Escape') this.focusRegion('default');
        });
        // Ctrl-wheel must not bypass the normal-view canvas zoom lock.
        this.listen(window, 'wheel', event => {
            if (event.ctrlKey) {
                event.preventDefault();
                if (this.exploring && event.target.closest?.('#canvas-profile')) {
                    this.camera = null;
                    this.zoomAt(event.clientX, event.clientY, this.state.scale * Math.exp(-event.deltaY * 0.001));
                }
            }
        }, { passive: false });
        this.listen(window, 'resize', () => this.resize());
        this.themeManager.onThemeChange(this.onThemeChange);
        this.resize();
        this.running = true;
        const controller = this;
        this.snakeDebug = Object.freeze({
            get seed() { return controller.snake.seed; },
            newSeed: () => this.planSnake(),
            restart: (seed = this.snake.seed) => this.planSnake(seed)
        });
        window.canvasSnakeDebug = this.snakeDebug;
        console.info('[CanvasSnake] 控制台生成新种子：canvasSnakeDebug.newSeed()；复现：canvasSnakeDebug.restart(seed)');
        this.planSnake();
        this.animationFrame = requestAnimationFrame(this.loop);
    }

    planSnake(rawSeed) {
        if (!rawSeed || !String(rawSeed).trim()) {
            const values = new Uint32Array(2);
            crypto.getRandomValues(values);
            rawSeed = [...values].map(value => value.toString(36)).join('-');
        }
        const seed = String(rawSeed).trim().slice(0, 80);
        console.info(`[CanvasSnake] seed: ${seed}`);
        this.snakeWorker?.terminate();
        this.snake = new CanvasGames.AutoSnake({ seed });
        this.snakePlanning = true;
        const id = ++this.planRequest;
        const fallback = () => {
            if (id !== this.planRequest) return;
            this.snakeWorker?.terminate();
            this.snakeWorker = null;
            this.snakePlanning = false;
            console.warn('[CanvasSnake] 后台计算不可用，改为实时安全寻路。');
        };
        try {
            this.snakeWorker = new Worker('js/canvas-snake-worker.js');
            this.snakeWorker.onmessage = event => {
                const message = event.data;
                if (id !== this.planRequest || message.id !== id || !this.running) return;
                if (message.type === 'complete') {
                    this.snake.applyPlan(message.plan);
                    this.snakePlanning = false;
                    console.info(`[CanvasSnake] seed: ${seed} · ${message.plan.candidates} 条获胜候选中最少 ${message.plan.steps} 步`);
                    this.snakeWorker.terminate();
                    this.snakeWorker = null;
                } else if (message.type === 'error') fallback();
            };
            this.snakeWorker.onerror = fallback;
            this.snakeWorker.postMessage({ id, seed });
        } catch (_) { fallback(); }
        return seed;
    }

    setExploration(enabled) {
        this.exploring = enabled;
        document.body.classList.toggle('canvas-exploring', enabled);
        this.nav.hidden = !enabled;
        this.exploreButton.hidden = enabled;
    }

    resetGame(name) {
        if (name === 'snake') {
            this.planSnake();
        } else if (name === 'tetris') this.tetris.reset();
        this.draw();
    }

    enterExploration() {
        this.setExploration(true);
        this.focusRegion('overview');
    }

    exitExploration() { this.focusRegion('default'); }

    resize() {
        const oldWidth = this.state.width, oldHeight = this.state.height;
        this.state.width = window.innerWidth;
        this.state.height = window.innerHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.state.width * ratio);
        this.canvas.height = Math.round(this.state.height * ratio);
        this.canvas.style.width = `${this.state.width}px`;
        this.canvas.style.height = `${this.state.height}px`;
        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (!this.defaultView && oldWidth) {
            this.state.offsetX += (this.state.width - oldWidth) / 2;
            this.state.offsetY += (this.state.height - oldHeight) / 2;
            this.camera = null;
            if (this.focusedView) this.fitRegion(this.focusedView, false);
        }
        this.draw();
    }

    getGridFromScreen(x, y) {
        const size = 50 * this.state.scale;
        return { gridX: Math.floor((x - this.state.offsetX) / size), gridY: Math.floor((y - this.state.offsetY) / size) };
    }

    focusRegion(name) {
        this.gesture = null;
        this.pinch = null;
        this.state.isDragging = this.state.hasMouse = false;
        const captured = [...this.pointers.keys()];
        this.pointers.clear();
        captured.forEach(id => {
            if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
        });
        if (name === 'home') name = 'default';
        document.querySelectorAll('#canvas-nav [data-canvas-view]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.canvasView === name));
        });
        if (name === 'default') {
            this.setExploration(false);
            document.body.classList.remove('canvas-section-open');
            this.defaultView = true;
            this.focusedView = name;
            this.moveCamera({ offsetX: 0, offsetY: 0, scale: 1 });
            // Always land on the homepage introduction, regardless of the
            // document scroll position from which the canvas was entered.
            window.scrollTo(0, 0);
            this.entry.focus?.({ preventScroll: true });
            return;
        }
        if (!this.regions[name]) return;
        document.body.classList.add('canvas-section-open');
        this.defaultView = false;
        this.focusedView = name;
        window.scrollTo(0, 0);
        this.fitRegion(name);
    }

    fitRegion(name, animate = true) {
        const r = this.regions[name === 'profile' && this.exploring ? 'profileView' : name], top = 100;
        const bottom = this.exploring ? 140 : 100;
        const availableWidth = Math.max(180, this.state.width - 48);
        const availableHeight = Math.max(180, this.state.height - top - bottom);
        const isGame = name === 'snake' || name === 'tetris';
        const regionHeight = (r.h + (isGame ? 1 : 0)) * 50;
        const scale = this.exploring ? Math.min(name === 'profile' ? 1.2 : 1, availableWidth / (r.w * 50), availableHeight / (regionHeight + 50)) : 1;
        const regionWidth = !this.exploring && name === 'profile' ? Math.min(r.w * 50, availableWidth) : r.w * 50;
        const target = {
            scale,
            offsetX: this.state.width / 2 - (r.x * 50 + regionWidth / 2) * scale,
            offsetY: top + availableHeight / 2 - (r.y * 50 + regionHeight / 2) * scale
        };
        this.moveCamera(target, animate);
    }

    moveCamera(target, animate = true) {
        if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            Object.assign(this.state, target);
            this.camera = null;
        } else this.camera = { from: { scale: this.state.scale, offsetX: this.state.offsetX, offsetY: this.state.offsetY }, target, start: performance.now() };
        this.draw();
    }

    zoomAt(x, y, scale) {
        if (!this.exploring) return false;
        const old = this.state.scale;
        this.defaultView = false;
        this.state.scale = Math.max(0.15, Math.min(2, scale));
        const factor = this.state.scale / old;
        this.state.offsetX = x - (x - this.state.offsetX) * factor;
        this.state.offsetY = y - (y - this.state.offsetY) * factor;
        this.focusedView = null;
        return true;
    }

    pointerDown(event) {
        if (event.button !== 0 && event.button !== 1) return;
        event.preventDefault();
        // Finish a mode-exit transition before an input can interrupt its scale reset.
        if (!this.exploring && this.state.scale !== 1) {
            if (this.camera) Object.assign(this.state, this.camera.target);
            else this.state.scale = 1;
        }
        this.camera = null;
        this.canvas.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.pointers.size === 2) {
            this.gesture = null;
            this.pinch = this.pinchMetrics();
            return;
        }
        if (this.pointers.size > 2) return;
        this.gesture = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
        this.state.isDragging = true;
    }

    pinchMetrics() {
        const [a, b] = [...this.pointers.values()];
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
    }

    pointerMove(event) {
        this.state.hoverX = event.clientX;
        this.state.hoverY = event.clientY;
        this.state.hasMouse = true;
        if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.pointers.size >= 2) {
            const next = this.pinchMetrics();
            if (this.pinch && this.pinch.distance > 0) {
                if (this.exploring) this.zoomAt(this.pinch.x, this.pinch.y, this.state.scale * next.distance / this.pinch.distance);
                this.state.offsetX += next.x - this.pinch.x;
                this.state.offsetY += next.y - this.pinch.y;
                if (next.x !== this.pinch.x || next.y !== this.pinch.y) {
                    this.defaultView = false;
                    this.focusedView = null;
                }
            }
            this.pinch = next;
            return;
        }
        const g = this.gesture;
        if (g && this.pointers.has(event.pointerId)) {
            if (Math.hypot(event.clientX - g.x, event.clientY - g.y) > 4) g.moved = true;
            if (g.moved) {
                this.defaultView = false;
                this.state.offsetX += event.clientX - g.lastX;
                this.state.offsetY += event.clientY - g.lastY;
                this.focusedView = null;
            }
            g.lastX = event.clientX;
            g.lastY = event.clientY;
        } else if (!this.pointers.size && event.target === this.canvas) this.generateInteractiveBlocks(event.clientX, event.clientY);
        this.canvas.style.cursor = g ? 'grabbing' : 'grab';
    }

    pointerUp(event, cancelled = false) {
        if (!this.pointers.has(event.pointerId)) return;
        const g = this.gesture;
        if (!cancelled && g && !g.moved) this.clickAt(event.clientX, event.clientY);
        this.pointers.delete(event.pointerId);
        this.gesture = null;
        this.pinch = null;
        this.state.isDragging = false;
        if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        // After a pinch, the remaining finger continues panning without a jump.
        if (this.pointers.size === 1) {
            const remaining = [...this.pointers.values()][0];
            this.gesture = { x: remaining.x, y: remaining.y, lastX: remaining.x, lastY: remaining.y, moved: true };
            this.state.isDragging = true;
        }
    }

    clickAt(x, y) {
        const { gridX, gridY } = this.getGridFromScreen(x, y);
        if (gridX === 0 && gridY === 0) { this.focusRegion('profile'); return; }
        if (gridX === -1 && gridY === -1) { this.focusRegion('default'); return; }
        if (gridX === 0 && gridY === -1) { this.focusRegion('snake'); return; }
        if (gridX === -1 && gridY === 0) { this.focusRegion('tetris'); return; }
        const hit = this.state.erasableBlocks.find(block => block.gridX === gridX && block.gridY === gridY && !block.isClicked);
        if (hit) {
            hit.isClicked = true;
            hit.fadeStartTime = performance.now();
            if (this.onBlockClickCallback) this.onBlockClickCallback(hit.targetThemeKey);
        }
    }

    generateInteractiveBlocks(x, y) {
        if (this.state.erasableBlocks.length >= this.state.maxErasableBlocks || Math.random() >= 0.04) return;
        const { gridX, gridY } = this.getGridFromScreen(x, y);
        if ((gridX === 0 || gridX === -1) && (gridY === 0 || gridY === -1)) return;
        if (['profile', 'snake', 'tetris'].some(name => {
            const r = this.regions[name];
            return gridX >= r.x - 1 && gridX < r.x + r.w + 1 && gridY >= r.y - 1 && gridY < r.y + r.h + 1;
        })) return;
        if (['snake', 'tetris'].some(name => {
            const r = this.regions[name];
            return gridX >= r.x && gridX < r.x + r.w && gridY === r.y + r.h;
        })) return;
        if (this.state.erasableBlocks.some(block => block.gridX === gridX && block.gridY === gridY)) return;
        const keys = this.themeManager.getAvailableThemes();
        const targetThemeKey = keys[Math.floor(Math.random() * keys.length)];
        this.state.erasableBlocks.push({ gridX, gridY, targetThemeKey, blockColor: this.themeManager.getThemeConfig(targetThemeKey).canvas.blockColor, isClicked: false, fadeProgress: 0 });
    }

    draw() {
        const { width, height, offsetX, offsetY, scale } = this.state;
        if (!width) return;
        const ctx = this.ctx, theme = this.themeManager.getCurrentTheme(), c = theme.canvas;
        ctx.fillStyle = c.bgColor;
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        const left = -offsetX / scale, top = -offsetY / scale;
        ctx.lineWidth = 1 / scale;
        for (let x = Math.floor(left / 50); x <= (left + width / scale) / 50; x++) {
            if (x === 0 && this.defaultView) continue;
            ctx.strokeStyle = x === 0 ? c.axisColor : c.lineColor;
            ctx.beginPath(); ctx.moveTo(x * 50, top); ctx.lineTo(x * 50, top + height / scale); ctx.stroke();
        }
        for (let y = Math.floor(top / 50); y <= (top + height / scale) / 50; y++) {
            if (y === 0 && this.defaultView) continue;
            ctx.strokeStyle = y === 0 ? c.axisColor : c.lineColor;
            ctx.beginPath(); ctx.moveTo(left, y * 50); ctx.lineTo(left + width / scale, y * 50); ctx.stroke();
        }
        this.state.erasableBlocks.forEach(block => {
            ctx.fillStyle = block.blockColor;
            ctx.globalAlpha = 1 - block.fadeProgress;
            const inset = 25 * block.fadeProgress;
            ctx.fillRect(block.gridX * 50 + inset, block.gridY * 50 + inset, 50 - inset * 2, 50 - inset * 2);
        });
        ctx.globalAlpha = 1;
        this.drawRegion('profile', '01 / 关于我', '关于我 · 媒体与联系', theme);
        this.drawRegion('tetris', '02 / 自动俄罗斯方块', `10 × 16   ·   已消除 ${this.tetris.lines} 行`, theme);
        this.drawRegion('snake', '03 / 自动贪吃蛇', `${this.snake.size} × ${this.snake.size} · 得分 ${this.snake.score}`, theme);
        const snake = this.regions.snake;
        this.snake.body.forEach((cell, index) => {
            ctx.fillStyle = c.highlightColor;
            ctx.globalAlpha = index === 0 ? 1 : 0.25 + 0.55 * (1 - index / this.snake.body.length);
            ctx.fillRect((snake.x + cell.x) * 50 + 3, (snake.y + cell.y) * 50 + 3, 44, 44);
        });
        ctx.globalAlpha = 1;
        if (this.snake.food) {
            const x = (snake.x + this.snake.food.x + 0.5) * 50, y = (snake.y + this.snake.food.y + 0.5) * 50;
            ctx.strokeStyle = c.highlightColor;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = c.highlightColor;
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        const r = this.regions.tetris;
        const tile = (x, y, color) => {
            if (y < 0) return;
            ctx.fillStyle = c.highlightColor;
            ctx.globalAlpha = 0.35 + color * 0.075;
            ctx.fillRect((r.x + x) * 50 + 2, (r.y + y) * 50 + 2, 46, 46);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = c.axisColor;
            ctx.lineWidth = 1;
            ctx.strokeRect((r.x + x) * 50 + 5, (r.y + y) * 50 + 5, 40, 40);
        };
        this.tetris.board.forEach((row, y) => row.forEach((color, x) => { if (color) tile(x, y, color); }));
        const piece = this.tetris.piece;
        if (piece) piece.matrix.forEach((row, y) => row.forEach((filled, x) => { if (filled) tile(piece.x + x, piece.y + y, piece.color); }));
        if (this.state.hasMouse && !this.gesture) {
            const cell = this.getGridFromScreen(this.state.hoverX, this.state.hoverY);
            ctx.fillStyle = c.highlightColor;
            ctx.globalAlpha = c.highlightOpacity;
            ctx.fillRect(cell.gridX * 50, cell.gridY * 50, 50, 50);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        this.syncWorldElements();
    }

    drawRegion(name, title, subtitle, theme) {
        const r = this.regions[name], ctx = this.ctx;
        ctx.strokeStyle = theme.canvas.axisColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(r.x * 50, r.y * 50, r.w * 50, r.h * 50);
        ctx.fillStyle = theme.homepage.textColor;
        ctx.font = '600 17px ui-monospace, monospace';
        ctx.fillText(title, r.x * 50, r.y * 50 - 36);
        ctx.font = '12px ui-monospace, monospace';
        ctx.globalAlpha = 0.65;
        ctx.fillText(subtitle, r.x * 50, r.y * 50 - 14);
        ctx.globalAlpha = 1;
    }

    syncWorldElements() {
        const { scale, offsetX, offsetY, width, height } = this.state;
        const r = this.regions.profile;
        const x = offsetX + r.x * 50 * scale, y = offsetY + r.y * 50 * scale;
        this.profile.hidden = x + r.w * 50 * scale < 0 || x > width || y + r.h * 50 * scale < 0 || y > height;
        this.profile.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        const place = (element, gridX, gridY, w, h) => {
            const sx = offsetX + gridX * 50 * scale, sy = offsetY + gridY * 50 * scale;
            element.hidden = sx + w * scale <= 0 || sx >= width || sy + h * scale <= 0 || sy >= height;
            element.style.transform = `translate(${sx}px, ${sy}px) scale(${scale})`;
        };
        place(this.entry, 0, 0, 50, 50);
        place(this.homeButton, -1, -1, 50, 50);
        place(this.snakeLink, 0, -1, 50, 50);
        place(this.tetrisLink, -1, 0, 50, 50);
        for (const name of ['snake', 'tetris']) {
            const game = this.regions[name];
            const controls = name === 'snake' ? this.snakeControls : this.tetrisControls;
            place(controls, game.x, game.y + game.h + 0.2, game.w * 50, 40);
        }
    }

    loop(time) {
        if (!this.running) return;
        const dt = this.lastTime === undefined ? 0 : Math.min(0.1, (time - this.lastTime) / 1000);
        this.lastTime = time;
        this.state.fps = dt ? 1 / dt : 60;
        this.state.frameCount++;
        if (!document.hidden) {
            if (!this.snakePlanning) {
                if (this.snake.won && this.snake.restartIn <= dt) this.planSnake();
                else this.snake.update(dt);
            }
            if (!this.nextAgeCheck || time >= this.nextAgeCheck) {
                CanvasProfile.updateAge?.(this.profile, window.PORTFOLIO_PROFILE?.birthDate);
                this.nextAgeCheck = time + 60000;
            }
            this.tetris.update(dt);
            if (this.camera) {
                const t = Math.min(1, (time - this.camera.start) / 550), eased = 1 - Math.pow(1 - t, 3);
                for (const key of ['scale', 'offsetX', 'offsetY']) this.state[key] = this.camera.from[key] + (this.camera.target[key] - this.camera.from[key]) * eased;
                if (t === 1) this.camera = null;
            }
            this.state.erasableBlocks = this.state.erasableBlocks.filter(block => {
                if (block.isClicked) block.fadeProgress = Math.min(1, (time - block.fadeStartTime) / 200);
                return block.fadeProgress < 1;
            });
            this.draw();
        }
        this.animationFrame = requestAnimationFrame(this.loop);
    }

    onBlockClick(callback) { this.onBlockClickCallback = callback; }
    getBlockInfo() { return this.state.erasableBlocks.map(block => ({ ...block })); }
    clearAllBlocks() { this.state.erasableBlocks = []; }
    getPerformanceStats() {
        return { fps: Math.round(this.state.fps), blockCount: this.state.erasableBlocks.length, maxBlocks: this.state.maxErasableBlocks, frameCount: this.state.frameCount, canvasSize: { width: this.state.width, height: this.state.height }, performanceGood: this.state.fps >= 30 };
    }
    destroy() {
        this.running = false;
        cancelAnimationFrame(this.animationFrame);
        this.planRequest++;
        this.snakeWorker?.terminate();
        if (window.canvasSnakeDebug === this.snakeDebug) delete window.canvasSnakeDebug;
        this.listeners.forEach(remove => remove());
        this.themeManager.offThemeChange(this.onThemeChange);
    }
}
