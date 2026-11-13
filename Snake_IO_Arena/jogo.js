// Web Audio API Sound Synthesizer
class SoundFX {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playEat() {
        if (!this.ctx) return;
        try {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch(e) {}
    }
    playBoost() {
        if (!this.ctx) return;
        try {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.15);
        } catch(e) {}
    }
    playGameOver() {
        if (!this.ctx) return;
        try {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } catch(e) {}
    }
}
const sfx = new SoundFX();

const canvas = document.getElementById('io-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

let gameRunning = false;
let gameMode = 'solo'; // 'solo' ou 'coop'
let camera1 = { x: 0, y: 0 };
let camera2 = { x: 0, y: 0 };
let player1 = null;
let player2 = null;
let snakes = [];
let foods = [];
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Controles
let keysP1 = { up: false, down: false, left: false, right: false, boost: false };
let keysP2 = { up: false, down: false, left: false, right: false, boost: false };
let useKeyboardSolo = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('keydown', e => {
    if (e.code === 'KeyW') { keysP1.up = true; useKeyboardSolo = true; }
    if (e.code === 'KeyS') { keysP1.down = true; useKeyboardSolo = true; }
    if (e.code === 'KeyA') { keysP1.left = true; useKeyboardSolo = true; }
    if (e.code === 'KeyD') { keysP1.right = true; useKeyboardSolo = true; }
    if (e.code === 'Space') keysP1.boost = true;

    if (e.code === 'ArrowUp') keysP2.up = true;
    if (e.code === 'ArrowDown') keysP2.down = true;
    if (e.code === 'ArrowLeft') keysP2.left = true;
    if (e.code === 'ArrowRight') keysP2.right = true;
    if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') keysP2.boost = true;
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyW') keysP1.up = false;
    if (e.code === 'KeyS') keysP1.down = false;
    if (e.code === 'KeyA') keysP1.left = false;
    if (e.code === 'KeyD') keysP1.right = false;
    if (e.code === 'Space') keysP1.boost = false;

    if (e.code === 'ArrowUp') keysP2.up = false;
    if (e.code === 'ArrowDown') keysP2.down = false;
    if (e.code === 'ArrowLeft') keysP2.left = false;
    if (e.code === 'ArrowRight') keysP2.right = false;
    if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') keysP2.boost = false;
});

const boostBtn = document.getElementById('boost-btn');
if (boostBtn) {
    boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keysP1.boost = true; });
    boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); keysP1.boost = false; });
}
['touch-boost1','touch-boost2'].forEach((id, index) => {
    const button = document.getElementById(id);
    if (!button) return;
    const player = index + 1;
    button.addEventListener('pointerdown', e => {
        e.preventDefault();
        (player === 1 ? keysP1 : keysP2).boost = true;
    });
    const stop = e => {
        e.preventDefault();
        (player === 1 ? keysP1 : keysP2).boost = false;
    };
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', () => {
        (player === 1 ? keysP1 : keysP2).boost = false;
    });
});

