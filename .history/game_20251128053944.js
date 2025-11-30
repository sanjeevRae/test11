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
        background: 'assets/background.png',
        character: 'assets/character.gif',
        coin: 'assets/coin.gif',
        obstacles: ['assets/obstacle1.png', 'assets/obstacle2.png', 'assets/obstacle3.png', 'assets/obstacle4.png'],
        buildings: ['assets/building1.png', 'assets/building2.png', 'assets/building3.png'],
        oli: 'assets/oli.png'
    };

    let images = {};
    let toLoad = 0;
    function preload(src, key, idx) {
        toLoad++;
        const img = new Image();
        img.onload = () => { images[key] = images[key] || []; if (idx !== undefined) images[key][idx] = img; toLoad--; }; 
        img.onerror = () => { console.warn('Failed to load', src); toLoad--; };
        img.src = src;
    }

    // start preloading
    preload(assets.background, 'background');
    preload(assets.character, 'character');
    preload(assets.coin, 'coin');
    assets.obstacles.forEach((s, i) => preload(s, 'obstacles', i));
    assets.buildings.forEach((s, i) => preload(s, 'buildings', i));
    preload(assets.oli, 'oli');

    // Game state
    let dpr = window.devicePixelRatio || 1;
    let displayWidth = 800, displayHeight = 350;
    let groundY = 0;
    let character = { x: 60, y: 0, width: 56, height: 56, vy: 0, jumping: false };
    let obstacles = [];
    let coins = [];
    let speed = 6;
    let gravity = 1.2;
    let frame = 0;
    let score = 0;
    let gameOver = false;
    let parallax = [];

    const uiScore = document.getElementById('bankBalance');
    const uiGameOver = document.getElementById('gameOver');
    const restartBtn = document.getElementById('restartBtn');
    const mobileJump = document.getElementById('mobileJumpBtn');

    function updateUI() {
        if (uiScore) uiScore.textContent = `Score: ${score}`;
    }

    function resetGame() {
        obstacles = [];
        coins = [];
        speed = 6;
        frame = 0;
        score = 0;
        gameOver = false;
        character.vy = 0;
        character.jumping = false;
        if (uiGameOver) uiGameOver.style.display = 'none';
        updateUI();
    }

    // wire restart button
    if (restartBtn) restartBtn.addEventListener('click', () => { resetGame(); });

    function spawnObstacle() {
        const imgs = images.obstacles || [];
        const idx = Math.floor(Math.random() * Math.max(1, imgs.length));
        const h = Math.round(36 + Math.random() * 40);
        const w = Math.round(h * 0.9);
        obstacles.push({ x: displayWidth + 20, y: groundY + (character.height - h), width: w, height: h, imgIdx: idx });
    }

    function spawnCoin() {
        const size = Math.round(displayHeight * 0.08) || 28;
        coins.push({ x: displayWidth + 20, y: groundY - 80 - Math.random() * 60, width: size, height: size });
    }

    function isColliding(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function endGame() {
        gameOver = true;
        if (uiGameOver) uiGameOver.style.display = 'block';
    }

    function update() {
        if (gameOver) return;
        frame++;
        if (frame % 600 === 0) speed += 0.5;
        if (frame % 90 === 0) spawnObstacle();
        if (frame % 160 === 0) spawnCoin();

        obstacles.forEach(o => o.x -= speed);
        obstacles = obstacles.filter(o => o.x + o.width > -50);
        coins.forEach(c => c.x -= speed);
        coins = coins.filter(c => c.x + c.width > -50);

        // parallax
        parallax.forEach(layer => {
            layer.tiles.forEach(t => t.x -= speed * layer.multiplier);
            // recycle
            if (layer.tiles.length > 1) {
                const first = layer.tiles[0];
                if (first.x + layer.tileWidth < -50) {
                    const t = layer.tiles.shift();
                    t.x = layer.tiles[layer.tiles.length - 1].x + layer.tileWidth;
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

        for (let o of obstacles) {
            if (isColliding(character, o)) { endGame(); return; }
        }
        for (let i = coins.length - 1; i >= 0; i--) {
            if (isColliding(character, coins[i])) { score += 10; coins.splice(i, 1); updateUI(); }
        }
    }

    function draw() {
        // clear in CSS pixels
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        // sky / background
        if (images.background && images.background.complete) ctx.drawImage(images.background, 0, 0, displayWidth, displayHeight);
        else {
            // fallback sky
            const g = ctx.createLinearGradient(0, 0, 0, displayHeight);
            g.addColorStop(0, '#b3e5fc');
            g.addColorStop(1, '#e3f2fd');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, displayWidth, displayHeight);
        }

        // parallax layers
        parallax.forEach((layer, li) => {
            const img = layer.img;
            const h = layer.height;
            layer.tiles.forEach(tile => {
                if (img && img.complete) ctx.drawImage(img, tile.x, tile.y, layer.tileWidth, h);
                else {
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
        ctx.fillText(`Score: ${score}`, 12, Math.round(displayHeight * 0.08));
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

        groundY = displayHeight - Math.round(displayHeight * 0.26);
        character.width = Math.round(displayHeight * 0.16);
        character.height = character.width;
        character.x = Math.round(displayWidth * 0.06);
        character.y = groundY;

        // init parallax
        const bImgs = images.buildings || [];
        parallax = [];
        for (let i = 0; i < Math.max(1, bImgs.length); i++) {
            const img = bImgs[i];
            const multiplier = 0.18 + i * 0.12;
            const layerHeight = Math.round(displayHeight * (0.18 + i * 0.05));
            const tileWidth = Math.round(displayWidth / (2 + i));
            const tileCount = Math.ceil((displayWidth / tileWidth)) + 2;
            const tiles = [];
            for (let t = 0; t < tileCount; t++) tiles.push({ x: t * tileWidth, y: displayHeight - layerHeight - 40 - i * 6 });
            parallax.push({ img, multiplier, tiles, tileWidth, height: layerHeight });
        }
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

