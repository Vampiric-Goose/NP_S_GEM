import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const CFG = {
    GRID: 100, CELL: 15, LIMIT: 0,
    SPEED: 20, SPRINT_SPEED: 45,
    GRAV: 60, JUMP: 22, SENS: 0.001,
    PLAYER_R: 0.5, GRAPPLE_SPEED: 160, GRAPPLE_CD: 5, MAX_ACTIVE_ENEMIES: 20,
    SPRINT_MAX: 3.0, SPRINT_REGEN: 0.5, SPRINT_COOLDOWN: 2.0,
    WALL_RUN_GRAVITY: 0, WALL_JUMP_FORCE: 30,
    FOV_BASE: 90, FOV_SPRINT: 110, FOV_WALL: 120, FOV_SCOPE: 40,
    RADAR_RANGE: 80, WALL_CLIMB_SPEED: 30
};
CFG.LIMIT = (CFG.GRID * CFG.CELL) / 2;

const WAVES = [
    { count: 10, types: ['standard'] },
    { count: 15, types: ['standard', 'swarmer'] },
    { count: 20, types: ['swarmer', 'heavy'] },
    { count: 25, types: ['standard', 'swarmer', 'heavy'] },
    { count: 1, types: ['boss_omega'] },
    { count: 25, types: ['standard', 'wraith'] },
    { count: 30, types: ['wraith', 'heavy'] },
    { count: 20, types: ['titan', 'standard'] },
    { count: 35, types: ['wraith', 'titan', 'swarmer'] },
    { count: 1, types: ['boss_seraph'] }
];

const WEAPONS = [
    { name: "PLASMA RIFLE", color: 0x00ffff, rate: 0.1, damage: 1.5, count: 1, spread: 0.02, ammo: 30, recoil: 0.2, type: 'bullet', scale: [1, 1, 1], id: 0, sfx: 'shoot_plasma', alt: 'grenade', reloadTime: 1.2 },
    { name: "VOID SHOTGUN", color: 0xff00ff, rate: 0.8, damage: 1, count: 6, spread: 0.15, ammo: 8, recoil: 0.6, type: 'bullet', scale: [1, 1, 1], id: 1, sfx: 'shoot_shotgun', alt: 'grapple', reloadTime: 1.2 },
    { name: "R.A.D.I.A.N.C.E.", color: 0xffaa00, rate: 0.1, damage: 50, count: 1, spread: 0.001, ammo: 1, recoil: 0.1, type: 'beam', scale: [1, 1, 1], id: 2, sfx: 'shoot_laser', alt: 'scope', reloadTime: 4.0 },
    { name: "LAZARUS", color: 0x00ff00, rate: 0.4, damage: 4, count: 1, spread: 0.02, ammo: 4, recoil: 0.1, type: 'lazarus', scale: [1, 1, 1], id: 3, sfx: 'shoot_plasma', alt: 'grapple', reloadTime: 2.5 },
    { name: "DANTÈS", color: 0xffffff, rate: 0.15, damage: 1.0, count: 1, spread: 0.05, ammo: 12, recoil: 0.3, type: 'bullet', scale: [0.5, 0.5, 1.5], id: 4, sfx: 'shoot_dantes', alt: 'timestop', reloadTime: 2.0 },
    { name: "CALIBURN", color: 0xff0055, rate: 1.0, damage: 2, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'melee', scale: [1, 1, 1], id: 5, sfx: 'swing_sword', alt: null, reloadTime: 0 },
    { name: "LIMITLESS", color: 0xaa00ff, rate: 0.5, damage: 9999, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'gojo', scale: [1, 1, 1], id: 6, sfx: 'charge', alt: 'infinity', reloadTime: 0 },
    { name: "FIFTH MAGIC", color: 0x00ffff, rate: 0.1, damage: 3, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'magic', scale: [1, 1, 1], id: 7, sfx: 'charge', alt: 'casting', reloadTime: 0 }
];

const state = {
    active: false, hp: 100, ammo: 30, score: 0, reloading: false, dashCd: 0, shake: 0,
    wave: 1, enemiesSpawnedInWave: 0, enemiesKilledInWave: 0, bossActive: false,
    currentWeapon: WEAPONS[0],
    grapple: { active: false, pos: new THREE.Vector3(), cd: 0 },
    wallRun: { active: false, side: 0, normal: new THREE.Vector3(), climbing: false },
    cameraRoll: 0,
    stamina: CFG.SPRINT_MAX, canSprint: true, sprintCooldown: 0,
    modes: { dev: false, cb: false, bossRush: false, startWave: 1 },
    yaw: 0, pitch: 0,
    grenadeCharge: 0, grenadeCooldown: 0,
    beamCharge: 0,
    isScoped: false,
    timeScale: 1.0,
    dantes: { side: 0, cooldown: 0, active: false, activeTime: 0, idleTimer: 0, spinState: 0, recoilL: 0, recoilR: 0, canCancel: false },
    lazarus: { tier: 4, nextTier: 6, speedBoost: 0, dieMesh: null },
    buff: { active: false, time: 0, multiplier: 1.0 },
    melee: { swinging: false, swingTime: 0, combo: 0, nextAttackTime: 0, hitCalculated: false },
    sacred: { unlocked: false, active: false, ammo: 3, spears: [], cd: 0, toggleLock: false },
    infinityActive: false,
    fifthMagic: { buffer: [], casting: false, lastInputTime: 0 }
};

const input = { fwd: 0, str: 0, jump: false, sprint: false, fire: false, alt: false, sacred: false, pitch: 0, yaw: 0 };
const player = { pos: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector3(), ground: false, height: 1.8, wallNormal: new THREE.Vector3() };
let currentGunMesh = null;
let sacredGroup = null;

const orbitalStrikes = [];
const sacredProjectiles = [];
const thrownBuildings = [];

// REUSABLE VECTORS TO PREVENT GC AND LAG
const _tempVec = new THREE.Vector3();
const _segmentVec = new THREE.Vector3();
const _pointVec = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();

const Audio = {
    ctx: null, master: null, nextNoteTime: 0, beat: 0,
    init: function () {
        if (this.ctx) return;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.3;
        this.master.connect(this.ctx.destination);
        this.scheduler();
    },
    playSound: function (type) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.master);
        const now = this.ctx.currentTime;
        if (type === 'shoot_plasma') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'shoot_shotgun') {
            osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'shoot_laser') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now); osc.frequency.linearRampToValueAtTime(400, now + 0.4);
            gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'shoot_dantes') {
            osc.type = 'square'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'swing_sword') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(600, now + 0.3);
            gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'explosion') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
            gain.gain.setValueAtTime(1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'charge') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'sacred_fire') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else {
            osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    },
    scheduler: function () {
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playBeat(this.nextNoteTime, this.beat);
            this.nextNoteTime += 0.125; this.beat = (this.beat + 1) % 16;
        }
        setTimeout(() => this.scheduler(), 25);
    },
    playBeat: function (time, beat) {
        if (beat % 4 === 0) {
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.connect(gain); gain.connect(this.master);
            osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
            gain.gain.setValueAtTime(1, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.start(time); osc.stop(time + 0.5);
        }
        if (beat % 2 === 0) {
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.type = 'sawtooth'; osc.connect(gain); gain.connect(this.master);
            const notes = [55, 55, 55, 55, 58, 58, 62, 62];
            const note = notes[Math.floor(beat / 16) % notes.length] || 55;
            osc.frequency.setValueAtTime(note, time);
            const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, time); filter.frequency.linearRampToValueAtTime(1000, time + 0.1);
            osc.disconnect(); osc.connect(filter); filter.connect(gain);
            gain.gain.setValueAtTime(0.3, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            osc.start(time); osc.stop(time + 0.2);
        }
    }
};

const cmdInput = document.getElementById('cmd-input');
const cmdFeedback = document.getElementById('cmd-feedback');
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = cmdInput.value.toUpperCase().trim();
        if (code === 'CHIMERA') { state.modes.dev = true; state.modes.cb = false; cmdFeedback.innerText = "DEV MODE ACTIVE: GODLIKE"; cmdFeedback.style.color = "#0f0"; }
        else if (code === 'TANNER') { state.modes.cb = true; state.modes.dev = false; cmdFeedback.innerText = "VISIBILITY MODE: HIGH CONTRAST"; cmdFeedback.style.color = "#0ff"; }
        else if (code === 'FIVEGUYS!!') { state.modes.startWave = 5; cmdFeedback.innerText = "OVERRIDE: OMEGA PROTOCOL"; cmdFeedback.style.color = "#ff00ff"; }
        else if (code === 'ALA DIX') { state.modes.startWave = 10; cmdFeedback.innerText = "WARP: TENTH CIRCLE"; cmdFeedback.style.color = "#ffaa00"; }
        else if (code === 'SALUTE THE LIGHT') { state.sacred.unlocked = true; cmdFeedback.innerText = "SACRED ARMAMENT GRANTED"; cmdFeedback.style.color = "#aa00ff"; }
        else if (code === 'GOJO SATORU') { state.modes.dev = true; window.selectWeapon(6); cmdFeedback.innerText = "THROUGHOUT HEAVEN AND EARTH..."; cmdFeedback.style.color = "#aa00ff"; }
        else if (code === 'MAHOUTSUKAI NO YORU') { state.modes.dev = true; window.selectWeapon(7); cmdFeedback.innerText = "THE FIFTH MAGIC ACTIVATED"; cmdFeedback.style.color = "#00ffff"; }
        else if (code === 'NULL') { state.modes.dev = false; state.modes.cb = false; state.modes.startWave = 1; cmdFeedback.innerText = "SYSTEM RESET: STANDARD"; cmdFeedback.style.color = "#ff0"; }
        else { cmdFeedback.innerText = "INVALID CREDENTIALS"; cmdFeedback.style.color = "#f00"; }
        cmdInput.value = '';
    }
});

const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x080010, 0.012);
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 5000); camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ powerPreference: "high-performance", antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.5, 0.85);
bloomPass.threshold = 0.2;
bloomPass.strength = 1.2;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

const radarCanvas = document.getElementById('radar-canvas'); const radarCtx = radarCanvas.getContext('2d');
function updateRadar() {
    const size = 160; const radius = size / 2; radarCtx.clearRect(0, 0, size, size); radarCtx.save(); radarCtx.translate(radius, radius);
    radarCtx.beginPath(); radarCtx.moveTo(0, -6); radarCtx.lineTo(5, 6); radarCtx.lineTo(0, 4); radarCtx.lineTo(-5, 6); radarCtx.closePath(); radarCtx.fillStyle = '#ffffff'; radarCtx.fill();
    const angle = camera.rotation.y;
    enemies.forEach(e => {
        if (e.dead) return;
        const dx = e.group.position.x - player.pos.x; const dz = e.group.position.z - player.pos.z;
        const rx = dx * Math.cos(angle) - dz * Math.sin(angle); const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
        const scale = (radius - 10) / CFG.RADAR_RANGE; let px = rx * scale; let py = rz * scale;
        const dist = Math.sqrt(px * px + py * py); if (dist > radius - 8) { const ratio = (radius - 8) / dist; px *= ratio; py *= ratio; }
        radarCtx.beginPath(); radarCtx.arc(px, py, (e.type === 'boss_omega' || e.type === 'boss_seraph') ? 6 : 3, 0, Math.PI * 2);
        if (state.modes.cb) { if (e.type === 'boss_omega' || e.type === 'boss_seraph') radarCtx.fillStyle = '#ff00ff'; else if (e.type === 'standard') radarCtx.fillStyle = '#ffffff'; else if (e.type === 'swarmer') radarCtx.fillStyle = '#00ffff'; else radarCtx.fillStyle = '#0000ff'; } else { radarCtx.fillStyle = (e.type === 'boss_omega' || e.type === 'boss_seraph') ? '#ff00ff' : '#ff0000'; }
        radarCtx.fill();
    });
    radarCtx.restore();
}