function startIoGame(mode) {
    sfx.init();
    gameMode = mode;
    document.body.classList.toggle('duo-mode', mode === 'coop');
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) touchControls.classList.remove('hidden');
    document.getElementById('touch-p2')?.classList.toggle('hidden', mode === 'solo');
    keysP1 = {up:false,down:false,left:false,right:false,boost:false};
    keysP2 = {up:false,down:false,left:false,right:false,boost:false};
    useKeyboardSolo = false;
    let nameInput = document.getElementById('player-name-input').value.trim() || 'Windows99';
    const chosenSkin = document.getElementById('player-skin-select')?.value || '#a855f7';
    
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');

    foods = [];
    for (let i = 0; i < 600; i++) {
        foods.push({
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            color: getRandomNeonColor(),
            size: Math.random() * 3 + 2
        });
    }

    if (gameMode === 'solo') {
        player1 = {
            name: nameInput,
            isPlayer: true,
            x: WORLD_WIDTH / 2,
            y: WORLD_HEIGHT / 2,
            angle: 0,
            speed: 3.5,
            normalSpeed: 3.5,
            boostSpeed: 6.5,
            radius: 12,
            score: 0,
            alive: true,
            color: chosenSkin,
            body: []
        };
        for (let i = 0; i < 15; i++) {
            player1.body.push({ x: player1.x, y: player1.y });
        }
        snakes = [player1];
    } else {
        // Co-op (2 Jogadores)
        player1 = {
            name: nameInput,
            isPlayer: true,
            x: WORLD_WIDTH / 2 - 150,
            y: WORLD_HEIGHT / 2,
            angle: 0,
            speed: 3.5,
            normalSpeed: 3.5,
            boostSpeed: 6.5,
            radius: 12,
            score: 0,
            alive: true,
            color: chosenSkin,
            body: []
        };
        for (let i = 0; i < 15; i++) {
            player1.body.push({ x: player1.x, y: player1.y });
        }

        player2 = {
            name: nameInput + ' P2',
            isPlayer: true,
            x: WORLD_WIDTH / 2 + 150,
            y: WORLD_HEIGHT / 2,
            angle: 0,
            speed: 3.5,
            normalSpeed: 3.5,
            boostSpeed: 6.5,
            radius: 12,
            score: 0,
            alive: true,
            color: '#06b6d4',
            body: []
        };
        for (let i = 0; i < 15; i++) {
            player2.body.push({ x: player2.x, y: player2.y });
        }
        snakes = [player1, player2];
    }

    const aiNames = ['ViperBot', 'CobraX', 'Python99', 'Anaconda', 'Mamba_King', 'Neon_Worm', 'Danilo_Bolsa', 'Pedrachaie'];
    const aiColors = ['#ae00ff', '#ef4444', '#eab308', '#ec4899', '#06b6d4', '#f97316'];

    for (let i = 0; i < 10; i++) {
        let ai = {
            name: aiNames[i % aiNames.length] + (i > 5 ? i : ''),
            isPlayer: false,
            x: Math.random() * (WORLD_WIDTH - 400) + 200,
            y: Math.random() * (WORLD_HEIGHT - 400) + 200,
            angle: Math.random() * Math.PI * 2,
            speed: 3.2,
            radius: 12,
            score: Math.floor(Math.random() * 50) + 10,
            alive: true,
            color: aiColors[i % aiColors.length],
            body: [],
            aiTimer: 0
        };
        for (let j = 0; j < 15; j++) {
            ai.body.push({ x: ai.x, y: ai.y });
        }
        snakes.push(ai);
    }

    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

