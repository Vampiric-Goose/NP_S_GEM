import * as THREE from 'three';
import type { Weapon } from './Constants';

export interface GameState {
    active: boolean;
    hp: number;
    ammo: number;
    score: number;
    reloading: boolean;
    dashCd: number;
    shake: number;
    wave: number;
    enemiesSpawnedInWave: number;
    enemiesKilledInWave: number;
    bossActive: boolean;
    currentWeapon: Weapon;
    grapple: {
        active: boolean;
        pos: THREE.Vector3;
        cd: number;
    };
    wallRun: {
        active: boolean;
        side: number;
        normal: THREE.Vector3;
        climbing: boolean;
    };
    cameraRoll: number;
    stamina: number;
    canSprint: boolean;
    sprintCooldown: number;
    modes: {
        dev: boolean;
        cb: boolean;
        bossRush: boolean;
        startWave: number;
    };
    yaw: number;
    pitch: number;
    grenadeCharge: number;
    grenadeCooldown: number;
    beamCharge: number;
    isScoped: boolean;
    timeScale: number;
    dantes: {
        side: number;
        cooldown: number;
        active: boolean;
        activeTime: number;
        idleTimer: number;
        spinState: number;
        recoilL: number;
        recoilR: number;
        canCancel: boolean;
    };
    lazarus: {
        tier: number;
        nextTier: number;
        speedBoost: number;
        dieMesh: THREE.Mesh | null;
    };
    buff: {
        active: boolean;
        time: number;
        multiplier: number;
    };
    melee: {
        swinging: boolean;
        swingTime: number;
        combo: number;
        nextAttackTime: number;
        hitCalculated: boolean;
    };
    sacred: {
        unlocked: boolean;
        active: boolean;
        ammo: number;
        spears: any[];
        cd: number;
        toggleLock: boolean;
    };
    infinityActive: boolean;
    fifthMagic: {
        buffer: any[];
        casting: boolean;
        lastInputTime: number;
    };
}

export interface InputState {
    fwd: number;
    str: number;
    jump: boolean;
    sprint: boolean;
    fire: boolean;
    alt: boolean;
    sacred: boolean;
    yaw: number;
    pitch: number;
}

export interface Player {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    ground: boolean;
    height: number;
    wallNormal: THREE.Vector3;
}