/* Run with `node tests/miner-browser.test.cjs`; no third-party packages needed.
 * Uses an isolated headless Edge profile and serves only this checkout locally.
 * Set EDGE_PATH or MINER_QA_OUTPUT to override browser/screenshot locations.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const edge = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const screenshots = process.env.MINER_QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-miner-screenshots-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-miner-edge-'));
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

    const clickPoint = async (x, y, button = 'left') => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'left' ? 1 : 2, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
    };
    const click = async selector => {
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
        const p = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
        await clickPoint(p.x, p.y);
    };
    const screenshot = async name => {
        const result = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
        fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from(result.data,'base64'));
    };
    const check = async (name, callback) => {
        try { await callback(); console.log(`PASS ${name}`); }
        catch (error) { failures.push({name,error:error.message}); console.error(`FAIL ${name}: ${error.stack}`); }
    };
    const start = async () => {
        await send('Page.navigate',{url: url+'projects/2d-miner-game/index.html'});
        await waitFor(()=>evaluate('typeof state !== "undefined" && state.grid.length===100'),'miner initialization');
    };
    const tilePoint = async (x,y) => evaluate(`(() => {const r=canvas.getBoundingClientRect();return {x:r.x+((${x}+.5)*TILE-view.x)*r.width/view.width,y:r.y+((${y}+.5)*TILE-view.y)*r.height/view.height};})()`);
    const mineTile = async (x,y) => {
        const p = await tilePoint(x,y); await clickPoint(p.x,p.y);
        await waitFor(()=>evaluate(`blockAt(${x},${y})===0`),`mine tile ${x},${y}`,2500);
    };
    const placePlayer = async x => evaluate(`clearInput(); Object.assign(player,{x:${x}*TILE+4,y:SURFACE*TILE-PLAYER_H,vx:0,vy:0,grounded:true});updateCamera(true);`);
    const key = async (type, code, value) => send('Input.dispatchKeyEvent',{type,code,key:value});
    const closeReset = async value => {
        await evaluate('window.resetClosed=new Promise(resolve=>$("reset-dialog").addEventListener("close",()=>resolve(true),{once:true}));true');
        await click(`#reset-dialog [value=${value}]`);
        await evaluate('resetClosed');
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await start();
    await evaluate('localStorage.clear();generateWorld(12345);updateUI();');

    await check('world generation: intact floor, complete trees, clear spawn and deterministic seed',async()=>{
        assert.equal(await evaluate('state.grid[99].every(t=>t===Block.BEDROCK)'),true);
        assert.ok(await evaluate('state.grid.flat().filter(t=>t===Block.LOG).length')>=24);
        assert.ok(await evaluate('state.grid.flat().filter(t=>t===Block.LEAVES).length')>30);
        assert.equal(await evaluate('collides(player.x,player.y)'),null);
        assert.equal(await evaluate('(() => {const a=JSON.stringify(state.grid);generateWorld(12345);return a===JSON.stringify(state.grid)})()'),true);
        assert.ok(await evaluate('state.grid.slice(30,60).flat().includes(Block.IRON)'));
        assert.ok(await evaluate('state.grid.slice(60,99).flat().includes(Block.DIAMOND)'));
    });
    await check('desktop layout has no overflow and shows all six inventory slots',async()=>{
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        assert.equal(await evaluate('document.querySelectorAll(".inventory-item").length'),6);
        await screenshot('desktop');
    });
    await check('keyboard movement, jump and pause use real input events',async()=>{
        await placePlayer(20);
        const x=await evaluate('player.x');
        await key('keyDown','KeyD','d'); await delay(350); await key('keyUp','KeyD','d');
        assert.ok(await evaluate('player.x')>x+25);
        const y=await evaluate('player.y');
        await key('keyDown','Space',' '); await key('keyUp','Space',' '); await delay(150);
        assert.ok(await evaluate('player.y')<y-20);
        await delay(750); assert.equal(await evaluate('player.grounded'),true);
        await key('keyDown','KeyP','p'); await key('keyUp','KeyP','p');
        assert.equal(await evaluate('state.paused'),true);
        const old=await evaluate('[player.x,player.y]'); await delay(150); assert.deepEqual(await evaluate('[player.x,player.y]'),old);
        await click('#resume-button'); assert.equal(await evaluate('state.paused'),false);
    });
    await check('tap mining, crafting costs, progression locks and ore tool gates',async()=>{
        await evaluate('generateWorld(12345);updateUI();');
        await placePlayer(15);
        for(const y of [7,6,5]) await mineTile(16,y);
        await placePlayer(24);
        for(const y of [7,6]) await mineTile(25,y);
        assert.equal(await evaluate('state.inventory[Block.LOG]'),5);
        await waitFor(()=>evaluate('!$("craft-wood-pickaxe").disabled'),'wood craft unlock');
        await click('#craft-wood-pickaxe');
        assert.equal(await evaluate('state.tool'),1); assert.equal(await evaluate('state.inventory[7]'),0);
        assert.equal(await evaluate('craftTool(3)'),false,'cannot skip a tool level');
        await evaluate('state.inventory[7]=5;state.inventory[2]=15;state.uiDirty=true;updateUI()');
        await click('#craft-stone-pickaxe'); assert.equal(await evaluate('state.tool'),2);
        await evaluate('state.inventory[2]=30;state.inventory[4]=10;state.uiDirty=true;updateUI()');
        await click('#craft-iron-pickaxe'); assert.equal(await evaluate('state.tool'),3);
        assert.deepEqual(await evaluate('[state.inventory[2],state.inventory[4]]'),[0,0]);
        await placePlayer(20);
        await evaluate('state.grid[8][21]=Block.DIAMOND;state.tool=2;');
        const p=await tilePoint(21,8); await clickPoint(p.x,p.y); await delay(300);
        assert.equal(await evaluate('blockAt(21,8)'),5); assert.match(await evaluate('$("message-box").textContent'),/铁镐/);
        await evaluate('state.tool=3'); await mineTile(21,8);
        assert.equal(await evaluate('state.diamonds'),1);
    });
    await check('mining stops after leaving reach and bedrock is protected',async()=>{
        await evaluate('generateWorld(12345);state.grid[8][21]=Block.STONE;'); await placePlayer(20);
        const p=await tilePoint(21,8);await clickPoint(p.x,p.y);
        await evaluate('player.x=0;'); await delay(900);
        assert.equal(await evaluate('blockAt(21,8)'),2);
        assert.match(await evaluate('miningError(20,99)'),/太远|底部/);
    });
    await check('holding and dragging the pointer continuously mines adjacent tiles',async()=>{
        await evaluate('generateWorld(12345)'); await placePlayer(20);
        const a=await tilePoint(21,8);
        await send('Input.dispatchMouseEvent',{type:'mousePressed',...a,button:'left',buttons:1,clickCount:1});
        await waitFor(()=>evaluate('blockAt(21,8)===0'),'held pointer mines first block');
        const b=await tilePoint(21,9);
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...b,button:'left',buttons:1});
        await waitFor(()=>evaluate('blockAt(21,9)===0'),'dragged pointer mines second block');
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',buttons:0,clickCount:1});
        assert.equal(await evaluate('pointer.held'),false);
        assert.equal(await evaluate('state.inventory[1]'),2);
    });
    await check('placing blocks consumes materials and cannot overlap the player',async()=>{
        await evaluate('returnToSurface(false);state.inventory[1]=2;state.selected=1;state.uiDirty=true;updateUI()');
        const p=await tilePoint(19,7); await clickPoint(p.x,p.y,'right');
        assert.equal(await evaluate('blockAt(19,7)'),1); assert.equal(await evaluate('state.inventory[1]'),1);
        const self=await tilePoint(20,7); await clickPoint(self.x,self.y,'right');
        assert.equal(await evaluate('blockAt(20,7)'),0); assert.equal(await evaluate('state.inventory[1]'),1);
    });
    await check('fixed-step collision catches high falls, ceiling jumps and world boundaries',async()=>{
        const outcome=await evaluate(`(() => {
            clearInput(); for(let y=0;y<99;y++) state.grid[y][20]=state.grid[y][21]=0;
            state.grid[50][20]=state.grid[50][21]=2;
            Object.assign(player,{x:20*TILE+3,y:35*TILE,vy:620,grounded:false});
            for(let i=0;i<300;i++) update(STEP);
            const landed=player.y==50*TILE-PLAYER_H&&player.grounded;
            state.grid[48][20]=state.grid[48][21]=2;player.jumpBuffer=.15;
            for(let i=0;i<80;i++)update(STEP);
            const ceiling=player.y>=49*TILE;
            player.x=0;keyboard.add('left');for(let i=0;i<120;i++)update(STEP);keyboard.clear();
            return {landed,ceiling,x:player.x,collision:collides(player.x,player.y)};
        })()`);
        assert.equal(outcome.landed,true);assert.equal(outcome.ceiling,true);assert.equal(outcome.x,0);assert.equal(outcome.collision,null);
        await evaluate('returnToSurface(false)');
    });
    await check('autosave and page reload preserve world, inventory, tools and statistics',async()=>{
        await evaluate('state.inventory[7]=17;state.tool=2;state.bestDepth=34;state.mined=83;state.dirty=true;');
        await waitFor(()=>evaluate('JSON.parse(localStorage.getItem(SAVE_KEY)).inventory[7]===17'),'automatic save',6500);
        const old=await evaluate('({seed:state.seed,grid:state.grid,inventory:state.inventory,tool:state.tool,mined:state.mined,bestDepth:state.bestDepth})');
        await evaluate('window.beforeReload=true');
        await send('Page.reload');await waitFor(()=>evaluate('typeof state!=="undefined"&&!window.beforeReload&&state.tool===2'),'restore saved game');
        assert.deepEqual(await evaluate('({seed:state.seed,grid:state.grid,inventory:state.inventory,tool:state.tool,mined:state.mined,bestDepth:state.bestDepth})'),old);
    });
    await check('idle rendering does not rebuild inventory DOM',async()=>{
        await evaluate('window.inventoryMutations=0;window.observer=new MutationObserver(list=>inventoryMutations+=list.length);observer.observe($("inventory-list"),{subtree:true,childList:true,characterData:true});');
        await delay(350); assert.equal(await evaluate('inventoryMutations'),0);await evaluate('observer.disconnect()');
    });
    await check('reset dialog supports cancellation and confirmed reset without replacing window.confirm',async()=>{
        await evaluate('setPaused(false)');
        await click('#reset-button'); assert.equal(await evaluate('$("reset-dialog").open'),true);
        await closeReset('cancel');
        assert.equal(await evaluate('state.tool'),2);assert.equal(await evaluate('state.paused'),false);
        await click('#reset-button');await closeReset('reset');await waitFor(()=>evaluate('state.tool===0'),'reset world');
        assert.deepEqual(await evaluate('[state.mined,state.bestDepth,Object.keys(state.inventory).length]'),[0,0,0]);
        assert.match(await evaluate('window.confirm.toString()'),/native code/);
        await evaluate('setPaused(true)'); await click('#reset-button'); await closeReset('cancel');
        assert.equal(await evaluate('state.paused'),true);
        await evaluate('setPaused(false)');
    });
    await check('malformed saves and denied storage degrade to a playable world',async()=>{
        assert.equal(await evaluate('localStorage.setItem(SAVE_KEY,"null");loadGame()'),false);
        assert.equal(await evaluate('localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,grid:[]}));loadGame()'),false);
        assert.equal(await evaluate('saveGame();const s=JSON.parse(localStorage.getItem(SAVE_KEY));s.player.x=-99;localStorage.setItem(SAVE_KEY,JSON.stringify(s));loadGame()'),false);
        assert.equal(await evaluate('window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error("denied")};saveGame(true)'),false);
        assert.match(await evaluate('$("save-status").textContent'),/不可用/);
        await evaluate('Storage.prototype.setItem=originalSetItem;generateWorld(12345);saveGame();');
    });
    await check('mobile 390px and 320px: no overflow, sharp canvas and scaled pointer coordinates',async()=>{
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
        await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
        await evaluate('window.scrollTo(0,0);generateWorld(12345);message("先收集 5 块木头，制作你的第一把镐。");'); await delay(150);
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        assert.equal(await evaluate('canvas.width===Math.round(view.width*2)'),true);
        assert.equal(await evaluate('getComputedStyle($("mobile-controls")).display'), 'flex');
        await screenshot('mobile');
        await placePlayer(20);
        const p=await tilePoint(21,8);
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await waitFor(()=>evaluate('blockAt(21,8)===0'),'mobile tap mines intended tile');
        await send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});await delay(100);
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        await screenshot('mobile-320');
    });
    await check('touch cancellation, focus loss and visibility suspend movement',async()=>{
        await evaluate('generateWorld(12345);');
        await evaluate('$("control-left").scrollIntoView({block:"center"})');
        const p=await evaluate('(() => {const r=$("control-left").getBoundingClientRect();return {x:r.x+20,y:r.y+20}})()');
        const jump=await evaluate('(() => {const r=$("control-jump").getBoundingClientRect();return {x:r.x+20,y:r.y+20}})()');
        const x=await evaluate('player.x'), y=await evaluate('player.y');
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:2}]});
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:2},{...jump,id:3}]});await delay(200);
        assert.ok(await evaluate('player.x')<x-10);
        assert.ok(await evaluate('player.y')<y-20,'two fingers can move and jump together');
        await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await delay(100);
        assert.equal(await evaluate('touchKeys.size'),0);assert.equal(await evaluate('player.vx'),0);
        await evaluate('window.dispatchEvent(new Event("blur"))');
        assert.equal(await evaluate('state.paused'),true);assert.equal(await evaluate('keyboard.size'),0);
        await evaluate('setPaused(false);Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden;');
        assert.equal(await evaluate('state.paused'),true);
        await evaluate('setPaused(false);generateWorld(12345);updateUI();window.scrollTo(0,0)');
    });
    await check('no runtime errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Screenshots: ${screenshots}`);
    console.log(JSON.stringify({failures,pageErrors:errors},null,2));
    if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
    if(socket?.readyState===WebSocket.OPEN)socket.close();
    browser?.kill();server?.close();
    await delay(500);
    // Only remove this process's freshly-created, isolated browser profile.
    if(profile.startsWith(path.join(os.tmpdir(),'portfolio-miner-edge-'))){
        try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200})}catch(_){}
    }
});
