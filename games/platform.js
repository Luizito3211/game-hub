(() => {
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
const arcade = () => window.NeonArcade || {};

window.NeonGames ??= {};

class PlataformaGame {
  init(container, onCoinsEarned) {
    this.container = container;
    this.onCoinsEarned = onCoinsEarned;
    this.container.innerHTML = `
      <div class="game-panel platformer-panel">
        <div class="stats">
          ${stat("Fase", "<span id='platformLevel'>1/2</span>")}
          ${stat("Dash", "<span id='platformDash'>Pronto</span>")}
          ${stat("Premio", "160 moedas")}
        </div>
        <canvas id="platformCanvas" width="900" height="506"></canvas>
        <div class="parkour-help">
          <span>A/D ou Setas: mover</span>
          <span>W ou Espaco: pular</span>
          <span>Ctrl: dash</span>
        </div>
      </div>`;

    this.canvas = this.container.querySelector("#platformCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.levelLabel = this.container.querySelector("#platformLevel");
    this.dashLabel = this.container.querySelector("#platformDash");
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
    this.container.innerHTML = "";
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
      arcade().beep?.(620, 0.04, "triangle");
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
    arcade().beep?.(840, 0.05, "square");
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
      arcade().showToast?.("Fase concluida. Prepare o dash!");
      this.loadLevel(this.levelIndex + 1);
      return;
    }
    this.won = true;
    this.onCoinsEarned(160, "platformer 2D completo");
    arcade().showToast?.("Dash Platformer completo!");
    this.winTimer = setTimeout(() => this.loadLevel(0), 1200);
  }

  respawn() {
    arcade().showToast?.("Voce caiu. Respawn!");
    this.loadLevel(this.levelIndex);
  }

  spawnTrail() {
    this.trail.push({ x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h, life: 0.22 });
  }

  updateTrail(dt) {
    this.trail = this.trail.map((ghost) => ({ ...ghost, life: ghost.life - dt })).filter((ghost) => ghost.life > 0);
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
    gradient.addColorStop(0, "#f8fafc");
    gradient.addColorStop(1, "#e5edf5");
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
      ctx.fillStyle = "#e68a00";
      ctx.font = "700 38px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Vitoria!", this.canvas.width / 2, this.canvas.height / 2 - 10);
      ctx.font = "500 18px system-ui";
      ctx.fillStyle = "#f7fbff";
      ctx.fillText("+160 moedas", this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
  }

  drawBlock(ctx, block) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = "#003366";
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
  }

  drawGoal(ctx) {
    if (!this.goal) return;
    ctx.fillStyle = "#e68a00";
    ctx.fillRect(this.goal.x + 8, this.goal.y + 4, this.goal.w - 16, this.goal.h - 8);
    ctx.strokeStyle = "#b56d00";
    ctx.strokeRect(this.goal.x + 8, this.goal.y + 4, this.goal.w - 16, this.goal.h - 8);
  }

  drawGhost(ctx, ghost) {
    ctx.globalAlpha = Math.max(0, ghost.life / 0.22) * 0.45;
    ctx.fillStyle = "#e68a00";
    ctx.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx) {
    const player = this.player;
    ctx.fillStyle = player.dashTime > 0 ? "#e68a00" : "#003366";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = "#ffffff";
    const eyeX = player.facing > 0 ? player.x + player.w - 9 : player.x + 5;
    ctx.fillRect(eyeX, player.y + 8, 5, 5);
  }
}

window.NeonGames.platform = PlataformaGame;
})();
