/** The grid, profile, games and drawing share a single world transform. */
class CanvasBackgroundController {
    constructor(canvas, themeManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.themeManager = themeManager;
        this.state = {
            width: 0, height: 0, offsetX: 50, offsetY: 50, scale: 1,
            isDragging: false, hasMouse: false, hoverX: 0, hoverY: 0,
            erasableBlocks: [], maxErasableBlocks: 100, frameCount: 0, fps: 60
        };
        // Grid-cell bounds, independent of viewport size or camera position.
        this.regions = {
            profile: { x: -12, y: -10, w: 10, h: 8 },
            snake: { x: 2, y: -14, w: 12, h: 12 },
            tetris: { x: -12, y: 2, w: 10, h: 20 },
            paint: { x: 2, y: 2, w: 12, h: 12 },
            overview: { x: -14, y: -16, w: 30, h: 40 }
        };
        this.snake = new CanvasGames.AutoSnake();
        this.tetris = new CanvasGames.AutoTetris();
        this.paint = new Map();
        this.undoStack = [];
        this.tool = 'brush';
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
        this.profile = document.getElementById('canvas-profile');
        this.nav = document.getElementById('canvas-nav');
        this.hint = document.getElementById('canvas-hint');
        this.paintTools = document.getElementById('paint-tools');
        this.form = document.getElementById('profile-form');
        this.setupProfile();
        this.listen(this.entry, 'click', () => this.focusRegion('profile'));
        document.querySelectorAll('[data-canvas-view]').forEach(button => {
            this.listen(button, 'click', () => this.focusRegion(button.dataset.canvasView));
        });
        document.querySelectorAll('[data-paint-tool]').forEach(button => {
            this.listen(button, 'click', () => this.setTool(button.dataset.paintTool));
        });
        document.querySelectorAll('[data-paint-action]').forEach(button => {
            this.listen(button, 'click', () => this.paintAction(button.dataset.paintAction));
        });
        this.listen(this.canvas, 'pointerdown', event => this.pointerDown(event));
        this.listen(this.canvas, 'pointermove', event => this.pointerMove(event));
        this.listen(this.canvas, 'pointerup', event => this.pointerUp(event));
        this.listen(this.canvas, 'pointercancel', event => this.pointerUp(event, true));
        this.listen(this.canvas, 'lostpointercapture', event => this.pointerUp(event, true));
        this.listen(this.canvas, 'pointerleave', () => { this.state.hasMouse = false; });
        this.listen(this.canvas, 'wheel', event => {
            if (!this.exploring && !event.ctrlKey) return;
            event.preventDefault();
            this.camera = null;
            this.zoomAt(event.clientX, event.clientY, this.state.scale * Math.exp(-event.deltaY * 0.001));
        }, { passive: false });
        this.listen(window, 'keydown', event => {
            if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
            if (event.key === 'Escape' && this.exploring) this.focusRegion('home');
            if (this.exploring && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                this.paintAction('undo');
            }
        });
        this.listen(window, 'resize', () => this.resize());
        this.themeManager.onThemeChange(this.onThemeChange);
        this.setTool('brush');
        this.resize();
        this.running = true;
        this.animationFrame = requestAnimationFrame(this.loop);
    }

