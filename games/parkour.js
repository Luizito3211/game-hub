const arcade = () => window.NeonArcade || {};

export default class ParkourGame {
  init(container, onXpGain) {
    this.container = container;
    this.onXpGain = onXpGain;
    this.container.innerHTML = `
      <div class="parkour-shell">
        <div class="parkour-hud">
          <div class="stat"><span class="stat-label">Modo</span><strong>3a Pessoa</strong></div>
          <div class="stat"><span class="stat-label">Estado</span><strong id="parkourState">Spawn</strong></div>
          <div class="stat"><span class="stat-label">Respawns</span><strong id="parkourFalls">0</strong></div>
          <div class="stat"><span class="stat-label">Premio</span><strong>180 XP</strong></div>
        </div>
        <div class="parkour-stage" id="parkourStage">
          <div class="parkour-crosshair"></div>
        </div>
        <div class="parkour-help">
          <span>WASD / Setas: mover</span>
          <span>Espaco: pular</span>
          <span>Pule encostando na parede para wall run</span>
        </div>
      </div>`;

    this.stage = this.container.querySelector("#parkourStage");
    this.stateLabel = this.container.querySelector("#parkourState");
    this.fallsLabel = this.container.querySelector("#parkourFalls");
    this.keys = new Set();
    this.falls = 0;
    this.grounded = false;
    this.wallRunTimer = 0;
    this.won = false;
    this.animationId = 0;
    this.lastTime = performance.now();
    this.CONFIG = {
      gravity: -24,
      moveSpeed: 11.5,
      airMoveSpeed: 8.2,
      stopDamping: 0.15,
      jumpVelocity: 10.8,
      wallRunDuration: 0.55,
      wallRunFallSpeed: -1.2,
      wallRunBoost: 5.8,
      respawnY: -10,
      spawn: new CANNON.Vec3(0, 3.5, 0),
      playerHalfExtents: new CANNON.Vec3(0.45, 0.9, 0.45),
    };
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  start() {
    if (!window.THREE || !window.CANNON) {
      this.container.innerHTML = `<div class="empty-state"><span>3D</span><p>Three.js ou Cannon.js nao carregaram.</p></div>`;
      return;
    }
    this.setupScene();
    this.buildGym();
    this.addGrid();
    this.resize();
    this.resetPlayer();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.animationId = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    clearTimeout(this.winTimer);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.renderer?.dispose();
    this.container.innerHTML = "";
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050713);
    this.scene.fog = new THREE.Fog(0x050713, 28, 88);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 180);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.stage.appendChild(this.renderer.domElement);

