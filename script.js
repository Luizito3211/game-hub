const state = {
  xp: Number(localStorage.getItem("neon-xp") || 0),
  sound: localStorage.getItem("neon-sound") !== "off",
  currentGame: null,
  cleanup: null,
};

const games = [
  { id: "platformer", title: "Dash Platformer", icon: "2D", accent: "#24f7ff", desc: "Duas fases, pulo fluido, dash aereo e colisao AABB." },
  { id: "snake", title: "Snake", icon: "S", accent: "#b9ff3d", desc: "Canvas, velocidade crescente e recorde local." },
  { id: "memory", title: "Memoria", icon: "M", accent: "#ff2bd6", desc: "Cartas 3D, pares e contador de movimentos." },
  { id: "clicker", title: "Tap Rush", icon: "TAP", accent: "#ffd166", desc: "Clique rapido, compre upgrades e gere pontos." },
  { id: "rps", title: "RPS Impact", icon: "RPS", accent: "#ff4d6d", desc: "Pedra, papel e tesoura com streak neon." },
  { id: "parkour", title: "Neon Parkour 3D", icon: "3D", accent: "#24f7ff", desc: "Rigidbody, saltos, wall run e plataformas neon." },
];

const $ = (selector) => document.querySelector(selector);
const mount = $("#gameMount");
const levelLabel = $("#levelLabel");
const xpLabel = $("#xpLabel");
const xpFill = $("#xpFill");
const toast = $("#toast");
let audioCtx;

function levelFromXp(xp) {
  return Math.floor(xp / 300) + 1;
}

function updateXpUi() {
  const level = levelFromXp(state.xp);
  const inLevel = state.xp % 300;
  levelLabel.textContent = `Nivel ${level}`;
  xpLabel.textContent = `${state.xp} XP`;
  xpFill.style.width = `${(inLevel / 300) * 100}%`;
}

function addXp(amount, label = "XP ganho") {
  state.xp += amount;
  localStorage.setItem("neon-xp", String(state.xp));
  updateXpUi();
  showToast(`+${amount} XP - ${label}`);
  burstParticles();
  beep(760, 0.08, "triangle");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function beep(freq = 420, duration = 0.05, type = "sine") {
  if (!state.sound) return;
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

window.NeonArcade = {
  addXp,
  showToast,
  beep,
};

function renderCards() {
  $("#gameGrid").innerHTML = games.map((game) => `
    <button class="game-card" style="--accent:${game.accent}" data-game="${game.id}" type="button">
      <span class="game-icon">${game.icon}</span>
      <span>
        <h3>${game.title}</h3>
        <p>${game.desc}</p>
      </span>
    </button>
  `).join("");

  document.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("click", () => loadGame(card.dataset.game));
  });
}

function setArena(game) {
  $("#arenaTag").textContent = "Arena ativa";
  $("#gameTitle").textContent = game.title;
}

function loadGame(id) {
  if (state.cleanup) state.cleanup();
  state.currentGame = id;
  const game = games.find((item) => item.id === id);
  setArena(game);
  beep(320, 0.06, "square");
  const runners = { platformer, snake, memory, clicker, rps, parkour: window.parkour };
  if (!runners[id]) {
    mount.innerHTML = `<div class="empty-state"><span>!</span><p>Este jogo nao carregou. Verifique a conexao com as CDNs.</p></div>`;
    return;
  }
  state.cleanup = runners[id]();
}

