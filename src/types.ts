/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  y: number;
}

export type AsteroidSize = 'colossal' | 'huge' | 'large' | 'medium' | 'small';
export type OreType = 'crystal' | 'diamond' | 'obsidian' | 'cargo';

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

export type CarrierClass = 'none' | 'cargo' | 'mining' | 'war' | 'dreadnought' | 'stargate';

export type PlayerShipClass = 'standard' | 'interceptor' | 'cruiser' | 'dreadnought';

export type CapitalShipType = 'mining' | 'war' | 'mothership' | 'explorer';

export interface CapitalShipStation {
  id: 'pilot' | 'gunner_left' | 'gunner_right' | 'engineer';
  name: string;
  assignedPlayerId: string | null; // ID of the player currently controlling this station, null for AI auto-control
  angle: number;
  cooldown: number;
  lastFired: number;
}

export interface CapitalShip {
  type: CapitalShipType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  stations: CapitalShipStation[];
  lastHangarLaunchTime: number;
  cargoCount: number;
  rocketCooldown: number;
}

export interface CarrierWeaponSlot {
  position: 'front' | 'left' | 'right' | 'rear';
  damage: number;
  cooldown: number;
  lastFired: number;
  angleOffset: number; // offset in radians from carrier direction
}

export interface CarrierState {
  id: string;
  carrierClass: CarrierClass;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  fuel: number;
  maxFuel: number;
  dockedPlayerIds: string[]; // players currently docked
  weaponSlots: CarrierWeaponSlot[];
  lastFired: number;
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
  omegaDestructorLevel: number;    // 0 to 1 (Super expensive ultimate upgrade)
  quantumMirrorLevel: number;      // 0 to 1 (Quantum Mirror upgrade)
  toxicTrailLevel: number;         // 0 to 1 (Toxic/Reactive Trail exhaust upgrade)
  salvageMagnetLevel: number;      // 0 to 1 (Salvage Magnet / Combo scaling upgrade)
  autoRepairSpeedLevel: number;    // 0 to 4 (Urychlovač auto-opravy trupu)
  playerShipClass: PlayerShipClass;
  
  // Carrier Upgrades
  carrierClass: CarrierClass;
  carrierHullLevel: number;        // 0 to 5
  carrierShieldLevel: number;      // 0 to 5
  carrierEngineLevel: number;      // 0 to 5
  carrierWeaponSlotLevel: number;  // 0 to 5
  carrierWeaponDamageLevel: number; // 1 to 5
  carrierHyperfuelTankLevel: number; // 1 to 5
  carrierHyperdriveRangeLevel: number; // 1 to 3
  carrierRepairBayLevel: number;    // 0 to 3
  carrierCargoHoldLevel: number;    // 0 to 3
  carrierRepairDronesLevel: number; // 0 to 3 (Automated repair drones level)
  carrierPointDefenseLevel: number; // 0 to 3 (Hangar Point Defense level)
}

export interface PlayerStats {
  crystals: number;
  diamonds: number;
  obsidian: number;
  deuterium: number; // New fuel resource
  highScore: number;
  totalAsteroidsMined: number;
  prestigeCount?: number; // Number of times player completed New Game+ by discarding supplies
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
  lastShieldHitTime?: number;
  lastHullHitTime?: number;
  lastCombatTime?: number;
  lastAutoRepairTime?: number;
  anchoredAsteroidId?: string;
  anchorAngle?: number;
  anchorRadius?: number;
  isDrilling?: boolean;
  drillTime?: number;
  gamepadThrustAngle?: number;
  frostLevel?: number;   // 0 to 100 for freezing hazards
  frozenTimer?: number;  // cooldown frames when ship is frozen
}

export interface LavaProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
  lifetime: number;
  maxLifetime: number;
}

export interface BlizzardZone {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export interface BossGuidedFireball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
  lifetime: number;
  maxLifetime: number;
}

export interface FireTrail {
  id: string;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;
}

export interface BossFreezingPulse {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  damage: number;
  hitPlayerIds: string[];
}

export interface BossEscortDrone {
  id: string;
  x: number;
  y: number;
  angle: number;
  orbitOffset: number;
  hp: number;
  maxHp: number;
  radius: number;
}

export interface PlayerTrailBubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
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
  lives?: number;
  maxLives?: number;
  healVisualTimer?: number;
  hitCount?: number;
  lastDamageTime?: number;
}

export interface ArenaPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: string;
}

