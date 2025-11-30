// Simple endless runner (Google Dino style) using assets in /assets
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Images from assets folder
const backgroundImg = new Image(); backgroundImg.src = 'assets/background.png';
const characterImg = new Image(); characterImg.src = 'assets/character.gif';
const obstacleSrcs = ['assets/obstacle1.png', 'assets/obstacle2.png', 'assets/obstacle3.png', 'assets/obstacle4.png'];
const obstacleImgs = obstacleSrcs.map(s => { const im = new Image(); im.src = s; return im; });
const coinImg = new Image(); coinImg.src = 'assets/coin.gif';

// Game state (responsive + parallax)
let canvasDPR = window.devicePixelRatio || 1;
let displayWidth = 1000; // will be set by resizeCanvas
let displayHeight = 350;
let groundY = 0; // updated in resizeCanvas
let character = { x: 60, y: 0, width: 56, height: 56, vy: 0, jumping: false };
let obstacles = [];
let coins = [];
let speed = 6;
let gravity = 1.2;
let frame = 0;
let score = 0;
let gameOver = false;

// Parallax layers (buildings)
const buildingSrcs = ['assets/building1.png', 'assets/building2.png', 'assets/building3.png'];
const buildingImgs = buildingSrcs.map(s => { const im = new Image(); im.src = s; return im; });
let parallaxLayers = []; // filled in resizeCanvas

function initParallax() {
    parallaxLayers = [];
    // three layers with different speed multipliers
    for (let i = 0; i < buildingImgs.length; i++) {
        const img = buildingImgs[i];
        const multiplier = 0.25 + i * 0.25; // 0.25, 0.5, 0.75
        // create tiles to cover width
        const layer = { img, multiplier, tiles: [] };
        const tileCount = Math.ceil(displayWidth / 200) + 2;
        for (let t = 0; t < tileCount; t++) {
            layer.tiles.push({ x: t * (displayWidth / (tileCount - 1)), y: 0 });
        }
        parallaxLayers.push(layer);
    }
}

function resetGame() {
    obstacles = [];
    coins = [];
    speed = 6;
    frame = 0;
    score = 0;
    gameOver = false;
    character.y = groundY;
    character.vy = 0;
    character.jumping = false;
    document.getElementById('gameOver').style.display = 'none';
    updateUI();
}

function updateUI() {
    document.getElementById('bankBalance').textContent = `Score: ${score}`;
}

function spawnObstacle() {
    const idx = Math.floor(Math.random() * obstacleImgs.length);
    const h = 36 + Math.random() * 40;
    const w = h * 0.9;
    obstacles.push({ x: displayWidth + 20, y: groundY + (character.height - h), width: w, height: h, imgIdx: idx });
}

function spawnCoin() {
    const size = 28;
    coins.push({ x: displayWidth + 20, y: groundY - 80 - Math.random() * 60, width: size, height: size });
}

function isColliding(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function endGame() {
    gameOver = true;
    document.getElementById('gameOver').style.display = 'block';
}

function update() {
    if (gameOver) return;
    frame++;
    // gradually increase speed
    if (frame % 600 === 0) speed += 0.5;
    // spawn obstacles and coins
    if (frame % 90 === 0) spawnObstacle();
    if (frame % 160 === 0) spawnCoin();

    // move obstacles and coins
    obstacles.forEach(o => o.x -= speed);
    obstacles = obstacles.filter(o => o.x + o.width > -50);
    coins.forEach(c => c.x -= speed);
    coins = coins.filter(c => c.x + c.width > -50);

    // update parallax layers
    parallaxLayers.forEach(layer => {
        layer.tiles.forEach(tile => {
            tile.x -= speed * layer.multiplier;
        });
        // recycle tiles
        const first = layer.tiles[0];
        if (first && first.x + displayWidth / layer.tiles.length < -100) {
            // move first tile to end
            const t = layer.tiles.shift();
            t.x = layer.tiles[layer.tiles.length - 1].x + displayWidth / layer.tiles.length;
            layer.tiles.push(t);
        }
    });

    // physics
    if (character.jumping) {
        character.y += character.vy;
        character.vy += gravity;
        if (character.y >= groundY) {
            character.y = groundY;
            character.jumping = false;
            character.vy = 0;
        }
    }

    // collisions
    for (let o of obstacles) {
        if (isColliding(character, o)) {
            endGame();
            return;
        }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
        if (isColliding(character, coins[i])) {
            score += 10;
            coins.splice(i, 1);
            updateUI();
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // background
    if (backgroundImg.complete) ctx.drawImage(backgroundImg, 0, 0, displayWidth, displayHeight);

    // draw parallax building layers behind ground
    parallaxLayers.forEach((layer, li) => {
        const img = layer.img;
        const layerHeight = Math.round(displayHeight * (0.22 + li * 0.06));
        layer.tiles.forEach(tile => {
            const drawX = Math.round(tile.x);
            const drawY = Math.round(displayHeight - layerHeight - 40 - li * 8);
            if (img.complete) {
                // scale width to maintain aspect
                const w = (img.width / (img.height || 1)) * layerHeight;
                ctx.drawImage(img, drawX, drawY, w, layerHeight);
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
    if (characterImg.complete) ctx.drawImage(characterImg, character.x, character.y - (character.height - 56), character.width, character.height);

    // obstacles
    obstacles.forEach(o => {
        const img = obstacleImgs[o.imgIdx];
        if (img.complete) ctx.drawImage(img, o.x, o.y, o.width, o.height);
        else {
            ctx.fillStyle = '#b71c1c';
            ctx.fillRect(o.x, o.y, o.width, o.height);
        }
    });

    // coins
    coins.forEach(c => {
        if (coinImg.complete) ctx.drawImage(coinImg, c.x, c.y, c.width, c.height);
        else {
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(c.x, c.y, c.width, c.height);
        }
    });

    // UI
    ctx.fillStyle = '#1565c0';
    ctx.font = '18px Roboto, Arial';
    ctx.fillText(`Score: ${score}`, 16, 28);
}

// Resize canvas & recalc layout to avoid compact background
function resizeCanvas() {
    canvasDPR = window.devicePixelRatio || 1;
    displayWidth = Math.min(window.innerWidth * 0.95, 1000);
    displayHeight = Math.min(350, Math.max(240, displayWidth * 0.35));

    // set CSS size
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    // set actual pixel size for crispness
    canvas.width = Math.round(displayWidth * canvasDPR);
    canvas.height = Math.round(displayHeight * canvasDPR);
    // reset transform and scale context so drawing uses CSS pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(canvasDPR, canvasDPR);

    // recalc ground and character size/position
    groundY = displayHeight - 90;
    character.width = Math.round(displayHeight * 0.16);
    character.height = character.width;
    character.x = Math.round(displayWidth * 0.06);
    character.y = groundY;

    initParallax();
}

window.addEventListener('resize', resizeCanvas);
// initial resize
resizeCanvas();

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function jump() {
    if (gameOver) return;
    if (!character.jumping) {
        character.jumping = true;
        character.vy = -16;
    }
}

// Controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
    }
    if (e.code === 'KeyR' && gameOver) {
        resetGame();
    }
});
canvas.addEventListener('click', () => jump());
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
document.getElementById('mobileJumpBtn').addEventListener('click', () => jump());
document.getElementById('mobileJumpBtn').addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });

// Start
resetGame();
gameLoop();