    setupProfile() {
        const defaults = { name: 'Jlands', bio: '探索创意与技术的结合', location: '中国', contact: '' };
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('portfolio-canvas-profile')) || {}; } catch (_) { /* Use defaults. */ }
        for (const key of Object.keys(defaults)) {
            const input = this.form.elements.namedItem(key);
            input.value = (typeof saved[key] === 'string' ? saved[key] : defaults[key]).slice(0, input.maxLength);
        }
        this.listen(this.form, 'submit', event => {
            event.preventDefault();
            const info = {};
            for (const key of Object.keys(defaults)) info[key] = this.form.elements.namedItem(key).value.trim();
            const status = document.getElementById('profile-status');
            try {
                localStorage.setItem('portfolio-canvas-profile', JSON.stringify(info));
                status.textContent = '已保存 · 仅在此浏览器中可见';
            } catch (_) { status.textContent = '浏览器暂时无法保存；可以继续编辑。'; }
        });
    }

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
        if (this.exploring && oldWidth) {
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
        this.finishStroke();
        this.gesture = null;
        this.pinch = null;
        this.state.isDragging = this.state.hasMouse = false;
        const captured = [...this.pointers.keys()];
        this.pointers.clear();
        captured.forEach(id => {
            if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
        });
        if (name === 'home') {
            this.exploring = false;
            this.focusedView = null;
            document.body.classList.remove('canvas-exploring');
            this.nav.hidden = this.hint.hidden = this.paintTools.hidden = true;
            document.getElementById('canvas-explore').hidden = false;
            this.camera = null;
            Object.assign(this.state, { offsetX: 50, offsetY: 50, scale: 1 });
            window.scrollTo(0, this.savedScrollY || 0);
            this.draw();
            return;
        }
        if (!this.regions[name]) return;
        if (!this.exploring) this.savedScrollY = window.scrollY;
        this.exploring = true;
        this.focusedView = name;
        document.body.classList.add('canvas-exploring');
        this.nav.hidden = this.hint.hidden = false;
        this.paintTools.hidden = name !== 'paint' && name !== 'overview';
        document.getElementById('canvas-explore').hidden = true;
        this.hint.textContent = name === 'paint'
            ? '右下绘画 · 按住涂画 / 橡皮擦 · 平移工具或空白处拖动画布 · 滚轮 / 双指缩放'
            : '四个区域固定在网格上 · 拖动平移 · 滚轮 / 双指缩放 · Esc 返回首页';
        document.querySelectorAll('#canvas-nav [data-canvas-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.canvasView === name)));
        this.fitRegion(name);
    }

    fitRegion(name, animate = true) {
        const r = this.regions[name], top = 100;
        const bottom = this.state.width < 600 ? 160 : 110;
        const availableWidth = Math.max(180, this.state.width - 48);
        const availableHeight = Math.max(180, this.state.height - top - bottom);
        const scale = Math.min(name === 'profile' ? 1.2 : 1, availableWidth / (r.w * 50), availableHeight / ((r.h + 1) * 50));
        const target = {
            scale,
            offsetX: this.state.width / 2 - (r.x + r.w / 2) * 50 * scale,
            offsetY: top + availableHeight / 2 - (r.y + r.h / 2) * 50 * scale
        };
        if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            Object.assign(this.state, target);
            this.camera = null;
        } else this.camera = { from: { scale: this.state.scale, offsetX: this.state.offsetX, offsetY: this.state.offsetY }, target, start: performance.now() };
        this.draw();
    }

    zoomAt(x, y, scale) {
        const old = this.state.scale;
        this.state.scale = Math.max(0.15, Math.min(2, scale));
        const factor = this.state.scale / old;
        this.state.offsetX = x - (x - this.state.offsetX) * factor;
        this.state.offsetY = y - (y - this.state.offsetY) * factor;
        this.focusedView = null;
    }

    pointerDown(event) {
        if (event.button !== 0 && event.button !== 1) return;
        this.camera = null;
        this.canvas.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.pointers.size === 2) {
            this.finishStroke();
            this.gesture = null;
            this.pinch = this.pinchMetrics();
            return;
        }
        if (this.pointers.size > 2) return;
        const cell = this.getGridFromScreen(event.clientX, event.clientY);
        const painting = this.exploring && this.tool !== 'pan' && event.button === 0 && this.isPaintCell(cell.gridX, cell.gridY);
        this.gesture = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, painting };
        this.state.isDragging = !painting;
        if (painting) {
            this.stroke = new Map();
            this.paintCell(cell.gridX, cell.gridY);
            this.lastPaintCell = cell;
        }
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
                this.zoomAt(this.pinch.x, this.pinch.y, this.state.scale * next.distance / this.pinch.distance);
                this.state.offsetX += next.x - this.pinch.x;
                this.state.offsetY += next.y - this.pinch.y;
            }
            this.pinch = next;
            return;
        }
        const g = this.gesture;
        if (g && this.pointers.has(event.pointerId)) {
            if (Math.hypot(event.clientX - g.x, event.clientY - g.y) > 4) g.moved = true;
            if (g.painting) {
                const cell = this.getGridFromScreen(event.clientX, event.clientY);
                this.paintLine(this.lastPaintCell, cell);
                this.lastPaintCell = cell;
            } else if (g.moved) {
                this.state.offsetX += event.clientX - g.lastX;
                this.state.offsetY += event.clientY - g.lastY;
                this.focusedView = null;
            }
            g.lastX = event.clientX;
            g.lastY = event.clientY;
        } else if (!this.pointers.size && event.target === this.canvas) this.generateInteractiveBlocks(event.clientX, event.clientY);
        const cell = this.getGridFromScreen(event.clientX, event.clientY);
        this.canvas.style.cursor = g ? (g.painting ? 'crosshair' : 'grabbing') : this.exploring && this.tool !== 'pan' && this.isPaintCell(cell.gridX, cell.gridY) ? 'crosshair' : 'grab';
    }

    pointerUp(event, cancelled = false) {
        if (!this.pointers.has(event.pointerId)) return;
        const g = this.gesture;
        if (!cancelled && g && !g.moved && !g.painting) this.clickAt(event.clientX, event.clientY);
        this.pointers.delete(event.pointerId);
        this.finishStroke();
        this.gesture = null;
        this.pinch = null;
        this.state.isDragging = false;
        if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        // After a pinch, the remaining finger continues panning without a jump.
        if (this.pointers.size === 1) {
            const remaining = [...this.pointers.values()][0];
            this.gesture = { x: remaining.x, y: remaining.y, lastX: remaining.x, lastY: remaining.y, moved: true, painting: false };
            this.state.isDragging = true;
        }
    }

    clickAt(x, y) {
        const { gridX, gridY } = this.getGridFromScreen(x, y);
        if (gridX === 0 && gridY === 0) { this.focusRegion('profile'); return; }
        const hit = this.state.erasableBlocks.find(block => block.gridX === gridX && block.gridY === gridY && !block.isClicked);
        if (hit) {
            hit.isClicked = true;
            hit.fadeStartTime = performance.now();
            if (this.onBlockClickCallback) this.onBlockClickCallback(hit.targetThemeKey);
        }
    }

    isPaintCell(x, y) { return x >= 0 && y >= 0 && !(x === 0 && y === 0); }
    setTool(tool) {
        this.finishStroke();
        if (this.gesture?.painting) this.gesture = null;
        this.tool = tool;
        document.querySelectorAll('[data-paint-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paintTool === tool)));
    }
    paintCell(x, y) {
        if (!this.isPaintCell(x, y)) return;
        const key = `${x},${y}`;
        if (!this.stroke.has(key)) this.stroke.set(key, this.paint.has(key));
        if (this.tool === 'erase') this.paint.delete(key);
        else this.paint.set(key, true);
    }
    paintLine(from, to) {
        // Fill skipped cells during fast strokes with Bresenham's algorithm.
        let x = from.gridX, y = from.gridY;
        const dx = Math.abs(to.gridX - x), dy = -Math.abs(to.gridY - y);
        const sx = x < to.gridX ? 1 : -1, sy = y < to.gridY ? 1 : -1;
        let error = dx + dy;
        while (true) {
            this.paintCell(x, y);
            if (x === to.gridX && y === to.gridY) break;
            const twice = error * 2;
            if (twice >= dy) { error += dy; x += sx; }
            if (twice <= dx) { error += dx; y += sy; }
        }
    }
    finishStroke() {
        if (this.stroke && this.stroke.size) {
            this.undoStack.push(this.stroke);
            if (this.undoStack.length > 50) this.undoStack.shift();
        }
        this.stroke = null;
    }
    paintAction(action) {
        this.finishStroke();
        if (this.gesture?.painting) this.gesture = null;
        if (action === 'clear' && this.paint.size) {
            this.undoStack.push(new Map([...this.paint.keys()].map(key => [key, true])));
            this.paint.clear();
        } else if (action === 'undo') {
            const previous = this.undoStack.pop();
            if (previous) previous.forEach((exists, key) => exists ? this.paint.set(key, true) : this.paint.delete(key));
        }
        this.draw();
    }

    generateInteractiveBlocks(x, y) {
        if (this.state.erasableBlocks.length >= this.state.maxErasableBlocks || Math.random() >= 0.02) return;
        const { gridX, gridY } = this.getGridFromScreen(x, y);
        if (gridX >= 0 && gridY >= 0) return;
        if (['profile', 'snake', 'tetris'].some(name => {
            const r = this.regions[name];
            return gridX >= r.x - 1 && gridX < r.x + r.w + 1 && gridY >= r.y - 1 && gridY < r.y + r.h + 1;
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
            ctx.strokeStyle = x === 0 ? c.axisColor : c.lineColor;
            ctx.beginPath(); ctx.moveTo(x * 50, top); ctx.lineTo(x * 50, top + height / scale); ctx.stroke();
        }
        for (let y = Math.floor(top / 50); y <= (top + height / scale) / 50; y++) {
            ctx.strokeStyle = y === 0 ? c.axisColor : c.lineColor;
            ctx.beginPath(); ctx.moveTo(left, y * 50); ctx.lineTo(left + width / scale, y * 50); ctx.stroke();
        }
        ctx.fillStyle = c.highlightColor;
        ctx.globalAlpha = 0.65;
        this.paint.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            if (x * 50 > left - 50 && x * 50 < left + width / scale && y * 50 > top - 50 && y * 50 < top + height / scale) ctx.fillRect(x * 50 + 2, y * 50 + 2, 46, 46);
        });
        ctx.globalAlpha = 1;
        this.state.erasableBlocks.forEach(block => {
            ctx.fillStyle = block.blockColor;
            ctx.globalAlpha = 1 - block.fadeProgress;
            const inset = 25 * block.fadeProgress;
            ctx.fillRect(block.gridX * 50 + inset, block.gridY * 50 + inset, 50 - inset * 2, 50 - inset * 2);
        });
        ctx.globalAlpha = 1;
        this.drawRegion('profile', '01 / 关于我', '编辑信息 · 留下此刻的自己', theme);
        this.drawRegion('snake', '02 / 自动贪吃蛇', `12 × 12   ·   已吃到 ${this.snake.score} 颗${this.snake.won ? ' · 已填满，即将重启' : ''}`, theme);
        this.drawRegion('tetris', '03 / 自动俄罗斯方块', `10 × 20   ·   已消除 ${this.tetris.lines} 行`, theme);
        this.drawRegion('paint', '04 / 自由绘画', '右下象限都是你的画布', theme);
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
        this.entry.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        const r = this.regions.profile;
        const x = offsetX + r.x * 50 * scale, y = offsetY + r.y * 50 * scale;
        this.profile.hidden = x + r.w * 50 * scale < 0 || x > width || y + r.h * 50 * scale < 0 || y > height;
        this.profile.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }

    loop(time) {
        if (!this.running) return;
        const dt = this.lastTime === undefined ? 0 : Math.min(0.1, (time - this.lastTime) / 1000);
        this.lastTime = time;
        this.state.fps = dt ? 1 / dt : 60;
        this.state.frameCount++;
        if (!document.hidden) {
            this.snake.update(dt);
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
        this.listeners.forEach(remove => remove());
        this.themeManager.offThemeChange(this.onThemeChange);
    }
}