    this.world = new CANNON.World();
    this.world.gravity.set(0, this.CONFIG.gravity, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 10;
    this.groundMaterial = new CANNON.Material("ground");
    this.playerMaterial = new CANNON.Material("player");
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.groundMaterial, this.playerMaterial, {
      friction: 0,
      restitution: 0,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    }));

    this.materials = {
      cyan: new THREE.MeshStandardMaterial({ color: 0x17203d, emissive: 0x00d9ff, emissiveIntensity: 0.32, roughness: 0.48 }),
      pink: new THREE.MeshStandardMaterial({ color: 0x32122c, emissive: 0xff2bd6, emissiveIntensity: 0.28, roughness: 0.52 }),
      lime: new THREE.MeshStandardMaterial({ color: 0x18310f, emissive: 0xb9ff3d, emissiveIntensity: 0.32, roughness: 0.45 }),
      gold: new THREE.MeshStandardMaterial({ color: 0x7a5512, emissive: 0xffd166, emissiveIntensity: 0.75, roughness: 0.34 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x201833, emissive: 0x6f4dff, emissiveIntensity: 0.24, roughness: 0.62 }),
      player: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x24f7ff, emissiveIntensity: 0.45, roughness: 0.35 }),
    };

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(8, 16, 10);
    const pinkLight = new THREE.PointLight(0xff2bd6, 1.3, 34);
    pinkLight.position.set(-7, 8, 16);
    this.scene.add(new THREE.AmbientLight(0x88aaff, 0.34), keyLight, pinkLight);
    this.meshes = [];
    this.bodies = [];

    this.playerBody = new CANNON.Body({
      mass: 4,
      material: this.playerMaterial,
      position: this.CONFIG.spawn.clone(),
      linearDamping: 0,
      angularDamping: 0.95,
      fixedRotation: true,
    });
    this.playerBody.addShape(new CANNON.Box(this.CONFIG.playerHalfExtents));
    this.playerBody.updateMassProperties();
    this.world.addBody(this.playerBody);
    this.playerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.9), this.materials.player);
    this.scene.add(this.playerMesh);
  }

  createBox({ position, size, material, rotation = [0, 0, 0], isWall = false, isGoal = false }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    this.scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial, position: new CANNON.Vec3(position.x, position.y, position.z) });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2], "XYZ");
    body.isWall = isWall;
    body.isGoal = isGoal;
    this.world.addBody(body);
    this.meshes.push(mesh);
    this.bodies.push(body);
  }

  buildGym() {
    const m = this.materials;
    this.createBox({ position: { x: 0, y: 0, z: 0 }, size: { x: 7, y: 0.5, z: 7 }, material: m.cyan });
    this.createBox({ position: { x: 0, y: 0.8, z: -8 }, size: { x: 4, y: 0.45, z: 6 }, material: m.pink, rotation: [-0.24, 0, 0] });
    this.createBox({ position: { x: 0, y: 2.1, z: -15 }, size: { x: 5, y: 0.45, z: 4 }, material: m.cyan });
    this.createBox({ position: { x: -4.3, y: 3.2, z: -21 }, size: { x: 4.5, y: 0.45, z: 4.5 }, material: m.lime });
    this.createBox({ position: { x: 3.9, y: 4.4, z: -28 }, size: { x: 4.8, y: 0.45, z: 4.8 }, material: m.pink });
    this.createBox({ position: { x: 0, y: 5.7, z: -35 }, size: { x: 5.2, y: 0.45, z: 5.2 }, material: m.cyan });
    this.createBox({ position: { x: 0, y: 6.8, z: -43 }, size: { x: 6, y: 0.5, z: 6 }, material: m.gold, isGoal: true });
    this.createBox({ position: { x: -3.2, y: 4.1, z: -23.8 }, size: { x: 0.6, y: 5.5, z: 7 }, material: m.wall, isWall: true });
    this.createBox({ position: { x: 3.2, y: 5.1, z: -31.3 }, size: { x: 0.6, y: 5.8, z: 7 }, material: m.wall, isWall: true });
    this.createBox({ position: { x: 0, y: 3.6, z: -18.1 }, size: { x: 6, y: 0.35, z: 2.6 }, material: m.lime, rotation: [0.3, 0, 0] });
  }

  addGrid() {
    const grid = new THREE.GridHelper(90, 45, 0x24f7ff, 0x243052);
    grid.position.y = -0.28;
    grid.material.transparent = true;
    grid.material.opacity = 0.26;
    this.scene.add(grid);
  }

  resize() {
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  resetPlayer(reason = "Respawn") {
    this.playerBody.position.copy(this.CONFIG.spawn);
    this.playerBody.velocity.set(0, 0, 0);
    this.playerBody.angularVelocity.set(0, 0, 0);
    this.playerBody.quaternion.set(0, 0, 0, 1);
    this.wallRunTimer = 0;
    this.won = false;
    this.stateLabel.textContent = reason;
  }

  handleInput(dt) {
    const forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const right = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const length = Math.hypot(forward, right) || 1;
    const speed = this.grounded ? this.CONFIG.moveSpeed : this.CONFIG.airMoveSpeed;
    const targetX = (right / length) * speed;
    const targetZ = (-forward / length) * speed;
    if (forward || right) {
      this.playerBody.velocity.x = targetX;
      this.playerBody.velocity.z = targetZ;
    } else {
      this.playerBody.velocity.x *= this.CONFIG.stopDamping;
      this.playerBody.velocity.z *= this.CONFIG.stopDamping;
    }
    if (this.wallRunTimer > 0) {
      this.wallRunTimer -= dt;
      this.playerBody.velocity.y = Math.max(this.playerBody.velocity.y, this.CONFIG.wallRunFallSpeed);
      if (forward || right) {
        this.playerBody.velocity.z = targetZ - this.CONFIG.wallRunBoost;
        this.playerBody.velocity.x = targetX;
      }
      this.stateLabel.textContent = "Wall Run";
    } else {
      this.stateLabel.textContent = this.grounded ? "Grounded" : "Airborne";
    }
  }

  jump() {
    if (this.grounded || this.wallRunTimer > 0) {
      this.playerBody.velocity.y = this.CONFIG.jumpVelocity;
      this.grounded = false;
      this.wallRunTimer = 0;
      arcade().beep?.(680, 0.05, "triangle");
    }
  }

  readContacts() {
    this.grounded = false;
    let touchingWall = false;
    this.world.contacts.forEach((contact) => {
      const playerIsA = contact.bi === this.playerBody;
      const playerIsB = contact.bj === this.playerBody;
      if (!playerIsA && !playerIsB) return;
      const other = playerIsA ? contact.bj : contact.bi;
      const normalY = playerIsA ? -contact.ni.y : contact.ni.y;
      if (normalY > 0.45) this.grounded = true;
      if (other.isWall && Math.abs(normalY) < 0.28 && !this.grounded) touchingWall = true;
      if (other.isGoal && !this.won) this.winLevel();
    });
    if (touchingWall && this.playerBody.velocity.y < 2.5) this.wallRunTimer = this.CONFIG.wallRunDuration;
  }

  winLevel() {
    this.won = true;
    this.onXpGain(180, "nivel de Parkour 3D completo");
    arcade().showToast?.("Parkour concluido. Resetando arena...");
    this.winTimer = setTimeout(() => this.resetPlayer("Vitoria"), 700);
  }

  updateCamera() {
    const p = this.playerBody.position;
    const desired = new THREE.Vector3(p.x, p.y + 4.1, p.z + 8.5);
    this.camera.position.lerp(desired, 0.08);
    this.camera.lookAt(p.x, p.y + 0.75, p.z - 3.5);
  }

  syncVisuals() {
    this.playerMesh.position.copy(this.playerBody.position);
    this.playerMesh.quaternion.copy(this.playerBody.quaternion);
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].position.copy(this.bodies[i].position);
      this.meshes[i].quaternion.copy(this.bodies[i].quaternion);
    }
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;
    this.handleInput(dt);
    this.world.step(1 / 60, dt, 3);
    this.readContacts();
    if (this.playerBody.position.y < this.CONFIG.respawnY) {
      this.falls += 1;
      this.fallsLabel.textContent = this.falls;
      arcade().showToast?.("Voce caiu no vazio. Respawn!");
      this.resetPlayer("Respawn");
    }
    this.syncVisuals();
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.loop);
  }

  onKeyDown(event) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.code === "Space") this.jump();
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }
}