function getRandomNeonColor() {
    const colors = ['#a855f7', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function gameLoop() {
    if (!gameRunning) return;

    update();
    render();

    requestAnimationFrame(gameLoop);
}


function steerPlayer(player, keys, camera, viewportWidth) {
    if (!player || !player.alive) return;
    let dx = 0, dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
        const target = Math.atan2(dy, dx);
        let diff = target - player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        player.angle += diff * 0.15;
    } else if (gameMode === 'solo' && player === player1 && !useKeyboardSolo) {
        const target = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
        let diff = target - player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        player.angle += diff * 0.15;
    }
    const boosting = keys.boost && player.body.length > 12;
    const speed = boosting ? player.boostSpeed : player.normalSpeed;
    if (boosting && Math.random() < 0.2) { player.body.pop(); sfx.playBoost(); }
    player.x += Math.cos(player.angle) * speed;
    player.y += Math.sin(player.angle) * speed;
    if (player.x <= 20 || player.x >= WORLD_WIDTH - 20 || player.y <= 20 || player.y >= WORLD_HEIGHT - 20) {
        killSnake(player);
        return;
    }
    player.body.unshift({x: player.x, y: player.y});
    const targetLen = 12 + Math.floor(player.score / 15);
    while (player.body.length > targetLen) player.body.pop();
    const center = gameMode === 'solo' ? canvas.width / 2 : viewportWidth / 2;
    camera.x += (player.x - camera.x - center) * 0.1;
    camera.y += (player.y - camera.y - canvas.height / 2) * 0.1;
}

function update() {
    if (gameMode === 'solo') {
        if (player1.alive) steerPlayer(player1, keysP1, camera1, canvas.width);
        document.getElementById('hud-score').innerText = `SCORE: ${player1.score} | ${player1.alive ? 'VIVO' : 'ELIMINADO'}`;
    } else {
        const halfWidth = canvas.width / 2;
        if (player1.alive) steerPlayer(player1, keysP1, camera1, halfWidth);
        if (player2.alive) steerPlayer(player2, keysP2, camera2, halfWidth);
        document.getElementById('hud-score').innerText =
            `P1: ${player1.score} (${player1.alive ? 'VIVO' : 'MORTO'}) | P2: ${player2.score} (${player2.alive ? 'VIVO' : 'MORTO'})`;
    }

    // Bots controlados pela IA
    snakes.forEach(snake => {
        if (snake.isPlayer || !snake.alive) return;
        snake.aiTimer++;
        if (snake.aiTimer > 80 + Math.random() * 60) {
            snake.aiTimer = 0;
            let nearestFood = null, minDist = Infinity;
            foods.forEach(f => {
                const d = Math.hypot(f.x - snake.x, f.y - snake.y);
                if (d < minDist) { minDist = d; nearestFood = f; }
            });
            if (nearestFood && minDist < 400) snake.targetAngle = Math.atan2(nearestFood.y - snake.y, nearestFood.x - snake.x);
            else snake.targetAngle = (snake.targetAngle ?? snake.angle) + (Math.random() - 0.5) * 1.5;
        }
        if (snake.targetAngle !== undefined) {
            let d = snake.targetAngle - snake.angle;
            while (d < -Math.PI) d += Math.PI * 2;
            while (d > Math.PI) d -= Math.PI * 2;
            snake.angle += d * 0.08;
        }
        snake.x += Math.cos(snake.angle) * snake.speed;
        snake.y += Math.sin(snake.angle) * snake.speed;
        if (snake.x < 30 || snake.x > WORLD_WIDTH - 30 || snake.y < 30 || snake.y > WORLD_HEIGHT - 30) {
            snake.angle += Math.PI;
            snake.x = Math.max(40, Math.min(WORLD_WIDTH - 40, snake.x));
            snake.y = Math.max(40, Math.min(WORLD_HEIGHT - 40, snake.y));
        }
        snake.body.unshift({x: snake.x, y: snake.y});
        const len = 12 + Math.floor(snake.score / 15);
        while (snake.body.length > len) snake.body.pop();
    });

    // Coleta de comida
    snakes.forEach(snake => {
        if (!snake.alive) return;
        foods.forEach((food, index) => {
            if (Math.hypot(snake.x - food.x, snake.y - food.y) < snake.radius + food.size) {
                snake.score += 5;
                if (snake.isPlayer) sfx.playEat();
                foods[index] = {x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT,
                    color: getRandomNeonColor(), size: Math.random()*3+2};
            }
        });
    });

    // Colisões entre cobras
    snakes.forEach(snake => {
        if (!snake.alive) return;
        snakes.forEach(other => {
            if (snake === other || !other.alive) return;
            other.body.forEach(seg => {
                if (Math.hypot(snake.x - seg.x, snake.y - seg.y) < snake.radius + 6) {
                    killSnake(snake);
                }
            });
        });
    });

    updateLeaderboard();

    if (gameMode === 'solo' && !player1.alive) finishIoGame();
    if (gameMode === 'coop' && !player1.alive && !player2.alive) finishIoGame();
}

function killSnake(snake) {
    if (!snake || !snake.alive) return;
    snake.body.forEach(seg => foods.push({
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        color: snake.color, size: 5
    }));
    if (snake.isPlayer) {
        snake.alive = false;
        snake.body = [];
        if (snake === player1) keysP1 = {up:false,down:false,left:false,right:false,boost:false};
        if (snake === player2) keysP2 = {up:false,down:false,left:false,right:false,boost:false};
        sfx.playGameOver();
        return;
    }
    snake.x = Math.random() * (WORLD_WIDTH - 400) + 200;
    snake.y = Math.random() * (WORLD_HEIGHT - 400) + 200;
    snake.score = 10;
    snake.body = Array.from({length:15}, () => ({x:snake.x,y:snake.y}));
}

function finishIoGame() {
    if (!gameRunning) return;
    gameRunning = false;
    const scoreText = gameMode === 'solo'
        ? `${player1.score}`
        : `P1: ${player1.score} | P2: ${player2.score}`;
    document.getElementById('final-score').innerText = scoreText;
    if (gameMode === 'solo') {
        document.getElementById('final-length').innerText = 'Sua cobrinha foi eliminada.';
    } else {
        const winner = player1.score === player2.score ? 'EMPATE!' :
            (player1.score > player2.score ? 'JOGADOR 1 VENCEU!' : 'JOGADOR 2 VENCEU!');
        document.getElementById('final-length').innerText =
            `P1 ${player1.alive ? 'sobreviveu' : 'morreu'} | P2 ${player2.alive ? 'sobreviveu' : 'morreu'} — ${winner}`;
    }
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('touch-controls')?.classList.add('hidden');
}

function updateLeaderboard() {
    let sorted = [...snakes].sort((a, b) => b.score - a.score).slice(0, 5);
    let listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '';
    sorted.forEach((s, idx) => {
        let row = document.createElement('div');
        row.className = `flex justify-between ${s.isPlayer ? 'text-yellow-400 font-bold' : 'text-gray-300'}`;
        row.innerHTML = `<span>${idx + 1}. ${s.name}</span><span>${s.score}</span>`;
        listEl.appendChild(row);
    });
}

function render() {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameMode === 'solo') {
        renderViewport(0, 0, canvas.width, canvas.height, camera1);
    } else {
        // Modo Co-op Split-Screen (Tela Dividida Verticalmente em Duas Metades)
        let halfW = canvas.width / 2;

        // Metade Esquerda (Jogador 1)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, halfW, canvas.height);
        ctx.clip();
        renderViewport(0, 0, halfW, canvas.height, camera1);
        ctx.restore();

        // Metade Direita (Jogador 2)
        ctx.save();
        ctx.beginPath();
        ctx.rect(halfW, 0, halfW, canvas.height);
        ctx.clip();
        renderViewport(halfW, 0, halfW, canvas.height, camera2);
        ctx.restore();

        // Linha Divisória Neon entre as Telas
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(halfW, 0);
        ctx.lineTo(halfW, canvas.height);
        ctx.stroke();
    }

    renderMinimap();
}

