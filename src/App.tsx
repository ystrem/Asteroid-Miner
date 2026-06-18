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
  OreType,
  Player,
  Pirate,
  PirateLaser
} from './types';
import { 
  playLaserSound, 
  playExplosionSound, 
  playCollectSound, 
  playDamageSound, 
  playShieldDownSound, 
  playUpgradeSound,
  getSoundState, 
  toggleSound,
  updateEngineHum
} from './utils/audio';
import { 
  loadUpgrades, 
  saveUpgrades, 
  loadStats, 
  saveStats, 
  resetGameSave 
} from './utils/storage';
import UpgradeShop from './components/UpgradeShop';
import AsteroidExplorer from './components/AsteroidExplorer';
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
  HelpCircle,
  Gamepad,
  User,
  Users
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
  const [gameMode, setGameMode] = useState<'single' | 'coop'>('single');
  const [gamepadsDetected, setGamepadsDetected] = useState<boolean[]>([false, false]);

  // Floating notifications/gains to display on screen
  const [gains, setGains] = useState<{ id: string; text: string; x: number; y: number; color: string }[]>([]);

  // HUD stats synchronizers
  // Player 1
  const [hull, setHull] = useState<number>(100);
  const [maxHull, setMaxHull] = useState<number>(100);
  const [shield, setShield] = useState<number>(0);
  const [maxShield, setMaxShield] = useState<number>(0);

  // Player 2
  const [p2Hull, setP2Hull] = useState<number>(100);
  const [p2MaxHull, setP2MaxHull] = useState<number>(100);
  const [p2Shield, setP2Shield] = useState<number>(0);
  const [p2MaxShield, setP2MaxShield] = useState<number>(0);

  const [currentScore, setCurrentScore] = useState<number>(0);
  const [runCrystals, setRunCrystals] = useState<number>(0);
  const [runDiamonds, setRunDiamonds] = useState<number>(0);
  const [runObsidian, setRunObsidian] = useState<number>(0);

  // Active ability states for display in HUD (cooldowns in seconds, active time)
  const [lightningCooldown, setLightningCooldown] = useState<number>(0);
  const [pulseCooldown, setPulseCooldown] = useState<number>(0);
  const [superMagnetCooldown, setSuperMagnetCooldown] = useState<number>(0);
  const [superMagnetActive, setSuperMagnetActive] = useState<number>(0);

  // --- REFS FOR PHYSICS GAME LOOP (Buttery 60fps) ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game entities - Multiple dynamic players support with drop-in/drop-out
  const playersRef = useRef<Player[]>([]);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);

  // Smooth camera track positions
  const lastCamXRef = useRef<number>(0);
  const lastCamYRef = useRef<number>(0);

  const asteroidsRef = useRef<Asteroid[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  const oresRef = useRef<Ore[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastInputDeviceRef = useRef<'keyboard' | 'gamepad'>('keyboard');
  const touchJoystick = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  });

  const animationFrameId = useRef<number | null>(null);
  const shieldRegenCooldown = useRef<number>(0);
  const p1ReviveTimerRef = useRef<number>(0);
  const p2ReviveTimerRef = useRef<number>(0);

  // Stable refs for values used inside the high-frequency physics game loop
  const upgradesRef = useRef<Upgrades>(upgrades);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isShopOpenRef = useRef<boolean>(isShopOpen);
  const scoreRef = useRef<number>(0);
  const maxHullRef = useRef<number>(100);
  const maxShieldRef = useRef<number>(0);

  const lightningCooldownRef = useRef<number>(0);
  const pulseCooldownRef = useRef<number>(0);
  const superMagnetCooldownRef = useRef<number>(0);
  const superMagnetActiveRef = useRef<number>(0);

  const gameModeRef = useRef<'single' | 'coop'>('single');

  // Astronaut explorer minigame state
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(false);
  const isExplorerOpenRef = useRef<boolean>(false);
  const [explorerAsteroidData, setExplorerAsteroidData] = useState<{
    type: 'magma' | 'frost' | 'crystal' | 'normal';
    radius: number;
    color: string;
    name: string;
  } | null>(null);

  // Brainstorm mechanics states & refs
  const [solarStormActive, setSolarStormActive] = useState<boolean>(false);
  const [solarStormWarning, setSolarStormWarning] = useState<number>(0);
  const solarStormActiveRef = useRef<boolean>(false);
  const solarStormTimeRef = useRef<number>(1500); // Ticks until next storm warning/check
  const solarStormDurationRef = useRef<number>(0); // Duration of active storm
  const solarStormDirectionRef = useRef<number>(Math.PI / 2); // Downward wind (pi/2)

  const piratesRef = useRef<Pirate[]>([]);
  const pirateLasersRef = useRef<PirateLaser[]>([]);
  const lastGamepadButtonsRef = useRef<{ [key: string]: boolean }>({});
  const keyboardOrMousePressedRef = useRef<boolean>(false);
  const gamepadOnlyStartRef = useRef<number | null>(null);

  const toggleAnchor = (p: Player) => {
    if (p.anchoredAsteroidId) {
      p.anchoredAsteroidId = undefined;
      p.isDrilling = false;
      addGainNotification(`🔌 ${p.name} UVOLNIL KOTVU`, p.color);
      playExplosionSound('small');
      return;
    }

    // Find closest anchorable asteroid
    let closestAst: Asteroid | null = null;
    let minDist = 999999;
    asteroidsRef.current.forEach(ast => {
      const dist = Math.hypot(p.x - ast.x, p.y - ast.y);
      if (dist < minDist) {
        minDist = dist;
        closestAst = ast;
      }
    });

    if (closestAst) {
      const ast = closestAst as Asteroid;
      const margin = ast.radius + p.radius + 35;
      if (minDist <= margin) {
        p.anchoredAsteroidId = ast.id;
        p.anchorRadius = minDist;
        // Keep angle delta relative to current asteroid spin
        p.anchorAngle = Math.atan2(p.y - ast.y, p.x - ast.x) - ast.angle;
        p.isDrilling = true;
        p.drillTime = 0;
        addGainNotification(`🔗 ${p.name} SE PŘICHYTIL K ASTEROIDU`, p.color);
        playUpgradeSound();
        triggerOreSparkExplosion(p.x, p.y, p.color);
      } else {
        addGainNotification(`❌ PŘÍLIŠ DALEKO PRO KOTVENÍ`, '#64748b');
      }
    }
  };


  // Synchronize state values to refs inside effect
  useEffect(() => {
    upgradesRef.current = upgrades;

    // Apply limits dynamically to all active player ships
    const calculatedMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel >= 5 ? 20 : 0) + (upgrades.hullLevel >= 6 ? 30 : 0);
    const calculatedMaxShield = upgrades.shieldLevel > 0 
      ? 50 + (upgrades.shieldLevel - 1) * 30 + (upgrades.shieldLevel >= 4 ? 10 : 0) + (upgrades.shieldLevel >= 5 ? 10 : 0)
      : 0;

    maxHullRef.current = calculatedMaxHull;
    maxShieldRef.current = calculatedMaxShield;
    setMaxHull(calculatedMaxHull);
    setMaxShield(calculatedMaxShield);

    playersRef.current.forEach(p => {
      p.maxHull = calculatedMaxHull;
      p.maxShield = calculatedMaxShield;
      p.hull = Math.min(calculatedMaxHull, p.hull);
      p.shield = Math.min(calculatedMaxShield, p.shield);
    });
    setActivePlayers([...playersRef.current]);
  }, [upgrades]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      updateEngineHum(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    isShopOpenRef.current = isShopOpen;
  }, [isShopOpen]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

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

  // --- DYNAMIC JOIN AND LEAVE HANDLERS (DROP-IN / DROP-OUT) ---
  const joinPlayer = (source: 'keyboard_p1' | 'keyboard_p2' | 'gamepad', gamepadIdx: number | null = null) => {
    // Check if configuration already active
    const exists = playersRef.current.some(p => p.inputSource === source && (source !== 'gamepad' || p.gamepadIndex === gamepadIdx));
    if (exists) return;

    if (playersRef.current.length >= 4) {
      addGainNotification('Mise plná: Max 4 těžaři!', '#ef4444');
      return;
    }

    const playerNum = playersRef.current.length > 0 
      ? Math.max(...playersRef.current.map(p => p.playerNum)) + 1 
      : 1;

    let pColor = '#22d3ee'; // standard cyan (P1)
    let pGlow = '#60a5fa';
    let pName = `Hráč ${playerNum}`;

    if (source === 'keyboard_p1') {
      pColor = '#22d3ee';
      pGlow = '#60a5fa';
      pName = 'Hráč 1 (P_Aktivní)';
    } else if (source === 'keyboard_p2') {
      pColor = '#c084fc';
      pGlow = '#a855f7';
      pName = 'Hráč 2 (P_WASD)';
    } else if (source === 'gamepad') {
      const idx = gamepadIdx || 0;
      if (idx === 0) {
        pColor = '#fb923c'; // Orange
        pGlow = '#f97316';
        pName = `Hráč ${playerNum} (Ovladač 1)`;
      } else {
        pColor = '#4ade80'; // Emerald
        pGlow = '#22c55e';
        pName = `Hráč ${playerNum} (Ovladač ${idx + 1})`;
      }
    }

    const calculatedMaxHull = 100 + (upgradesRef.current.hullLevel - 1) * 50 + (upgradesRef.current.hullLevel >= 5 ? 20 : 0) + (upgradesRef.current.hullLevel >= 6 ? 30 : 0);
    const calculatedMaxShield = upgradesRef.current.shieldLevel > 0 
      ? 50 + (upgradesRef.current.shieldLevel - 1) * 30 + (upgradesRef.current.shieldLevel >= 4 ? 10 : 0) + (upgradesRef.current.shieldLevel >= 5 ? 10 : 0)
      : 0;

    // Anchor position based on any already active player or canvas center
    const anchor = playersRef.current[0];
    const spawnX = anchor ? anchor.x + (Math.random() * 100 - 50) : 0;
    const spawnY = anchor ? anchor.y + (Math.random() * 100 - 50) : 0;

    const newPlayer: Player = {
      playerNum,
      id: `${source}_${gamepadIdx !== null ? gamepadIdx : ''}`,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      thrusting: false,
      reversing: false,
      radius: 20,
      invulnerableTime: 120,
      lastFired: 0,
      hull: calculatedMaxHull,
      maxHull: calculatedMaxHull,
      shield: calculatedMaxShield,
      maxShield: calculatedMaxShield,
      reviveTimer: 0,
      color: pColor,
      glowColor: pGlow,
      name: pName,
      inputSource: source,
      gamepadIndex: gamepadIdx
    };

    playersRef.current.push(newPlayer);
    setActivePlayers([...playersRef.current]);
    addGainNotification(`🚀 ${pName} SE PŘIPOJIL K TĚŽBĚ!`, pColor);
  };

  const leavePlayer = (id: string) => {
    const player = playersRef.current.find(p => p.id === id);
    if (!player) return;

    if (playersRef.current.length <= 1) {
      addGainNotification('Mise vyžaduje aspoň jednoho aktivního těžaře!', '#ef4444');
      return;
    }

    playersRef.current = playersRef.current.filter(p => p.id !== id);
    setActivePlayers([...playersRef.current]);
    addGainNotification(`🔌 ${player.name} SE ODPOJIL`, '#94a3b8');
  };

  // --- KEYBOARD & GAMEPAD EVENT HANDLERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressed.current[code] = true;
      lastInputDeviceRef.current = 'keyboard';
      keyboardOrMousePressedRef.current = true;

      if (isPlaying && !isShopOpen) {
        // Dynamic drop-in detection for Player 1 (Keyboard Arrows)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlRight', 'Digit7', 'Digit8', 'Digit9', 'KeyH', 'Digit0', 'Numpad0'].includes(code)) {
          const hasP1 = playersRef.current.some(p => p.inputSource === 'keyboard_p1');
          if (!hasP1) {
            joinPlayer('keyboard_p1');
          }
        }

        // Dynamic drop-in detection for Player 2 (Keyboard WASD)
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ControlLeft', 'Digit1', 'Digit2', 'Digit3', 'KeyG', 'Digit4', 'Numpad4'].includes(code)) {
          const hasP2 = playersRef.current.some(p => p.inputSource === 'keyboard_p2');
          if (!hasP2) {
            joinPlayer('keyboard_p2');
          }
        }

        // Anchor keys triggers
        if (code === 'KeyH' || code === 'Digit0' || code === 'Numpad0') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) toggleAnchor(p1);
        }
        if (code === 'KeyG' || code === 'Digit4' || code === 'Numpad4') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) toggleAnchor(p2);
        }

        // Surface disembark triggers on Enter or KeyX when any player is anchored
        if (code === 'Enter' || code === 'KeyX' || code === 'KeyN') {
          const isAnyPlayerAnchored = playersRef.current.some(p => p.anchoredAsteroidId);
          if (isAnyPlayerAnchored) {
            handleOpenExplorer();
          }
        }

        // Ability bindings based on player associations
        if (code === 'KeyQ' || code === 'Digit9' || code === 'Numpad9') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerChainLightning(p1.playerNum);
        } else if (code === 'KeyE' || code === 'Digit8' || code === 'Numpad8') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerPulseWaveRing(p1.playerNum);
        } else if (code === 'KeyR' || code === 'Digit7' || code === 'Numpad7') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerSuperMagnetVacuum(p1.playerNum);
        }

        // Player 2 abilities mapping (Numbers 1, 2, 3)
        if (code === 'Digit1' || code === 'Numpad1') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerChainLightning(p2.playerNum);
        } else if (code === 'Digit2' || code === 'Numpad2') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerPulseWaveRing(p2.playerNum);
        } else if (code === 'Digit3' || code === 'Numpad3') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerSuperMagnetVacuum(p2.playerNum);
        }
      }

      // Prevent window scrolling with Arrow keys, WASD, or Spacebar
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(code) && isPlaying && !isShopOpen) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      lastInputDeviceRef.current = 'keyboard';
      keyboardOrMousePressedRef.current = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - mousePos.current.x;
      const dy = e.clientY - mousePos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        lastInputDeviceRef.current = 'keyboard';
        keyboardOrMousePressedRef.current = true;
      }
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = () => {
      keysPressed.current['MouseDown'] = true;
      lastInputDeviceRef.current = 'keyboard';
      keyboardOrMousePressedRef.current = true;
    };

    const handleMouseUp = () => {
      keysPressed.current['MouseDown'] = false;
      lastInputDeviceRef.current = 'keyboard';
      keyboardOrMousePressedRef.current = true;
    };

    const handleGamepadConnect = () => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const updated = [false, false];
      let foundCount = 0;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          if (foundCount < 2) {
            updated[foundCount] = true;
            foundCount++;
          }
        }
      }
      setGamepadsDetected(updated);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('gamepadconnected', handleGamepadConnect);
    window.addEventListener('gamepaddisconnected', handleGamepadConnect);

    // Initial check for already connected gamepads right on mount
    handleGamepadConnect();
    // Periodically poll for gamepads to ensure absolute reliability
    const gamepadPollInterval = setInterval(handleGamepadConnect, 1000);

    // Rapidly poll gamepads when in intro menu to support gamepad-only startup
    const introGamepadPollInterval = setInterval(() => {
      if (!isPlayingRef.current) {
        const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
          const gp = gamepads[i];
          if (gp) {
            const anyButtonPressed = gp.buttons.some(b => b.pressed);
            if (anyButtonPressed) {
              gamepadOnlyStartRef.current = i;
              handleStartGame();
              break;
            }
          }
        }
      }
    }, 50);

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
      window.removeEventListener('gamepadconnected', handleGamepadConnect);
      window.removeEventListener('gamepaddisconnected', handleGamepadConnect);
      clearInterval(gamepadPollInterval);
      clearInterval(introGamepadPollInterval);
      window.removeEventListener('resize', handleResize);
      updateEngineHum(false);
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
    customVy?: number,
    forcedType?: 'common' | 'magma' | 'ice' | 'crystal'
  ): Asteroid => {
    let px = 0;
    let py = 0;
    const anchorPlayer = playersRef.current.find(pl => pl.hull > 0) || playersRef.current[0];
    if (anchorPlayer) {
      px = anchorPlayer.x;
      py = anchorPlayer.y;
    }

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

    let asteroidType: 'common' | 'magma' | 'ice' | 'crystal' = forcedType || 'common';
    let color = ASTEROID_COLORS[size];

    if (!forcedType) {
      const typeRoll = Math.random();
      if (typeRoll < 0.16) {
        asteroidType = 'magma';
      } else if (typeRoll < 0.32) {
        asteroidType = 'ice';
      } else if (typeRoll < 0.44) {
        asteroidType = 'crystal';
      }
    }

    if (asteroidType === 'magma') {
      color = '#f97316'; // glowing fiery orange-red
    } else if (asteroidType === 'ice') {
      color = '#38bdf8'; // glowing ice cyan
    } else if (asteroidType === 'crystal') {
      color = '#a855f7'; // glowing psychic purple
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
      color,
      points,
      asteroidType,
      tempState: 'normal',
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

    // Calculate initial armor hull strength and shields limits based on current run upgrades
    const calculatedMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel >= 5 ? 20 : 0) + (upgrades.hullLevel >= 6 ? 30 : 0);
    const calculatedMaxShield = upgrades.shieldLevel > 0 
      ? 100 + (upgrades.shieldLevel - 1) * 35 
      : 0;

    // Re-initialize player locations and statuses
    playersRef.current = [];

    if (gamepadOnlyStartRef.current !== null) {
      const i = gamepadOnlyStartRef.current;
      const pColor = i === 0 ? '#fb923c' : '#4ade80';
      const pGlow = i === 0 ? '#f97316' : '#22c55e';
      const pName = `Hráč 1 (Ovladač ${i + 1})`;

      const pGamepad: Player = {
        playerNum: 1,
        id: `gamepad_${i}`,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        thrusting: false,
        reversing: false,
        radius: 20,
        invulnerableTime: 60,
        lastFired: 0,
        hull: calculatedMaxHull,
        maxHull: calculatedMaxHull,
        shield: calculatedMaxShield,
        maxShield: calculatedMaxShield,
        reviveTimer: 0,
        color: pColor,
        glowColor: pGlow,
        name: pName,
        inputSource: 'gamepad',
        gamepadIndex: i
      };
      playersRef.current.push(pGamepad);
    } else {
      const p1: Player = {
        playerNum: 1,
        id: 'keyboard_p1_',
        x: gameMode === 'coop' ? -60 : 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        thrusting: false,
        reversing: false,
        radius: 20,
        invulnerableTime: 60,
        lastFired: 0,
        hull: calculatedMaxHull,
        maxHull: calculatedMaxHull,
        shield: calculatedMaxShield,
        maxShield: calculatedMaxShield,
        reviveTimer: 0,
        color: '#22d3ee', // Cyan
        glowColor: '#60a5fa',
        name: 'Hráč 1 (P_Aktivní)',
        inputSource: 'keyboard_p1',
        gamepadIndex: null
      };
      playersRef.current.push(p1);

      if (gameMode === 'coop') {
        const p2: Player = {
          playerNum: 2,
          id: 'keyboard_p2_',
          x: 60,
          y: 0,
          vx: 0,
          vy: 0,
          angle: -Math.PI / 2,
          targetAngle: -Math.PI / 2,
          thrusting: false,
          reversing: false,
          radius: 20,
          invulnerableTime: 60,
          lastFired: 0,
          hull: calculatedMaxHull,
          maxHull: calculatedMaxHull,
          shield: calculatedMaxShield,
          maxShield: calculatedMaxShield,
          reviveTimer: 0,
          color: '#c084fc', // Purple
          glowColor: '#a855f7',
          name: 'Hráč 2 (P_WASD)',
          inputSource: 'keyboard_p2',
          gamepadIndex: null
        };
        playersRef.current.push(p2);
      }
    }

    // Reset tracking refs for a clean run
    gamepadOnlyStartRef.current = null;
    keyboardOrMousePressedRef.current = false;

    setActivePlayers([...playersRef.current]);

    // Initial entities clear
    asteroidsRef.current = [];
    lasersRef.current = [];
    oresRef.current = [];
    particlesRef.current = [];
    piratesRef.current = [];
    pirateLasersRef.current = [];
    setSolarStormActive(false);
    solarStormActiveRef.current = false;
    solarStormTimeRef.current = 1500;
    solarStormDurationRef.current = 0;

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

    addGainNotification(`ZAKOUPENO: ${id === 'laserLevel' ? 'Úroveň laseru ' : id === 'magnetLevel' ? 'Úroveň magnetu ' : 'Úroveň modulu '}${nextLevel}`, '#f59e0b');
  };

  const handleRepair = (cost: number, healAmount: number) => {
    if (stats.crystals < cost) return;

    const updatedStats = {
      ...stats,
      crystals: stats.crystals - cost,
    };

    setStats(updatedStats);
    saveStats(updatedStats);

    const calculatedMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel >= 5 ? 20 : 0) + (upgrades.hullLevel >= 6 ? 30 : 0);

    setHull(calculatedMaxHull);
    setP2Hull(calculatedMaxHull);

    playersRef.current.forEach(p => {
      p.hull = calculatedMaxHull;
      p.reviveTimer = 0; // stop death timer and revive fully
    });

    setActivePlayers([...playersRef.current]);

    addGainNotification('TRUPY CELÉ LETKY PLNĚ OPRAVENY (100%)', '#10b981');
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

  // --- SURFACE EXPLORATION ATOM EXPLORER SYSTEM IMPLEMENTATION ---
  const findAnchoredAsteroid = () => {
    const p = playersRef.current.find(pl => pl.anchoredAsteroidId);
    if (!p) return null;
    return asteroidsRef.current.find(a => a.id === p.anchoredAsteroidId);
  };

  const handleOpenExplorer = () => {
    const ast = findAnchoredAsteroid();
    if (!ast) return;
    
    let type: 'magma' | 'frost' | 'crystal' | 'normal' = 'normal';
    if (ast.type === 'magma') type = 'magma';
    else if (ast.type === 'frost') type = 'frost';
    else if (ast.type === 'crystal') type = 'crystal';

    setExplorerAsteroidData({
      type,
      radius: ast.radius,
      color: ast.color || '#475569',
      name: ast.name || 'Neznámý Planetoid'
    });
    
    setIsExplorerOpen(true);
    isExplorerOpenRef.current = true;
    updateEngineHum(false);
  };

  const handleCloseExplorer = (minedCrystals: number, minedDiamonds: number, minedObsidians: number, scoreBonus: number) => {
    setIsExplorerOpen(false);
    isExplorerOpenRef.current = false;
    setExplorerAsteroidData(null);

    // Save resources into wallet stats
    const updatedStats = {
      ...stats,
      crystals: stats.crystals + minedCrystals,
      diamonds: stats.diamonds + minedDiamonds,
      obsidians: stats.obsidians + minedObsidians,
      highScore: Math.max(stats.highScore, scoreRef.current + scoreBonus)
    };
    setStats(updatedStats);
    saveStats(updatedStats);

    // Credit score
    const newScore = scoreRef.current + scoreBonus;
    scoreRef.current = newScore;
    setCurrentScore(newScore);

    // Show nice summary notifications
    addGainNotification(`💎 EXPEDICE POVRCHU DOKONČENA!`, '#10b981');
    if (minedCrystals > 0) addGainNotification(`+${minedCrystals} Krystalů`, '#10b981');
    if (minedDiamonds > 0) addGainNotification(`+${minedDiamonds} Diamantů`, '#38bdf8');
    if (minedObsidians > 0) addGainNotification(`+${minedObsidians} Obsidiánů`, '#f43f5e');
    addGainNotification(`+${scoreBonus} Bodů do skóre`, '#eab308');
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
  const fireActiveLaser = (player: Player, playerNum: number) => {
    const now = Date.now();
    
    // Fire rates depend on weapon tier
    let cooldown = 350;
    if (upgradesRef.current.laserLevel === 2) cooldown = 280;
    if (upgradesRef.current.laserLevel === 3) cooldown = 200;
    if (upgradesRef.current.laserLevel === 4) cooldown = 300;

    if (now - player.lastFired < cooldown) return;
    player.lastFired = now;

    // Laser properties
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

    // Use player-assigned color as core bullet color, adapting hues beautifully!
    const bulletColor = player.color;

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
        color: bulletColor,
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
        color: bulletColor,
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
          color: bulletColor,
          lifetime: 0,
          maxLifetime: 60,
        };
        lasersRef.current.push(laser);
      });
    } 
    else if (upgradesRef.current.laserLevel === 4) {
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
        color: bulletColor,
        lifetime: 0,
        maxLifetime: 100,
      };
      lasersRef.current.push(laser);
    }
    else {
      // Level 5: Quantum Cascade (5 lasers!)
      // 1. Heavy central piercing laser
      const laserCenter: Laser = {
        id: Math.random().toString(36).substring(2, 9),
        x: sx,
        y: sy,
        vx: cos * 12.5,
        vy: sin * 12.5,
        angle: player.angle,
        damage: 5,
        isPiercing: true,
        piercedAsteroidIds: [],
        radius: 5,
        width: 4.5,
        color: '#facc15', // Gold quantum energy central beam
        lifetime: 0,
        maxLifetime: 80,
      };
      lasersRef.current.push(laserCenter);

      // 2. Twin angled scatter shots
      const anglesScatter = [-0.18, 0.18];
      anglesScatter.forEach(offsetAngle => {
        const theta = player.angle + offsetAngle;
        const sCos = Math.cos(theta);
        const sSin = Math.sin(theta);
        const laser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: player.x + sCos * 22,
          y: player.y + sSin * 22,
          vx: sCos * 10,
          vy: sSin * 10,
          angle: theta,
          damage: 2.2,
          isPiercing: false,
          piercedAsteroidIds: [],
          radius: 3,
          width: 3,
          color: bulletColor,
          lifetime: 0,
          maxLifetime: 60,
        };
        lasersRef.current.push(laser);
      });

      // 3. Twin parallel wing shots
      const wingsOffset = [-15, 15];
      wingsOffset.forEach(offsetDist => {
        const wx = sx - sin * offsetDist;
        const wy = sy + cos * offsetDist;
        const laser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: wx,
          y: wy,
          vx: cos * 11,
          vy: sin * 11,
          angle: player.angle,
          damage: 2.5,
          isPiercing: false,
          piercedAsteroidIds: [],
          radius: 3.5,
          width: 3.2,
          color: bulletColor,
          lifetime: 0,
          maxLifetime: 75,
        };
        lasersRef.current.push(laser);
      });
    }
  };

  // --- MAIN SIMULATION GAME TICK ENGINE ---
  const tickGameLoop = () => {
    if (!isPlayingRef.current) return;

    if (isShopOpenRef.current || isExplorerOpenRef.current) {
      // Game paused, draw static elements but skip physics updates
      updateEngineHum(false);
      drawGameScene();
      animationFrameId.current = requestAnimationFrame(tickGameLoop);
      return;
    }

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : window.innerWidth;
    const height = canvas ? canvas.height : window.innerHeight;

    // --- READ ACTIVE GAMEPAD DEVICES ---
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];

    // Check connected gamepads to see if any button is pressed — if so, drop them in!
    let anyGamepadButtonPressed = false;
    let pressedGamepadIdx = -1;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        const anyButtonPressed = gp.buttons.some(b => b.pressed);
        if (anyButtonPressed) {
          anyGamepadButtonPressed = true;
          pressedGamepadIdx = i;
          const alreadyJoined = playersRef.current.some(pl => pl.inputSource === 'gamepad' && pl.gamepadIndex === i);
          if (!alreadyJoined) {
            joinPlayer('gamepad', i);
          }
        }
      }
    }

    // A když NEmáčkneš jakékoli tlačítko na myši nebo klávesnici, a stiskne se tlačítko na gamepadu, tak hraje jenom na gamepadu.
    if (anyGamepadButtonPressed && !keyboardOrMousePressedRef.current) {
      const hasKeyboardPlayers = playersRef.current.some(p => p.inputSource === 'keyboard_p1' || p.inputSource === 'keyboard_p2');
      if (hasKeyboardPlayers) {
        playersRef.current = playersRef.current.filter(p => p.inputSource !== 'keyboard_p1' && p.inputSource !== 'keyboard_p2');
        setActivePlayers([...playersRef.current]);
        addGainNotification('🎮 EXPEDICE PŘEPNUTA: HRAJE VÝHRADNĚ GAMEPAD!', '#fb923c');
      }
    }

    let isAnyLTPressed = false;

    // --- PROCESS INPUT FOR ALL ACTIVE PLAYERS ---
    playersRef.current.forEach(p => {
      p.thrusting = false;
      p.reversing = false;

      if (p.hull > 0) {
        if (p.inputSource === 'keyboard_p1') {
          p.thrusting = !!keysPressed.current['ArrowUp'];
          p.reversing = !!keysPressed.current['ArrowDown'];

          if (keysPressed.current['ArrowLeft']) {
            p.angle -= 0.08;
          } else if (keysPressed.current['ArrowRight']) {
            p.angle += 0.08;
          }

          if (keysPressed.current['ControlRight'] || keysPressed.current['Space']) {
            fireActiveLaser(p, p.playerNum);
          }
        } 
        else if (p.inputSource === 'keyboard_p2') {
          p.thrusting = !!keysPressed.current['KeyW'];
          p.reversing = !!keysPressed.current['KeyS'];

          if (keysPressed.current['KeyA']) {
            p.angle -= 0.08;
          } else if (keysPressed.current['KeyD']) {
            p.angle += 0.08;
          }

          if (keysPressed.current['ControlLeft']) {
            fireActiveLaser(p, p.playerNum);
          }
        } 
        else if (p.inputSource === 'gamepad' && p.gamepadIndex !== null) {
          const gp = gamepads[p.gamepadIndex];
          if (gp) {
            const rX = gp.axes[2] || 0;
            const rY = gp.axes[3] || 0;
            const rightStickMagnitude = Math.hypot(rX, rY);

            const isLTPressed = gp.buttons[6]?.pressed || (gp.buttons[6]?.value || 0) > 0.15;
            if (isLTPressed) {
              isAnyLTPressed = true;
            }

            // Allow steering even when accelerating with LT (disabled the drift lock bypass)
            if (rightStickMagnitude > 0.22) {
              p.targetAngle = Math.atan2(rY, rX);
              let deltaAngle = p.targetAngle - p.angle;
              while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
              while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
              const rotSpeed = 0.16 + (upgradesRef.current.engineLevel - 1) * 0.03;
              p.angle += deltaAngle * Math.min(1, rotSpeed);
            }

            if (isLTPressed) {
              p.thrusting = true;
            } else {
              p.thrusting = false;
              p.reversing = false;
            }

            const btnFire = gp.buttons[0]?.pressed || gp.buttons[7]?.pressed;
            if (btnFire) {
              fireActiveLaser(p, p.playerNum);
            }

            if (gp.buttons[2]?.pressed || gp.buttons[4]?.pressed) {
              triggerChainLightning(p.playerNum);
            }
            if (gp.buttons[1]?.pressed) {
              triggerPulseWaveRing(p.playerNum);
            }
            if (gp.buttons[3]?.pressed || gp.buttons[5]?.pressed) {
              triggerSuperMagnetVacuum(p.playerNum);
            }

            // Gamepad anchoring triggers (Stick Click, D-Pad Down, Select)
            const btnAnchor = gp.buttons[10]?.pressed || gp.buttons[11]?.pressed || gp.buttons[13]?.pressed || gp.buttons[8]?.pressed;
            const btnKey = `gp_${p.gamepadIndex || 0}_anchor`;
            const wasAnchorPressed = !!lastGamepadButtonsRef.current[btnKey];
            if (btnAnchor && !wasAnchorPressed) {
              toggleAnchor(p);
            }
            lastGamepadButtonsRef.current[btnKey] = !!btnAnchor;
          }
        }
      }
    });

    updateEngineHum(isAnyLTPressed);

    // --- APPLY PHYSICAL MOVEMENT SPEEDS AND DECELERATION ---
    playersRef.current.forEach(p => {
      // If player is dead, reset anchoring!
      if (p.hull <= 0) {
        p.anchoredAsteroidId = undefined;
        p.isDrilling = false;
      }

      if (p.hull > 0 && p.anchoredAsteroidId) {
        const asteroid = asteroidsRef.current.find(a => a.id === p.anchoredAsteroidId);
        if (!asteroid) {
          // Asteroid was destroyed or is missing! unanchor!
          p.anchoredAsteroidId = undefined;
          p.isDrilling = false;
        } else {
          // Anchored movement & rotation!
          p.vx = asteroid.vx;
          p.vy = asteroid.vy;
          
          // Compute ship position based on current asteroid coordinates, radius and rotation angle!
          p.x = asteroid.x + Math.cos(asteroid.angle + (p.anchorAngle || 0)) * (p.anchorRadius || (asteroid.radius + p.radius));
          p.y = asteroid.y + Math.sin(asteroid.angle + (p.anchorAngle || 0)) * (p.anchorRadius || (asteroid.radius + p.radius));
          
          // Optional: ship points outward or synchronizes with asteroid angle
          p.angle = asteroid.angle + (p.anchorAngle || 0);

          // DRILLING CYCLE
          if (p.isDrilling) {
            p.drillTime = (p.drillTime || 0) + 1;
            // Spawn spark/soil particles flying from the drill contact point!
            if (Math.random() < 0.4) {
              const sparkAngle = p.angle + Math.PI + (Math.random() * 0.8 - 0.4);
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x,
                y: p.y,
                vx: Math.cos(sparkAngle) * (Math.random() * 2 + 1) + asteroid.vx,
                vy: Math.sin(sparkAngle) * (Math.random() * 2 + 1) + asteroid.vy,
                color: asteroid.color || '#ffffff',
                size: Math.random() * 3 + 1,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 15 + Math.floor(Math.random() * 10)
              });
            }

            // Every 75 frames (approx 1.25s), extract resources directly from the core!
            if (p.drillTime >= 75) {
              p.drillTime = 0;
              // Extract ore based on asteroid type!
              let oreType: OreType = 'crystal';
              let amount = 1;
              let txt = `+1 Krystal`;
              let col = '#38bdf8';

              if (asteroid.asteroidType === 'crystal') {
                oreType = 'crystal';
                amount = Math.random() < 0.4 ? 4 : 2;
                txt = `+${amount} Společné Krystaly`;
                col = '#c084fc';
              } else if (asteroid.asteroidType === 'ice') {
                oreType = 'diamond';
                amount = 1;
                txt = `+1 Vzácný Diamant`;
                col = '#60a5fa';
              } else if (asteroid.asteroidType === 'magma') {
                oreType = 'obsidian';
                amount = 1;
                txt = `+1 Fialový Obsidián`;
                col = '#f43f5e';
              } else {
                // Common
                if (Math.random() < 0.15 && upgradesRef.current.magnetLevel >= 3) {
                  oreType = 'diamond';
                  txt = `+1 Vzácný Diamant`;
                  col = '#60a5fa';
                } else {
                  oreType = 'crystal';
                  amount = 1;
                  txt = `+1 Krystal`;
                  col = '#38bdf8';
                }
              }

              // Award resource to running stats
              if (oreType === 'crystal') {
                setRunCrystals(prev => prev + amount);
              } else if (oreType === 'diamond') {
                setRunDiamonds(prev => prev + amount);
              } else if (oreType === 'obsidian') {
                setRunObsidian(prev => prev + amount);
              }

              addGainNotification(txt, col);
              playCollectSound(oreType);
              
              // Damage asteroid HP slowly during deep drilling!
              asteroid.hp -= 15;
              if (asteroid.hp <= 0) {
                // Destroy asteroid cleanly!
                p.anchoredAsteroidId = undefined;
                p.isDrilling = false;
                triggerSpawnAsteroidDrops(asteroid.x, asteroid.y, asteroid.size);
                // Also award player some extra points/crystals
                setCurrentScore(prev => prev + asteroid.points);
                playExplosionSound(asteroid.size);
                asteroidsRef.current = asteroidsRef.current.filter(a => a.id !== asteroid.id);
              }
            }
          }
        }
      } else if (p.hull > 0) {
        const maxSpeed = 5 + (upgradesRef.current.engineLevel - 1) * 1.5;
        const thrustPower = 0.14 + (upgradesRef.current.engineLevel - 1) * 0.07;
        const inertiaFriction = 0.982 + (upgradesRef.current.engineLevel - 1) * 0.003;

        if (p.thrusting) {
          p.vx += Math.cos(p.angle) * thrustPower;
          p.vy += Math.sin(p.angle) * thrustPower;

          // Jet exhaust particles with custom player primary color booster flares
          if (Math.random() < 0.4) {
            const backAngle = p.angle + Math.PI + (Math.random() * 0.6 - 0.3);
            const ex = p.x - Math.cos(p.angle) * 18;
            const ey = p.y - Math.sin(p.angle) * 18;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: ex,
              y: ey,
              vx: Math.cos(backAngle) * (Math.random() * 3 + 1.25) + p.vx * 0.4,
              vy: Math.sin(backAngle) * (Math.random() * 3 + 1.25) + p.vy * 0.4,
              color: Math.random() < 0.35 ? p.color : p.glowColor,
              size: Math.random() * 3.5 + 1.5,
              alpha: 1.0,
              lifetime: 0,
              maxLifetime: 20 + Math.floor(Math.random() * 15),
            });
          }
        } else if (p.reversing) {
          p.vx -= Math.cos(p.angle) * (thrustPower * 0.55);
          p.vy -= Math.sin(p.angle) * (thrustPower * 0.55);
        }

        let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.vx *= inertiaFriction;
        p.vy *= inertiaFriction;
      } else {
        // Slow down wreckage slow-drift
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      if (!p.anchoredAsteroidId) {
        p.x += p.vx;
        p.y += p.vy;
      }

      if (p.invulnerableTime > 0) {
        p.invulnerableTime--;
      }
    });

    // --- COOPERATIVE PROXIMITY ATTRACTION (PULL STRAGGLERS) ---
    if (playersRef.current.length > 1) {
      let sumX = 0; let sumY = 0;
      let aliveCount = 0;
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          sumX += p.x;
          sumY += p.y;
          aliveCount++;
        }
      });

      if (aliveCount > 1) {
        const avgX = sumX / aliveCount;
        const avgY = sumY / aliveCount;
        const maxLimit = Math.min(width, height) * 0.82;

        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            const dx = p.x - avgX;
            const dy = p.y - avgY;
            const dist = Math.hypot(dx, dy);
            if (dist > maxLimit) {
              const excess = dist - maxLimit;
              p.x -= (dx / dist) * excess;
              p.y -= (dy / dist) * excess;
              p.vx *= 0.94;
              p.vy *= 0.94;
            }
          }
        });
      }
    }

    // --- DYNAMIC REVIVAL LOGIC ---
    playersRef.current.forEach(deadPlayer => {
      if (deadPlayer.hull <= 0) {
        // Find nearest living helper player
        let helperNear = false;
        playersRef.current.forEach(livingHero => {
          if (livingHero.hull > 0) {
            const dx = deadPlayer.x - livingHero.x;
            const dy = deadPlayer.y - livingHero.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 90) {
              helperNear = true;
            }
          }
        });

        if (helperNear) {
          deadPlayer.reviveTimer += 1.0;
          if (deadPlayer.reviveTimer >= 150) { // 2.5s at 60fps
            const hpRestoreVal = Math.round(deadPlayer.maxHull * 0.4);
            deadPlayer.hull = hpRestoreVal;
            deadPlayer.invulnerableTime = 120;
            deadPlayer.reviveTimer = 0;
            deadPlayer.vx = 0;
            deadPlayer.vy = 0;
            deadPlayer.angle = -Math.PI / 2;

            addGainNotification(`🛸 ${deadPlayer.name} OŽIVEN S 40% TRUPEM!`, deadPlayer.color);

            // Emit lovely celebratory rings of healing spark particles
            for (let angle = 0; angle < Math.PI * 2; angle += 0.22) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: deadPlayer.x,
                y: deadPlayer.y,
                vx: Math.cos(angle) * (Math.random() * 4 + 3.2),
                vy: Math.sin(angle) * (Math.random() * 4 + 3.2),
                color: deadPlayer.color,
                size: Math.random() * 4.5 + 2.5,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 35,
              });
            }
          }
        } else {
          deadPlayer.reviveTimer = Math.max(0, deadPlayer.reviveTimer - 1.5);
        }
      }
    });

    // --- SHIELD REGENERATION FOR ALL ALIVE CHARGED PLAYERS ---
    if (shieldRegenCooldown.current > 0) {
      shieldRegenCooldown.current--;
    }

    playersRef.current.forEach(p => {
      if (p.hull > 0 && upgradesRef.current.shieldLevel > 0 && p.shield < p.maxShield) {
        if (shieldRegenCooldown.current <= 0) {
          const baseRegen = 0.04;
          const powerMultiplier = 1 + (upgradesRef.current.shieldLevel - 1) * 0.35;
          const actualRegen = baseRegen * powerMultiplier;
          p.shield = Math.min(p.maxShield, p.shield + actualRegen);
        }
      }
    });

    // --- UPDATE SOLAR STROM PROCESSES ---
    if (solarStormDurationRef.current > 0) {
      solarStormDurationRef.current--;
      if (solarStormDurationRef.current <= 0) {
        solarStormActiveRef.current = false;
        setSolarStormActive(false);
        addGainNotification("🌤️ SOLÁRNÍ BOUŘE SKONČILA", "#10b981");
        // Reset next storm timer (approx 35s to 60s cooldown)
        solarStormTimeRef.current = 2100 + Math.floor(Math.random() * 1500);
      } else {
        // Active solar storm phase!
        // Spawn streaming solar radiation wind particles!
        if (Math.random() < 0.6) {
          const windAngle = solarStormDirectionRef.current;
          const camX = lastCamXRef.current;
          const camY = lastCamYRef.current;
          // Spawn near viewport edges
          const spawnX = camX + (Math.random() * width - width / 2) - Math.cos(windAngle) * 500;
          const spawnY = camY + (Math.random() * height - height / 2) - Math.sin(windAngle) * 500;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: spawnX,
            y: spawnY,
            vx: Math.cos(windAngle) * (Math.random() * 8 + 4),
            vy: Math.sin(windAngle) * (Math.random() * 8 + 4),
            color: Math.random() < 0.5 ? '#f59e0b' : '#ef4444', // Orange/Red solar particles
            size: Math.random() * 2.5 + 1.0,
            alpha: 0.8,
            lifetime: 0,
            maxLifetime: 100
          });
        }

        // Damage calculation for players! Every 45 frames (0.75s), check if players are safe or hit
        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            if (p.invulnerableTime > 0) return;
            
            // Checking if player is shadowed behind ANY large / huge asteroid relative to wind direction!
            let isShadowed = false;
            const windDirX = Math.cos(solarStormDirectionRef.current);
            const windDirY = Math.sin(solarStormDirectionRef.current);

            // Anchored and deep drilling rock provides excellent insulation!
            if (p.anchoredAsteroidId) {
              isShadowed = true; 
            } else {
              asteroidsRef.current.forEach(ast => {
                if (ast.size === 'huge' || ast.size === 'large') {
                  const dx = p.x - ast.x;
                  const dy = p.y - ast.y;
                  const distToAst = Math.hypot(dx, dy);
                  
                  // Safe distance - close behind the asteroid
                  if (distToAst < ast.radius * 2.5) {
                    // Check projection along wind direction:
                    const proj = (dx * windDirX + dy * windDirY) / distToAst;
                    if (proj > 0.72) { // Angle within shadow cone
                      isShadowed = true;
                    }
                  }
                }
              });
            }

            if (!isShadowed) {
              // Apply radiation damage!
              if (solarStormDurationRef.current % 45 === 0) {
                if (p.shield > 0) {
                  p.shield = Math.max(0, p.shield - 8);
                  addGainNotification(`⚠️ ${p.name} - RADIACE POŠKODILA ŠTÍT!`, '#fb923c');
                  playDamageSound();
                } else {
                  p.hull = Math.max(0, p.hull - 5);
                  addGainNotification(`⚠️ ${p.name} - RADIACE POŠKODILA TRUP!`, '#ef4444');
                  playDamageSound();
                  
                  if (p.hull <= 0) {
                    addGainNotification(`💀 ${p.name} ZNIČEN RADIACÍ!`, '#ef4444');
                    triggerShipCatastrophicFailure();
                  }
                }
              }
            }
          }
        });
      }
    } else {
      // Normal countdown phases
      if (solarStormTimeRef.current > 0) {
        solarStormTimeRef.current--;
        // Show warning message when storm gets near (less than 15 seconds / 900 frames)
        if (solarStormTimeRef.current <= 900 && solarStormTimeRef.current % 60 === 0) {
          const secs = Math.ceil(solarStormTimeRef.current / 60);
          setSolarStormWarning(secs);
        }
      } else {
        // Start the storm!
        solarStormActiveRef.current = true;
        setSolarStormActive(true);
        setSolarStormWarning(0);
        solarStormDirectionRef.current = Math.PI * 0.4 + Math.random() * Math.PI * 0.2; // mostly downward wind
        solarStormDurationRef.current = 600 + Math.floor(Math.random() * 600); // 10 to 20 seconds duration
        addGainNotification("🚨 SOLÁRNÍ BOUŘE ZAČALA! Hledej stín za velkými asteroidy!", "#f59e0b");
        playExplosionSound('huge');
      }
    }

    // --- COSMIC PIRATES SPAWN AND TICK ENGINE ---
    // Spawn chance: if random check succeeds and isPlaying and pirates counts < 2
    if (Math.random() < 0.0025 && piratesRef.current.length < 2) {
      const pX = lastCamXRef.current;
      const pY = lastCamYRef.current;
      const angle = Math.random() * Math.PI * 2;
      const spawnX = pX + Math.cos(angle) * (width / 2 + 150 + Math.random() * 200);
      const spawnY = pY + Math.sin(angle) * (height / 2 + 150 + Math.random() * 200);

      piratesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        angle: Math.random() * Math.PI * 2,
        hp: 120,
        maxHp: 120,
        radius: 17,
        lastFired: 0,
        color: '#f43f5e'
      });
      addGainNotification(`☠️ DETEKOVÁNA DETACHOVANÁ PIRÁTSKÁ LOĎ!`, '#f43f5e');
    }

    // Update Cosmic Pirates behaviour
    piratesRef.current.forEach(pirate => {
      let closestP: Player | null = null;
      let closestDist = 999999;
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const d = Math.hypot(p.x - pirate.x, p.y - pirate.y);
          if (d < closestDist) {
            closestDist = d;
            closestP = p;
          }
        }
      });

      if (closestP) {
        const p = closestP as Player;
        const targetAngle = Math.atan2(p.y - pirate.y, p.x - pirate.x);
        let dAngle = targetAngle - pirate.angle;
        while (dAngle < -Math.PI) dAngle += Math.PI * 2;
        while (dAngle > Math.PI) dAngle -= Math.PI * 2;
        pirate.angle += dAngle * 0.04; // rotation rate

        // Propel forward
        const spd = 1.8;
        pirate.vx = Math.cos(pirate.angle) * spd;
        pirate.vy = Math.sin(pirate.angle) * spd;

        // Fire at closest player within range (450px) and cooldown is over (1.5s)
        if (closestDist < 450 && Date.now() - pirate.lastFired > 1500) {
          pirate.lastFired = Date.now();
          pirateLasersRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: pirate.x + Math.cos(pirate.angle) * 20,
            y: pirate.y + Math.sin(pirate.angle) * 20,
            vx: Math.cos(pirate.angle) * 7.5,
            vy: Math.sin(pirate.angle) * 7.5,
            angle: pirate.angle,
            radius: 4.5,
            color: '#f43f5e',
            lifetime: 0,
            maxLifetime: 65
          });
          playLaserSound(1);
        }
      } else {
        pirate.vx *= 0.98;
        pirate.vy *= 0.98;
      }

      pirate.x += pirate.vx;
      pirate.y += pirate.vy;
    });

    // Check pirate destruction and clean up
    piratesRef.current.forEach(pirate => {
      if (pirate.hp <= 0) {
        handlePirateBlowUp(pirate);
      }
    });
    piratesRef.current = piratesRef.current.filter(p => p.hp > 0);

    // Update Pirate Lasers collision checks
    pirateLasersRef.current.forEach(pl => {
      pl.x += pl.vx;
      pl.y += pl.vy;
      pl.lifetime++;
      
      // Check collision with player ships!
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.invulnerableTime <= 0 && pl.lifetime < pl.maxLifetime) {
          const d = Math.hypot(p.x - pl.x, p.y - pl.y);
          if (d < p.radius + pl.radius) {
            if (p.shield > 0) {
              p.shield = Math.max(0, p.shield - 14);
              addGainNotification(`💥 ${p.name} - ABSORBOVÁN ZÁSAH ŠTÍTEM!`, '#fb923c');
            } else {
              p.hull = Math.max(0, p.hull - 8);
              addGainNotification(`💥 ${p.name} - TRUP POŠKOZEN RAKETAMI!`, '#ef4444');
              if (p.hull <= 0) {
                addGainNotification(`💀 ${p.name} ZNIČEN PIRÁTY!`, '#ef4444');
                triggerShipCatastrophicFailure();
              }
            }
            playDamageSound();
            pl.lifetime = pl.maxLifetime; // mark dead
          }
        }
      });
    });

    // Remove stale pirate lasers
    pirateLasersRef.current = pirateLasersRef.current.filter(pl => pl.lifetime < pl.maxLifetime);

    // Settle React state stats regularly so scoreboards and other layers update correctly
    const kbP1Val = playersRef.current.find(pl => pl.inputSource === 'keyboard_p1');
    const kbP2Val = playersRef.current.find(pl => pl.inputSource === 'keyboard_p2');
    if (kbP1Val) {
      setHull(Math.round(kbP1Val.hull));
      setShield(Math.round(kbP1Val.shield));
    }
    if (kbP2Val) {
      setP2Hull(Math.round(kbP2Val.hull));
      setP2Shield(Math.round(kbP2Val.shield));
    }
    setActivePlayers([...playersRef.current]);

    // --- ACTIVE ABILITIES COOLDOWNS TICKING ---
    if (lightningCooldownRef.current > 0) {
      lightningCooldownRef.current--;
      if (lightningCooldownRef.current % 15 === 0) {
        setLightningCooldown(Math.ceil(lightningCooldownRef.current / 60));
      }
    } else {
      setLightningCooldown(0);
    }

    if (pulseCooldownRef.current > 0) {
      pulseCooldownRef.current--;
      if (pulseCooldownRef.current % 15 === 0) {
        setPulseCooldown(Math.ceil(pulseCooldownRef.current / 60));
      }
    } else {
      setPulseCooldown(0);
    }

    if (superMagnetActiveRef.current > 0) {
      superMagnetActiveRef.current--;
      if (superMagnetActiveRef.current % 15 === 0) {
        setSuperMagnetActive(Math.ceil(superMagnetActiveRef.current / 60));
      }
      if (superMagnetActiveRef.current === 0) {
        setSuperMagnetActive(0);
        // Start cooling down once active period finishes
        const lvl = upgradesRef.current.abilitySuperMagnetLevel;
        if (lvl > 0) {
          superMagnetCooldownRef.current = 12 * 60; // 12s cooldown
          setSuperMagnetCooldown(12);
        }
      }
    } else {
      if (superMagnetCooldownRef.current > 0) {
        superMagnetCooldownRef.current--;
        if (superMagnetCooldownRef.current % 15 === 0) {
          setSuperMagnetCooldown(Math.ceil(superMagnetCooldownRef.current / 60));
        }
      } else {
        setSuperMagnetCooldown(0);
      }
    }

    // --- 6. LASER FLIGHT & BOUNDS ---
    lasersRef.current = lasersRef.current.map(laser => {
      laser.x += laser.vx;
      laser.y += laser.vy;
      laser.lifetime++;
      return laser;
    }).filter(laser => laser.lifetime < laser.maxLifetime);

    // --- 7. ORE SUCKING MAGNET PICS ---
    let magnetRadius = 100;
    let magnetPullStrength = 0.22;
    if (upgradesRef.current.magnetLevel === 2) { magnetRadius = 180; magnetPullStrength = 0.28; }
    else if (upgradesRef.current.magnetLevel === 3) { magnetRadius = 260; magnetPullStrength = 0.36; }
    else if (upgradesRef.current.magnetLevel === 4) { magnetRadius = 340; magnetPullStrength = 0.44; }
    else if (upgradesRef.current.magnetLevel === 5) { magnetRadius = 1200; magnetPullStrength = 0.85; }
    else if (upgradesRef.current.magnetLevel >= 6) { magnetRadius = 8000; magnetPullStrength = 1.95; }

    // Donkey Keeper Super Magnet active capability overwrite
    if (superMagnetActiveRef.current > 0) {
      const lvl = upgradesRef.current.abilitySuperMagnetLevel;
      magnetRadius = 99999;
      magnetPullStrength = lvl === 3 ? 12.0 : lvl === 2 ? 6.0 : 3.5;
    }

    oresRef.current = oresRef.current.map(ore => {
      // Find nearest active player as gravity center
      let targetPlayer: Player | null = null;
      let minDist = 999999;
      let dx = 0;
      let dy = 0;

      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const tdx = ore.x - p.x;
          const tdy = ore.y - p.y;
          const dist = Math.hypot(tdx, tdy);
          if (dist < minDist) {
            minDist = dist;
            targetPlayer = p;
            dx = tdx;
            dy = tdy;
          }
        }
      });

      const dist = minDist;

      // Pulse graphic animation
      ore.pulseScale += 0.03 * ore.pulseDir;
      if (ore.pulseScale > 1.35 || ore.pulseScale < 0.75) {
        ore.pulseDir *= -1;
      }

      if (targetPlayer && dist < magnetRadius) {
        const pullDirX = -dx / dist;
        const pullDirY = -dy / dist;
        const velocityAcc = magnetPullStrength * (1 + (magnetRadius - dist) / 100);
        ore.vx += pullDirX * velocityAcc;
        ore.vy += pullDirY * velocityAcc;
        
        ore.vx *= 0.85;
        ore.vy *= 0.85;
      } else {
        ore.vx *= 0.96;
        ore.vy *= 0.96;
      }

      ore.x += ore.vx;
      ore.y += ore.vy;

      return ore;
    });

    // Check ore collection with any living player independently
    oresRef.current = oresRef.current.filter(ore => {
      let collidedPlayer: Player | null = null;

      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const distP = Math.hypot(ore.x - p.x, ore.y - p.y);
          if (distP < p.radius + ore.radius) {
            collidedPlayer = p;
          }
        }
      });

      if (collidedPlayer) {
        const pColor = (collidedPlayer as Player).color;
        const pName = (collidedPlayer as Player).name;
        playCollectSound(ore.type);
        triggerOreSparkExplosion(ore.x, ore.y, ore.color);

        let awardLabel = `${pName}: +1 Krystal`;

        if (ore.type === 'crystal') {
          setRunCrystals(c => c + 1);
          setStats(curr => {
            const nextStats = { ...curr, crystals: curr.crystals + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +1 Krystal`;
        } else if (ore.type === 'diamond') {
          setRunDiamonds(d => d + 1);
          setStats(curr => {
            const nextStats = { ...curr, diamonds: curr.diamonds + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +1 Diamant`;
        } else if (ore.type === 'obsidian') {
          setRunObsidian(o => o + 1);
          setStats(curr => {
            const nextStats = { ...curr, obsidian: curr.obsidian + 1 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +1 Obsidián`;
        }

        addGainNotification(awardLabel, ore.color);
        return false;
      }
      return true;
    });

    // --- 8. ASTEROID COLLISION DYNAMICS ---
    // Donkey Keeper Gravity Chain: Crystal asteroids pull common ones nearby
    asteroidsRef.current.forEach(cAst => {
      if (cAst.asteroidType === 'crystal') {
        asteroidsRef.current.forEach(oAst => {
          if (oAst.id !== cAst.id && (oAst.asteroidType === 'common' || oAst.asteroidType === 'ice' || oAst.asteroidType === 'magma') && oAst.size !== 'huge') {
            const dx = cAst.x - oAst.x;
            const dy = cAst.y - oAst.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 300 && dist > 15) {
              const pull = 0.035 * (1 - dist / 300); // attractive pulse push
              oAst.vx += (dx / dist) * pull;
              oAst.vy += (dy / dist) * pull;
              
              // Cap maximum speed of attracted rocks to keep them controllable
              const speed = Math.hypot(oAst.vx, oAst.vy);
              if (speed > 4.5) {
                oAst.vx = (oAst.vx / speed) * 4.5;
                oAst.vy = (oAst.vy / speed) * 4.5;
              }
            }
          }
        });
      }
    });

    asteroidsRef.current.forEach(asteroid => {
      asteroid.x += asteroid.vx;
      asteroid.y += asteroid.vy;
      asteroid.angle += asteroid.angularVelocity;

      // Wrap around anchor location of the first alive player
      const anchorPlayer = playersRef.current.find(pl => pl.hull > 0) || playersRef.current[0];
      if (anchorPlayer) {
        const pX = anchorPlayer.x;
        const pY = anchorPlayer.y;
        const adx = asteroid.x - pX;
        const ady = asteroid.y - pY;
        const distanceToPlayer = Math.sqrt(adx * adx + ady * ady);

        if (distanceToPlayer > 1300) {
          const angleOffset = anchorPlayer.vx || anchorPlayer.vy 
            ? Math.atan2(anchorPlayer.vy, anchorPlayer.vx) + (Math.random() * 1.5 - 0.75)
            : Math.random() * Math.PI * 2;
          
          asteroid.x = pX + Math.cos(angleOffset) * 1100;
          asteroid.y = pY + Math.sin(angleOffset) * 1100;
          
          const pathAngle = angleOffset + Math.PI + (Math.random() * 1.0 - 0.5);
          const spd = Math.random() * 1.3 + 0.4;
          asteroid.vx = Math.cos(pathAngle) * spd;
          asteroid.vy = Math.sin(pathAngle) * spd;
        }
      }
    });

    // Check laser hit asteroid
    lasersRef.current.forEach(laser => {
      asteroidsRef.current.forEach(asteroid => {
        if (laser.isPiercing && laser.piercedAsteroidIds.includes(asteroid.id)) {
          return;
        }

        const ldx = laser.x - asteroid.x;
        const ldy = laser.y - asteroid.y;
        const radSum = laser.radius + asteroid.radius;

        if (ldx * ldx + ldy * ldy < radSum * radSum) {
          let appliedDamage = laser.damage;
          let isThermalShock = false;

          if (asteroid.asteroidType === 'magma') {
            laser.isHeated = true;
            laser.color = '#f97316'; // heated orange laser
          } else if (asteroid.asteroidType === 'ice' && laser.isHeated) {
            isThermalShock = true;
            appliedDamage = laser.damage * 2.2; // Thermal shock deals double plus bonus damage!
          }

          asteroid.hp -= appliedDamage;
          
          if (laser.isPiercing) {
            laser.piercedAsteroidIds.push(asteroid.id);
            laser.vx *= 0.9;
            laser.vy *= 0.9;
          } else {
            laser.lifetime = laser.maxLifetime;
          }

          if (isThermalShock) {
            triggerComboSteamCloud(laser.x, laser.y);
            addGainNotification("KOMBO: TEPLOTNÍ ŠOK! (2.2x Dmg)", "#38bdf8");
            playExplosionSound('medium');
          } else {
            triggerOreSparkExplosion(laser.x, laser.y, asteroid.color || '#ffffff');
          }

          if (asteroid.hp <= 0) {
            handleAsteroidBlowUp(asteroid);
          } else {
            playExplosionSound('small');
          }
        }
      });
    });

    // Check laser hit pirate
    lasersRef.current.forEach(laser => {
      piratesRef.current.forEach(pirate => {
        const ldx = laser.x - pirate.x;
        const ldy = laser.y - pirate.y;
        const radSum = laser.radius + pirate.radius;

        if (ldx * ldx + ldy * ldy < radSum * radSum) {
          const appliedDamage = laser.damage;
          pirate.hp -= appliedDamage;

          if (!laser.isPiercing) {
            laser.lifetime = laser.maxLifetime;
          }

          triggerOreSparkExplosion(laser.x, laser.y, '#f43f5e');
          playExplosionSound('small');
        }
      });
    });

    lasersRef.current = lasersRef.current.filter(l => l.lifetime < l.maxLifetime);

    // --- SHIP CRASH CHECK FOR ALL ACTIVE PLAYERS ---
    playersRef.current.forEach(p => {
      if (p.hull > 0 && p.invulnerableTime <= 0) {
        asteroidsRef.current.forEach(asteroid => {
          const sdx = p.x - asteroid.x;
          const sdy = p.y - asteroid.y;
          const playerShipHurtDist = p.radius + asteroid.radius - 3;

          if (sdx * sdx + sdy * sdy < playerShipHurtDist * playerShipHurtDist) {
            const angle = Math.atan2(sdy, sdx);
            p.vx = Math.cos(angle) * (6 + asteroid.radius * 0.05);
            p.vy = Math.sin(angle) * (6 + asteroid.radius * 0.05);
            p.invulnerableTime = 70;

            let rawDmg = 8;
            if (asteroid.size === 'huge') rawDmg = 38;
            else if (asteroid.size === 'large') rawDmg = 24;
            else if (asteroid.size === 'medium') rawDmg = 14;

            const armorMultiplier = Math.max(0.65, 1.0 - (upgradesRef.current.hullLevel - 1) * 0.08);
            const calculatedDmg = Math.round(rawDmg * armorMultiplier);

            playDamageSound();

            let finalDmgToHull = calculatedDmg;

            if (p.shield > 0) {
              if (p.shield >= calculatedDmg) {
                p.shield -= calculatedDmg;
                finalDmgToHull = 0;
                addGainNotification(`${p.name}: ŠTÍT ABS. -${calculatedDmg} HP`, '#38bdf8');
              } else {
                finalDmgToHull = calculatedDmg - p.shield;
                p.shield = 0;
                addGainNotification(`${p.name}: ŠTÍT ZNIČEN!`, '#ef4444');
                playShieldDownSound();
              }
            }

            if (finalDmgToHull > 0) {
              p.hull = Math.max(0, p.hull - finalDmgToHull);
              addGainNotification(`${p.name}: POŠKOZENO -${finalDmgToHull} HP`, '#f97316');

              if (p.hull <= 0) {
                // Check if any other player is still alive
                const anyoneAlive = playersRef.current.some(pl => pl.hull > 0);
                if (!anyoneAlive) {
                   triggerShipCatastrophicFailure();
                } else {
                   addGainNotification(`HLÁŠENÍ: ${p.name} byl ZNIČEN! Braňte pozice!`, '#ef4444');
                }
              }
            }

            shieldRegenCooldown.current = upgradesRef.current.shieldLevel >= 5 ? 38 : 240;
          }
        });
      }
    });

    // --- 9. PARTICLES RENDER TICK ---
    particlesRef.current = particlesRef.current.map(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.lifetime++;
      particle.alpha = 1.0 - (particle.lifetime / particle.maxLifetime);
      return particle;
    }).filter(particle => particle.lifetime < particle.maxLifetime);

    populateAsteroidBelt(18);

    drawGameScene();
    animationFrameId.current = requestAnimationFrame(tickGameLoop);
  };

  // --- DONKEY KEEPER ACTIVE ABILITIES & COMBO SYSTEMS ---
  const triggerComboSteamCloud = (ox: number, oy: number) => {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.8 + 0.8;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() < 0.55 ? '#e2e8f0' : '#cbd5e1', // thick white/slate steam gray
        size: Math.random() * 7.5 + 3.0,
        alpha: 0.9,
        lifetime: 0,
        maxLifetime: 28 + Math.floor(Math.random() * 20),
      });
    }
  };

  const triggerChainExplosionWave = (ox: number, oy: number, radius: number, parentId: string) => {
    // Fiery blast spark cloud
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.2;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#f97316', '#ef4444', '#f97316', '#facc15', '#ffffff'][Math.floor(Math.random() * 5)],
        size: Math.random() * 6.0 + 2.5,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 20 + Math.floor(Math.random() * 15),
      });
    }

    // Radial damage to adjacent rocks
    asteroidsRef.current.forEach(ast => {
      if (ast.id !== parentId) {
        const dx = ast.x - ox;
        const dy = ast.y - oy;
        const dist = Math.hypot(dx, dy);
        if (dist < radius) {
          const ratio = 1 - dist / radius;
          const dmg = Math.round(12 * ratio);
          if (dmg > 0) {
            ast.hp -= dmg;

            const pushA = Math.atan2(dy, dx);
            ast.vx += Math.cos(pushA) * (4.5 * ratio);
            ast.vy += Math.sin(pushA) * (4.5 * ratio);

            if (ast.hp <= 0) {
              setTimeout(() => {
                const alive = asteroidsRef.current.some(a => a.id === ast.id);
                if (alive) handleAsteroidBlowUp(ast);
              }, 110);
            } else {
              playExplosionSound('small');
            }
          }
        }
      }
    });
  };

  const triggerChainLightning = (playerNum: number) => {
    const lvl = upgradesRef.current.abilityLightningLevel;
    if (lvl <= 0) return;

    if (lightningCooldownRef.current > 0) return;

    const p = playersRef.current.find(pl => pl.playerNum === playerNum);
    if (!p) return;
    if (p.invulnerableTime > 0 && p.hull <= 0) return;

    // Find nearest targets (asteroids and pirates) in range
    const searchLimit = 520;
    
    interface LightningTarget {
      id: string;
      x: number;
      y: number;
      hp: number;
      color: string;
      isPirate: boolean;
      ref: any;
    }

    const astTargets: LightningTarget[] = asteroidsRef.current.map(ast => ({
      id: ast.id,
      x: ast.x,
      y: ast.y,
      hp: ast.hp,
      color: ast.color || '#ffffff',
      isPirate: false,
      ref: ast
    }));

    const pirateTargets: LightningTarget[] = piratesRef.current.map(pir => ({
      id: pir.id,
      x: pir.x,
      y: pir.y,
      hp: pir.hp,
      color: pir.color,
      isPirate: true,
      ref: pir
    }));

    const combined = [...astTargets, ...pirateTargets];

    let candidates = combined.map(t => {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      return { target: t, dist: Math.hypot(dx, dy) };
    }).filter(c => c.dist < searchLimit)
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length === 0) {
      addGainNotification("ŽÁDNÝ CÍL NENÍ V DOSAHU BLESKU!", "#e11d48");
      return;
    }

    // Activate lightning!
    playLaserSound(2); // electrical discharge surge noise proxy
    triggerOreSparkExplosion(p.x, p.y, '#facc15');

    lightningCooldownRef.current = 7 * 60; // 7s cooldown
    setLightningCooldown(7);

    addGainNotification("KONCENTROVANÝ BLESK!", "#facc15");

    const maxJumps = 3 + lvl * 2;
    const dmg = 4 + lvl * 5;
    
    let sourceX = p.x;
    let sourceY = p.y;
    const hitIds: string[] = [];

    for (let j = 0; j < maxJumps; j++) {
      const nextC = candidates.find(c => !hitIds.includes(c.target.id));
      if (!nextC) break;

      const target = nextC.target;
      hitIds.push(target.id);

      // Hit target
      target.ref.hp -= dmg;

      // Draw beautiful electrical lightning sparks along the path
      const sx = sourceX;
      const sy = sourceY;
      const tx = target.x;
      const ty = target.y;
      const dist = Math.hypot(tx - sx, ty - sy);
      const points = Math.max(5, Math.floor(dist / 12));

      for (let k = 0; k <= points; k++) {
        const ratio = k / points;
        const pyX = -(ty - sy) / dist;
        const pyY = (tx - sx) / dist;
        const amplitude = (Math.random() * 12 - 6) * (1 - Math.abs(ratio - 0.5) * 1.5);

        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: sx + (tx - sx) * ratio + pyX * amplitude,
          y: sy + (ty - sy) * ratio + pyY * amplitude,
          vx: (Math.random() * 0.4 - 0.2),
          vy: (Math.random() * 0.4 - 0.2),
          color: Math.random() < 0.3 ? '#ffffff' : '#facc15',
          size: Math.random() * 2.8 + 1.2,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 10 + Math.floor(Math.random() * 12),
        });
      }

      if (target.isPirate) {
        triggerOreSparkExplosion(target.x, target.y, '#f43f5e');
      } else {
        if (target.ref.hp <= 0) {
          setTimeout(() => {
            const alive = asteroidsRef.current.some(a => a.id === target.id);
            if (alive) handleAsteroidBlowUp(target.ref);
          }, 110);
        } else {
          triggerOreSparkExplosion(target.x, target.y, '#facc15');
        }
      }

      sourceX = target.x;
      sourceY = target.y;

      // Re-sort candidates starting from current target position
      candidates = candidates.map(c => {
        const dx = c.target.x - target.x;
        const dy = c.target.y - target.y;
        return { target: c.target, dist: Math.hypot(dx, dy) };
      }).sort((a, b) => a.dist - b.dist);
    }
  };

  const triggerPulseWaveRing = (playerNum: number) => {
    const lvl = upgradesRef.current.abilityPulseLevel;
    if (lvl <= 0) return;

    if (pulseCooldownRef.current > 0) return;

    const p = playersRef.current.find(pl => pl.playerNum === playerNum);
    if (!p) return;
    if (p.invulnerableTime > 0 && p.hull <= 0) return;

    pulseCooldownRef.current = 10 * 60; // 10s cooldown
    setPulseCooldown(10);

    playExplosionSound('medium');
    addGainNotification("KINETICKÝ PULS!", "#818cf8");

    const pulseRadius = 260 + lvl * 60;

    // Circular particle wave ring visual display
    for (let angle = 0; angle < Math.PI * 2; angle += 0.12) {
      const speed = 4.0 + lvl * 1.5;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() < 0.4 ? '#ffffff' : '#818cf8',
        size: Math.random() * 4.0 + 2.0,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 28 + lvl * 3,
      });
    }

    // Physical push checking
    asteroidsRef.current.forEach(ast => {
      const dx = ast.x - p.x;
      const dy = ast.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pulseRadius && dist > 10) {
        const ratio = 1 - dist / pulseRadius;
        const pushForce = 8.0 + lvl * 4.5;
        const pushAngle = Math.atan2(dy, dx);

        ast.vx += Math.cos(pushAngle) * (pushForce * ratio);
        ast.vy += Math.sin(pushAngle) * (pushForce * ratio);

        const dmg = lvl * 4;
        ast.hp -= dmg;

        // Level 3 Donkey Keeper combo detonator!
        if (lvl === 3 && (ast.asteroidType === 'magma' || ast.asteroidType === 'ice')) {
          ast.hp = 0;
        }

        if (ast.hp <= 0) {
          setTimeout(() => {
            const alive = asteroidsRef.current.some(a => a.id === ast.id);
            if (alive) handleAsteroidBlowUp(ast);
          }, 85);
        } else {
          triggerOreSparkExplosion(ast.x, ast.y, '#818cf8');
        }
      }
    });

    // Physical push checking on pirates
    piratesRef.current.forEach(pirate => {
      const dx = pirate.x - p.x;
      const dy = pirate.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pulseRadius && dist > 10) {
        const ratio = 1 - dist / pulseRadius;
        const pushForce = 6.0 + lvl * 3.0;
        const pushAngle = Math.atan2(dy, dx);

        pirate.vx += Math.cos(pushAngle) * (pushForce * ratio);
        pirate.vy += Math.sin(pushAngle) * (pushForce * ratio);

        const dmg = lvl * 6;
        pirate.hp -= dmg;

        triggerOreSparkExplosion(pirate.x, pirate.y, '#ef4444');
      }
    });
  };

  const triggerSuperMagnetVacuum = (playerNum: number) => {
    const lvl = upgradesRef.current.abilitySuperMagnetLevel;
    if (lvl <= 0) return;

    if (superMagnetActiveRef.current > 0 || superMagnetCooldownRef.current > 0) return;

    const p = playersRef.current.find(pl => pl.playerNum === playerNum);
    if (!p) return;
    if (p.invulnerableTime > 0 && p.hull <= 0) return;

    const durationSeconds = lvl === 3 ? 12 : lvl === 2 ? 8 : 5;
    superMagnetActiveRef.current = durationSeconds * 60;
    setSuperMagnetActive(durationSeconds);

    playUpgradeSound();
    addGainNotification("SUPER MAGNET: AKTIVOVÁN!", "#06b6d4");
  };

  const triggerSpawnPirateDrops = (px: number, py: number) => {
    const drops: Ore[] = [];
    drops.push(createOreEntity(px, py, 'obsidian'));
    drops.push(createOreEntity(px, py, 'diamond', true));
    drops.push(createOreEntity(px, py, 'diamond', true));
    for (let i = 0; i < 4; i++) {
      drops.push(createOreEntity(px, py, 'crystal', true));
    }
    oresRef.current = [...oresRef.current, ...drops];
  };

  const handlePirateBlowUp = (pirate: Pirate) => {
    playExplosionSound('large');

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.2;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: pirate.x,
        y: pirate.y,
        vx: Math.cos(angle) * speed + pirate.vx * 0.4,
        vy: Math.sin(angle) * speed + pirate.vy * 0.4,
        color: Math.random() < 0.4 ? '#ffffff' : '#f43f5e',
        size: Math.random() * 5.0 + 1.5,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 35 + Math.floor(Math.random() * 35),
      });
    }

    const bonusPoints = 500;
    const newScore = scoreRef.current + bonusPoints;
    scoreRef.current = newScore;
    setCurrentScore(newScore);

    setStats(curr => {
      const nextStats = {
        ...curr,
        highScore: Math.max(curr.highScore, newScore)
      };
      saveStats(nextStats);
      return nextStats;
    });

    triggerSpawnPirateDrops(pirate.x, pirate.y);
    addGainNotification("☠️ CORSÁR ZNIČEN! (+500 skóre, drahokamy vypadly!)", "#f43f5e");
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

    // Donkey Keeper Magma Chain Explosion (Řetězová exploze)
    if (asteroid.asteroidType === 'magma') {
      const explRadius = asteroid.size === 'huge' ? 220 : asteroid.size === 'large' ? 170 : asteroid.size === 'medium' ? 120 : 80;
      triggerChainExplosionWave(asteroid.x, asteroid.y, explRadius, asteroid.id);
      addGainNotification("KOMBO: ŘETĚZOVÁ EXPLOZE!", "#f97316");
    }

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
          createProceduralAsteroid(nextSize, spawnX, spawnY, vxShip, vyShip, asteroid.asteroidType)
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

    // Explode all active players
    playersRef.current.forEach(p => {
      const px = p.x;
      const py = p.y;
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 6.5 + 2.0;
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: px,
          y: py,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          color: [p.color, p.glowColor, '#facc15', '#ffffff'][Math.floor(Math.random() * 4)],
          size: Math.random() * 5.0 + 2.0,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 60 + Math.floor(Math.random() * 40),
        });
      }
    });

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

  // --- HTML5 CANVAS RENDER PASS (SCROLLING MAP EFFECT / SPLIT-SCREEN COOP) ---
  const drawGameScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Encapsulate drawing layout for a single viewport (supports standard front and rear 180-degree cameras)
    const drawSingleViewport = (focusPlayer: Player, vx: number, vy: number, vw: number, vh: number, isRear?: boolean) => {
      let targetCamX = focusPlayer.x;
      let targetCamY = focusPlayer.y;

      if (isRear) {
        // Offset camera slightly behind the player's direction of flight to see trail
        targetCamX -= Math.cos(focusPlayer.angle) * 80;
        targetCamY -= Math.sin(focusPlayer.angle) * 80;
      }

      const camX = targetCamX - vw / 2;
      const camY = targetCamY - vh / 2;

      ctx.save();
      
      // 1. Clip render workspace specifically inside viewport boundaries
      ctx.beginPath();
      ctx.rect(vx, vy, vw, vh);
      ctx.clip();

      if (isRear) {
        // Rotate the view 180 degrees to simulate rear-view camera looking backwards
        ctx.translate(vx + vw / 2, vy + vh / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-(vx + vw / 2), -(vy + vh / 2));
      }

      // 2. Clear background fill
      ctx.fillStyle = '#020617';
      ctx.fillRect(vx, vy, vw, vh);

      // --- A. PARALLAX STARFIELD RENDER ---
      starsRef.current.forEach(star => {
        let sx = (star.x - targetCamX * star.speed) % vw;
        let sy = (star.y - targetCamY * star.speed) % vh;
        if (sx < 0) sx += vw;
        if (sy < 0) sy += vh;

        ctx.save();
        ctx.beginPath();
        ctx.arc(vx + sx, vy + sy, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        
        if (star.size > 1.3) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#60a5fa';
        }
        ctx.fill();
        ctx.restore();
      });

      // --- Translate entire coordinates to vx, vy for simple camera mapping ---
      ctx.save();
      ctx.translate(vx, vy);

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

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(ore.pulseScale, ore.pulseScale);
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = ore.color;
        ctx.fillStyle = ore.color;

        ctx.beginPath();
        ctx.moveTo(0, -ore.radius);
        ctx.lineTo(ore.radius * 0.8, -ore.radius * 0.3);
        ctx.lineTo(ore.radius * 0.5, ore.radius * 0.8);
        ctx.lineTo(0, ore.radius);
        ctx.lineTo(-ore.radius * 0.5, ore.radius * 0.8);
        ctx.lineTo(-ore.radius * 0.8, -ore.radius * 0.3);
        ctx.closePath();
        ctx.fill();

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
        ctx.moveTo(-15, 0);
        ctx.lineTo(15, 0);
        ctx.stroke();

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

        ctx.strokeStyle = ast.color;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
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

        if (ast.asteroidType === 'magma') {
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
          ctx.lineWidth = 1.8;
        } else if (ast.asteroidType === 'ice') {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.lineWidth = 1.8;
        } else if (ast.asteroidType === 'crystal') {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
          ctx.lineWidth = 1.8;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
        }
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ast.vertices[0].x * 0.4, ast.vertices[0].y * 0.4);
        ctx.moveTo(0, 0);
        ctx.lineTo(ast.vertices[Math.floor(ast.vertices.length / 2)].x * 0.5, ast.vertices[Math.floor(ast.vertices.length / 2)].y * 0.5);
        ctx.stroke();

        if (ast.hp < ast.maxHp) {
          const hpPercent = ast.hp / ast.maxHp;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(-ast.radius, ast.radius + 10, ast.radius * 2, 5);
          ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(-ast.radius, ast.radius + 10, ast.radius * 2 * hpPercent, 5);
        }

        let closePlayerNear = false;
        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            const dist = Math.hypot(p.x - ast.x, p.y - ast.y);
            if (dist < 185) closePlayerNear = true;
          }
        });

        if (closePlayerNear) {
          ctx.save();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 4;
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          
          let label = 'Neznámý minerál';
          let amountStr = 'Obsah: ???';
          if (ast.asteroidType === 'magma') {
            label = '🔥 MAGMATICKÝ OBSIDIÁN';
            amountStr = 'Obsah: fialové krystaly, 100%';
          } else if (ast.asteroidType === 'ice') {
            label = '❄️ KRYSTALICKÝ LED/DIAMANT';
            amountStr = 'Obsah: diamanty, 100%';
          } else if (ast.asteroidType === 'crystal') {
            label = '💎 KRYSTALICKÉ JÁDRO';
            amountStr = 'Obsah: krystaly, 100%';
          } else {
            label = '🪨 OBYČEJNÁ RUDNÁ SKÁLA';
            amountStr = 'Obsah: krystaly, 100%';
          }

          ctx.fillText(label, 0, -ast.radius - 20);
          ctx.fillText(amountStr, 0, -ast.radius - 10);
          ctx.restore();
        }

        ctx.restore();
      });

      // --- DRAW ANCHOR CORDS (TETHERS) FROM PLAYERS TO ASTEROIDS ---
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.anchoredAsteroidId) {
          const asteroid = asteroidsRef.current.find(a => a.id === p.anchoredAsteroidId);
          if (asteroid) {
            ctx.save();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.glowColor;
            
            ctx.beginPath();
            ctx.moveTo(p.x - camX, p.y - camY);
            ctx.lineTo(asteroid.x - camX, asteroid.y - camY);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x - camX, p.y - camY, 4, 0, Math.PI * 2);
            ctx.arc(asteroid.x - camX, asteroid.y - camY, 6, 0, Math.PI * 2);
            ctx.fill();
            
            if (p.isDrilling) {
              const rotSpeed = Date.now() / 150;
              ctx.strokeStyle = '#facc15';
              ctx.shadowColor = '#eab308';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(p.x - camX, p.y - camY, 15 + Math.sin(rotSpeed) * 3, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      });

      // --- DRAW COSMIC PIRATES & PIRATE LASERS ---
      piratesRef.current.forEach(pirate => {
        const sx = pirate.x - camX;
        const sy = pirate.y - camY;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(pirate.angle);

        ctx.strokeStyle = pirate.color;
        ctx.fillStyle = '#1e1b4b';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = pirate.color;

        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -15);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-12, 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -5, 4, 10);

        ctx.save();
        ctx.rotate(-pirate.angle);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('☠️ CORSÁR', 0, -pirate.radius - 10);
        ctx.restore();

        ctx.restore();
      });

      pirateLasersRef.current.forEach(pl => {
        const sx = pl.x - camX;
        const sy = pl.y - camY;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(pl.angle);

        ctx.fillStyle = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f43f5e';
        
        ctx.beginPath();
        ctx.arc(0, 0, pl.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // --- DRAW SOLAR STORM ATMOSPHERIC FX ---
      if (solarStormActiveRef.current) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, vw, vh);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, 35, vw, 50);
        
        ctx.fillStyle = '#f97316';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ef4444';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ! AKTIVNÍ SOLÁRNÍ PROTUBERANCE ! ⚡', vw / 2, 60);
        ctx.restore();
      }

      // --- DRAW ACTIVE RUNNING PLAYER SPACESHIPS ---
      const drawPlayerShip = (p: any, playerNum: number, currentHull: number, currentShield: number, maxShieldVal: number) => {
        const sx = p.x - camX;
        const sy = p.y - camY;

        ctx.save();
        ctx.translate(sx, sy);

        if (superMagnetActiveRef.current > 0) {
          ctx.save();
          const spinAngle = Date.now() / 110;
          ctx.lineWidth = 2.0;
          ctx.shadowBlur = 10;
          
          ctx.strokeStyle = '#22d3ee';
          ctx.shadowColor = '#22d3ee';
          ctx.beginPath();
          for (let j = 0; j < 50; j++) {
            const theta = j * 0.22 + spinAngle;
            const r = j * 1.1 + 16;
            const vx_m = Math.cos(theta) * r;
            const vy_m = Math.sin(theta) * r;
            if (j === 0) ctx.moveTo(vx_m, vy_m);
            else ctx.lineTo(vx_m, vy_m);
          }
          ctx.stroke();

          ctx.strokeStyle = '#a855f7';
          ctx.shadowColor = '#a855f7';
          ctx.beginPath();
          for (let j = 0; j < 50; j++) {
            const theta = j * 0.22 + spinAngle + Math.PI;
            const r = j * 1.1 + 16;
            const vx_m = Math.cos(theta) * r;
            const vy_m = Math.sin(theta) * r;
            if (j === 0) ctx.moveTo(vx_m, vy_m);
            else ctx.lineTo(vx_m, vy_m);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.rotate(p.angle);

        const isFlashing = p.invulnerableTime > 0 && Math.floor(p.invulnerableTime / 4) % 2 === 0;
        if (isFlashing) {
          ctx.globalAlpha = 0.35;
        }

        ctx.shadowBlur = 12;
        ctx.shadowColor = playerNum === 1 ? '#60a5fa' : '#a855f7';

        if (p.thrusting) {
          ctx.fillStyle = playerNum === 1 ? '#f97316' : '#ec4899';
          ctx.beginPath();
          ctx.moveTo(-16, -6);
          ctx.lineTo(-28 - Math.random() * 8, 0);
          ctx.lineTo(-16, 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.moveTo(-16, -3);
          ctx.lineTo(-22 - Math.random() * 4, 0);
          ctx.lineTo(-16, 3);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = playerNum === 1 ? '#1e293b' : '#1e1b4b';
        ctx.strokeStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'miter';

        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-10, -16);
        ctx.lineTo(-18, -12);
        ctx.lineTo(-14, -5);
        ctx.lineTo(-14, 5);
        ctx.lineTo(-18, 12);
        ctx.lineTo(-10, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = playerNum === 1 ? '#38bdf8' : '#ec4899';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(-6, -3);
        ctx.lineTo(-6, 3);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = playerNum === 1 ? '#f87171' : '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        if (upgradesRef.current.laserLevel === 1) {
          ctx.moveTo(6, 0);
          ctx.lineTo(18, 0);
        } else if (upgradesRef.current.laserLevel === 2) {
          ctx.moveTo(-2, -8); ctx.lineTo(16, -8);
          ctx.moveTo(-2, 8); ctx.lineTo(16, 8);
        } else if (upgradesRef.current.laserLevel === 3) {
          ctx.moveTo(-2, -10); ctx.lineTo(14, -10);
          ctx.moveTo(6, 0); ctx.lineTo(19, 0);
          ctx.moveTo(-2, 10); ctx.lineTo(14, 10);
        } else if (upgradesRef.current.laserLevel === 4) {
          ctx.strokeStyle = playerNum === 1 ? '#c084fc' : '#ec4899';
          ctx.moveTo(-5, -6); ctx.lineTo(18, -4);
          ctx.moveTo(-5, 6); ctx.lineTo(18, 4);
          ctx.moveTo(5, -2); ctx.lineTo(21, 0);
          ctx.moveTo(5, 2); ctx.lineTo(21, 0);
        } else {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.moveTo(-5, -12); ctx.lineTo(14, -10);
          ctx.moveTo(-5, 12); ctx.lineTo(14, 10);
          ctx.moveTo(-1, -6); ctx.lineTo(18, -4);
          ctx.moveTo(-1, 6); ctx.lineTo(18, 4);
          ctx.moveTo(8, 0); ctx.lineTo(24, 0);
        }
        ctx.stroke();

        if (upgradesRef.current.shieldLevel > 0 && currentShield > 0) {
          ctx.save();
          ctx.rotate(-p.angle);
          ctx.strokeStyle = playerNum === 1 
            ? `rgba(56, 189, 248, ${0.15 + (currentShield / maxShieldVal) * 0.4})`
            : `rgba(168, 85, 247, ${0.15 + (currentShield / maxShieldVal) * 0.4})`;
          ctx.shadowColor = playerNum === 1 ? '#38bdf8' : '#a855f7';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.rotate(-p.angle);
        ctx.fillStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Hráč ${playerNum}`, 0, -p.radius - 12);
        ctx.restore();

        ctx.restore();
      };

      const drawPlayerShipWrecked = (p: any, playerNum: 1 | 2, reviveProgress: number) => {
        const sx = p.x - camX;
        const sy = p.y - camY;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.angle);

        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-10, -16);
        ctx.lineTo(-18, -12);
        ctx.lineTo(-14, -5);
        ctx.lineTo(-14, 5);
        ctx.lineTo(-18, 12);
        ctx.lineTo(-10, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1e293b'; 
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(-6, -3);
        ctx.lineTo(-6, 3);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        ctx.save();
        ctx.translate(sx, sy);

        const pulse = 1.0 + Math.sin(Date.now() * 0.009) * 0.15;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.5 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('S.O.S.', 0, -p.radius - 12);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText('PŘILEŤ PRO OŽIVENÍ', 0, p.radius + 18);

        if (reviveProgress > 0) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + (reviveProgress / 150) * Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${Math.round((reviveProgress / 150) * 100)}%`, 0, -p.radius - 24);
        }

        ctx.restore();
      };

      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const pMaxShield = 100 + (upgradesRef.current.shieldLevel - 1) * 35;
          drawPlayerShip(p, p.playerNum, p.hull, p.shield, pMaxShield);
        } else {
          if (playersRef.current.length > 1) {
            drawPlayerShipWrecked(p, p.playerNum, p.reviveTimer);
          }
        }
      });

      // --- G. ACTIVE MAGNET BOUNDARY GLOW CIRCLE ---
      if (upgradesRef.current.magnetLevel > 1 && (keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight'])) {
        let drawMagnetRadius = 100;
        if (upgradesRef.current.magnetLevel === 2) drawMagnetRadius = 180;
        else if (upgradesRef.current.magnetLevel === 3) drawMagnetRadius = 260;
        else if (upgradesRef.current.magnetLevel === 4) drawMagnetRadius = 340;
        else if (upgradesRef.current.magnetLevel === 5) drawMagnetRadius = 1200;
        else if (upgradesRef.current.magnetLevel >= 6) drawMagnetRadius = 8000;

        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 8]);
            ctx.beginPath();
            ctx.arc(p.x - camX, p.y - camY, drawMagnetRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      ctx.restore(); // Restore context origin shift
      ctx.restore(); // Restore master clip
    };

    // Apply dynamic split-screen layout if two or more players are active
    if (playersRef.current.length > 1) {
      const activePlayers = playersRef.current.slice(0, 4);
      const count = activePlayers.length;

      if (count === 2) {
        const p1 = activePlayers[0];
        const p2 = activePlayers[1];
        const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const splitThreshold = 550; // Splitting trigger distance in pixels

        if (distance > splitThreshold) {
          const halfW = width / 2;

          // 1. Left: Player 1 Front View
          drawSingleViewport(p1, 0, 0, halfW, height, false);
          // 2. Right: Player 2 Front View
          drawSingleViewport(p2, halfW, 0, halfW, height, false);

          // Vertical separation line
          ctx.save();
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 3.0;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW, height);
          ctx.stroke();

          // Labels
          ctx.font = 'bold 9px monospace';
          ctx.shadowBlur = 4;
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#06b6d4';
          ctx.textAlign = 'right';
          ctx.fillText('📡 PANEL H1 ', halfW - 12, 22);
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = '#a855f7';
          ctx.textAlign = 'left';
          ctx.fillText(' PANEL H2 📡', halfW + 12, 22);
          ctx.restore();
        } else {
          // Close together: Shared Camera mode across the entire screen (1 joint window)
          const midpointPlayer = {
            ...p1, // spread structure to replicate full state
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          };
          drawSingleViewport(midpointPlayer, 0, 0, width, height, false);

          // Connection indicator
          ctx.save();
          ctx.fillStyle = 'rgba(34, 211, 238, 0.75)';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 4;
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🔗 SYNC CAM PROPOJENÍ (Rozdělení obrazovky na 2 při vzdálení)', width / 2, 24);
          ctx.restore();
        }
      } else if (count === 3) {
        // 3 Players layout - split into 3 columns side-by-side
        const oneThirdW = width / 3;
        drawSingleViewport(activePlayers[0], 0, 0, oneThirdW, height, false);
        drawSingleViewport(activePlayers[1], oneThirdW, 0, oneThirdW, height, false);
        drawSingleViewport(activePlayers[2], 2 * oneThirdW, 0, oneThirdW, height, false);

        // Divider lines
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(oneThirdW, 0);
        ctx.lineTo(oneThirdW, height);
        ctx.moveTo(2 * oneThirdW, 0);
        ctx.lineTo(2 * oneThirdW, height);
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('PANEL H1', oneThirdW / 2, 22);
        ctx.fillStyle = '#c084fc';
        ctx.fillText('PANEL H2', oneThirdW + oneThirdW / 2, 22);
        ctx.fillStyle = '#fb923c';
        ctx.fillText('PANEL H3', 2 * oneThirdW + oneThirdW / 2, 22);
        ctx.restore();
      } else {
        // 4 Players layout - split into 2x2 grid
        const halfW = width / 2;
        const halfH = height / 2;
        drawSingleViewport(activePlayers[0], 0, 0, halfW, halfH, false);
        drawSingleViewport(activePlayers[1], halfW, 0, halfW, halfH, false);
        drawSingleViewport(activePlayers[2], 0, halfH, halfW, halfH, false);
        drawSingleViewport(activePlayers[3], halfW, halfH, halfW, halfH, false);

        // Grid lines
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(halfW, 0); ctx.lineTo(halfW, height);
        ctx.moveTo(0, halfH); ctx.lineTo(width, halfH);
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('PANEL H1', halfW / 2, 22);
        ctx.fillStyle = '#c084fc';
        ctx.fillText('PANEL H2', halfW + halfW / 2, 22);
        ctx.fillStyle = '#fb923c';
        ctx.fillText('PANEL H3', halfW / 2, halfH + 22);
        ctx.fillStyle = '#4ade80';
        ctx.fillText('PANEL H4', halfW + halfW / 2, halfH + 22);
        ctx.restore();
      }
    } else if (playersRef.current.length === 1) {
      // Standard Single Viewport mode
      drawSingleViewport(playersRef.current[0], 0, 0, width, height, false);
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

          {/* ACTIVE ABILITIES HUD (DONKEY KEEPER) */}
          <div className="absolute left-4 bottom-28 pointer-events-auto flex flex-col gap-2 select-none">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Aktivní Schopnosti (Obchod)</span>
            <div className="flex gap-2">
              {/* Ability 1: Chain Lightning (Q) */}
              <div className={`relative flex items-center gap-2 px-3 py-2 border rounded-xl font-mono text-xs transition-all ${
                upgrades.abilityLightningLevel > 0 
                  ? 'bg-slate-950/90 border-amber-500/25 text-amber-300' 
                  : 'bg-slate-950/40 border-slate-900/40 text-slate-600 opacity-40'
              }`}>
                <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/15 text-amber-400 font-extrabold text-[10px]">Q</div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[11px] text-slate-200 leading-none">Řetězový blesk</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Lvl {upgrades.abilityLightningLevel || 'Locked'}</span>
                </div>
                {lightningCooldown > 0 && (
                  <div className="absolute inset-0 bg-slate-950/90 rounded-xl flex items-center justify-center font-bold text-red-500 border border-red-500/30">
                    {lightningCooldown}s
                  </div>
                )}
              </div>

              {/* Ability 2: Kinetic Pulse (E) */}
              <div className={`relative flex items-center gap-2 px-3 py-2 border rounded-xl font-mono text-xs transition-all ${
                upgrades.abilityPulseLevel > 0 
                  ? 'bg-slate-950/90 border-indigo-500/25 text-indigo-300' 
                  : 'bg-slate-950/40 border-slate-900/40 text-slate-600 opacity-40'
              }`}>
                <div className="flex items-center justify-center w-5 h-5 rounded bg-indigo-500/15 text-indigo-400 font-extrabold text-[10px]">E</div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[11px] text-slate-200 leading-none">Kinetický puls</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Lvl {upgrades.abilityPulseLevel || 'Locked'}</span>
                </div>
                {pulseCooldown > 0 && (
                  <div className="absolute inset-0 bg-slate-950/90 rounded-xl flex items-center justify-center font-bold text-red-500 border border-red-500/30">
                    {pulseCooldown}s
                  </div>
                )}
              </div>

              {/* Ability 3: Super Magnet (R) */}
              <div className={`relative flex items-center gap-2 px-3 py-2 border rounded-xl font-mono text-xs transition-all ${
                upgrades.abilitySuperMagnetLevel > 0 
                  ? 'bg-slate-950/90 border-cyan-500/25 text-cyan-300' 
                  : 'bg-slate-950/40 border-slate-900/40 text-slate-600 opacity-40'
              }`}>
                <div className="flex items-center justify-center w-5 h-5 rounded bg-cyan-500/15 text-cyan-400 font-extrabold text-[10px]">R</div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[11px] text-slate-200 leading-none">Super Vortex</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Lvl {upgrades.abilitySuperMagnetLevel || 'Locked'}</span>
                </div>
                {superMagnetActive > 0 ? (
                  <div className="absolute inset-0 bg-cyan-950/95 rounded-xl flex flex-col items-center justify-center font-bold text-cyan-300 border border-cyan-400 animate-pulse font-sans">
                    <span className="text-[8px] uppercase tracking-wider text-cyan-400 font-extrabold leading-tight">AKTIVNÍ</span>
                    <span>{superMagnetActive}s</span>
                  </div>
                ) : superMagnetCooldown > 0 ? (
                  <div className="absolute inset-0 bg-slate-950/90 rounded-xl flex items-center justify-center font-bold text-red-500 border border-red-500/30">
                    {superMagnetCooldown}s
                  </div>
                ) : null}
              </div>
            </div>

            {/* COSMIC WEATHER STATION (ENVIRONMENT HAZARDS) */}
            <div className={`mt-3 p-3 rounded-xl border font-mono text-[11px] flex flex-col gap-1 shadow-lg transition-all ${
              solarStormActive 
                ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse' 
                : solarStormWarning > 0 
                  ? 'bg-amber-950/95 border-amber-500 text-amber-200 animate-bounce' 
                  : 'bg-slate-950/85 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center gap-1.5 font-sans font-extrabold text-xs uppercase tracking-wider">
                <span className={`w-2 h-2 rounded-full ${solarStormActive ? 'bg-red-500 animate-ping' : solarStormWarning > 0 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span>Kosmické počasí</span>
              </div>
              {solarStormActive ? (
                <div className="flex flex-col gap-0.5 font-bold mt-1">
                  <span className="text-red-400">🚨 RADIACE AKTIVNÍ!</span>
                  <span>Schovej se za velké rotující asteroidy nebo ukotvi loď!</span>
                </div>
              ) : solarStormWarning > 0 ? (
                <div className="flex flex-col gap-0.5 font-bold mt-1">
                  <span className="text-amber-400">⚠️ SOLÁRNÍ BOUŘE ZA: {solarStormWarning}s</span>
                  <span>Rychle najdi bezpečný úkryt!</span>
                </div>
              ) : (
                <span className="text-slate-500 mt-1">Magnetosféra stabilní. Stav: OK</span>
              )}
            </div>

            {/* MECHANICAL ANCHOR & SCANNING SYSTEMS INFO CARD */}
            <div className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 font-mono text-[10px] text-slate-400 flex flex-col gap-1 max-w-[260px] shadow-lg">
              <span className="font-sans font-extrabold text-xs text-slate-300 uppercase tracking-widest leading-none">⚓ Kotva a Skenování</span>
              
              <div className="flex flex-col gap-1 mt-1 font-sans">
                <div className="flex justify-between items-center bg-slate-900/60 p-1 rounded">
                  <span>Hráč 1 Kotva:</span>
                  <span className="bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-[9px] font-mono">Kl. H / Gp L3</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/60 p-1 rounded">
                  <span>Hráč 2 Kotva:</span>
                  <span className="bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-[9px] font-mono">Kl. G / Gp R3</span>
                </div>
              </div>

              <p className="mt-1 leading-tight text-slate-500 text-[9px]">
                Přileť blízko k asteroidu a nahoď kotvu. Loď se synchronizuje s rotací a automaticky spustí <b>těžební vrt</b> bez spotřeby energie!
              </p>
              <p className="text-cyan-400 text-[9px] leading-tight">
                🔍 <b>Skenery:</b> Blízké asteroidy automaticky zobrazují mineralogický obsah a ložiska v reálném čase.
              </p>
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
              <div className="mt-2 bg-slate-950/90 border border-slate-800 p-3 rounded-xl max-w-xs text-xs space-y-2 text-slate-300 shadow-2xl animate-fade-in pr-5">
                <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Letový manuál</span>
                <p className="text-cyan-400 font-bold border-b border-slate-900 pb-0.5 text-[10px]">Hráč 1 (Modrý):</p>
                <p>• <b>Let:</b> Klávesy [ W / S ] nebo Gamepad Levý trigger (LT)</p>
                <p>• <b>Rotace:</b> [ A / D ] / Myš</p>
                <p>• <b>Střelba:</b> [ Mezerník ] / Levý klik / Gamepad [ A ]</p>
                
                <p className="text-purple-400 font-bold border-b border-slate-900 pb-0.5 pt-1 text-[10px]">Hráč 2 (Fialový - Kooporace):</p>
                <p>• <b>Let:</b> Šipka nahoru/dolů nebo klávesy [ I / K ]</p>
                <p>• <b>Rotace:</b> Šipky vlevo/vpravo nebo klávesy [ J / L ]</p>
                <p>• <b>Střelba:</b> [ Enter ] / Pravý Shift / klávesa [ O ]</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-900 pt-1">Prostor se inteligentně posouvá na průměrný midpoint lodí.</p>
              </div>
            )}
          </div>

          {/* DISEMBARK EXPEDITION SURFACE EXPLORER BANNER */}
          {activePlayers.some(p => p.anchoredAsteroidId) && (
            <div className="w-full max-w-lg sm:max-w-2xl mx-auto pointer-events-auto select-none self-center mb-2">
              <div className="bg-slate-950/95 border-2 border-cyan-500/70 p-3.5 rounded-2xl shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-3 backdrop-blur-md animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-lg shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                    🛰️
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest block leading-3">Přistáno na tělesu</span>
                    <span className="text-sm font-black text-slate-100 uppercase tracking-tight leading-4 block">
                      {findAnchoredAsteroid()?.name || 'Neznámý Asteroid'}
                    </span>
                    <span className="text-[9px] text-slate-400 block leading-none mt-1 font-sans">
                      Drahokamy nalezeny! Vstup se svým kosmonautem do minihry s kruhovou gravitací.
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleOpenExplorer}
                  className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                  id="disembark-surface-button"
                >
                  <span>Prozkoumat [Enter / X]</span>
                  <ChevronRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>
            </div>
          )}

          {/* BOTTOM ROW STATE METERS: Hull & Shields */}
          <div className="w-full max-w-sm sm:max-w-4xl mx-auto pointer-events-auto flex flex-wrap gap-3 md:gap-4 justify-center items-stretch select-none self-center">
            {activePlayers.map(p => {
              const pMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel >= 5 ? 20 : 0) + (upgrades.hullLevel >= 6 ? 30 : 0);
              const pMaxShield = 100 + (upgrades.shieldLevel - 1) * 35;
              
              const isKeyboard1 = p.inputSource === 'keyboard_p1';
              const isKeyboard2 = p.inputSource === 'keyboard_p2';
              const typeIcon = p.inputSource === 'gamepad' ? '🎮' : '⌨️';

              return (
                <div 
                  key={p.id} 
                  className="flex-1 min-w-[200px] max-w-[320px] bg-slate-950/90 border p-3 sm:p-3.5 rounded-2xl shadow-xl space-y-2 relative group-item transition-all duration-300"
                  style={{ borderColor: `${p.color}40`, boxShadow: `0 10px 25px -5px ${p.color}05` }}
                >
                  <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                    <span 
                      className="font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5"
                      style={{ color: p.color }}
                    >
                      {typeIcon} {p.name}
                    </span>
                    <button
                      onClick={() => leavePlayer(p.id)}
                      className="text-slate-500 hover:text-red-400 text-[10px] cursor-pointer font-mono font-bold px-1.5 py-0.5 rounded hover:bg-red-950/40 transition-colors"
                      title="Odpojit hráče ze hry"
                    >
                      Odpojit ×
                    </button>
                  </div>
                  
                  {/* Health (Hull) Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400 flex items-center gap-1 uppercase font-bold text-[9px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        Trup lodi
                      </span>
                      <span className="font-bold" style={{ color: p.color }}>
                        {Math.round(p.hull)} / {pMaxHull} HP
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full border border-slate-800 overflow-hidden">
                      <div 
                        className="h-full transition-all duration-200"
                        style={{ 
                          width: `${Math.max(0, (p.hull / pMaxHull) * 100)}%`,
                          backgroundColor: p.color
                        }}
                      />
                    </div>
                  </div>

                  {/* Shield Bar (if upgraded) */}
                  {upgrades.shieldLevel > 0 ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400 flex items-center gap-1 uppercase font-bold text-[9px]">
                          <Shield className="w-2.5 h-2.5 fill-current" style={{ color: p.glowColor }} />
                          Energetický štít
                        </span>
                        <span className="font-bold" style={{ color: p.glowColor }}>
                          {Math.round(p.shield)} / {pMaxShield} HP
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full border border-slate-800 overflow-hidden">
                        <div 
                          className="h-full transition-all duration-100 shadow-md"
                          style={{ 
                            width: `${Math.max(0, (p.shield / pMaxShield) * 100)}%`,
                            backgroundColor: p.glowColor,
                            boxShadow: `0 0 6px ${p.glowColor}`
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-500 text-center font-bold tracking-wider uppercase border border-dashed border-slate-800/80 py-1 rounded-lg">
                      Chybí Štíty
                    </div>
                  )}
                </div>
              );
            })}

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

            {/* Fleet drop-in configuration and controls */}
            <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl space-y-3.5 text-left text-xs">
              <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] block font-sans">🛸 SYSTÉM DYNAMICKÉHO PŘIPOJOVÁNÍ HRÁČŮ (DROP-IN)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300 font-mono">
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850/80">
                  <span className="text-cyan-400 font-black block border-b border-slate-950 pb-1 mb-1.5 text-[10px]">⌨️ PILOT 1 (KLÁVESNICE - ŠIPKY)</span>
                  <p>• <b>Let vpřed:</b> Šipka nahoru</p>
                  <p>• <b>Zpětný chod:</b> Šipka dolů</p>
                  <p>• <b>Otáčení:</b> Šipka vlevo / vpravo</p>
                  <p>• <b>Laser:</b> Pravý CTRL / Mezerník</p>
                  <p>• <b>Dovednosti:</b> Čísla [ 7, 8, 9, 0 ]</p>
                </div>

                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850/80">
                  <span className="text-purple-400 font-black block border-b border-slate-950 pb-1 mb-1.5 text-[10px]">⌨️ PILOT 2 (KLÁVESNICE - WASD)</span>
                  <p>• <b>Let vpřed:</b> Klávesa [ W ]</p>
                  <p>• <b>Zpětný chod:</b> Klávesa [ S ]</p>
                  <p>• <b>Otáčení:</b> Klávesy [ A / D ]</p>
                  <p>• <b>Laser:</b> Levý CTRL</p>
                  <p>• <b>Dovednosti:</b> Čísla [ 1, 2, 3, 4 ]</p>
                </div>
              </div>

              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-850/80 text-[11px] text-slate-300 leading-relaxed font-sans">
                <span className="text-emerald-400 font-extrabold block border-b border-slate-950 pb-1 mb-1.5 text-[10px] uppercase">🎮 PILOTI NA OVLADAČÍCH (GAMEPADECH)</span>
                <p>• Připojte USB nebo Bluetooth gamepad a stiskněte libovolné tlačítko.</p>
                <p>• Ovladač se <b>automaticky přihlásí</b> jako nový nezávislý pilot přímo uprostřed akce!</p>
                <p>• V průběhu hry se takto může připojit <b>libovolné množství hráčů</b> podle počtu gamepadů.</p>
                <p>• Každého pilota lze odpojit tlačítkem v dolním panelu lodi.</p>
              </div>

              {/* Gamepad connection status detection */}
              {gamepadsDetected ? (
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-900/30 px-3 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Satelitní družice detekovala připojené herní ovladače (Gamepady)!</span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-mono italic px-1 pt-0.5">
                  💡 Tip: Připojte Bluetooth/USB gamepady pro epickou hru s kamarády na jedné obrazovce!
                </div>
              )}
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

      {/* 7. CIRCULAR GRAVITY ASTEROID EXPLORER MINIGAME OVERLAY */}
      {explorerAsteroidData && (
        <AsteroidExplorer
          isOpen={isExplorerOpen}
          onClose={handleCloseExplorer}
          asteroidType={explorerAsteroidData.type}
          asteroidRadius={explorerAsteroidData.radius}
          asteroidColor={explorerAsteroidData.color}
          asteroidName={explorerAsteroidData.name}
        />
      )}

    </div>
  );
}
