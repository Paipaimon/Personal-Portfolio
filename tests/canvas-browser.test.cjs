/* Run with `node tests/canvas-browser.test.cjs`; no third-party packages needed.
 * Uses an isolated headless Edge profile and serves only this checkout locally.
 * Set EDGE_PATH or CANVAS_QA_OUTPUT to override browser/screenshot locations.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const edge = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const screenshots = process.env.CANVAS_QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-canvas-screenshots-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-canvas-edge-'));
const errors = [];
const failures = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, socket, server;

async function waitFor(check, description, timeout = 12000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const result = await check();
        if (result) return result;
        await delay(60);
    }
    throw new Error(`Timed out: ${description}`);
}

async function main() {
    assert.ok(fs.existsSync(edge), `Set EDGE_PATH to an installed Edge/Chromium executable: ${edge}`);
    fs.mkdirSync(screenshots, { recursive: true });
    server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (file !== root && !file.startsWith(root + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
        fs.readFile(file, (error, data) => {
            if (error) response.writeHead(404).end('Not found');
            else response.writeHead(200, { 'Content-Type': `${mime[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` }).end(data);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    browser = spawn(edge, [
        '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-gpu',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
    ], { windowsHide: true, stdio: 'ignore' });
    let spawnError;
    browser.on('error', error => { spawnError = error; });
    const portFile = path.join(profile, 'DevToolsActivePort');
    await waitFor(() => {
        if (spawnError) throw spawnError;
        return fs.existsSync(portFile);
    }, 'headless browser debugging port');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const target = await waitFor(async () => {
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
        return targets.find(item => item.type === 'page');
    }, 'browser page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const item = pending.get(message.id);
            pending.delete(message.id);
            clearTimeout(item.timeout);
            if (message.error) item.reject(new Error(JSON.stringify(message.error)));
            else item.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.description || arg.value).join(' '));
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    };
    const ready = () => waitFor(() => evaluate('Boolean(window.homepageController?.isInitialized && window.canvasController)'), 'homepage initialization');
    const settleCamera = () => waitFor(() => evaluate('window.canvasController.camera === null || window.canvasController.camera === undefined'), 'camera transition');
    const clickPoint = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    };
    const click = async selector => {
        const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw Error('Missing element'); const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; if (!e.contains(document.elementFromPoint(x, y))) throw Error('Element obscured: ' + ${JSON.stringify(selector)}); return {x,y}; })()`);
        await clickPoint(point.x, point.y);
    };
    const navigate = async name => {
        await click(`#canvas-nav [data-canvas-view="${name}"]`);
        await settleCamera();
    };
    const worldPoint = (x, y) => evaluate(`({x: canvasController.state.offsetX + (${x} + .5) * 50 * canvasController.state.scale, y: canvasController.state.offsetY + (${y} + .5) * 50 * canvasController.state.scale})`);
    const stroke = async cells => {
        const points = [];
        for (const [x, y] of cells) points.push(await worldPoint(x, y));
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points[0] });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', buttons: 1, clickCount: 1 });
        for (const point of points.slice(1)) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.at(-1), button: 'left', buttons: 0, clickCount: 1 });
    };
    const screenshot = async name => {
        // The existing theme adapter animates CSS colors for 500 ms.
        await delay(650);
        const result = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from(result.data, 'base64'));
    };
    const check = async (name, callback) => {
        try { await callback(); console.log(`PASS ${name}`); }
        catch (error) { failures.push({ name, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    await ready();

    await check('homepage initializes and entry occupies origin cell', async () => {
        assert.equal(await evaluate('canvasController.exploring === true'), false);
        const entry = await evaluate('(() => { const r = document.getElementById("canvas-entry").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()');
        assert.deepEqual(entry, { x: 50, y: 50, w: 50, h: 50 });
        assert.equal(await evaluate('document.querySelectorAll(".project-item").length > 0'), true);
        await screenshot('desktop-home');
    });
    await click('#canvas-entry');
    await settleCamera();
    await check('entry focuses upper-left editable profile', async () => {
        assert.equal(await evaluate('canvasController.focusedView'), 'profile');
        assert.equal(await evaluate('document.getElementById("canvas-profile").hidden'), false);
        await click('#profile-form input[name="name"]');
        await evaluate('document.activeElement.select()');
        await send('Input.insertText', { text: 'Canvas QA 1234' });
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '2', code: 'Digit2', text: '2', windowsVirtualKeyCode: 50 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '2', code: 'Digit2', windowsVirtualKeyCode: 50 });
        assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), 'light');
        await click('#profile-form button[type="submit"]');
        assert.equal(await evaluate('JSON.parse(localStorage.getItem("portfolio-canvas-profile")).name'), 'Canvas QA 12342');
        await screenshot('desktop-profile');
        await send('Page.reload');
        await ready();
        await click('#canvas-entry');
        await settleCamera();
        assert.equal(await evaluate('document.querySelector("#profile-form [name=name]").value'), 'Canvas QA 12342');
    });
    await check('12 × 12 snake and tetris animate automatically', async () => {
        await navigate('snake');
        assert.equal(await evaluate('canvasController.snake.size'), 12);
        const head = await evaluate('JSON.stringify(canvasController.snake.body[0])');
        await delay(300);
        assert.notEqual(await evaluate('JSON.stringify(canvasController.snake.body[0])'), head);
        await screenshot('desktop-snake');
        await navigate('tetris');
        const before = await evaluate('JSON.stringify([canvasController.tetris.piece, canvasController.tetris.pieces])');
        await delay(300);
        assert.notEqual(await evaluate('JSON.stringify([canvasController.tetris.piece, canvasController.tetris.pieces])'), before);
        await screenshot('desktop-tetris');
    });
    await check('real pointer painting, erasing, undo and clear', async () => {
        await navigate('paint');
        await stroke([[3, 4], [8, 4]]);
        assert.deepEqual(await evaluate('[...canvasController.paint.keys()].sort()'), ['3,4', '4,4', '5,4', '6,4', '7,4', '8,4']);
        assert.equal(await evaluate('canvasController.undoStack.length'), 1);
        await click('[data-paint-tool="erase"]');
        await stroke([[5, 4]]);
        assert.equal(await evaluate('canvasController.paint.has("5,4")'), false);
        await click('[data-paint-action="undo"]');
        assert.equal(await evaluate('canvasController.paint.has("5,4")'), true);
        await screenshot('desktop-paint');
        await click('[data-paint-action="clear"]');
        assert.equal(await evaluate('canvasController.paint.size'), 0);
        await click('[data-paint-action="undo"]');
        assert.equal(await evaluate('canvasController.paint.size'), 6);
    });
    await check('all four themes recolor existing canvas content', async () => {
        for (const theme of ['dark', 'pink', 'blue', 'light']) {
            await click(`.theme-button[data-theme="${theme}"]`);
            assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), theme);
            assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--canvas-bg-color") === themeManager.getCurrentTheme().canvas.bgColor'), true);
            assert.equal(await evaluate('canvasController.paint.size'), 6);
            await screenshot(`desktop-paint-${theme}`);
        }
    });
    await check('pan and wheel zoom preserve fixed world coordinates', async () => {
        await click('[data-paint-tool="pan"]');
        const before = await evaluate('({...canvasController.state})');
        const p = await worldPoint(6, 6);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', buttons: 1, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + 73, y: p.y + 31, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 73, y: p.y + 31, button: 'left', buttons: 0, clickCount: 1 });
        assert.equal(await evaluate('canvasController.state.offsetX'), before.offsetX + 73);
        assert.equal(await evaluate('canvasController.state.offsetY'), before.offsetY + 31);
        const coordinate = await evaluate('canvasController.getGridFromScreen(750, 500)');
        const scale = await evaluate('canvasController.state.scale');
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 750, y: 500, deltaX: 0, deltaY: -250 });
        await waitFor(() => evaluate(`canvasController.state.scale > ${scale}`), 'wheel zoom');
        assert.deepEqual(await evaluate('canvasController.getGridFromScreen(750, 500)'), coordinate);
        assert.deepEqual(await evaluate('[...canvasController.paint.keys()].sort()'), ['3,4', '4,4', '5,4', '6,4', '7,4', '8,4']);
    });
    await check('mobile profile, navigation, drawing and pinch zoom', async () => {
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        await delay(250);
        await navigate('profile');
        await screenshot('mobile-profile');
        await click('#profile-form input[name="contact"]');
        await send('Input.insertText', { text: 'qa@example.test' });
        assert.equal(await evaluate('document.querySelector("#profile-form [name=contact]").value'), 'qa@example.test');
        await navigate('paint');
        await click('[data-paint-tool="brush"]');
        const a = await worldPoint(3, 7), b = await worldPoint(6, 7);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...b, id: 1 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await evaluate('canvasController.paint.has("3,7") && canvasController.paint.has("6,7")'), true);
        await screenshot('mobile-paint');
        const scale = await evaluate('canvasController.state.scale');
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 350, id: 1 }, { x: 250, y: 350, id: 2 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 110, y: 350, id: 1 }, { x: 290, y: 350, id: 2 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.ok(await evaluate('canvasController.state.scale') > scale);
        await navigate('snake');
        await screenshot('mobile-snake');
        await navigate('tetris');
        await screenshot('mobile-tetris');
        await navigate('overview');
        await screenshot('mobile-overview');
        await navigate('home');
        assert.equal(await evaluate('document.body.classList.contains("canvas-exploring")'), false);
        assert.equal(await evaluate('document.getElementById("canvas-explore").hidden'), false);
        await screenshot('mobile-home');
    });
    await check('no page errors', async () => { assert.deepEqual(errors, []); });
    console.log(`Screenshots: ${screenshots}`);
    console.log(JSON.stringify({ failures, pageErrors: errors }, null, 2));
    if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    browser?.kill();
    server?.close();
    // Delete only the freshly created isolated profile, never a user's browser data.
    await delay(400);
    if (profile.startsWith(path.join(os.tmpdir(), 'portfolio-canvas-edge-'))) {
        try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (_) { /* Browser may still be shutting down. */ }
    }
});
