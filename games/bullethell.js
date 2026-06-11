(() => {
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
const arcade = () => window.NeonArcade || {};

window.NeonGames ??= {};

class BulletHellGame {
  init(container, onXpGain) {
    this.container = container;
    this.onXpGain = onXpGain;
    this.container.innerHTML = `
      <div class="game-panel bullet-panel">
        <div class="stats">
          ${stat("HP", "<span id='bulletHp'>3</span>/3")}
          ${stat("Score", "<span id='bulletScore'>0</span>")}
          ${stat("Dificuldade", "<span id='bulletDifficulty'>1</span>")}
        </div>
        <div class="bullet-stage">
          <canvas id="bulletCanvas" width="760" height="520"></canvas>
          <button id="bulletRetry" class="primary-button bullet-retry" type="button" hidden>Tentar Novamente</button>
        </div>
        <div class="parkour-help">
          <span>Setas: mover em 8 direcoes</span>
          <span>3 HP: cada colisao tira 1</span>
          <span>Sobreviva para converter score em XP</span>
        </div>
      </div>`;
    this.canvas = this.container.querySelector("#bulletCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.retryButton = this.container.querySelector("#bulletRetry");
    this.hpLabel = this.container.querySelector("#bulletHp");
    this.scoreLabel = this.container.querySelector("#bulletScore");
    this.difficultyLabel = this.container.querySelector("#bulletDifficulty");
    this.keys = new Set();
    this.arena = { x: 80, y: 62, w: 600, h: 380 };
    this.player = { x: 380, y: 252, r: 9, speed: 245, invuln: 0 };
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.loop = this.loop.bind(this);
    this.retry = this.retry.bind(this);
  }

  start() {
    this.running = true;
    this.reset();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.retryButton.addEventListener("click", this.retry);
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.retryButton.removeEventListener("click", this.retry);
    this.container.innerHTML = "";
  }

  reset() {
    this.player.x = this.arena.x + this.arena.w / 2;
    this.player.y = this.arena.y + this.arena.h / 2;
    this.player.invuln = 1.1;
    this.bullets = [];
    this.hp = 3;
    this.score = 0;
    this.elapsed = 0;
    this.spawnClock = 0;
    this.patternClock = 0;
    this.dead = false;
    this.retryButton.hidden = true;
    this.updateHud();
  }

  retry() {
    this.reset();
    this.lastTime = performance.now();
  }

  onKeyDown(event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    if (this.running) this.frame = requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.dead) return;
    this.elapsed += dt;
    this.score += dt * 10;
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.updatePlayer(dt);
    this.spawnClock += dt;
    this.patternClock += dt;
    this.spawnByDifficulty();
    this.updateBullets(dt);
    this.checkCollisions();
    this.updateHud();
  }

  get difficulty() {
    return Math.floor(this.elapsed / 10) + 1;
  }

  updatePlayer(dt) {
    const xInput = Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));
    const yInput = Number(this.keys.has("ArrowDown")) - Number(this.keys.has("ArrowUp"));
    const len = Math.hypot(xInput, yInput) || 1;
    this.player.x += (xInput / len) * this.player.speed * dt;
    this.player.y += (yInput / len) * this.player.speed * dt;
    this.player.x = Math.max(this.arena.x + this.player.r, Math.min(this.arena.x + this.arena.w - this.player.r, this.player.x));
    this.player.y = Math.max(this.arena.y + this.player.r, Math.min(this.arena.y + this.arena.h - this.player.r, this.player.y));
  }

  spawnByDifficulty() {
    const interval = Math.max(0.18, 0.72 - this.difficulty * 0.055);
    if (this.spawnClock >= interval) {
      this.spawnClock = 0;
      const roll = Math.random();
      if (roll < 0.48) this.spawnAimedBullet();
      else if (roll < 0.78) this.spawnRainBurst();
      else this.spawnSideSweep();
    }
    if (this.patternClock >= Math.max(1.4, 3.8 - this.difficulty * 0.18)) {
      this.patternClock = 0;
      this.spawnCirclePattern();
    }
  }

  baseSpeed() {
    return 145 + this.difficulty * 24;
  }

  addBullet(x, y, vx, vy, radius = 7, color = "#fff3a3") {
    this.bullets.push({ x, y, vx, vy, r: radius, color });
  }

  spawnAimedBullet() {
    const pos = this.randomEdgePosition(Math.floor(Math.random() * 4));
    const dx = this.player.x - pos.x;
    const dy = this.player.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = this.baseSpeed() + 45;
    this.addBullet(pos.x, pos.y, (dx / len) * speed, (dy / len) * speed, 7, "#e68a00");
  }

  spawnRainBurst() {
    const count = 3 + Math.min(6, this.difficulty);
    for (let i = 0; i < count; i++) {
      const x = this.arena.x + Math.random() * this.arena.w;
      const y = this.arena.y - 24 - i * 10;
      this.addBullet(x, y, (Math.random() - 0.5) * 80, this.baseSpeed() + Math.random() * 90, 6, "#f7fbff");
    }
  }

  spawnSideSweep() {
    const fromLeft = Math.random() > 0.5;
    const y = this.arena.y + Math.random() * this.arena.h;
    const x = fromLeft ? this.arena.x - 26 : this.arena.x + this.arena.w + 26;
    this.addBullet(x, y, (fromLeft ? 1 : -1) * (this.baseSpeed() + 80), (Math.random() - 0.5) * 75, 8, "#b42318");
  }

  spawnCirclePattern() {
    const center = { x: this.arena.x + this.arena.w / 2, y: this.arena.y + this.arena.h / 2 };
    const count = 10 + Math.min(14, this.difficulty * 2);
    const speed = this.baseSpeed() * 0.82;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + this.elapsed * 0.2;
      this.addBullet(center.x, center.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 5, "#003366");
    }
  }

  randomEdgePosition(side) {
    if (side === 0) return { x: this.arena.x + Math.random() * this.arena.w, y: this.arena.y - 22 };
    if (side === 1) return { x: this.arena.x + this.arena.w + 22, y: this.arena.y + Math.random() * this.arena.h };
    if (side === 2) return { x: this.arena.x + Math.random() * this.arena.w, y: this.arena.y + this.arena.h + 22 };
    return { x: this.arena.x - 22, y: this.arena.y + Math.random() * this.arena.h };
  }

  updateBullets(dt) {
    const pad = 80;
    this.bullets.forEach((bullet) => {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    });
    this.bullets = this.bullets.filter((bullet) => (
      bullet.x > this.arena.x - pad &&
      bullet.x < this.arena.x + this.arena.w + pad &&
      bullet.y > this.arena.y - pad &&
      bullet.y < this.arena.y + this.arena.h + pad
    ));
  }

  checkCollisions() {
    if (this.player.invuln > 0) return;
    for (const bullet of this.bullets) {
      const dx = this.player.x - bullet.x;
      const dy = this.player.y - bullet.y;
      if (Math.hypot(dx, dy) < this.player.r + bullet.r) {
        this.hp -= 1;
        this.player.invuln = 0.9;
        this.bullets = this.bullets.filter((item) => item !== bullet);
        arcade().beep?.(180, 0.06, "square");
        if (this.hp <= 0) this.die();
        return;
      }
    }
  }

  die() {
    this.dead = true;
    const finalScore = Math.max(1, Math.floor(this.score));
    this.score = finalScore;
    this.onXpGain(finalScore, "score no Bullet Hell");
    this.retryButton.hidden = false;
    arcade().showToast?.(`Fim de batalha: ${finalScore} XP`);
  }

  updateHud() {
    this.hpLabel.textContent = this.hp;
    this.scoreLabel.textContent = Math.floor(this.score);
    this.difficultyLabel.textContent = this.difficulty;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawArena(ctx);
    this.bullets.forEach((bullet) => this.drawBullet(ctx, bullet));
    this.drawPlayer(ctx);
    if (this.dead) this.drawGameOver(ctx);
  }

  drawArena(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.arena.x, this.arena.y, this.arena.w, this.arena.h);
    ctx.strokeStyle = "#003366";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.arena.x, this.arena.y, this.arena.w, this.arena.h);
    ctx.strokeStyle = "#d8e0ea";
    ctx.lineWidth = 1;
    for (let x = this.arena.x + 40; x < this.arena.x + this.arena.w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, this.arena.y);
      ctx.lineTo(x, this.arena.y + this.arena.h);
      ctx.stroke();
    }
    for (let y = this.arena.y + 40; y < this.arena.y + this.arena.h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(this.arena.x, y);
      ctx.lineTo(this.arena.x + this.arena.w, y);
      ctx.stroke();
    }
  }

  drawPlayer(ctx) {
    ctx.save();
    ctx.globalAlpha = this.player.invuln > 0 ? 0.55 + Math.sin(this.elapsed * 26) * 0.25 : 1;
    ctx.fillStyle = "#003366";
    ctx.beginPath();
    ctx.moveTo(this.player.x, this.player.y - this.player.r);
    ctx.bezierCurveTo(this.player.x + 16, this.player.y - 22, this.player.x + 24, this.player.y + 4, this.player.x, this.player.y + 16);
    ctx.bezierCurveTo(this.player.x - 24, this.player.y + 4, this.player.x - 16, this.player.y - 22, this.player.x, this.player.y - this.player.r);
    ctx.fill();
    ctx.restore();
  }

  drawBullet(ctx, bullet) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGameOver(ctx) {
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#b42318";
    ctx.font = "700 42px system-ui";
    ctx.fillText("GAME OVER", this.canvas.width / 2, this.canvas.height / 2 - 24);
    ctx.fillStyle = "#f7fbff";
    ctx.font = "500 20px system-ui";
    ctx.fillText(`Score final: ${Math.floor(this.score)}`, this.canvas.width / 2, this.canvas.height / 2 + 14);
    ctx.font = "500 15px system-ui";
    ctx.fillStyle = "#a8b4d6";
    ctx.fillText("XP enviado ao portal", this.canvas.width / 2, this.canvas.height / 2 + 42);
  }
}

window.NeonGames.bullethell = BulletHellGame;
})();
