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
const consoleMessages = [];
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
        if (message.method === 'Runtime.consoleAPICalled') {
            const text = message.params.args.map(arg => arg.description || arg.value).join(' ');
            consoleMessages.push(text);
            if (message.params.type === 'error') errors.push(text);
        }
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

    const exposedGridPoint = () => evaluate('(() => { for(let y=110;y<Math.min(innerHeight-160,700);y+=40) for(let x=30;x<Math.min(innerWidth-40,500);x+=40) if(document.elementFromPoint(x,y)?.id === "gridCanvas") return {x,y}; throw Error("No exposed grid point"); })()');
    const drag = async (from, dx, dy) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + dx, y: from.y + dy, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x + dx, y: from.y + dy, button: 'left', buttons: 0, clickCount: 1 });
    };
    const resetDefault = async () => { await evaluate('canvasController.focusRegion("default")'); await settleCamera(); };
    const wheel = (point, ctrlKey = false) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX: 0, deltaY: -250, modifiers: ctrlKey ? 2 : 0 });
    const pinch = async () => {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 50, y: 120, id: 1 }, { x: 150, y: 120, id: 2 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 30, y: 120, id: 1 }, { x: 170, y: 120, id: 2 }] });
        // CDP touchEnd lists the finger lifted, not all the fingers still down.
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 170, y: 120, id: 2 }] });
        const offset = await evaluate('[canvasController.state.offsetX, canvasController.state.offsetY]');
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 45, y: 135, id: 1 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY]'), offset.map(value => value + 15));
    };

    await check('default shows exploration entry and blank random grid without seed or drawing controls', async () => {
        assert.equal(await evaluate('canvasController.defaultView'), true);
        assert.equal(await evaluate('canvasController.exploring'), false);
        assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY,canvasController.state.scale]'), [0,0,1]);
        assert.deepEqual(await evaluate('(() => {const r=document.getElementById("canvas-entry").getBoundingClientRect(); return [r.x,r.y,r.width,r.height];})()'), [0,0,50,50]);
        assert.equal(await evaluate('document.getElementById("canvas-explore").hidden'), false);
        assert.equal(await evaluate('document.getElementById("canvas-nav").hidden'), true);
        assert.equal(await evaluate('document.querySelectorAll("#paint-tools,#profile-form,#snake-seed-form,#snake-plan-status").length'), 0);
        assert.equal(await evaluate('document.getElementById("canvas-snake-controls").hidden'), true);
        assert.equal(await evaluate('typeof canvasController.paint'), 'undefined');
        assert.equal(await evaluate('document.querySelectorAll(".project-item").length > 0'), true);
        await evaluate('window.scrollTo(0,500)'); assert.ok(await evaluate('scrollY') > 0);
        await evaluate('window.scrollTo(0,0)');
        await screenshot('desktop-default');
    });
    if (process.env.CANVAS_QA_DEFAULT_ONLY) return;
    await check('normal wheel and Ctrl-wheel never zoom, while random theme blocks remain clickable', async () => {
        const point = await exposedGridPoint();
        await wheel(point); await wheel(point, true); await delay(150);
        assert.equal(await evaluate('canvasController.state.scale'), 1);
        assert.equal(await evaluate('visualViewport.scale'), 1);
        await evaluate('window.scrollTo(0,0); canvasController.clearAllBlocks(); window.qaOriginalRandom=Math.random; Math.random=()=>.006');
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await evaluate('Math.random=window.qaOriginalRandom; delete window.qaOriginalRandom');
        const block = await evaluate('({...canvasController.state.erasableBlocks[0]})');
        assert.ok(Number.isInteger(block.gridX) && Number.isInteger(block.gridY));
        await clickPoint(point.x, point.y);
        assert.equal(await evaluate('themeManager.getCurrentThemeKey()'), block.targetThemeKey);
        await evaluate('themeManager.setTheme("light")');
    });
    await check('four real origin corner buttons animate to profile, snake, tetris and default', async () => {
        for (const [id, view] of [['canvas-entry','profile'],['canvas-snake-link','snake'],['canvas-tetris-link','tetris'],['canvas-home','default']]) {
            await resetDefault();
            await drag(await exposedGridPoint(), 220, 220);
            assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY]'), [220,220]);
            if (view === 'profile') await screenshot('desktop-origin-links');
            await click(`#${id}`);
            assert.equal(await evaluate('canvasController.focusedView'), view);
            assert.equal(await evaluate('!!canvasController.camera'), true, 'each corner starts a movement animation');
            assert.equal(await evaluate('canvasController.camera.target.scale'), 1);
            await settleCamera();
            assert.equal(await evaluate('canvasController.state.scale'), 1);
            assert.equal(await evaluate('canvasController.exploring'), false);
            const point = await exposedGridPoint(); await wheel(point); await wheel(point, true);
            assert.equal(await evaluate('canvasController.state.scale'), 1, 'direct corner navigation does not enable zoom');
        }
    });
    await click('#canvas-entry'); await settleCamera();
    await check('AckerLi profile shows live Shanghai birthday age and exactly five supplied social icon links', async () => {
        assert.equal(await evaluate('document.getElementById("canvas-profile-title").textContent'), 'AckerLi');
        assert.equal(await evaluate('document.querySelector(".canvas-profile-age").textContent'), await evaluate('`年龄 ${CanvasProfile.getAge("2004-11-16")} 岁`'));
        const links = await evaluate('[...document.querySelectorAll("#canvas-profile .canvas-profile-link")].map(a=>({href:a.href,icon:!!a.querySelector("svg"),target:a.target,rel:a.rel,classes:a.className}))');
        assert.deepEqual(links.map(link=>link.href), [
            'https://space.bilibili.com/33230715', 'https://music.163.com/#/user/home?id=482756030',
            'https://qm.qq.com/q/7s6vz9hfCE', 'mailto:1602294513@qq.com', 'https://github.com/Paipaimon'
        ]);
        assert.ok(links.every(link=>link.icon && link.target === '_blank' && /noopener/.test(link.rel)));
        assert.match(links[1].classes,/netease/); assert.match(links[2].classes,/qq/);
        assert.equal(await evaluate('(() => {const p=document.querySelector(".canvas-profile-links").getBoundingClientRect(),n=document.querySelector("#canvas-profile > nav").getBoundingClientRect();return p.bottom <= n.top;})()'), true);
        await screenshot('desktop-profile');
    });
    await check('local profile avatar loads and responds to hover, click, keyboard and reduced motion', async () => {
        await waitFor(()=>evaluate('document.querySelector(".canvas-profile-avatar-button img")?.naturalWidth > 0'),'local avatar image');
        assert.equal(await evaluate('new URL(document.querySelector(".canvas-profile-avatar-button img").src).pathname'), '/assets/profile.png');
        const point=await evaluate('(() => { const r=document.querySelector(".canvas-profile-avatar-button").getBoundingClientRect(); return {x:r.right-7,y:r.top+7}; })()');
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
        assert.ok(await evaluate('Math.abs(parseFloat(document.querySelector(".canvas-profile-avatar-button").style.getPropertyValue("--avatar-rx")))') > 0);
        await click('.canvas-profile-avatar-button');
        assert.equal(await evaluate('document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),true,'mouse click starts the avatar animation');
        await waitFor(()=>evaluate('!document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),'mouse avatar animation completes');
        await evaluate('document.querySelector(".canvas-profile-avatar-button").focus()');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        assert.equal(await evaluate('document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),true,'Enter starts the avatar animation');
        await waitFor(()=>evaluate('!document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),'keyboard avatar animation completes');
        await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
        await click('.canvas-profile-avatar-button');
        assert.equal(await evaluate('document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),false);
        await send('Emulation.setEmulatedMedia',{features:[]});
    });
    if (process.env.CANVAS_QA_AVATAR_ONLY) { assert.deepEqual(failures,[]); return; }
    await check('exploration menu alone enables anchored wheel zoom and exits through an animation', async () => {
        await click('#canvas-explore'); await settleCamera();
        assert.equal(await evaluate('canvasController.exploring'), true);
        assert.equal(await evaluate('document.getElementById("canvas-nav").hidden'), false);
        const point = await exposedGridPoint();
        const anchor = await evaluate(`({x:(${point.x}-canvasController.state.offsetX)/canvasController.state.scale,y:(${point.y}-canvasController.state.offsetY)/canvasController.state.scale})`);
        const before = await evaluate('canvasController.state.scale'); await wheel(point);
        await waitFor(()=>evaluate(`canvasController.state.scale > ${before}`),'exploration wheel zoom');
        const after = await evaluate(`({x:(${point.x}-canvasController.state.offsetX)/canvasController.state.scale,y:(${point.y}-canvasController.state.offsetY)/canvasController.state.scale})`);
        assert.ok(Math.abs(anchor.x-after.x)<1e-7 && Math.abs(anchor.y-after.y)<1e-7);
        await navigate('overview'); await screenshot('desktop-overview');
        await navigate('snake'); await screenshot('desktop-snake');
        await click('#canvas-exit'); assert.equal(await evaluate('!!canvasController.camera'),true); await settleCamera();
        assert.equal(await evaluate('canvasController.exploring'),false);
        assert.deepEqual(await evaluate('[canvasController.state.offsetX,canvasController.state.offsetY,canvasController.state.scale]'),[0,0,1]);
    });
    await check('snake seeds exist only in console helpers and workers compute adaptive winning paths', async () => {
        await waitFor(()=>evaluate('!canvasController.snakePlanning && !!canvasController.snake.plan'),'initial adaptive winning plan',45000);
        const original = await evaluate('canvasSnakeDebug.seed');
        const generated = await evaluate('canvasSnakeDebug.newSeed()');
        assert.notEqual(generated,original);
        await evaluate('canvasSnakeDebug.restart("qa-browser-v3")');
        await waitFor(()=>evaluate('!canvasController.snakePlanning && canvasController.snake.plan?.seed === "qa-browser-v3"'),'console-selected winning plan',45000);
        assert.equal(await evaluate('canvasController.snake.plan.steps === Math.min(...canvasController.snake.plan.candidateSteps)'),true);
        assert.equal(await evaluate('canvasController.snake.plan.rewires > 0 && canvasController.snake.plan.directPaths > 0'),true);
        assert.ok(consoleMessages.some(message=>message.includes('[CanvasSnake] seed:') && message.includes(generated)));
        const head = await evaluate('JSON.stringify(canvasController.snake.body[0])'); await delay(250);
        assert.notEqual(await evaluate('JSON.stringify(canvasController.snake.body[0])'),head);
        const beforeRound = await evaluate('canvasSnakeDebug.seed');
        await evaluate('canvasController.snake.won=true; canvasController.snake.restartIn=0');
        await waitFor(()=>evaluate(`canvasSnakeDebug.seed !== ${JSON.stringify(beforeRound)}`),'new random seed for next round');
        assert.equal(await evaluate('document.querySelectorAll("#snake-seed-form,#snake-plan-status").length'),0);
    });
    await check('game boards have two-cell axis gaps and working reset and cross-region links below them', async () => {
        await resetDefault(); await click('#canvas-explore'); await settleCamera();
        assert.deepEqual(await evaluate('({...canvasController.regions.snake})'),{x:2,y:-14,w:12,h:12});
        assert.deepEqual(await evaluate('({...canvasController.regions.tetris})'),{x:-12,y:2,w:10,h:16});
        await navigate('snake');
        const snakeBounds=await evaluate('(() => {const c=canvasController,s=c.state,r=c.regions.snake,b=document.getElementById("canvas-snake-controls").getBoundingClientRect();return {top:b.top,bottom:b.bottom,boardBottom:s.offsetY+(r.y+r.h)*50*s.scale};})()');
        assert.ok(snakeBounds.top>snakeBounds.boardBottom && snakeBounds.bottom<1000);
        await waitFor(()=>evaluate('!canvasController.snakePlanning'),'ready to reset snake',45000);
        const seed=await evaluate('canvasSnakeDebug.seed');
        await evaluate('canvasController.snake.steps=99;canvasController.snake.score=9');
        await click('#canvas-snake-controls [data-canvas-reset=snake]');
        assert.equal(await evaluate('canvasSnakeDebug.seed'),seed);
        assert.ok(await evaluate('canvasController.snake.steps')<5);
        assert.equal(await evaluate('canvasController.snake.score'),0);
        await click('#canvas-snake-controls [data-canvas-view=tetris]'); await settleCamera();
        assert.equal(await evaluate('canvasController.focusedView'),'tetris');
        assert.deepEqual(await evaluate('[canvasController.tetris.columns,canvasController.tetris.rows]'),[10,16]);
        const tetrisBounds=await evaluate('(() => {const c=canvasController,s=c.state,r=c.regions.tetris,b=document.getElementById("canvas-tetris-controls").getBoundingClientRect();return {top:b.top,bottom:b.bottom,boardBottom:s.offsetY+(r.y+r.h)*50*s.scale};})()');
        assert.ok(tetrisBounds.top>tetrisBounds.boardBottom && tetrisBounds.bottom<1000);
        await evaluate('canvasController.tetris.board[15][0]=4;canvasController.tetris.lines=3;canvasController.tetris.score=100');
        await click('#canvas-tetris-controls [data-canvas-reset=tetris]');
        assert.deepEqual(await evaluate('[canvasController.tetris.lines,canvasController.tetris.score]'),[0,0]);
        assert.equal(await evaluate('canvasController.tetris.board.every(row=>row.every(cell=>!cell))'),true);
        await screenshot('desktop-tetris-controls');
        await click('#canvas-tetris-controls [data-canvas-view=snake]'); await settleCamera();
        await screenshot('desktop-snake-controls');
        await click('#canvas-snake-controls [data-canvas-view=default]'); await settleCamera();
        await evaluate('window.scrollTo(0,500)');
        await click('#canvas-entry'); await settleCamera();
        await navigate('default');
        assert.deepEqual(await evaluate('[scrollY,canvasController.state.offsetX,canvasController.state.offsetY,canvasController.state.scale]'),[0,0,0,1]);
    });
    await check('automatic tetris and all four themes remain usable in exploration', async () => {
        await click('#canvas-explore'); await settleCamera(); await navigate('tetris');
        const before=await evaluate('JSON.stringify([canvasController.tetris.piece,canvasController.tetris.pieces])'); await delay(250);
        assert.notEqual(await evaluate('JSON.stringify([canvasController.tetris.piece,canvasController.tetris.pieces])'),before);
        await screenshot('desktop-tetris'); await navigate('profile');
        for (const theme of ['dark','pink','blue','light']) {
            await click(`.theme-button[data-theme="${theme}"]`);
            assert.equal(await evaluate('themeManager.getCurrentThemeKey()'),theme);
            assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--canvas-bg-color") === themeManager.getCurrentTheme().canvas.bgColor'),true);
            await screenshot(`desktop-profile-${theme}`);
        }
        await navigate('default');
    });
    await check('mobile profile, media links and menu remain visible without layout overflow', async () => {
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
        await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
        await delay(250); await click('#canvas-entry'); await settleCamera();
        assert.deepEqual(await evaluate('[innerWidth,innerHeight]'),[390,844]);
        assert.equal(await evaluate('canvasController.state.scale'),1);
        await click('.theme-button[data-theme="dark"]'); assert.equal(await evaluate('themeManager.getCurrentThemeKey()'),'dark');
        await click('.theme-button[data-theme="light"]');
        assert.equal(await evaluate('document.querySelectorAll("#canvas-profile .canvas-profile-link").length'),5);
        const bounds=await evaluate('(() => {const p=document.querySelector(".canvas-profile-links").getBoundingClientRect(),n=document.querySelector("#canvas-profile > nav").getBoundingClientRect(),a=document.querySelector(".canvas-profile-age").getBoundingClientRect();return {links:p.toJSON(),nav:n.toJSON(),age:a.toJSON()};})()');
        assert.ok(bounds.links.left>=0 && bounds.links.right<=390 && bounds.links.bottom<=bounds.nav.top);
        assert.ok(bounds.age.top>=0 && bounds.age.bottom<=844);
        await screenshot('mobile-profile');
        const avatarPoint=await evaluate('(() => {const r=document.querySelector(".canvas-profile-avatar-button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...avatarPoint,id:10}]});
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await waitFor(()=>evaluate('document.querySelector(".canvas-profile-avatar-button").classList.contains("is-waving")'),'touch avatar interaction');
        // This gesture begins on profile DOM rather than the canvas. It must
        // not trigger the browser's native page pinch zoom either.
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 330, id: 11 }, { x: 210, y: 330, id: 12 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 50, y: 330, id: 11 }, { x: 240, y: 330, id: 12 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await evaluate('visualViewport.scale'),1,'normal profile DOM also prevents native page pinch zoom');
        assert.equal(await evaluate('canvasController.state.scale'),1);
        const normalScale=await evaluate('canvasController.state.scale'); await pinch();
        assert.equal(await evaluate('canvasController.state.scale'),normalScale,'normal-mode two-finger gestures only pan');
        const point=await exposedGridPoint(); await wheel(point); await wheel(point,true);
        assert.equal(await evaluate('canvasController.state.scale'),1);
        await click('#canvas-explore'); await settleCamera();
        const exploreScale=await evaluate('canvasController.state.scale'); await pinch();
        assert.ok(await evaluate('canvasController.state.scale')>exploreScale,'exploration pinch zoom is enabled');
        await navigate('overview'); await screenshot('mobile-overview');
        await navigate('snake'); await screenshot('mobile-snake');
        const gameControlsFit=id=>evaluate(`(() => {const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(),m=document.getElementById("canvas-nav").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>0&&r.bottom<=m.top;})()`);
        assert.equal(await gameControlsFit('canvas-snake-controls'),true);
        await click('#canvas-snake-controls [data-canvas-view=tetris]'); await settleCamera(); await screenshot('mobile-tetris');
        assert.equal(await gameControlsFit('canvas-tetris-controls'),true);
        await click('#canvas-tetris-controls [data-canvas-reset=tetris]');
        assert.equal(await evaluate('canvasController.tetris.lines'),0);
        await navigate('default');
        assert.deepEqual(await evaluate('[canvasController.exploring,canvasController.state.offsetX,canvasController.state.offsetY,canvasController.state.scale]'),[false,0,0,1]);
        assert.deepEqual(await evaluate('[innerWidth,innerHeight]'),[390,844]);
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
