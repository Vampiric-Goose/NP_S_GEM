import * as THREE from 'three';

export const CFG = {
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

export const WAVES = [
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

export const WEAPONS = [
    { name: "PLASMA RIFLE", color: 0x00ffff, rate: 0.1, damage: 1.5, count: 1, spread: 0.02, ammo: 30, recoil: 0.2, type: 'bullet', scale: [1, 1, 1], id: 0, sfx: 'shoot_plasma', alt: 'grenade', reloadTime: 1.2 },
    { name: "VOID SHOTGUN", color: 0xff00ff, rate: 0.8, damage: 1, count: 6, spread: 0.15, ammo: 8, recoil: 0.6, type: 'bullet', scale: [1, 1, 1], id: 1, sfx: 'shoot_shotgun', alt: 'grapple', reloadTime: 1.2 },
    { name: "R.A.D.I.A.N.C.E.", color: 0xffaa00, rate: 0.1, damage: 50, count: 1, spread: 0.001, ammo: 1, recoil: 0.1, type: 'beam', scale: [1, 1, 1], id: 2, sfx: 'shoot_laser', alt: 'scope', reloadTime: 4.0 },
    { name: "LAZARUS", color: 0x00ff00, rate: 0.4, damage: 4, count: 1, spread: 0.02, ammo: 4, recoil: 0.1, type: 'lazarus', scale: [1, 1, 1], id: 3, sfx: 'shoot_plasma', alt: 'grapple', reloadTime: 2.5 },
    { name: "DANTÈS", color: 0xffffff, rate: 0.15, damage: 1.0, count: 1, spread: 0.05, ammo: 12, recoil: 0.3, type: 'bullet', scale: [0.5, 0.5, 1.5], id: 4, sfx: 'shoot_dantes', alt: 'timestop', reloadTime: 2.0 },
    { name: "CALIBURN", color: 0xff0055, rate: 1.0, damage: 2, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'melee', scale: [1, 1, 1], id: 5, sfx: 'swing_sword', alt: null, reloadTime: 0 },
    { name: "LIMITLESS", color: 0xaa00ff, rate: 0.5, damage: 9999, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'gojo', scale: [1, 1, 1], id: 6, sfx: 'charge', alt: 'infinity', reloadTime: 0 },
    { name: "FIFTH MAGIC", color: 0x00ffff, rate: 0.1, damage: 3, count: 1, spread: 0, ammo: 999, recoil: 0, type: 'magic', scale: [1, 1, 1], id: 7, sfx: 'charge', alt: 'casting', reloadTime: 0 }
];

export type Weapon = typeof WEAPONS[number];

// Reusable vectors (export them so others can import and reuse)
export const tempVec = new THREE.Vector3();
export const segmentVec = new THREE.Vector3();
export const pointVec = new THREE.Vector3();
export const closestPoint = new THREE.Vector3();