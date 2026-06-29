/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  y: number;
}

export type AsteroidSize = 'colossal' | 'huge' | 'large' | 'medium' | 'small';
export type OreType = 'crystal' | 'diamond' | 'obsidian';

export interface Asteroid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  size: AsteroidSize;
  hp: number;
  maxHp: number;
  radius: number;
  vertices: Vector2D[];
  color: string;
  points: number;
  asteroidType?: 'common' | 'magma' | 'ice' | 'crystal' | 'gold-rush';
  tempState?: 'cold' | 'normal' | 'hot';
}

export interface Laser {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  damage: number;
  isPiercing: boolean;
  piercedAsteroidIds: string[];
  radius: number;
  width: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  isHeated?: boolean;
}

export interface Ore {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: OreType;
  color: string;
  radius: number;
  pulseScale: number;
  pulseDir: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
}

export interface Upgrades {
  laserLevel: number;    // 1 to 4
  magnetLevel: number;   // 1 to 5
  hullLevel: number;     // 1 to 5
  shieldLevel: number;   // 1 to 5
  engineLevel: number;   // 1 to 5
  abilityLightningLevel: number;   // 0 to 3
  abilityPulseLevel: number;       // 0 to 3
  abilitySuperMagnetLevel: number; // 0 to 3
  scoreMultiplierLevel: number;    // 1 to 5
  abilitySockLevel: number;        // 0 to 3 (Smradlavá ponožka special attack)
  blackHoleActivator: number;      // 0 to 1 (0 = Not acquired, 1 = Acquired)
  miningDronesLevel: number;       // 0 to 3 (Automatic mining drones level)
}

export interface PlayerStats {
  crystals: number;
  diamonds: number;
  obsidian: number;
  highScore: number;
  totalAsteroidsMined: number;
}

export interface Player {
  playerNum: number;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  thrusting: boolean;
  reversing: boolean;
  radius: number;
  invulnerableTime: number;
  lastFired: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  reviveTimer: number;
  color: string;
  glowColor: string;
  name: string;
  inputSource: 'keyboard_p1' | 'keyboard_p2' | 'gamepad';
  gamepadIndex: number | null;
  // Dynamic Brainstorm Mechanics
  anchoredAsteroidId?: string;
  anchorAngle?: number;
  anchorRadius?: number;
  isDrilling?: boolean;
  drillTime?: number;
}

export interface Pirate {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  lastFired: number;
  color: string;
}

export interface PirateLaser {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
}

export interface SockEntity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;
  damage: number;
  isExploded: boolean;
  explosionRadius: number;
  explosionTimer: number; // Ticks for stinky gas cloud duration
}

export interface Boss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  state: 'intro' | 'moving' | 'rage' | 'active'; // support all states
  lastFired: number;
  lastShieldFired: number;
  lastValuableMove?: number;
}