function stat(label, value) {
  return `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
}

function platformer() {
  mount.innerHTML = `
    <div class="game-panel platformer-panel">
      <div class="stats">
        ${stat("Fase", "<span id='platformLevel'>1/2</span>")}
        ${stat("Dash", "<span id='platformDash'>Pronto</span>")}
        ${stat("Premio", "160 XP")}
      </div>
      <canvas id="platformCanvas" width="900" height="506"></canvas>
      <div class="parkour-help">
        <span>A/D ou Setas: mover</span>
        <span>W ou Espaco: pular</span>
        <span>Ctrl: dash</span>
      </div>
    </div>`;

  const game = new PlataformaGame({
    canvas: $("#platformCanvas"),
    levelLabel: $("#platformLevel"),
    dashLabel: $("#platformDash"),
    onWin: () => addXp(160, "platformer 2D completo"),
  });
  game.start();
  return () => game.destroy();
}

class PlataformaGame {
  constructor({ canvas, levelLabel, dashLabel, onWin }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.levelLabel = levelLabel;
    this.dashLabel = dashLabel;
    this.onWin = onWin;
    this.tile = 40;
    this.gravity = 2000;
    this.moveAccel = 5200;
    this.maxSpeed = 330;
    this.groundFriction = 0.82;
    this.airFriction = 0.94;
    this.jumpVelocity = -840;
    this.dashSpeed = 980;
    this.dashDuration = 0.18;
    this.dashCooldown = 0.65;
    this.keys = new Set();
    this.trail = [];
    this.levelIndex = 0;
    this.running = false;
    this.won = false;
    this.lastTime = 0;
    this.cameraX = 0;
    this.levels = [
      [
        "........................",
        "........................",
        "........................",
        "......................G.",
        ".....................###",
        ".............###........",
        "........................",
        "......###...............",
        "........................",
        ".P..........###.........",
        "######..########...#####",
        "######..########...#####",
      ],
      [
        "..............................",
        "..............................",
        "............................G.",
        "...........................###",
        "..............................",
        ".............###..............",
        "..............................",
        "..............................",
        ".P......###...................",
        "######.........####.......####",
        "######.........####.......####",
        "######.........####.......####",
      ],
    ];
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    this.running = true;
    this.loadLevel(0);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.winTimer);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.map = this.levels[index].map((row) => row.split(""));
    this.blocks = [];
    this.goal = null;
    this.trail = [];
    this.won = false;

    this.map.forEach((row, y) => {
      row.forEach((cell, x) => {
        const rect = { x: x * this.tile, y: y * this.tile, w: this.tile, h: this.tile };
        if (cell === "#") this.blocks.push(rect);
        if (cell === "G") this.goal = rect;
        if (cell === "P") this.spawn = { x: rect.x + 6, y: rect.y - 6 };
      });
    });

    this.player = {
      x: this.spawn.x,
      y: this.spawn.y,
      w: 30,
      h: 34,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      dashTime: 0,
      dashCooldown: 0,
    };
    this.levelWidth = Math.max(...this.map.map((row) => row.length)) * this.tile;
    this.levelLabel.textContent = `${index + 1}/2`;
    this.dashLabel.textContent = "Pronto";
  }

  onKeyDown(event) {
    if (["Space", "ControlLeft", "ControlRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
    if ((event.code === "Space" || event.code === "KeyW" || event.code === "ArrowUp") && this.player.onGround) {
      this.player.vy = this.jumpVelocity;
      this.player.onGround = false;
      beep(620, 0.04, "triangle");
    }
    if ((event.code === "ControlLeft" || event.code === "ControlRight") && this.player.dashCooldown <= 0) {
      this.startDash();
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  startDash() {
    this.player.dashTime = this.dashDuration;
    this.player.dashCooldown = this.dashCooldown;
    this.player.vx = this.player.facing * this.dashSpeed;
    this.player.vy = 0;
    this.dashLabel.textContent = "Dash!";
    beep(840, 0.05, "square");
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    if (this.running) this.frame = requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.won) return;

    const player = this.player;
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");

    if (left) {
      player.vx -= this.moveAccel * dt;
      player.facing = -1;
    }
    if (right) {
      player.vx += this.moveAccel * dt;
      player.facing = 1;
    }

    if (!left && !right && player.dashTime <= 0) {
      player.vx *= player.onGround ? this.groundFriction : this.airFriction;
      if (Math.abs(player.vx) < 8) player.vx = 0;
    }

    player.vx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, player.vx));

    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.facing * this.dashSpeed;
      player.vy = 0;
      this.spawnTrail();
    } else {
      player.vy += this.gravity * dt;
    }

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    this.dashLabel.textContent = player.dashCooldown <= 0 ? "Pronto" : `${player.dashCooldown.toFixed(1)}s`;

    this.moveAndCollide(dt);
    this.updateTrail(dt);
    this.cameraX = Math.max(0, Math.min(this.levelWidth - this.canvas.width, player.x - this.canvas.width * 0.38));

    if (player.y > this.canvas.height + 220) this.respawn();
    if (this.goal && this.intersects(player, this.goal)) this.finishLevel();
  }

  moveAndCollide(dt) {
    const player = this.player;

    // AABB: move em X, resolve penetracao horizontal, depois move em Y e resolve vertical.
    player.x += player.vx * dt;
    this.blocks.forEach((block) => {
      if (!this.intersects(player, block)) return;
      if (player.vx > 0) player.x = block.x - player.w;
      if (player.vx < 0) player.x = block.x + block.w;
      player.vx = 0;
    });

    player.y += player.vy * dt;
    player.onGround = false;
    this.blocks.forEach((block) => {
      if (!this.intersects(player, block)) return;
      if (player.vy > 0) {
        player.y = block.y - player.h;
        player.onGround = true;
      }
      if (player.vy < 0) player.y = block.y + block.h;
      player.vy = 0;
    });
  }

  finishLevel() {
    if (this.levelIndex < this.levels.length - 1) {
      showToast("Fase concluida. Prepare o dash!");
      this.loadLevel(this.levelIndex + 1);
      return;
    }

    this.won = true;
    this.onWin();
    showToast("Dash Platformer completo!");
    this.winTimer = setTimeout(() => this.loadLevel(0), 1200);
  }

  respawn() {
    showToast("Voce caiu. Respawn!");
    this.loadLevel(this.levelIndex);
  }

  spawnTrail() {
    this.trail.push({
      x: this.player.x,
      y: this.player.y,
      w: this.player.w,
      h: this.player.h,
      life: 0.22,
    });
  }

  updateTrail(dt) {
    this.trail = this.trail
      .map((ghost) => ({ ...ghost, life: ghost.life - dt }))
      .filter((ghost) => ghost.life > 0);
  }

  intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    const gradient = ctx.createLinearGradient(this.cameraX, 0, this.cameraX, this.canvas.height);
    gradient.addColorStop(0, "#080916");
    gradient.addColorStop(1, "#111025");
    ctx.fillStyle = gradient;
    ctx.fillRect(this.cameraX, 0, this.canvas.width, this.canvas.height);

    this.drawGoal(ctx);
    this.blocks.forEach((block) => this.drawBlock(ctx, block));
    this.trail.forEach((ghost) => this.drawGhost(ctx, ghost));
    this.drawPlayer(ctx);

    ctx.restore();

    if (this.won) {
      ctx.fillStyle = "rgba(5, 6, 16, 0.72)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#b9ff3d";
      ctx.font = "700 38px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Vitoria!", this.canvas.width / 2, this.canvas.height / 2 - 10);
      ctx.font = "500 18px system-ui";
      ctx.fillStyle = "#f7fbff";
      ctx.fillText("+160 XP no portal", this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
  }

  drawBlock(ctx, block) {
    ctx.fillStyle = "#17203d";
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = "#24f7ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
  }

  drawGoal(ctx) {
    if (!this.goal) return;
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(this.goal.x + 8, this.goal.y + 4, this.goal.w - 16, this.goal.h - 8);
    ctx.strokeStyle = "#fff0a8";
    ctx.strokeRect(this.goal.x + 8, this.goal.y + 4, this.goal.w - 16, this.goal.h - 8);
  }

  drawGhost(ctx, ghost) {
    ctx.globalAlpha = Math.max(0, ghost.life / 0.22) * 0.45;
    ctx.fillStyle = "#24f7ff";
    ctx.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx) {
    const player = this.player;
    ctx.fillStyle = player.dashTime > 0 ? "#ffffff" : "#ff2bd6";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = "#b9ff3d";
    const eyeX = player.facing > 0 ? player.x + player.w - 9 : player.x + 5;
    ctx.fillRect(eyeX, player.y + 8, 5, 5);
  }
}

function ttt() {
  let board = Array(9).fill("");
  let locked = false;
  mount.innerHTML = `
    <div class="game-panel">
      <div class="stats">${stat("Voce", "X")}${stat("IA", "O")}${stat("Premio", "80 XP")}</div>
      <div class="board-ttt">${board.map((_, i) => `<button class="cell" data-i="${i}" type="button"></button>`).join("")}</div>
      <button class="primary-button" id="resetTtt" type="button">Reiniciar</button>
    </div>`;
  const cells = [...document.querySelectorAll(".cell")];
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = () => wins.find((line) => line.every((i) => board[i] && board[i] === board[line[0]]));
  const draw = () => board.every(Boolean) && !winner();
  const paint = () => cells.forEach((cell, i) => cell.textContent = board[i]);
  const reset = () => { board = Array(9).fill(""); locked = false; cells.forEach((cell) => cell.style.boxShadow = ""); paint(); };
  const endCheck = () => {
    const line = winner();
    if (line) {
      locked = true;
      const mark = board[line[0]];
      line.forEach((i) => cells[i].style.boxShadow = "0 0 28px rgba(36,247,255,.35)");
      if (mark === "X") addXp(80, "vitoria no Jogo da Velha");
      else showToast("A IA venceu esta rodada");
      return true;
    }
    if (draw()) { locked = true; addXp(25, "empate estrategico"); return true; }
    return false;
  };
  const aiMove = () => {
    const free = board.map((v, i) => v ? null : i).filter((v) => v !== null);
    const winMove = findMove("O") ?? findMove("X") ?? free[Math.floor(Math.random() * free.length)];
    if (winMove !== undefined) board[winMove] = "O";
    paint();
    endCheck();
  };
  const findMove = (mark) => {
    for (const line of wins) {
      const values = line.map((i) => board[i]);
      if (values.filter((v) => v === mark).length === 2 && values.includes("")) return line[values.indexOf("")];
    }
    return null;
  };
  cells.forEach((cell) => cell.addEventListener("click", () => {
    const i = Number(cell.dataset.i);
    if (locked || board[i]) return;
    board[i] = "X";
    paint();
    beep(500, 0.04, "square");
    if (!endCheck()) setTimeout(aiMove, 320);
  }));
  $("#resetTtt").addEventListener("click", reset);
  return () => {};
}

function snake() {
  const best = Number(localStorage.getItem("snake-best") || 0);
  mount.innerHTML = `
    <div class="game-panel snake-wrap">
      <div class="stats">${stat("Score", "<span id='snakeScore'>0</span>")}${stat("Recorde", `<span id='snakeBest'>${best}</span>`)}${stat("Controle", "Setas/WASD")}</div>
      <canvas id="snakeCanvas" width="420" height="420"></canvas>
      <button class="primary-button" id="snakeRestart" type="button">Iniciar / Reiniciar</button>
    </div>`;
  const canvas = $("#snakeCanvas");
  const ctx = canvas.getContext("2d");
  const size = 21;
  const tile = canvas.width / size;
  let snakeBody, apple, dir, nextDir, score, timer;
  const start = () => {
    snakeBody = [{ x: 10, y: 10 }];
    apple = { x: 5, y: 5 };
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    clearInterval(timer);
    timer = setInterval(tick, 115);
    draw();
  };
  const placeApple = () => {
    do {
      apple = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
    } while (snakeBody.some((p) => p.x === apple.x && p.y === apple.y));
  };
  const tick = () => {
    dir = nextDir;
    const head = { x: snakeBody[0].x + dir.x, y: snakeBody[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= size || head.y >= size || snakeBody.some((p) => p.x === head.x && p.y === head.y)) {
      clearInterval(timer);
      showToast("Snake finalizado");
      return;
    }
    snakeBody.unshift(head);
    if (head.x === apple.x && head.y === apple.y) {
      score += 10;
      $("#snakeScore").textContent = score;
      if (score > Number(localStorage.getItem("snake-best") || 0)) {
        localStorage.setItem("snake-best", String(score));
        $("#snakeBest").textContent = score;
      }
      addXp(12, "maca capturada");
      placeApple();
    } else {
      snakeBody.pop();
    }
    draw();
  };
  const draw = () => {
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,.045)";
    for (let i = 0; i <= size; i++) {
      ctx.beginPath(); ctx.moveTo(i * tile, 0); ctx.lineTo(i * tile, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * tile); ctx.lineTo(canvas.width, i * tile); ctx.stroke();
    }
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(apple.x * tile + 3, apple.y * tile + 3, tile - 6, tile - 6);
    ctx.fillStyle = "#b9ff3d";
    snakeBody.forEach((p) => ctx.fillRect(p.x * tile + 2, p.y * tile + 2, tile - 4, tile - 4));
  };
  const key = (event) => {
    const map = { ArrowUp: [0,-1], w: [0,-1], ArrowDown: [0,1], s: [0,1], ArrowLeft: [-1,0], a: [-1,0], ArrowRight: [1,0], d: [1,0] };
    if (!map[event.key]) return;
    const [x, y] = map[event.key];
    if (x + dir.x || y + dir.y) nextDir = { x, y };
  };
  window.addEventListener("keydown", key);
  $("#snakeRestart").addEventListener("click", start);
  start();
  return () => { clearInterval(timer); window.removeEventListener("keydown", key); };
}

function memory() {
  const icons = ["A","B","C","D","E","F","G","H"];
  let cards = [...icons, ...icons].sort(() => Math.random() - 0.5);
  let first = null, moves = 0, matched = 0, busy = false;
  mount.innerHTML = `
    <div class="game-panel">
      <div class="stats">${stat("Movimentos", "<span id='moves'>0</span>")}${stat("Pares", "<span id='pairs'>0/8</span>")}${stat("Premio", "120 XP")}</div>
      <div class="memory-grid">${cards.map((icon, i) => `
        <button class="memory-card" data-i="${i}" type="button">
          <span class="memory-inner"><span class="memory-face memory-back">?</span><span class="memory-face memory-front">${icon}</span></span>
        </button>`).join("")}</div>
    </div>`;
  document.querySelectorAll(".memory-card").forEach((card) => card.addEventListener("click", () => {
    if (busy || card.classList.contains("flipped") || card.classList.contains("matched")) return;
    card.classList.add("flipped");
    beep(620, 0.04, "triangle");
    if (!first) { first = card; return; }
    moves++;
    $("#moves").textContent = moves;
    const same = cards[first.dataset.i] === cards[card.dataset.i];
    if (same) {
      first.classList.add("matched");
      card.classList.add("matched");
      first = null;
      matched++;
      $("#pairs").textContent = `${matched}/8`;
      addXp(15, "par encontrado");
      if (matched === 8) addXp(120, "memoria completa");
      return;
    }
    busy = true;
    setTimeout(() => {
      first.classList.remove("flipped");
      card.classList.remove("flipped");
      first = null;
      busy = false;
    }, 720);
  }));
  return () => {};
}

function clicker() {
  let points = 0, perClick = 1, upgradeCost = 35, autoCost = 90, auto = 0, interval;
  const paint = () => {
    $("#tapPoints").textContent = points;
    $("#tapPower").textContent = perClick;
    $("#upgradeCost").textContent = upgradeCost;
    $("#autoCost").textContent = autoCost;
    $("#autoPower").textContent = auto;
  };
  mount.innerHTML = `
    <div class="game-panel clicker-core">
      <div class="stats">${stat("Pontos", "<span id='tapPoints'>0</span>")}${stat("Por clique", "<span id='tapPower'>1</span>")}${stat("Auto", "<span id='autoPower'>0</span>/s")}</div>
      <button class="tap-target" id="tapTarget" type="button">TAP</button>
      <div class="shop">
        <button class="primary-button" id="buyPower" type="button">Forca +1 - <span id="upgradeCost">35</span></button>
        <button class="primary-button" id="buyAuto" type="button">Auto +1/s - <span id="autoCost">90</span></button>
      </div>
    </div>`;
  $("#tapTarget").addEventListener("click", () => { points += perClick; if (points % 20 < perClick) addXp(10, "combo tap"); beep(440, 0.035, "square"); paint(); });
  $("#buyPower").addEventListener("click", () => { if (points >= upgradeCost) { points -= upgradeCost; perClick++; upgradeCost = Math.ceil(upgradeCost * 1.55); addXp(20, "upgrade comprado"); paint(); } });
  $("#buyAuto").addEventListener("click", () => { if (points >= autoCost) { points -= autoCost; auto++; autoCost = Math.ceil(autoCost * 1.65); addXp(25, "auto tap instalado"); paint(); } });
  interval = setInterval(() => { if (auto) { points += auto; paint(); } }, 1000);
  paint();
  return () => clearInterval(interval);
}

function rps() {
  let wins = 0, streak = 0;
  const choices = ["Pedra", "Papel", "Tesoura"];
  const beats = { Pedra: "Tesoura", Papel: "Pedra", Tesoura: "Papel" };
  mount.innerHTML = `
    <div class="game-panel">
      <div class="stats">${stat("Vitorias", "<span id='rpsWins'>0</span>")}${stat("Streak", "<span id='rpsStreak'>0</span>")}${stat("Premio", "30 XP/vitoria")}</div>
      <div class="rps-choices">${choices.map((c) => `<button class="choice-button" data-choice="${c}" type="button">${c}</button>`).join("")}</div>
      <div class="impact" id="impact">Escolha sua jogada</div>
    </div>`;
  document.querySelectorAll(".choice-button").forEach((button) => button.addEventListener("click", () => {
    const player = button.dataset.choice;
    const cpu = choices[Math.floor(Math.random() * choices.length)];
    const impact = $("#impact");
    impact.classList.remove("hit");
    void impact.offsetWidth;
    impact.classList.add("hit");
    if (player === cpu) {
      impact.textContent = `${player} x ${cpu}: empate`;
      beep(260, 0.05, "sine");
      return;
    }
    if (beats[player] === cpu) {
      wins++; streak++;
      impact.textContent = `${player} quebra ${cpu}. Vitoria!`;
      $("#rpsWins").textContent = wins;
      $("#rpsStreak").textContent = streak;
      addXp(30 + streak * 5, "streak de impacto");
    } else {
      streak = 0;
      $("#rpsStreak").textContent = streak;
      impact.textContent = `${cpu} vence ${player}. Streak resetado.`;
    }
  }));
  return () => {};
}

function typing() {
  const words = ["neon", "pixel", "arcade", "combo", "turbo", "laser", "level", "bonus", "cyber", "score"];
  let score = 0, time = 45, active = "", timer, wordTimer;
  mount.innerHTML = `
    <div class="game-panel typing-zone">
      <div class="stats">${stat("Score", "<span id='typeScore'>0</span>")}${stat("Tempo", "<span id='typeTime'>45</span>s")}${stat("XP", "18 por palavra")}</div>
      <div class="word-stage" id="wordStage"></div>
      <input id="typeInput" class="typing-input" autocomplete="off" placeholder="Digite a palavra ativa">
      <button class="primary-button" id="typingStart" type="button">Reiniciar rodada</button>
    </div>`;
  const spawn = () => {
    active = words[Math.floor(Math.random() * words.length)];
    $("#wordStage").innerHTML = `<span class="falling-word" style="animation-duration:${Math.max(3.2, time / 8)}s">${active}</span>`;
  };
  const start = () => {
    score = 0; time = 45; $("#typeScore").textContent = score; $("#typeTime").textContent = time; $("#typeInput").value = ""; $("#typeInput").focus();
    clearInterval(timer); clearInterval(wordTimer);
    spawn();
    timer = setInterval(() => {
      time--; $("#typeTime").textContent = time;
      if (time <= 0) { clearInterval(timer); clearInterval(wordTimer); $("#wordStage").innerHTML = ""; showToast("Rodada encerrada"); }
    }, 1000);
    wordTimer = setInterval(spawn, 4200);
  };
  $("#typeInput").addEventListener("input", (event) => {
    if (event.target.value.trim().toLowerCase() === active) {
      score++;
      $("#typeScore").textContent = score;
      event.target.value = "";
      addXp(18, "palavra digitada");
      spawn();
    }
  });
  $("#typingStart").addEventListener("click", start);
  start();
  return () => { clearInterval(timer); clearInterval(wordTimer); };
}

const particleCanvas = $("#particles");
const pctx = particleCanvas.getContext("2d");
let particles = [];

function resizeParticles() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}

function burstParticles() {
  const cx = window.innerWidth - 150;
  const cy = 90;
  for (let i = 0; i < 28; i++) {
    particles.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7,
      life: 48,
      color: Math.random() > 0.5 ? "#24f7ff" : "#ff2bd6",
    });
  }
}

function animateParticles() {
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter((p) => p.life-- > 0);
  particles.forEach((p) => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.04;
    pctx.globalAlpha = Math.max(0, p.life / 48);
    pctx.fillStyle = p.color;
    pctx.fillRect(p.x, p.y, 4, 4);
  });
  pctx.globalAlpha = 1;
  requestAnimationFrame(animateParticles);
}

$("#soundToggle").addEventListener("click", () => {
  state.sound = !state.sound;
  localStorage.setItem("neon-sound", state.sound ? "on" : "off");
  $("#soundToggle").textContent = state.sound ? "S" : "X";
  showToast(state.sound ? "Sons ativados" : "Sons desligados");
  beep(520, 0.05, "triangle");
});

$("#backButton").addEventListener("click", () => {
  if (state.cleanup) state.cleanup();
  state.cleanup = null;
  state.currentGame = null;
  $("#arenaTag").textContent = "Dashboard";
  $("#gameTitle").textContent = "Selecione um jogo";
  mount.innerHTML = `<div class="empty-state"><span>GO</span><p>Entre em qualquer card para ganhar XP global, subir de nivel e liberar feedback neon.</p></div>`;
});

window.addEventListener("resize", resizeParticles);
renderCards();
updateXpUi();
resizeParticles();
animateParticles();
$("#soundToggle").textContent = state.sound ? "S" : "X";