function renderViewport(x, y, w, h, cam) {
    ctx.save();
    ctx.translate(x, y);

    // Fundo da viewport com translação da câmera correspondente
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    let gridSize = 100;
    let startX = Math.floor(cam.x / gridSize) * gridSize;
    let startY = Math.floor(cam.y / gridSize) * gridSize;
    for (let gx = startX; gx < cam.x + w + gridSize; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, cam.y);
        ctx.lineTo(gx, cam.y + h);
        ctx.stroke();
    }
    for (let gy = startY; gy < cam.y + h + gridSize; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(cam.x, gy);
        ctx.lineTo(cam.x + w, gy);
        ctx.stroke();
    }

    // Paredes do Copo
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Comida
    foods.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Minhocas
    snakes.forEach(snake => {
        if (!snake.alive) return;
        for (let i = snake.body.length - 1; i >= 0; i--) {
            let seg = snake.body[i];
            ctx.fillStyle = snake.color;
            ctx.shadowColor = snake.color;
            ctx.shadowBlur = i === 0 ? 12 : 4;
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, snake.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        let head = snake.body[0];
        if (head) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            let eyeOffsetX1 = Math.cos(snake.angle + 0.6) * 6;
            let eyeOffsetY1 = Math.sin(snake.angle + 0.6) * 6;
            let eyeOffsetX2 = Math.cos(snake.angle - 0.6) * 6;
            let eyeOffsetY2 = Math.sin(snake.angle - 0.6) * 6;
            
            ctx.beginPath();
            ctx.arc(head.x + eyeOffsetX1, head.y + eyeOffsetY1, 3.5, 0, Math.PI * 2);
            ctx.arc(head.x + eyeOffsetX2, head.y + eyeOffsetY2, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = snake.isPlayer ? '#fde047' : '#ffffff';
            ctx.font = '16px VT323';
            ctx.textAlign = 'center';
            ctx.fillText(snake.name, head.x, head.y - 20);
        }
    });

    ctx.restore();
    ctx.restore();
}

function renderMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    let scaleX = minimapCanvas.width / WORLD_WIDTH;
    let scaleY = minimapCanvas.height / WORLD_HEIGHT;

    snakes.forEach(s => {
        if (!s.alive) return;
        let mx = s.x * scaleX;
        let my = s.y * scaleY;
        minimapCtx.fillStyle = s.isPlayer ? '#fde047' : s.color;
        minimapCtx.beginPath();
        minimapCtx.arc(mx, my, s.isPlayer ? 3.5 : 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

function backToMenu() {
    document.getElementById('touch-controls')?.classList.add('hidden');
    document.body.classList.remove('duo-mode');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}