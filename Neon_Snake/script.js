const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const tileCount = canvas.width / gridSize;

let players = [];
let food = { x: 5, y: 5 };
let bonusFood = null;
let bonusTimer = 0;
let gameInterval = null;
let isPaused = false;
let currentMode = 'solo';
let particles = [];

const sfx = {
  ctx: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, end, duration, type = 'triangle') {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(end, this.ctx.currentTime + duration);
      g.gain.setValueAtTime(0.13, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },
  eat() { this.tone(400, 800, 0.12); },
  bonus() { this.tone(600, 1200, 0.25, 'sine'); },
  over() { this.tone(250, 80, 0.4, 'sawtooth'); }
};

function makePlayer(id, x, y, dx, color) {
  return {
    id, snake: [{x, y}, {x: x - dx, y}],
    dx, dy: 0, nextDx: dx, nextDy: 0,
    score: 0, alive: true, color
  };
}

function startGame(mode = currentMode) {
  sfx.init();
  currentMode = mode;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('player2-hud').classList.toggle('hidden', mode === 'solo');
  document.getElementById('mobile-player2').classList.toggle('hidden', mode === 'solo');
  document.getElementById('final-player2-row').classList.toggle('hidden', mode === 'solo');

  isPaused = false;
  players = [makePlayer(1, 6, 10, 1, '#4ade80')];
  if (mode === 'duo') players.push(makePlayer(2, 14, 10, -1, '#f87171'));

  food = {x: 9, y: 5};
  bonusFood = null;
  bonusTimer = 0;
  particles = [];
  updateHUD();
  spawnFood();
  draw();
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 110);
}

function backToMenu() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = null;
  isPaused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('pause-btn').textContent = 'Ⅱ';
}

function setDirection(playerIndex, dir) {
  const p = players[playerIndex];
  if (!p || !p.alive) return;
  const vectors = {UP:[0,-1], DOWN:[0,1], LEFT:[-1,0], RIGHT:[1,0]};
  const [nx, ny] = vectors[dir];
  if (nx === -p.dx && ny === -p.dy) return;
  p.nextDx = nx;
  p.nextDy = ny;
}

function gameLoop() {
  if (isPaused) return;

  players.forEach(p => {
    if (!p.alive) return;
    p.dx = p.nextDx;
    p.dy = p.nextDy;
    const head = {x:p.snake[0].x + p.dx, y:p.snake[0].y + p.dy};
    const hitWall = head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount;
    const eating = head.x === food.x && head.y === food.y;
    const eatingBonus = bonusFood && head.x === bonusFood.x && head.y === bonusFood.y;
    const bodyToCheck = eating || eatingBonus ? p.snake : p.snake.slice(0, -1);
    const hitSelf = bodyToCheck.some(part => part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) { p.alive = false; return; }
    p.snake.unshift(head);

    if (eating) {
      p.score += 10;
      sfx.eat();
      createParticles(food.x * gridSize + 10, food.y * gridSize + 10, p.color);
      spawnFood();
      if (!bonusFood && Math.random() < 0.25) spawnBonusFood();
    } else if (eatingBonus) {
      p.score += 50;
      sfx.bonus();
      createParticles(bonusFood.x * gridSize + 10, bonusFood.y * gridSize + 10, '#facc15');
      bonusFood = null;
      bonusTimer = 0;
    } else {
      p.snake.pop();
    }
  });

  if (currentMode === 'duo' && players.length === 2) {
    const [a, b] = players;
    if (a.alive && b.alive) {
      const ah = a.snake[0], bh = b.snake[0];
      if (ah.x === bh.x && ah.y === bh.y) {
        a.alive = false; b.alive = false;
      } else {
        if (b.snake.some((part, i) => i > 0 && part.x === ah.x && part.y === ah.y)) a.alive = false;
        if (a.snake.some((part, i) => i > 0 && part.x === bh.x && part.y === bh.y)) b.alive = false;
      }
    }
  }

  if (bonusFood && --bonusTimer <= 0) bonusFood = null;
  updateHUD();
  draw();
  if (players.every(p => !p.alive)) finishGame();
}

function randomEmptySpot() {
  for (let tries = 0; tries < 500; tries++) {
    const spot = {x:Math.floor(Math.random()*tileCount), y:Math.floor(Math.random()*tileCount)};
    const occupiedBySnake = players.some(p => p.snake.some(part => part.x === spot.x && part.y === spot.y));
    const occupiedByBonus = bonusFood && bonusFood.x === spot.x && bonusFood.y === spot.y;
    if (!occupiedBySnake && !occupiedByBonus && (!food || food.x !== spot.x || food.y !== spot.y)) return spot;
  }
  return null;
}

