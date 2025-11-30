/*
  Rewritten robust game.js
  - waits for window load
  - preloads images
  - responsive canvas with DPR scaling
  - parallax background
  - restart button wiring
*/

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas #gameCanvas not found');
        return;
    }
    const ctx = canvas.getContext('2d');

    // Asset list
    const assets = {
        // background and cloud images removed per request; use sky gradient instead
        character: 'assets/character.gif',
        coin: 'assets/coin.gif',
        obstacles: ['assets/obstacle1.png', 'assets/obstacle2.png', 'assets/obstacle3.png', 'assets/obstacle4.png'],
        buildings: ['assets/building1.png', 'assets/building2.png', 'assets/building3.png']
    };

    let images = {};
    let toLoad = 0;
    function preload(src, key, idx) {
        toLoad++;
        const img = new Image();
        img.onload = () => {
            if (idx !== undefined) {
                images[key] = images[key] || [];
                images[key][idx] = img;
            } else {
                images[key] = img;
            }
            toLoad--;
        };
        img.onerror = () => { console.warn('Failed to load', src); toLoad--; };
        img.src = src;
    }

    // start preloading (background and oli removed)
    preload(assets.character, 'character');
    preload(assets.coin, 'coin');
    assets.obstacles.forEach((s, i) => preload(s, 'obstacles', i));
    assets.buildings.forEach((s, i) => preload(s, 'buildings', i));

    // Game state
    let dpr = window.devicePixelRatio || 1;
    let displayWidth = 800, displayHeight = 350;
    let groundY = 0;
    let character = { x: 60, y: 0, width: 56, height: 56, vy: 0, jumping: false };
    let obstacles = [];
    let coins = [];
    // start slower per request
    // start slower per request
    let speed = 2.2;
    let gravity = 1.2;
    let frame = 0;
    let bankBalance = 100;
    let gameOver = false;
    let parallax = [];
    // time-based scenes
    let startTime = Date.now();
    const sceneDuration = 15000; // ms per scene
    const scenes = [
        { name: 'morning', top: '#a8d0ff', bottom: '#eaf6ff', sun: '#ffd166' },
        { name: 'day', top: '#87ceeb', bottom: '#bfefff', sun: '#fff59d' },
        { name: 'evening', top: '#ffcf9b', bottom: '#ff9aa2', sun: '#ffd166' },
        { name: 'night', top: '#0b2447', bottom: '#071133', sun: '#f5f3ce' }
    ];

    function hexToRgb(hex) {
        hex = hex.replace('#','');
        const bigint = parseInt(hex,16);
        return { r: (bigint>>16)&255, g: (bigint>>8)&255, b: bigint&255 };
    }
    function rgbToHex(r,g,b){ return '#' + [r,g,b].map(v=> v.toString(16).padStart(2,'0')).join(''); }
    function lerp(a,b,t){ return Math.round(a + (b-a)*t); }
    function lerpColor(c1,c2,t){ const a=hexToRgb(c1), b=hexToRgb(c2); return rgbToHex(lerp(a.r,b.r,t), lerp(a.g,b.g,t), lerp(a.b,b.b,t)); }

    const uiScore = document.getElementById('bankBalance');
    const uiGameOver = document.getElementById('gameOver');
    const restartBtn = document.getElementById('restartBtn');
    const mobileJump = document.getElementById('mobileJumpBtn');

    function updateUI() {
        if (uiScore) uiScore.textContent = `Bank Balance: ${bankBalance}`;
        // update persistent high bank badge while playing
        try {
            const prev = parseInt(localStorage.getItem('highBank') || '0', 10) || 0;
            const badge = document.getElementById('highBankBadge');
            if (badge) badge.textContent = `High: ${prev}`;
        } catch (e) { /* ignore */ }
    }

    function resetGame() {
        obstacles = [];
        coins = [];
        speed = 6;
        frame = 0;
        bankBalance = 100;
        gameOver = false;
        character.vy = 0;
        character.jumping = false;
        if (uiGameOver) uiGameOver.style.display = 'none';
        updateUI();
    }

    // wire restart button
    if (restartBtn) restartBtn.addEventListener('click', () => { resetGame(); });
    // initialize high bank badge from storage
    try {
        const prev = parseInt(localStorage.getItem('highBank') || '0', 10) || 0;
        const badge = document.getElementById('highBankBadge');
        if (badge) badge.textContent = `High: ${prev}`;
    } catch (e) { /* ignore */ }

    function spawnObstacle() {
        const imgs = images.obstacles || [];
        const idx = Math.floor(Math.random() * Math.max(1, imgs.length));
        // fixed obstacle height so runner can reliably jump over (increased)
        const h = Math.max(36, Math.round(displayHeight * 0.20));
        const w = Math.round(h * 1.0);
        obstacles.push({ x: displayWidth + 20, y: groundY + (character.height - h), width: w, height: h, imgIdx: idx });
    }

    function spawnCoin() {
        const size = Math.round(displayHeight * 0.16) || 48;
        const value = 10;
        coins.push({ x: displayWidth + 20, y: groundY - 80 - Math.random() * 60, width: size, height: size, value });
    }

    function isColliding(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function endGame() {
        gameOver = true;
        // update final bank balance and high score
        if (uiGameOver) uiGameOver.style.display = 'block';
        const finalEl = document.getElementById('finalScore');
        const highEl = document.getElementById('highScore');
        if (finalEl) finalEl.textContent = `Bank Balance: ${bankBalance}`;
        try {
            const prev = parseInt(localStorage.getItem('highBank') || '0', 10) || 0;
            if (bankBalance > prev) {
                localStorage.setItem('highBank', String(bankBalance));
                if (highEl) highEl.textContent = `High Bank: ${bankBalance}`;
            } else {
                if (highEl) highEl.textContent = `High Bank: ${prev}`;
            }
        } catch (e) {
            if (highEl) highEl.textContent = `High Bank: n/a`;
        }
    }

    function update() {
        if (gameOver) return;
        frame++;
    // slower acceleration
    if (frame % 1000 === 0) speed += 0.15;
        if (frame % 90 === 0) spawnObstacle();
        if (frame % 160 === 0) spawnCoin();

        obstacles.forEach(o => o.x -= speed);
        obstacles = obstacles.filter(o => o.x + o.width > -50);
        coins.forEach(c => c.x -= speed);
        coins = coins.filter(c => c.x + c.width > -50);

            // parallax
            parallax.forEach(layer => {
                layer.tiles.forEach(t => t.x -= speed * layer.multiplier);
                // recycle using each layer's tileWidth
                if (layer.tiles.length > 1) {
                    const first = layer.tiles[0];
                    if (first.x + (layer.tileWidth || displayWidth) < -50) {
                        const t = layer.tiles.shift();
                        t.x = layer.tiles[layer.tiles.length - 1].x + (layer.tileWidth || displayWidth);
                        layer.tiles.push(t);
                    }
                }
            });

        if (character.jumping) {
            character.y += character.vy;
            character.vy += gravity;
            if (character.y >= groundY) {
                character.y = groundY;
                character.jumping = false;
                character.vy = 0;
            }
        }

        // handle obstacle collisions: reduce bank balance and remove obstacle; end only if bankBalance <= 0
        for (let oIndex = obstacles.length - 1; oIndex >= 0; oIndex--) {
            const o = obstacles[oIndex];
            if (isColliding(character, o)) {
                bankBalance -= 25;
                obstacles.splice(oIndex, 1);
                updateUI();
                if (bankBalance <= 0) { endGame(); return; }
            }
        }
        // collect coins -> increase bank balance
        for (let i = coins.length - 1; i >= 0; i--) {
            if (isColliding(character, coins[i])) { bankBalance += (coins[i].value || 10); coins.splice(i, 1); updateUI(); }
        }
    }

    function draw() {
        // clear in CSS pixels
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        // dynamic sky gradient that cycles through scenes
        const elapsed = Date.now() - startTime;
        const total = scenes.length * sceneDuration;
        const pos = (elapsed % total) / total * scenes.length; // 0..scenes.length
        const idx = Math.floor(pos) % scenes.length;
        const next = (idx + 1) % scenes.length;
        const local = pos - Math.floor(pos); // 0..1 between scenes[idx] and scenes[next]
        const topColor = lerpColor(scenes[idx].top, scenes[next].top, local);
        const bottomColor = lerpColor(scenes[idx].bottom, scenes[next].bottom, local);
        const grd = ctx.createLinearGradient(0, 0, 0, displayHeight);
        grd.addColorStop(0, topColor);
        grd.addColorStop(1, bottomColor);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // sun/moon moving across based on elapsed percent of full cycle
        const cycleT = (elapsed % total) / total; // 0..1
        const sunX = Math.round(displayWidth * (cycleT));
        const sunY = Math.round(displayHeight * 0.18 + Math.sin(cycleT * Math.PI * 2) * (displayHeight * 0.06));
        const sunCol = lerpColor(scenes[idx].sun, scenes[next].sun, local);
        ctx.beginPath(); ctx.fillStyle = sunCol; ctx.globalAlpha = 0.95; ctx.arc(sunX, sunY, Math.max(10, displayHeight*0.06), 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

        // parallax layers
        parallax.forEach((layer, li) => {
            const img = layer.img;
            const h = layer.height;
            layer.tiles.forEach(tile => {
                if (img && img.complete) {
                    ctx.drawImage(img, tile.x, tile.y, layer.tileWidth, h);
                } else {
                    ctx.fillStyle = `rgba(60,60,60,${0.12 + li*0.08})`;
                    ctx.fillRect(tile.x, tile.y, layer.tileWidth, h);
                }
            });
        });

        // ground
        const roadY = groundY + character.height + 6;
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, roadY, displayWidth, displayHeight - roadY);
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(0, roadY - 8, displayWidth, 8);

        // character
        if (images.character && images.character.complete) ctx.drawImage(images.character, character.x, character.y - (character.height - character.width), character.width, character.height);
        else { ctx.fillStyle = '#2e7d32'; ctx.fillRect(character.x, character.y - character.height + character.width, character.width, character.height); }

        // obstacles
        obstacles.forEach(o => {
            const img = (images.obstacles || [])[o.imgIdx];
            if (img && img.complete) ctx.drawImage(img, o.x, o.y, o.width, o.height);
            else { ctx.fillStyle = '#b71c1c'; ctx.fillRect(o.x, o.y, o.width, o.height); }
        });

        // coins
        coins.forEach(c => {
            if (images.coin && images.coin.complete) ctx.drawImage(images.coin, c.x, c.y, c.width, c.height);
            else { ctx.fillStyle = '#ffeb3b'; ctx.fillRect(c.x, c.y, c.width, c.height); }
        });

    // UI text
    ctx.fillStyle = '#1565c0';
    ctx.font = Math.max(12, Math.round(displayHeight * 0.05)) + 'px Roboto, Arial';
    ctx.fillText(`Bank Balance: ${bankBalance}`, 12, Math.round(displayHeight * 0.08));
    }

    function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

    function jump() { if (gameOver) return; if (!character.jumping) { character.jumping = true; character.vy = -16; } }

    // Controls
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
        if (e.code === 'KeyR' && gameOver) resetGame();
    });
    canvas.addEventListener('click', () => jump());
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
    if (mobileJump) { mobileJump.addEventListener('click', () => jump()); mobileJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }); }

    // responsive setup
    function setupCanvas() {
        dpr = window.devicePixelRatio || 1;
        displayWidth = Math.min(window.innerWidth * 0.95, 1000);
        displayHeight = Math.min(400, Math.max(260, displayWidth * 0.35));
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
        canvas.width = Math.round(displayWidth * dpr);
        canvas.height = Math.round(displayHeight * dpr);
        // reset transform and scale to DPR
        ctx.setTransform(1,0,0,1,0,0);
        ctx.scale(dpr, dpr);

    groundY = displayHeight - Math.round(displayHeight * 0.28);
    character.width = Math.round(displayHeight * 0.30);
        character.height = character.width;
        character.x = Math.round(displayWidth * 0.06);
        character.y = groundY;

        // init parallax using building images; also add a cloud layer (oli) in front
        const bImgs = images.buildings || [];
        parallax = [];
        for (let i = 0; i < Math.max(1, bImgs.length); i++) {
            const img = bImgs[i];
            const multiplier = 0.18 + i * 0.12;
            const layerHeight = Math.round(displayHeight * (0.18 + i * 0.05));
            // compute tileWidth from image aspect if available
            let tileWidth = Math.round(displayWidth / (2 + i));
            if (img && img.width && img.height) {
                tileWidth = Math.round((img.width / img.height) * layerHeight) || tileWidth;
            }
            const tileCount = Math.ceil((displayWidth / tileWidth)) + 3;
            const tiles = [];
            for (let t = 0; t < tileCount; t++) tiles.push({ x: t * tileWidth, y: displayHeight - layerHeight - 40 - i * 6 });
            parallax.push({ img, multiplier, tiles, tileWidth, height: layerHeight });
        }
        // cloud layer removed per request
    }

    window.addEventListener('resize', () => { setupCanvas(); });

    // Wait for assets to load (or timeout) then start
    const startWhenReady = () => {
        if (toLoad <= 0) {
            setupCanvas();
            resetGame();
            gameLoop();
        } else {
            // poll a few times, but ensure start even if some assets failed
            setTimeout(startWhenReady, 100);
        }
    };
    // safety timeout: start after 2s even if some images missing
    setTimeout(startWhenReady, 200);
    startWhenReady();

});