const skyGeo = new THREE.SphereGeometry(4000, 32, 32);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { topColor: { value: new THREE.Color(0x000022) }, bottomColor: { value: new THREE.Color(0xff0055) }, offset: { value: 50 }, exponent: { value: 0.6 } }, vertexShader: `varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4( position, 1.0 ); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`, fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); } void main() { float h = normalize( vWorldPosition + offset ).y; vec3 col = mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ); float star = random(gl_FragCoord.xy / 400.0); if (star > 0.995) col += vec3(0.8); gl_FragColor = vec4( col, 1.0 ); }` });
scene.add(new THREE.Mesh(skyGeo, skyMat));
const createNeonTexture = () => { const size = 512; const data = new Uint8Array(size * size * 4); for (let i = 0; i < size * size; i++) { const x = i % size; const y = Math.floor(i / size); const r = Math.random(); let c = (x % 40 < 5 || y % 40 < 5) ? 255 : 0; if (c === 0 && r > 0.95) c = 255; data[i * 4] = c; data[i * 4 + 1] = c; data[i * 4 + 2] = c; data[i * 4 + 3] = 255; } const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex; };
const buildingTex = createNeonTexture();
scene.add(new THREE.HemisphereLight(0xaa00ff, 0x0000aa, 0.4)); const sunLight = new THREE.DirectionalLight(0xffaa00, 1.5); sunLight.position.set(-50, 100, -100); scene.add(sunLight);

const worldHeights = []; for (let x = 0; x < CFG.GRID; x++) worldHeights[x] = new Float32Array(CFG.GRID);
const buildingMap = new Int32Array(CFG.GRID * CFG.GRID).fill(-1);
let buildingsMesh; const dummy = new THREE.Object3D();
function buildWorld() {
    const geo = new THREE.BoxGeometry(CFG.CELL, 1, CFG.CELL); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a15,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x0088ff,
        emissiveMap: buildingTex,
        emissiveIntensity: 2.5,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    buildingsMesh = new THREE.InstancedMesh(geo, mat, CFG.GRID * CFG.GRID);
    let idx = 0;
    for (let x = 0; x < CFG.GRID; x++) {
        for (let z = 0; z < CFG.GRID; z++) {
            const dist = Math.sqrt((x - CFG.GRID / 2) ** 2 + (z - CFG.GRID / 2) ** 2);
            if (dist < 10) { worldHeights[x][z] = 0; continue; }
            if (Math.random() < 0.15) {
                const h = 12 + Math.random() * 40; worldHeights[x][z] = h;
                dummy.position.set((x - CFG.GRID / 2) * CFG.CELL, 0, (z - CFG.GRID / 2) * CFG.CELL); dummy.scale.set(1, h, 1); dummy.updateMatrix();
                buildingsMesh.setMatrixAt(idx, dummy.matrix); buildingMap[x + z * CFG.GRID] = idx; idx++;
            } else { worldHeights[x][z] = 0; }
        }
    }
    buildingsMesh.count = idx; buildingsMesh.instanceMatrix.needsUpdate = true; scene.add(buildingsMesh);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CFG.LIMIT * 2, CFG.LIMIT * 2), new THREE.MeshPhysicalMaterial({
        color: 0x050011,
        roughness: 0.1,
        metalness: 0.8,
        reflectivity: 1.0,
        clearcoat: 1.0
    }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const gridHelper = new THREE.GridHelper(CFG.LIMIT * 2, CFG.GRID, 0xff00ff, 0x110033);
    gridHelper.position.y = 0.1;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);
    const wGeo = new THREE.BoxGeometry(CFG.LIMIT * 2, 80, 2); const wMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.1 });
    const w1 = new THREE.Mesh(wGeo, wMat); w1.position.set(0, 40, -CFG.LIMIT); const w2 = new THREE.Mesh(wGeo, wMat); w2.position.set(0, 40, CFG.LIMIT);
    const w3 = new THREE.Mesh(wGeo, wMat); w3.position.set(-CFG.LIMIT, 40, 0); w3.rotation.y = Math.PI / 2; const w4 = new THREE.Mesh(wGeo, wMat); w4.position.set(CFG.LIMIT, 40, 0); w4.rotation.y = Math.PI / 2;
    scene.add(w1, w2, w3, w4);
}
buildWorld();

function findSafeSpawn() { let pos = new THREE.Vector3(0, 20, 0); for (let i = 0; i < 100; i++) { const tx = (Math.random() - 0.5) * 2 * (CFG.LIMIT - 30); const tz = (Math.random() - 0.5) * 2 * (CFG.LIMIT - 30); const gx = Math.floor((tx / CFG.CELL) + CFG.GRID / 2); const gz = Math.floor((tz / CFG.CELL) + CFG.GRID / 2); if (gx >= 0 && gx < CFG.GRID && gz >= 0 && gz < CFG.GRID && worldHeights[gx][gz] < 1) { pos.set(tx, 2, tz); break; } } return pos; }
function damageBuilding(gx, gz, dmg) { if (gx < 0 || gx >= CFG.GRID || gz < 0 || gz >= CFG.GRID) return; const idx = buildingMap[gx + gz * CFG.GRID]; if (idx === -1) return; let currentH = worldHeights[gx][gz]; if (currentH < 1) return; currentH -= dmg; buildingsMesh.getMatrixAt(idx, dummy.matrix); dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale); if (currentH <= 1) { currentH = 0; dummy.scale.set(0, 0, 0); } else { dummy.scale.y = currentH; } dummy.updateMatrix(); buildingsMesh.setMatrixAt(idx, dummy.matrix); buildingsMesh.instanceMatrix.needsUpdate = true; worldHeights[gx][gz] = currentH; createExplosion(new THREE.Vector3((gx - CFG.GRID / 2) * CFG.CELL, currentH, (gz - CFG.GRID / 2) * CFG.CELL), 0xaaaaaa); }

// --- PATHFINDING ---
function findPath(startPos, targetPos) {
    const startX = Math.floor((startPos.x / CFG.CELL) + CFG.GRID / 2); const startZ = Math.floor((startPos.z / CFG.CELL) + CFG.GRID / 2);
    const endX = Math.floor((targetPos.x / CFG.CELL) + CFG.GRID / 2); const endZ = Math.floor((targetPos.z / CFG.CELL) + CFG.GRID / 2);
    if (startX < 0 || startX >= CFG.GRID || startZ < 0 || startZ >= CFG.GRID) return null;
    if (endX < 0 || endX >= CFG.GRID || endZ < 0 || endZ >= CFG.GRID) return null;
    const openSet = []; const closedSet = new Set(); const cameFrom = {}; const gScore = {}; const fScore = {};
    const startKey = `${startX},${startZ}`; openSet.push({ x: startX, z: startZ, f: 0 });
    gScore[startKey] = 0; fScore[startKey] = Math.abs(startX - endX) + Math.abs(startZ - endZ);
    let iterations = 0;
    while (openSet.length > 0) {
        if (iterations++ > 100) return null;
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const currentKey = `${current.x},${current.z}`;
        if (current.x === endX && current.z === endZ) {
            const path = []; let currStr = currentKey;
            while (cameFrom[currStr]) {
                const coords = currStr.split(',').map(Number);
                path.push(new THREE.Vector3((coords[0] - CFG.GRID / 2) * CFG.CELL, 15, (coords[1] - CFG.GRID / 2) * CFG.CELL));
                currStr = cameFrom[currStr];
            }
            return path.reverse();
        }
        closedSet.add(currentKey);
        const neighbors = [{ x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z }, { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 }];
        for (let n of neighbors) {
            if (n.x < 0 || n.x >= CFG.GRID || n.z < 0 || n.z >= CFG.GRID) continue;
            if (worldHeights[n.x][n.z] > 10) continue;
            const nKey = `${n.x},${n.z}`; if (closedSet.has(nKey)) continue;
            const tentativeG = gScore[currentKey] + 1;
            if (tentativeG < (gScore[nKey] || Infinity)) {
                cameFrom[nKey] = currentKey; gScore[nKey] = tentativeG;
                fScore[nKey] = gScore[nKey] + (Math.abs(n.x - endX) + Math.abs(n.z - endZ));
                if (!openSet.some(o => o.x === n.x && o.z === n.z)) { openSet.push({ x: n.x, z: n.z, f: fScore[nKey] }); }
            }
        }
    }
    return null;
}

const gunGroup = new THREE.Group(); camera.add(gunGroup); scene.add(camera);
const gunLight = new THREE.PointLight(0x00ffff, 0, 8); gunLight.position.set(0, 0, -0.6); gunGroup.add(gunLight);
const grappleMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 }); const grappleGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const grappleLine = new THREE.Line(grappleGeo, grappleMat); grappleLine.frustumCulled = false; grappleLine.visible = false; scene.add(grappleLine);
const beamMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 4 }); const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const hitscanBeam = new THREE.Line(beamGeo, beamMat); hitscanBeam.frustumCulled = false; hitscanBeam.visible = false; scene.add(hitscanBeam);

function buildSacredModel() {
    if (sacredGroup) { camera.remove(sacredGroup); sacredGroup = null; }
    sacredGroup = new THREE.Group();

    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    shaftGeo.rotateX(Math.PI / 2);
    const headGeo = new THREE.OctahedronGeometry(0.15);
    const ringGeo = new THREE.TorusGeometry(0.15, 0.02, 8, 16);

    const mat = new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (let i = 0; i < 3; i++) {
        const spear = new THREE.Group();

        const shaft = new THREE.Mesh(shaftGeo, mat);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.z = -0.8;
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = -0.5;

        spear.add(shaft, head, ring);

        spear.position.set(Math.cos(i * 2.09) * 0.6, Math.sin(i * 2.09) * 0.6, -1);
        sacredGroup.add(spear);
    }
    sacredGroup.position.set(0, 0, -0.5);
    camera.add(sacredGroup);
}

function buildWeaponModel(id) {
    while (gunGroup.children.length > 0) { gunGroup.remove(gunGroup.children[0]); }
    gunGroup.add(gunLight);
    const matBody = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
    const matGlow = new THREE.MeshBasicMaterial({ color: WEAPONS[id].color });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 });
    let mesh = new THREE.Group();
    mesh.name = "weapon_model";

    if (id === 0) { const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.6), matBody); const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), matDark); gl.rotation.x = Math.PI / 2; gl.position.set(0, -0.1, -0.1); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), matDark); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.2; const glow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.4), matGlow); glow.position.set(0, 0.05, -0.1); mesh.add(body, gl, barrel, glow); }
    else if (id === 1) { const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.4), matBody); const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), matDark); b1.rotation.x = Math.PI / 2; b1.position.set(0.03, 0.05, -0.3); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), matDark); b2.rotation.x = Math.PI / 2; b2.position.set(-0.03, 0.05, -0.3); const glow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), matGlow); glow.position.set(0, 0.1, 0); mesh.add(body, b1, b2, glow); }
    else if (id === 2) { const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.8), matBody); const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.0), matDark); rail1.position.set(0.06, 0, -0.2); const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.0), matDark); rail2.position.set(-0.06, 0, -0.2); const core = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), matGlow); core.rotation.x = Math.PI / 2; mesh.add(body, rail1, rail2, core); }
    else if (id === 3) {
        const tier = state.lazarus.tier;
        let geo;
        if (tier === 4) geo = new THREE.TetrahedronGeometry(0.15);
        else if (tier === 6) geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        else if (tier === 8) geo = new THREE.OctahedronGeometry(0.15);
        else if (tier === 10) { geo = new THREE.ConeGeometry(0.15, 0.3, 5); }
        else if (tier === 12) geo = new THREE.DodecahedronGeometry(0.15);
        else geo = new THREE.IcosahedronGeometry(0.15);

        const die = new THREE.Mesh(geo, matGlow);
        die.name = 'lazarus_die';
        mesh.add(die);
    }
    else if (id === 4) {
        const leftGun = new THREE.Group(); leftGun.name = 'dantes_left';
        const lBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), matWhite); const lCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08), matDark); lCyl.rotation.z = Math.PI / 2; lCyl.position.y = 0.02; const lBarr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), matWhite); lBarr.rotation.x = Math.PI / 2; lBarr.position.set(0, 0.05, -0.3);
        leftGun.add(lBody, lCyl, lBarr); leftGun.position.set(-0.5, -0.2, -0.4);
        const rightGun = leftGun.clone(); rightGun.name = 'dantes_right'; rightGun.position.set(0.5, -0.2, -0.4);
        mesh.add(leftGun, rightGun);
    }
    else if (id === 5) {
        const pivot = new THREE.Group(); pivot.name = 'sword_pivot';
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), matDark); hilt.position.y = -0.25;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.1), matDark);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.05), matGlow); blade.position.y = 0.75;
        pivot.add(hilt, guard, blade); pivot.rotation.set(0.2, -0.5, 0.5); pivot.position.set(0.5, -0.4, -0.5);
        mesh.add(pivot);
    } else if (id === 6) {
        // GOJO WEAPON: Blue Orb, Red Orb
        const blueOrb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
        blueOrb.position.set(-0.2, 0, -0.2);
        const redOrb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        redOrb.position.set(0.2, 0, -0.2);

        mesh.add(blueOrb, redOrb);
        mesh.name = 'gojo_weapon';
    } else if (id === 7) {
        // FIFTH MAGIC: Aoko's Crest
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0x0088ff }));
        ring2.rotation.x = Math.PI / 2;
        mesh.add(ring1, ring2);
        mesh.name = 'fifth_magic_weapon';
    }
    currentGunMesh = mesh;
    gunGroup.add(mesh);
    if (id === 4 || id === 5) gunGroup.position.set(0, 0, 0); else gunGroup.position.set(0.4, -0.3, -0.5);
    gunLight.color.setHex(WEAPONS[id].color);
}

const bullets = []; for (let i = 0; i < 150; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.0), new THREE.MeshBasicMaterial({ color: 0x00ffff })); m.visible = false; scene.add(m); bullets.push({ mesh: m, active: false, life: 0, vel: new THREE.Vector3(), homing: false, stun: false, knockback: false, ricochet: false, prevPos: new THREE.Vector3() }); }
const grenades = []; const grenGroup = new THREE.Group(); const gBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff })); gBody.rotation.x = Math.PI / 2; const gCap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); gCap1.rotation.x = Math.PI / 2; gCap1.position.z = 0.15; const gCap2 = gCap1.clone(); gCap2.position.z = -0.15; grenGroup.add(gBody, gCap1, gCap2); for (let i = 0; i < 10; i++) { const m = grenGroup.clone(); m.visible = false; scene.add(m); grenades.push({ mesh: m, active: false, vel: new THREE.Vector3() }); }
const enemyBullets = []; const ebGeo = new THREE.SphereGeometry(0.3); const ebMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(ebGeo, ebMat); m.visible = false; scene.add(m); enemyBullets.push({ mesh: m, active: false, vel: new THREE.Vector3() }); }
const particles = [];
for (let i = 0; i < 150; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 5 }));
    m.visible = false;
    scene.add(m);
    particles.push({ mesh: m, active: false, life: 0, vel: new THREE.Vector3(), scale: 1 });
}
function createExplosion(pos, color, scale = 1) {
    Audio.playSound('explosion');
    state.shake = Math.min(state.shake + 0.3 * scale, 2.0);
    for (let i = 0; i < 20 * scale; i++) {
        const p = particles.find(p => !p.active);
        if (p) {
            p.active = true; p.life = 0.4 + Math.random() * 0.4; p.mesh.visible = true; p.mesh.position.copy(pos);
            p.mesh.material.color.setHex(color); p.mesh.material.emissive.setHex(color);
            p.vel.set((Math.random() - 0.5) * 30 * scale, (Math.random() - 0.5) * 30 * scale, (Math.random() - 0.5) * 30 * scale);
            p.scale = (0.5 + Math.random()) * scale;
        }
    }
}

function createParticles(pos, color, count) {
    for (let i = 0; i < count; i++) {
        const p = particles.find(p => !p.active);
        if (p) {
            p.active = true;
            p.life = 0.5;
            p.mesh.visible = true;
            p.mesh.position.copy(pos);
            p.mesh.material.color.setHex(color);
            p.mesh.material.emissive.setHex(color);
            p.vel.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10 + 5, (Math.random() - 0.5) * 10);
        }
    }
}

function killEnemy(e, byPlayer = false) {
    if (e.dead) return;
    e.dead = true;
    createExplosion(e.group.position, 0xff0000);
    scene.remove(e.group);
    const idx = enemies.indexOf(e); if (idx > -1) enemies.splice(idx, 1);

    if (byPlayer && state.currentWeapon.id === 5) {
        state.buff.active = true;
        state.buff.time = Infinity;
        state.buff.multiplier *= 1.3;
        const buffDisplay = document.getElementById('buff-container');
        buffDisplay.style.display = 'block';
        document.getElementById('buff-val').innerText = state.buff.multiplier.toFixed(1) + "x";
        document.getElementById('risk-warning').style.display = 'block';
        buffDisplay.style.transform = "scale(1.5)";
        setTimeout(() => buffDisplay.style.transform = "scale(1.0)", 100);
        if (state.buff.multiplier > 5.0) buffDisplay.style.color = "#ffff00"; else buffDisplay.style.color = "#ff0055";
    }

    state.score += e.scoreVal;
    if (e.type === 'boss_omega' || e.type === 'boss_seraph') {
        if (e.type === 'boss_omega') {
            state.bossActive = false;
            state.sacred.unlocked = true;
            showWaveNotification("SACRED IMPLEMENT UNLOCKED: PRESS Q");
            state.enemiesKilledInWave++;
            updateHUD();
            checkWaveProgress();
        } else {
            gameOver(true);
        }
    }
    else {
        state.enemiesKilledInWave++;
        updateHUD();
        checkWaveProgress();
    }
}

const stdGeo = new THREE.DodecahedronGeometry(0.7);
const stdMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.2, metalness: 0.8, emissive: 0xff5500, emissiveIntensity: 5 });
const swarmGeo = new THREE.IcosahedronGeometry(0.4);
const swarmMat = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.1, metalness: 0.9, emissive: 0xffff00, emissiveIntensity: 5 });
const jugGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const jugMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.3, metalness: 0.7, emissive: 0x0000ff, emissiveIntensity: 5 });
const wraithGeo = new THREE.ConeGeometry(0.5, 1.5, 4);
const wraithMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 3, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
const titanGeo = new THREE.BoxGeometry(2, 3, 2);
const titanMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.5, emissive: 0x880000, emissiveIntensity: 4 });

const bossGeo = new THREE.TorusKnotGeometry(3, 1, 100, 16);
const bossMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 8, wireframe: true, transparent: true, opacity: 0.9 });
const seraphGeo = new THREE.OctahedronGeometry(4, 2);
const seraphMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 8, wireframe: true, transparent: true, opacity: 0.9 });

const enemies = [];
function spawnEnemy() {
    if (state.bossActive) return;
    const waveIdx = Math.min(state.wave - 1, WAVES.length - 1); const waveData = WAVES[waveIdx];
    if (enemies.length >= CFG.MAX_ACTIVE_ENEMIES) return; if (state.enemiesSpawnedInWave >= waveData.count) return;

    // Check for Boss Wave types explicitly
    if (waveData.types.includes('boss_omega')) { spawnBoss('boss_omega'); state.enemiesSpawnedInWave++; return; }
    if (waveData.types.includes('boss_seraph')) { spawnBoss('boss_seraph'); state.enemiesSpawnedInWave++; return; }

    const pos = findSafeSpawn(); pos.y = 15; const type = waveData.types[Math.floor(Math.random() * waveData.types.length)];
    let mesh, hp, speed, scoreVal, baseColor;

    if (type === 'swarmer') { mesh = new THREE.Mesh(swarmGeo, swarmMat); hp = 2; speed = 45; scoreVal = 50; baseColor = 0xffff00; }
    else if (type === 'heavy') { mesh = new THREE.Mesh(jugGeo, jugMat); hp = 51; speed = 15; scoreVal = 300; baseColor = 0x0000ff; }
    else if (type === 'wraith') { mesh = new THREE.Mesh(wraithGeo, wraithMat); mesh.geometry.rotateX(Math.PI / 2); hp = 10; speed = 50; scoreVal = 150; baseColor = 0x00ff00; }
    else if (type === 'titan') { mesh = new THREE.Mesh(titanGeo, titanMat); hp = 100; speed = 10; scoreVal = 500; baseColor = 0xff0000; }
    else { mesh = new THREE.Mesh(stdGeo, stdMat); hp = 4; speed = 35; scoreVal = 100; baseColor = 0xff5500; }

    const g = new THREE.Group(); g.add(mesh); g.position.copy(pos); scene.add(g);
    enemies.push({ group: g, hp: hp, maxHp: hp, vel: new THREE.Vector3(), path: [], pathTimer: 0, type: type, speed: speed, scoreVal: scoreVal, dead: false, baseColor: baseColor, stunTimer: 0, halo: null });
    state.enemiesSpawnedInWave++;
}

function spawnBoss(type) {
    state.bossActive = true;
    const pos = new THREE.Vector3(0, 40, 0);
    let mesh, hp, scoreVal, color;

    if (type === 'boss_seraph') {
        mesh = new THREE.Mesh(seraphGeo, seraphMat);
        hp = 3000; scoreVal = 10000; color = 0xff5500;
    } else {
        mesh = new THREE.Mesh(bossGeo, bossMat);
        hp = 1500; scoreVal = 5000; color = 0x5500ff;
    }

    const g = new THREE.Group(); g.add(mesh); g.position.copy(pos); scene.add(g);

    const e = {
        group: g, hp: hp, maxHp: hp, vel: new THREE.Vector3(), path: [], pathTimer: 0,
        type: type, speed: 25, scoreVal: scoreVal, dead: false, baseColor: color,
        attackTimer: 0, strikeTimer: 0, stunTimer: 0, halo: null, buildingTimer: 0
    };

    enemies.push(e);

    document.getElementById('boss-container').style.display = 'block';
    document.getElementById('boss-label').innerText = type === 'boss_seraph' ? "SERAPH CLASS THREAT" : "OMEGA CLASS THREAT";
    document.getElementById('boss-fill').style.background = type === 'boss_seraph' ? "#ffaa00" : "#ff00ff";
    showWaveNotification("WARNING: " + (type === 'boss_seraph' ? "SERAPH" : "OMEGA") + " DETECTED");
}

function detachBuilding(gx, gz) {
    const idx = buildingMap[gx + gz * CFG.GRID];
    if (idx === -1) return;

    buildingsMesh.getMatrixAt(idx, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    if (dummy.scale.y <= 0.1) return;

    // Create projectile mesh
    const geo = new THREE.BoxGeometry(CFG.CELL, 1, CFG.CELL);
    geo.translate(0, 0.5, 0); // Keep origin at bottom
    const mat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0x00ffff,
        emissiveMap: buildingTex,
        emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(dummy.position);
    mesh.scale.copy(dummy.scale);
    scene.add(mesh);

    thrownBuildings.push({ mesh: mesh, phase: 'rise', time: 0, vel: new THREE.Vector3() });

    // Hide original
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    buildingsMesh.setMatrixAt(idx, dummy.matrix);
    buildingsMesh.instanceMatrix.needsUpdate = true;
    worldHeights[gx][gz] = 0;
}

function spawnOrbitalStrike(pos, type = 'boss') {
    let mesh;
    if (type === 'sacred') {
        // SACRED STRIKE: GIANT PURPLE SPEAR
        const geo = new THREE.CylinderGeometry(0.8, 0.1, 60, 8); // Tapered cylinder looks like a spike/spear
        geo.translate(0, 30, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
    } else {
        // BOSS STRIKE: RED CYLINDER
        const geo = new THREE.CylinderGeometry(4, 4, 100, 16);
        geo.translate(0, 50, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.copy(pos);
    mesh.position.y = Math.max(0, pos.y - 1);
    scene.add(mesh);
    orbitalStrikes.push({ mesh: mesh, pos: mesh.position.clone(), time: 0, detonated: false, type: type });

    if (type === 'sacred') Audio.playSound('sacred_fire');
    else Audio.playSound('charge');
}

function checkWallProximity(pos, radius) {
    const cx = Math.floor((pos.x / CFG.CELL) + CFG.GRID / 2); const cz = Math.floor((pos.z / CFG.CELL) + CFG.GRID / 2); const checkRad = radius + 1.0;
    for (let x = -1; x <= 1; x++) { for (let z = -1; z <= 1; z++) { const gx = cx + x; const gz = cz + z; if (gx >= 0 && gx < CFG.GRID && gz >= 0 && gz < CFG.GRID) { const h = worldHeights[gx][gz]; if (h > 0 && pos.y < h - 0.5) { const minX = (gx - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2; const maxX = minX + CFG.CELL; const minZ = (gz - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2; const maxZ = minZ + CFG.CELL; const closeX = Math.max(minX, Math.min(maxX, pos.x)); const closeZ = Math.max(minZ, Math.min(maxZ, pos.z)); const dx = pos.x - closeX; const dz = pos.z - closeZ; const distSq = dx * dx + dz * dz; if (distSq < checkRad * checkRad) { const dist = Math.sqrt(distSq); if (dist < 0.0001) return new THREE.Vector3(1, 0, 0); return new THREE.Vector3(dx / dist, 0, dz / dist); } } } } } return null;
}
function solveCollisions(pos, vel, radius) {
    // ONLY horizontal side collisions (unchanged)
    const cx = Math.floor((pos.x / CFG.CELL) + CFG.GRID / 2);
    const cz = Math.floor((pos.z / CFG.CELL) + CFG.GRID / 2);
    player.wallNormal.set(0, 0, 0);

    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            const gx = cx + x; const gz = cz + z;
            if (gx < 0 || gx >= CFG.GRID || gz < 0 || gz >= CFG.GRID) continue;
            const h = worldHeights[gx][gz];
            if (h > 0 && pos.y < h - 0.5) {
                const minX = (gx - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2;
                const maxX = minX + CFG.CELL;
                const minZ = (gz - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2;
                const maxZ = minZ + CFG.CELL;
                const closeX = Math.max(minX, Math.min(maxX, pos.x));
                const closeZ = Math.max(minZ, Math.min(maxZ, pos.z));
                const dx = pos.x - closeX;
                const dz = pos.z - closeZ;
                const distSq = dx * dx + dz * dz;
                if (distSq < radius * radius && distSq > 0.00001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = radius - dist;
                    const nx = dx / dist; const nz = dz / dist;
                    pos.x += nx * overlap;
                    pos.z += nz * overlap;
                    const vDotN = vel.x * nx + vel.z * nz;
                    if (vDotN < 0) {
                        vel.x -= nx * vDotN;
                        vel.z -= nz * vDotN;
                    }
                    player.wallNormal.set(nx, 0, nz);
                }
            }
        }
    }
}

function updatePhysics(dt) {
    if (isNaN(player.pos.x)) player.pos.set(0, 50, 0);
    state.wallRun.active = false; state.wallRun.climbing = false;
    if (state.modes.timeStop) { player.vel.set(0, 0, 0); return; }

    player.vel.x -= player.vel.x * 8.0 * dt;
    player.vel.z -= player.vel.z * 8.0 * dt;
    let speed = CFG.SPEED;
    if (input.sprint && state.stamina > 0 && state.canSprint) speed = CFG.SPRINT_SPEED;
    if (state.infinityActive) speed *= 1.5;

    if (state.grapple.active) {
        const dir = new THREE.Vector3().subVectors(state.grapple.pos, player.pos).normalize();
        player.vel.lerp(dir.multiplyScalar(CFG.GRAPPLE_SPEED), dt * 5.0);
        if (player.vel.y < 0) player.vel.y *= 0.9;
    } else {
        player.vel.y -= CFG.GRAV * dt;
    }
    if (state.infinityActive && player.vel.y < 0) player.vel.y = 0;

    player.pos.addScaledVector(player.vel, dt);
    player.ground = false;

    // === FIXED GROUND LANDING – NO MORE RANDOM TELEPORTS ===
    const GROUND_CHECK_RADIUS = 0.35;
    const SNAP_HEIGHT_TOLERANCE = 3.0;   // ← NEW: only snap if you're actually falling near the roof
    const cx = Math.floor((player.pos.x / CFG.CELL) + CFG.GRID / 2);
    const cz = Math.floor((player.pos.z / CFG.CELL) + CFG.GRID / 2);
    let landed = false;

    for (let dx = -1; dx <= 1 && !landed; dx++) {
        for (let dz = -1; dz <= 1 && !landed; dz++) {
            const gx = cx + dx; const gz = cz + dz;
            if (gx < 0 || gx >= CFG.GRID || gz < 0 || gz >= CFG.GRID) continue;
            const h = worldHeights[gx][gz];
            if (h > 0) {
                const minX = (gx - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2;
                const maxX = minX + CFG.CELL;
                const minZ = (gz - CFG.GRID / 2) * CFG.CELL - CFG.CELL / 2;
                const maxZ = minZ + CFG.CELL;

                if (player.pos.x > minX - GROUND_CHECK_RADIUS && player.pos.x < maxX + GROUND_CHECK_RADIUS &&
                    player.pos.z > minZ - GROUND_CHECK_RADIUS && player.pos.z < maxZ + GROUND_CHECK_RADIUS &&
                    player.pos.y > h - SNAP_HEIGHT_TOLERANCE &&   // ← ONLY snap when close above the roof
                    player.pos.y < h + 0.2 &&
                    player.vel.y <= 0) {
                    player.pos.y = h;
                    player.vel.y = 0;
                    player.ground = true;
                    landed = true;
                }
            }
        }
    }

    // Side collisions only
    for (let i = 0; i < 3; i++) solveCollisions(player.pos, player.vel, CFG.PLAYER_R);

    // Wall-run logic (unchanged)
    const wallNorm = checkWallProximity(player.pos, CFG.PLAYER_R);
    if (wallNorm && !player.ground && input.jump) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); fwd.y = 0; fwd.normalize();
        const dot = fwd.dot(wallNorm);
        if (dot < -0.7) {
            state.wallRun.climbing = true;
            state.wallRun.normal.copy(wallNorm);
            player.vel.y = CFG.WALL_CLIMB_SPEED;
            player.pos.addScaledVector(wallNorm, 0.1);
            player.vel.x = 0; player.vel.z = 0;
        } else {
            state.wallRun.active = true;
            state.wallRun.normal.copy(wallNorm);
            player.vel.y = 0;
            const up = new THREE.Vector3(0, 1, 0);
            const wallTangent = new THREE.Vector3().crossVectors(wallNorm, up).normalize();
            if (wallTangent.dot(fwd) < 0) wallTangent.negate();
            player.vel.copy(wallTangent.multiplyScalar(CFG.SPRINT_SPEED));
            const wallRight = new THREE.Vector3().crossVectors(wallNorm, up);
            const side = fwd.dot(wallRight);
            state.wallRun.side = (side > 0) ? 1 : -1;
        }
        input.jump = false;
    }

    if (player.pos.y < 0) { player.pos.y = 0; player.vel.y = 0; player.ground = true; }
    const lim = CFG.LIMIT - 1;
    player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
    player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));
}
function takeDamage(amount) {
    if (state.modes.dev || state.infinityActive) return; // INFINITY NO DAMAGE

    let actualDmg = amount;

    // CALIBURN GLASS CANNON
    if (state.currentWeapon.id === 5 && state.buff.active) {
        actualDmg *= state.buff.multiplier;
    }

    const potentialHp = state.hp - actualDmg;

    if (potentialHp <= 0) {
        // One Shot Protection
        if (state.hp > 25) {
            state.hp = 1;
        } else {
            state.hp = potentialHp; // Die
        }
    } else {
        state.hp = potentialHp;
    }

    // Reset Buff on Damage Taken
    if (state.buff.active) {
        state.buff.active = false;
        state.buff.multiplier = 1.0;
        const bc = document.getElementById('buff-container');
        const rw = document.getElementById('risk-warning');
        if (bc) bc.style.display = 'none';
        if (rw) rw.style.display = 'none';
        const bv = document.getElementById('buff-val');
        if (bv) bv.innerText = "1.0x";
    }

    updateHUD();
    Audio.playSound('hit');
    state.shake = Math.min(state.shake + 0.5, 1.5);
    const vignette = document.getElementById('damage-vignette'); vignette.style.opacity = 1; setTimeout(() => vignette.style.opacity = 0, 300);
    if (state.hp <= 0) gameOver(false);
}
const raycaster = new THREE.Raycaster();
function fireGrapple() { if (state.grapple.cd > 0 || state.grapple.active) return; raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const intersects = raycaster.intersectObjects([buildingsMesh, scene.children.find(c => c.geometry && c.geometry.type === 'PlaneGeometry')], false); if (intersects.length > 0) { state.grapple.active = true; state.grapple.pos.copy(intersects[0].point); grappleLine.visible = true; player.vel.y += 5; Audio.playSound('grapple'); } }
function releaseGrapple() { if (state.grapple.active) { state.grapple.active = false; grappleLine.visible = false; state.grapple.cd = CFG.GRAPPLE_CD; updateGrappleUI(); } }
function updateGrapple(dt) { if (state.grapple.cd > 0) { state.grapple.cd -= dt; if (state.grapple.cd <= 0) { state.grapple.cd = 0; updateGrappleUI(); } else { document.getElementById('grapple-status').innerText = Math.ceil(state.grapple.cd) + "s"; document.getElementById('grapple-status').className = "cooldown"; } } else { if (!state.grapple.active) { document.getElementById('grapple-status').innerText = "READY"; document.getElementById('grapple-status').className = ""; } } if (state.grapple.active) { const positions = grappleLine.geometry.attributes.position.array; const start = new THREE.Vector3(0.35, -0.3, -0.5).applyQuaternion(camera.quaternion).add(camera.position); positions[0] = start.x; positions[1] = start.y; positions[2] = start.z; positions[3] = state.grapple.pos.x; positions[4] = state.grapple.pos.y; positions[5] = state.grapple.pos.z; grappleLine.geometry.attributes.position.needsUpdate = true; document.getElementById('grapple-status').innerText = "ENGAGED"; document.getElementById('grapple-status').className = ""; } }
function updateGrappleUI() { }
function triggerHitMarker() { const hm = document.getElementById('hitmarker'); hm.style.opacity = '1'; hm.style.transform = 'rotate(45deg) scale(1.2)'; setTimeout(() => { hm.style.opacity = '0'; hm.style.transform = 'rotate(45deg) scale(0.8)'; }, 100); }
function updateHUD() {
    document.getElementById('score-cnt').innerText = "SCORE: " + state.score; document.getElementById('ammo-cnt').innerText = state.reloading ? "RLD" : state.ammo;
    const fill = document.getElementById('health-fill'); fill.style.width = Math.max(0, state.hp) + "%"; fill.style.backgroundPosition = (state.hp) + "% 0";
    document.getElementById('wave-cnt').innerText = state.bossActive ? "BOSS FIGHT" : "WAVE " + state.wave;
    const sFill = document.getElementById('stamina-fill'); sFill.style.width = (state.stamina / CFG.SPRINT_MAX * 100) + "%"; sFill.style.background = state.canSprint ? "#00ffff" : "#ff0000";
    const cFill = document.getElementById('charge-fill'); const cBg = document.getElementById('charge-bar-bg');
    if (state.currentWeapon.alt === 'grenade' || state.currentWeapon.type === 'beam' || state.currentWeapon.alt === 'timestop') {
        cBg.style.display = 'block';
        if (state.currentWeapon.alt === 'grenade') { const ratio = 1 - (state.grenadeCooldown / 8.0); cFill.style.width = (Math.max(0, ratio) * 100) + "%"; cFill.style.background = state.grenadeCooldown > 0 ? "#555" : state.grenadeCharge > 0 ? "#ffaa00" : "#00ffff"; }
        else if (state.currentWeapon.alt === 'timestop') { const ratio = 1 - (state.dantes.cooldown / 30.0); cFill.style.width = (Math.max(0, ratio) * 100) + "%"; cFill.style.background = state.dantes.cooldown > 0 ? "#555" : "#ffffff"; }
        else cFill.style.width = (state.beamCharge * 100) + "%";
    } else { cBg.style.display = 'none'; }

    // Sacred HUD
    if (state.sacred.active) {
        document.getElementById('sacred-ui').style.display = 'block';
        document.getElementById('sacred-ammo').innerText = state.sacred.ammo;
    } else {
        document.getElementById('sacred-ui').style.display = 'none';
    }

    // Infinity HUD
    if (state.infinityActive) {
        document.getElementById('infinity-ui').style.display = 'block';
    } else {
        document.getElementById('infinity-ui').style.display = 'none';
    }

    updateRadar();

    // Fifth Magic HUD
    const circle = document.getElementById('magic-circle');
    if (state.currentWeapon.type === 'magic' && input.alt) {
        circle.style.display = 'flex';
        // Update rune display
        document.getElementById('rune-1').innerText = state.fifthMagic.buffer[0] || '';
        document.getElementById('rune-2').innerText = state.fifthMagic.buffer[1] || '';
        document.getElementById('rune-3').innerText = state.fifthMagic.buffer[2] || '';
    } else {
        circle.style.display = 'none';
    }
}
function showWaveNotification(text) { const el = document.getElementById('wave-notification'); el.innerText = text; el.style.opacity = 1; setTimeout(() => el.style.opacity = 0, 3000); }
function checkWaveProgress() { if (state.bossActive) return; if (enemies.length === 0 && state.enemiesKilledInWave > 0) { const waveIdx = Math.min(state.wave - 1, WAVES.length - 1); const waveData = WAVES[waveIdx]; if (state.enemiesKilledInWave >= waveData.count) { if (state.wave < 10) { state.wave++; state.enemiesSpawnedInWave = 0; state.enemiesKilledInWave = 0; showWaveNotification("WAVE " + state.wave + " INITIALIZED"); } else { spawnBoss('boss_seraph'); } } } }
function gameOver(win) { state.active = false; document.exitPointerLock(); const overlay = document.getElementById('overlay'); overlay.style.display = 'flex'; overlay.innerHTML = `<h1 style="color:${win ? '#0f0' : '#f00'}">${win ? 'MISSION COMPLETE' : 'SYSTEM FAILURE'}</h1><p style="color:#fff">${win ? 'WARLORD DEFEATED. SCORE: ' + state.score : 'REBOOT REQUIRED'}</p><button id="reset-btn" class="btn" style="margin-top:30px; border-color:#fff; color:#fff">REBOOT SYSTEM</button>`; document.getElementById('reset-btn').onclick = () => location.reload(); }

// LAZARUS UPGRADE LOGIC
function upgradeLazarus() {
    const tiers = [4, 6, 8, 10, 12, 20];
    const currentIndex = tiers.indexOf(state.lazarus.tier);

    if (currentIndex < tiers.length - 1) {
        state.lazarus.tier = tiers[currentIndex + 1];
        state.currentWeapon.ammo = state.lazarus.tier;
        buildWeaponModel(3);
        showWaveNotification("DIE UPGRADED: D" + state.lazarus.tier);
        Audio.playSound('charge');
    } else {
        state.lazarus.speedBoost = 4.0;
        showWaveNotification("JACKPOT! SPEED UP!");
        Audio.playSound('charge');
    }
}

function spawnHalo(enemy) {
    if (enemy.halo) return;
    const torusGeo = new THREE.TorusGeometry(1.0, 0.1, 8, 16);
    torusGeo.rotateX(Math.PI / 2);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const halo = new THREE.Mesh(torusGeo, torusMat);
    halo.position.y = 2.0;
    enemy.group.add(halo);
    enemy.halo = halo;
}

function fireSacredSpear() {
    if (state.sacred.ammo <= 0) return;

    // FIX: Add fireTimer to prevent ammo dump
    fireTimer = 0.5;
    state.sacred.ammo--;

    // Remove visual spear from group
    if (sacredGroup && sacredGroup.children.length > state.sacred.ammo) {
        sacredGroup.children[state.sacred.ammo].visible = false;
    }

    Audio.playSound('sacred_fire');

    // Spawn projectile
    const geo = new THREE.ConeGeometry(0.3, 4.0, 8); // BIGGER
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2 });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.copy(camera.position).add(new THREE.Vector3(0, -0.5, 0));
    mesh.quaternion.copy(camera.quaternion);

    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(60); // Slow projectile

    scene.add(mesh);
    sacredProjectiles.push({ mesh: mesh, vel: vel, life: 3.0 });

    if (state.sacred.ammo <= 0) {
        // TRIGGER RETRIBUTION
        setTimeout(() => {
            enemies.forEach(e => {
                if (e.halo && !e.dead) {
                    spawnOrbitalStrike(e.group.position, 'sacred');
                    takeDamage(0); // Just for visuals/shake
                    e.hp -= 25; // Divine Damage
                    if (e.hp <= 0) killEnemy(e, true);
                    e.group.remove(e.halo);
                    e.halo = null;
                }
            });

            // Reload after delay
            setTimeout(() => {
                state.sacred.ammo = 3;
                if (sacredGroup) sacredGroup.children.forEach(c => c.visible = true);
                Audio.playSound('charge');
                updateHUD();
            }, 2000);
        }, 500);
    }
    updateHUD();
}

// --- FIFTH MAGIC SPELL LOGIC ---
function castFifthMagic() {
    const combo = state.fifthMagic.buffer.join('');
    state.fifthMagic.buffer = [];

    Audio.playSound('sacred_fire');

    if (combo === 'WWW') {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const b = bullets.find(b => !b.active);
                if (b) {
                    b.active = true; b.life = 2.0; b.mesh.visible = true;
                    b.mesh.material.color.setHex(0xff0000);
                    b.mesh.scale.set(0.5, 0.5, 4.0);
                    b.homing = true;

                    // ← FIXED: spawn in front of camera + correct orientation
                    b.mesh.position.copy(camera.position).add(
                        new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, -2)
                            .applyQuaternion(camera.quaternion)
                    );
                    b.prevPos.copy(b.mesh.position);
                    b.mesh.quaternion.copy(camera.quaternion);

                    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                    b.vel.copy(dir).multiplyScalar(80);
                }
            }, i * 50);
        }
    } else if (combo === 'SSS') {
        spawnOrbitalStrike(player.pos.clone().add(new THREE.Vector3(0, 0, -10).applyQuaternion(camera.quaternion)));
    } else if (combo === 'ADA') {
        const geo = new THREE.SphereGeometry(3, 32, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(camera.position).add(
            new THREE.Vector3(0, 0, -5).applyQuaternion(camera.quaternion)
        );
        const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(20);
        scene.add(mesh);
        bullets.push({
            mesh: mesh, active: true, life: 5.0, vel: vel,
            isHollowPurple: true, prevPos: mesh.position.clone(), super: true
        });
        // (no quaternion needed for sphere)
    } else if (combo === 'WSD') {
        state.hp = 100;
        enemies.forEach(e => e.stunTimer = 5.0);
        showWaveNotification("TIME REVERSED: HP RESTORED");
        Audio.playSound('charge');
    } else {
        // DEFAULT BLUE BEAM – this was the main “statically locked” one
        const b = bullets.find(b => !b.active);
        if (b) {
            b.active = true; b.life = 2.0; b.mesh.visible = true;
            b.mesh.material.color.setHex(0x00ffff);
            b.mesh.scale.set(1, 1, 5);
            b.homing = false;

            // ← FIXED: spawn from gun position + correct orientation
            b.mesh.position.copy(camera.position).add(
                new THREE.Vector3(0.35, -0.25, -1.5).applyQuaternion(camera.quaternion)
            );
            b.prevPos.copy(b.mesh.position);
            b.mesh.quaternion.copy(camera.quaternion);   // ← this was missing!

            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            b.vel.copy(dir).multiplyScalar(150);
        }
    }
}

function fireWeapon(superCharge) {
    if (state.sacred.active) {
        fireSacredSpear();
        return;
    }

    // MELEE (CALIBURN)
    if (state.currentWeapon.type === 'melee') {
        if (!state.melee.swinging) {
            const now = clock.elapsedTime;
            if (now < state.melee.nextAttackTime) return;
            state.melee.swinging = true;
            state.melee.swingTime = 0;
            state.melee.hitCalculated = false;
            Audio.playSound('swing_sword');
        }
        return;
    }

    // FIFTH MAGIC (Cast on Release or Click in normal mode?)
    // We handle the cast in the Input Logic mostly, but standard fire is here
    if (state.currentWeapon.type === 'magic') {
        castFifthMagic();
        fireTimer = 0.2;
        return;
    }

    // HITSCAN CHECK (RADIANCE)
    if (state.currentWeapon.type === 'beam') {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const targets = []; enemies.forEach(e => targets.push(e.group));
        const hits = raycaster.intersectObjects(targets, true);
        hitscanBeam.geometry.attributes.position.setXYZ(0, gunGroup.position.x + player.pos.x, gunGroup.position.y + player.pos.y, gunGroup.position.z + player.pos.z);
        let endPos;
        if (hits.length > 0) {
            endPos = hits[0].point;
            const enemyGroup = hits[0].object.parent;
            const enemy = enemies.find(e => e.group === enemyGroup);
            if (enemy) {
                let dmg = superCharge ? 50 : 0.5;
                if (state.buff.active) dmg *= state.buff.multiplier;
                enemy.hp -= state.modes.dev ? 9999 : dmg;
                triggerHitMarker(); Audio.playSound('hit');
                if (enemy.hp <= 0) killEnemy(enemy, true);
            }
        } else {
            const r = new THREE.Ray(camera.position, new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
            endPos = r.at(500, new THREE.Vector3());
        }
        const start = new THREE.Vector3(0.35, -0.3, -0.5).applyQuaternion(camera.quaternion).add(camera.position);
        const positions = hitscanBeam.geometry.attributes.position.array;
        positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
        positions[3] = endPos.x; positions[4] = endPos.y; positions[5] = endPos.z;
        hitscanBeam.geometry.attributes.position.needsUpdate = true;
        hitscanBeam.visible = true; hitscanBeam.material.opacity = 1.0;
        hitscanBeam.material.color.setHex(state.currentWeapon.color);
        Audio.playSound(state.currentWeapon.sfx);
        if (!state.modes.dev) state.ammo--; updateHUD(); if (state.ammo <= 0) reload();
        return;
    }

    // GOJO HOLLOW PURPLE
    if (state.currentWeapon.type === 'gojo') {
        fireTimer = 1.5; // Slow fire rate
        Audio.playSound('charge');

        const geo = new THREE.SphereGeometry(1, 32, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x8800ff });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.copy(camera.position).add(new THREE.Vector3(0, 0, -2).applyQuaternion(camera.quaternion));

        const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(15); // Slow moving

        scene.add(mesh);
        bullets.push({
            mesh: mesh, active: true, life: 10.0, vel: vel,
            isHollowPurple: true, prevPos: mesh.position.clone()
        });
        return;
    }

    // LAZARUS & STANDARD BULLETS
    fireTimer = state.currentWeapon.rate;
    if (state.currentWeapon.type === 'lazarus' && state.lazarus.speedBoost > 0) fireTimer *= 0.5;

    if (!state.modes.dev) state.ammo--;
    updateHUD();
    Audio.playSound(state.currentWeapon.sfx);
    gunLight.intensity = 8; gunGroup.position.z += state.currentWeapon.recoil; state.shake = state.currentWeapon.recoil;

    if (state.currentWeapon.id === 4) {
        state.dantes.side = 1 - state.dantes.side;
        const mesh = gunGroup.children[0];
        if (mesh && mesh.children.length >= 2) {
            const activeGun = state.dantes.side === 0 ? mesh.children[0] : mesh.children[1];
            activeGun.position.z += 0.2; activeGun.rotation.x = 0;
        }
    }

    // LAZARUS UPGRADE CHECK
    if (state.currentWeapon.type === 'lazarus') {
        if (Math.random() < 0.04) {
            upgradeLazarus();
        }
    }

    for (let i = 0; i < state.currentWeapon.count; i++) {
        const b = bullets.find(b => !b.active);
        if (b) {
            b.active = true;
            b.life = 1.5;
            b.mesh.visible = true;
            b.mesh.material.color.setHex(state.currentWeapon.color);
            b.mesh.scale.set(state.currentWeapon.scale[0], state.currentWeapon.scale[1], state.currentWeapon.scale[2]);

            // LAZARUS FLAGS
            if (state.currentWeapon.type === 'lazarus') {
                b.homing = Math.random() < 0.24;
                b.stun = Math.random() < 0.24;
                b.knockback = Math.random() < 0.24;
                b.ricochet = Math.random() < 0.24;
                if (b.homing) b.mesh.material.color.setHex(0xff00ff);
            } else {
                b.homing = false; b.stun = false; b.knockback = false; b.ricochet = false;
            }

            if (superCharge) { b.mesh.scale.set(4, 4, 40); b.super = true; } else b.super = false;

            // Set Initial Position and store prevPos
            let offset = new THREE.Vector3(0.35, -0.25, -1);
            if (state.currentWeapon.id === 4) { offset.x = (state.dantes.side === 0) ? -0.5 : 0.5; offset.y = -0.2; }

            b.mesh.position.copy(camera.position).add(offset.applyQuaternion(camera.quaternion));
            b.mesh.quaternion.copy(camera.quaternion);
            b.prevPos.copy(b.mesh.position); // INITIALIZE PREV POS

            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            dir.add(new THREE.Vector3((Math.random() - 0.5) * state.currentWeapon.spread, (Math.random() - 0.5) * state.currentWeapon.spread, 0));
            b.vel.copy(dir).multiplyScalar(100);
            b.isHollowPurple = false; // Ensure regular bullets aren't purple
        }
    }
    if (state.ammo <= 0) reload();
}

function reload() {
    state.reloading = true; updateHUD(); gunGroup.rotation.x = 1.0;
    setTimeout(() => {
        if (state.currentWeapon.type === 'lazarus') {
            const roll = Math.floor(Math.random() * state.lazarus.tier) + 1;
            state.ammo = roll;
            showWaveNotification("RELOAD ROLL: " + roll);
        } else {
            state.ammo = state.currentWeapon.ammo;
        }
        state.reloading = false; updateHUD(); gunGroup.rotation.x = 0;
    }, state.currentWeapon.reloadTime * 1000);
}

const clock = new THREE.Clock(); let fireTimer = 0; let pathUpdateIdx = 0;

// --------------------------------------------------------------------------------
// ANIMATE LOOP - FIXED BRACES AND LOGIC
// --------------------------------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);
    const realDt = Math.min(clock.getDelta(), 0.1); const dt = state.modes.timeStop ? 0 : (realDt * state.timeScale);
    particles.forEach(p => { if (!p.active) return; if (!state.modes.timeStop) { p.mesh.position.addScaledVector(p.vel, dt); p.life -= dt; p.mesh.scale.setScalar(p.life * 2); if (p.life <= 0) { p.active = false; p.mesh.visible = false; } } });
    if (!state.active) { renderer.render(scene, camera); return; }

    if (state.buff.active) { state.buff.time -= realDt; if (state.buff.time <= 0) { state.buff.active = false; state.buff.multiplier = 1.0; } }
    if (state.lazarus.speedBoost > 0) state.lazarus.speedBoost -= realDt;

    // Sacred Input Toggle
    if (input.sacred && state.sacred.unlocked && !state.sacred.toggleLock) {
        state.sacred.active = !state.sacred.active;
        state.sacred.toggleLock = true;
        if (state.sacred.active) {
            buildSacredModel();
            gunGroup.visible = false;
        } else {
            if (sacredGroup) { camera.remove(sacredGroup); sacredGroup = null; }
            gunGroup.visible = true;
        }
        updateHUD();
    }
    if (!input.sacred) state.sacred.toggleLock = false;

    // FIFTH MAGIC INPUT LOGIC
    if (state.currentWeapon.type === 'magic' && input.alt) {
        state.fifthMagic.casting = true;
        // Inputs handled in event listener mostly, but we clear fire here?
        // No, just prevent movement
    } else {
        state.fifthMagic.casting = false;
        state.fifthMagic.buffer = []; // Reset if released
    }

    // ANIMATIONS & WEAPON LOGIC
    if (currentGunMesh && !state.sacred.active) {
        if (state.currentWeapon.type === 'lazarus') {
            const die = currentGunMesh.getObjectByName('lazarus_die');
            if (die) { die.rotation.x += realDt; die.rotation.y += realDt * 1.5; }
        }

        if (state.currentWeapon.type === 'gojo') {
            const mesh = currentGunMesh.getObjectByName('gojo_weapon');
            if (mesh) {
                mesh.rotation.z += realDt;
                mesh.rotation.x += realDt * 0.5;
            }
        }

        if (state.currentWeapon.type === 'magic') {
            const mesh = currentGunMesh.getObjectByName('fifth_magic_weapon');
            if (mesh) {
                mesh.rotation.z -= realDt * 2;
                if (state.fifthMagic.casting) {
                    mesh.scale.setScalar(1.5);
                    mesh.rotation.x += realDt * 5;
                } else {
                    mesh.scale.setScalar(1.0);
                    mesh.rotation.x = 0;
                }
            }
        }

        if (state.currentWeapon.id === 5) {
            const pivot = currentGunMesh.getObjectByName('sword_pivot');
            if (pivot) {
                const now = clock.elapsedTime;
                if (!state.melee.swinging) {
                    if (now < state.melee.nextAttackTime) { document.getElementById('crosshair').style.borderColor = '#ff0000'; }
                    else { document.getElementById('crosshair').style.borderColor = '#00ff00'; }
                }
                if (state.melee.swinging) {
                    let speed = 2.5;
                    if (state.melee.combo === 2) speed = 2.0;
                    state.melee.swingTime += realDt * speed;
                    const t = Math.min(state.melee.swingTime, 1.0);
                    if (t > 0.3 && t < 0.6 && !state.melee.hitCalculated) {
                        state.melee.hitCalculated = true;
                        const range = 18; let angleThreshold = 0.2; if (state.melee.combo === 1) angleThreshold = 0.6;
                        enemies.forEach(e => {
                            if (e.dead) return;
                            if (e.group.position.distanceTo(player.pos) < range) {
                                const toEnemy = new THREE.Vector3().subVectors(e.group.position, player.pos).normalize();
                                const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                                let hit = false;
                                if (state.melee.combo === 2) {
                                    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                                    const dotSide = toEnemy.dot(side); const dotFwd = toEnemy.dot(fwd);
                                    if (dotFwd > 0.8 && Math.abs(dotSide) < 0.2) hit = true;
                                } else { if (toEnemy.dot(fwd) > angleThreshold) hit = true; }
                                if (hit) {
                                    let dmg = state.currentWeapon.damage; if (state.melee.combo === 2) dmg *= 2.5;
                                    if (state.buff.active) dmg *= state.buff.multiplier;
                                    e.hp -= state.modes.dev ? 999 : dmg; triggerHitMarker(); Audio.playSound('hit'); if (e.hp <= 0) killEnemy(e, true);
                                }
                            }
                        });
                    }
                    const qCurrent = new THREE.Quaternion(); const pCurrent = new THREE.Vector3();
                    if (state.melee.combo === 0) {
                        if (t < 0.2) { const prog = t / 0.2; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.5, 0.5)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 1.5, 0.5)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(0.5, -0.4, -0.5), new THREE.Vector3(0.6, 0.5, -0.4), prog); }
                        else if (t < 0.4) { const prog = (t - 0.2) / 0.2; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 1.5, 0.5)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.5, 1.5)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(0.6, 0.5, -0.4), new THREE.Vector3(-0.6, -0.6, -0.6), prog); }
                        else { const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.5, 1.5)); const pEnd = new THREE.Vector3(-0.6, -0.6, -0.6); qCurrent.copy(qEnd); pCurrent.copy(pEnd); }
                    }
                    else if (state.melee.combo === 1) {
                        if (t < 0.2) { const prog = t / 0.2; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.5, 1.5)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, -0.8, 1.8)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(-0.6, -0.6, -0.6), new THREE.Vector3(-0.7, -0.5, -0.5), prog); }
                        else if (t < 0.4) { const prog = (t - 0.2) / 0.2; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, -0.8, 1.8)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 1.2, 0)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(-0.7, -0.5, -0.5), new THREE.Vector3(0.7, 0.1, -0.6), prog); }
                        else { const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 1.2, 0)); const pEnd = new THREE.Vector3(0.7, 0.1, -0.6); qCurrent.copy(qEnd); pCurrent.copy(pEnd); }
                    }
                    else {
                        if (t < 0.3) { const prog = t / 0.3; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 1.2, 0)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.8, 0, 0)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(0.7, 0.1, -0.6), new THREE.Vector3(0, 0.8, -0.4), prog); }
                        else if (t < 0.5) { const prog = (t - 0.3) / 0.2; const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.8, 0, 0)); const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, 0)); qCurrent.slerpQuaternions(qA, qB, prog); pCurrent.lerpVectors(new THREE.Vector3(0, 0.8, -0.4), new THREE.Vector3(0, -0.8, -0.8), prog); }
                        else { qCurrent.setFromEuler(new THREE.Euler(1.2, 0, 0)); pCurrent.set(0, -0.8, -0.8); }
                    }
                    pivot.quaternion.copy(qCurrent); pivot.position.copy(pCurrent);
                    if (t >= 1.0) { state.melee.swinging = false; const now = clock.elapsedTime; if (state.melee.combo === 0) { state.melee.nextAttackTime = now + 0.5; state.melee.combo = 1; } else if (state.melee.combo === 1) { state.melee.nextAttackTime = now + 0.6; state.melee.combo = 2; } else { state.melee.nextAttackTime = now + 1.5; state.melee.combo = 0; } }
                } else {
                    const idleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.5, 0.5)); const idleP = new THREE.Vector3(0.5, -0.4, -0.5); pivot.quaternion.slerp(idleQ, realDt * 3); pivot.position.lerp(idleP, realDt * 3);
                }
            }
        }
        if (state.currentWeapon.id === 4) {
            const leftGun = currentGunMesh.getObjectByName('dantes_left'); const rightGun = currentGunMesh.getObjectByName('dantes_right');
            if (leftGun && rightGun) {
                state.dantes.idleTimer += realDt; let isIdle = false; if (state.dantes.idleTimer > 4.0 && state.dantes.idleTimer < 4.8) isIdle = true; if (state.dantes.idleTimer > 4.8) state.dantes.idleTimer = 0;
                if (fireTimer <= 0 && isIdle) { leftGun.rotation.x += realDt * 15; rightGun.rotation.x += realDt * 15; } else { if (state.dantes.side === 1) { rightGun.rotation.x = -0.5 * (fireTimer / 0.15); leftGun.rotation.x += (0 - leftGun.rotation.x) * 15 * realDt; } else { leftGun.rotation.x = -0.5 * (fireTimer / 0.15); rightGun.rotation.x += (0 - rightGun.rotation.x) * 15 * realDt; } } leftGun.position.z += (0 - leftGun.position.z) * 10 * realDt; rightGun.position.z += (0 - rightGun.position.z) * 10 * realDt;
            }
        }
    }

    // Update Sacred Visuals
    if (state.sacred.active && sacredGroup) { sacredGroup.rotation.z += realDt * 0.5; const bob = Math.sin(clock.elapsedTime * 2) * 0.05; sacredGroup.position.y = bob; }
    if (state.dantes.cooldown > 0) state.dantes.cooldown -= realDt;
    if (state.dantes.active) { state.dantes.activeTime -= realDt; if (state.dantes.activeTime <= 0) { state.dantes.active = false; state.modes.timeStop = false; document.getElementById('timestop-overlay').className = ""; state.dantes.cooldown = 30.0; } else { document.getElementById('timestop-overlay').className = "timestop-active"; } }

    // GOJO INFINITY
    if (state.currentWeapon.alt === 'infinity' && input.alt) {
        state.infinityActive = true;

        // Repel Logic
        enemies.forEach(e => {
            const dist = e.group.position.distanceTo(player.pos);
            if (dist < 10) {
                const pushDir = new THREE.Vector3().subVectors(e.group.position, player.pos).normalize();
                e.group.position.addScaledVector(pushDir, 30 * realDt); // Push back
                e.vel.set(0, 0, 0); // Freeze momentum
            }
        });
    } else {
        state.infinityActive = false;
    }

    if (input.alt) {
        if (state.currentWeapon.alt === 'grenade' && state.grenadeCooldown <= 0) { state.grenadeCharge = Math.min(state.grenadeCharge + dt, 1.0); }
        else if (state.currentWeapon.alt === 'scope') {
            state.isScoped = true; state.timeScale = 0.75; document.getElementById('scope-overlay').style.display = 'block';
            if (!state.modes.timeStop) {
                let bestTarget = null; let maxDot = 0.9; const LOCK_RANGE = 150; enemies.forEach(e => { if (e.group.position.distanceTo(player.pos) > LOCK_RANGE) return; const toEnemy = new THREE.Vector3().subVectors(e.group.position, player.pos).normalize(); const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); const dot = fwd.dot(toEnemy); if (dot > maxDot) { maxDot = dot; bestTarget = e; } });
                if (bestTarget) { const targetPos = bestTarget.group.position.clone(); camera.lookAt(targetPos); if (state.currentWeapon.type === 'beam') { state.beamCharge = Math.min(state.beamCharge + dt * 0.4, 1.0); if (state.beamCharge >= 1.0) { fireWeapon(true); state.beamCharge = 0; } } }
            }
        } else if (state.currentWeapon.alt === 'timestop') { if (state.dantes.cooldown <= 0 && !state.dantes.active) { state.dantes.active = true; state.dantes.activeTime = 4.0; state.modes.timeStop = true; state.dantes.canCancel = false; } else if (state.dantes.active && state.dantes.canCancel) { state.dantes.active = false; state.modes.timeStop = false; document.getElementById('timestop-overlay').className = ""; const refundRatio = state.dantes.activeTime / 4.0; const refund = refundRatio * (0.75 * 30.0); state.dantes.cooldown = 30.0 - refund; } }
    } else {
        if (state.currentWeapon.alt === 'grenade' && state.grenadeCharge > 0) { const g = grenades.find(x => !x.active); if (g) { g.active = true; g.mesh.visible = true; g.mesh.position.copy(player.pos).add(new THREE.Vector3(0, 1.5, 0)); const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); g.vel.copy(dir.multiplyScalar(15 + state.grenadeCharge * 30)); g.vel.y += 5; state.grenadeCooldown = 8.0; } state.grenadeCharge = 0; }
        if (state.currentWeapon.alt === 'scope') { state.isScoped = false; state.timeScale = 1.0; document.getElementById('scope-overlay').style.display = 'none'; }
        if (state.currentWeapon.alt === 'timestop' && state.dantes.active) { state.dantes.canCancel = true; }
    }

    if (state.currentWeapon.type === 'beam') { if (input.fire && !state.isScoped && !state.reloading) { state.beamCharge = Math.min(state.beamCharge + dt * 0.2, 1.0); Audio.playSound('charge'); } else if (!state.isScoped) { if (state.beamCharge > 0) { if (state.beamCharge > 0.3) fireWeapon(true); else fireWeapon(false); state.beamCharge = 0; } } }
    updateHUD();
    if (isNaN(camera.rotation.x)) camera.rotation.x = 0;
    camera.rotation.x -= input.pitch; camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x)); camera.rotation.y -= input.yaw; input.pitch = 0; input.yaw = 0;

    if (!state.modes.timeStop) {
        if (input.sprint && state.canSprint && !state.fifthMagic.casting) { // CANT SPRINT WHILE CASTING
            state.stamina -= dt; if (state.stamina <= 0) { state.stamina = 0; state.canSprint = false; state.sprintCooldown = CFG.SPRINT_COOLDOWN; }
        } else { if (!state.canSprint) { state.sprintCooldown -= dt; if (state.sprintCooldown <= 0) state.canSprint = true; } else { state.stamina = Math.min(state.stamina + dt * CFG.SPRINT_REGEN, CFG.SPRINT_MAX); } }
        if (state.grenadeCooldown > 0) state.grenadeCooldown -= dt;
        let targetRoll = 0; let targetFov = CFG.FOV_BASE; if (state.wallRun.active) { targetRoll = (state.wallRun.side === 1) ? 0.8 : -0.8; targetFov = CFG.FOV_WALL; } else if (input.sprint && state.canSprint) { targetFov = CFG.FOV_SPRINT; } if (state.isScoped) targetFov = CFG.FOV_SCOPE;
        state.cameraRoll += (targetRoll - state.cameraRoll) * 5.0 * dt; camera.rotation.z = state.cameraRoll; if (Math.abs(targetFov - camera.fov) > 0.1) { camera.fov += (targetFov - camera.fov) * 5.0 * dt; camera.updateProjectionMatrix(); }
        const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y); const right = new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y); const move = new THREE.Vector3(); if (input.fwd) move.addScaledVector(fwd, input.fwd); if (input.str) move.addScaledVector(right, input.str);

        if (state.fifthMagic.casting) move.set(0, 0, 0); // IMMOBILIZE IF CASTING

        let speed = CFG.SPEED; if (input.sprint && state.stamina > 0 && state.canSprint) speed = CFG.SPRINT_SPEED; if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed); player.vel.addScaledVector(move, dt * 10.0);
        if (input.jump) { if (player.ground) { let force = CFG.JUMP; if (input.sprint && state.canSprint && state.stamina > 0) { force *= 1.5 + (state.stamina / CFG.SPRINT_MAX) * 0.7; state.stamina = 0; state.canSprint = false; state.sprintCooldown = CFG.SPRINT_COOLDOWN; } player.vel.y = force; player.ground = false; Audio.playSound('jump'); input.jump = false; } else if (state.wallRun.active || state.wallRun.climbing) { player.vel.y = CFG.WALL_JUMP_FORCE; player.vel.addScaledVector(state.wallRun.normal, 30); state.wallRun.active = false; state.wallRun.climbing = false; Audio.playSound('jump'); input.jump = false; } }
        if (input.grapple && state.currentWeapon.alt === 'grapple') fireGrapple(); else releaseGrapple(); updateGrapple(dt); updatePhysics(dt);
    }
    input.jump = false; camera.position.copy(player.pos); camera.position.y += player.height;
    if (state.shake > 0) { camera.position.x += (Math.random() - 0.5) * state.shake; camera.position.y += (Math.random() - 0.5) * state.shake; state.shake = Math.max(0, state.shake - dt * 2); }
    gunGroup.position.z += (-0.5 - gunGroup.position.z) * 10 * realDt; if (state.currentWeapon.id !== 4 && state.currentWeapon.id !== 5) gunGroup.rotation.z = 0;
    if (gunLight.intensity > 0) gunLight.intensity -= realDt * 30;
    if (state.currentWeapon.id === 3 && input.fire) { const barrels = gunGroup.children[0].getObjectByName('barrels'); if (barrels) barrels.rotation.z += realDt * 20; }

    fireTimer -= realDt;
    if (input.fire && !state.reloading && state.ammo > 0 && fireTimer <= 0 && state.currentWeapon.type !== 'beam') { fireWeapon(false); } else if (input.fire && state.ammo <= 0 && state.currentWeapon.type !== 'melee') reload();

    grenades.forEach(g => { if (!g.active) return; g.vel.y -= CFG.GRAV * realDt; g.mesh.position.addScaledVector(g.vel, realDt); if (g.mesh.position.y < 0) { g.active = false; g.mesh.visible = false; createExplosion(g.mesh.position, 0x00ffff, 5); enemies.forEach(e => { if (e.group.position.distanceTo(g.mesh.position) < 15) { e.hp -= 20; if (e.hp <= 0) killEnemy(e, true); } }); } });

    // THROWN BUILDINGS LOGIC
    for (let i = thrownBuildings.length - 1; i >= 0; i--) {
        const b = thrownBuildings[i];
        b.time += dt;
        if (b.phase === 'rise') {
            b.mesh.position.y += 20 * dt; b.mesh.rotation.x += dt; b.mesh.rotation.z += dt;
            if (b.time > 1.5) {
                b.phase = 'throw'; b.time = 0;
                const speed = 80; const dist = b.mesh.position.distanceTo(player.pos); const timeToHit = dist / speed;
                const predictedPos = player.pos.clone().add(player.vel.clone().multiplyScalar(timeToHit)); predictedPos.y += 1.0;
                b.vel = new THREE.Vector3().subVectors(predictedPos, b.mesh.position).normalize().multiplyScalar(speed); Audio.playSound('charge');
            }
        } else if (b.phase === 'throw') {
            b.mesh.position.addScaledVector(b.vel, realDt); b.mesh.rotation.x += dt * 5; b.mesh.rotation.z += dt * 5;
            if (b.mesh.position.distanceTo(player.pos) < 8) { takeDamage(40); createExplosion(b.mesh.position, 0x00ffff, 4); scene.remove(b.mesh); thrownBuildings.splice(i, 1); continue; }
            if (b.mesh.position.y < 0 || Math.abs(b.mesh.position.x) > CFG.LIMIT || Math.abs(b.mesh.position.z) > CFG.LIMIT) { createExplosion(b.mesh.position, 0x00ffff, 4); Audio.playSound('explosion'); scene.remove(b.mesh); thrownBuildings.splice(i, 1); }
        }
    }

    // CCD BULLETS
    for (let b of bullets) {
        if (b.active) {
            b.prevPos.copy(b.mesh.position);
            if (b.homing) {
                let bestDist = Infinity; let target = null;
                enemies.forEach(e => { if (!e.dead) { const d = b.mesh.position.distanceTo(e.group.position); if (d < 50 && d < bestDist) { bestDist = d; target = e; } } });
                if (target) { const desired = new THREE.Vector3().subVectors(target.group.position, b.mesh.position).normalize(); b.vel.lerp(desired.multiplyScalar(100), dt * 5.0); }
            }
            b.mesh.position.addScaledVector(b.vel, realDt); b.life -= realDt; if (b.life <= 0) { b.active = false; b.mesh.visible = false; }
            const gx = Math.floor((b.mesh.position.x / CFG.CELL) + CFG.GRID / 2); const gz = Math.floor((b.mesh.position.z / CFG.CELL) + CFG.GRID / 2); if (gx >= 0 && gx < CFG.GRID && gz >= 0 && gz < CFG.GRID) { const h = worldHeights[gx][gz]; if (h > 1 && b.mesh.position.y < h) { b.active = false; b.mesh.visible = false; damageBuilding(gx, gz, state.modes.dev ? 999 : 3.0); } }

            // Hollow Purple Special Logic
            if (b.isHollowPurple) {
                const s = 1 + (10 - b.life) * 2; b.mesh.scale.set(s, s, s);
                for (let e of enemies) { if (e.dead) continue; if (e.group.position.distanceTo(b.mesh.position) < s + 3.0) { e.hp = -1; createExplosion(e.group.position, 0x8800ff, 2); killEnemy(e, true); } }
                for (let eb of enemyBullets) { if (eb.active && eb.mesh.position.distanceTo(b.mesh.position) < s + 3.0) { eb.active = false; eb.mesh.visible = false; } }
            } else {
                _segmentVec.subVectors(b.mesh.position, b.prevPos); const segLenSq = _segmentVec.lengthSq();
                for (let e of enemies) {
                    if (e.dead) continue;
                    let bHitRad = 1.5; if (e.type === 'heavy') bHitRad = 2.5; if (e.type === 'titan') bHitRad = 4.0; if (e.type.includes('boss')) bHitRad = 6.0;
                    _pointVec.subVectors(e.group.position, b.prevPos); let t = 0; if (segLenSq > 0) { t = _pointVec.dot(_segmentVec) / segLenSq; t = Math.max(0, Math.min(1, t)); } _closestPoint.copy(b.prevPos).addScaledVector(_segmentVec, t); const distSq = _closestPoint.distanceToSquared(e.group.position);
                    if (distSq < bHitRad * bHitRad) {
                        b.active = false; b.mesh.visible = false; let dmg = state.currentWeapon.damage; if (b.super) dmg *= 4; if (state.buff.active) dmg *= state.buff.multiplier; e.hp -= state.modes.dev ? 9999 : dmg;
                        if (b.stun) { e.stunTimer = 1.0; } if (b.knockback) { const kbDir = b.vel.clone().normalize(); e.vel.add(kbDir.multiplyScalar(40)); }
                        triggerHitMarker(); Audio.playSound('hit'); e.group.children[0].material.emissive.setHex(0xffffff); setTimeout(() => { if (e.group) e.group.children[0].material.emissive.setHex(state.modes.cb ? 0xffffff : e.baseColor); }, 50); if (e.type.includes('boss')) document.getElementById('boss-fill').style.width = (e.hp / e.maxHp * 100) + "%"; if (e.hp <= 0) { killEnemy(e, true); break; }
                    }
                }
            }
        }
    }

    // ORBITAL STRIKES
    for (let i = orbitalStrikes.length - 1; i >= 0; i--) {
        const s = orbitalStrikes[i]; s.time += dt;
        if (s.type.includes('boss')) {
            if (s.time < 1.5) { const progress = s.time / 1.5; s.mesh.scale.set(1 - progress * 0.5, 1, 1 - progress * 0.5); s.mesh.material.opacity = 0.2 + progress * 0.3; }
            else if (!s.detonated) { s.detonated = true; s.mesh.material.opacity = 1; s.mesh.material.color.setHex(0xffffff); s.mesh.scale.set(2, 1, 2); createExplosion(s.pos, 0xff00ff, 3); Audio.playSound('explosion'); if (player.pos.distanceTo(s.pos) < 6) { takeDamage(45); } }
            else if (s.time > 2.0) { scene.remove(s.mesh); orbitalStrikes.splice(i, 1); }
        } else if (s.type === 'sacred') {
            if (s.time < 0.3) { s.mesh.material.opacity = 1.0 - (s.time / 1.0); s.mesh.scale.setScalar(1 + s.time); } else if (!s.detonated) { s.detonated = true; createExplosion(s.pos, 0xaa00ff, 3); Audio.playSound('explosion'); }
            if (s.time > 1.0) { scene.remove(s.mesh); orbitalStrikes.splice(i, 1); }
        }
    }

    // SACRED PROJECTILES
    for (let i = sacredProjectiles.length - 1; i >= 0; i--) {
        const sp = sacredProjectiles[i]; sp.mesh.position.addScaledVector(sp.vel, realDt); sp.life -= realDt; sp.mesh.rotation.z += realDt * 5;
        if (sp.life <= 0) { scene.remove(sp.mesh); sacredProjectiles.splice(i, 1); continue; }
        let hit = false;
        for (let e of enemies) {
            if (e.dead) continue;
            if (sp.mesh.position.distanceTo(e.group.position) < 5.0) { hit = true; e.hp -= 5; spawnHalo(e); triggerHitMarker(); if (e.hp <= 0) killEnemy(e, true); break; }
        }
        if (hit) { scene.remove(sp.mesh); sacredProjectiles.splice(i, 1); }
    }

    enemyBullets.forEach(eb => { if (!eb.active) return; if (!state.modes.timeStop) eb.mesh.position.addScaledVector(eb.vel, dt); if (eb.mesh.position.distanceTo(player.pos) < 1.5) { takeDamage(10); eb.active = false; eb.mesh.visible = false; } if (eb.mesh.position.length() > 300) { eb.active = false; eb.mesh.visible = false; } });
    if (hitscanBeam.visible) { hitscanBeam.material.opacity -= realDt * 2.0; if (hitscanBeam.material.opacity <= 0) hitscanBeam.visible = false; }
    if (!state.bossActive && Math.random() < 0.03 && !state.modes.timeStop) spawnEnemy();
    if (enemies.length > 0 && !state.bossActive && !state.modes.timeStop) { pathUpdateIdx = (pathUpdateIdx + 1) % enemies.length; const e = enemies[pathUpdateIdx]; if (e && !e.type.includes('boss')) { const path = findPath(e.group.position, player.pos); if (path) e.path = path; } }
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]; if (e.dead) continue; if (!state.modes.timeStop) {

            if (e.stunTimer > 0) { e.stunTimer -= dt; e.group.position.x += (Math.random() - 0.5) * 0.1; continue; }
            let target = player.pos;

            if (!e.type.includes('boss')) {
                if (e.path && e.path.length > 0) { target = e.path[0]; if (e.group.position.distanceTo(target) < 5) e.path.shift(); }
                const dir = new THREE.Vector3().subVectors(target, e.group.position).normalize();
                e.vel.lerp(dir.multiplyScalar(e.speed), dt * 2.0);
                e.group.position.addScaledVector(e.vel, dt);
                for (let k = 0; k < 2; k++) solveCollisions(e.group.position, e.vel, 0.6);
                if (e.group.position.y < 0.5) e.group.position.y = 0.5;
            } else {
                const dir = new THREE.Vector3().subVectors(player.pos, e.group.position); const dist = dir.length(); dir.normalize();
                if (dist > 30) e.vel.lerp(dir.multiplyScalar(e.speed), dt); else e.vel.lerp(new THREE.Vector3(0, 0, 0), dt);
                e.group.position.addScaledVector(e.vel, dt);
                e.group.position.y = 30 + Math.sin(clock.elapsedTime) * 5;
                e.attackTimer += dt;

                // BOSS ATTACK LOGIC: BULLET HELL SPIRAL
                if (e.attackTimer > 0.8) {
                    e.attackTimer = 0;
                    const projectiles = 12; const offsetAngle = clock.elapsedTime * 2.0;
                    for (let k = 0; k < projectiles; k++) {
                        const angle = (k / projectiles) * Math.PI * 2 + offsetAngle;
                        const eb = enemyBullets.find(b => !b.active);
                        if (eb) {
                            eb.active = true; eb.mesh.visible = true; eb.mesh.position.copy(e.group.position);
                            const dir = new THREE.Vector3(Math.cos(angle), -0.2, Math.sin(angle)).normalize();
                            eb.vel.copy(dir.multiplyScalar(25));
                        }
                    }
                    Audio.playSound('shoot_plasma');
                }
                e.strikeTimer += dt; let strikeInterval = e.type === 'boss_seraph' ? 2.5 : 4.0;
                if (e.strikeTimer > strikeInterval) {
                    e.strikeTimer = 0; spawnOrbitalStrike(player.pos.clone());
                    if (e.type === 'boss_seraph') { setTimeout(() => spawnOrbitalStrike(player.pos.clone().add(new THREE.Vector3(10, 0, 0))), 500); setTimeout(() => spawnOrbitalStrike(player.pos.clone().add(new THREE.Vector3(-10, 0, 0))), 1000); }
                }
                if (e.type === 'boss_seraph') {
                    e.buildingTimer += dt;
                    if (e.buildingTimer > 5.0) {
                        e.buildingTimer = 0;
                        for (let k = 0; k < 3; k++) {
                            let found = false; let tries = 0;
                            while (tries < 10 && !found) {
                                const gx = Math.floor(Math.random() * CFG.GRID); const gz = Math.floor(Math.random() * CFG.GRID);
                                if (worldHeights[gx][gz] > 5) { detachBuilding(gx, gz); found = true; }
                                tries++;
                            }
                        }
                    }
                }
            }

            e.group.lookAt(player.pos);
            if (e.type === 'wraith') e.group.rotateX(-Math.PI / 2);
            e.group.children[0].rotation.y += dt;

            let hitDist = (e.type.includes('boss')) ? 8.0 : 2.5;
            let hitDmg = (e.type === 'swarmer') ? 10 : 20;
            if (e.type === 'wraith') hitDmg = 30;
            if (e.type === 'titan') hitDmg = 40;
            if (e.type.includes('boss')) hitDmg = 15;

            if (e.group.position.distanceTo(player.pos) < hitDist) {
                takeDamage(hitDmg);
                if (!e.type.includes('boss')) killEnemy(e, false);
                else { const push = new THREE.Vector3().subVectors(player.pos, e.group.position).normalize().multiplyScalar(100); player.vel.add(push); }
                continue;
            }
        }
    }

    composer.render();
}

window.selectWeapon = function (idx) {
    const cards = document.querySelectorAll('.weapon-card');
    cards.forEach(c => c.classList.remove('selected'));
    if (cards[idx]) cards[idx].classList.add('selected');
    state.currentWeapon = WEAPONS[idx];
    buildWeaponModel(idx);

    const weaponColor = '#' + state.currentWeapon.color.toString(16).padStart(6, '0');
    document.getElementById('crosshair').style.backgroundColor = weaponColor;
    document.getElementById('ammo-cnt').style.color = weaponColor;
    document.getElementById('ammo-cnt').style.textShadow = `0 0 30px ${weaponColor}`;

    document.getElementById('start-btn').style.display = 'block';
    const gUI = document.getElementById('grapple-ui');
    if (state.currentWeapon.alt === 'grapple') gUI.style.display = 'block'; else gUI.style.display = 'none';

    Audio.playSound('charge');
};

window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });
document.getElementById('start-btn').addEventListener('click', () => {
    document.body.requestPointerLock();
    document.getElementById('overlay').style.display = 'none';
    Audio.init();
    state.active = true;
    state.hp = 100;
    state.score = 0;
    state.wave = state.modes.startWave;
    state.enemiesSpawnedInWave = 0;
    state.enemiesKilledInWave = 0;
    state.bossActive = false;
    state.sacred.active = false;
    state.ammo = state.currentWeapon.ammo;
    enemies.forEach(e => scene.remove(e.group));
    enemies.length = 0;

    orbitalStrikes.forEach(s => scene.remove(s.mesh));
    orbitalStrikes.length = 0;

    document.getElementById('boss-container').style.display = 'none';
    updateHUD();
    player.pos.copy(findSafeSpawn());

    if (state.modes.startWave === 5) spawnBoss('boss_omega');
    else if (state.modes.startWave === 10) spawnBoss('boss_seraph');

    animate();
});

document.addEventListener('keydown', e => {
    if (e.code === 'KeyW') input.fwd = 1; if (e.code === 'KeyS') input.fwd = -1; if (e.code === 'KeyA') input.str = 1; if (e.code === 'KeyD') input.str = -1;
    if (e.code === 'Space') input.jump = true; if (e.code === 'ShiftLeft') input.sprint = true;
    if (e.code === 'KeyQ') input.sacred = true;

    if (state.currentWeapon.type === 'magic' && state.fifthMagic.casting) {
        if (e.code === 'KeyW') { if (state.fifthMagic.buffer.length < 3) state.fifthMagic.buffer.push('W'); }
        if (e.code === 'KeyA') { if (state.fifthMagic.buffer.length < 3) state.fifthMagic.buffer.push('A'); }
        if (e.code === 'KeyS') { if (state.fifthMagic.buffer.length < 3) state.fifthMagic.buffer.push('S'); }
        if (e.code === 'KeyD') { if (state.fifthMagic.buffer.length < 3) state.fifthMagic.buffer.push('D'); }
    }
});
document.addEventListener('keyup', e => {
    if (e.code === 'KeyW' || e.code === 'KeyS') input.fwd = 0; if (e.code === 'KeyA' || e.code === 'KeyD') input.str = 0;
    if (e.code === 'ShiftLeft') input.sprint = false;
    if (e.code === 'KeyQ') input.sacred = false;
});
document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement) {
        if (e.button === 0) input.fire = true;
        if (e.button === 2) {
            input.alt = true;
        }
        if (state.currentWeapon.alt === 'grapple' && e.button === 2) input.grapple = true;
    }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; if (e.button === 2) input.alt = false; if (e.button === 2) input.grapple = false; });
document.addEventListener('mousemove', e => { if (document.pointerLockElement) { input.yaw += e.movementX * CFG.SENS; input.pitch += e.movementY * CFG.SENS; } });