function spawnFood() {
  const oldFood = food;
  food = null;
  let spot;
  for (let tries = 0; tries < 500; tries++) {
    const candidate = {x:Math.floor(Math.random()*tileCount), y:Math.floor(Math.random()*tileCount)};
    const occupied = players.some(p => p.snake.some(part => part.x === candidate.x && part.y === candidate.y));
    const onBonus = bonusFood && bonusFood.x === candidate.x && bonusFood.y === candidate.y;
    if (!occupied && !onBonus) { spot = candidate; break; }
  }
  food = spot || oldFood;
}

function spawnBonusFood() {
  for (let tries = 0; tries < 500; tries++) {
    const spot = {x:Math.floor(Math.random()*tileCount), y:Math.floor(Math.random()*tileCount)};
    const occupied = players.some(p => p.snake.some(part => part.x === spot.x && part.y === spot.y));
    if (!occupied && (!food || spot.x !== food.x || spot.y !== food.y)) {
      bonusFood = spot; bonusTimer = 55; return;
    }
  }
}

function draw() {
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(31,41,55,.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= tileCount; i++) {
    ctx.beginPath(); ctx.moveTo(i*gridSize,0); ctx.lineTo(i*gridSize,canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*gridSize); ctx.lineTo(canvas.width,i*gridSize); ctx.stroke();
  }
  if (food) drawOrb(food, '#22c55e', 7);
  if (bonusFood) drawOrb(bonusFood, '#facc15', 9);

  players.forEach(p => p.snake.forEach((part, i) => {
    ctx.fillStyle = i === 0 ? p.color : (p.id === 1 ? '#16a34a' : '#dc2626');
    ctx.shadowColor = p.color; ctx.shadowBlur = i === 0 ? 13 : 6;
    ctx.beginPath();
    ctx.roundRect(part.x*gridSize+2, part.y*gridSize+2, gridSize-4, gridSize-4, 6);
    ctx.fill();
  }));
  ctx.shadowBlur = 0;

  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.alpha -= 0.035;
    ctx.globalAlpha = Math.max(0,p.alpha); ctx.fillStyle = p.color;
    ctx.fillRect(p.x,p.y,4,4);
  });
  ctx.globalAlpha = 1;
}

function drawOrb(pos, color, radius) {
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(pos.x*gridSize+10,pos.y*gridSize+10,radius,0,Math.PI*2);
  ctx.fill(); ctx.shadowBlur = 0;
}

function createParticles(x,y,color) {
  for (let i=0;i<10;i++) {
    const a=Math.random()*Math.PI*2, s=Math.random()*3+1;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,alpha:1,color});
  }
}

function updateHUD() {
  players.forEach((p,i) => {
    document.getElementById('score'+(i+1)).textContent = p.score;
    document.getElementById('status'+(i+1)).textContent = p.alive ? 'VIVO' : 'ELIMINADO';
  });
  if (currentMode === 'solo') {
    document.getElementById('score1').textContent = players[0]?.score || 0;
    document.getElementById('status1').textContent = players[0]?.alive ? 'VIVO' : 'ELIMINADO';
  }
}

function finishGame() {
  clearInterval(gameInterval);
  sfx.over();
  const a = players[0];
  document.getElementById('result-title').textContent = 'FIM DE JOGO';
  document.getElementById('final-score1').textContent = a.score;
  if (currentMode === 'solo') {
    document.getElementById('result-message').textContent = 'SUA PONTUAÇÃO FINAL!';
  } else {
    const b = players[1];
    document.getElementById('final-score2').textContent = b.score;
    document.getElementById('result-message').textContent =
      a.score === b.score ? 'DEU EMPATE!' : `JOGADOR ${a.score > b.score ? 1 : 2} VENCEU!`;
  }
  document.getElementById('gameover-screen').classList.remove('hidden');
}

function togglePause() {
  if (!gameInterval) return;
  isPaused = !isPaused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !isPaused);
  document.getElementById('pause-btn').textContent = isPaused ? '▶' : 'Ⅱ';
}

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (currentMode === 'solo') {
    const soloMap = {
      w:'UP', arrowup:'UP', s:'DOWN', arrowdown:'DOWN',
      a:'LEFT', arrowleft:'LEFT', d:'RIGHT', arrowright:'RIGHT'
    };
    if (soloMap[key]) { e.preventDefault(); setDirection(0, soloMap[key]); }
  } else {
    const duoMap = {
      w:[0,'UP'], s:[0,'DOWN'], a:[0,'LEFT'], d:[0,'RIGHT'],
      arrowup:[1,'UP'], arrowdown:[1,'DOWN'], arrowleft:[1,'LEFT'], arrowright:[1,'RIGHT']
    };
    if (duoMap[key]) { e.preventDefault(); setDirection(...duoMap[key]); }
  }
  if (key === ' ' || key === 'p') { e.preventDefault(); togglePause(); }
});

draw();
