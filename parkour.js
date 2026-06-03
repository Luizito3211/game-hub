/*
  Neon Parkour 3D
  Perspectiva escolhida: terceira pessoa com camera suave seguindo o jogador.
  Ajustes principais ficam no objeto CONFIG para facilitar o balanceamento.
*/

function parkour() {
  const mount = document.querySelector("#gameMount");
  const arcade = window.NeonArcade || {};

  if (!window.THREE || !window.CANNON) {
    mount.innerHTML = `
      <div class="empty-state">
        <span>3D</span>
        <p>Three.js ou Cannon.js nao carregaram. Conecte-se a internet e recarregue a pagina.</p>
      </div>`;
    return () => {};
  }

  const CONFIG = {
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

  mount.innerHTML = `
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

  const stage = document.querySelector("#parkourStage");
  const stateLabel = document.querySelector("#parkourState");
  const fallsLabel = document.querySelector("#parkourFalls");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050713);
  scene.fog = new THREE.Fog(0x050713, 28, 88);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 180);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stage.appendChild(renderer.domElement);

  const world = new CANNON.World();
  world.gravity.set(0, CONFIG.gravity, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 10;

  const groundMaterial = new CANNON.Material("ground");
  const playerMaterial = new CANNON.Material("player");
  world.defaultContactMaterial.friction = 0;
  world.defaultContactMaterial.restitution = 0;
  world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, playerMaterial, {
    friction: 0,
    restitution: 0,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  }));

  const neonCyan = new THREE.MeshStandardMaterial({ color: 0x17203d, emissive: 0x00d9ff, emissiveIntensity: 0.32, roughness: 0.48 });
  const neonPink = new THREE.MeshStandardMaterial({ color: 0x32122c, emissive: 0xff2bd6, emissiveIntensity: 0.28, roughness: 0.52 });
  const neonLime = new THREE.MeshStandardMaterial({ color: 0x18310f, emissive: 0xb9ff3d, emissiveIntensity: 0.32, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x7a5512, emissive: 0xffd166, emissiveIntensity: 0.75, roughness: 0.34 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x201833, emissive: 0x6f4dff, emissiveIntensity: 0.24, roughness: 0.62 });
  const playerThreeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x24f7ff, emissiveIntensity: 0.45, roughness: 0.35 });

  const ambient = new THREE.AmbientLight(0x88aaff, 0.34);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(8, 16, 10);
  const pinkLight = new THREE.PointLight(0xff2bd6, 1.3, 34);
  pinkLight.position.set(-7, 8, 16);
  scene.add(ambient, keyLight, pinkLight);

  const meshes = [];
  const bodies = [];
  const keys = new Set();
  let falls = 0;
  let grounded = false;
  let wallRunTimer = 0;
  let won = false;
  let animationId = 0;
  let lastTime = performance.now();

  const playerShape = new CANNON.Box(CONFIG.playerHalfExtents);
  const playerBody = new CANNON.Body({
    mass: 4,
    material: playerMaterial,
    position: CONFIG.spawn.clone(),
    linearDamping: 0,
    angularDamping: 0.95,
    fixedRotation: true,
  });
  playerBody.addShape(playerShape);
  playerBody.updateMassProperties();
  world.addBody(playerBody);

  const playerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.9), playerThreeMaterial);
  scene.add(playerMesh);

  function createBox({ position, size, material, rotation = [0, 0, 0], isWall = false, isGoal = false }) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: 0,
      material: groundMaterial,
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2], "XYZ");
    body.isWall = isWall;
    body.isGoal = isGoal;
    world.addBody(body);

    meshes.push(mesh);
    bodies.push(body);
    return { mesh, body };
  }

  function buildGym() {
    createBox({ position: { x: 0, y: 0, z: 0 }, size: { x: 7, y: 0.5, z: 7 }, material: neonCyan });
    createBox({ position: { x: 0, y: 0.8, z: -8 }, size: { x: 4, y: 0.45, z: 6 }, material: neonPink, rotation: [-0.24, 0, 0] });
    createBox({ position: { x: 0, y: 2.1, z: -15 }, size: { x: 5, y: 0.45, z: 4 }, material: neonCyan });
    createBox({ position: { x: -4.3, y: 3.2, z: -21 }, size: { x: 4.5, y: 0.45, z: 4.5 }, material: neonLime });
    createBox({ position: { x: 3.9, y: 4.4, z: -28 }, size: { x: 4.8, y: 0.45, z: 4.8 }, material: neonPink });
    createBox({ position: { x: 0, y: 5.7, z: -35 }, size: { x: 5.2, y: 0.45, z: 5.2 }, material: neonCyan });
    createBox({ position: { x: 0, y: 6.8, z: -43 }, size: { x: 6, y: 0.5, z: 6 }, material: gold, isGoal: true });

    createBox({ position: { x: -3.2, y: 4.1, z: -23.8 }, size: { x: 0.6, y: 5.5, z: 7 }, material: wallMaterial, isWall: true });
    createBox({ position: { x: 3.2, y: 5.1, z: -31.3 }, size: { x: 0.6, y: 5.8, z: 7 }, material: wallMaterial, isWall: true });
    createBox({ position: { x: 0, y: 3.6, z: -18.1 }, size: { x: 6, y: 0.35, z: 2.6 }, material: neonLime, rotation: [0.3, 0, 0] });
  }

  function addGrid() {
    const grid = new THREE.GridHelper(90, 45, 0x24f7ff, 0x243052);
    grid.position.y = -0.28;
    grid.material.transparent = true;
    grid.material.opacity = 0.26;
    scene.add(grid);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function resetPlayer(reason = "Respawn") {
    playerBody.position.copy(CONFIG.spawn);
    playerBody.velocity.set(0, 0, 0);
    playerBody.angularVelocity.set(0, 0, 0);
    playerBody.quaternion.set(0, 0, 0, 1);
    wallRunTimer = 0;
    won = false;
    stateLabel.textContent = reason;
  }

  function handleInput(dt) {
    const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const right = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const length = Math.hypot(forward, right) || 1;
    const speed = grounded ? CONFIG.moveSpeed : CONFIG.airMoveSpeed;
    const targetX = (right / length) * speed;
    const targetZ = (-forward / length) * speed;

    if (forward || right) {
      playerBody.velocity.x = targetX;
      playerBody.velocity.z = targetZ;
    } else {
      playerBody.velocity.x *= CONFIG.stopDamping;
      playerBody.velocity.z *= CONFIG.stopDamping;
    }

    if (wallRunTimer > 0) {
      wallRunTimer -= dt;
      playerBody.velocity.y = Math.max(playerBody.velocity.y, CONFIG.wallRunFallSpeed);
      if (forward || right) {
        playerBody.velocity.z = targetZ - CONFIG.wallRunBoost;
        playerBody.velocity.x = targetX;
      }
      stateLabel.textContent = "Wall Run";
    } else {
      stateLabel.textContent = grounded ? "Grounded" : "Airborne";
    }
  }

  function jump() {
    if (grounded || wallRunTimer > 0) {
      playerBody.velocity.y = CONFIG.jumpVelocity;
      grounded = false;
      wallRunTimer = 0;
      arcade.beep?.(680, 0.05, "triangle");
    }
  }

  function readContacts() {
    grounded = false;
    let touchingWall = false;

    world.contacts.forEach((contact) => {
      const playerIsA = contact.bi === playerBody;
      const playerIsB = contact.bj === playerBody;
      if (!playerIsA && !playerIsB) return;

      const other = playerIsA ? contact.bj : contact.bi;
      const normalY = playerIsA ? -contact.ni.y : contact.ni.y;

      if (normalY > 0.45) grounded = true;
      if (other.isWall && Math.abs(normalY) < 0.28 && !grounded) touchingWall = true;
      if (other.isGoal && !won) winLevel();
    });

    if (touchingWall && playerBody.velocity.y < 2.5) {
      wallRunTimer = CONFIG.wallRunDuration;
    }
  }

  function winLevel() {
    won = true;
    arcade.addXp?.(180, "nivel de Parkour 3D completo");
    arcade.showToast?.("Parkour concluido. Resetando arena...");
    setTimeout(() => resetPlayer("Vitoria"), 700);
  }

  function updateCamera() {
    const p = playerBody.position;
    const desired = new THREE.Vector3(p.x, p.y + 4.1, p.z + 8.5);
    camera.position.lerp(desired, 0.08);
    camera.lookAt(p.x, p.y + 0.75, p.z - 3.5);
  }

  function syncVisuals() {
    playerMesh.position.copy(playerBody.position);
    playerMesh.quaternion.copy(playerBody.quaternion);

    for (let i = 0; i < meshes.length; i++) {
      meshes[i].position.copy(bodies[i].position);
      meshes[i].quaternion.copy(bodies[i].quaternion);
    }
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    handleInput(dt);
    world.step(1 / 60, dt, 3);
    readContacts();

    if (playerBody.position.y < CONFIG.respawnY) {
      falls += 1;
      fallsLabel.textContent = falls;
      arcade.showToast?.("Voce caiu no vazio. Respawn!");
      resetPlayer("Respawn");
    }

    syncVisuals();
    updateCamera();
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (event.code === "Space") jump();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  buildGym();
  addGrid();
  resize();
  resetPlayer();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  animationId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer.dispose();
    stage.replaceChildren();
  };
}
