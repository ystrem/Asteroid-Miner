/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Vector2D, 
  Asteroid, 
  Laser, 
  Ore, 
  Particle, 
  Star, 
  Upgrades, 
  PlayerStats,
  AsteroidSize,
  OreType 
} from './types';
import { 
  playLaserSound, 
  playExplosionSound, 
  playCollectSound, 
  playDamageSound, 
  playShieldDownSound, 
  playUpgradeSound,
  getSoundState, 
  toggleSound 
} from './utils/audio';
import { 
  loadUpgrades, 
  saveUpgrades, 
  loadStats, 
  saveStats, 
  resetGameSave 
} from './utils/storage';
import UpgradeShop from './components/UpgradeShop';
import { 
  Swords, 
  Shield, 
  Zap, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Play, 
  RotateCcw, 
  Maximize2, 
  Award, 
  Target, 
  ChevronRight, 
  Gem, 
  Layers, 
  Hourglass, 
  Compass, 
  HelpCircle 
} from 'lucide-react';

const ASTEROID_COLORS = {
  huge: '#4b5563',   // gray-600
  large: '#6b7280',  // gray-500
  medium: '#9ca3af', // gray-405
  small: '#d1d5db',  // gray-300
};

export default function App() {
  // --- STATE ---
  const [upgrades, setUpgrades] = useState<Upgrades>(loadUpgrades());
  const [stats, setStats] = useState<PlayerStats>(loadStats());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(!getSoundState());
  const [showHowTo, setShowHowTo] = useState<boolean>(false);

  // Floating notifications/gains to display on screen
  const [gains, setGains] = useState<{ id: string; text: string; x: number; y: number; color: string }[]>([]);

  // HUD stats synchronizers
  const [hull, setHull] = useState<number>(100);
  const [maxHull, setMaxHull] = useState<number>(100);
  const [shield, setShield] = useState<number>(0);
  const [maxShield, setMaxShield] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [runCrystals, setRunCrystals] = useState<number>(0);
  const [runDiamonds, setRunDiamonds] = useState<number>(0);
  const [runObsidian, setRunObsidian] = useState<number>(0);

  // --- REFS FOR PHYSICS GAME LOOP (Buttery 60fps) ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game entities
  const playerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0, // In radians
    targetAngle: 0,
    thrusting: false,
    reversing: false,
    radius: 20,
    invulnerableTime: 0,
    lastFired: 0,
  });

  const asteroidsRef = useRef<Asteroid[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  const oresRef = useRef<Ore[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const touchJoystick = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  });

  const animationFrameId = useRef<number | null>(null);
  const shieldRegenCooldown = useRef<number>(0);

  // Stable refs for values used inside the high-frequency physics game loop
  const upgradesRef = useRef<Upgrades>(upgrades);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isShopOpenRef = useRef<boolean>(isShopOpen);
  const scoreRef = useRef<number>(0);
  const maxHullRef = useRef<number>(100);
  const maxShieldRef = useRef<number>(0);

  // Synchronize state values to refs inside effect
  useEffect(() => {
    upgradesRef.current = upgrades;
  }, [upgrades]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isShopOpenRef.current = isShopOpen;
  }, [isShopOpen]);

  // Clean up game loop on component unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Calculate current HP limits based on upgrades
  useEffect(() => {
    const calculatedMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel === 5 ? 20 : 0);
    const calculatedMaxShield = upgrades.shieldLevel > 0 
      ? 50 + (upgrades.shieldLevel - 1) * 30 + (upgrades.shieldLevel === 4 ? 10 : 0)
      : 0;

    maxHullRef.current = calculatedMaxHull;
    maxShieldRef.current = calculatedMaxShield;

    setMaxHull(calculatedMaxHull);
    setMaxShield(calculatedMaxShield);

    // If starting or upgrading, make sure HP doesn't exceed maximums
    setHull(curr => Math.min(curr, calculatedMaxHull));
    setShield(curr => Math.min(curr, calculatedMaxShield));
  }, [upgrades]);

  // Load HighScore
  useEffect(() => {
    const loadedStats = loadStats();
    setStats(loadedStats);
  }, []);

  // --- TRIGGER ACTION NOTIFICATIONS ---
  const addGainNotification = (text: string, color: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const x = window.innerWidth / 2 + (Math.random() * 120 - 65);
    const y = window.innerHeight / 2 - 40 - (Math.random() * 40);
    setGains(prev => [...prev, { id, text, x, y, color }]);
    
    setTimeout(() => {
      setGains(prev => prev.filter(g => g.id !== id));
    }, 1500);
  };

  // --- KEYBOARD EVENT HANDLERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressed.current[code] = true;

      // Prevent window scrolling with Arrow keys or Spacebar
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) && isPlaying && !isShopOpen) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = () => {
      keysPressed.current['MouseDown'] = true;
    };

    const handleMouseUp = () => {
      keysPressed.current['MouseDown'] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Initial stars generation
    generateStarfield();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Size immediately on mount to secure container bounds

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, isShopOpen]);

  // --- INITIALIZERS & STARFIELD GENERATION ---
  const generateStarfield = () => {
    const stars: Star[] = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 1.8 + 0.5,
        brightness: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.05, // slower speed for far parallax star feel
      });
    }
    starsRef.current = stars;
  };

  // Spawns an asteroid in a safe ring around player coordinates
  const createProceduralAsteroid = (
    size: AsteroidSize, 
    customX?: number, 
    customY?: number, 
    customVx?: number, 
    customVy?: number
  ): Asteroid => {
    let px = playerRef.current.x;
    let py = playerRef.current.y;

    let x = 0;
    let y = 0;

    if (customX !== undefined && customY !== undefined) {
      x = customX;
      y = customY;
    } else {
      // Spawn in a safe ring around player (distance between 400 and 1000 pixels)
      const angle = Math.random() * Math.PI * 2;
      const distance = 450 + Math.random() * 600;
      x = px + Math.cos(angle) * distance;
      y = py + Math.sin(angle) * distance;
    }

    // Determine speed & HP based on size
    let vx = 0;
    let vy = 0;
    let hp = 1;
    let radius = 15;
    let points = 10;

    if (customVx !== undefined && customVy !== undefined) {
      vx = customVx;
      vy = customVy;
    } else {
      const speed = Math.random() * 1.2 + 0.3;
      const moveAngle = Math.random() * Math.PI * 2;
      vx = Math.cos(moveAngle) * speed;
      vy = Math.sin(moveAngle) * speed;
    }

    switch (size) {
      case 'huge':
        hp = 12;
        radius = 55;
        points = 80;
        break;
      case 'large':
        hp = 6;
        radius = 35;
        points = 40;
        break;
      case 'medium':
        hp = 3;
        radius = 22;
        points = 20;
        break;
      case 'small':
        hp = 1;
        radius = 12;
        points = 10;
        break;
    }

    // Generate beautiful jagged procedural star polygon representation
    const vertices: Vector2D[] = [];
    const pointsCount = 7 + Math.floor(Math.random() * 5); // 7 to 11 vertices
    for (let i = 0; i < pointsCount; i++) {
      const a = (i / pointsCount) * Math.PI * 2;
      const variance = 0.7 + Math.random() * 0.4; // interesting jagged shape
      vertices.push({
        x: Math.cos(a) * radius * variance,
        y: Math.sin(a) * radius * variance,
      });
    }

    return {
      id: Math.random().toString(36).substring(2, 9),
      x,
      y,
      vx,
      vy,
      angle: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() * 0.04 - 0.02),
      size,
      hp,
      maxHp: hp,
      radius,
      vertices,
      color: ASTEROID_COLORS[size],
      points,
    };
  };

  const populateAsteroidBelt = (targetCount: number) => {
    const list: Asteroid[] = [...asteroidsRef.current];
    while (list.length < targetCount) {
      // Pick random size, skewed towards large & medium for good mining!
      const roll = Math.random();
      let size: AsteroidSize = 'medium';
      if (roll < 0.15) size = 'huge';
      else if (roll < 0.4) size = 'large';
      else if (roll < 0.75) size = 'medium';
      else size = 'small';

      list.push(createProceduralAsteroid(size));
    }
    asteroidsRef.current = list;
  };

  // --- LAUNCH GAME RUN ---
  const handleStartGame = () => {
    // Lazily spin up our AudioContext via user trigger gesture
    playLaserSound(1);

    setShowIntro(false);
    setIsGameOver(false);
    
    // Set state and immediately synchronize refs for the loop
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    setIsShopOpen(false);
    isShopOpenRef.current = false;

    // Reset current score and temporary resource gains
    scoreRef.current = 0;
    setCurrentScore(0);
    setRunCrystals(0);
    setRunDiamonds(0);
    setRunObsidian(0);

    // Re-initialize player location and status
    playerRef.current = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      thrusting: false,
      reversing: false,
      radius: 20,
      invulnerableTime: 60, // briefly invulnerable on start
      lastFired: 0,
    };

    // Calculate initial armor hull strength
    const calculatedMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel === 5 ? 20 : 0);
    const calculatedMaxShield = upgrades.shieldLevel > 0 
      ? 50 + (upgrades.shieldLevel - 1) * 30 + (upgrades.shieldLevel === 4 ? 10 : 0)
      : 0;

    setHull(calculatedMaxHull);
    setShield(calculatedMaxShield);

    // Initial entities clear
    asteroidsRef.current = [];
    lasersRef.current = [];
    oresRef.current = [];
    particlesRef.current = [];

    // Populate asteroid cloud
    populateAsteroidBelt(15);

    // Launch game loop animations
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = requestAnimationFrame(tickGameLoop);
  };

  // --- DOCKING SHOP UPGRADE HANDLERS ---
  const handleUpgrade = (id: keyof Upgrades, costs: { crystals: number; diamonds: number; obsidian: number }, nextLevel: number) => {
    const updatedStats = {
      ...stats,
      crystals: stats.crystals - costs.crystals,
      diamonds: stats.diamonds - costs.diamonds,
      obsidian: stats.obsidian - costs.obsidian,
    };

    const updatedUpgrades = {
      ...upgrades,
      [id]: nextLevel,
    };

    // Save and apply details
    setUpgrades(updatedUpgrades);
    setStats(updatedStats);
    saveUpgrades(updatedUpgrades);
    saveStats(updatedStats);

    addGainNotification(`ZAKOUPENO: ${id === 'laserLevel' ? 'Laser Level ' : id === 'magnetLevel' ? 'Magnet Level ' : 'Modul Level '}${nextLevel}`, '#f59e0b');
  };

  const handleRepair = (cost: number, healAmount: number) => {
    if (stats.crystals < cost) return;

    const updatedStats = {
      ...stats,
      crystals: stats.crystals - cost,
    };

    setStats(updatedStats);
    saveStats(updatedStats);

    setHull(maxHull);
    addGainNotification('TRUP PLNĚ RESUSTAVEN (100%)', '#10b981');
    playUpgradeSound();
  };

  const handleRechargeShield = (cost: number) => {
    if (stats.crystals < cost || upgrades.shieldLevel === 0) return;

    const updatedStats = {
      ...stats,
      crystals: stats.crystals - cost,
    };

    setStats(updatedStats);
    saveStats(updatedStats);

    setShield(maxShield);
    addGainNotification('ŠTÍTY PLNĚ NABITY', '#3b82f6');
    playUpgradeSound();
  };

  // Toggle Mute Audio
  const handleToggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    toggleSound(!nextState);
  };

  // Emergency game reset to fresh defaults
  const handleResetGameSave = () => {
    if (confirm('Opravdu si přeješ vymazat veškerá herní vylepšení, suroviny a skóre?')) {
      resetGameSave();
      setUpgrades(loadUpgrades());
      setStats(loadStats());
      setHull(100);
      setShield(0);
      setIsPlaying(false);
      setShowIntro(true);
      setIsGameOver(false);
    }
  };

  // --- ORE DROP GENERATOR (RADIAL EXPLOSIONS) ---
  const triggerSpawnAsteroidDrops = (ax: number, ay: number, size: AsteroidSize) => {
    const drops: Ore[] = [];
    
    // Choose what drops based on size
    if (size === 'huge') {
      // 1 Principal Obsidian Core 
      drops.push(createOreEntity(ax, ay, 'obsidian'));
      // 1-2 Diamonds flying outward
      const diamondCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < diamondCount; i++) {
        drops.push(createOreEntity(ax, ay, 'diamond', true));
      }
      // 4-6 Crystals flying outward
      const crystalCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < crystalCount; i++) {
        drops.push(createOreEntity(ax, ay, 'crystal', true));
      }
    } else if (size === 'large') {
      // 1 Core Diamond
      drops.push(createOreEntity(ax, ay, 'diamond'));
      // Occasional Obsidian chance (15%)
      if (Math.random() < 0.15) {
        drops.push(createOreEntity(ax, ay, 'obsidian', true));
      }
      // 3-4 Crystals
      const crystalCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < crystalCount; i++) {
        drops.push(createOreEntity(ax, ay, 'crystal', true));
      }
    } else if (size === 'medium') {
      // 1 Core Crystal
      drops.push(createOreEntity(ax, ay, 'crystal'));
      // 1 Diamond or Crystal extra
      const extrType: OreType = Math.random() < 0.3 ? 'diamond' : 'crystal';
      drops.push(createOreEntity(ax, ay, extrType, true));
    } else {
      // Small shards: 35% chance of 1 Crystal
      if (Math.random() < 0.35) {
        drops.push(createOreEntity(ax, ay, 'crystal'));
      }
    }

    oresRef.current = [...oresRef.current, ...drops];
  };

  const createOreEntity = (ax: number, ay: number, type: OreType, hasOffset: boolean = false): Ore => {
    let vx = 0;
    let vy = 0;
    
    if (hasOffset) {
      // Speeds outward in radial offset direction
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.0 + 0.5;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    let color = '#10b981'; // green crystal
    let radius = 6;
    if (type === 'diamond') {
      color = '#3b82f6'; // blue diamond
      radius = 7;
    } else if (type === 'obsidian') {
      color = '#a855f7'; // violet-purple obsidian
      radius = 9;
    }

    return {
      id: Math.random().toString(36).substring(2, 9),
      x: ax + (Math.random() * 8 - 4),
      y: ay + (Math.random() * 8 - 4),
      vx,
      vy,
      type,
      color,
      radius,
      pulseScale: 1.0,
      pulseDir: Math.random() < 0.5 ? 1 : -1,
    };
  };

  // --- LASER BULLET EMISSION INTER ACTION ---
  const fireActiveLaser = () => {
    const player = playerRef.current;
    const now = Date.now();
    
    // Fire rates depend on weapon tier
    let cooldown = 350;
    if (upgradesRef.current.laserLevel === 2) cooldown = 280;
    if (upgradesRef.current.laserLevel === 3) cooldown = 200;
    if (upgradesRef.current.laserLevel === 4) cooldown = 300;

    if (now - player.lastFired < cooldown) return;
    player.lastFired = now;

    // Laser properties
    let damage = 1;
    let isPiercing = upgradesRef.current.laserLevel === 4;
    let speed = 9;
    let width = 2;
    let radius = 3;

    playLaserSound(upgradesRef.current.laserLevel);

    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);

    // Spawn point slightly in front of the ship bezel tip (22px away from player)
    const sx = player.x + cos * 22;
    const sy = player.y + sin * 22;

    const baseVx = cos * speed;
    const baseVy = sin * speed;

    if (upgradesRef.current.laserLevel === 1) {
      // Level 1: Simple laser bullet
      const laser: Laser = {
        id: Math.random().toString(36).substring(2, 9),
        x: sx,
        y: sy,
        vx: baseVx,
        vy: baseVy,
        angle: player.angle,
        damage: 1,
        isPiercing: false,
        piercedAsteroidIds: [],
        radius,
        width,
        color: '#f87171', // red light
        lifetime: 0,
        maxLifetime: 75,
      };
      lasersRef.current.push(laser);
    } 
    else if (upgradesRef.current.laserLevel === 2) {
      // Level 2: Heavy wider laser
      const laser: Laser = {
        id: Math.random().toString(36).substring(2, 9),
        x: sx,
        y: sy,
        vx: cos * 10,
        vy: sin * 10,
        angle: player.angle,
        damage: 2.5,
        isPiercing: false,
        piercedAsteroidIds: [],
        radius: 5,
        width: 4,
        color: '#f43f5e', // deep heavy red-orange
        lifetime: 0,
        maxLifetime: 85,
      };
      lasersRef.current.push(laser);
    } 
    else if (upgradesRef.current.laserLevel === 3) {
      // Level 3: Triple Shot (We shoot 3 lasers: 1 forward, 2 angled slightly)
      const angles = [0, -0.15, 0.15]; // spread in radians (~10 degrees angles)
      angles.forEach(offsetAngle => {
        const theta = player.angle + offsetAngle;
        const twinCos = Math.cos(theta);
        const twinSin = Math.sin(theta);
        const laser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: player.x + twinCos * 22,
          y: player.y + twinSin * 22,
          vx: twinCos * 9.5,
          vy: twinSin * 9.5,
          angle: theta,
          damage: 1.5,
          isPiercing: false,
          piercedAsteroidIds: [],
          radius: 3,
          width: 3,
          color: '#38bdf8', // sky bluish plasma
          lifetime: 0,
          maxLifetime: 60,
        };
        lasersRef.current.push(laser);
      });
    } 
    else {
      // Level 4: Heavy piercing electromagnetic laser beam
      const laser: Laser = {
        id: Math.random().toString(36).substring(2, 9),
        x: sx,
        y: sy,
        vx: cos * 11,
        vy: sin * 11,
        angle: player.angle,
        damage: 4,
        isPiercing: true,
        piercedAsteroidIds: [],
        radius: 7,
        width: 5,
        color: '#c084fc', // purple antimatter beam
        lifetime: 0,
        maxLifetime: 100,
      };
      lasersRef.current.push(laser);
    }
  };

  // --- MAIN SIMULATION GAME TICK ENGINE ---
  const tickGameLoop = () => {
    if (!isPlayingRef.current) return;

    if (isShopOpenRef.current) {
      // Game paused, draw static elements but skip physics updates
      drawGameScene();
      animationFrameId.current = requestAnimationFrame(tickGameLoop);
      return;
    }

    const player = playerRef.current;

    // --- 1. SHIP ROTATION & DIRECTION ---
    // Smooth input orientation interpolation to face current mouse cursor
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Angle from screen center to mouse pos
    const mouseAngle = Math.atan2(mousePos.current.y - centerY, mousePos.current.x - centerX);
    player.targetAngle = mouseAngle;

    // Direct interpolation for responsive feel
    let deltaAngle = player.targetAngle - player.angle;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;

    const rotSpeed = 0.16 + (upgradesRef.current.engineLevel - 1) * 0.03;
    player.angle += deltaAngle * Math.min(1, rotSpeed);

    // --- 2. ACCELERATION / FLYING FORWARD & BACKWARD ---
    // Calculate speed coefficients based on engine level
    const maxSpeed = 5 + (upgradesRef.current.engineLevel - 1) * 1.5;
    const thrustPower = 0.14 + (upgradesRef.current.engineLevel - 1) * 0.07;
    const inertiaFriction = 0.982 + (upgradesRef.current.engineLevel - 1) * 0.003; // less drift at higher tiers

    player.thrusting = keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['MouseDown'];
    player.reversing = keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'];

    if (player.thrusting) {
      player.vx += Math.cos(player.angle) * thrustPower;
      player.vy += Math.sin(player.angle) * thrustPower;

      // Exhaust trailing dust particle particles
      if (Math.random() < 0.4) {
        const backAngle = player.angle + Math.PI + (Math.random() * 0.6 - 0.3);
        const ex = player.x - Math.cos(player.angle) * 18;
        const ey = player.y - Math.sin(player.angle) * 18;
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: ex,
          y: ey,
          vx: Math.cos(backAngle) * (Math.random() * 3 + 1.2) + player.vx * 0.4,
          vy: Math.sin(backAngle) * (Math.random() * 3 + 1.2) + player.vy * 0.4,
          color: Math.random() < 0.35 ? '#3b82f6' : '#f97316', // neon blue rocket exhaust core / raw orange flame
          size: Math.random() * 3.5 + 1.5,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 20 + Math.floor(Math.random() * 15),
        });
      }
    } else if (player.reversing) {
      // Brake/Slide backward
      player.vx -= Math.cos(player.angle) * (thrustPower * 0.55);
      player.vy -= Math.sin(player.angle) * (thrustPower * 0.55);
    }

    // Apply absolute momentum caps
    let speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }

    // Apply friction simulation slide
    player.vx *= inertiaFriction;
    player.vy *= inertiaFriction;

    // Shift coordinates of the players physical location
    player.x += player.vx;
    player.y += player.vy;

    // Brief invulnerability decrease
    if (player.invulnerableTime > 0) {
      player.invulnerableTime--;
    }

    // Shield passive regeneration tick
    if (upgradesRef.current.shieldLevel > 0 && shield < maxShieldRef.current) {
      if (shieldRegenCooldown.current > 0) {
        shieldRegenCooldown.current--;
      } else {
        // Regeneration increment factor by level
        const baseRegen = 0.04;
        const powerMultiplier = 1 + (upgradesRef.current.shieldLevel - 1) * 0.35;
        const actualRegen = baseRegen * powerMultiplier;
        setShield(curr => {
          const nextVal = curr + actualRegen;
          return nextVal >= maxShieldRef.current ? maxShieldRef.current : nextVal;
        });
      }
    }

    // --- 3. AUTO-FIRE ENGAGE ---
    if (keysPressed.current['Space'] || keysPressed.current['MouseDown']) {
      fireActiveLaser();
    }

    // --- 4. LASER FLIGHT & BOUNDS ---
    lasersRef.current = lasersRef.current.map(laser => {
      laser.x += laser.vx;
      laser.y += laser.vy;
      laser.lifetime++;
      return laser;
    }).filter(laser => laser.lifetime < laser.maxLifetime);

    // --- 5. ORE SUCKING MAGNET PICS ---
    // Magnet levels details
    let magnetRadius = 100;
    let magnetPullStrength = 0.22;
    if (upgradesRef.current.magnetLevel === 2) { magnetRadius = 180; magnetPullStrength = 0.28; }
    else if (upgradesRef.current.magnetLevel === 3) { magnetRadius = 260; magnetPullStrength = 0.36; }
    else if (upgradesRef.current.magnetLevel === 4) { magnetRadius = 340; magnetPullStrength = 0.44; }
    else if (upgradesRef.current.magnetLevel === 5) { magnetRadius = 1200; magnetPullStrength = 0.85; } // gravity center

    oresRef.current = oresRef.current.map(ore => {
      const dx = ore.x - player.x;
      const dy = ore.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Pulse graphic animation
      ore.pulseScale += 0.03 * ore.pulseDir;
      if (ore.pulseScale > 1.35 || ore.pulseScale < 0.75) {
        ore.pulseDir *= -1;
      }

      if (dist < magnetRadius) {
        // Gravitational drag coefficient towards centered ship
        const pullDirX = -dx / dist;
        const pullDirY = -dy / dist;
        
        // Items speed up significantly the closer they are
        const velocityAcc = magnetPullStrength * (1 + (magnetRadius - dist) / 100);
        ore.vx += pullDirX * velocityAcc;
        ore.vy += pullDirY * velocityAcc;
        
        // Fast tracking friction to keep items orbiting/heading strictly
        ore.vx *= 0.85;
        ore.vy *= 0.85;
      } else {
        // Idle space friction drift
        ore.vx *= 0.96;
        ore.vy *= 0.96;
      }

      ore.x += ore.vx;
      ore.y += ore.vy;

      return ore;
    });

    // Check ore collection
    oresRef.current = oresRef.current.filter(ore => {
      const dx = ore.x - player.x;
      const dy = ore.y - player.y;
      const collectDist = player.radius + ore.radius;

      if (Math.sqrt(dx * dx + dy * dy) < collectDist) {
        // Collect feedback Spark!
        playCollectSound(ore.type);
        triggerOreSparkExplosion(ore.x, ore.y, ore.color);

        // Track run additions and compile wallet stats
        let awardLabel = '+1 Krystal';
        let walletKey: keyof PlayerStats = 'crystals';

        if (ore.type === 'crystal') {
          setRunCrystals(c => c + 1);
          setStats(curr => {
            const nextStats = { ...curr, crystals: curr.crystals + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = '+1 Krystal';
        } else if (ore.type === 'diamond') {
          setRunDiamonds(d => d + 1);
          setStats(curr => {
            const nextStats = { ...curr, diamonds: curr.diamonds + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = '+1 Diamant';
        } else if (ore.type === 'obsidian') {
          setRunObsidian(o => o + 1);
          setStats(curr => {
            const nextStats = { ...curr, obsidian: curr.obsidian + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = '+1 Obsidián';
        }

        // Add visual text popup floats
        addGainNotification(awardLabel, ore.color);
        return false; // delete from collection
      }
      return true;
    });

    // --- 6. ASTEROID COLLISION DYNAMICS ---
    asteroidsRef.current.forEach(asteroid => {
      // Drift movement updates
      asteroid.x += asteroid.vx;
      asteroid.y += asteroid.vy;
      asteroid.angle += asteroid.angularVelocity;

      // Teleport asteroids if they drift way too far from centered player location
      const pX = player.x;
      const pY = player.y;
      const adx = asteroid.x - pX;
      const ady = asteroid.y - pY;
      const distanceToPlayer = Math.sqrt(adx * adx + ady * ady);

      // Despawn thresholds (>1400px away)
      if (distanceToPlayer > 1300) {
        // Teleport to a smart location downstream or angled front relative to players velocity
        const angleOffset = player.vx || player.vy 
          ? Math.atan2(player.vy, player.vx) + (Math.random() * 1.5 - 0.75)
          : Math.random() * Math.PI * 2;
        
        asteroid.x = pX + Math.cos(angleOffset) * 1100;
        asteroid.y = pY + Math.sin(angleOffset) * 1100;
        
        // Give new speeds heading slightly back
        const pathAngle = angleOffset + Math.PI + (Math.random() * 1.0 - 0.5);
        const spd = Math.random() * 1.3 + 0.4;
        asteroid.vx = Math.cos(pathAngle) * spd;
        asteroid.vy = Math.sin(pathAngle) * spd;
      }
    });

    // Check LASER BULLET HIT ASTEROID
    lasersRef.current.forEach(laser => {
      asteroidsRef.current.forEach(asteroid => {
        // Don't hit same asteroid multiple times with pierce weapon
        if (laser.isPiercing && laser.piercedAsteroidIds.includes(asteroid.id)) {
          return;
        }

        const ldx = laser.x - asteroid.x;
        const ldy = laser.y - asteroid.y;
        const radSum = laser.radius + asteroid.radius;

        if (ldx * ldx + ldy * ldy < radSum * radSum) {
          // HIT CONFIRMED
          asteroid.hp -= laser.damage;
          
          if (laser.isPiercing) {
            laser.piercedAsteroidIds.push(asteroid.id);
            // Pierce beam loses a small portion of energy per block
            laser.vx *= 0.9;
            laser.vy *= 0.9;
          } else {
            // Remove regular laser bullet immediately
            laser.lifetime = laser.maxLifetime; // mark for deletion
          }

          // Trigger particle strike sparks near asteroid collision boundary
          triggerOreSparkExplosion(laser.x, laser.y, '#ffffff');

          // Check destruction
          if (asteroid.hp <= 0) {
            handleAsteroidBlowUp(asteroid);
          } else {
            // Simply play standard high hit chime click
            playExplosionSound('small');
          }
        }
      });
    });

    // Clean marked inactive lasers
    lasersRef.current = lasersRef.current.filter(l => l.lifetime < l.maxLifetime);

    // Check SHIP CRASH INTO ASTEROID
    if (player.invulnerableTime <= 0) {
      asteroidsRef.current.forEach(asteroid => {
        const sdx = player.x - asteroid.x;
        const sdy = player.y - asteroid.y;
        const playerShipHurtDist = player.radius + asteroid.radius - 3; // buffer safety margins

        if (sdx * sdx + sdy * sdy < playerShipHurtDist * playerShipHurtDist) {
          // COLLISION IMPULSE CRASH!
          const angle = Math.atan2(sdy, sdx);
          
          // Bounce ship in opposing direction
          player.vx = Math.cos(angle) * (6 + asteroid.radius * 0.05);
          player.vy = Math.sin(angle) * (6 + asteroid.radius * 0.05);
          player.invulnerableTime = 70; // 70 frames brief recovery red flashing

          // Base damage proportional to rock mass Size
          let rawDmg = 8;
          if (asteroid.size === 'huge') rawDmg = 38;
          else if (asteroid.size === 'large') rawDmg = 24;
          else if (asteroid.size === 'medium') rawDmg = 14;

          // Armor block reduction factor
          const armorMultiplier = Math.max(0.65, 1.0 - (upgradesRef.current.hullLevel - 1) * 0.08); // up to 35% damage reduction at level 5
          const calculatedDmg = Math.round(rawDmg * armorMultiplier);

          playDamageSound();

          // Apply damage calculations shield vs hull
          setShield(currShield => {
            let nextShield = currShield;
            let finalDmgToHull = calculatedDmg;

            if (currShield > 0) {
              if (currShield >= calculatedDmg) {
                nextShield = currShield - calculatedDmg;
                finalDmgToHull = 0;
                addGainNotification(`ŠTÍT ABSORBOVAL: -${calculatedDmg} HP`, '#60a5fa');
              } else {
                finalDmgToHull = calculatedDmg - currShield;
                nextShield = 0;
                addGainNotification('ŠTÍT KOLABOVAL!', '#ef4444');
                playShieldDownSound();
              }
            }

            // Apply remaining hull hits
            if (finalDmgToHull > 0) {
              setHull(currHull => {
                const nextHull = currHull - finalDmgToHull;
                addGainNotification(`POŠKOZENÍ TRUPU: -${finalDmgToHull} HP`, '#f97316');
                
                if (nextHull <= 0) {
                  triggerShipCatastrophicFailure();
                  return 0;
                }
                return nextHull;
              });
            }

            return nextShield;
          });

          // Set Shield recharge start delays
          shieldRegenCooldown.current = 240; // 4 seconds delay before regeneration starts again
        }
      });
    }

    // --- 7. PARTICLES RENDER TICK ---
    particlesRef.current = particlesRef.current.map(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.lifetime++;
      particle.alpha = 1.0 - (particle.lifetime / particle.maxLifetime);
      return particle;
    }).filter(particle => particle.lifetime < particle.maxLifetime);

    // Constant density maintenance of floating asteroid clusters
    populateAsteroidBelt(18);

    // Re-draw canvas scene
    drawGameScene();

    // Trigger next recursive render frame
    animationFrameId.current = requestAnimationFrame(tickGameLoop);
  };

  // --- ASTEROID DESTRUCTION & SUB-SPLIT MECHANIC ---
  const handleAsteroidBlowUp = (asteroid: Asteroid) => {
    playExplosionSound(asteroid.size);
    triggerAsteroidPieceExplosionParticles(asteroid);

    // 1. Add score
    const awardedPoints = asteroid.points;
    const newScore = scoreRef.current + awardedPoints;
    scoreRef.current = newScore;
    setCurrentScore(newScore);

    // 2. Increments total stats
    setStats(curr => {
      const nextStats = {
        ...curr,
        totalAsteroidsMined: curr.totalAsteroidsMined + 1,
        highScore: Math.max(curr.highScore, newScore)
      };
      saveStats(nextStats);
      return nextStats;
    });

    // 3. Drop ores exactly at destroyed core center coordinate
    triggerSpawnAsteroidDrops(asteroid.x, asteroid.y, asteroid.size);

    // 4. Handle Sub-splits (Radial split)
    if (asteroid.size !== 'small') {
      let nextSize: AsteroidSize = 'small';
      let splitCount = 3 + Math.floor(Math.random() * 2); // 3 to 4 smaller pieces splitter

      if (asteroid.size === 'huge') {
        nextSize = 'large';
        splitCount = 2 + Math.floor(Math.random() * 2); // 2 to 3
      } else if (asteroid.size === 'large') {
        nextSize = 'medium';
        splitCount = 2 + Math.floor(Math.random() * 2); // 2 to 3
      } else if (asteroid.size === 'medium') {
        nextSize = 'small';
        splitCount = 3 + Math.floor(Math.random() * 3); // 3 to 5 smaller pieces split
      }

      const generatedShards: Asteroid[] = [];
      const baseAngle = Math.random() * Math.PI * 2;
      
      for (let i = 0; i < splitCount; i++) {
        // Radial directions: distribute smaller shards evenly in a circle around base center
        const radialAngle = baseAngle + (i / splitCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
        
        // Base velocity inherits some momentum from parent rock plus radial push
        const radialPushSpeed = Math.random() * 1.5 + 1.2;
        const vxShip = asteroid.vx * 0.4 + Math.cos(radialAngle) * radialPushSpeed;
        const vyShip = asteroid.vy * 0.4 + Math.sin(radialAngle) * radialPushSpeed;

        // Position slightly offset from destroyed parent center to prevent intersections
        const spawnX = asteroid.x + Math.cos(radialAngle) * (asteroid.radius * 0.45);
        const spawnY = asteroid.y + Math.sin(radialAngle) * (asteroid.radius * 0.45);

        generatedShards.push(
          createProceduralAsteroid(nextSize, spawnX, spawnY, vxShip, vyShip)
        );
      }

      asteroidsRef.current = [...asteroidsRef.current, ...generatedShards];
    }

    // Finally delete from main list
    asteroidsRef.current = asteroidsRef.current.filter(a => a.id !== asteroid.id);
  };

  const triggerShipCatastrophicFailure = () => {
    setIsPlaying(false);
    setIsGameOver(true);
    playExplosionSound('huge');

    // Trigger massive fireworks particles at center screen
    const px = playerRef.current.x;
    const py = playerRef.current.y;
    for (let i = 0; i < 75; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 6.5 + 2.0;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: px,
        y: py,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color: ['#f97316', '#ef4444', '#facc15', '#60a5fa'][Math.floor(Math.random() * 4)],
        size: Math.random() * 5.0 + 2.0,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 60 + Math.floor(Math.random() * 40),
      });
    }

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  };

  // --- VISUAL EFFECT PARTICLE EMITTERS ---
  const triggerAsteroidPieceExplosionParticles = (asteroid: Asteroid) => {
    const particleCount = asteroid.size === 'huge' ? 40 : asteroid.size === 'large' ? 25 : 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.8;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: asteroid.x + (Math.random() * asteroid.radius - asteroid.radius/2),
        y: asteroid.y + (Math.random() * asteroid.radius - asteroid.radius/2),
        vx: Math.cos(angle) * speed + asteroid.vx * 0.3,
        vy: Math.sin(angle) * speed + asteroid.vy * 0.3,
        color: asteroid.color,
        size: Math.random() * 4.0 + 1.0,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 30 + Math.floor(Math.random() * 30),
      });
    }
  };

  const triggerOreSparkExplosion = (ox: number, oy: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1.0;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        size: Math.random() * 3.0 + 1.0,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 15 + Math.floor(Math.random() * 15),
      });
    }
  };

  // --- HTML5 CANVAS RENDER PASS (SCROLLING MAP EFFECT) ---
  const drawGameScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw viewport
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep starry void background fill
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    const player = playerRef.current;
    
    // Physical coordinate system camera center mappings
    const camX = player.x - width / 2;
    const camY = player.y - height / 2;

    // --- A. PARALLAX STARFIELD RENDER ---
    starsRef.current.forEach(star => {
      // Loop star positions symmetrically so stars feel infinite
      let sx = (star.x - player.x * star.speed) % width;
      let sy = (star.y - player.y * star.speed) % height;
      if (sx < 0) sx += width;
      if (sy < 0) sy += height;

      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      
      // Make bright stars glow nicely
      if (star.size > 1.3) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#60a5fa';
      }
      ctx.fill();
      ctx.restore();
    });

    // --- B. PARTICLES RENDER ---
    particlesRef.current.forEach(p => {
      const sx = p.x - camX;
      const sy = p.y - camY;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.restore();
    });

    // --- C. FLOATING ORE DROPS RENDER ---
    oresRef.current.forEach(ore => {
      const sx = ore.x - camX;
      const sy = ore.y - camY;

      // Draw shiny crystal outline shapes
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(ore.pulseScale, ore.pulseScale);
      
      ctx.shadowBlur = 8;
      ctx.shadowColor = ore.color;
      ctx.fillStyle = ore.color;

      ctx.beginPath();
      // Hexagonal diamond gems shapes
      ctx.moveTo(0, -ore.radius);
      ctx.lineTo(ore.radius * 0.8, -ore.radius * 0.3);
      ctx.lineTo(ore.radius * 0.5, ore.radius * 0.8);
      ctx.lineTo(0, ore.radius);
      ctx.lineTo(-ore.radius * 0.5, ore.radius * 0.8);
      ctx.lineTo(-ore.radius * 0.8, -ore.radius * 0.3);
      ctx.closePath();
      ctx.fill();

      // Gleaming top spark sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-ore.radius * 0.2, -ore.radius * 0.2, ore.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // --- D. LASER PROJECTILES RENDER ---
    lasersRef.current.forEach(l => {
      const sx = l.x - camX;
      const sy = l.y - camY;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(l.angle);

      ctx.shadowBlur = l.width * 3;
      ctx.shadowColor = l.color;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width;

      ctx.beginPath();
      // Draw slick elongated laser beam trace line
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.stroke();

      // Glowing core white hot line in center
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, l.width - 2);
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();

      ctx.restore();
    });

    // --- E. ASTEROIDS CLOUD RENDER ---
    asteroidsRef.current.forEach(ast => {
      const sx = ast.x - camX;
      const sy = ast.y - camY;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ast.angle);

      // Neon outline cyberpunk glowing style rocks!
      ctx.strokeStyle = ast.color;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // semi-transparent slate space rock
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      
      ctx.shadowBlur = ast.size === 'huge' ? 5 : 2;
      ctx.shadowColor = ast.color;

      ctx.beginPath();
      ctx.moveTo(ast.vertices[0].x, ast.vertices[0].y);
      for (let i = 1; i < ast.vertices.length; i++) {
        ctx.lineTo(ast.vertices[i].x, ast.vertices[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw subtle cracks / geological veins
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ast.vertices[0].x * 0.4, ast.vertices[0].y * 0.4);
      ctx.moveTo(0, 0);
      ctx.lineTo(ast.vertices[Math.floor(ast.vertices.length / 2)].x * 0.5, ast.vertices[Math.floor(ast.vertices.length / 2)].y * 0.5);
      ctx.stroke();

      // HP bar for huge/large asteroids under assault
      if (ast.hp < ast.maxHp) {
        const hpPercent = ast.hp / ast.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-ast.radius, ast.radius + 10, ast.radius * 2, 5);
        ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(-ast.radius, ast.radius + 10, ast.radius * 2 * hpPercent, 5);
      }

      ctx.restore();
    });

    // --- F. PLAYER MINING SPACESHIP RENDER (CENTER FIXED) ---
    ctx.save();
    // Render ship at precise center of screen view
    ctx.translate(width / 2, height / 2);
    ctx.rotate(player.angle);

    // Give visual damage indicator: Ship flashes if immune / invulnerable
    const isFlashing = player.invulnerableTime > 0 && Math.floor(player.invulnerableTime / 4) % 2 === 0;

    if (isFlashing) {
      ctx.globalAlpha = 0.35; // Draw ghost/transparent indicator instead of nothing!
    }

    // Draw clean Sci-Fi Fighter jet shape
    // Neon glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#60a5fa'; // neon blue shield drive glow

    // 1. Thruster rear fire pulse
    if (player.thrusting) {
      ctx.fillStyle = '#f97316'; // orange flame
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-28 - Math.random() * 8, 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffedd5'; // white hot core
      ctx.beginPath();
      ctx.moveTo(-16, -3);
      ctx.lineTo(-22 - Math.random() * 4, 0);
      ctx.lineTo(-16, 3);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Main Wings & fuselage
    ctx.fillStyle = '#1e293b'; // slate-800 titanium structure
    ctx.strokeStyle = '#38bdf8'; // sky blue glowing panels
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    // Futuristic jet styling
    ctx.moveTo(22, 0);       // Ship nose
    ctx.lineTo(-10, -16);    // Left wing sweep back
    ctx.lineTo(-18, -12);    // Left flap
    ctx.lineTo(-14, -5);     // Rear engine hull left
    ctx.lineTo(-14, 5);      // Rear engine hull right
    ctx.lineTo(-18, 12);     // Right flap
    ctx.lineTo(-10, 16);     // Right wing sweep back
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Cockpit canopy bubble (Jetglass)
    ctx.fillStyle = '#38bdf8'; // glowing cyan
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(0, -5);
    ctx.lineTo(-6, -3);
    ctx.lineTo(-6, 3);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();

    // 4. Heavy weapon muzzle rails based on Upgrade level!
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (upgradesRef.current.laserLevel === 1) {
      // Single central gun barrel
      ctx.moveTo(6, 0);
      ctx.lineTo(18, 0);
    } else if (upgradesRef.current.laserLevel === 2) {
      // Dual heavy gun barrels
      ctx.moveTo(-2, -8); ctx.lineTo(16, -8);
      ctx.moveTo(-2, 8); ctx.lineTo(16, 8);
    } else if (upgradesRef.current.laserLevel === 3) {
      // Triple outriggers
      ctx.moveTo(-2, -10); ctx.lineTo(14, -10);
      ctx.moveTo(6, 0); ctx.lineTo(19, 0);
      ctx.moveTo(-2, 10); ctx.lineTo(14, 10);
    } else {
      // Level 4 Antimatter Cannon rails
      ctx.strokeStyle = '#c084fc'; // purple core
      ctx.moveTo(-5, -6); ctx.lineTo(18, -4);
      ctx.moveTo(-5, 6); ctx.lineTo(18, 4);
      ctx.moveTo(5, -2); ctx.lineTo(21, 0);
      ctx.moveTo(5, 2); ctx.lineTo(21, 0);
    }
    ctx.stroke();

    // 5. Active Energy Shield Bubble Render
    if (upgradesRef.current.shieldLevel > 0 && shield > 0) {
      ctx.save();
      ctx.rotate(-player.angle); // shield bubble is static circle, no rotates
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 + (shield / maxShield) * 0.4})`; // blue glow alpha shifts with remaining shield
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();

    // --- G. ACTIVE MAGNET BOUNDARY GLOW CIRCLE (SUBTLY DRAW RANGE IN SCREEN CARD) ---
    if (upgradesRef.current.magnetLevel > 1 && keysPressed.current['ShiftLeft']) {
      // Highlight pulling radius when holding shift
      let drawMagnetRadius = 100;
      if (upgradesRef.current.magnetLevel === 2) drawMagnetRadius = 180;
      else if (upgradesRef.current.magnetLevel === 3) drawMagnetRadius = 260;
      else if (upgradesRef.current.magnetLevel === 4) drawMagnetRadius = 340;
      else if (upgradesRef.current.magnetLevel === 5) drawMagnetRadius = 1200;

      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(width/2, height/2, drawMagnetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  // --- RE-IGNITE GAME RUN CLEAN ---
  const handleRestartRun = () => {
    handleStartGame();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden select-none font-sans" id="asteroid-miner-applet-root">
      
      {/* 1. BACKGROUND CANVAS */}
      <canvas 
        ref={canvasRef} 
        width={window.innerWidth} 
        height={window.innerHeight} 
        className="absolute inset-0 block w-full h-full z-0 cursor-crosshair bg-[#020617]" 
        id="game-viewport-canvas"
      />

      {/* 2. DOCK GEMS GAINS OVERLAY FLOATING ACTIONS */}
      <div className="absolute inset-0 pointer-events-none z-10 font-mono">
        {gains.map(gain => (
          <div
            key={gain.id}
            className="absolute text-sm font-bold tracking-wider animate-bounce flex items-center gap-1 opacity-90 antialiased"
            style={{ 
              left: `${gain.x}px`, 
              top: `${gain.y}px`,
              color: gain.color,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))'
            }}
          >
            {gain.text}
          </div>
        ))}
      </div>

      {/* 3. GAME HUD INTERACTIVE OVERLAY */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-5" id="game-hud-interface">
          
          {/* TOP HUD ROW: Ores & Score */}
          <div className="w-full flex justify-between items-start gap-4">
            
            {/* Ores Counters Grid */}
            <div className="flex gap-2.5 pointer-events-auto select-none bg-slate-950/80 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-slate-800 shadow-xl">
              {/* Crystals wallet */}
              <div className="flex items-center gap-1.5" title="Krystaly (Běžné platidlo)">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-medium leading-none">Krystaly</span>
                  <span className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{stats.crystals}</span>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-slate-800 shadow-inner mx-1 self-center" />
              
              {/* Blue diamonds */}
              <div className="flex items-center gap-1.5" title="Modré diamanty (Vzácné)">
                <Gem className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-medium leading-none">Diamanty</span>
                  <span className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{stats.diamonds}</span>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-slate-800 shadow-inner mx-1 self-center" />

              {/* Obsidian */}
              <div className="flex items-center gap-1.5" title="Obsidián (Velmi vzácný trupový materiál)">
                <div className="w-3.5 h-3.5 rounded-md bg-purple-600 rotate-45 border border-purple-400 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-medium leading-none">Obsidián</span>
                  <span className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{stats.obsidian}</span>
                </div>
              </div>
            </div>

            {/* Live Score block */}
            <div className="bg-slate-950/85 border border-slate-800 rounded-2xl px-5 py-2.5 flex flex-col items-end shadow-xl min-w-[120px]">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none">SKÓRE</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-1 tracking-tight">{currentScore}</span>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
                <Award className="w-3 h-3 text-slate-500" />
                <span>Nejlepší: {stats.highScore}</span>
              </div>
            </div>

          </div>

          {/* RIGHT FLOATING QUICK GUIDE */}
          <div className="absolute right-4 top-24 pointer-events-auto flex flex-col gap-2 items-end">
            <button 
              onClick={() => setIsShopOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              id="hud-open-shop-button"
            >
              <Zap className="w-4 h-4 fill-current" />
              Obchod (Dokovat)
            </button>
            <div className="flex gap-1">
              <button 
                onClick={handleToggleMute}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white transition-colors hover:bg-slate-900 cursor-pointer"
                title={isMuted ? 'Zapnout zvuk' : 'Vypnout zvuk'}
                id="hud-sound-toggle"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setShowHowTo(curr => !curr)}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white transition-colors hover:bg-slate-900 cursor-pointer"
                title="Ovládání"
                id="hud-help-toggle"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Embedded Mini Controls Card */}
            {showHowTo && (
              <div className="mt-2 bg-slate-950/90 border border-slate-800 p-3 rounded-xl max-w-xs text-xs space-y-1.5 text-slate-300 shadow-2xl animate-fade-in pr-5">
                <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Letový manuál</span>
                <p>• <b>Myš (pohyb):</b> Míření lodě</p>
                <p>• <b>Levé Tlačítko / Mezerník:</b> Střelba lasery</p>
                <p>• <b>Klávesa [ W ] / [ Šipka Nahoru ]:</b> Let vpřed</p>
                <p>• <b>Klávesa [ S ] / [ Šipka Dolů ]:</b> Zpátečka / Brzda</p>
                <p>• <b>Podržet [ SHIFT ]:</b> Zobrazit dosah magnetu</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-900 pt-1">Loď je pevně uprostřed, prostor kolem ní se inteligentně posouvá.</p>
              </div>
            )}
          </div>

          {/* BOTTOM ROW STATE METERS: Hull & Shields */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto pointer-events-auto bg-slate-950/90 border border-slate-850 p-3.5 sm:p-4 rounded-2xl shadow-2xl space-y-2.5 select-none self-center">
            
            {/* Health (Hull) Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 uppercase font-bold text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Stav trupu
                </span>
                <span className="text-orange-400 font-bold">{hull} / {maxHull} HP</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full border border-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${hull > 40 ? 'bg-orange-500' : 'bg-red-600 animate-pulse'}`}
                  style={{ width: `${(hull / maxHull) * 100}%` }}
                />
              </div>
            </div>

            {/* Shield Bar (if upgraded) */}
            {upgrades.shieldLevel > 0 ? (
              <div className="space-y-1 animate-fade-in">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1 uppercase font-bold text-[10px]">
                    <Shield className="w-3 h-3 text-blue-400 fill-current" />
                    Energetický štít
                  </span>
                  <span className="text-blue-400 font-bold">{Math.round(shield)} / {maxShield} HP</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full border border-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-blue-400 transition-all duration-100 shadow-md shadow-blue-500/50"
                    style={{ width: `${(shield / maxShield) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 text-center font-bold tracking-wider uppercase border border-dashed border-slate-800/80 py-1.5 rounded-lg">
                Energetické štíty chybí • Dokuj v doku a kup štít!
              </div>
            )}

            {/* Current Ship Stats Indicator Summary */}
            <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase bg-slate-950 border border-slate-900 rounded-lg p-1.5 px-2.5">
              <span>Trysky: Lvl {upgrades.engineLevel}</span>
              <span>•</span>
              <span>Zbraň: Lvl {upgrades.laserLevel}</span>
              <span>•</span>
              <span>Magnet: Lvl {upgrades.magnetLevel}</span>
            </div>

          </div>

        </div>
      )}

      {/* 4. INTRO PORTAL GREETING SCREEN (START SCREEN) */}
      {showIntro && (
        <div 
          className="absolute inset-0 z-30 bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 overflow-y-auto"
          id="space-intro-portal"
        >
          {/* Constellation backplate graphics */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

          <div className="w-full max-w-xl text-center space-y-6 sm:space-y-8 z-10 p-5 sm:p-8 bg-slate-900/40 border border-slate-850 rounded-2xl md:backdrop-blur-md">
            
            {/* Game Badge title */}
            <div className="space-y-2 flex flex-col items-center">
              <div className="flex items-center gap-2 bg-indigo-950 border border-indigo-800/40 px-3 py-1.5 rounded-full text-[10px] tracking-widest font-black uppercase text-indigo-400 shadow-inner">
                <Compass className="w-3.5 h-3.5" />
                Vesmírný simulátor těžaře
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-amber-400 to-indigo-500 tracking-tight select-none">
                ASTEROID MINER
              </h1>
              <p className="text-sm font-medium text-slate-400 font-mono tracking-tight max-w-md mx-auto uppercase mt-1">
                Těžařská mise začíná hned za mateřským hangárem!
              </p>
            </div>

            {/* Feature Bento overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="bg-slate-950/55 p-3.5 rounded-xl border border-slate-850">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />
                <h4 className="text-xs font-black uppercase text-slate-200 mt-1">Krystaly</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  Běžná minerální ruda vytěžená z jader. Slouží k opravám trupu a nákupu základní plazmových děl.
                </p>
              </div>

              <div className="bg-slate-950/55 p-3.5 rounded-xl border border-slate-850">
                <Gem className="w-4 h-4 text-blue-400 inline-block mb-1" />
                <h4 className="text-xs font-black uppercase text-slate-200">Diamanty</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  Vzácný modrý drahokam z jader tlustých asteroidů. Nutný pro kalibrace magnetu a nákup složitých štítů.
                </p>
              </div>

              <div className="bg-slate-950/55 p-3.5 rounded-xl border border-slate-850">
                <div className="w-3 h-3 bg-purple-500 rotate-45 border border-purple-300 inline-block mb-1.5" />
                <h4 className="text-xs font-black uppercase text-slate-200 mt-0.5">Obsidián</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  Ultra vzácná vesmírná vyvřelina. Těžká a masivní struktura, kterou potřebuješ na pancíř trupu a ultimátní lasery.
                </p>
              </div>
            </div>

            {/* Fleet manual / controls details */}
            <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl space-y-2.5 text-left text-xs text-slate-300">
              <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] block">Letové operace lodi</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-300 font-mono">
                <div>• <b>Myš (pohyb):</b> Otáčení lodě</div>
                <div>• <b>Klávesa [ W / S ]:</b> Plyn / Brzda</div>
                <div>• <b>Klik / Mezerník:</b> Střelba</div>
                <div>• <b>[ SHIFT ]:</b> Zobrazit dosah magnetu</div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1.5 border-t border-slate-900 leading-normal">
                <b>Fixed-Position mechanika:</b> Lodní trup je stabilně vystředěný na obrazovce, zatímco vesmírné prostředí drží koordinované posouvání, což ti dává maximální přehled nad nebe bez zbytečných okrajových mantinelů!
              </p>
            </div>

            {/* Launch Actions */}
            <div className="space-y-3 flex flex-col items-center">
              <button
                onClick={handleStartGame}
                className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/10 cursor-pointer hover:scale-105 active:scale-95 transition-all text-center"
                id="portal-launch-run-btn"
              >
                <Play className="w-4 h-4 fill-current" />
                Spustit Motory a Vzlétnout
              </button>

              {/* Reset Game Save and sound options */}
              <div className="flex gap-4 text-xs font-mono text-slate-500 hover:text-slate-400">
                <button
                  onClick={handleToggleMute}
                  className="hover:text-slate-300 cursor-pointer flex items-center gap-1.5"
                  id="portal-sound-toggle"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isMuted ? 'Zvuk: Vypnut' : 'Zvuk: Zapnut'}</span>
                </button>
                <span>•</span>
                <button 
                  onClick={handleResetGameSave} 
                  className="hover:text-red-400 transition-colors cursor-pointer text-slate-500 text-left"
                  id="portal-reset-save-btn"
                >
                  Smazat herní uložený postup
                </button>
              </div>
            </div>

            {/* Developer bottom credit */}
            {stats.highScore > 0 && (
              <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-500 font-mono">
                <span>Zapsaný High Score: <b className="text-amber-500">{stats.highScore}</b></span>
                <span>Vytěženo asteroidů: <b className="text-blue-400">{stats.totalAsteroidsMined}</b></span>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 5. GAME OVER DIALOG CARD OVERLAY */}
      {isGameOver && (
        <div 
          className="absolute inset-0 z-35 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          id="game-over-dialog"
        >
          <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-6 text-center space-y-6 animate-scale-up text-slate-100">
            
            <div className="space-y-1">
              <div className="w-16 h-16 bg-red-950/50 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500 shadow-md">
                <RotateCcw className="w-8 h-8 rotate-45 animate-spin-slow" />
              </div>
              <h2 className="text-2xl font-black text-red-500 tracking-tight uppercase pt-2">
                Pancíř Zničen!
              </h2>
              <p className="text-xs text-slate-400 font-mono">Vaše těžební loď utrpěla fatální kolizi s asteroidem</p>
            </div>

            {/* Statistics details from current run */}
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3.5 text-left text-sm font-medium">
              
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">Skóre mise:</span>
                <span className="text-amber-400 font-black font-mono text-base">{currentScore}</span>
              </div>

              <div className="w-full h-[1px] bg-slate-900" />
              
              <h4 className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Zabezpečené Ores:</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-950/20 border border-emerald-900/10 p-2 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1" />
                  <span className="text-slate-400 font-mono flex flex-col mt-1">
                    <b className="text-slate-100 font-black text-sm pr-1">{runCrystals}</b> Krystalů
                  </span>
                </div>
                <div className="bg-blue-950/20 border border-blue-900/10 p-2 rounded-lg">
                  <Gem className="w-3.5 h-3.5 text-blue-400 mx-auto" />
                  <span className="text-slate-400 font-mono flex flex-col mt-0.5">
                    <b className="text-slate-100 font-black text-sm pr-1">{runDiamonds}</b> Diamantů
                  </span>
                </div>
                <div className="bg-purple-950/20 border border-purple-900/10 p-2 rounded-lg">
                  <span className="w-2.5 h-2.5 bg-purple-600 rotate-45 border border-purple-300 inline-block mr-1" />
                  <span className="text-slate-400 font-mono flex flex-col mt-1">
                    <b className="text-slate-100 font-black text-sm pr-1">{runObsidian}</b> Obsidiánu
                  </span>
                </div>
              </div>

              <div className="w-full h-[1px] bg-slate-900" />

              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>Vytěžené celkové hromady:</span>
                <span className="text-slate-200 font-bold font-sans">{stats.totalAsteroidsMined}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>Historické High Score:</span>
                <span className="text-amber-400 font-bold">{stats.highScore}</span>
              </div>

            </div>

            {/* Dialog Action CTA options */}
            <div className="space-y-2.5">
              <button
                onClick={handleRestartRun}
                className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg hover:scale-[1.01]"
                id="gameover-restart-btn"
              >
                Letět Znovu (Opětovný Odpal)
              </button>
              <button
                onClick={() => {
                  setIsGameOver(false);
                  setShowIntro(true);
                }}
                className="w-full py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                id="gameover-menu-btn"
              >
                Návrat do Hlavního Menu
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. SLIDING UPGRADE SHOP DRAWER ELEMENT */}
      <UpgradeShop
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        upgrades={upgrades}
        stats={stats}
        onUpgrade={handleUpgrade}
        onRepair={handleRepair}
        onRechargeShield={handleRechargeShield}
        currentHull={hull}
        maxHull={maxHull}
        currentShield={shield}
        maxShield={maxShield}
      />

    </div>
  );
}
