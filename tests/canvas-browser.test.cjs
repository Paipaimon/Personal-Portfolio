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
        const selector = await evaluate(`(() => { const list = [...document.querySelectorAll('[data-canvas-view="${name}"]')]; const e = list.find(e => { const r = e.getBoundingClientRect(); return r.width && r.height && e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }); if (!e) throw Error('No visible navigation to ${name}'); e.dataset.qaTarget = 'true'; return '[data-qa-target=true]'; })()`);
        await click(selector);
        await evaluate('document.querySelectorAll("[data-qa-target]").forEach(e => delete e.dataset.qaTarget)');
        await settleCamera();
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

    await check('default fills the right-bottom quadrant without drawing or explorer controls', async () => {
        assert.equal(await evaluate('canvasController.defaultView'), true);
        assert.deepEqual(await evaluate('[canvasController.state.offsetX, canvasController.state.offsetY, canvasController.state.scale]'), [0, 0, 1]);
        const entry = await evaluate('(() => { const r = document.getElementById("canvas-entry").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()');
        assert.deepEqual(entry, { x: 0, y: 0, w: 50, h: 50 });
        assert.equal(await evaluate('document.querySelectorAll("#canvas-nav,#canvas-explore,#paint-tools,#profile-form").length'), 0);
        assert.equal(await evaluate('document.querySelectorAll(".project-item").length > 0'), true);
        assert.equal(await evaluate('typeof canvasController.paint'), 'undefined');
        assert.equal(await evaluate('document.getElementById("canvas-snake-controls").hidden'), true);
        await evaluate('window.scrollTo(0,500)');
        assert.ok(await evaluate('window.scrollY') > 0, 'default homepage retains vertical scrolling');
        await evaluate('window.scrollTo(0,0)');
        await screenshot('desktop-default');
    });
    if (process.env.CANVAS_QA_DEFAULT_ONLY) {
        if (failures.length) process.exitCode = 1;
        return;
    }
    await check('real mouse movement restores random clickable theme blocks', async () => {
        const point = await evaluate('(() => { for(let y=200;y<800;y+=50) for(let x=100;x<400;x+=50) if(document.elementFromPoint(x+25,y+25)?.id === "gridCanvas") return {x:x+25,y:y+25}; throw Error("No exposed grid point"); })()');
        await evaluate('canvasController.clearAllBlocks(); window.qaOriginalRandom = Math.random; Math.random = () => .6 / 100');
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await evaluate('Math.random = window.qaOriginalRandom; delete window.qaOriginalRandom');
        const block = await evaluate('({...canvasController.state.erasableBlocks[0]})');
        assert.ok(block.gridX >= 0 && block.gridY >= 0);
        await clickPoint(point.x, point.y);
        assert.equal(await evaluate('canvasController.state.erasableBlocks[0]?.isClicked'), true);
        assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), block.targetThemeKey);
        await evaluate('themeManager.setTheme("light")');
    });
    await click('#canvas-entry');
    await settleCamera();
    await check('entry pans directly to a configured profile and visible return grid cell', async () => {
        assert.equal(await evaluate('canvasController.focusedView'), 'profile');
        assert.equal(await evaluate('document.body.classList.contains("canvas-exploring")'), false);
        assert.equal(await evaluate('getComputedStyle(document.getElementById("homepage-content")).display !== "none"'), true);
        assert.equal(await evaluate('document.getElementById("canvas-profile-title").textContent'), await evaluate('PORTFOLIO_PROFILE.name'));
        assert.equal(await evaluate('document.querySelectorAll("#canvas-profile input,#canvas-profile textarea").length'), 0);
        assert.equal(await evaluate('document.getElementById("canvas-home").hidden'), false);
        const offset = await evaluate('(() => { const a=document.getElementById("canvas-entry").getBoundingClientRect(), b=document.getElementById("canvas-home").getBoundingClientRect(); return [a.x-b.x,a.y-b.y,b.width,b.height]; })()');
        assert.ok(offset.every(value => Math.abs(value - offset[0]) < .01));
        await screenshot('desktop-profile');
    });
    await check('configured media and contact links render local SVG icons safely', async () => {
        await evaluate('CanvasProfile.render(document.getElementById("canvas-profile"), {...PORTFOLIO_PROFILE,name:"Jlands <b>literal</b>",links:[{label:"GitHub",icon:"github",url:"https://example.test/profile"},{label:"Mail",icon:"mail",url:"mailto:qa@example.test"},{label:"Phone",icon:"phone",url:"tel:+8613800000000"},{label:"Video",icon:"bilibili",url:"https://example.test/video"},{label:"Empty",icon:"link",url:""},{label:"Unsafe",icon:"link",url:"javascript:alert(1)"}]})');
        const links = await evaluate('[...document.querySelectorAll("#canvas-profile .canvas-profile-link")].map(a=>({label:a.getAttribute("aria-label"),icon:!!a.querySelector("svg"),href:a.href,target:a.target,rel:a.rel}))');
        assert.equal(links.length, 4);
        assert.ok(links.every(link => link.icon && link.label));
        assert.equal(links[0].target, '_blank'); assert.match(links[0].rel, /noopener/);
        assert.equal(links[1].href, 'mailto:qa@example.test');
        assert.equal(await evaluate('document.querySelector("#canvas-profile-title b")'), null);
        assert.match(await evaluate('document.getElementById("canvas-profile-title").textContent'), /<b>literal<\/b>/);
        await screenshot('desktop-profile-links');
        await evaluate('CanvasProfile.render(document.getElementById("canvas-profile"), PORTFOLIO_PROFILE)');
    });
    await check('seeded worker plans winning routes, replays them and reproduces the same seed', async () => {
        await navigate('snake');
        assert.equal(await evaluate('canvasController.snake.size'), 12);
        await waitFor(() => evaluate('!canvasController.snakePlanning && !!canvasController.snake.plan'), 'initial winning route plan', 30000);
        await click('#snake-seed');
        await evaluate('document.activeElement.select()');
        await send('Input.insertText', { text: 'qa-seed-1234' });
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '2', code: 'Digit2', text: '2', windowsVirtualKeyCode: 50 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '2', code: 'Digit2', windowsVirtualKeyCode: 50 });
        assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), 'light', 'seed editing must not trigger a theme shortcut');
        await click('#snake-seed-form button[type=submit]');
        await waitFor(() => evaluate('!canvasController.snakePlanning && canvasController.snake.plan?.seed === "qa-seed-12342"'), 'custom winning route plan', 30000);
        const plan = await evaluate('JSON.stringify(canvasController.snake.plan)');
        assert.equal(await evaluate('canvasController.snake.plan.steps === Math.min(...canvasController.snake.plan.candidateSteps)'), true);
        const head = await evaluate('JSON.stringify(canvasController.snake.body[0])');
        await delay(300);
        assert.notEqual(await evaluate('JSON.stringify(canvasController.snake.body[0])'), head);
        await click('#snake-seed-form button[type=submit]');
        await waitFor(() => evaluate('!canvasController.snakePlanning && !!canvasController.snake.plan'), 'repeated winning route plan', 30000);
        assert.equal(await evaluate('JSON.stringify(canvasController.snake.plan)'), plan);
        await screenshot('desktop-snake');
    });
    await check('tetris keeps running and real navigation remains reachable', async () => {
        await navigate('profile'); await navigate('tetris');
        const before = await evaluate('JSON.stringify([canvasController.tetris.piece, canvasController.tetris.pieces])');
        await delay(300);
        assert.notEqual(await evaluate('JSON.stringify([canvasController.tetris.piece, canvasController.tetris.pieces])'), before);
        await screenshot('desktop-tetris');
        await navigate('profile');
    });
    await check('all four themes recolor the profile, controls and grid', async () => {
        for (const theme of ['dark', 'pink', 'blue', 'light']) {
            await click(`.theme-button[data-theme="${theme}"]`);
            assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), theme);
            assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--canvas-bg-color") === themeManager.getCurrentTheme().canvas.bgColor'), true);
            await screenshot(`desktop-profile-${theme}`);
        }
    });
    await check('pointer pan and wheel zoom keep world positions fixed', async () => {
        const p = await evaluate('(() => { for(let y=100;y<800;y+=50) for(let x=50;x<400;x+=50) if(document.elementFromPoint(x,y)?.id === "gridCanvas") return {x,y}; throw Error("No exposed grid point"); })()');
        const before = await evaluate('({...canvasController.state})');
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', buttons: 1, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + 73, y: p.y + 31, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 73, y: p.y + 31, button: 'left', buttons: 0, clickCount: 1 });
        assert.equal(await evaluate('canvasController.state.offsetX'), before.offsetX + 73);
        assert.equal(await evaluate('canvasController.state.offsetY'), before.offsetY + 31);
        const coordinate = await evaluate(`canvasController.getGridFromScreen(${p.x}, ${p.y})`);
        const scale = await evaluate('canvasController.state.scale');
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...p, deltaX: 0, deltaY: -250 });
        await waitFor(() => evaluate(`canvasController.state.scale > ${scale}`), 'wheel zoom');
        assert.deepEqual(await evaluate(`canvasController.getGridFromScreen(${p.x}, ${p.y})`), coordinate);
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await settleCamera();
        assert.equal(await evaluate('canvasController.defaultView'), true);
    });
    await check('mobile profile, return cell, seed controls, touch pan and pinch', async () => {
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        await delay(250);
        await click('#canvas-entry'); await settleCamera();
        assert.deepEqual(await evaluate('[innerWidth,innerHeight]'), [390,844], 'world camera must not expand the mobile layout viewport');
        await click('.theme-button[data-theme="dark"]');
        assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), 'dark');
        await click('.theme-button[data-theme="light"]');
        await evaluate('CanvasProfile.render(document.getElementById("canvas-profile"), {...PORTFOLIO_PROFILE, links: ["github","bilibili","mail","link","phone","wechat","video"].map((icon,i)=>({label:icon,icon,url:"https://example.test/"+i}))})');
        assert.equal(await evaluate('document.querySelectorAll("#canvas-profile .canvas-profile-link").length'), 7);
        assert.equal(await evaluate('(() => {const p=document.querySelector(".canvas-profile-links").getBoundingClientRect(),n=document.querySelector("#canvas-profile > nav").getBoundingClientRect();return p.bottom <= n.top;})()'), true);
        await screenshot('mobile-profile');
        const home = await evaluate('(() => { const r=document.getElementById("canvas-home").getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()');
        assert.ok(home.x >= 0 && home.y >= 0 && home.x + home.w <= 390 && home.y + home.h <= 844);
        await click('#canvas-home'); await settleCamera();
        assert.deepEqual(await evaluate('[canvasController.state.offsetX, canvasController.state.offsetY, canvasController.state.scale]'), [0,0,1]);
        await click('#canvas-entry'); await settleCamera();
        await navigate('snake'); await screenshot('mobile-snake');
        await click('#snake-seed'); await evaluate('document.activeElement.select()');
        await send('Input.insertText', { text: 'mobile-seed' });
        await click('#snake-seed-form button[type=submit]');
        await waitFor(() => evaluate('!canvasController.snakePlanning && canvasController.snake.plan?.seed === "mobile-seed"'), 'mobile winning route plan', 30000);
        await navigate('profile');
        const scale = await evaluate('canvasController.state.scale');
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 50, y: 120, id: 1 }, { x: 150, y: 120, id: 2 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 30, y: 120, id: 1 }, { x: 170, y: 120, id: 2 }] });
        // CDP touchEnd lists the finger being lifted; id 1 remains down.
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 170, y: 120, id: 2 }] });
        const offset = await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY]');
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 45, y: 135, id: 1 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.ok(await evaluate('canvasController.state.scale') > scale);
        assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY]'), offset.map(x=>x+15));
        await evaluate('canvasController.focusRegion("profile")'); await settleCamera();
        await navigate('tetris'); await screenshot('mobile-tetris');
        await navigate('default');
        assert.equal(await evaluate('document.body.classList.contains("canvas-exploring")'), false);
        assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY,canvasController.state.scale]'), [0,0,1]);
        assert.equal(await evaluate('document.getElementById("canvas-snake-controls").hidden'), true);
        await screenshot('mobile-default');
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
