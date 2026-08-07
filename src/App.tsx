/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  CarrierClass,
  PlayerShipClass,
  CapitalShipType,
  CapitalShipStation,
  CapitalShip,
  Pirate,
  PirateLaser,
  SockEntity,
  Boss,
  LavaProjectile,
  BlizzardZone,
  BossGuidedFireball,
  BossFreezingPulse,
  BossEscortDrone,
  FireTrail,
  PlayerTrailBubble,
  ArenaPlatform
} from './types';
import { 
  playLaserSound, 
  playExplosionSound, 
  playCollectSound, 
  playDamageSound, 
  playShieldDownSound, 
  playUpgradeSound,
  playMapChangeSound,
  playSuperMagnetSound,
  playSolarStormWarningSound,
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
import EarningsChartModal, { EarningDataPoint } from './components/EarningsChartModal';
import MissionsModal, { Mission } from './components/MissionsModal';
import { generateSectors, Sector, SectorType } from './data/sectors';
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
  Users,
  Skull,
  Cpu,
  Map,
  Ship,
  Flame,
  TrendingUp,
  CheckSquare
} from 'lucide-react';

// Optimize performance by patching canvas shadowBlur setter once globally
if (typeof window !== 'undefined' && window.CanvasRenderingContext2D) {
  const originalSet = Object.getOwnPropertyDescriptor(window.CanvasRenderingContext2D.prototype, 'shadowBlur')?.set;
  if (originalSet) {
    Object.defineProperty(window.CanvasRenderingContext2D.prototype, 'shadowBlur', {
      set: function(this: CanvasRenderingContext2D, value: number) {
        if ((window as any).__lowPerformanceMode) return;
        originalSet.call(this, value);
      },
      configurable: true
    });
  }
}

const ASTEROID_COLORS = {
  colossal: '#374151', // deep gray-700
  huge: '#4b5563',   // gray-600
  large: '#6b7280',  // gray-500
  medium: '#9ca3af', // gray-405
  small: '#d1d5db',  // gray-300
};

// --- ANIMATED HUD COMPONENTS ---
interface AnimatedScoreProps {
  value: number;
  className?: string;
}

function AnimatedScore({ value, className = "" }: AnimatedScoreProps) {
  const [animationClass, setAnimationClass] = useState("");
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setAnimationClass("animate-score-pop");
      prevValueRef.current = value;
      const timer = setTimeout(() => {
        setAnimationClass("");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return <span className={`${className} ${animationClass}`}>{value}</span>;
}

interface AnimatedHealthProps {
  value: number;
  maxValue: number;
  className?: string;
  style?: React.CSSProperties;
  isShield?: boolean;
}

function AnimatedHealth({ value, maxValue, className = "", style = {}, isShield = false }: AnimatedHealthProps) {
  const [animationClass, setAnimationClass] = useState("");
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      if (value < prevValueRef.current) {
        setAnimationClass("animate-damage-pop");
      } else {
        setAnimationClass("animate-heal-pop");
      }
      prevValueRef.current = value;
      const timer = setTimeout(() => {
        setAnimationClass("");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span className={`${className} ${animationClass}`} style={style}>
      {Math.round(value)} / {maxValue} HP
    </span>
  );
}

export default function App() {
  // --- STATE ---
  const [upgrades, setUpgrades] = useState<Upgrades>(loadUpgrades());
  const [stats, setStats] = useState<PlayerStats>(loadStats());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [sectors, setSectors] = useState<Sector[]>(() => {
    const baseSectors = generateSectors();
    try {
      const savedDiscovered = localStorage.getItem('asteroid_miner_discovered_sectors');
      if (savedDiscovered) {
        const discoveredIds = JSON.parse(savedDiscovered) as string[];
        return baseSectors.map(s => discoveredIds.includes(s.id) ? { ...s, discovered: true } : s);
      }
    } catch (e) {
      console.error(e);
    }
    return baseSectors;
  });
  const [currentSectorId, setCurrentSectorId] = useState<string>(() => {
    return localStorage.getItem('asteroid_miner_current_sector_id') || 'sector_2_2';
  });
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [selectedMapSector, setSelectedMapSector] = useState<Sector | null>(null);
  const [dockedPlayerIds, setDockedPlayerIds] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(!getSoundState());
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  const [gameMode, setGameMode] = useState<'single' | 'coop'>('single');
  const [capitalShipMode, setCapitalShipMode] = useState<boolean>(false);
  const [selectedCapitalShipType, setSelectedCapitalShipType] = useState<CapitalShipType>('mining');
  const [capitalShip, setCapitalShipState] = useState<CapitalShip | null>(null);
  const [gamepadsDetected, setGamepadsDetected] = useState<boolean[]>([false, false]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'nightmare'>('medium');
  const [enemiesEnabled, setEnemiesEnabled] = useState<boolean>(true);
  const [lowPerformanceMode, setLowPerformanceMode] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Steam|SteamDeck|Linux/i.test(navigator.userAgent);
    }
    return false;
  });

  // --- EARNINGS HISTORY GRAPH STATE ---
  const [isEarningsChartOpen, setIsEarningsChartOpen] = useState<boolean>(false);
  const [earningsHistory, setEarningsHistory] = useState<EarningDataPoint[]>([]);

  // --- MISSIONS & CONTRACTS STATE ---
  const [isMissionsOpen, setIsMissionsOpen] = useState<boolean>(false);
  const [missionToast, setMissionToast] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>(() => [
    {
      id: 'm_mine_crystals',
      title: 'Těžba Křemíku',
      description: 'Vytěž 15 krystalů ze studených křemíkových asteroidů.',
      category: 'mining',
      targetType: 'mine_crystal',
      targetAmount: 15,
      currentAmount: 0,
      rewardCrystals: 120,
      rewardDiamonds: 0,
      completed: false,
      claimed: false,
    },
    {
      id: 'm_mine_diamonds',
      title: 'Lov Diamantů',
      description: 'Získej 3 vzácné modré diamanty z hlubinného minerálního jádra.',
      category: 'mining',
      targetType: 'mine_diamond',
      targetAmount: 3,
      currentAmount: 0,
      rewardCrystals: 200,
      rewardDiamonds: 3,
      completed: false,
      claimed: false,
    },
    {
      id: 'm_obsidian',
      title: 'Vesmírný Alchymista',
      description: 'Vytěž 1 tmavý fialový obsidián z magmatického sektoru.',
      category: 'mining',
      targetType: 'mine_obsidian',
      targetAmount: 1,
      currentAmount: 0,
      rewardCrystals: 150,
      rewardDiamonds: 5,
      completed: false,
      claimed: false,
    },
    {
      id: 'm_kill_pirates',
      title: 'Bojovník s Piráty',
      description: 'Neutralizuj 3 nepřátelské pirátské lodě v sektoru.',
      category: 'combat',
      targetType: 'kill_pirates',
      targetAmount: 3,
      currentAmount: 0,
      rewardCrystals: 250,
      rewardDiamonds: 4,
      completed: false,
      claimed: false,
    },
    {
      id: 'm_destroy_asteroids',
      title: 'Demoliční Četa',
      description: 'Rozbij 20 vesmírných asteroidů libovolného typu.',
      category: 'mining',
      targetType: 'destroy_asteroids',
      targetAmount: 20,
      currentAmount: 0,
      rewardCrystals: 150,
      rewardDiamonds: 0,
      completed: false,
      claimed: false,
    },
    {
      id: 'm_super_magnet',
      title: 'Gravitační Šok',
      description: 'Aktivuj super-magnetický vysavač 2x během jednoho letu.',
      category: 'exploration',
      targetType: 'super_magnet_use',
      targetAmount: 2,
      currentAmount: 0,
      rewardCrystals: 180,
      rewardDiamonds: 2,
      completed: false,
      claimed: false,
    }
  ]);

  const advanceMissionProgress = (type: Mission['targetType'], amount: number = 1) => {
    setMissions(prev => {
      return prev.map(m => {
        if (m.targetType === type && !m.completed) {
          const newAmt = m.currentAmount + amount;
          const isDone = newAmt >= m.targetAmount;
          if (isDone) {
            playUpgradeSound();
            setMissionToast(`🎯 MISE SPLNĚNA: ${m.title}! Navštivte menu misí pro odměnu.`);
            setTimeout(() => setMissionToast(null), 4500);
          }
          return {
            ...m,
            currentAmount: newAmt,
            completed: isDone
          };
        }
        return m;
      });
    });
  };

  const handleClaimMissionReward = (missionId: string) => {
    setMissions(prev => {
      return prev.map(m => {
        if (m.id === missionId && m.completed && !m.claimed) {
          if (m.rewardCrystals > 0) {
            setUpgrades(u => {
              const updated = { ...u, crystals: u.crystals + m.rewardCrystals };
              saveUpgrades(updated);
              return updated;
            });
            setRunCrystals(rc => rc + m.rewardCrystals);
          }
          if (m.rewardDiamonds > 0) {
            setUpgrades(u => {
              const updated = { ...u, diamonds: u.diamonds + m.rewardDiamonds };
              saveUpgrades(updated);
              return updated;
            });
            setRunDiamonds(rd => rd + m.rewardDiamonds);
          }
          playCollectSound('diamond');
          return { ...m, claimed: true };
        }
        return m;
      });
    });
  };

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
  const [sockCooldown, setSockCooldown] = useState<number>(0);

  // Active Map / Sector State
  const [selectedMap, setSelectedMap] = useState<string>('silicon');
  const selectedMapRef = useRef<string>('silicon');

  // Boss Fight State
  const [isBossFightActive, setIsBossFightActive] = useState<boolean>(false);
  const [bossHp, setBossHp] = useState<number>(1000);
  const [bossMaxHp, setBossMaxHp] = useState<number>(1000);
  const [bossLives, setBossLives] = useState<number>(6);
  const [bossMaxLives, setBossMaxLives] = useState<number>(6);
  const [showBossDefeatModal, setShowBossDefeatModal] = useState<boolean>(false);
  const [showBossVictoryModal, setShowBossVictoryModal] = useState<boolean>(false);
  const [isDecisionOpen, setIsDecisionOpen] = useState<boolean>(false);
  const isDecisionOpenRef = useRef<boolean>(false);

  // Combat Log and Combo Multiplier State & Refs
  const [combatLog, setCombatLog] = useState<{ id: string; text: string; timestamp: number; color: string }[]>([]);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const comboMultiplierRef = useRef<number>(1);
  const lastAsteroidDestroyedTimeRef = useRef<number>(0);

  const addCombatLogMessage = (text: string, color: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setCombatLog(prev => {
      const updated = [...prev, { id, text, timestamp: Date.now(), color }];
      if (updated.length > 6) {
        return updated.slice(-6);
      }
      return updated;
    });
  };

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
  const socksRef = useRef<SockEntity[]>([]);
  const dronesRef = useRef<any[]>([]);
  const carrierRepairDronesRef = useRef<any[]>([]);
  const bossRef = useRef<Boss | null>(null);
  const wormholeRef = useRef<any | null>(null);
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
  const statsRef = useRef<PlayerStats>(stats);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isShopOpenRef = useRef<boolean>(isShopOpen);
  const scoreRef = useRef<number>(0);
  const maxHullRef = useRef<number>(100);
  const maxShieldRef = useRef<number>(0);

  const lightningCooldownRef = useRef<number>(0);
  const pulseCooldownRef = useRef<number>(0);
  const superMagnetCooldownRef = useRef<number>(0);
  const superMagnetActiveRef = useRef<number>(0);
  const sockCooldownRef = useRef<number>(0);
  const isBossFightActiveRef = useRef<boolean>(false);

  const carrierRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    dockedPlayerIds: string[];
    radius: number;
  }>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: 1000,
    maxHp: 1000,
    shield: 500,
    maxShield: 500,
    dockedPlayerIds: [],
    radius: 75,
  });

  const sectorsRef = useRef<Sector[]>(sectors);
  const currentSectorIdRef = useRef<string>(currentSectorId);
  const dockedPlayerIdsRef = useRef<string[]>([]);
  const lastCarrierFiredRef = useRef<number>(0);
  const lastPdsFiredRef = useRef<number>(0);
  const activePdsBeamsRef = useRef<{ fromX: number; fromY: number; toX: number; toY: number; alpha: number }[]>([]);

  const capitalShipModeRef = useRef<boolean>(capitalShipMode);
  const capitalShipRef = useRef<CapitalShip | null>(capitalShip);

  useEffect(() => {
    capitalShipModeRef.current = capitalShipMode;
  }, [capitalShipMode]);

  useEffect(() => {
    capitalShipRef.current = capitalShip;
  }, [capitalShip]);

  useEffect(() => {
    sectorsRef.current = sectors;
  }, [sectors]);

  useEffect(() => {
    currentSectorIdRef.current = currentSectorId;
  }, [currentSectorId]);

  const runCrystalsRef = useRef<number>(0);
  const runDiamondsRef = useRef<number>(0);
  useEffect(() => {
    runCrystalsRef.current = runCrystals;
  }, [runCrystals]);
  useEffect(() => {
    runDiamondsRef.current = runDiamonds;
  }, [runDiamonds]);

  // Periodic Telemetry Snapshot for Recharts Earnings Chart (10s intervals)
  useEffect(() => {
    if (!isPlaying) return;

    const initialTime = new Date().toTimeString().slice(0, 5);
    setEarningsHistory([{
      time: initialTime,
      timestamp: Date.now(),
      crystals: runCrystalsRef.current,
      diamonds: runDiamondsRef.current,
      deltaCrystals: 0,
      deltaDiamonds: 0
    }]);

    const interval = setInterval(() => {
      const timeStr = new Date().toTimeString().slice(0, 5);
      const curC = runCrystalsRef.current;
      const curD = runDiamondsRef.current;

      setEarningsHistory(prev => {
        const lastPt = prev[prev.length - 1];
        const deltaC = lastPt ? Math.max(0, curC - lastPt.crystals) : curC;
        const deltaD = lastPt ? Math.max(0, curD - lastPt.diamonds) : curD;

        const newPt: EarningDataPoint = {
          time: timeStr,
          timestamp: Date.now(),
          crystals: curC,
          diamonds: curD,
          deltaCrystals: deltaC,
          deltaDiamonds: deltaD
        };

        const nextArr = [...prev, newPt];
        if (nextArr.length > 60) nextArr.shift();
        return nextArr;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    dockedPlayerIdsRef.current = dockedPlayerIds;
    carrierRef.current.dockedPlayerIds = dockedPlayerIds;
  }, [dockedPlayerIds]);

  const cameraShakeRef = useRef<number>(0);
  const triggerCameraShake = (intensity: number) => {
    cameraShakeRef.current = Math.min(25, cameraShakeRef.current + intensity);
  };
  const lastEventTimeRef = useRef<number>(Date.now());
  const activeAnomalyRef = useRef<{ x: number; y: number; radius: number; lifetime: number; maxLifetime: number } | null>(null);

  const gameModeRef = useRef<'single' | 'coop'>('single');
  const difficultyRef = useRef<'easy' | 'medium' | 'hard' | 'nightmare'>('medium');
  const enemiesEnabledRef = useRef<boolean>(true);
  const lowPerformanceModeRef = useRef<boolean>(lowPerformanceMode);

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

  const lavaProjectilesRef = useRef<LavaProjectile[]>([]);
  const blizzardZonesRef = useRef<BlizzardZone[]>([]);
  const bossGuidedFireballsRef = useRef<BossGuidedFireball[]>([]);
  const bossFreezingPulsesRef = useRef<BossFreezingPulse[]>([]);
  const bossEscortDronesRef = useRef<BossEscortDrone[]>([]);
  const fireTrailsRef = useRef<FireTrail[]>([]);
  const playerTrailBubblesRef = useRef<PlayerTrailBubble[]>([]);
  const emStormTimerRef = useRef<number>(0);
  const emStormActiveRef = useRef<boolean>(false);
  const emStormNextTriggerRef = useRef<number>(600); // Ticks until next EM storm
  const stationaryTicksRef = useRef<number>(0);
  const scanActiveTicksRef = useRef<number>(0);

  const piratesRef = useRef<Pirate[]>([]);
  const pirateLasersRef = useRef<PirateLaser[]>([]);
  const arenaPlatformsRef = useRef<ArenaPlatform[]>([]);
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
      const margin = ast.radius + p.radius + 250;
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
    difficultyRef.current = difficulty;
    enemiesEnabledRef.current = enemiesEnabled;
    lowPerformanceModeRef.current = lowPerformanceMode;
    if (typeof window !== 'undefined') {
      (window as any).__lowPerformanceMode = lowPerformanceMode;
    }
  }, [difficulty, enemiesEnabled, lowPerformanceMode]);

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
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  // Load HighScore
  useEffect(() => {
    const loadedStats = loadStats();
    setStats(loadedStats);
  }, []);

  // Automatic saving of progress every 30 seconds to localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlayingRef.current) {
        saveUpgrades(upgradesRef.current);
        saveStats(statsRef.current);
        addCombatLogMessage("💾 Automatické ukládání: Herní postup úspěšně uložen do databáze lodi.", "#10b981");
      }
    }, 30000);

    return () => clearInterval(interval);
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

  // --- CAPITAL SHIP MANAGEMENT HELPERS ---
  const assignPlayerToStation = (playerId: string, stationId: 'pilot' | 'gunner_left' | 'gunner_right' | 'engineer') => {
    const ship = capitalShipRef.current;
    if (!ship) return;

    // Unassign player from any previous station
    ship.stations.forEach(st => {
      if (st.assignedPlayerId === playerId) {
        st.assignedPlayerId = null;
      }
    });

    // Assign to new station
    const targetStation = ship.stations.find(st => st.id === stationId);
    if (targetStation) {
      targetStation.assignedPlayerId = playerId;
      const pl = playersRef.current.find(p => p.id === playerId);
      if (pl) {
        addGainNotification(`👥 ${pl.name} OBSADIL STANICI: ${targetStation.name}`, pl.color);
      }
    }

    setCapitalShipState({ ...ship });
  };

  const cyclePlayerStation = (playerId: string) => {
    const ship = capitalShipRef.current;
    if (!ship) return;

    const currentStation = ship.stations.find(st => st.assignedPlayerId === playerId);
    const order: ('pilot' | 'gunner_left' | 'gunner_right' | 'engineer')[] = ['pilot', 'gunner_left', 'gunner_right', 'engineer'];
    
    let nextIdx = 0;
    if (currentStation) {
      const currentIdx = order.indexOf(currentStation.id);
      nextIdx = (currentIdx + 1) % order.length;
    }

    const nextStationId = order[nextIdx];
    assignPlayerToStation(playerId, nextStationId);
  };

  const fireCapitalShipLaser = (
    stationId: 'pilot' | 'gunner_left' | 'gunner_right' | 'engineer', 
    angle: number, 
    color: string,
    isAI: boolean = false
  ) => {
    const ship = capitalShipRef.current;
    if (!ship) return;

    const now = Date.now();
    const station = ship.stations.find(s => s.id === stationId);
    if (!station) return;

    const cooldown = isAI ? 650 : 220;
    if (now - station.lastFired < cooldown) return;
    station.lastFired = now;

    playLaserSound(Math.min(5, upgradesRef.current.laserLevel || 1));

    let r = ship.type === 'mining' ? 65 : ship.type === 'war' ? 50 : ship.type === 'mothership' ? 85 : 35;
    let offsetAngle = 0;
    if (stationId === 'pilot') { offsetAngle = 0; }
    else if (stationId === 'gunner_left') { offsetAngle = -Math.PI/2 - 0.5; }
    else if (stationId === 'gunner_right') { offsetAngle = -Math.PI/2 + 0.5; }
    else if (stationId === 'engineer') { offsetAngle = Math.PI; }

    const turretX = ship.x + Math.cos(ship.angle + offsetAngle) * (r * 0.55);
    const turretY = ship.y + Math.sin(ship.angle + offsetAngle) * (r * 0.55);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const speed = 10;
    lasersRef.current.push({
      id: Math.random().toString(36).substring(2, 9),
      x: turretX + cos * 15,
      y: turretY + sin * 15,
      vx: cos * speed,
      vy: sin * speed,
      angle: angle,
      damage: 15 + (upgradesRef.current.laserLevel - 1) * 8,
      isPiercing: upgradesRef.current.laserLevel >= 4,
      piercedAsteroidIds: [],
      radius: 4,
      width: 3,
      color: color,
      lifetime: 0,
      maxLifetime: 75
    });
  };

  const syncCapitalShipAndPlayers = () => {
    const ship = capitalShipRef.current;
    if (!ship) return;

    // Apply strict world boundaries
    const limit = 3800;
    const dist = Math.hypot(ship.x, ship.y);
    if (dist > limit) {
      const angle = Math.atan2(ship.y, ship.x);
      ship.x = Math.cos(angle) * limit;
      ship.y = Math.sin(angle) * limit;
      ship.vx *= -0.4;
      ship.vy *= -0.4;
    }

    playersRef.current.forEach(p => {
      p.x = ship.x;
      p.y = ship.y;
      p.vx = ship.vx;
      p.vy = ship.vy;
      p.radius = ship.type === 'mining' ? 65 : ship.type === 'war' ? 50 : ship.type === 'mothership' ? 85 : 35;
      p.hull = Math.round(ship.hull * (p.maxHull / ship.maxHull));
      p.shield = Math.round(ship.shield * (p.maxShield / ship.maxShield));
    });

    setCapitalShipState({ ...ship });
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

    if (capitalShipModeRef.current && capitalShipRef.current) {
      const ship = capitalShipRef.current;
      const freeStation = ship.stations.find(st => st.assignedPlayerId === null);
      if (freeStation) {
        freeStation.assignedPlayerId = newPlayer.id;
        addGainNotification(`👥 ${newPlayer.name} AUTOMATICKY OBSADIL STANICI: ${freeStation.name}`, newPlayer.color);
      }
      setCapitalShipState({ ...ship });
    }
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

    if (capitalShipModeRef.current && capitalShipRef.current) {
      const ship = capitalShipRef.current;
      ship.stations.forEach(st => {
        if (st.assignedPlayerId === id) {
          st.assignedPlayerId = null;
          addGainNotification(`👥 STANICE UVOLNĚNA: ${st.name}`, '#cbd5e1');
        }
      });
      setCapitalShipState({ ...ship });
    }
  };

  // --- KEYBOARD & GAMEPAD EVENT HANDLERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressed.current[code] = true;
      lastInputDeviceRef.current = 'keyboard';
      keyboardOrMousePressedRef.current = true;

      if (isPlaying && !isShopOpen) {
        if (capitalShipModeRef.current) {
          if (code === 'KeyC') {
            const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
            if (p2) {
              cyclePlayerStation(p2.id);
            }
          }
          if (code === 'Digit0' || code === 'Numpad0' || code === 'KeyM') {
            const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
            if (p1) {
              cyclePlayerStation(p1.id);
            }
          }
        }

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

        // --- PLAYER 1 (Arrow keys, right side) ABILITIES ---
        if (code === 'Digit9' || code === 'Numpad9') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerChainLightning(p1.playerNum);
        } else if (code === 'Digit8' || code === 'Numpad8') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerPulseWaveRing(p1.playerNum);
        } else if (code === 'Digit7' || code === 'Numpad7') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerSuperMagnetVacuum(p1.playerNum);
        } else if (code === 'Digit6' || code === 'Numpad6') {
          const p1 = playersRef.current.find(p => p.inputSource === 'keyboard_p1');
          if (p1) triggerStinkySock(p1.playerNum);
        }

        // --- PLAYER 2 (WASD keys, left side) ABILITIES ---
        if (code === 'KeyQ' || code === 'Digit1' || code === 'Numpad1') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerChainLightning(p2.playerNum);
        } else if (code === 'KeyE' || code === 'Digit2' || code === 'Numpad2') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerPulseWaveRing(p2.playerNum);
        } else if (code === 'KeyR' || code === 'Digit3' || code === 'Numpad3') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerSuperMagnetVacuum(p2.playerNum);
        } else if (code === 'KeyT' || code === 'KeyC' || code === 'Digit5' || code === 'Numpad5') {
          const p2 = playersRef.current.find(p => p.inputSource === 'keyboard_p2');
          if (p2) triggerStinkySock(p2.playerNum);
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
            const anyAxisMoved = gp.axes.some(a => Math.abs(a) > 0.45);
            const anyButtonPressed = gp.buttons.some(b => b.pressed) || anyAxisMoved;
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

  // Multipliers calculated from difficulty
  const getDifficultySettings = (diff: 'easy' | 'medium' | 'hard' | 'nightmare') => {
    switch (diff) {
      case 'easy':
        return {
          damageTakenMultiplier: 0.5,
          drillSpeedMultiplier: 1.5,
          pirateSpawnChanceMultiplier: 0.1,
          pirateHpMultiplier: 0.6,
          pirateLaserDamageMultiplier: 0.5,
          solarStormDamageMultiplier: 0.5,
        };
      case 'medium':
        return {
          damageTakenMultiplier: 1.0,
          drillSpeedMultiplier: 1.0,
          pirateSpawnChanceMultiplier: 1.0,
          pirateHpMultiplier: 1.0,
          pirateLaserDamageMultiplier: 1.0,
          solarStormDamageMultiplier: 1.0,
        };
      case 'hard':
        return {
          damageTakenMultiplier: 1.5,
          drillSpeedMultiplier: 0.8,
          pirateSpawnChanceMultiplier: 1.6,
          pirateHpMultiplier: 1.4,
          pirateLaserDamageMultiplier: 1.5,
          solarStormDamageMultiplier: 1.4,
        };
      case 'nightmare':
        return {
          damageTakenMultiplier: 2.2,
          drillSpeedMultiplier: 0.6,
          pirateSpawnChanceMultiplier: 2.5,
          pirateHpMultiplier: 2.0,
          pirateLaserDamageMultiplier: 2.2,
          solarStormDamageMultiplier: 2.0,
        };
    }
  };

  // Spawns an asteroid in a safe ring around player coordinates
  const createProceduralAsteroid = (
    size: AsteroidSize, 
    customX?: number, 
    customY?: number, 
    customVx?: number, 
    customVy?: number,
    forcedType?: 'common' | 'magma' | 'ice' | 'crystal' | 'gold-rush'
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

    // Larger, walkable asteroid sizes!
    switch (size) {
      case 'colossal':
        hp = 60;
        radius = 320;
        points = 500;
        break;
      case 'huge':
        hp = 30;
        radius = 220;
        points = 200;
        break;
      case 'large':
        hp = 16;
        radius = 140;
        points = 100;
        break;
      case 'medium':
        hp = 8;
        radius = 85;
        points = 50;
        break;
      case 'small':
        hp = 4;
        radius = 50;
        points = 25;
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

    let asteroidType: 'common' | 'magma' | 'ice' | 'crystal' | 'gold-rush' = forcedType || 'common';
    let color = ASTEROID_COLORS[size];

    if (!forcedType) {
      const typeRoll = Math.random();
      const activeMap = selectedMapRef.current;
      
      if (activeMap === 'magma') {
        // Magma Nebula: high chance of Magma asteroids
        if (typeRoll < 0.60) {
          asteroidType = 'magma';
        } else if (typeRoll < 0.70) {
          asteroidType = 'crystal';
        } else if (typeRoll < 0.80) {
          asteroidType = 'ice';
        } else if (typeRoll < 0.88) {
          asteroidType = 'gold-rush';
        } else {
          asteroidType = 'common';
        }
      } else if (activeMap === 'ice') {
        // Ice Ring: high chance of Ice asteroids
        if (typeRoll < 0.60) {
          asteroidType = 'ice';
        } else if (typeRoll < 0.70) {
          asteroidType = 'crystal';
        } else if (typeRoll < 0.80) {
          asteroidType = 'magma';
        } else if (typeRoll < 0.88) {
          asteroidType = 'gold-rush';
        } else {
          asteroidType = 'common';
        }
      } else if (activeMap === 'gold') {
        // Gold Nucleus: high chance of Gold-rush asteroids and crystals
        if (typeRoll < 0.45) {
          asteroidType = 'gold-rush';
        } else if (typeRoll < 0.65) {
          asteroidType = 'crystal';
        } else if (typeRoll < 0.80) {
          asteroidType = 'magma';
        } else if (typeRoll < 0.90) {
          asteroidType = 'ice';
        } else {
          asteroidType = 'common';
        }
      } else {
        // Silicon Belt (standard/common)
        if (typeRoll < 0.12) {
          asteroidType = 'gold-rush';
        } else if (typeRoll < 0.26) {
          asteroidType = 'magma';
        } else if (typeRoll < 0.40) {
          asteroidType = 'ice';
        } else if (typeRoll < 0.52) {
          asteroidType = 'crystal';
        }
      }
    }

    if (asteroidType === 'gold-rush') {
      color = '#eab308'; // glowing golden yellow
      hp = Math.round(hp * 2.2); // vyšší HP
      points = points * 3; // bonusové skóre
    } else if (asteroidType === 'magma') {
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
      if (roll < 0.05) size = 'colossal';
      else if (roll < 0.18) size = 'huge';
      else if (roll < 0.42) size = 'large';
      else if (roll < 0.75) size = 'medium';
      else size = 'small';

      list.push(createProceduralAsteroid(size));
    }
    asteroidsRef.current = list;
  };

  const getCarrierBaseStats = (cClass: CarrierClass) => {
    switch (cClass) {
      case 'cargo': return { hp: 500, shield: 100, slots: 1, speed: 0.8, range: 1, maxFuel: 10 };
      case 'mining': return { hp: 800, shield: 150, slots: 1, speed: 0.9, range: 2, maxFuel: 15 };
      case 'war': return { hp: 1200, shield: 250, slots: 3, speed: 1.2, range: 2, maxFuel: 20 };
      case 'dreadnought': return { hp: 2500, shield: 500, slots: 5, speed: 1.1, range: 3, maxFuel: 30 };
      case 'stargate': return { hp: 2000, shield: 400, slots: 3, speed: 0.8, range: 4, maxFuel: 40 };
      default: return { hp: 0, shield: 0, slots: 0, speed: 0, range: 0, maxFuel: 0 };
    }
  };

  const getCarrierMaxHp = (cClass: CarrierClass, hullLvl: number) => {
    const base = getCarrierBaseStats(cClass).hp;
    const bonus = hullLvl === 1 ? 200 : hullLvl === 2 ? 400 : hullLvl === 3 ? 600 : hullLvl === 4 ? 900 : hullLvl === 5 ? 1400 : 0;
    return base + bonus;
  };

  const getCarrierMaxShield = (cClass: CarrierClass, shieldLvl: number) => {
    const base = getCarrierBaseStats(cClass).shield;
    const bonus = shieldLvl === 1 ? 150 : shieldLvl === 2 ? 300 : shieldLvl === 3 ? 500 : shieldLvl === 4 ? 800 : shieldLvl === 5 ? 1200 : 0;
    return base + bonus;
  };

  // --- LAUNCH GAME RUN ---
  const handleStartGame = (startBossFight: boolean = false) => {
    selectedMapRef.current = selectedMap;
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

    // Initialize Carrier if purchased
    if (upgrades.carrierClass !== 'none') {
      const carrierMaxHp = getCarrierMaxHp(upgrades.carrierClass, upgrades.carrierHullLevel);
      const carrierMaxShield = getCarrierMaxShield(upgrades.carrierClass, upgrades.carrierShieldLevel);
      carrierRef.current = {
        x: 0,
        y: 200,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        hp: carrierMaxHp,
        maxHp: carrierMaxHp,
        shield: carrierMaxShield,
        maxShield: carrierMaxShield,
        dockedPlayerIds: [],
        radius: 75,
      };
      setDockedPlayerIds([]);
    } else {
      carrierRef.current.dockedPlayerIds = [];
      setDockedPlayerIds([]);
    }

    setActivePlayers([...playersRef.current]);

    if (capitalShipMode) {
      capitalShipModeRef.current = true;
      const type = selectedCapitalShipType;
      let maxHull = 400;
      let maxShield = 200;
      let radius = 55;

      if (type === 'mining') {
        maxHull = 600;
        maxShield = 200;
        radius = 65;
      } else if (type === 'war') {
        maxHull = 500;
        maxShield = 350;
        radius = 50;
      } else if (type === 'mothership') {
        maxHull = 800;
        maxShield = 400;
        radius = 80;
      } else if (type === 'explorer') {
        maxHull = 300;
        maxShield = 150;
        radius = 35;
      }

      const ship: CapitalShip = {
        x: 0,
        y: 150,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        hull: maxHull,
        maxHull: maxHull,
        shield: maxShield,
        maxShield: maxShield,
        radius: radius,
        type: type,
        stations: [
          { id: 'pilot', name: '🎯 Kormidelník', angle: 0, assignedPlayerId: null, cooldown: 0, lastFired: 0 },
          { id: 'gunner_left', name: '🔫 Levý střelec', angle: -Math.PI / 2, assignedPlayerId: null, cooldown: 0, lastFired: 0 },
          { id: 'gunner_right', name: '🔫 Pravý střelec', angle: Math.PI / 2, assignedPlayerId: null, cooldown: 0, lastFired: 0 },
          { id: 'engineer', name: '🛡️ Inženýr', angle: Math.PI, assignedPlayerId: null, cooldown: 0, lastFired: 0 },
        ],
        rocketCooldown: 0,
        lastHangarLaunchTime: 0,
        cargoCount: 0,
      };

      playersRef.current.forEach((pl, idx) => {
        if (idx === 0) {
          ship.stations[0].assignedPlayerId = pl.id;
        } else if (idx === 1) {
          ship.stations[1].assignedPlayerId = pl.id;
        } else if (idx === 2) {
          ship.stations[2].assignedPlayerId = pl.id;
        } else if (idx === 3) {
          ship.stations[3].assignedPlayerId = pl.id;
        }
      });

      capitalShipRef.current = ship;
      setCapitalShipState({ ...ship });
    } else {
      capitalShipModeRef.current = false;
      capitalShipRef.current = null;
      setCapitalShipState(null);
    }

    // Initial entities clear
    asteroidsRef.current = [];
    lasersRef.current = [];
    socksRef.current = [];
    dronesRef.current = [];
    carrierRepairDronesRef.current = [];
    lavaProjectilesRef.current = [];
    blizzardZonesRef.current = [];
    bossGuidedFireballsRef.current = [];
    bossFreezingPulsesRef.current = [];
    bossEscortDronesRef.current = [];
    fireTrailsRef.current = [];
    playerTrailBubblesRef.current = [];
    emStormTimerRef.current = 0;
    emStormActiveRef.current = false;
    emStormNextTriggerRef.current = 600; // Ticks until next EM storm (10s)
    wormholeRef.current = null;
    oresRef.current = [];
    particlesRef.current = [];
    piratesRef.current = [];
    pirateLasersRef.current = [];
    arenaPlatformsRef.current = [];
    setSolarStormActive(false);
    solarStormActiveRef.current = false;
    solarStormTimeRef.current = 1500;
    solarStormDurationRef.current = 0;

    if (startBossFight) {
      isBossFightActiveRef.current = true;
      setIsBossFightActive(true);

      // Spawn 2D Destructible Arena Platforms
      arenaPlatformsRef.current = [
        { id: 'plat-1', x: -250, y: -100, width: 140, height: 25, hp: 150, maxHp: 150, color: '#10b981' },
        { id: 'plat-2', x: 250, y: -100, width: 140, height: 25, hp: 150, maxHp: 150, color: '#10b981' },
        { id: 'plat-3', x: -380, y: -300, width: 120, height: 25, hp: 120, maxHp: 120, color: '#10b981' },
        { id: 'plat-4', x: 380, y: -300, width: 120, height: 25, hp: 120, maxHp: 120, color: '#10b981' },
        { id: 'plat-5', x: 0, y: -450, width: 180, height: 25, hp: 200, maxHp: 200, color: '#06b6d4' },
        { id: 'plat-6', x: -160, y: -600, width: 100, height: 20, hp: 100, maxHp: 100, color: '#10b981' },
        { id: 'plat-7', x: 160, y: -600, width: 100, height: 20, hp: 100, maxHp: 100, color: '#10b981' },
      ];
      
      // Open Upgrade Shop right as we start the boss fight so they can buy!
      setIsShopOpen(true);
      isShopOpenRef.current = true;

      // Add generous temporary tactical shield boost and invulnerability to all players!
      playersRef.current.forEach(pl => {
        pl.maxShield += 250;
        pl.shield = pl.maxShield;
        pl.invulnerableTime = 180; // 3 seconds of initial immunity
      });
      if (carrierRef.current) {
        carrierRef.current.maxShield += 500;
        carrierRef.current.shield = carrierRef.current.maxShield;
      }
      if (capitalShipRef.current) {
        capitalShipRef.current.maxShield += 500;
        capitalShipRef.current.shield = capitalShipRef.current.maxShield;
      }
      addGainNotification("🛡️ TAKTICKÝ BONUS: Štíty posíleny (+250) a aktivována imunita na 3 sekundy!", "#22d3ee");
      addCombatLogMessage("🛡️ Taktická podpora: Všem lodím byly dočasně posíleny štíty pro nadcházející souboj.", "#22d3ee");
      
      let bossMaxHp = 1000; // Exact 1000 HP as requested ("tisíc životů")
      setBossHp(1000);
      setBossMaxHp(1000);
      setBossLives(6);
      setBossMaxLives(6);

      bossRef.current = {
        x: 0,
        y: -300,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        hp: bossMaxHp,
        maxHp: bossMaxHp,
        radius: 90,
        state: 'intro',
        lastFired: 0,
        lastShieldFired: 0,
        lastValuableMove: Date.now() + 4000, // Trigger first valuable move 4s after start
        lives: 6,
        maxLives: 6,
        healVisualTimer: 0,
        hitCount: 0,
      };

      // Spawn 4 normal asteroids to act as protective cover or miner fields
      populateAsteroidBelt(4);
    } else {
      isBossFightActiveRef.current = false;
      setIsBossFightActive(false);
      bossRef.current = null;
      
      // Populate standard asteroid cloud
      populateAsteroidBelt(15);
    }

    // Launch game loop animations
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = requestAnimationFrame(tickGameLoop);
  };

  // --- DAMAGE BOSS WITH HIT COUNT MECHANIC (Minecraft Style) ---
  const damageBossWithHitCount = (hitX: number, hitY: number, customHitsToAdd: number = 1) => {
    if (!bossRef.current) return;
    const boss = bossRef.current;
    
    // Spark particles on impact showing armor deflection
    for (let i = 0; i < 4; i++) {
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: hitX,
        y: hitY,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color: '#fb923c', // Minecraft spark orange color
        size: Math.random() * 2 + 1.2,
        alpha: 0.9,
        lifetime: 0,
        maxLifetime: 20,
      });
    }

    boss.hitCount = (boss.hitCount || 0) + customHitsToAdd;
    boss.lastDamageTime = Date.now();

    if (boss.hitCount >= 10) {
      const surplus = boss.hitCount - 10;
      boss.hitCount = surplus >= 0 ? surplus : 0;
      // Take exactly 1mm of life! (1mm is ~6.6% or 1/15th of the health bar width of 180px)
      const dmg = boss.maxHp * 0.066;
      boss.hp -= dmg;

      // Golden explosive ring showing armor shield cracked!
      for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: boss.x,
          y: boss.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          color: Math.random() < 0.5 ? '#facc15' : '#f97316', // gold/orange
          size: Math.random() * 3.5 + 2,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 45,
        });
      }
      playExplosionSound('medium');
      addGainNotification("🛡️ ŠTÍT PRORAŽEN! (10 zásahů -> odebrán 1 mm života)", "#fb923c");
    }
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

    let nameCzech = 'Úroveň modulu ';
    if (id === 'laserLevel') nameCzech = 'Úroveň laseru ';
    else if (id === 'magnetLevel') nameCzech = 'Úroveň magnetu ';
    else if (id === 'carrierRepairDronesLevel') nameCzech = 'Opravné drony ';
    else if (id === 'carrierPointDefenseLevel') nameCzech = 'Obranný systém ';
    addGainNotification(`ZAKOUPENO: ${nameCzech}${nextLevel}`, '#f59e0b');
  };

  const getScoreMultiplierFromRef = () => {
    const multLvl = upgradesRef.current.scoreMultiplierLevel || 1;
    const laserLvl = upgradesRef.current.laserLevel || 1;
    let mult = 1 + (multLvl - 1) * 0.25;
    if (laserLvl >= 7) {
      mult += 1.0;
    }
    return mult;
  };

  const handleRepair = (cost: number, healAmount: number) => {
    if (stats.diamonds < cost) return;

    const updatedStats = {
      ...stats,
      diamonds: stats.diamonds - cost,
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
    if (stats.diamonds < cost || upgrades.shieldLevel === 0) return;

    const updatedStats = {
      ...stats,
      diamonds: stats.diamonds - cost,
    };

    setStats(updatedStats);
    saveStats(updatedStats);

    setShield(maxShield);
    addGainNotification('ŠTÍTY PLNĚ NABITY', '#3b82f6');
    playUpgradeSound();
  };

  const handleBuyDeuterium = (cost: number, amount: number) => {
    if (stats.diamonds < cost) return;

    const updatedStats = {
      ...stats,
      diamonds: stats.diamonds - cost,
      deuterium: (stats.deuterium || 0) + amount,
    };

    setStats(updatedStats);
    saveStats(updatedStats);

    addGainNotification(`ZAKOUPENO DEUTERIUM: +${amount} j.`, '#a855f7');
    playUpgradeSound();
  };

  const handleBuyCarrierClass = (carrierClass: CarrierClass, costs: { crystals: number; diamonds: number; obsidian: number }) => {
    if (stats.crystals < costs.crystals || stats.diamonds < costs.diamonds || stats.obsidian < costs.obsidian) return;

    const updatedStats = {
      ...stats,
      crystals: stats.crystals - costs.crystals,
      diamonds: stats.diamonds - costs.diamonds,
      obsidian: stats.obsidian - costs.obsidian,
    };

    const updatedUpgrades = {
      ...upgrades,
      carrierClass,
      carrierHullLevel: 1,
      carrierShieldLevel: 1,
      carrierEngineLevel: 1,
      carrierWeaponSlotLevel: 1,
      carrierWeaponDamageLevel: 1,
      carrierHyperfuelTankLevel: 1,
      carrierHyperdriveRangeLevel: 1,
      carrierRepairBayLevel: 0,
      carrierCargoHoldLevel: 0,
      carrierRepairDronesLevel: 0,
      carrierPointDefenseLevel: 0,
    };

    setStats(updatedStats);
    setUpgrades(updatedUpgrades);
    saveStats(updatedStats);
    saveUpgrades(updatedUpgrades);

    addGainNotification(`ZAKOUPENA MATEŘSKÁ LOĎ!`, '#eab308');
    playUpgradeSound();
  };

  const handleBuyPlayerShipClass = (playerShipClass: PlayerShipClass, costs: { crystals: number; diamonds: number; obsidian: number }) => {
    if (stats.crystals < costs.crystals || stats.diamonds < costs.diamonds || stats.obsidian < costs.obsidian) return;

    const updatedStats = {
      ...stats,
      crystals: stats.crystals - costs.crystals,
      diamonds: stats.diamonds - costs.diamonds,
      obsidian: stats.obsidian - costs.obsidian,
    };

    const updatedUpgrades = {
      ...upgrades,
      playerShipClass,
    };

    setStats(updatedStats);
    setUpgrades(updatedUpgrades);
    saveStats(updatedStats);
    saveUpgrades(updatedUpgrades);

    // Apply max HP update instantly so player gets healed slightly or max HP increases
    let classHullBonus = 0;
    if (playerShipClass === 'interceptor') classHullBonus = 30;
    else if (playerShipClass === 'cruiser') classHullBonus = 60;
    else if (playerShipClass === 'dreadnought') classHullBonus = 120;

    const baseMaxHull = 100 + (upgrades.hullLevel - 1) * 50 + (upgrades.hullLevel >= 5 ? 20 : 0) + (upgrades.hullLevel >= 6 ? 30 : 0);
    const newMaxHull = baseMaxHull + classHullBonus;
    setMaxHull(newMaxHull);
    maxHullRef.current = newMaxHull;

    playersRef.current.forEach(p => {
      p.maxHull = newMaxHull;
      // Heal player somewhat on upgrade
      p.hull = Math.min(newMaxHull, p.hull + classHullBonus);
    });

    setHull(playersRef.current[0]?.hull || 100);

    const shipName = playerShipClass === 'interceptor' ? 'Těžký Interceptor' :
                     playerShipClass === 'cruiser' ? 'Útočný křižník' :
                     playerShipClass === 'dreadnought' ? 'Těžký Dreadnought' : 'Standardní stíhač';

    addGainNotification(`ZAKOUPENA LOĎ: ${shipName}!`, '#38bdf8');
    playUpgradeSound();
  };

  const handleExecuteHyperjump = (targetSector: Sector) => {
    if ((stats.deuterium || 0) < 1) {
      addGainNotification('❌ Nedostatek Deuterium! Kupte ho v Carrier Docku.', '#ef4444');
      return;
    }

    const updatedStats = {
      ...stats,
      deuterium: (stats.deuterium || 0) - 1,
    };
    setStats(updatedStats);
    saveStats(updatedStats);
    statsRef.current = updatedStats;

    const updatedSectors = sectors.map(s => s.id === targetSector.id ? { ...s, discovered: true } : s);
    setSectors(updatedSectors);
    sectorsRef.current = updatedSectors;
    localStorage.setItem('asteroid_miner_discovered_sectors', JSON.stringify(updatedSectors.filter(s => s.discovered).map(s => s.id)));

    setCurrentSectorId(targetSector.id);
    currentSectorIdRef.current = targetSector.id;
    localStorage.setItem('asteroid_miner_current_sector_id', targetSector.id);

    let targetMap = 'silicon';
    if (targetSector.type === 'magma') targetMap = 'magma';
    else if (targetSector.type === 'ice') targetMap = 'ice';
    else if (targetSector.type === 'gold') targetMap = 'gold';

    setSelectedMap(targetMap);
    selectedMapRef.current = targetMap;

    playMapChangeSound();
    triggerCameraShake(25);
    addGainNotification(`🌌 WARP SKOK DO SEKTORU: ${targetSector.name.toUpperCase()}!`, '#a855f7');

    const carrier = carrierRef.current;
    if (upgrades.carrierClass !== 'none') {
      carrier.x = 0;
      carrier.y = 0;
      carrier.vx = 0;
      carrier.vy = 0;
    }

    playersRef.current.forEach(p => {
      p.x = 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.anchoredAsteroidId = undefined;
      p.isDrilling = false;
    });

    asteroidsRef.current = [];
    oresRef.current = [];
    piratesRef.current = [];
    lasersRef.current = [];
    particlesRef.current = [];
    lavaProjectilesRef.current = [];
    blizzardZonesRef.current = [];
    bossGuidedFireballsRef.current = [];
    bossFreezingPulsesRef.current = [];
    bossEscortDronesRef.current = [];
    arenaPlatformsRef.current = [];
    emStormTimerRef.current = 0;
    emStormActiveRef.current = false;

    populateAsteroidBelt(targetSector.asteroidDensity || 15);

    if (targetSector.bossId) {
      isBossFightActiveRef.current = true;
      setIsBossFightActive(true);

      // Spawn 2D Destructible Arena Platforms
      arenaPlatformsRef.current = [
        { id: 'plat-1', x: -250, y: -100, width: 140, height: 25, hp: 150, maxHp: 150, color: '#10b981' },
        { id: 'plat-2', x: 250, y: -100, width: 140, height: 25, hp: 150, maxHp: 150, color: '#10b981' },
        { id: 'plat-3', x: -380, y: -300, width: 120, height: 25, hp: 120, maxHp: 120, color: '#10b981' },
        { id: 'plat-4', x: 380, y: -300, width: 120, height: 25, hp: 120, maxHp: 120, color: '#10b981' },
        { id: 'plat-5', x: 0, y: -450, width: 180, height: 25, hp: 200, maxHp: 200, color: '#06b6d4' },
        { id: 'plat-6', x: -160, y: -600, width: 100, height: 20, hp: 100, maxHp: 100, color: '#10b981' },
        { id: 'plat-7', x: 160, y: -600, width: 100, height: 20, hp: 100, maxHp: 100, color: '#10b981' },
      ];

      setBossHp(1000);
      setBossMaxHp(1000);
      setBossLives(6);
      setBossMaxLives(6);

      bossRef.current = {
        x: 0,
        y: -350,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        hp: 1000,
        maxHp: 1000,
        radius: 95,
        state: 'intro',
        lastFired: 0,
        lastShieldFired: 0,
        lastValuableMove: Date.now() + 4500,
        lives: 6,
        maxLives: 6,
        healVisualTimer: 0,
        hitCount: 0,
      };

      addGainNotification('⚠️ OMÉGA KORZÁR ZAÚTOČIL NA VAŠI MATEŘSKOU LOĎ!', '#ef4444');
    } else {
      isBossFightActiveRef.current = false;
      setIsBossFightActive(false);
      bossRef.current = null;
    }

    setIsMapOpen(false);
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

  // --- SUPPLY DISCARD DECISION FOR NEW GAME PLUS ---
  const handleWormholeDecision = (discard: boolean) => {
    setIsDecisionOpen(false);
    isDecisionOpenRef.current = false;

    // Trigger "New Game Plus" / Prestige Reset of upgrades and return to normal mining world!
    const cleanUpgrades: Upgrades = {
      laserLevel: 1,
      magnetLevel: 1,
      hullLevel: 1,
      shieldLevel: 0,
      engineLevel: 1,
      abilityLightningLevel: 0,
      abilityPulseLevel: 0,
      abilitySuperMagnetLevel: 0,
      scoreMultiplierLevel: 1,
      abilitySockLevel: 0,
      blackHoleActivator: 0, // Consumed!
      miningDronesLevel: 0,
      omegaDestructorLevel: 0, // Consumed!
      quantumMirrorLevel: 0,
      toxicTrailLevel: 0,
      salvageMagnetLevel: 0,
      playerShipClass: 'standard',
      carrierClass: 'none',
      carrierHullLevel: 0,
      carrierShieldLevel: 0,
      carrierEngineLevel: 0,
      carrierWeaponSlotLevel: 0,
      carrierWeaponDamageLevel: 1,
      carrierHyperfuelTankLevel: 1,
      carrierHyperdriveRangeLevel: 1,
      carrierRepairBayLevel: 0,
      carrierCargoHoldLevel: 0,
      carrierRepairDronesLevel: 0,
      carrierPointDefenseLevel: 0,
    };

    setUpgrades(cleanUpgrades);
    saveUpgrades(cleanUpgrades);

    // Reset current run score and asteroid field
    scoreRef.current = 0;
    setCurrentScore(0);
    setRunCrystals(0);
    setRunDiamonds(0);
    setRunObsidian(0);

    isBossFightActiveRef.current = false;
    setIsBossFightActive(false);

    // Reset player position and full health/shield
    playersRef.current.forEach(p => {
      p.x = 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.hull = p.maxHull;
      p.shield = p.maxShield;
    });
    setHull(100);
    setShield(0);

    // Spawn standard asteroid cloud
    populateAsteroidBelt(15);

    // Update permanent wallet stats
    setStats(curr => {
      let nextCrystals = curr.crystals;
      let nextDiamonds = curr.diamonds;
      let nextObsidian = curr.obsidian;
      let nextPrestige = curr.prestigeCount || 0;

      if (discard) {
        nextCrystals = 0;
        nextDiamonds = 0;
        nextObsidian = 0;
        nextPrestige += 1;
        addGainNotification("🔥 ZÁSOBY BYLY OBĚTOVÁNY PRO OMEGA PRESTIŽ!", "#ef4444");
        addGainNotification("✨ ZÍSKÁN TRVALÝ PRESTIŽNÍ BONUS: +15% k rychlosti lodi, magnetu a bodovému zisku za prestiž!", "#fbbf24");
      } else {
        addGainNotification("💎 PONECHAL SIS SVÉ ZÁSOBY PRO SNADNĚJŠÍ START!", "#60a5fa");
      }

      const nextStats = {
        ...curr,
        crystals: nextCrystals,
        diamonds: nextDiamonds,
        obsidian: nextObsidian,
        prestigeCount: nextPrestige,
      };
      saveStats(nextStats);
      return nextStats;
    });

    // Spark effects in a huge circle
    for (let i = 0; i < 150; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: 0,
        y: 0,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        color: discard ? '#ef4444' : '#3b82f6', // Red for sacrifice, blue for keep
        size: Math.random() * 5 + 1.8,
        alpha: 1.0,
        lifetime: 0,
        maxLifetime: 80
      });
    }

    addGainNotification("🌀 HYPER-SKOK ZPĚT SE USPĚŠNĚ ZDAŘIL!", "#f97316");
    addGainNotification("✨ NEW GAME+: Lodní motory přetíženy fázovým skokem. Musíš nakoupit vylepšení znova!", "#eab308");
    playUpgradeSound();
  };

  // --- ORE DROP GENERATOR (RADIAL EXPLOSIONS) ---
  const triggerSpawnAsteroidDrops = (ax: number, ay: number, size: AsteroidSize, type?: 'common' | 'magma' | 'ice' | 'crystal' | 'gold-rush') => {
    const drops: Ore[] = [];
    
    // If it's a Gold-rush asteroid, we spawn a HUGE amount of diamonds and obsidians!
    if (type === 'gold-rush') {
      let dCount = 0;
      let oCount = 0;
      let cCount = 0;
      
      if (size === 'colossal') {
        dCount = 14 + Math.floor(Math.random() * 8);  // 14-21
        oCount = 8 + Math.floor(Math.random() * 6);   // 8-13
        cCount = 20 + Math.floor(Math.random() * 10); // 20-29
      } else if (size === 'huge') {
        dCount = 8 + Math.floor(Math.random() * 5);  // 8-12
        oCount = 4 + Math.floor(Math.random() * 4);  // 4-7
        cCount = 12 + Math.floor(Math.random() * 8); // 12-19
      } else if (size === 'large') {
        dCount = 5 + Math.floor(Math.random() * 4);  // 5-8
        oCount = 2 + Math.floor(Math.random() * 3);  // 2-4
        cCount = 8 + Math.floor(Math.random() * 6);  // 8-13
      } else if (size === 'medium') {
        dCount = 3 + Math.floor(Math.random() * 2);  // 3-4
        oCount = 1 + Math.floor(Math.random() * 2);  // 1-2
        cCount = 5 + Math.floor(Math.random() * 4);  // 5-8
      } else {
        dCount = 1 + Math.floor(Math.random() * 2);  // 1-2
        oCount = Math.random() < 0.4 ? 1 : 0;
        cCount = 2 + Math.floor(Math.random() * 3);  // 2-4
      }
      
      for (let i = 0; i < dCount; i++) drops.push(createOreEntity(ax, ay, 'diamond', true));
      for (let i = 0; i < oCount; i++) drops.push(createOreEntity(ax, ay, 'obsidian', true));
      for (let i = 0; i < cCount; i++) drops.push(createOreEntity(ax, ay, 'crystal', true));
    } else {
      // General sizes: doubled drop count to make asteroids rain down with materials!
      if (size === 'colossal') {
        drops.push(createOreEntity(ax, ay, 'obsidian'));
        drops.push(createOreEntity(ax, ay, 'obsidian', true));
        drops.push(createOreEntity(ax, ay, 'obsidian', true));
        const diamondCount = 6 + Math.floor(Math.random() * 5); // 6-10
        for (let i = 0; i < diamondCount; i++) {
          drops.push(createOreEntity(ax, ay, 'diamond', true));
        }
        const crystalCount = 14 + Math.floor(Math.random() * 8); // 14-21
        for (let i = 0; i < crystalCount; i++) {
          drops.push(createOreEntity(ax, ay, 'crystal', true));
        }
      } else if (size === 'huge') {
        drops.push(createOreEntity(ax, ay, 'obsidian'));
        drops.push(createOreEntity(ax, ay, 'obsidian', true));
        const diamondCount = 3 + Math.floor(Math.random() * 3); // 3-5
        for (let i = 0; i < diamondCount; i++) {
          drops.push(createOreEntity(ax, ay, 'diamond', true));
        }
        const crystalCount = 8 + Math.floor(Math.random() * 5); // 8-12
        for (let i = 0; i < crystalCount; i++) {
          drops.push(createOreEntity(ax, ay, 'crystal', true));
        }
      } else if (size === 'large') {
        drops.push(createOreEntity(ax, ay, 'diamond'));
        if (Math.random() < 0.4) {
          drops.push(createOreEntity(ax, ay, 'obsidian', true));
        }
        const crystalCount = 6 + Math.floor(Math.random() * 4); // 6-9
        for (let i = 0; i < crystalCount; i++) {
          drops.push(createOreEntity(ax, ay, 'crystal', true));
        }
      } else if (size === 'medium') {
        drops.push(createOreEntity(ax, ay, 'crystal'));
        const extrType: OreType = Math.random() < 0.5 ? 'diamond' : 'crystal';
        drops.push(createOreEntity(ax, ay, extrType, true));
        if (Math.random() < 0.3) {
          drops.push(createOreEntity(ax, ay, 'diamond', true));
        }
      } else {
        // small
        if (Math.random() < 0.7) {
          drops.push(createOreEntity(ax, ay, 'crystal'));
        }
        if (Math.random() < 0.25) {
          drops.push(createOreEntity(ax, ay, 'diamond', true));
        }
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
    const initialLasersCount = lasersRef.current.length;
    
    // Fire rates depend on weapon tier
    let cooldown = 350;
    const lLevel = upgradesRef.current.laserLevel || 1;
    if (lLevel === 2) cooldown = 280;
    if (lLevel === 3) cooldown = 200;
    if (lLevel === 4) cooldown = 300;
    if (lLevel === 5) cooldown = 180;
    if (lLevel === 6) cooldown = 260;
    if (lLevel >= 7) cooldown = 160;

    // Omega Destruktor super fast fire rate!
    if (upgradesRef.current.omegaDestructorLevel === 1) {
      cooldown = 110;
    }

    // Combo x10 Super-Charged Lasers fire rate override
    if (comboMultiplierRef.current >= 10) {
      cooldown = Math.min(cooldown, 70); // lightning-fast rapid fire
    }

    if (now - player.lastFired < cooldown) return;
    player.lastFired = now;

    // Melt Frost on firing lasers ("dokud ji hráč nezahřeje střelbou z laserů")
    if (player.frostLevel && player.frostLevel > 0) {
      player.frostLevel = Math.max(0, player.frostLevel - 16);
      addGainNotification("🔥 ROZTÁVÁNÍ NÁMRAZY!", player.color);
    }

    // Laser properties
    let speed = 9;
    let width = 2;
    let radius = 3;

    playLaserSound(Math.min(5, lLevel));

    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);

    // Spawn point slightly in front of the ship bezel tip (22px away from player)
    const sx = player.x + cos * 22;
    const sy = player.y + sin * 22;

    const baseVx = cos * speed;
    const baseVy = sin * speed;

    // Use player-assigned color as core bullet color, adapting hues beautifully!
    const bulletColor = player.color;

    if (lLevel === 1) {
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
    else if (lLevel === 2) {
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
    else if (lLevel === 3) {
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
    else if (lLevel === 4) {
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
    else if (lLevel === 5) {
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
    else if (lLevel === 6) {
      // Level 6: Super-Nova dělo (7 lasers!)
      const angles = [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36];
      angles.forEach((offsetAngle, idx) => {
        const theta = player.angle + offsetAngle;
        const sCos = Math.cos(theta);
        const sSin = Math.sin(theta);
        const laser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: player.x + sCos * 22,
          y: player.y + sSin * 22,
          vx: sCos * 11.5,
          vy: sSin * 11.5,
          angle: theta,
          damage: 5.5,
          isPiercing: idx === 3, // central one is piercing
          piercedAsteroidIds: [],
          radius: idx === 3 ? 6.5 : 4.5,
          width: idx === 3 ? 5.5 : 3.5,
          color: idx === 3 ? '#ef4444' : '#f59e0b',
          lifetime: 0,
          maxLifetime: 80,
        };
        lasersRef.current.push(laser);
      });
    }
    else {
      // Level 7+: Hyperprostorová anihilace (9 lasers!)
      const angles = [-0.48, -0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36, 0.48];
      angles.forEach((offsetAngle, idx) => {
        const theta = player.angle + offsetAngle;
        const sCos = Math.cos(theta);
        const sSin = Math.sin(theta);
        const laser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: player.x + sCos * 22,
          y: player.y + sSin * 22,
          vx: sCos * 13,
          vy: sSin * 13,
          angle: theta,
          damage: 7.5,
          isPiercing: idx % 2 === 0, // Alternating piercing
          piercedAsteroidIds: [],
          radius: 6,
          width: 5,
          color: idx % 2 === 0 ? '#06b6d4' : '#84cc16', // Neon blue and toxic green
          lifetime: 0,
          maxLifetime: 90,
        };
        lasersRef.current.push(laser);
      });
    }

    // --- OMEGA DESTRUCTOR ADDITIONAL FIRE BALLS ---
    if (upgradesRef.current.omegaDestructorLevel === 1) {
      // 12 rapid circular explosive lava pellets!
      const burstCount = 12;
      for (let i = 0; i < burstCount; i++) {
        const theta = player.angle + (i * Math.PI * 2 / burstCount) + (Date.now() / 350); // rotating offset
        const cosBurst = Math.cos(theta);
        const sinBurst = Math.sin(theta);
        
        const extraLaser: Laser = {
          id: Math.random().toString(36).substring(2, 9),
          x: player.x + cosBurst * 25,
          y: player.y + sinBurst * 25,
          vx: cosBurst * 8.5,
          vy: sinBurst * 8.5,
          angle: theta,
          damage: 5.0, // High damage
          isPiercing: true, // pierces through multiple asteroids!
          piercedAsteroidIds: [],
          radius: 5,
          width: 5,
          color: Math.random() < 0.5 ? '#f97316' : '#ef4444', // Orange/red flame color
          lifetime: 0,
          maxLifetime: 95,
          isHeated: true, // triggers trail and custom visuals
        };
        lasersRef.current.push(extraLaser);
      }
    }

    // Apply Combo x10 Super-Charged Lasers overdrive modifier
    if (comboMultiplierRef.current >= 10) {
      for (let i = initialLasersCount; i < lasersRef.current.length; i++) {
        const laser = lasersRef.current[i];
        laser.isPiercing = true;
        laser.color = '#f43f5e'; // Super-charged glowing rose energy beam
        laser.damage *= 1.35; // 35% damage boost
        laser.width *= 1.5;
        laser.radius *= 1.35;
      }
    }
  };

  // --- MAIN SIMULATION GAME TICK ENGINE ---
  const tickGameLoop = () => {
    if (!isPlayingRef.current) return;

    if (isShopOpenRef.current || isExplorerOpenRef.current || isDecisionOpenRef.current) {
      // Game paused, draw static elements but skip physics updates
      updateEngineHum(false);
      drawGameScene();
      animationFrameId.current = requestAnimationFrame(tickGameLoop);
      return;
    }

    // Decay combo multiplier if expired or update state to animate the timer bar
    const timeNow = Date.now();
    if (comboMultiplierRef.current > 1) {
      if (timeNow - lastAsteroidDestroyedTimeRef.current >= 4000) {
        comboMultiplierRef.current = 1;
        setComboMultiplier(1);
      } else {
        setComboMultiplier(comboMultiplierRef.current);
      }
    }

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : window.innerWidth;
    const height = canvas ? canvas.height : window.innerHeight;

    // --- READ ACTIVE GAMEPAD DEVICES ---
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];

    // Check connected gamepads to see if any button is pressed or stick is moved — if so, drop them in!
    let anyGamepadButtonPressed = false;
    let pressedGamepadIdx = -1;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        const anyAxisMoved = gp.axes.some(a => Math.abs(a) > 0.4);
        const anyButtonPressed = gp.buttons.some(b => b.pressed) || anyAxisMoved;
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

    // --- CARRIER PHYSICS & LOGIC ---
    const hasCarrier = upgradesRef.current.carrierClass !== 'none';
    const carrier = carrierRef.current;
    let isAnyPlayerThrusting = false;

    if (hasCarrier) {
      // Find driver (the first docked player)
      const driverId = dockedPlayerIdsRef.current[0];
      const driver = driverId ? playersRef.current.find(pl => pl.id === driverId) : null;

      let carrierThrust = false;
      let carrierReverse = false;
      let carrierTurn = 0; // -1 for left, 1 for right
      let carrierFired = false;

      if (driver && driver.hull > 0) {
        if (driver.inputSource === 'keyboard_p1') {
          carrierThrust = !!keysPressed.current['ArrowUp'];
          carrierReverse = !!keysPressed.current['ArrowDown'];
          if (keysPressed.current['ArrowLeft']) carrierTurn = -1;
          if (keysPressed.current['ArrowRight']) carrierTurn = 1;
          if (keysPressed.current['ControlRight'] || keysPressed.current['Space']) carrierFired = true;
        } else if (driver.inputSource === 'keyboard_p2') {
          carrierThrust = !!keysPressed.current['KeyW'];
          carrierReverse = !!keysPressed.current['KeyS'];
          if (keysPressed.current['KeyA']) carrierTurn = -1;
          if (keysPressed.current['KeyD']) carrierTurn = 1;
          if (keysPressed.current['ControlLeft'] || keysPressed.current['KeyF'] || keysPressed.current['Space']) carrierFired = true;
        } else if (driver.inputSource === 'gamepad' && driver.gamepadIndex !== null) {
          const gp = gamepads[driver.gamepadIndex];
          if (gp) {
            const lX = gp.axes[0] || 0;
            const isLTPressed = gp.buttons[6]?.pressed || (gp.buttons[6]?.value || 0) > 0.15;
            carrierThrust = isLTPressed;
            if (Math.abs(lX) > 0.22) {
              carrierTurn = lX > 0 ? 1 : -1;
            }
            if (gp.buttons[7]?.pressed || (gp.buttons[7]?.value || 0) > 0.15) {
              carrierFired = true;
            }
          }
        }
      }

      // Check if other docked players are trying to shoot
      playersRef.current.forEach(pl => {
        if (pl.hull > 0 && pl.id !== driverId && dockedPlayerIdsRef.current.includes(pl.id)) {
          let otherFired = false;
          if (pl.inputSource === 'keyboard_p1') {
            otherFired = !!keysPressed.current['ControlRight'] || !!keysPressed.current['Space'];
          } else if (pl.inputSource === 'keyboard_p2') {
            otherFired = !!keysPressed.current['ControlLeft'] || !!keysPressed.current['KeyF'] || !!keysPressed.current['Space'];
          } else if (pl.inputSource === 'gamepad' && pl.gamepadIndex !== null) {
            const gp = gamepads[pl.gamepadIndex];
            if (gp) {
              otherFired = gp.buttons[7]?.pressed || (gp.buttons[7]?.value || 0) > 0.15;
            }
          }
          if (otherFired) carrierFired = true;
        }
      });

      // Synchronize specifications based on Class and Upgrades
      const baseStats = getCarrierBaseStats(upgradesRef.current.carrierClass);
      const maxHp = getCarrierMaxHp(upgradesRef.current.carrierClass, upgradesRef.current.carrierHullLevel);
      const maxShield = getCarrierMaxShield(upgradesRef.current.carrierClass, upgradesRef.current.carrierShieldLevel);

      carrier.maxHp = maxHp;
      carrier.maxShield = maxShield;

      // Keep HP and Shield within bounds
      if (carrier.hp > maxHp) carrier.hp = maxHp;
      if (carrier.shield > maxShield) carrier.shield = maxShield;

      // Movement equations
      const speedMult = baseStats.speed + (upgradesRef.current.carrierEngineLevel - 1) * 0.12;
      const turnMult = 0.035 + (upgradesRef.current.carrierEngineLevel - 1) * 0.005;

      if (carrierTurn !== 0) {
        carrier.angle += carrierTurn * turnMult;
      }

      const accel = 0.045 * speedMult;
      const maxSpeed = 3.5 * speedMult;

      if (carrierThrust) {
        carrier.vx += Math.cos(carrier.angle) * accel;
        carrier.vy += Math.sin(carrier.angle) * accel;
        isAnyPlayerThrusting = true;

        // Exhaust flame particles
        if (Math.random() < 0.7) {
          const exhaustAngle = carrier.angle + Math.PI + (Math.random() * 0.3 - 0.15);
          const exX = carrier.x - Math.cos(carrier.angle) * carrier.radius;
          const exY = carrier.y - Math.sin(carrier.angle) * carrier.radius;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: exX,
            y: exY,
            vx: Math.cos(exhaustAngle) * (Math.random() * 3 + 4) + carrier.vx,
            vy: Math.sin(exhaustAngle) * (Math.random() * 3 + 4) + carrier.vy,
            color: '#f97316', // orange rocket fuel
            size: Math.random() * 7 + 4,
            alpha: 1.0,
            lifetime: 0,
            maxLifetime: 25 + Math.floor(Math.random() * 15)
          });
        }
      } else if (carrierReverse) {
        carrier.vx -= Math.cos(carrier.angle) * (accel * 0.5);
        carrier.vy -= Math.sin(carrier.angle) * (accel * 0.5);
      }

      // Physics damping
      carrier.vx *= 0.985;
      carrier.vy *= 0.985;

      const speed = Math.hypot(carrier.vx, carrier.vy);
      if (speed > maxSpeed) {
        carrier.vx = (carrier.vx / speed) * maxSpeed;
        carrier.vy = (carrier.vy / speed) * maxSpeed;
      }

      // Update positions
      carrier.x += carrier.vx;
      carrier.y += carrier.vy;

      // Shield passive recovery
      if (carrier.shield < carrier.maxShield) {
        carrier.shield += 0.04 + (upgradesRef.current.carrierShieldLevel * 0.02);
      }

      // Keep Carrier reasonably bounded inside some safe radius or wrap him
      const boundary = 3200;
      const distFromCenter = Math.hypot(carrier.x, carrier.y);
      if (distFromCenter > boundary) {
        const pullAngle = Math.atan2(carrier.y, carrier.x) + Math.PI;
        carrier.vx += Math.cos(pullAngle) * 0.2;
        carrier.vy += Math.sin(pullAngle) * 0.2;
      }

      // Automated Defensive Turrets (Firing)
      if (carrierFired && Date.now() - lastCarrierFiredRef.current > 220) {
        lastCarrierFiredRef.current = Date.now();
        playLaserSound(0.85); // deep heavy hyperlaser sound

        const slotLvl = upgradesRef.current.carrierWeaponSlotLevel || 1;
        const threats = [
          ...asteroidsRef.current.map(a => ({ x: a.x, y: a.y, radius: a.radius, isAsteroid: true })),
          ...piratesRef.current.map(pir => ({ x: pir.x, y: pir.y, radius: pir.radius, isAsteroid: false }))
        ];

        threats.sort((a, b) => {
          const distA = Math.hypot(a.x - carrier.x, a.y - carrier.y);
          const distB = Math.hypot(b.x - carrier.x, b.y - carrier.y);
          return distA - distB;
        });

        // Target closest threats in 650px range
        const targets = threats.filter(t => Math.hypot(t.x - carrier.x, t.y - carrier.y) < 650).slice(0, slotLvl);

        for (let i = 0; i < slotLvl; i++) {
          let shootAngle = carrier.angle;
          if (targets[i]) {
            shootAngle = Math.atan2(targets[i].y - carrier.y, targets[i].x - carrier.x);
          } else {
            // Spread default arcs around front
            const spreadAngle = 0.22;
            shootAngle = carrier.angle + (i - (slotLvl - 1) / 2) * spreadAngle;
          }

          const cos = Math.cos(shootAngle);
          const sin = Math.sin(shootAngle);
          const baseDmg = 15 + (upgradesRef.current.carrierWeaponDamageLevel - 1) * 8;

          const carrierLaser: Laser = {
            id: Math.random().toString(36).substring(2, 9),
            x: carrier.x + cos * (carrier.radius - 10),
            y: carrier.y + sin * (carrier.radius - 10),
            vx: cos * 10,
            vy: sin * 10,
            angle: shootAngle,
            damage: baseDmg,
            isPiercing: slotLvl >= 3,
            piercedAsteroidIds: [],
            radius: 8,
            width: 6,
            color: '#fbbf24', // Golden beam
            lifetime: 0,
            maxLifetime: 100
          };
          lasersRef.current.push(carrierLaser);
        }
      }

      // Check Dock/Undock keys and proximity for alive players
      playersRef.current.forEach(p => {
        if (p.hull <= 0) return;

        const isDocked = dockedPlayerIdsRef.current.includes(p.id);

        let dockTriggered = false;
        if (p.inputSource === 'keyboard_p1') {
          const pressed = !!keysPressed.current['ShiftRight'] || !!keysPressed.current['KeyE'];
          const pressKey = `key_${p.id}_dock`;
          const wasPressed = !!lastGamepadButtonsRef.current[pressKey];
          lastGamepadButtonsRef.current[pressKey] = pressed;
          if (pressed && !wasPressed) dockTriggered = true;
        } else if (p.inputSource === 'keyboard_p2') {
          const pressed = !!keysPressed.current['ShiftLeft'] || !!keysPressed.current['KeyE'];
          const pressKey = `key_${p.id}_dock`;
          const wasPressed = !!lastGamepadButtonsRef.current[pressKey];
          lastGamepadButtonsRef.current[pressKey] = pressed;
          if (pressed && !wasPressed) dockTriggered = true;
        } else if (p.inputSource === 'gamepad' && p.gamepadIndex !== null) {
          const gp = gamepads[p.gamepadIndex];
          if (gp) {
            const pressed = gp.buttons[5]?.pressed || false; // RB
            const pressKey = `gp_${p.gamepadIndex}_btn_5_dock`;
            const wasPressed = !!lastGamepadButtonsRef.current[pressKey];
            lastGamepadButtonsRef.current[pressKey] = pressed;
            if (pressed && !wasPressed) dockTriggered = true;
          }
        }

        if (dockTriggered) {
          if (isDocked) {
            // UNDOCK
            const newDocked = dockedPlayerIdsRef.current.filter(id => id !== p.id);
            setDockedPlayerIds(newDocked);
            dockedPlayerIdsRef.current = newDocked;

            p.x = carrier.x + Math.cos(carrier.angle + Math.PI) * (carrier.radius + p.radius + 15);
            p.y = carrier.y + Math.sin(carrier.angle + Math.PI) * (carrier.radius + p.radius + 15);
            p.vx = Math.cos(carrier.angle + Math.PI) * 5;
            p.vy = Math.sin(carrier.angle + Math.PI) * 5;
            p.invulnerableTime = 60;

            addGainNotification(`🚀 ${p.name} se odpojil z mateřské lodi!`, p.color);
            playUpgradeSound();
          } else {
            // DOCK
            const dx = p.x - carrier.x;
            const dy = p.y - carrier.y;
            const dist = Math.hypot(dx, dy);
            if (dist < carrier.radius + p.radius + 60) {
              const newDocked = [...dockedPlayerIdsRef.current, p.id];
              setDockedPlayerIds(newDocked);
              dockedPlayerIdsRef.current = newDocked;

              p.vx = 0; p.vy = 0;
              p.x = carrier.x; p.y = carrier.y;
              p.anchoredAsteroidId = undefined;
              p.isDrilling = false;

              addGainNotification(`🚀 ${p.name} se zadokoval do mateřské lodi!`, p.color);
              playUpgradeSound();
            }
          }
        }
      });

      // Handle Ejection upon Carrier destruction
      if (carrier.hp <= 0) {
        addGainNotification('💥 MATEŘSKÁ LOĎ BYLA ZNIČENA! POSÁDKA KATAPULTOVÁNA!', '#ef4444');
        playExplosionSound('huge');
        triggerCameraShake(20);

        playersRef.current.forEach(p => {
          if (dockedPlayerIdsRef.current.includes(p.id)) {
            const launchAngle = Math.random() * Math.PI * 2;
            p.x = carrier.x + Math.cos(launchAngle) * 110;
            p.y = carrier.y + Math.sin(launchAngle) * 110;
            p.vx = Math.cos(launchAngle) * 8;
            p.vy = Math.sin(launchAngle) * 8;
            p.invulnerableTime = 120;
            p.hull = Math.max(10, p.hull - 35); // Ejection damage
          }
        });

        setDockedPlayerIds([]);
        dockedPlayerIdsRef.current = [];
        
        // Let it slow-repair/respawn at 10% HP
        carrier.hp = carrier.maxHp * 0.15;
        carrier.shield = 0;
      }

      // Sync docked positions and apply passive repairs
      playersRef.current.forEach(p => {
        if (dockedPlayerIdsRef.current.includes(p.id)) {
          p.x = carrier.x;
          p.y = carrier.y;
          p.vx = carrier.vx;
          p.vy = carrier.vy;
          p.invulnerableTime = Math.max(p.invulnerableTime, 5);

          if (upgradesRef.current.carrierRepairBayLevel > 0 && Math.random() < 0.015) {
            const heal = upgradesRef.current.carrierRepairBayLevel * 2.5;
            if (p.hull < p.maxHull) {
              p.hull = Math.min(p.maxHull, p.hull + heal);
              // Green repair indicators
              for (let i = 0; i < 3; i++) {
                particlesRef.current.push({
                  id: Math.random().toString(36).substring(2, 9),
                  x: carrier.x + (Math.random() - 0.5) * 45,
                  y: carrier.y + (Math.random() - 0.5) * 45,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: (Math.random() - 0.5) * 1.5,
                  color: '#10b981',
                  size: Math.random() * 3 + 1,
                  alpha: 0.8,
                  lifetime: 0,
                  maxLifetime: 20
                });
              }
            }
          }
        }
      });
    }

    // --- PROCESS INPUT FOR ALL ACTIVE PLAYERS ---
    isAnyPlayerThrusting = false;

    if (capitalShipModeRef.current) {
      // Under capital ship mode, inputs are routed through the capital ship stations.
      const ship = capitalShipRef.current;
      if (ship) {
        const pilotStation = ship.stations.find(s => s.id === 'pilot');
        if (pilotStation && pilotStation.assignedPlayerId) {
          const p = playersRef.current.find(pl => pl.id === pilotStation.assignedPlayerId);
          if (p && p.hull > 0) {
            if (p.inputSource === 'keyboard_p1') {
              isAnyPlayerThrusting = !!keysPressed.current['ArrowUp'];
            } else if (p.inputSource === 'keyboard_p2') {
              isAnyPlayerThrusting = !!keysPressed.current['KeyW'];
            } else if (p.inputSource === 'gamepad' && p.gamepadIndex !== null) {
              const gp = gamepads[p.gamepadIndex];
              if (gp) {
                isAnyPlayerThrusting = gp.buttons[6]?.pressed || (gp.buttons[6]?.value || 0) > 0.15;
              }
            }
          }
        }
      }
    } else {
      playersRef.current.forEach(p => {
        p.thrusting = false;
        p.reversing = false;

        // Skip normal physics input if currently docked inside Carrier
        if (dockedPlayerIdsRef.current.includes(p.id)) {
          return;
        }

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

            // Use ControlLeft, KeyF, or Space (only if Player 1 is not active on Arrow keys) to fire laser
            const hasP1 = playersRef.current.some(pl => pl.inputSource === 'keyboard_p1');
            if (keysPressed.current['ControlLeft'] || keysPressed.current['KeyF'] || (!hasP1 && keysPressed.current['Space'])) {
              fireActiveLaser(p, p.playerNum);
            }
          } 
          else if (p.inputSource === 'gamepad' && p.gamepadIndex !== null) {
            const gp = gamepads[p.gamepadIndex];
            if (gp) {
              // Helper for edge-detection of buttons (just-pressed)
              const getButtonJustPressed = (btnIdx: number): boolean => {
                const pressed = gp.buttons[btnIdx]?.pressed || false;
                const key = `gp_${p.gamepadIndex}_btn_${btnIdx}`;
                const wasPressed = !!lastGamepadButtonsRef.current[key];
                lastGamepadButtonsRef.current[key] = pressed;
                return pressed && !wasPressed;
              };

              // Read analog sticks (Left stick = axes 0, 1; Right stick = axes 2, 3)
              const lX = gp.axes[0] || 0;
              const lY = gp.axes[1] || 0;
              const rX = gp.axes[2] || 0;
              const rY = gp.axes[3] || 0;

              const leftStickMagnitude = Math.hypot(lX, lY);
              const rightStickMagnitude = Math.hypot(rX, rY);

              // 1. --- RIGHT STICK ROTATION (Otáčení lodičky) ---
              if (rightStickMagnitude > 0.22) {
                p.targetAngle = Math.atan2(rY, rX);
                let deltaAngle = p.targetAngle - p.angle;
                while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
                while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
                const rotSpeed = 0.16 + (upgradesRef.current.engineLevel - 1) * 0.03;
                p.angle += deltaAngle * Math.min(1, rotSpeed);
              }

              // 2. --- LEFT STICK FLIGHT DIRECTION (Smer, kudy sa poletí) ---
              if (leftStickMagnitude > 0.22) {
                p.gamepadThrustAngle = Math.atan2(lY, lX);
              } else {
                p.gamepadThrustAngle = p.angle;
              }

              // 3. --- LT FORWARD MOVEMENT (Pohyb dopředu) ---
              const isLTPressed = gp.buttons[6]?.pressed || (gp.buttons[6]?.value || 0) > 0.15;
              p.thrusting = isLTPressed;
              p.reversing = false;

              // 4. --- RT SHOOTING (Střílení) ---
              const isRTPressed = gp.buttons[7]?.pressed || (gp.buttons[7]?.value || 0) > 0.15;
              if (isRTPressed) {
                fireActiveLaser(p, p.playerNum);
              }

              // 5. --- SPECIAL ATTACKS (X, Y, B) ---
              // B button (1) -> Pulse Wave Ring (Pulzní vlna)
              if (getButtonJustPressed(1)) {
                triggerPulseWaveRing(p.playerNum);
              }
              // X button (2) -> Super Magnet Vacuum (Super magnet)
              if (getButtonJustPressed(2)) {
                triggerSuperMagnetVacuum(p.playerNum);
              }
              // Y button (3) -> Chain Lightning (Bleskový řetěz)
              if (getButtonJustPressed(3)) {
                triggerChainLightning(p.playerNum);
              }
            }
          }

          if (p.thrusting) {
            isAnyPlayerThrusting = true;
          }
        }
      });
    }

    updateEngineHum(isAnyPlayerThrusting);

    // --- APPLY PHYSICAL MOVEMENT SPEEDS AND DECELERATION ---
    if (capitalShipModeRef.current && capitalShipRef.current) {
      const ship = capitalShipRef.current;

      // Find Pilot station and who is assigned to it
      const pilotStation = ship.stations.find(s => s.id === 'pilot');
      let isThrusting = false;
      let isReversing = false;
      let rotateLeft = false;
      let rotateRight = false;

      // Handle input based on Pilot's assignment
      if (pilotStation && pilotStation.assignedPlayerId) {
        const pId = pilotStation.assignedPlayerId;
        const p = playersRef.current.find(pl => pl.id === pId);
        if (p && p.hull > 0) {
          if (p.inputSource === 'keyboard_p1') {
            isThrusting = !!keysPressed.current['ArrowUp'];
            isReversing = !!keysPressed.current['ArrowDown'];
            rotateLeft = !!keysPressed.current['ArrowLeft'];
            rotateRight = !!keysPressed.current['ArrowRight'];
          } else if (p.inputSource === 'keyboard_p2') {
            isThrusting = !!keysPressed.current['KeyW'];
            isReversing = !!keysPressed.current['KeyS'];
            rotateLeft = !!keysPressed.current['KeyA'];
            rotateRight = !!keysPressed.current['KeyD'];
          } else if (p.inputSource === 'gamepad' && p.gamepadIndex !== null) {
            const gp = gamepads[p.gamepadIndex];
            if (gp) {
              const lX = gp.axes[0] || 0;
              const lY = gp.axes[1] || 0;
              const rX = gp.axes[2] || 0;
              const rY = gp.axes[3] || 0;
              const leftStickMagnitude = Math.hypot(lX, lY);
              const rightStickMagnitude = Math.hypot(rX, rY);

              if (rightStickMagnitude > 0.22) {
                const targetAngle = Math.atan2(rY, rX);
                let deltaAngle = targetAngle - ship.angle;
                while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
                while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
                ship.angle += deltaAngle * 0.08;
              }

              isThrusting = gp.buttons[6]?.pressed || (gp.buttons[6]?.value || 0) > 0.15;
            }
          }
        }
      } else {
        // --- AI AUTOPILOT ---
        const nearestAst = asteroidsRef.current
          .filter(a => a.hp > 0)
          .reduce((near, ast) => {
            const dist = Math.hypot(ast.x - ship.x, ast.y - ship.y);
            if (!near || dist < near.dist) return { ast, dist };
            return near;
          }, null as { ast: Asteroid, dist: number } | null);

        if (nearestAst && nearestAst.dist > 180) {
          // Rotate ship slowly towards the nearest asteroid
          const targetAngle = Math.atan2(nearestAst.ast.y - ship.y, nearestAst.ast.x - ship.x);
          let diff = targetAngle - ship.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          ship.angle += diff * 0.015; // slow rotation

          // Move slowly towards it
          const speedFactor = ship.type === 'explorer' ? 1.5 : 0.8;
          ship.vx += Math.cos(ship.angle) * speedFactor * 0.05;
          ship.vy += Math.sin(ship.angle) * speedFactor * 0.05;
          isThrusting = true;
        }
      }

      // Handle rotation for keyboard pilot
      if (rotateLeft) {
        ship.angle -= 0.04;
      } else if (rotateRight) {
        ship.angle += 0.04;
      }

      // Handle speed limits and acceleration based on Ship Class
      const baseMaxSpeed = ship.type === 'explorer' ? 8.5 : ship.type === 'war' ? 5.5 : ship.type === 'mining' ? 4.5 : 3.0;
      const baseThrustPower = ship.type === 'explorer' ? 0.20 : ship.type === 'war' ? 0.12 : ship.type === 'mining' ? 0.09 : 0.06;
      const inertiaFriction = 0.985;

      if (isThrusting) {
        ship.vx += Math.cos(ship.angle) * baseThrustPower;
        ship.vy += Math.sin(ship.angle) * baseThrustPower;

        // Exhaust particles
        if (Math.random() < 0.4) {
          const r = ship.type === 'mining' ? 65 : ship.type === 'war' ? 50 : ship.type === 'mothership' ? 85 : 35;
          const backX = ship.x - Math.cos(ship.angle) * r;
          const backY = ship.y - Math.sin(ship.angle) * r;
          const backAngle = ship.angle + Math.PI + (Math.random() * 0.6 - 0.3);
          particlesRef.current.push({
            id: Math.random().toString(),
            x: backX,
            y: backY,
            vx: Math.cos(backAngle) * (Math.random() * 3 + 1.25) + ship.vx * 0.4,
            vy: Math.sin(backAngle) * (Math.random() * 3 + 1.25) + ship.vy * 0.4,
            color: '#fb923c',
            size: Math.random() * 5 + 2,
            alpha: 1.0,
            lifetime: 0,
            maxLifetime: 25 + Math.floor(Math.random() * 15),
          });
        }
      } else if (isReversing) {
        ship.vx -= Math.cos(ship.angle) * (baseThrustPower * 0.55);
        ship.vy -= Math.sin(ship.angle) * (baseThrustPower * 0.55);
      }

      let speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (speed > baseMaxSpeed) {
        ship.vx = (ship.vx / speed) * baseMaxSpeed;
        ship.vy = (ship.vy / speed) * baseMaxSpeed;
      }

      ship.vx *= inertiaFriction;
      ship.vy *= inertiaFriction;

      ship.x += ship.vx;
      ship.y += ship.vy;

      // --- GUNNERS UPDATE (LEFT & RIGHT) ---
      ship.stations.forEach(st => {
        if (st.id === 'gunner_left' || st.id === 'gunner_right') {
          const assignee = playersRef.current.find(pl => pl.id === st.assignedPlayerId);
          if (assignee && assignee.hull > 0) {
            // Human player controls turret!
            // Let them steer with rotation keys (Left/Right arrow keys for P1, A/D for P2) or right stick
            let rotDir = 0;
            let fires = false;
            if (assignee.inputSource === 'keyboard_p1') {
              if (keysPressed.current['ArrowLeft']) rotDir = -1;
              if (keysPressed.current['ArrowRight']) rotDir = 1;
              fires = !!(keysPressed.current['ControlRight'] || keysPressed.current['Space']);
            } else if (assignee.inputSource === 'keyboard_p2') {
              if (keysPressed.current['KeyA']) rotDir = -1;
              if (keysPressed.current['KeyD']) rotDir = 1;
              fires = !!(keysPressed.current['ControlLeft'] || keysPressed.current['KeyF'] || keysPressed.current['Space']);
            } else if (assignee.inputSource === 'gamepad' && assignee.gamepadIndex !== null) {
              const gp = gamepads[assignee.gamepadIndex];
              if (gp) {
                const rX = gp.axes[2] || 0;
                const rY = gp.axes[3] || 0;
                if (Math.hypot(rX, rY) > 0.22) {
                  st.angle = Math.atan2(rY, rX) - ship.angle; // keep angle relative
                }
                fires = gp.buttons[7]?.pressed || (gp.buttons[7]?.value || 0) > 0.15;
              }
            }

            if (rotDir !== 0) {
              st.angle += rotDir * 0.05;
            }

            if (fires) {
              fireCapitalShipLaser(st.id, ship.angle + st.angle, assignee.color);
            }
          } else {
            // --- AI AUTOMATIC GUNNER ---
            // Scan for closest asteroid or pirate
            const target = piratesRef.current.find(pir => pir.hp > 0) ||
              asteroidsRef.current.find(ast => ast.hp > 0 && Math.hypot(ast.x - ship.x, ast.y - ship.y) < 400);

            if (target) {
              const targetAngle = Math.atan2(target.y - ship.y, target.x - ship.x);
              // Smoothly steer turret towards target
              let diff = (targetAngle - ship.angle) - st.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              st.angle += diff * 0.05;

              // Fire with AI rate (e.g., every 35 frames)
              if (Math.random() < 0.04) {
                fireCapitalShipLaser(st.id, ship.angle + st.angle, '#f87171', true);
              }
            }
          }
        }
      });

      // --- ENGINEER UPDATE ---
      const engineerStation = ship.stations.find(s => s.id === 'engineer');
      const engPlayer = engineerStation && engineerStation.assignedPlayerId
        ? playersRef.current.find(pl => pl.id === engineerStation.assignedPlayerId)
        : null;

      if (engPlayer && engPlayer.hull > 0) {
        // Engineer active! Fast shields recovery, plus active abilities triggered by standard engineer keys
        if (ship.shield < ship.maxShield && Math.random() < 0.05) {
          ship.shield = Math.min(ship.maxShield, ship.shield + 2);
        }
        // Active slow hull repair
        if (ship.hull < ship.maxHull && Math.random() < 0.015) {
          ship.hull = Math.min(ship.maxHull, ship.hull + 1);
        }

        // Handle ability triggers for the Engineer
        if (engPlayer.inputSource === 'keyboard_p1') {
          if (keysPressed.current['Digit9'] || keysPressed.current['Numpad9']) triggerChainLightning(engPlayer.playerNum);
          if (keysPressed.current['Digit8'] || keysPressed.current['Numpad8']) triggerPulseWaveRing(engPlayer.playerNum);
          if (keysPressed.current['Digit7'] || keysPressed.current['Numpad7']) triggerSuperMagnetVacuum(engPlayer.playerNum);
        } else if (engPlayer.inputSource === 'keyboard_p2') {
          if (keysPressed.current['KeyQ']) triggerChainLightning(engPlayer.playerNum);
          if (keysPressed.current['KeyE']) triggerPulseWaveRing(engPlayer.playerNum);
          if (keysPressed.current['KeyR']) triggerSuperMagnetVacuum(engPlayer.playerNum);
        }
      } else {
        // AI engineer slow repairs
        if (ship.shield < ship.maxShield && Math.random() < 0.02) {
          ship.shield = Math.min(ship.maxShield, ship.shield + 1);
        }
        if (ship.hull < ship.maxHull && Math.random() < 0.004) {
          ship.hull = Math.min(ship.maxHull, ship.hull + 1);
        }
      }

      // --- MOTHERSHIP EXTRAS: ORBITING DRONES & HANGAR LAUNCH ---
      if (ship.type === 'mothership') {
        // Orbiting defensive drone fires standard lasers
        if (Math.random() < 0.01) {
          const droneAngle = Date.now() / 300;
          const dx = ship.x + Math.cos(droneAngle) * 110;
          const dy = ship.y + Math.sin(droneAngle) * 110;
          const ast = asteroidsRef.current.find(a => Math.hypot(a.x - dx, a.y - dy) < 300);
          if (ast) {
            const fireAngle = Math.atan2(ast.y - dy, ast.x - dx);
            lasersRef.current.push({
              id: Math.random().toString(),
              x: dx,
              y: dy,
              vx: Math.cos(fireAngle) * 10,
              vy: Math.sin(fireAngle) * 10,
              angle: fireAngle,
              damage: 10,
              isPiercing: false,
              piercedAsteroidIds: [],
              radius: 3,
              width: 2,
              color: '#d8b4fe',
              lifetime: 0,
              maxLifetime: 60
            });
            playLaserSound(0);
          }
        }
      }

      // --- WAR FRIGATE EXTRAS: HOMING MISSILE LAUNCH ---
      if (ship.type === 'war') {
        if (ship.rocketCooldown && ship.rocketCooldown > 0) {
          ship.rocketCooldown--;
        } else {
          // Fire a homing rocket towards closest asteroid
          const target = asteroidsRef.current.find(ast => Math.hypot(ast.x - ship.x, ast.y - ship.y) < 500);
          if (target) {
            ship.rocketCooldown = 180; // cooldown of 3 seconds
            const fAngle = ship.angle + (Math.random() * 0.4 - 0.2);
            lasersRef.current.push({
              id: Math.random().toString(),
              x: ship.x,
              y: ship.y,
              vx: Math.cos(fAngle) * 6,
              vy: Math.sin(fAngle) * 6,
              angle: fAngle,
              damage: 60, // heavy explosive rocket damage
              isPiercing: false,
              piercedAsteroidIds: [],
              radius: 6,
              width: 5,
              color: '#ef4444',
              lifetime: 0,
              maxLifetime: 120
            });
            addGainNotification("🚀 RAKETA ODPÁLENA!", "#ef4444");
            playExplosionSound('small');
          }
        }
      }

      // Sync players to capital ship
      syncCapitalShipAndPlayers();

      // Decrement invulnerable timer for crew
      playersRef.current.forEach(p => {
        if (p.invulnerableTime > 0) {
          p.invulnerableTime--;
        }
      });
    } else {
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
              const diffSettings = getDifficultySettings(difficultyRef.current);
              p.drillTime = (p.drillTime || 0) + diffSettings.drillSpeedMultiplier;
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

                if (asteroid.asteroidType === 'gold-rush') {
                  oreType = Math.random() < 0.5 ? 'diamond' : 'obsidian';
                  amount = Math.random() < 0.5 ? 3 : 2;
                  txt = `+${amount} Zlatá Horečka: ${oreType === 'diamond' ? 'Diamanty' : 'Obsidiány'}!`;
                  col = '#eab308';
                } else if (asteroid.asteroidType === 'crystal') {
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
                  triggerSpawnAsteroidDrops(asteroid.x, asteroid.y, asteroid.size, asteroid.asteroidType);
                  // Also award player some extra points/crystals
                  setCurrentScore(prev => prev + asteroid.points);
                  playExplosionSound(asteroid.size);
                  asteroidsRef.current = asteroidsRef.current.filter(a => a.id !== asteroid.id);
                }
              }
            }
          }
        } else if (p.hull > 0) {
          const prestigeBonusMultiplier = 1 + (statsRef.current.prestigeCount || 0) * 0.15;
          const baseMaxSpeed = (5 + (upgradesRef.current.engineLevel - 1) * 1.5) * prestigeBonusMultiplier;
          const baseThrustPower = (0.14 + (upgradesRef.current.engineLevel - 1) * 0.07) * prestigeBonusMultiplier;
          const inertiaFriction = 0.982 + (upgradesRef.current.engineLevel - 1) * 0.003;

          // Custom Sector Hazards & Combo Overdrives speed calculations
          const isPlayerFrozen = (p.frozenTimer !== undefined && p.frozenTimer > 0);
          const frostMultiplier = 1 - ((p.frostLevel || 0) / 100) * 0.35;
          const comboSpeedMult = (comboMultiplierRef.current >= 5) ? 1.15 : 1.0;
          
          const speedModifier = isPlayerFrozen ? 0 : (frostMultiplier * comboSpeedMult);
          const maxSpeed = baseMaxSpeed * speedModifier;
          const thrustPower = baseThrustPower * speedModifier;

          if (p.thrusting && !isPlayerFrozen) {
            const tAngle = (p.inputSource === 'gamepad' && p.gamepadThrustAngle !== undefined) ? p.gamepadThrustAngle : p.angle;
            p.vx += Math.cos(tAngle) * thrustPower;
            p.vy += Math.sin(tAngle) * thrustPower;

            // Toxic Trail exhaust upgrade trigger
            if (upgradesRef.current.toxicTrailLevel > 0 && Math.random() < 0.25) {
              const backX = p.x - Math.cos(tAngle) * 20;
              const backY = p.y - Math.sin(tAngle) * 20;
              playerTrailBubblesRef.current.push({
                id: Math.random().toString(),
                x: backX,
                y: backY,
                radius: 20 + upgradesRef.current.toxicTrailLevel * 10,
                damage: 0.25 * upgradesRef.current.toxicTrailLevel, // damage per frame
                lifetime: 0,
                maxLifetime: 60,
                color: '#fb923c' // toxic glowing orange flame
              });
            }

            // Jet exhaust particles with custom player primary color booster flares
            const isHyperDrive = comboMultiplierRef.current >= 5;
            const jetParticleChance = isHyperDrive ? 0.8 : 0.4;
            if (Math.random() < jetParticleChance) {
              const backAngle = tAngle + Math.PI + (Math.random() * 0.6 - 0.3);
              const ex = p.x - Math.cos(tAngle) * 18;
              const ey = p.y - Math.sin(tAngle) * 18;
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: ex,
                y: ey,
                vx: Math.cos(backAngle) * (Math.random() * (isHyperDrive ? 5 : 3) + 1.25) + p.vx * 0.4,
                vy: Math.sin(backAngle) * (Math.random() * (isHyperDrive ? 5 : 3) + 1.25) + p.vy * 0.4,
                color: isHyperDrive ? '#38bdf8' : (Math.random() < 0.35 ? p.color : p.glowColor), // sky blue for HyperDrive
                size: Math.random() * (isHyperDrive ? 7.0 : 3.5) + (isHyperDrive ? 3.0 : 1.5),
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: (isHyperDrive ? 35 : 20) + Math.floor(Math.random() * 15),
              });
            }
          } else if (p.reversing && !isPlayerFrozen) {
            p.vx -= Math.cos(p.angle) * (thrustPower * 0.55);
            p.vy -= Math.sin(p.angle) * (thrustPower * 0.55);
          }

          let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > maxSpeed && maxSpeed > 0) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }

          p.vx *= inertiaFriction;
          p.vy *= inertiaFriction;

          // Persistent but fading thruster trail particles behind each player ship that reflect their unique color
          const trailSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (trailSpeed > 0.2 && Math.random() < 0.6) {
            const trailAngle = p.angle + Math.PI + (Math.random() * 0.2 - 0.1);
            const tx = p.x - Math.cos(p.angle) * 14;
            const ty = p.y - Math.sin(p.angle) * 14;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: tx,
              y: ty,
              vx: -p.vx * 0.1 + Math.cos(trailAngle) * 0.5,
              vy: -p.vy * 0.1 + Math.sin(trailAngle) * 0.5,
              color: p.color,
              size: Math.random() * 2.2 + 1.2,
              alpha: 0.85,
              lifetime: 0,
              maxLifetime: 35 + Math.floor(Math.random() * 25),
            });
          }

          // If the ship is in critical state, emit warning smoke/sparks
          if (p.hull / p.maxHull <= 0.35) {
            if (Math.random() < 0.25) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x + (Math.random() - 0.5) * 14,
                y: p.y + (Math.random() - 0.5) * 14,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: Math.random() < 0.5 ? '#ef4444' : '#f97316',
                size: Math.random() * 2.5 + 1.5,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 20 + Math.floor(Math.random() * 20),
              });
            }
            if (Math.random() < 0.15) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x + (Math.random() - 0.5) * 10,
                y: p.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                color: '#475569', // Slate smoke color
                size: Math.random() * 5 + 3,
                alpha: 0.7,
                lifetime: 0,
                maxLifetime: 40 + Math.floor(Math.random() * 30),
              });
            }
          }

          // --- AUTOMATIC DEFENSE TURRETS FOR CRUISER / DREADNOUGHT ---
          const sClass = upgradesRef.current.playerShipClass || 'standard';
          if ((sClass === 'cruiser' || sClass === 'dreadnought') && !dockedPlayerIdsRef.current.includes(p.id)) {
            // 1. Every frame: Find closest threat to orient the turret
            let target: any = null;
            let targetDist = 380; // max turret range

            if (piratesRef.current && piratesRef.current.length > 0) {
              piratesRef.current.forEach(pirate => {
                const dist = Math.hypot(pirate.x - p.x, pirate.y - p.y);
                if (dist < targetDist) {
                  targetDist = dist;
                  target = pirate;
                }
              });
            }

            if (!target) {
              asteroidsRef.current.forEach(ast => {
                const dist = Math.hypot(ast.x - p.x, ast.y - p.y);
                if (dist < targetDist) {
                  targetDist = dist;
                  target = ast;
                }
              });
            }

            // Update turret tracking angle or passive idle spin
            if (target) {
              const desiredAngle = Math.atan2(target.y - p.y, target.x - p.x);
              (p as any).turretAngle = desiredAngle;
            } else {
              (p as any).turretAngle = ((p as any).turretAngle || 0) + 0.035;
            }

            // 2. Cooldown check: Firing automatic weapon
            const turretInterval = sClass === 'dreadnought' ? 1200 : 1500;
            const lastFired = (p as any).lastAutoTurretFired || 0;
            if (target && Date.now() - lastFired > turretInterval) {
              (p as any).lastAutoTurretFired = Date.now();
              const fireAngle = (p as any).turretAngle;
              
              // Cruiser fires 1 automatic laser towards the target
              // Dreadnought fires 2 automatic lasers
              const numShots = sClass === 'dreadnought' ? 2 : 1;
              for (let i = 0; i < numShots; i++) {
                const offset = numShots === 2 ? (i === 0 ? -12 : 12) : 0;
                const bx = p.x + Math.cos(fireAngle) * 15 + Math.cos(fireAngle + Math.PI/2) * offset;
                const by = p.y + Math.sin(fireAngle) * 15 + Math.sin(fireAngle + Math.PI/2) * offset;
                
                lasersRef.current.push({
                  id: Math.random().toString(36).substring(2, 9),
                  x: bx,
                  y: by,
                  vx: Math.cos(fireAngle) * 8.5,
                  vy: Math.sin(fireAngle) * 8.5,
                  angle: fireAngle,
                  damage: sClass === 'dreadnought' ? 2.0 : 1.5,
                  isPiercing: false,
                  piercedAsteroidIds: [],
                  radius: 3.5,
                  width: 3.5,
                  color: p.playerNum === 1 ? '#ef4444' : '#ec4899', // color match player
                  lifetime: 0,
                  maxLifetime: 60,
                });
              }
                playLaserSound(2);
            }
          }
        } else {
          // Slow down wreckage slow-drift
          p.vx *= 0.96;
          p.vy *= 0.96;
        }

        if (!p.anchoredAsteroidId) {
          p.x += p.vx;
          p.y += p.vy;
        }

        // --- PLATFORM COLLISION PHYSICS ---
        if (isBossFightActiveRef.current && arenaPlatformsRef.current.length > 0) {
          arenaPlatformsRef.current.forEach(plat => {
            const halfW = plat.width / 2;
            const halfH = plat.height / 2;
            
            // Find closest point on platform rectangle to player center
            const closestX = Math.max(plat.x - halfW, Math.min(p.x, plat.x + halfW));
            const closestY = Math.max(plat.y - halfH, Math.min(p.y, plat.y + halfH));
            
            const dx = p.x - closestX;
            const dy = p.y - closestY;
            const distance = Math.hypot(dx, dy);
            
            if (distance < p.radius) {
              // Push out of platform
              if (distance === 0) {
                p.y -= p.radius;
                p.vy = -Math.abs(p.vy) * 0.3;
              } else {
                const overlap = p.radius - distance;
                const pushX = (dx / distance) * overlap;
                const pushY = (dy / distance) * overlap;
                
                p.x += pushX;
                p.y += pushY;
                
                // Slide/Bounce response
                const isHorizontalHit = Math.abs(dx) > Math.abs(dy);
                if (isHorizontalHit) {
                  p.vx = -p.vx * 0.35;
                } else {
                  p.vy = -p.vy * 0.35;
                }
              }
            }
          });
        }

        // Keep players inside 2D Boss Arena (radius 1000 around center (0, -200))
        if (isBossFightActiveRef.current) {
          const arenaCenterX = 0;
          const arenaCenterY = -200;
          const arenaRadius = 1000;
          const dx = p.x - arenaCenterX;
          const dy = p.y - arenaCenterY;
          const dist = Math.hypot(dx, dy);
          if (dist > arenaRadius) {
            // Push player back with bounce
            const angle = Math.atan2(dy, dx);
            p.x = arenaCenterX + Math.cos(angle) * arenaRadius;
            p.y = arenaCenterY + Math.sin(angle) * arenaRadius;
            // Reverse velocity and lose energy
            p.vx = -Math.cos(angle) * Math.abs(p.vx) * 0.4;
            p.vy = -Math.sin(angle) * Math.abs(p.vy) * 0.4;
            // Spawn some electrical arena sparks!
            for (let i = 0; i < 6; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x,
                y: p.y,
                vx: (Math.random() - 0.5) * 5 - Math.cos(angle) * 3,
                vy: (Math.random() - 0.5) * 5 - Math.sin(angle) * 3,
                color: '#22d3ee',
                size: Math.random() * 3.5 + 1.5,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 20
              });
            }
            if (Math.random() < 0.05) {
              addCombatLogMessage("⚡ SILOVÁ BARIÉRA: Pokus o opuštění bojové arény odražen!", "#22d3ee");
            }
          }
        }

        if (p.invulnerableTime > 0) {
          p.invulnerableTime--;
        }
      });
    }

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
        // Find nearest living helper player and check if they are holding action
        let helperNear = false;
        let actionHeld = false;
        playersRef.current.forEach(livingHero => {
          if (livingHero.hull > 0) {
            const dx = deadPlayer.x - livingHero.x;
            const dy = deadPlayer.y - livingHero.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 90) {
              helperNear = true;
              
              // Read key controls based on helper's input source
              let isHolding = false;
              if (livingHero.inputSource === 'keyboard_p1') {
                isHolding = !!(keysPressed.current['ControlLeft'] || keysPressed.current['KeyF'] || keysPressed.current['Space']);
              } else if (livingHero.inputSource === 'keyboard_p2') {
                isHolding = !!(keysPressed.current['ControlRight'] || keysPressed.current['Space']);
              } else {
                // Gamepad fallback or general any-key fallback
                isHolding = !!(keysPressed.current['Space'] || keysPressed.current['MouseDown']);
              }

              if (isHolding) {
                actionHeld = true;
                
                // Spawn high-five action transfer sparks
                if (Math.random() < 0.28) {
                  particlesRef.current.push({
                    id: Math.random().toString(36).substring(2, 9),
                    x: livingHero.x,
                    y: livingHero.y,
                    vx: (deadPlayer.x - livingHero.x) * 0.12 + (Math.random() - 0.5) * 3,
                    vy: (deadPlayer.y - livingHero.y) * 0.12 + (Math.random() - 0.5) * 3,
                    color: '#10b981', // healing green energy
                    size: Math.random() * 3.5 + 1.5,
                    alpha: 1.0,
                    lifetime: 0,
                    maxLifetime: 22
                  });
                }
              }
            }
          }
        });

        if (helperNear && actionHeld) {
          deadPlayer.reviveTimer += 1.0; // charge up!
          
          if (deadPlayer.reviveTimer >= 150) { // 2.5s at 60fps
            const hpRestoreVal = Math.round(deadPlayer.maxHull * 0.4);
            deadPlayer.hull = hpRestoreVal;
            deadPlayer.invulnerableTime = 120; // 2 seconds invulnerable
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
                color: '#10b981',
                size: Math.random() * 4.5 + 2.5,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 35,
              });
            }
          }
        } else {
          // Decay progress if helper is not around or let go of action
          deadPlayer.reviveTimer = Math.max(0, deadPlayer.reviveTimer - 0.75);
        }
      }
    });

    // --- UPDATE SPATIAL ANOMALY ---
    if (activeAnomalyRef.current) {
      const anomaly = activeAnomalyRef.current;
      anomaly.lifetime += 1;
      
      oresRef.current.forEach(ore => {
        const dx = ore.x - anomaly.x;
        const dy = ore.y - anomaly.y;
        const dist = Math.hypot(dx, dy);
        if (dist < anomaly.radius) {
          const force = (1 - dist / anomaly.radius) * 0.45;
          ore.vx -= (dx / dist) * force;
          ore.vy -= (dy / dist) * force;
        }
      });
      
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const dx = p.x - anomaly.x;
          const dy = p.y - anomaly.y;
          const dist = Math.hypot(dx, dy);
          if (dist < anomaly.radius) {
            const force = (1 - dist / anomaly.radius) * 0.28;
            p.vx -= (dx / dist) * force;
            p.vy -= (dy / dist) * force;
          }
        }
      });
      
      asteroidsRef.current.forEach(ast => {
        const dx = ast.x - anomaly.x;
        const dy = ast.y - anomaly.y;
        const dist = Math.hypot(dx, dy);
        if (dist < anomaly.radius) {
          const force = (1 - dist / anomaly.radius) * 0.18;
          ast.vx -= (dx / dist) * force;
          ast.vy -= (dy / dist) * force;
        }
      });

      if (Math.random() < 0.4) {
        const pAngle = Math.random() * Math.PI * 2;
        const pDist = Math.random() * 80;
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: anomaly.x + Math.cos(pAngle) * pDist,
          y: anomaly.y + Math.sin(pAngle) * pDist,
          vx: -Math.cos(pAngle) * 2.5 + (Math.random() - 0.5) * 0.5,
          vy: -Math.sin(pAngle) * 2.5 + (Math.random() - 0.5) * 0.5,
          color: '#a855f7',
          size: Math.random() * 4.0 + 1.5,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 40 + Math.floor(Math.random() * 20),
        });
      }

      if (anomaly.lifetime >= anomaly.maxLifetime) {
        activeAnomalyRef.current = null;
        addCombatLogMessage("🌀 SYSTEM: Gravitační anomálie se bezpečně rozplynula v časoprostoru.", "#a855f7");
      }
    }

    // --- RANDOM SPACE EVENTS SCHEDULER TICK ---
    const nowTime = Date.now();
    if (nowTime - lastEventTimeRef.current >= 35000) {
      lastEventTimeRef.current = nowTime;
      triggerRandomSpaceEvent();
    }

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
            
            // Checking if player is shadowed behind ANY large / huge / colossal asteroid relative to wind direction!
            let isShadowed = false;
            const windDirX = Math.cos(solarStormDirectionRef.current);
            const windDirY = Math.sin(solarStormDirectionRef.current);

            // Anchored and deep drilling rock provides excellent insulation!
            if (p.anchoredAsteroidId) {
              isShadowed = true; 
            } else {
              asteroidsRef.current.forEach(ast => {
                if (ast.size === 'colossal' || ast.size === 'huge' || ast.size === 'large') {
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
                const diffSettings = getDifficultySettings(difficultyRef.current);
                const stormDmgShield = Math.max(1, Math.round(8 * diffSettings.solarStormDamageMultiplier));
                const stormDmgHull = Math.max(1, Math.round(5 * diffSettings.solarStormDamageMultiplier));

                if (p.shield > 0) {
                  p.shield = Math.max(0, p.shield - stormDmgShield);
                  p.lastShieldHitTime = Date.now();
                  addGainNotification(`⚠️ ${p.name} - RADIACE POŠKODILA ŠTÍT! (-${stormDmgShield} HP)`, '#fb923c');
                  addCombatLogMessage(`⚠️ ${p.name}: Radiace poškodila štít -${stormDmgShield}`, '#fb923c');
                  playDamageSound();
                } else {
                  p.hull = Math.max(0, p.hull - stormDmgHull);
                  p.lastHullHitTime = Date.now();
                  addGainNotification(`⚠️ ${p.name} - RADIACE POŠKODILA TRUP! (-${stormDmgHull} HP)`, '#ef4444');
                  addCombatLogMessage(`🚨 ${p.name}: Radiace poškodila trup -${stormDmgHull}`, '#ef4444');
                  playDamageSound();
                  
                  if (p.hull <= 0) {
                    handlePlayerDeath(p, 'zničen radiací v bouři');
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
          if ([15, 10, 5, 3, 2, 1].includes(secs)) {
            playSolarStormWarningSound();
          }
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
    // Spawn chance: if random check succeeds and isPlaying and pirates counts < maxCount and enemies are enabled
    const diffSettings = getDifficultySettings(difficultyRef.current);
    const maxPirates = difficultyRef.current === 'easy' ? 1 : difficultyRef.current === 'medium' ? 2 : difficultyRef.current === 'hard' ? 3 : 4;
    
    if (enemiesEnabledRef.current && Math.random() < 0.0025 * diffSettings.pirateSpawnChanceMultiplier && piratesRef.current.length < maxPirates) {
      const pX = lastCamXRef.current;
      const pY = lastCamYRef.current;
      const angle = Math.random() * Math.PI * 2;
      const spawnX = pX + Math.cos(angle) * (width / 2 + 150 + Math.random() * 200);
      const spawnY = pY + Math.sin(angle) * (height / 2 + 150 + Math.random() * 200);

      const baseHp = Math.round(120 * diffSettings.pirateHpMultiplier);

      piratesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        angle: Math.random() * Math.PI * 2,
        hp: baseHp,
        maxHp: baseHp,
        radius: 17,
        lastFired: 0,
        color: '#f43f5e'
      });
      addGainNotification(`☠️ DETEKOVÁNA DETACHOVANÁ PIRÁTSKÁ LOĎ!`, '#f43f5e');
    }

    // --- BOSS FIGHT PHYSICS STATE MACHINE ---
    if (isBossFightActiveRef.current && bossRef.current) {
      const boss = bossRef.current;
      
      // Update boss state based on phase or HP
      if (boss.state === 'intro') {
        // Move towards center y=-150 slowly
        const dy = -150 - boss.y;
        boss.y += dy * 0.02;
        if (Math.abs(dy) < 5) {
          boss.state = 'active';
          addGainNotification("⚠️ POZOR: GENERÁL KORZÁRŮ PŘISTÁL VE VAŠEM SEKTORU!", "#ef4444");
        }
      } else {
        // Boss Active movement: hover left and right and bounce subtly
        boss.x += Math.sin(Date.now() / 2500) * 1.5;
        boss.y += Math.cos(Date.now() / 1500) * 0.5;

        // Boss direct crushing collision with platforms
        if (arenaPlatformsRef.current.length > 0) {
          arenaPlatformsRef.current.forEach(plat => {
            const halfW = plat.width / 2;
            const halfH = plat.height / 2;
            
            const closestX = Math.max(plat.x - halfW, Math.min(boss.x, plat.x + halfW));
            const closestY = Math.max(plat.y - halfH, Math.min(boss.y, plat.y + halfH));
            const distance = Math.hypot(boss.x - closestX, boss.y - closestY);
            
            if (distance < boss.radius) {
              plat.hp -= 1.8; // Melt structure on direct physical contact with giant boss
              
              if (Math.random() < 0.25) {
                particlesRef.current.push({
                  id: Math.random().toString(36).substring(2, 9),
                  x: closestX,
                  y: closestY,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  color: plat.color,
                  size: Math.random() * 3 + 1,
                  alpha: 1,
                  lifetime: 0,
                  maxLifetime: 20
                });
              }
            }
          });
        }

        // Minecraft style burning particles rising from the boss (on fire like in Minecraft!)
        if (Math.random() < 0.40) {
          const fAngle = Math.random() * Math.PI * 2;
          const fDist = Math.random() * (boss.radius - 12);
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: boss.x + Math.cos(fAngle) * fDist,
            y: boss.y + Math.sin(fAngle) * fDist,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -Math.random() * 2.8 - 1.2, // rises upward like real flame
            color: Math.random() < 0.4 ? '#f97316' : Math.random() < 0.75 ? '#ef4444' : '#fb923c', // Minecraft fire colors
            size: Math.random() * 5.0 + 2.5, // pixelated squares
            alpha: 1.0,
            lifetime: 0,
            maxLifetime: 32,
            isSquare: true, // Render as beautiful squares
          });
        }

        // Boss self-healing logic: heals itself if not damaged for 3.5 seconds!
        const timeSinceLastDamage = Date.now() - (boss.lastDamageTime || 0);
        if (boss.hp < boss.maxHp && timeSinceLastDamage > 3500) {
          const currentLives = boss.lives ?? 6;
          // Heal rate increases as boss lives decrease!
          const healAmountPerSec = 250 + (6 - currentLives) * 180;
          const healPerFrame = healAmountPerSec / 60;
          boss.hp = Math.min(boss.maxHp, boss.hp + healPerFrame);

          // Green healing nanite particle stream!
          if (Math.random() < 0.20) {
            const hAngle = Math.random() * Math.PI * 2;
            const hDist = Math.random() * boss.radius;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: boss.x + Math.cos(hAngle) * hDist,
              y: boss.y + Math.sin(hAngle) * hDist,
              vx: (Math.random() - 0.5) * 1.8,
              vy: (Math.random() - 0.5) * 1.8,
              color: '#22c55e', // beautiful glowing emerald healing nanite color
              size: Math.random() * 2.5 + 1.2,
              alpha: 1.0,
              lifetime: 0,
              maxLifetime: 35
            });
          }
        }

        // Rotate towards the closest player
        let closestP: Player | null = null;
        let closestDist = 999999;
        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            const d = Math.hypot(p.x - boss.x, p.y - boss.y);
            if (d < closestDist) {
              closestDist = d;
              closestP = p;
            }
          }
        });

        if (closestP) {
          const p = closestP as Player;
          const targetAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
          let dAngle = targetAngle - boss.angle;
          while (dAngle < -Math.PI) dAngle += Math.PI * 2;
          while (dAngle > Math.PI) dAngle -= Math.PI * 2;
          boss.angle += dAngle * 0.03;
          
          // --- BOSS VALUABLE SUPER MOVE DETECTOR ---
          if (Date.now() - (boss.lastValuableMove || 0) > 12000) {
            boss.lastValuableMove = Date.now();
            playExplosionSound('huge');
            
            // On-screen alarm notification
            addGainNotification("⚠️ GENERÁL KORZÁRŮ AKTIVOVAL KOSMICKÝ GEJZÍR SUROVIN!", "#a855f7");
            addGainNotification("Vyhýbejte se super-koulím a sesbírejte diamanty!", "#38bdf8");

            // 1. Fire circular high-velocity pattern (12 bullets!)
            const count = 12;
            for (let i = 0; i < count; i++) {
              const ang = (i * Math.PI * 2) / count;
              pirateLasersRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: boss.x + Math.cos(ang) * 90,
                y: boss.y + Math.sin(ang) * 90,
                vx: Math.cos(ang) * 9.5,
                vy: Math.sin(ang) * 9.5,
                angle: ang,
                radius: 8,
                color: '#c084fc', // high-damage glowing purple/pink energy balls
                lifetime: 0,
                maxLifetime: 150
              });
            }

            // 2. Spawn extremely valuable resources around the boss body!
            // 2x Diamond, 1x Obsidian, 2x Crystal (each now multiplied in value when gathered!)
            const resourceTypes: ('crystal' | 'diamond' | 'obsidian')[] = ['diamond', 'obsidian', 'diamond', 'crystal', 'crystal'];
            resourceTypes.forEach((oType, idx) => {
              const rAng = (idx * Math.PI * 2) / resourceTypes.length + Math.random() * 0.4;
              const dist = 125;
              const rx = boss.x + Math.cos(rAng) * dist;
              const ry = boss.y + Math.sin(rAng) * dist;
              
              // Gentle outward drift velocity
              const rvx = Math.cos(rAng) * (Math.random() * 2.0 + 1.2);
              const rvy = Math.sin(rAng) * (Math.random() * 2.0 + 1.2);

              const rawOre = createOreEntity(rx, ry, oType);
              rawOre.vx = rvx;
              rawOre.vy = rvy;
              oresRef.current.push(rawOre);
            });

            // Giant spark/plasma discharge cloud
            for (let i = 0; i < 35; i++) {
              const sAng = Math.random() * Math.PI * 2;
              const sSpd = Math.random() * 8 + 3;
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: boss.x,
                y: boss.y,
                vx: Math.cos(sAng) * sSpd,
                vy: Math.sin(sAng) * sSpd,
                color: '#a855f7',
                size: Math.random() * 4.5 + 2,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 45
              });
            }
          }

          // Fire boss weapons!
          const fireInterval = difficultyRef.current === 'easy' ? 1800 : difficultyRef.current === 'hard' ? 800 : difficultyRef.current === 'nightmare' ? 500 : 1200;
          if (Date.now() - boss.lastFired > fireInterval) {
            boss.lastFired = Date.now();
            playLaserSound(2);

            // Pattern depends on HP or state
            if (boss.hp < boss.maxHp * 0.45) {
              // Desperation phase: massive 12-bullet circular ring!
              for (let i = 0; i < 12; i++) {
                const ang = boss.angle + (i * Math.PI / 6);
                pirateLasersRef.current.push({
                  id: Math.random().toString(36).substring(2, 9),
                  x: boss.x + Math.cos(ang) * 90,
                  y: boss.y + Math.sin(ang) * 90,
                  vx: Math.cos(ang) * 8.0,
                  vy: Math.sin(ang) * 8.0,
                  angle: ang,
                  radius: 7,
                  color: '#eab308', // heavy gold energy balls!
                  lifetime: 0,
                  maxLifetime: 120
                });
              }
            } else {
              // Standard phase: Heavy 5-bullet fan-shaped projectile spread! (Much stronger!)
              const angles = [boss.angle - 0.4, boss.angle - 0.2, boss.angle, boss.angle + 0.2, boss.angle + 0.4];
              angles.forEach(ang => {
                pirateLasersRef.current.push({
                  id: Math.random().toString(36).substring(2, 9),
                  x: boss.x + Math.cos(ang) * 90,
                  y: boss.y + Math.sin(ang) * 90,
                  vx: Math.cos(ang) * 9.0,
                  vy: Math.sin(ang) * 9.0,
                  angle: ang,
                  radius: 6,
                  color: '#f43f5e',
                  lifetime: 0,
                  maxLifetime: 100
                });
              });
            }
          }
        }
      }

      // Check if boss died or needs resurrection (has multiple lives)
      if (boss.hp <= 0) {
        const currentLives = boss.lives ?? 1;
        if (currentLives > 1) {
          // Resurrection / phase progression!
          boss.lives = currentLives - 1;
          boss.hp = boss.maxHp;
          
          // Sound effects
          playExplosionSound('huge');
          playUpgradeSound();

          // Menacing alarm notifications
          addGainNotification(`💥 GENERÁLŮV TRUP BYL ZNIČEN!`, "#ef4444");
          addGainNotification(`⚠️ AKTIVOVÁNO SEBE-UZDRAVENÍ! (Zbývá životů: ${boss.lives}/${boss.maxLives})`, "#22c55e");
          addGainNotification(`Generál se stává agresivnějším!`, "#eab308");

          // Reward the player with half of the final reward for surviving this phase!
          setStats(curr => {
            const nextStats = {
              ...curr,
              crystals: curr.crystals + 30,
              diamonds: curr.diamonds + 10,
              obsidian: curr.obsidian + 3,
            };
            saveStats(nextStats);
            return nextStats;
          });
          setRunCrystals(c => c + 30);
          setRunDiamonds(d => d + 10);
          setRunObsidian(o => o + 3);

          // Force spawn useful drops directly at the core - gold rush style!
          triggerSpawnAsteroidDrops(boss.x, boss.y, 'huge', 'gold-rush');

          // Release a defensive radial EMP shockwave (pushes away players, clears local bullets)
          pirateLasersRef.current = []; // Clear current bullets to avoid cheap hits
          
          playersRef.current.forEach(p => {
            if (p.hull > 0) {
              const dx = p.x - boss.x;
              const dy = p.y - boss.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 450) {
                const pushAngle = Math.atan2(dy, dx);
                p.vx += Math.cos(pushAngle) * 16;
                p.vy += Math.sin(pushAngle) * 16;
                p.invulnerableTime = 70; // short buffer
              }
            }
          });

          // Giant phase-shift particle circle
          for (let i = 0; i < 90; i++) {
            const ang = (i * Math.PI * 2) / 90;
            const spd = Math.random() * 12 + 4;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: boss.x,
              y: boss.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              color: '#22c55e', // Emerald nanite shielding burst
              size: Math.random() * 6 + 2.5,
              alpha: 1.0,
              lifetime: 0,
              maxLifetime: 60,
            });
          }
        } else {
          // Absolute death! Defeated for good.
          bossRef.current = null;

          // Win rewards! Large crystals, diamonds, obsidian!
          setStats(curr => {
            const nextStats = {
              ...curr,
              crystals: curr.crystals + 150,
              diamonds: curr.diamonds + 40,
              obsidian: curr.obsidian + 15,
            };
            saveStats(nextStats);
            return nextStats;
          });

          // Spawn the Orange Return Portal right where the boss died!
          wormholeRef.current = {
            x: boss.x,
            y: boss.y,
            radius: 80,
            angle: 0,
            pulseScale: 1.0,
            soundPlayed: false,
            isReturn: true, // Return portal flag
          };

          // Trigger massive screen-clearing explosion
          triggerComboSteamCloud(boss.x, boss.y);
          for (let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 14 + 3;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: boss.x,
              y: boss.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: Math.random() < 0.5 ? '#facc15' : '#ef4444',
              size: Math.random() * 9 + 3,
              alpha: 1.0,
              lifetime: 0,
              maxLifetime: 95,
            });
          }
          playExplosionSound('colossal');

          addGainNotification("🏆 OMEGA KORZÁR BYL PORAŽEN!", "#22c55e");
          addGainNotification("🌀 OTEVŘEL SE PORTÁL ZPĚT PRO NÁVRAT!", "#f97316");
          addGainNotification("Vleť do oranžového portálu pro návrat do těžebního sektoru!", "#eab308");
        }
      }
      
      // Synchronize boss values to React state for top HP bar overlay
      if (bossRef.current) {
        setBossHp(bossRef.current.hp);
        setBossMaxHp(bossRef.current.maxHp);
        setBossLives(bossRef.current.lives ?? 1);
        setBossMaxLives(bossRef.current.maxLives ?? 6);
      }
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

        // Fire at closest player within range (450px) and cooldown is over
        const cooldownMs = difficultyRef.current === 'easy' ? 2500 : difficultyRef.current === 'medium' ? 1500 : difficultyRef.current === 'hard' ? 1000 : 650;
        if (closestDist < 450 && Date.now() - pirate.lastFired > cooldownMs) {
          pirate.lastFired = Date.now();
          if (difficultyRef.current === 'nightmare') {
            // Dual laser blast!
            const angles = [pirate.angle - 0.15, pirate.angle + 0.15];
            angles.forEach(ang => {
              pirateLasersRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: pirate.x + Math.cos(ang) * 20,
                y: pirate.y + Math.sin(ang) * 20,
                vx: Math.cos(ang) * 8.5,
                vy: Math.sin(ang) * 8.5,
                angle: ang,
                radius: 4.5,
                color: '#f43f5e',
                lifetime: 0,
                maxLifetime: 65
              });
            });
          } else {
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
          }
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

      // Check collision with arena platforms
      if (isBossFightActiveRef.current && arenaPlatformsRef.current.length > 0 && pl.lifetime < pl.maxLifetime) {
        arenaPlatformsRef.current.forEach(plat => {
          const halfW = plat.width / 2;
          const halfH = plat.height / 2;
          if (
            pl.x >= plat.x - halfW &&
            pl.x <= plat.x + halfW &&
            pl.y >= plat.y - halfH &&
            pl.y <= plat.y + halfH
          ) {
            pl.lifetime = pl.maxLifetime; // absorb/destroy laser

            // Spawn platform-colored sparks
            for (let i = 0; i < 4; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: pl.x,
                y: pl.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: plat.color,
                size: Math.random() * 2 + 1,
                alpha: 1,
                lifetime: 0,
                maxLifetime: 15
              });
            }
          }
        });
      }
      
      // Check collision with player ships!
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.invulnerableTime <= 0 && pl.lifetime < pl.maxLifetime) {
          const d = Math.hypot(p.x - pl.x, p.y - pl.y);
          if (d < p.radius + pl.radius) {
            // Quantum Mirror passive reflex shield module
            if (upgradesRef.current.quantumMirrorLevel > 0 && p.shield > 0 && Math.random() < 0.15) {
              addGainNotification(`🛡️ KVANTOVÉ ZRCADLO: Střela odražena zpět!`, '#818cf8');
              addCombatLogMessage(`🛡️ ${p.name}: Kvantové zrcadlo odrazilo nepřátelskou střelu!`, '#818cf8');
              
              lasersRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x,
                y: p.y,
                vx: -pl.vx * 1.35,
                vy: -pl.vy * 1.35,
                angle: Math.atan2(-pl.vy, -pl.vx),
                damage: 22, // significant reflected counter damage
                isPiercing: false,
                piercedAsteroidIds: [],
                radius: 5,
                width: 4,
                color: '#818cf8', // Cosmic indigo reflected blast
                lifetime: 0,
                maxLifetime: 65,
              });

              pl.lifetime = pl.maxLifetime; // destroy the incoming laser
              playLaserSound(0);
              return; // Skip normal hit handling
            }

            const diffSettings = getDifficultySettings(difficultyRef.current);
            const pirateDmgShield = Math.max(1, Math.round(14 * diffSettings.pirateLaserDamageMultiplier));
            const pirateDmgHull = Math.max(1, Math.round(8 * diffSettings.pirateLaserDamageMultiplier));

            if (p.shield > 0) {
              p.shield = Math.max(0, p.shield - pirateDmgShield);
              p.lastShieldHitTime = Date.now();
              addGainNotification(`💥 ${p.name} - ABSORBOVÁN ZÁSAH ŠTÍTEM! (-${pirateDmgShield} HP)`, '#fb923c');
              addCombatLogMessage(`💥 ${p.name}: Korzár laser zasáhl štít -${pirateDmgShield}`, '#38bdf8');
            } else {
              p.hull = Math.max(0, p.hull - pirateDmgHull);
              p.lastHullHitTime = Date.now();
              addGainNotification(`💥 ${p.name} - TRUP POŠKOZEN KORZÁREM! (-${pirateDmgHull} HP)`, '#ef4444');
              addCombatLogMessage(`🚨 ${p.name}: Korzár laser zasáhl trup -${pirateDmgHull}`, '#ef4444');
              if (p.hull <= 0) {
                handlePlayerDeath(p, 'zničen korzáry');
              }
            }
            playDamageSound();
            triggerCameraShake(6);
            pl.lifetime = pl.maxLifetime; // mark dead
          }
        }
      });
    });

    // Update active PDS beams alpha
    activePdsBeamsRef.current.forEach(beam => {
      beam.alpha -= 0.08;
    });
    activePdsBeamsRef.current = activePdsBeamsRef.current.filter(beam => beam.alpha > 0);

    // --- HANGAR POINT DEFENSE SYSTEM (PDS) ---
    const pdsLevel = upgradesRef.current.carrierPointDefenseLevel || 0;
    if (pdsLevel > 0) {
      // Find source coordinate (Carrier or Capital Ship)
      let pdsSourceX: number | null = null;
      let pdsSourceY: number | null = null;

      if (capitalShipModeRef.current && capitalShipRef.current) {
        pdsSourceX = capitalShipRef.current.x;
        pdsSourceY = capitalShipRef.current.y;
      } else if (upgradesRef.current.carrierClass !== 'none' && carrierRef.current) {
        pdsSourceX = carrierRef.current.x;
        pdsSourceY = carrierRef.current.y;
      }

      if (pdsSourceX !== null && pdsSourceY !== null) {
        const pdsRange = pdsLevel === 1 ? 150 : pdsLevel === 2 ? 200 : 250;
        const pdsCooldown = pdsLevel === 1 ? 180 : pdsLevel === 2 ? 120 : 60;

        if (lastPdsFiredRef.current === undefined) {
          lastPdsFiredRef.current = 0;
        }

        lastPdsFiredRef.current++;

        if (lastPdsFiredRef.current >= pdsCooldown) {
          let closestLaser: PirateLaser | null = null;
          let minDistance = pdsRange;

          pirateLasersRef.current.forEach(pl => {
            if (pl.lifetime < pl.maxLifetime) {
              const d = Math.hypot(pl.x - pdsSourceX!, pl.y - pdsSourceY!);
              if (d < minDistance) {
                minDistance = d;
                closestLaser = pl;
              }
            }
          });

          if (closestLaser) {
            (closestLaser as PirateLaser).lifetime = (closestLaser as PirateLaser).maxLifetime;
            lastPdsFiredRef.current = 0;

            activePdsBeamsRef.current.push({
              fromX: pdsSourceX,
              fromY: pdsSourceY,
              toX: (closestLaser as PirateLaser).x,
              toY: (closestLaser as PirateLaser).y,
              alpha: 1.0,
            });

            for (let i = 0; i < 15; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: (closestLaser as PirateLaser).x,
                y: (closestLaser as PirateLaser).y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: '#38bdf8',
                size: Math.random() * 3 + 1,
                alpha: 1.0,
                lifetime: 0,
                maxLifetime: 30 + Math.random() * 20,
              });
            }

            playLaserSound(2);
            addGainNotification(`🛡️ PDS: Sestřelena korzárská střela!`, '#38bdf8');
          }
        }
      }
    }

    // Remove stale pirate lasers
    pirateLasersRef.current = pirateLasersRef.current.filter(pl => pl.lifetime < pl.maxLifetime);

    // =========================================================================
    // --- CUSTOM SECTOR ANOMALIES & TACTICAL UPGRADE DYNAMIC UPDATES ---
    // =========================================================================

    // --- TACTICAL RADAR SCANNING PROCESSOR ---
    const primaryPlayer = playersRef.current.find(pl => pl.hull > 0) || playersRef.current[0];
    if (primaryPlayer && isPlayingRef.current && !isShopOpenRef.current) {
      const isStationary = Math.hypot(primaryPlayer.vx || 0, primaryPlayer.vy || 0) < 0.1;
      if (isStationary) {
        stationaryTicksRef.current++;
        if (stationaryTicksRef.current === 120) { // 2.0 seconds stationary
          scanActiveTicksRef.current = 300; // 5.0 seconds scan duration
          addGainNotification("📡 TAKTICKÝ SKEN: Lokalizována vzácná ložiska rud!", "#a855f7");
          addCombatLogMessage("📡 Taktický skener dokončil hluboký sken okolí a zvýraznil ložiska.", "#a855f7");
          playUpgradeSound();
        }
      } else {
        stationaryTicksRef.current = 0;
      }
    } else {
      stationaryTicksRef.current = 0;
    }

    if (scanActiveTicksRef.current > 0) {
      scanActiveTicksRef.current--;
    }

    // 1. Sektor Beta: Magmatické peklo (Lava projectile eruptions)
    if (selectedMapRef.current === 'magma') {
      // Periodic chance of a solar eruption (approx. every 8-10 seconds)
      if (Math.random() < 0.002) {
        addGainNotification("🌋 DETEKOVÁNA SOLÁRNÍ ERUPCE!", "#fb923c");
        addCombatLogMessage("🌋 Sektor Beta: Solární erupce vymrštila horké lávové projektily!", "#fb923c");
        
        const camX = lastCamXRef.current;
        const camY = lastCamYRef.current;
        const count = 7 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
          const angle = Math.PI * 0.25 + Math.random() * Math.PI * 0.5; // downward angle
          const speed = Math.random() * 4.5 + 3.0;
          const spawnX = camX + (Math.random() * 1200 - 600) - Math.cos(angle) * 350;
          const spawnY = camY - 550; // spawn just above viewport
          
          lavaProjectilesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: spawnX,
            y: spawnY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 10 + 9, // 9 to 19px
            color: Math.random() < 0.5 ? '#f97316' : '#ef4444',
            damage: 18,
            lifetime: 0,
            maxLifetime: 300,
          });
        }
      }
    }

    // Update Lava Projectiles
    lavaProjectilesRef.current.forEach(lp => {
      lp.x += lp.vx;
      lp.y += lp.vy;
      lp.lifetime++;

      // Flame trails
      if (Math.random() < 0.35) {
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: lp.x + (Math.random() - 0.5) * lp.radius,
          y: lp.y + (Math.random() - 0.5) * lp.radius,
          vx: -lp.vx * 0.2 + (Math.random() - 0.5) * 0.8,
          vy: -lp.vy * 0.2 + (Math.random() - 0.5) * 0.8,
          color: lp.color,
          size: Math.random() * 4 + 2,
          alpha: 0.8,
          lifetime: 0,
          maxLifetime: 18
        });
      }

      // Hit check against players
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.invulnerableTime <= 0) {
          const dist = Math.hypot(p.x - lp.x, p.y - lp.y);
          if (dist < p.radius + lp.radius) {
            lp.lifetime = lp.maxLifetime; // destroy

            // Apply damage
            if (p.shield > 0) {
              p.shield = Math.max(0, p.shield - lp.damage);
              p.lastShieldHitTime = Date.now();
              addGainNotification(`💥 ${p.name} - LÁVA ZASÁHLA ŠTÍT! (-${lp.damage} HP)`, '#fb923c');
            } else {
              p.hull = Math.max(0, p.hull - lp.damage);
              p.lastHullHitTime = Date.now();
              addGainNotification(`🚨 ${p.name} - LÁVA POŠKODILA TRUP! (-${lp.damage} HP)`, '#ef4444');
              if (p.hull <= 0) {
                handlePlayerDeath(p, 'roztaven lávou');
              }
            }
            playDamageSound();
            triggerCameraShake(5);

            // Lava splash explosion particles
            for (let i = 0; i < 12; i++) {
              const pAng = Math.random() * Math.PI * 2;
              const pSpd = Math.random() * 4 + 1.5;
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: lp.x,
                y: lp.y,
                vx: Math.cos(pAng) * pSpd,
                vy: Math.sin(pAng) * pSpd,
                color: lp.color,
                size: Math.random() * 5 + 1.5,
                alpha: 0.9,
                lifetime: 0,
                maxLifetime: 25
              });
            }
          }
        }
      });
    });
    lavaProjectilesRef.current = lavaProjectilesRef.current.filter(lp => lp.lifetime < lp.maxLifetime);

    // 2. Sektor Gamma: Ledový prstenec (Blizzard zones and freezing)
    if (selectedMapRef.current === 'ice') {
      // Maintain exactly 2 blizzard zones in Sektor Gamma
      if (blizzardZonesRef.current.length < 2) {
        blizzardZonesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: (Math.random() - 0.5) * 2200,
          y: (Math.random() - 0.5) * 2200,
          vx: (Math.random() - 0.5) * 1.6,
          vy: (Math.random() - 0.5) * 1.6,
          radius: Math.random() * 120 + 220, // 220 to 340px radius
          speed: Math.random() * 0.02 + 0.01,
        });
      }
    }

    // Update Blizzard Zones
    blizzardZonesRef.current.forEach(bz => {
      bz.x += bz.vx;
      bz.y += bz.vy;

      // Keep them within field boundary
      if (Math.abs(bz.x) > 1900) bz.vx *= -1;
      if (Math.abs(bz.y) > 1900) bz.vy *= -1;

      // Swirling blizzard snow particles inside the circle
      if (Math.random() < 0.45) {
        const pAng = Math.random() * Math.PI * 2;
        const pDist = Math.random() * bz.radius;
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: bz.x + Math.cos(pAng) * pDist,
          y: bz.y + Math.sin(pAng) * pDist,
          vx: bz.vx + Math.sin(pAng) * 0.8 + (Math.random() - 0.5) * 0.6,
          vy: bz.vy - Math.cos(pAng) * 0.8 + (Math.random() - 0.5) * 0.6, // circular swirling motion
          color: Math.random() < 0.3 ? '#bae6fd' : '#e0f2fe',
          size: Math.random() * 2.5 + 1.0,
          alpha: 0.45,
          lifetime: 0,
          maxLifetime: 60
        });
      }

      // Apply frost accumulate to players inside
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const dist = Math.hypot(p.x - bz.x, p.y - bz.y);
          if (dist < bz.radius) {
            p.frostLevel = Math.min(100, (p.frostLevel || 0) + 0.30); // accumulate frost
            
            // tiny icicles sparks falling off
            if (Math.random() < 0.12) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x + (Math.random() - 0.5) * 22,
                y: p.y + (Math.random() - 0.5) * 22,
                vx: p.vx * 0.3,
                vy: p.vy * 0.3 + 0.4,
                color: '#e0f2fe',
                size: Math.random() * 2 + 1,
                alpha: 0.7,
                lifetime: 0,
                maxLifetime: 15
              });
            }
          }
        }
      });
    });

    // Frost decay and frozen timer ticking
    playersRef.current.forEach(p => {
      if (p.hull > 0) {
        const inBlizzardZone = blizzardZonesRef.current.some(bz => Math.hypot(p.x - bz.x, p.y - bz.y) < bz.radius);
        if (!inBlizzardZone) {
          p.frostLevel = Math.max(0, (p.frostLevel || 0) - 0.15); // natural warming up outside
        }
        if (p.frozenTimer && p.frozenTimer > 0) {
          p.frozenTimer--;
        }
      }
    });

    // 3. Sektor Delta: Zlaté jádro (EM Storms)
    if (selectedMapRef.current === 'gold') {
      if (emStormNextTriggerRef.current > 0) {
        emStormNextTriggerRef.current--;
      } else {
        // Trigger EM storm!
        emStormActiveRef.current = true;
        emStormTimerRef.current = 300; // 5 seconds duration
        emStormNextTriggerRef.current = 900 + Math.floor(Math.random() * 600); // 15-25 seconds cooldown
        addGainNotification("⚠️ ELEKTROMAGNETICKÁ BOUŘE ZAPOČALA!", "#f59e0b");
        addCombatLogMessage("🚨 Sektor Delta: EM bouře vyřadila magnet na rudu a ruší radarový signál!", "#f59e0b");
        playExplosionSound('medium');
      }

      if (emStormActiveRef.current) {
        if (emStormTimerRef.current > 0) {
          emStormTimerRef.current--;

          // Spark particles around random screen points
          if (Math.random() < 0.2) {
            const camX = lastCamXRef.current;
            const camY = lastCamYRef.current;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: camX + (Math.random() * window.innerWidth - window.innerWidth / 2),
              y: camY + (Math.random() * window.innerHeight - window.innerHeight / 2),
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              color: '#fbbf24', // golden yellow sparks
              size: Math.random() * 2 + 1,
              alpha: 0.8,
              lifetime: 0,
              maxLifetime: 12
            });
          }
        } else {
          emStormActiveRef.current = false;
          addGainNotification("✅ ELEKTROMAGNETICKÉ RUŠENÍ SKONČILO", "#10b981");
          addCombatLogMessage("⚡ Sektor Delta: Signál radaru a magnet obnoven.", "#10b981");
        }
      }
    } else {
      emStormActiveRef.current = false;
    }

    // 4. Boss Sector specific attacks updating
    if (isBossFightActiveRef.current && bossRef.current) {
      const boss = bossRef.current;

      // 4a. Magmatický Sektor Boss Attacks (Guided Fireballs)
      if (selectedMapRef.current === 'magma') {
        // Boss fires a guided fireball every 3.5 seconds
        if (Date.now() - (boss.lastSpecialAttack || 0) > 3500) {
          boss.lastSpecialAttack = Date.now();
          playLaserSound(3);
          
          bossGuidedFireballsRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: boss.x,
            y: boss.y,
            vx: Math.cos(boss.angle) * 3.5,
            vy: Math.sin(boss.angle) * 3.5,
            radius: 15,
            color: '#ef4444',
            damage: 25,
            lifetime: 0,
            maxLifetime: 240, // 4 seconds duration
          });
          addGainNotification("🔥 BOSS VYSTŘELIL NAVÁDĚNOU OHŇOVOU KOULI!", "#ef4444");
        }
      }

      // 4b. Ledový Sektor Boss Attacks (Freezing Pulse)
      if (selectedMapRef.current === 'ice') {
        // Boss releases freezing pulse every 4.5 seconds
        if (Date.now() - (boss.lastSpecialAttack || 0) > 4500) {
          boss.lastSpecialAttack = Date.now();
          playExplosionSound('medium');

          bossFreezingPulsesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: boss.x,
            y: boss.y,
            radius: 20,
            maxRadius: 360,
            speed: 5,
            damage: 10,
            hitPlayerIds: [],
          });
          addGainNotification("❄️ BOSS VYPUSTIL MRAZIVÝ PULS!", "#38bdf8");
        }
      }

      // 4c. Zlatý Sektor Boss Attacks (Summon Escort Drones)
      if (selectedMapRef.current === 'gold') {
        // Check drone count and spawn up to 3 drones max
        if (bossEscortDronesRef.current.length < 3 && Date.now() - (boss.lastSpecialAttack || 0) > 6000) {
          boss.lastSpecialAttack = Date.now();
          playExplosionSound('small');

          const orbitOffset = bossEscortDronesRef.current.length * (Math.PI * 2 / 3);
          bossEscortDronesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: boss.x + Math.cos(orbitOffset) * 120,
            y: boss.y + Math.sin(orbitOffset) * 120,
            angle: orbitOffset,
            orbitOffset,
            hp: 60, // robust hp drone shield
            maxHp: 60,
            radius: 16,
          });
          addGainNotification("🛡️ BOSS VYVOLAL DOPROVODNÉHO DRONA!", "#f59e0b");
          addCombatLogMessage("👑 Boss: Přivolán doprovodný dron jako živý štít!", "#f59e0b");
        }
      }
    }

    // Update Boss Guided Fireballs
    bossGuidedFireballsRef.current.forEach(bf => {
      // Find closest player to track
      let closestP: Player | null = null;
      let closestD = 999999;
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const d = Math.hypot(p.x - bf.x, p.y - bf.y);
          if (d < closestD) {
            closestD = d;
            closestP = p;
          }
        }
      });

      if (closestP) {
        const dx = closestP.x - bf.x;
        const dy = closestP.y - bf.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          const desiredVx = (dx / dist) * 4.2;
          const desiredVy = (dy / dist) * 4.2;
          // steer slowly
          bf.vx += (desiredVx - bf.vx) * 0.05;
          bf.vy += (desiredVy - bf.vy) * 0.05;
        }
      }

      bf.x += bf.vx;
      bf.y += bf.vy;
      bf.lifetime++;

      // Leave burning trail
      if (bf.lifetime % 3 === 0) {
        fireTrailsRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: bf.x,
          y: bf.y,
          radius: 18,
          lifetime: 0,
          maxLifetime: 140, // 2.3 seconds
        });
      }

      // Fire trail flame particles
      if (Math.random() < 0.4) {
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: bf.x + (Math.random() - 0.5) * bf.radius,
          y: bf.y + (Math.random() - 0.5) * bf.radius,
          vx: -bf.vx * 0.2 + (Math.random() - 0.5) * 0.5,
          vy: -bf.vy * 0.2 + (Math.random() - 0.5) * 0.5,
          color: '#f97316',
          size: Math.random() * 5 + 3,
          alpha: 0.9,
          lifetime: 0,
          maxLifetime: 15
        });
      }

      // Collision check with Arena Platforms
      if (isBossFightActiveRef.current && arenaPlatformsRef.current.length > 0 && bf.lifetime < bf.maxLifetime) {
        arenaPlatformsRef.current.forEach(plat => {
          const halfW = plat.width / 2;
          const halfH = plat.height / 2;
          
          const closestX = Math.max(plat.x - halfW, Math.min(bf.x, plat.x + halfW));
          const closestY = Math.max(plat.y - halfH, Math.min(bf.y, plat.y + halfH));
          const distance = Math.hypot(bf.x - closestX, bf.y - closestY);
          
          if (distance < bf.radius) {
            bf.lifetime = bf.maxLifetime; // destroy fireball
            
            // Apply damage to platform
            plat.hp -= bf.damage * 1.5; // Fireball deals massive damage to structure
            
            // Trigger explosion sparks and sounds
            playExplosionSound('medium');
            triggerCameraShake(4);
            
            // Blast particles from the platform material
            for (let i = 0; i < 15; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: closestX,
                y: closestY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                color: plat.color,
                size: Math.random() * 4 + 2,
                alpha: 1,
                lifetime: 0,
                maxLifetime: 25
              });
            }

            if (plat.hp <= 0) {
              addCombatLogMessage(`💥 ARÉNA: Plošina byla úplně rozmetána střelbou bosse!`, '#ef4444');
              playExplosionSound('large');
            } else {
              addCombatLogMessage(`⚡ ARÉNA: Plošina absorbovala zásah ohňové koule! Integrity: ${Math.round((plat.hp / plat.maxHp) * 100)}%`, plat.color);
            }
          }
        });
      }

      // Collision checks with players
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.invulnerableTime <= 0) {
          const dist = Math.hypot(p.x - bf.x, p.y - bf.y);
          if (dist < p.radius + bf.radius) {
            bf.lifetime = bf.maxLifetime; // destroy

            p.hull = Math.max(0, p.hull - bf.damage); // bypasses shields! "poškozující trup"
            p.lastHullHitTime = Date.now();
            addGainNotification(`🚨 OHŇOVÁ KOULA PROBILA ŠTÍT A ZASÁHLA TRUP! (-${bf.damage} HP)`, '#ef4444');
            addCombatLogMessage(`🚨 Ohňová koule zasáhla trup ${p.name} -${bf.damage}`, '#ef4444');
            
            playDamageSound();
            triggerCameraShake(8);

            if (p.hull <= 0) {
              handlePlayerDeath(p, 'zničen naváděnou ohnivou koulí generála');
            }
          }
        }
      });
    });
    // Clean up destroyed platforms
    if (isBossFightActiveRef.current) {
      arenaPlatformsRef.current = arenaPlatformsRef.current.filter(plat => plat.hp > 0);
    }
    bossGuidedFireballsRef.current = bossGuidedFireballsRef.current.filter(bf => bf.lifetime < bf.maxLifetime);

    // Update Fire Trails (Damaging lingering flames)
    fireTrailsRef.current.forEach(ft => {
      ft.lifetime++;

      // Flame particles rising off
      if (Math.random() < 0.15) {
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: ft.x + (Math.random() - 0.5) * ft.radius,
          y: ft.y + (Math.random() - 0.5) * ft.radius,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -Math.random() * 0.6 - 0.2, // rises slightly
          color: '#fb923c',
          size: Math.random() * 3 + 1,
          alpha: 0.6,
          lifetime: 0,
          maxLifetime: 20
        });
      }

      // Check damage to players
      playersRef.current.forEach(p => {
        if (p.hull > 0 && p.invulnerableTime <= 0) {
          const dist = Math.hypot(p.x - ft.x, p.y - ft.y);
          if (dist < p.radius + ft.radius) {
            // Take direct hull damage over time!
            if (Math.random() < 0.15) {
              p.hull = Math.max(0, p.hull - 1.5);
              p.lastHullHitTime = Date.now();
              addGainNotification(`🔥 TRUP PÁLÍ LÁVOVÁ STOPA! (-1 HP)`, '#ef4444');
              if (p.hull <= 0) {
                handlePlayerDeath(p, 'roztaven žhnoucí lávovou stopou');
              }
            }
          }
        }
      });
    });
    fireTrailsRef.current = fireTrailsRef.current.filter(ft => ft.lifetime < ft.maxLifetime);

    // Update Freezing Pulses (expanding blue rings)
    bossFreezingPulsesRef.current.forEach(fp => {
      fp.radius += fp.speed;

      // blue sparks along ring perimeter
      const step = Math.PI / 12;
      for (let i = 0; i < Math.PI * 2; i += step) {
        if (Math.random() < 0.15) {
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: fp.x + Math.cos(i) * fp.radius,
            y: fp.y + Math.sin(i) * fp.radius,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            color: '#38bdf8',
            size: Math.random() * 2.5 + 1,
            alpha: 0.6,
            lifetime: 0,
            maxLifetime: 12
          });
        }
      }

      // Check hit players on edge expand
      playersRef.current.forEach(p => {
        if (p.hull > 0 && !fp.hitPlayerIds.includes(p.id)) {
          const dist = Math.hypot(p.x - fp.x, p.y - fp.y);
          if (Math.abs(dist - fp.radius) < 22) {
            fp.hitPlayerIds.push(p.id);

            // Hit player! Freeze engines for 1 second (60 frames)
            p.frozenTimer = 60;
            p.frostLevel = 100; // instant frozen coating

            if (p.shield > 0) {
              p.shield = Math.max(0, p.shield - fp.damage);
              p.lastShieldHitTime = Date.now();
              addGainNotification(`❄️ ${p.name} - MRAZIVÝ PULS ZMRZIL MOTORY! (-${fp.damage} HP)`, '#38bdf8');
            } else {
              p.hull = Math.max(0, p.hull - fp.damage);
              p.lastHullHitTime = Date.now();
              addGainNotification(`🚨 ${p.name} - MRAZIVÝ PULS ZMRZIL TRUP! (-${fp.damage} HP)`, '#0284c7');
              if (p.hull <= 0) {
                handlePlayerDeath(p, 'zničen podchlazením z mrazivého pulsu');
              }
            }
            playDamageSound();
            triggerCameraShake(4);
          }
        }
      });
    });
    bossFreezingPulsesRef.current = bossFreezingPulsesRef.current.filter(fp => fp.radius < fp.maxRadius);

    // Update Boss Escort Drones (orbiting boss shields)
    bossEscortDronesRef.current.forEach(drone => {
      if (bossRef.current) {
        const boss = bossRef.current;
        // Circling around the boss body
        const orbitAngle = Date.now() / 900 + drone.orbitOffset;
        const targetX = boss.x + Math.cos(orbitAngle) * 125;
        const targetY = boss.y + Math.sin(orbitAngle) * 125;
        
        drone.x += (targetX - drone.x) * 0.1;
        drone.y += (targetY - drone.y) * 0.1;
        drone.angle = orbitAngle;

        // Sparkle visuals
        if (Math.random() < 0.25) {
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: drone.x,
            y: drone.y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            color: '#fbbf24',
            size: Math.random() * 3 + 1,
            alpha: 0.8,
            lifetime: 0,
            maxLifetime: 15
          });
        }
      } else {
        drone.hp = 0; // destroy if boss is dead
      }

      // Check intercepting player lasers!
      lasersRef.current.forEach(l => {
        if (l.lifetime < l.maxLifetime) {
          const ldist = Math.hypot(l.x - drone.x, l.y - drone.y);
          if (ldist < l.radius + drone.radius) {
            l.lifetime = l.maxLifetime; // absorb laser!
            drone.hp -= l.damage; // take damage
            
            // splash sparks
            for (let i = 0; i < 5; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: l.x,
                y: l.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                color: '#fbbf24',
                size: Math.random() * 4 + 1.5,
                alpha: 0.9,
                lifetime: 0,
                maxLifetime: 15
              });
            }
            playDamageSound();
          }
        }
      });
    });
    // Check blowup of escort drones
    bossEscortDronesRef.current.forEach(drone => {
      if (drone.hp <= 0) {
        playExplosionSound('medium');
        // Spawn some crystals as a reward!
        const ore = createOreEntity(drone.x, drone.y, 'crystal');
        oresRef.current.push(ore);
        
        // heavy golden explode particles
        for (let i = 0; i < 18; i++) {
          const pAng = Math.random() * Math.PI * 2;
          const pSpd = Math.random() * 5 + 2;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: drone.x,
            y: drone.y,
            vx: Math.cos(pAng) * pSpd,
            vy: Math.sin(pAng) * pSpd,
            color: '#fbbf24',
            size: Math.random() * 5 + 2,
            alpha: 1.0,
            lifetime: 0,
            maxLifetime: 30
          });
        }
        addGainNotification("+1 Krystal od dronu", "#fbbf24");
      }
    });
    bossEscortDronesRef.current = bossEscortDronesRef.current.filter(drone => drone.hp > 0);

    // Update player toxic exhaust trail bubbles damage to pirates and boss
    playerTrailBubblesRef.current.forEach(tb => {
      tb.lifetime++;

      // toxic particles fading
      if (Math.random() < 0.15) {
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: tb.x + (Math.random() - 0.5) * tb.radius,
          y: tb.y + (Math.random() - 0.5) * tb.radius,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          color: tb.color,
          size: Math.random() * 3.5 + 1.5,
          alpha: 0.5,
          lifetime: 0,
          maxLifetime: 18
        });
      }

      // Deal damage to standard pirates overlapping
      piratesRef.current.forEach(pirate => {
        const dist = Math.hypot(pirate.x - tb.x, pirate.y - tb.y);
        if (dist < pirate.radius + tb.radius) {
          pirate.hp -= tb.damage; // burn pirate health!
          // spawn small fiery hits
          if (Math.random() < 0.1) {
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: pirate.x,
              y: pirate.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              color: '#ea580c',
              size: 2,
              alpha: 0.9,
              lifetime: 0,
              maxLifetime: 10
            });
          }
        }
      });

      // Deal damage to boss overlapping
      if (isBossFightActiveRef.current && bossRef.current) {
        const boss = bossRef.current;
        const dist = Math.hypot(boss.x - tb.x, boss.y - tb.y);
        if (dist < boss.radius + tb.radius) {
          // Boss has high armor, take slightly reduced damage
          boss.hp -= tb.damage * 0.45;
          boss.lastDamageTime = Date.now();
        }
      }
    });
    playerTrailBubblesRef.current = playerTrailBubblesRef.current.filter(tb => tb.lifetime < tb.maxLifetime);

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

    if (sockCooldownRef.current > 0) {
      sockCooldownRef.current--;
      if (sockCooldownRef.current % 15 === 0) {
        setSockCooldown(Math.ceil(sockCooldownRef.current / 60));
      }
    } else {
      setSockCooldown(0);
    }

    // --- 6. LASER FLIGHT & BOUNDS ---
    lasersRef.current = lasersRef.current.map(laser => {
      laser.x += laser.vx;
      laser.y += laser.vy;
      laser.lifetime++;

      // Minecraft style burning particles trail
      if (laser.isHeated) {
        particlesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: laser.x - laser.vx * 0.4 + (Math.random() - 0.5) * 4,
          y: laser.y - laser.vy * 0.4 + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          color: Math.random() < 0.6 ? '#f97316' : '#ef4444', // Orange/red flickering flame
          size: Math.random() * 3.5 + 2,
          alpha: 1.0,
          lifetime: 0,
          maxLifetime: 15,
        });
      }
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

    // Salvage Magnet (Sběrač trosek) combo synergy
    if (upgradesRef.current.salvageMagnetLevel > 0) {
      const comboMult = comboMultiplierRef.current || 1;
      magnetRadius += upgradesRef.current.salvageMagnetLevel * comboMult * 18;
      magnetPullStrength += upgradesRef.current.salvageMagnetLevel * comboMult * 0.04;
    }

    // Apply prestige bonus multiplier
    const prestigeBonusMultiplier = 1 + (statsRef.current.prestigeCount || 0) * 0.15;
    magnetRadius *= prestigeBonusMultiplier;
    magnetPullStrength *= prestigeBonusMultiplier;

    // Donkey Keeper Super Magnet active capability overwrite
    if (superMagnetActiveRef.current > 0) {
      const lvl = upgradesRef.current.abilitySuperMagnetLevel;
      magnetRadius = 99999;
      magnetPullStrength = lvl === 3 ? 12.0 : lvl === 2 ? 6.0 : 3.5;
    }

    // EM Storm temporarily disables the magnet
    if (emStormActiveRef.current) {
      magnetRadius = 0;
      magnetPullStrength = 0;
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

        let awardLabel = `${pName}: +3 Krystaly`;
        let scoreAdded = 0;

        const multiplier = getScoreMultiplierFromRef();
        if (ore.type === 'crystal') {
          setRunCrystals(c => c + 3);
          advanceMissionProgress('mine_crystal', 3);
          scoreAdded = Math.round(150 * multiplier);
          setStats(curr => {
            const nextStats = { ...curr, crystals: curr.crystals + 3 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +3 Krystaly (+${scoreAdded} skóre)`;
        } else if (ore.type === 'diamond') {
          setRunDiamonds(d => d + 2);
          advanceMissionProgress('mine_diamond', 2);
          scoreAdded = Math.round(5000 * multiplier);
          setStats(curr => {
            const nextStats = { ...curr, diamonds: curr.diamonds + 2 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +2 Diamanty (+${scoreAdded} skóre!)`;
        } else if (ore.type === 'obsidian') {
          setRunObsidian(o => o + 2);
          advanceMissionProgress('mine_obsidian', 2);
          scoreAdded = Math.round(16000 * multiplier);
          setStats(curr => {
            const nextStats = { ...curr, obsidian: curr.obsidian + 2 };
            saveStats(nextStats);
            return nextStats;
          });
          awardLabel = `${pName}: +2 Obsidiány (+${scoreAdded} skóre!)`;
        } else if (ore.type as string === 'cargo') {
          scoreAdded = Math.round(55000 * multiplier);
          
          const crCount = 15 + Math.floor(Math.random() * 11);
          const diCount = 6 + Math.floor(Math.random() * 7);
          const obCount = 3 + Math.floor(Math.random() * 5);
          
          setRunCrystals(c => c + crCount);
          setRunDiamonds(d => d + diCount);
          setRunObsidian(o => o + obCount);
          
          setStats(curr => {
            const nextStats = {
              ...curr,
              crystals: curr.crystals + crCount,
              diamonds: curr.diamonds + diCount,
              obsidian: curr.obsidian + obCount
            };
            saveStats(nextStats);
            return nextStats;
          });
          
          awardLabel = `🎁 CARGO: +${crCount}💎 +${diCount}💠 +${obCount}🪨 (+${scoreAdded} skóre!)`;
          addCombatLogMessage(`🎁 ${pName} otevřel ztracený cargo kontejner! Nalezeno: ${crCount} krystalů, ${diCount} diamantů, ${obCount} obsidiánů!`, '#facc15');
          triggerCameraShake(4);
        }

        if (scoreAdded > 0) {
          const prestigeMultiplier = 1 + (statsRef.current.prestigeCount || 0) * 0.15;
          const finalScoreAdded = Math.round(scoreAdded * prestigeMultiplier);
          if (statsRef.current.prestigeCount && statsRef.current.prestigeCount > 0) {
            awardLabel = awardLabel.replace(`+${scoreAdded} skóre`, `+${finalScoreAdded} skóre`);
          }
          const newScore = scoreRef.current + finalScoreAdded;
          scoreRef.current = newScore;
          setCurrentScore(newScore);
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

      // Rain down with materials trailing in their wake!
      const shedChance = asteroid.asteroidType === 'gold-rush' ? 0.012 : 0.0015;
      if (Math.random() < shedChance) {
        // Choose ore type based on asteroid type
        let oType: OreType = 'crystal';
        if (asteroid.asteroidType === 'gold-rush') {
          oType = Math.random() < 0.6 ? 'diamond' : 'obsidian';
        } else if (asteroid.asteroidType === 'crystal') {
          oType = 'crystal';
        } else if (asteroid.asteroidType === 'ice') {
          oType = Math.random() < 0.35 ? 'diamond' : 'crystal';
        } else if (asteroid.asteroidType === 'magma') {
          oType = Math.random() < 0.35 ? 'obsidian' : 'crystal';
        } else {
          // common
          oType = Math.random() < 0.1 ? 'diamond' : 'crystal';
        }

        // Spawn trailing slightly behind
        const angleBehind = Math.atan2(asteroid.vy, asteroid.vx) + Math.PI + (Math.random() * 0.5 - 0.25);
        const spawnX = asteroid.x + Math.cos(angleBehind) * (asteroid.radius + 15);
        const spawnY = asteroid.y + Math.sin(angleBehind) * (asteroid.radius + 15);
        
        // Spawn with slight opposite momentum
        const rawOre = createOreEntity(spawnX, spawnY, oType);
        rawOre.vx = -asteroid.vx * 0.4 + (Math.random() * 0.6 - 0.3);
        rawOre.vy = -asteroid.vy * 0.4 + (Math.random() * 0.6 - 0.3);
        oresRef.current.push(rawOre);
      }

      // Wrap around anchor location of the first alive player
      const anchorPlayer = playersRef.current.find(pl => pl.hull > 0) || playersRef.current[0];
      if (anchorPlayer) {
        const pX = anchorPlayer.x;
        const pY = anchorPlayer.y;
        const adx = asteroid.x - pX;
        const ady = asteroid.y - pY;
        const distanceToPlayer = Math.sqrt(adx * adx + ady * ady);

        // Dynamically calculate screen boundary to prevent asteroids from wrapping while visible
        const screenDiag = Math.max(1600, Math.hypot(width, height));
        const wrapDistanceThreshold = screenDiag / 2 + asteroid.radius + 350;

        if (distanceToPlayer > wrapDistanceThreshold) {
          const angleOffset = anchorPlayer.vx || anchorPlayer.vy 
            ? Math.atan2(anchorPlayer.vy, anchorPlayer.vx) + (Math.random() * 1.5 - 0.75)
            : Math.random() * Math.PI * 2;
          
          const spawnDistance = wrapDistanceThreshold - 150;
          asteroid.x = pX + Math.cos(angleOffset) * spawnDistance;
          asteroid.y = pY + Math.sin(angleOffset) * spawnDistance;
          
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

    // Check laser hit arena platform
    if (isBossFightActiveRef.current && arenaPlatformsRef.current.length > 0) {
      lasersRef.current.forEach(laser => {
        if (laser.lifetime >= laser.maxLifetime) return;
        arenaPlatformsRef.current.forEach(plat => {
          const halfW = plat.width / 2;
          const halfH = plat.height / 2;
          if (
            laser.x >= plat.x - halfW &&
            laser.x <= plat.x + halfW &&
            laser.y >= plat.y - halfH &&
            laser.y <= plat.y + halfH
          ) {
            laser.lifetime = laser.maxLifetime; // absorb laser
            // Spawn spark particles of platform color
            for (let i = 0; i < 4; i++) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: laser.x,
                y: laser.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: plat.color,
                size: Math.random() * 2 + 1,
                alpha: 1,
                lifetime: 0,
                maxLifetime: 15
              });
            }
          }
        });
      });
    }

    lasersRef.current = lasersRef.current.filter(l => l.lifetime < l.maxLifetime);

    // --- STINKY SOCK UPDATE, COLLISION & CLOUD DOT ---
    socksRef.current = socksRef.current.map(sock => {
      if (!sock.cloudActive) {
        // Flying sock projectile
        sock.x += sock.vx;
        sock.y += sock.vy;
        sock.lifetime++;

        // Spawn trailing stinky gas particles
        if (Math.random() < 0.35) {
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: sock.x,
            y: sock.y,
            vx: (Math.random() - 0.5) * 2.0,
            vy: (Math.random() - 0.5) * 2.0,
            color: Math.random() < 0.5 ? '#84cc16' : '#a3e635',
            size: Math.random() * 5 + 2,
            alpha: 0.8,
            lifetime: 0,
            maxLifetime: 40,
          });
        }

        // Check if sock hit anything
        let triggerBurst = false;

        // Check asteroid collision
        asteroidsRef.current.forEach(ast => {
          if (triggerBurst) return;
          const dx = sock.x - ast.x;
          const dy = sock.y - ast.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.radius + ast.radius) {
            ast.hp -= sock.damage;
            if (ast.hp <= 0) {
              handleAsteroidBlowUp(ast);
            }
            triggerBurst = true;
          }
        });

        // Check pirate collision
        piratesRef.current.forEach(pirate => {
          if (triggerBurst) return;
          const dx = sock.x - pirate.x;
          const dy = sock.y - pirate.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.radius + pirate.radius) {
            pirate.hp -= sock.damage;
            triggerBurst = true;
          }
        });

        // Check Boss collision
        if (bossRef.current && !triggerBurst) {
          const boss = bossRef.current;
          const dx = sock.x - boss.x;
          const dy = sock.y - boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.radius + boss.radius) {
            const sockHitsMultiplier = 3 + (upgradesRef.current.abilitySockLevel || 0) * 2;
            damageBossWithHitCount(sock.x, sock.y, sockHitsMultiplier);
            triggerBurst = true;
          }
        }

        if (sock.lifetime >= sock.maxLifetime) {
          triggerBurst = true;
        }

        if (triggerBurst) {
          sock.cloudActive = true;
          sock.lifetime = 0; // reset to track cloud lifetime
          
          // Level 3 Sock splits into 3 sub-socks flying outwards!
          if (sock.level === 3) {
            const splitSpeed = 6.5;
            for (let i = 0; i < 3; i++) {
              const theta = sock.angle + (i * Math.PI * 2 / 3);
              socksRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: sock.x,
                y: sock.y,
                vx: Math.cos(theta) * splitSpeed,
                vy: Math.sin(theta) * splitSpeed,
                angle: theta,
                radius: 12,
                damage: 10,
                lifetime: 0,
                maxLifetime: 60, // shorter flight
                cloudActive: false,
                cloudRadius: 50,
                cloudDuration: 3 * 60,
                cloudDmgPerFrame: 0.5,
                level: 1, // won't split again
              });
            }
          }
        }
      } else {
        // Gaseous cloud state
        sock.lifetime++;

        // Spawn cloud bubble particles
        if (Math.random() < 0.45) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * sock.cloudRadius;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x: sock.x + Math.cos(angle) * radius,
            y: sock.y + Math.sin(angle) * radius,
            vx: (Math.random() - 0.5) * 0.9,
            vy: (Math.random() - 0.5) * 0.9,
            color: Math.random() < 0.7 ? '#84cc16' : '#eab308', // green/yellow
            size: Math.random() * 10 + 4,
            alpha: 0.6,
            lifetime: 0,
            maxLifetime: 60,
          });
        }

        // Apply Damage-over-time (DOT) & slowing effect
        asteroidsRef.current.forEach(ast => {
          const dx = ast.x - sock.x;
          const dy = ast.y - sock.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.cloudRadius) {
            ast.hp -= sock.cloudDmgPerFrame;
            ast.vx *= 0.93; // Thick slowing gas
            ast.vy *= 0.93;
            if (ast.hp <= 0) {
              setTimeout(() => {
                const alive = asteroidsRef.current.some(a => a.id === ast.id);
                if (alive) handleAsteroidBlowUp(ast);
              }, 40);
            }
          }
        });

        piratesRef.current.forEach(pirate => {
          const dx = pirate.x - sock.x;
          const dy = pirate.y - sock.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.cloudRadius) {
            pirate.hp -= sock.cloudDmgPerFrame;
            pirate.vx *= 0.91; // Slow down pirate
            pirate.vy *= 0.91;
          }
        });

        if (bossRef.current) {
          const boss = bossRef.current;
          const dx = boss.x - sock.x;
          const dy = boss.y - sock.y;
          const dist = Math.hypot(dx, dy);
          if (dist < sock.cloudRadius) {
            // Count 10% of cloud DOT frames as armor hits
            if (Math.random() < 0.10) {
              const cloudHitsMultiplier = 1 + (upgradesRef.current.abilitySockLevel || 0) * 0.5;
              damageBossWithHitCount(boss.x + (Math.random() - 0.5) * 40, boss.y + (Math.random() - 0.5) * 40, cloudHitsMultiplier);
            }
            boss.vx *= 0.96;
            boss.vy *= 0.96;
          }
        }
      }
      return sock;
    }).filter(sock => !(sock.cloudActive && sock.lifetime >= sock.cloudDuration));

    // --- UPDATE AUTOMATIC MINING DRONES ---
    const dronesNeeded = upgradesRef.current.miningDronesLevel || 0;
    if (dronesRef.current.length < dronesNeeded) {
      const livingPlayer = playersRef.current.find(p => p.hull > 0);
      const px = livingPlayer ? livingPlayer.x : 0;
      const py = livingPlayer ? livingPlayer.y : 0;
      while (dronesRef.current.length < dronesNeeded) {
        dronesRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x: px + (Math.random() - 0.5) * 120,
          y: py + (Math.random() - 0.5) * 120,
          vx: 0,
          vy: 0,
          angle: Math.random() * Math.PI * 2,
          targetX: px,
          targetY: py,
          laserBeamActive: false,
          laserTargetX: 0,
          laserTargetY: 0,
          laserTargetAsteroidId: undefined,
          miningTimer: 0,
          idlingOffsetAngle: dronesRef.current.length * (Math.PI * 2 / 3) + Math.random() * 0.5,
        });
      }
    } else if (dronesRef.current.length > dronesNeeded) {
      dronesRef.current = dronesRef.current.slice(0, dronesNeeded);
    }

    const currentLivingPlayerForDrones = playersRef.current.find(p => p.hull > 0);
    if (currentLivingPlayerForDrones && dronesNeeded > 0) {
      const px = currentLivingPlayerForDrones.x;
      const py = currentLivingPlayerForDrones.y;

      dronesRef.current.forEach(drone => {
        // Find nearest floating ore
        let nearestOre: Ore | null = null;
        let minOreDist = 999999;
        const searchRadius = dronesNeeded === 3 ? 650 : dronesNeeded === 2 ? 450 : 350;

        oresRef.current.forEach(ore => {
          const d = Math.hypot(ore.x - drone.x, ore.y - drone.y);
          if (d < minOreDist && d < searchRadius) {
            minOreDist = d;
            nearestOre = ore;
          }
        });

        if (nearestOre) {
          // 1. Move to and collect floating ore
          const targetOre = nearestOre as Ore;
          const dx = targetOre.x - drone.x;
          const dy = targetOre.y - drone.y;
          const dist = Math.hypot(dx, dy);
          
          const droneMaxSpeed = dronesNeeded === 3 ? 9.0 : 6.0;
          const force = 0.5;
          
          drone.vx += (dx / Math.max(1, dist)) * force;
          drone.vy += (dy / Math.max(1, dist)) * force;
          
          const speed = Math.hypot(drone.vx, drone.vy);
          if (speed > droneMaxSpeed) {
            drone.vx = (drone.vx / speed) * droneMaxSpeed;
            drone.vy = (drone.vy / speed) * droneMaxSpeed;
          }

          drone.x += drone.vx;
          drone.y += drone.vy;
          drone.angle = Math.atan2(drone.vy, drone.vx);
          drone.laserBeamActive = false;

          // Collect ore if close enough
          if (dist < 30) {
            playCollectSound(targetOre.type);
            triggerOreSparkExplosion(targetOre.x, targetOre.y, targetOre.color);
            
            let awardLabel = `🤖 Dron: +3 Krystaly`;
            let scoreAdded = 0;

            const multiplier = getScoreMultiplierFromRef();
            if (targetOre.type === 'crystal') {
              setRunCrystals(c => c + 3);
              scoreAdded = Math.round(150 * multiplier);
              setStats(curr => {
                const nextStats = { ...curr, crystals: curr.crystals + 3 };
                saveStats(nextStats);
                return nextStats;
              });
              awardLabel = `🤖 Dron: +3 Krystaly (+${scoreAdded} skóre)`;
            } else if (targetOre.type === 'diamond') {
              setRunDiamonds(d => d + 2);
              scoreAdded = Math.round(5000 * multiplier);
              setStats(curr => {
                const nextStats = { ...curr, diamonds: curr.diamonds + 2 };
                saveStats(nextStats);
                return nextStats;
              });
              awardLabel = `🤖 Dron: +2 Diamanty (+${scoreAdded} skóre!)`;
            } else if (targetOre.type === 'obsidian') {
              setRunObsidian(o => o + 2);
              scoreAdded = Math.round(16000 * multiplier);
              setStats(curr => {
                const nextStats = { ...curr, obsidian: curr.obsidian + 2 };
                saveStats(nextStats);
                return nextStats;
              });
              awardLabel = `🤖 Dron: +2 Obsidiány (+${scoreAdded} skóre!)`;
            }

            if (scoreAdded > 0) {
              const newScore = scoreRef.current + scoreAdded;
              scoreRef.current = newScore;
              setCurrentScore(newScore);
            }

            addGainNotification(awardLabel, targetOre.color);
            oresRef.current = oresRef.current.filter(o => o.id !== targetOre.id);
          }
        } else {
          // 2. No ore nearby. Try mining nearest asteroid (Level 2+)
          let nearestAsteroid: Asteroid | null = null;
          let minAstDist = 999999;
          const mineRadius = dronesNeeded === 3 ? 350 : 250;

          if (dronesNeeded >= 2) {
            asteroidsRef.current.forEach(ast => {
              const d = Math.hypot(ast.x - drone.x, ast.y - drone.y);
              if (d < minAstDist && d < mineRadius) {
                minAstDist = d;
                nearestAsteroid = ast;
              }
            });
          }

          if (nearestAsteroid) {
            const targetAst = nearestAsteroid as Asteroid;
            const dx = targetAst.x - drone.x;
            const dy = targetAst.y - drone.y;
            const dist = Math.hypot(dx, dy);

            // Maintain distance around 110px from asteroid
            const idealDist = 110;
            const diff = dist - idealDist;
            const steerX = (dx / dist) * diff;
            const steerY = (dy / dist) * diff;

            drone.vx += steerX * 0.04;
            drone.vy += steerY * 0.04;
            drone.vx *= 0.92;
            drone.vy *= 0.92;

            drone.x += drone.vx;
            drone.y += drone.vy;

            drone.angle = Math.atan2(dy, dx);
            drone.laserBeamActive = true;
            drone.laserTargetX = targetAst.x;
            drone.laserTargetY = targetAst.y;
            drone.laserTargetAsteroidId = targetAst.id;

            drone.miningTimer++;
            const interval = dronesNeeded === 3 ? 40 : 60;
            const chance = dronesNeeded === 3 ? 0.45 : 0.30;

            if (drone.miningTimer >= interval) {
              drone.miningTimer = 0;
              if (Math.random() < chance) {
                const newOre = createOreEntity(targetAst.x, targetAst.y, 'crystal', true);
                oresRef.current.push(newOre);

                targetAst.hp -= 1.5;
                if (targetAst.hp <= 0) {
                  handleAsteroidBlowUp(targetAst);
                }

                // Green mining spark effect
                for (let i = 0; i < 4; i++) {
                  particlesRef.current.push({
                    id: Math.random().toString(36).substring(2, 9),
                    x: targetAst.x,
                    y: targetAst.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    color: '#10b981',
                    size: Math.random() * 4 + 2,
                    alpha: 0.8,
                    lifetime: 0,
                    maxLifetime: 30,
                  });
                }
              }
            }
          } else {
            // 3. IDLE: Orbit the living player ship
            drone.idlingOffsetAngle += 0.02;
            const orbitRadius = 80 + (drone.idlingOffsetAngle % 3) * 12;
            const targetX = px + Math.cos(drone.idlingOffsetAngle) * orbitRadius;
            const targetY = py + Math.sin(drone.idlingOffsetAngle) * orbitRadius;

            const dx = targetX - drone.x;
            const dy = targetY - drone.y;
            const dist = Math.hypot(dx, dy);

            const force = 0.35;
            drone.vx += (dx / Math.max(1, dist)) * force;
            drone.vy += (dy / Math.max(1, dist)) * force;

            drone.vx *= 0.88;
            drone.vy *= 0.88;

            drone.x += drone.vx;
            drone.y += drone.vy;
            drone.angle = Math.atan2(drone.vy, drone.vx);
            drone.laserBeamActive = false;
          }
        }
      });
    } else {
      // Clear if no living player or no level
      dronesRef.current = [];
      carrierRepairDronesRef.current = [];
    }

    // --- AUTOMATED CARRIER REPAIR DRONES FOR CAPITAL SHIP ---
    if (capitalShipModeRef.current && capitalShipRef.current && (upgradesRef.current.carrierRepairDronesLevel || 0) > 0) {
      const ship = capitalShipRef.current;
      const dronesNeeded = upgradesRef.current.carrierRepairDronesLevel || 0;

      // Trigger condition: hull is below 50%
      if (ship.hull < ship.maxHull * 0.5) {
        if (!(ship as any).repairDronesActive) {
          (ship as any).repairDronesActive = true;
          addGainNotification(`⚠️ INŽENÝR: Detekováno kritické poškození (<50%)! Spouštím opravné drony!`, '#eab308');
        }
      }
      
      // Deactivate condition: hull reaches 100%
      if (ship.hull >= ship.maxHull) {
        if ((ship as any).repairDronesActive) {
          (ship as any).repairDronesActive = false;
          addGainNotification(`✅ INŽENÝR: Opravy dokončeny. Opravné drony se vracejí do hangáru.`, '#10b981');
        }
      }

      if ((ship as any).repairDronesActive) {
        // Instantiate drones if list is smaller
        if (carrierRepairDronesRef.current.length < dronesNeeded) {
          while (carrierRepairDronesRef.current.length < dronesNeeded) {
            carrierRepairDronesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: ship.x + (Math.random() - 0.5) * 120,
              y: ship.y + (Math.random() - 0.5) * 120,
              vx: 0,
              vy: 0,
              angle: Math.random() * Math.PI * 2,
              orbitOffset: carrierRepairDronesRef.current.length * (Math.PI * 2 / 3),
              repairBeamActive: false,
            });
          }
        } else if (carrierRepairDronesRef.current.length > dronesNeeded) {
          carrierRepairDronesRef.current = carrierRepairDronesRef.current.slice(0, dronesNeeded);
        }

        // Update drones physics
        carrierRepairDronesRef.current.forEach((drone, index) => {
          // They orbit the Capital Ship smoothly
          drone.orbitOffset += 0.025;
          const distFromShip = 90 + index * 20;
          const targetX = ship.x + Math.cos(drone.orbitOffset) * distFromShip;
          const targetY = ship.y + Math.sin(drone.orbitOffset) * distFromShip;

          const dx = targetX - drone.x;
          const dy = targetY - drone.y;
          const dist = Math.hypot(dx, dy);

          const force = 0.35;
          drone.vx += (dx / Math.max(1, dist)) * force;
          drone.vy += (dy / Math.max(1, dist)) * force;
          drone.vx *= 0.88;
          drone.vy *= 0.88;

          drone.x += drone.vx;
          drone.y += drone.vy;
          drone.angle = Math.atan2(ship.y - drone.y, ship.x - drone.x); // face the Capital Ship
          
          // Healing beam active
          drone.repairBeamActive = true;
          
          // Repair value per frame per drone
          const healAmount = 0.04 * dronesNeeded;
          ship.hull = Math.min(ship.maxHull, ship.hull + healAmount);

          // Update state so HUD gets the value
          if (index === 0) {
            setHull(Math.round(ship.hull));
          }

          // Spawn healing green particles flowing from drone to the Capital Ship!
          if (Math.random() < 0.2) {
            const beamT = Math.random();
            const px = drone.x + (ship.x - drone.x) * beamT + (Math.random() - 0.5) * 10;
            const py = drone.y + (ship.y - drone.y) * beamT + (Math.random() - 0.5) * 10;
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: px,
              y: py,
              vx: (Math.random() - 0.5) * 0.4,
              vy: (Math.random() - 0.5) * 0.4,
              color: '#4ade80', // vibrant green
              size: Math.random() * 2 + 1,
              alpha: 0.8,
              lifetime: 0,
              maxLifetime: 20,
            });
          }
        });
      } else {
        // Return to hangar smoothly
        if (carrierRepairDronesRef.current.length > 0) {
          let allInside = true;
          carrierRepairDronesRef.current.forEach(drone => {
            const dx = ship.x - drone.x;
            const dy = ship.y - drone.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 15) {
              allInside = false;
              const force = 0.5;
              drone.vx += (dx / Math.max(1, dist)) * force;
              drone.vy += (dy / Math.max(1, dist)) * force;
              drone.vx *= 0.85;
              drone.vy *= 0.85;
              drone.x += drone.vx;
              drone.y += drone.vy;
              drone.angle = Math.atan2(drone.vy, drone.vx);
              drone.repairBeamActive = false;
            }
          });
          if (allInside) {
            carrierRepairDronesRef.current = [];
          }
        }
      }
    } else {
      carrierRepairDronesRef.current = [];
    }

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
            if (asteroid.size === 'colossal') rawDmg = 55;
            else if (asteroid.size === 'huge') rawDmg = 38;
            else if (asteroid.size === 'large') rawDmg = 24;
            else if (asteroid.size === 'medium') rawDmg = 14;

            const diffSettings = getDifficultySettings(difficultyRef.current);
            const difficultyMultiplier = diffSettings.damageTakenMultiplier;

            const armorMultiplier = Math.max(0.65, 1.0 - (upgradesRef.current.hullLevel - 1) * 0.08);
            const calculatedDmg = Math.round(rawDmg * armorMultiplier * difficultyMultiplier);

            playDamageSound();
            triggerCameraShake(Math.min(18, Math.max(5, calculatedDmg * 0.35)));

            let finalDmgToHull = calculatedDmg;

            if (p.shield > 0) {
              p.lastShieldHitTime = Date.now();
              if (p.shield >= calculatedDmg) {
                p.shield -= calculatedDmg;
                finalDmgToHull = 0;
                addGainNotification(`${p.name}: ŠTÍT ABS. -${calculatedDmg} HP`, '#38bdf8');
                addCombatLogMessage(`🛡️ ${p.name}: Štít pohltil náraz -${calculatedDmg} HP`, '#38bdf8');
              } else {
                finalDmgToHull = calculatedDmg - p.shield;
                p.shield = 0;
                addGainNotification(`${p.name}: ŠTÍT ZNIČEN!`, '#ef4444');
                addCombatLogMessage(`💥 ${p.name}: Štít se přetížil nárazem! Trup poškozen -${finalDmgToHull} HP`, '#ef4444');
                playShieldDownSound();
              }
            }

            if (finalDmgToHull > 0) {
              p.hull = Math.max(0, p.hull - finalDmgToHull);
              p.lastHullHitTime = Date.now();
              addGainNotification(`${p.name}: POŠKOZENO -${finalDmgToHull} HP`, '#f97316');
              addCombatLogMessage(`💥 ${p.name}: Kinetická kolize s asteroidem -${finalDmgToHull} HP`, '#f97316');

              if (p.hull <= 0) {
                // Check if any other player is still alive
                const anyoneAlive = playersRef.current.some(pl => pl.hull > 0);
                if (!anyoneAlive) {
                   addCombatLogMessage(`☠️ Hlášení: Všechny lodě byly zničeny!`, '#ef4444');
                   triggerShipCatastrophicFailure();
                } else {
                   addGainNotification(`HLÁŠENÍ: ${p.name} byl ZNIČEN! Braňte pozice!`, '#ef4444');
                   addCombatLogMessage(`💀 Hlášení: ${p.name} byl zničen v kolizi!`, '#ef4444');
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

    if (lowPerformanceModeRef.current && particlesRef.current.length > 50) {
      particlesRef.current = particlesRef.current.slice(-50);
    }

    // --- PLAYER LASERS VS BOSS COLLISION ---
    if (isBossFightActiveRef.current && bossRef.current) {
      const boss = bossRef.current;
      lasersRef.current.forEach(laser => {
        if (laser.lifetime >= laser.maxLifetime) return;

        const ldx = laser.x - boss.x;
        const ldy = laser.y - boss.y;
        const distSq = ldx * ldx + ldy * ldy;
        const hitRad = laser.radius + boss.radius;

        if (distSq < hitRad * hitRad) {
          let hitsMultiplier = 1.5 + ((upgradesRef.current.laserLevel || 1) - 1) * 2.5;
          if (laser.color === '#fbbf24') {
            const carrierWeaponDmgLvl = upgradesRef.current.carrierWeaponDamageLevel || 1;
            hitsMultiplier = 3.5 + (carrierWeaponDmgLvl - 1) * 3.5;
          }
          damageBossWithHitCount(laser.x, laser.y, hitsMultiplier);
          
          if (!laser.isPiercing) {
            laser.lifetime = laser.maxLifetime; // destroy standard laser on impact
          }

          // Spark particles
          for (let i = 0; i < 4; i++) {
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: laser.x,
              y: laser.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              color: '#22d3ee', // glowing cyan sparks
              size: Math.random() * 2.5 + 1.2,
              alpha: 0.8,
              lifetime: 0,
              maxLifetime: 25,
            });
          }

          playExplosionSound('small');
        }
      });
    }

    // --- COSMIC WORMHOLE UPDATE & PROGRESSION ---
    if (wormholeRef.current && wormholeRef.current.isReturn) {
      const wormhole = wormholeRef.current;
      wormhole.angle += 0.02; // Rotate
      wormhole.pulseScale = 1.0 + Math.sin(Date.now() / 150) * 0.07;

      // Check if any player enters the return wormhole
      playersRef.current.forEach(p => {
        if (p.hull > 0) {
          const dx = p.x - wormhole.x;
          const dy = p.y - wormhole.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 65) {
            // Open the interactive supply decision modal!
            wormholeRef.current = null;
            setIsDecisionOpen(true);
            isDecisionOpenRef.current = true;
            playUpgradeSound();
          }
        }
      });
    } else if (!isBossFightActiveRef.current && scoreRef.current >= 8000) {
      const livingPlayer = playersRef.current.find(p => p.hull > 0) || playersRef.current[0];
      if (livingPlayer) {
        if (!wormholeRef.current) {
          wormholeRef.current = {
            x: livingPlayer.x,
            y: livingPlayer.y - 750, // Spawns 750px ahead
            radius: 75,
            angle: 0,
            pulseScale: 1.0,
            soundPlayed: false,
          };
          addGainNotification("🌀 ALARM: DETEKOVÁNA KOSMICKÁ ČERVÍ DÍRA!", "#a855f7");
          addGainNotification("Vleťte do portálu pro hyper-skok k Generálovi!", "#c084fc");
        } else {
          const wormhole = wormholeRef.current;
          wormhole.angle += 0.02; // Rotate
          wormhole.pulseScale = 1.0 + Math.sin(Date.now() / 150) * 0.07;

          // Check if any player enters the wormhole
          playersRef.current.forEach(p => {
            if (p.hull > 0) {
              const dx = p.x - wormhole.x;
              const dy = p.y - wormhole.y;
              const dist = Math.hypot(dx, dy);

              if (dist < 65) {
                // Warp teleport!
                playUpgradeSound();

                // Clear wormhole and initiate Boss fight!
                wormholeRef.current = null;
                
                isBossFightActiveRef.current = true;
                setIsBossFightActive(true);
                
                // Open Upgrade Shop right when entering via portal so they can buy!
                setIsShopOpen(true);
                isShopOpenRef.current = true;

                // Spawn protective asteroid coverage
                populateAsteroidBelt(4);

                let bossMaxHp = 1000; // Exact 1000 HP as requested ("tisíc životů")
                setBossHp(1000);
                setBossMaxHp(1000);
                setBossLives(6);
                setBossMaxLives(6);

                // Move boss in front of player
                bossRef.current = {
                  x: p.x,
                  y: p.y - 400,
                  vx: 0,
                  vy: 0,
                  angle: -Math.PI / 2,
                  hp: bossMaxHp,
                  maxHp: bossMaxHp,
                  radius: 90,
                  state: 'intro',
                  lastFired: 0,
                  lastShieldFired: 0,
                  lastValuableMove: Date.now() + 4000, // Trigger first valuable move 4s after start
                  lives: 6,
                  maxLives: 6,
                  healVisualTimer: 0,
                  hitCount: 0,
                };

                // Big teleportation spark cloud
                for (let i = 0; i < 120; i++) {
                  const ang = Math.random() * Math.PI * 2;
                  const speed = Math.random() * 11 + 3;
                  particlesRef.current.push({
                    id: Math.random().toString(36).substring(2, 9),
                    x: p.x,
                    y: p.y,
                    vx: Math.cos(ang) * speed,
                    vy: Math.sin(ang) * speed,
                    color: Math.random() < 0.5 ? '#c084fc' : '#22d3ee',
                    size: Math.random() * 4 + 1.5,
                    alpha: 1.0,
                    lifetime: 0,
                    maxLifetime: 70
                  });
                }

                addGainNotification("🌀 HYPER-SKOK SKRZE ČERVÍ DÍRU SE USPĚŠNĚ ZDAŘIL!", "#a855f7");
                addGainNotification("⚠️ VYSTUPUJETE V ARÉNĚ GENERÁLA KORZÁRŮ!", "#ef4444");
              }
            }
          });
        }
      }
    }

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

    if (isBossFightActiveRef.current && bossRef.current) {
      const boss = bossRef.current;
      combined.push({
        id: 'boss',
        x: boss.x,
        y: boss.y,
        hp: boss.hp,
        color: '#f43f5e',
        isPirate: true,
        ref: boss
      });
    }

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
      if (target.id === 'boss') {
        const hitsCount = 5 + lvl * 4; // Lvl 1: 9 hits, Lvl 2: 13 hits, Lvl 3: 17 hits
        damageBossWithHitCount(target.x + (Math.random() - 0.5) * 40, target.y + (Math.random() - 0.5) * 40, hitsCount);
        target.ref.hp -= (dmg * 1.5); // lightning deals massive direct damage to boss too!
        addCombatLogMessage(`⚡ BLESK: Zasažen hlavní korzár! Ochranný štít absorboval ${hitsCount} zásahů!`, '#facc15');
      } else {
        target.ref.hp -= dmg;
      }

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

    playSuperMagnetSound();
    advanceMissionProgress('super_magnet_use', 1);
    addGainNotification("SUPER MAGNET: AKTIVOVÁN!", "#06b6d4");
  };

  const triggerStinkySock = (playerNum: number) => {
    const lvl = upgradesRef.current.abilitySockLevel || 0;
    if (lvl <= 0) return;

    if (sockCooldownRef.current > 0) return;

    const p = playersRef.current.find(pl => pl.playerNum === playerNum);
    if (!p) return;
    if (p.invulnerableTime > 0 && p.hull <= 0) return;

    const cooldownSeconds = lvl === 3 ? 8 : lvl === 2 ? 12 : 15;
    sockCooldownRef.current = cooldownSeconds * 60;
    setSockCooldown(cooldownSeconds);

    const speed = 7;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);

    socksRef.current.push({
      id: Math.random().toString(36).substring(2, 9),
      x: p.x + cos * 25,
      y: p.y + sin * 25,
      vx: cos * speed + p.vx * 0.3,
      vy: sin * speed + p.vy * 0.3,
      angle: p.angle,
      radius: 12 + lvl * 4,
      damage: lvl * 8,
      lifetime: 0,
      maxLifetime: 120,
      cloudActive: false,
      cloudRadius: 60 + lvl * 30,
      cloudDuration: (lvl === 3 ? 8 : lvl === 2 ? 5 : 3) * 60,
      cloudDmgPerFrame: lvl === 3 ? 2.5 : lvl === 2 ? 1.2 : 0.5,
      level: lvl,
    });

    addGainNotification("🧦 SMRADLAVÁ PONOŽKA VYSTŘELENA!", "#84cc16");
    playExplosionSound('small');
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
    advanceMissionProgress('kill_pirates', 1);

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

    const multiplier = getScoreMultiplierFromRef();
    const bonusPoints = Math.round(500 * multiplier);
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
    addGainNotification(`☠️ CORSÁR ZNIČEN! (+${bonusPoints} skóre, drahokamy vypadly!)`, "#f43f5e");
  };

  // --- ASTEROID DESTRUCTION & SUB-SPLIT MECHANIC ---
  const handleAsteroidBlowUp = (asteroid: Asteroid) => {
    playExplosionSound(asteroid.size);
    triggerAsteroidPieceExplosionParticles(asteroid);
    advanceMissionProgress('destroy_asteroids', 1);

    let shakeAmt = 3;
    if (asteroid.size === 'colossal') shakeAmt = 15;
    else if (asteroid.size === 'huge') shakeAmt = 10;
    else if (asteroid.size === 'large') shakeAmt = 6;
    else if (asteroid.size === 'medium') shakeAmt = 3;
    else if (asteroid.size === 'small') shakeAmt = 1.5;
    triggerCameraShake(shakeAmt);

    // 1. Add score with combo multiplier
    const now = Date.now();
    const timeDiff = now - lastAsteroidDestroyedTimeRef.current;
    if (timeDiff < 4000) {
      comboMultiplierRef.current = Math.min(10, comboMultiplierRef.current + 1);
    } else {
      comboMultiplierRef.current = 1;
    }
    lastAsteroidDestroyedTimeRef.current = now;
    setComboMultiplier(comboMultiplierRef.current);

    const comboMult = comboMultiplierRef.current;
    const multiplier = getScoreMultiplierFromRef();
    const awardedPoints = Math.round(asteroid.points * multiplier * comboMult);
    const newScore = scoreRef.current + awardedPoints;
    scoreRef.current = newScore;
    setCurrentScore(newScore);

    if (comboMult > 1) {
      addCombatLogMessage(`🔥 Combo x${comboMult}! (+${awardedPoints} skóre)`, '#f97316');
    }

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
    triggerSpawnAsteroidDrops(asteroid.x, asteroid.y, asteroid.size, asteroid.asteroidType);

    // Donkey Keeper Magma Chain Explosion (Řetězová exploze)
    if (asteroid.asteroidType === 'magma') {
      const explRadius = asteroid.size === 'colossal' ? 320 : asteroid.size === 'huge' ? 220 : asteroid.size === 'large' ? 170 : asteroid.size === 'medium' ? 120 : 80;
      triggerChainExplosionWave(asteroid.x, asteroid.y, explRadius, asteroid.id);
      addGainNotification("KOMBO: ŘETĚZOVÁ EXPLOZE!", "#f97316");
    }

    // 4. Handle Sub-splits (Radial split)
    if (asteroid.size !== 'small') {
      let nextSize: AsteroidSize = 'small';
      let splitCount = 3 + Math.floor(Math.random() * 2); // 3 to 4 smaller pieces splitter

      if (asteroid.size === 'colossal') {
        nextSize = 'huge';
        splitCount = 2; // splits into 2 huge asteroids
      } else if (asteroid.size === 'huge') {
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

  const handlePlayerDeath = (player: Player, cause: string) => {
    player.hull = 0;
    addGainNotification(`💀 ${player.name} byl ${cause}!`, '#ef4444');
    addCombatLogMessage(`💀 Hlášení: ${player.name} byl ${cause}!`, '#ef4444');
    const anyoneAlive = playersRef.current.some(pl => pl.hull > 0);
    if (!anyoneAlive) {
      addCombatLogMessage(`☠️ Hlášení: Všechny lodě byly zničeny!`, '#ef4444');
      triggerShipCatastrophicFailure();
    } else {
      addGainNotification(`HLÁŠENÍ: ${player.name} zničen! Přibližte se k troskám na <90m pro oživení!`, '#ef4444');
    }
  };

  const triggerShipCatastrophicFailure = () => {
    setIsPlaying(false);
    
    if (isBossFightActiveRef.current) {
      // Teleported back! Must start over! Loss of Activator.
      const updatedUpgrades = {
        ...upgrades,
        blackHoleActivator: 0
      };
      setUpgrades(updatedUpgrades);
      saveUpgrades(updatedUpgrades);
      
      bossRef.current = null;
      isBossFightActiveRef.current = false;
      setIsBossFightActive(false);
      
      setShowBossDefeatModal(true);
      playExplosionSound('huge');
    } else {
      setIsGameOver(true);
      playExplosionSound('huge');
    }

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

  // --- SYSTEM OF RANDOM SPACE EVENTS ---
  const triggerRandomSpaceEvent = () => {
    let eventRoll = Math.floor(Math.random() * 3);
    
    if (!enemiesEnabledRef.current && eventRoll === 2) {
      eventRoll = Math.floor(Math.random() * 2);
    }
    
    const livingPlayer = playersRef.current.find(p => p.hull > 0);
    if (!livingPlayer) return;
    
    const angle = Math.random() * Math.PI * 2;
    const dist = 450 + Math.random() * 200;
    const spawnX = livingPlayer.x + Math.cos(angle) * dist;
    const spawnY = livingPlayer.y + Math.sin(angle) * dist;
    
    if (eventRoll === 0) {
      const container: Ore = {
        id: 'cargo_' + Math.random().toString(36).substring(2, 9),
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        type: 'cargo' as any,
        color: '#facc15',
        radius: 13,
        pulseScale: 1.0,
        pulseDir: 1
      };
      
      oresRef.current.push(container);
      addCombatLogMessage("📦 VESMÍRNÁ UDÁLOST: Detekován nouzový signál opuštěného nákladního kontejneru!", "#facc15");
      addGainNotification("🎁 Nalezen ztracený cargo kontejner! Přitáhni ho magnetem!", "#facc15");
      triggerCameraShake(2);
      
    } else if (eventRoll === 1) {
      activeAnomalyRef.current = {
        x: spawnX,
        y: spawnY,
        radius: 350,
        lifetime: 0,
        maxLifetime: 600
      };
      
      addCombatLogMessage("🌀 VESMÍRNÁ UDÁLOST: V sektoru se vytvořila nestabilní gravitační anomálie!", "#a855f7");
      addGainNotification("🌀 Gravitační anomálie detekována! Pozor na silný tah!", "#c084fc");
      playExplosionSound('medium');
      triggerCameraShake(8);
      
    } else if (eventRoll === 2) {
      const droneCount = difficultyRef.current === 'easy' ? 2 : difficultyRef.current === 'medium' ? 3 : 4;
      const baseHp = Math.round(55 * (difficultyRef.current === 'easy' ? 0.7 : difficultyRef.current === 'medium' ? 1.0 : 1.4));
      
      for (let i = 0; i < droneCount; i++) {
        const dAngle = angle + (i - (droneCount - 1) / 2) * 0.35;
        const dX = livingPlayer.x + Math.cos(dAngle) * dist;
        const dY = livingPlayer.y + Math.sin(dAngle) * dist;
        
        piratesRef.current.push({
          id: 'drone_' + Math.random().toString(36).substring(2, 9),
          x: dX,
          y: dY,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          angle: Math.random() * Math.PI * 2,
          hp: baseHp,
          maxHp: baseHp,
          radius: 12,
          lastFired: 0,
          color: '#a855f7'
        });
      }
      
      addCombatLogMessage("🚨 VESMÍRNÁ UDÁLOST: Přepadová skupina autonomních těžařských dronů zachytila naše signály!", "#ef4444");
      addGainNotification("🤖 Pozor, útok nepřátelských dronů! Znič je pro extra krystaly!", "#f43f5e");
      triggerCameraShake(4);
    }
  };

  // --- VISUAL EFFECT PARTICLE EMITTERS ---
  const triggerAsteroidPieceExplosionParticles = (asteroid: Asteroid) => {
    const particleCount = asteroid.size === 'colossal' ? 65 : asteroid.size === 'huge' ? 40 : asteroid.size === 'large' ? 25 : 12;
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

      let shakeX = 0;
      let shakeY = 0;
      if (cameraShakeRef.current > 0.1) {
        shakeX = (Math.random() - 0.5) * cameraShakeRef.current;
        shakeY = (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current *= 0.93;
      }

      const camX = targetCamX - vw / 2 + shakeX;
      const camY = targetCamY - vh / 2 + shakeY;

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
      let bgFill = '#020617';
      let starGlowColor = '#60a5fa';
      
      const activeMap = selectedMapRef.current;
      if (activeMap === 'magma') {
        bgFill = '#080101'; // Dark volcanic space black
        starGlowColor = '#f97316'; // orange glow
      } else if (activeMap === 'ice') {
        bgFill = '#010c14'; // Dark frozen glacier space blue
        starGlowColor = '#38bdf8'; // icy cyan glow
      } else if (activeMap === 'gold') {
        bgFill = '#080601'; // Dark amber rich space gold
        starGlowColor = '#eab308'; // golden glow
      }
      
      ctx.fillStyle = bgFill;
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
        
        // Match star colors to map type slightly
        if (activeMap === 'magma') {
          ctx.fillStyle = star.speed > 0.15 ? `rgba(254, 215, 170, ${star.brightness})` : `rgba(255, 255, 255, ${star.brightness})`;
        } else if (activeMap === 'ice') {
          ctx.fillStyle = star.speed > 0.15 ? `rgba(224, 242, 254, ${star.brightness})` : `rgba(255, 255, 255, ${star.brightness})`;
        } else if (activeMap === 'gold') {
          ctx.fillStyle = star.speed > 0.15 ? `rgba(254, 243, 199, ${star.brightness})` : `rgba(255, 255, 255, ${star.brightness})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        }
        
        if (star.size > 1.3) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = starGlowColor;
        }
        ctx.fill();
        ctx.restore();
      });

      // --- Translate entire coordinates to vx, vy for simple camera mapping ---
      ctx.save();
      ctx.translate(vx, vy);

      // --- DRAW 2D GLADIATORIAL COMBAT ARENA (Grid, Borders & Spotlights) ---
      if (isBossFightActiveRef.current) {
        const arenaCenterX = 0;
        const arenaCenterY = -200;
        const arenaRadius = 1000;

        // Draw cyber-arena grid floor inside the circular boundary
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)'; // cyan grid lines
        ctx.lineWidth = 1;
        
        const gridSize = 80;
        const startGridX = Math.floor((camX - arenaRadius) / gridSize) * gridSize;
        const endGridX = Math.ceil((camX + vw + arenaRadius) / gridSize) * gridSize;
        const startGridY = Math.floor((camY - arenaRadius) / gridSize) * gridSize;
        const endGridY = Math.ceil((camY + vh + arenaRadius) / gridSize) * gridSize;

        // Clip grid to stay inside circular arena
        ctx.beginPath();
        ctx.arc(arenaCenterX - camX, arenaCenterY - camY, arenaRadius, 0, Math.PI * 2);
        ctx.clip();

        // Draw vertical grid lines
        for (let gx = startGridX; gx <= endGridX; gx += gridSize) {
          ctx.beginPath();
          ctx.moveTo(gx - camX, startGridY - camY);
          ctx.lineTo(gx - camX, endGridY - camY);
          ctx.stroke();
        }
        // Draw horizontal grid lines
        for (let gy = startGridY; gy <= endGridY; gy += gridSize) {
          ctx.beginPath();
          ctx.moveTo(startGridX - camX, gy - camY);
          ctx.lineTo(endGridX - camX, gy - camY);
          ctx.stroke();
        }

        // Draw cool glowing floor patterns
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(arenaCenterX - camX, arenaCenterY - camY, arenaRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(arenaCenterX - camX, arenaCenterY - camY, 150, 0, Math.PI * 2);
        ctx.stroke();
        
        // Crossed hazard lines in the center of arena
        ctx.beginPath();
        ctx.moveTo(arenaCenterX - camX - 100, arenaCenterY - camY - 100);
        ctx.lineTo(arenaCenterX - camX + 100, arenaCenterY - camY + 100);
        ctx.moveTo(arenaCenterX - camX + 100, arenaCenterY - camY - 100);
        ctx.lineTo(arenaCenterX - camX - 100, arenaCenterY - camY + 100);
        ctx.stroke();

        ctx.restore();

        // Draw Arena Boundary Ring (Pulsing Neon Barrier)
        ctx.save();
        const pulse = 1.0 + Math.sin(Date.now() / 250) * 0.03;
        const rCurrent = arenaRadius * pulse;
        
        // Inner glowing fill rim
        ctx.strokeStyle = '#ef4444'; // Neon red danger barrier
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(arenaCenterX - camX, arenaCenterY - camY, arenaRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Outer warning rings
        ctx.strokeStyle = '#facc15'; // Yellow caution rim
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.arc(arenaCenterX - camX, arenaCenterY - camY, arenaRadius + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Draw stadium/arena style spotlights sweeping the field
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const sweepSpeed = Date.now() / 1500;
        const lightsCount = 4;
        for (let i = 0; i < lightsCount; i++) {
          const angle = sweepSpeed + (i * Math.PI / 2);
          const beamLength = 800;
          
          const lx = arenaCenterX + Math.cos(angle + Math.sin(sweepSpeed) * 0.4) * 900 - camX;
          const ly = arenaCenterY + Math.sin(angle + Math.sin(sweepSpeed) * 0.4) * 900 - camY;

          // Spotlight source
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(lx, ly, 12, 0, Math.PI * 2);
          ctx.fill();

          // Spotlight cone pointing to center
          const targetAngle = Math.atan2((arenaCenterY - camY) - ly, (arenaCenterX - camX) - lx);
          const coneGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, beamLength);
          coneGrad.addColorStop(0, 'rgba(34, 211, 238, 0.25)');
          coneGrad.addColorStop(0.3, 'rgba(34, 211, 238, 0.10)');
          coneGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
          
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.arc(lx, ly, beamLength, targetAngle - 0.15, targetAngle + 0.15);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // --- DRAW 2D DESTRUCTIBLE ARENA PLATFORMS ---
        arenaPlatformsRef.current.forEach(plat => {
          const px = plat.x - camX;
          const py = plat.y - camY;
          const halfW = plat.width / 2;
          const halfH = plat.height / 2;

          ctx.save();
          
          // Determine glow color by health percentage
          const hpRatio = Math.max(0, plat.hp / plat.maxHp);
          const glowColor = hpRatio > 0.6 ? '#10b981' : (hpRatio > 0.3 ? '#f59e0b' : '#ef4444');
          
          ctx.shadowBlur = 14;
          ctx.shadowColor = glowColor;
          
          // Draw metallic base plate
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 2.5;
          
          ctx.beginPath();
          // Fallback rect if roundRect is not supported
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(px - halfW, py - halfH, plat.width, plat.height, 4);
          } else {
            ctx.rect(px - halfW, py - halfH, plat.width, plat.height);
          }
          ctx.fill();
          ctx.stroke();
          
          // Draw subtle high-tech circuit lines inside the plate
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          for (let tx = -halfW + 15; tx < halfW; tx += 15) {
            ctx.beginPath();
            ctx.moveTo(px + tx, py - halfH);
            ctx.lineTo(px + tx, py + halfH);
            ctx.stroke();
          }

          // Draw neon accent line along the bottom
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - halfW + 6, py + halfH - 3);
          ctx.lineTo(px + halfW - 6, py + halfH - 3);
          ctx.stroke();

          // DRAW DAMAGE CRACKS AND DEBRIS (as platform crumbles)
          if (hpRatio < 1.0) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 0; // disable shadow for jagged cracks
            
            // Seed crack locations deterministically based on platform ID string
            const seed = plat.id === 'plat-1' ? 0.35 : (plat.id === 'plat-2' ? 0.72 : 0.48);
            const crackCount = Math.floor((1 - hpRatio) * 6) + 1;
            
            for (let i = 0; i < crackCount; i++) {
              const xStart = px - halfW + ((seed * 23 + i * 17) % 1) * plat.width;
              const yStart = py - halfH;
              const xEnd = xStart + ((seed * 7 + i * 29) % 0.5 - 0.25) * 35;
              const yEnd = py + halfH;
              
              ctx.beginPath();
              ctx.moveTo(xStart, yStart);
              const xMid = (xStart + xEnd) / 2 + (Math.sin(i + Date.now() / 150) * 3);
              ctx.lineTo(xMid, py);
              ctx.lineTo(xEnd, yEnd);
              ctx.stroke();
            }
          }

          // Emit dust/smoke particles if heavily damaged
          if (hpRatio < 0.5 && Math.random() < 0.08) {
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: plat.x + (Math.random() - 0.5) * plat.width,
              y: plat.y + (Math.random() - 0.5) * plat.height,
              vx: (Math.random() - 0.5) * 1.2,
              vy: -0.4 - Math.random() * 0.8,
              color: '#64748b',
              size: Math.random() * 2.5 + 1.2,
              alpha: 0.5,
              lifetime: 0,
              maxLifetime: 40
            });
          }

          // Draw floating durability indicator bar
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(px - 25, py - halfH - 12, 50, 4);
          ctx.fillStyle = glowColor;
          ctx.fillRect(px - 25, py - halfH - 12, 50 * hpRatio, 4);

          ctx.restore();
        });
      }

      // --- B. PARTICLES RENDER ---
      particlesRef.current.forEach(p => {
        const sx = p.x - camX;
        const sy = p.y - camY;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;
        
        if (p.isSquare) {
          // Render pixelated Minecraft square
          ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // --- C. FLOATING ORE DROPS RENDER ---
      oresRef.current.forEach(ore => {
        const sx = ore.x - camX;
        const sy = ore.y - camY;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(ore.pulseScale, ore.pulseScale);
        
        if (ore.type as string === 'cargo') {
          // Draw a cool high-tech cargo container box with warning stripes
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#eab308';
          
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#eab308';
          ctx.fillStyle = '#0f172a';
          
          ctx.beginPath();
          ctx.rect(-ore.radius * 1.3, -ore.radius * 0.9, ore.radius * 2.6, ore.radius * 1.8);
          ctx.fill();
          ctx.stroke();
          
          // Draw a yellow center lock
          ctx.fillStyle = '#eab308';
          ctx.fillRect(-ore.radius * 0.4, -ore.radius * 0.4, ore.radius * 0.8, ore.radius * 0.8);
          
          // Draw warning stripes on sides
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-ore.radius * 1.1, -ore.radius * 0.7);
          ctx.lineTo(-ore.radius * 0.8, -ore.radius * 0.3);
          ctx.moveTo(ore.radius * 0.8, -ore.radius * 0.7);
          ctx.lineTo(ore.radius * 1.1, -ore.radius * 0.3);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("🎁", 0, -ore.radius * 1.3);
        } else {
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
        }

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
        
        ctx.shadowBlur = ast.size === 'colossal' ? 8 : ast.size === 'huge' ? 5 : 2;
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

      // --- DRAW STINKY SOCKS & GASEOUS CLOUDS ---
      socksRef.current.forEach(sock => {
        const sx = sock.x - camX;
        const sy = sock.y - camY;

        ctx.save();
        ctx.translate(sx, sy);

        if (!sock.cloudActive) {
          ctx.rotate(sock.angle);
          ctx.fillStyle = '#a3e635'; // Smelly green
          ctx.strokeStyle = '#4d7c0f';
          ctx.lineWidth = 1.8;
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#84cc16';
          
          ctx.beginPath();
          // Sock ankle cuff
          ctx.rect(-7, -11, 14, 14);
          // Sock foot heel to toe
          ctx.rect(-7, 3, 22, 9);
          ctx.fill();
          ctx.stroke();

          // Stitch lines details
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(-3, -7);
          ctx.lineTo(3, -7);
          ctx.moveTo(-3, -3);
          ctx.lineTo(3, -3);
          ctx.stroke();

          // Funny yellow stink lines waving
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-10, -15);
          ctx.quadraticCurveTo(-14, -20, -10, -25);
          ctx.moveTo(10, -15);
          ctx.quadraticCurveTo(14, -20, 10, -25);
          ctx.stroke();
        } else {
          // Dynamic pulsing expand effect
          const scalePulse = 1.0 + Math.sin(Date.now() / 200 + sock.x) * 0.05;
          const r = sock.cloudRadius * scalePulse;

          const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, r);
          gradient.addColorStop(0, 'rgba(132, 204, 22, 0.45)');
          gradient.addColorStop(0.4, 'rgba(163, 230, 53, 0.22)');
          gradient.addColorStop(0.8, 'rgba(234, 179, 8, 0.08)');
          gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // --- DRAW AUTOMATIC MINING DRONES ---
      dronesRef.current.forEach(drone => {
        const dx = drone.x - camX;
        const dy = drone.y - camY;

        // 1. Draw mining laser beam first (underneath the drone body)
        if (drone.laserBeamActive) {
          const tx = drone.laserTargetX - camX;
          const ty = drone.laserTargetY - camY;

          ctx.save();
          // Outer glowing beam
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5 + Math.sin(Date.now() / 50) * 1.0;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#10b981';
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // Inner white core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();

          // Spawn little mining laser sparks at target
          if (Math.random() < 0.3) {
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: drone.laserTargetX + (Math.random() - 0.5) * 10,
              y: drone.laserTargetY + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              color: '#34d399',
              size: Math.random() * 3 + 1,
              alpha: 0.7,
              lifetime: 0,
              maxLifetime: 20
            });
          }
        }

        // 2. Draw Drone body
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(drone.angle);

        // Shadow/glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#84cc16'; // Lime green glow

        // Thruster flame at the back
        const flameLen = 8 + Math.random() * 6;
        const flameGrad = ctx.createLinearGradient(-10, 0, -10 - flameLen, 0);
        flameGrad.addColorStop(0, '#a3e635');
        flameGrad.addColorStop(1, 'rgba(163, 230, 53, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-8 - flameLen, 0);
        ctx.lineTo(-8, 3);
        ctx.closePath();
        ctx.fill();

        // Steel chassis circular orb body
        ctx.fillStyle = '#334155'; // Dark slate metal
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing visor dome (sensor)
        ctx.fillStyle = '#84cc16'; // Glowing lime green eye
        ctx.beginPath();
        ctx.arc(4, 0, 3.5, -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        // Cute side winglets
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        // Upper wing
        ctx.moveTo(-2, -8);
        ctx.lineTo(-6, -12);
        ctx.lineTo(-1, -12);
        ctx.closePath();
        // Lower wing
        ctx.moveTo(-2, 8);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-1, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Little antenna blinking red light
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-3, -5);
        ctx.lineTo(-6, -9);
        ctx.stroke();

        ctx.fillStyle = (Date.now() % 500 < 250) ? '#f43f5e' : '#1e293b';
        ctx.beginPath();
        ctx.arc(-6, -9, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // --- DRAW CARRIER AUTOMATED REPAIR DRONES ---
      if (capitalShipModeRef.current && capitalShipRef.current) {
        const ship = capitalShipRef.current;
        carrierRepairDronesRef.current.forEach(drone => {
          const dx = drone.x - camX;
          const dy = drone.y - camY;

          // 1. Draw green healing laser beam
          if (drone.repairBeamActive) {
            const tx = ship.x - camX;
            const ty = ship.y - camY;

            ctx.save();
            ctx.strokeStyle = '#4ade80'; // vibrant green
            ctx.lineWidth = 2.0 + Math.sin(Date.now() / 40) * 0.8;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Inner intense white healing core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.restore();
          }

          // 2. Draw Repair Drone body
          ctx.save();
          ctx.translate(dx, dy);
          ctx.rotate(drone.angle);

          // Glowing green drop shadow
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22c55e';

          // Small green thruster flame
          const flameLen = 6 + Math.random() * 5;
          const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
          flameGrad.addColorStop(0, '#22c55e');
          flameGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(-6, -2);
          ctx.lineTo(-6 - flameLen, 0);
          ctx.lineTo(-6, 2);
          ctx.closePath();
          ctx.fill();

          // Drone body - circular slate dome with glowing green center ring
          ctx.fillStyle = '#1e293b'; // dark slate
          ctx.strokeStyle = '#22c55e'; // green border
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Green healing sensor dome
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(3, 0, 3, -Math.PI / 2, Math.PI / 2);
          ctx.fill();

          // Side micro-arms/solar panels
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(-1, -6);
          ctx.lineTo(-3, -10);
          ctx.lineTo(1, -10);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-1, 6);
          ctx.lineTo(-3, 10);
          ctx.lineTo(1, 10);
          ctx.stroke();

          ctx.restore();
        });
      }

      // --- DRAW CARRIER POINT DEFENSE BEAMS (PDS) ---
      activePdsBeamsRef.current.forEach(beam => {
        const fx = beam.fromX - camX;
        const fy = beam.fromY - camY;
        const tx = beam.toX - camX;
        const ty = beam.toY - camY;

        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${beam.alpha})`; // electric cyan-blue
        ctx.lineWidth = 3.5 * beam.alpha;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0ea5e9';
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // White core
        ctx.strokeStyle = `rgba(255, 255, 255, ${beam.alpha})`;
        ctx.lineWidth = 1.2 * beam.alpha;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      });

      // --- DRAW SPATIAL ANOMALY ---
      if (activeAnomalyRef.current) {
        const anomaly = activeAnomalyRef.current;
        const ax = anomaly.x - camX;
        const ay = anomaly.y - camY;
        
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(Date.now() * 0.0018);
        
        const r = 70 + Math.sin(Date.now() / 150) * 8;
        
        for (let i = 3; i > 0; i--) {
          const alpha = 0.06 * i;
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r * (1 + i * 0.28), 0, Math.PI * 2);
          ctx.stroke();
        }
        
        const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        grad.addColorStop(0, '#090514');
        grad.addColorStop(0.4, '#581c87');
        grad.addColorStop(0.8, '#a855f7');
        grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let j = 0; j < 4; j++) {
          const startAngle = (j * Math.PI * 2) / 4;
          ctx.moveTo(0, 0);
          for (let step = 0; step < 25; step++) {
            const stepAng = startAngle + step * 0.15;
            const stepRad = (step / 25) * r;
            ctx.lineTo(Math.cos(stepAng) * stepRad, Math.sin(stepAng) * stepRad);
          }
        }
        ctx.stroke();
        ctx.restore();
        
        const pvx = focusPlayer.x - camX;
        const pvy = focusPlayer.y - camY;
        if (ax < 0 || ax > vw || ay < 0 || ay > vh) {
          const dx = ax - pvx;
          const dy = ay - pvy;
          const angleToAnomaly = Math.atan2(dy, dx);
          const arrowDist = Math.min(vw, vh) * 0.42;
          const arrowX = pvx + Math.cos(angleToAnomaly) * arrowDist;
          const arrowY = pvy + Math.sin(angleToAnomaly) * arrowDist;
          
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angleToAnomaly);
          
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#c084fc';
          ctx.fillStyle = '#a855f7';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-6, -7);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          ctx.rotate(-angleToAnomaly);
          ctx.fillStyle = '#c084fc';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("🌀 ANOMÁLIE", 0, 18);
          ctx.restore();
        }
      }

      // --- DRAW COSMIC WORMHOLE ---
      if (wormholeRef.current) {
        const wormhole = wormholeRef.current;
        const wx = wormhole.x - camX;
        const wy = wormhole.y - camY;

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wormhole.angle);

        const r = wormhole.radius * wormhole.pulseScale;

        // Draw background gravitational distortion rings
        const ringColor = wormhole.isReturn ? 'rgba(249, 115, 22, ' : 'rgba(168, 85, 247, ';
        for (let i = 4; i > 0; i--) {
          const alpha = 0.08 * i;
          ctx.strokeStyle = `${ringColor}${alpha})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, r * (1 + i * 0.25), 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw glowing neon outer purple/orange vortex
        const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        grad.addColorStop(0, '#020617'); // dark black center
        if (wormhole.isReturn) {
          grad.addColorStop(0.35, '#7c2d12'); // deep orange swirl
          grad.addColorStop(0.7, '#f97316'); // neon orange edge
          grad.addColorStop(0.9, '#facc15'); // gold rim sparks
        } else {
          grad.addColorStop(0.35, '#581c87'); // deep purple swirl
          grad.addColorStop(0.7, '#a855f7'); // neon purple edge
          grad.addColorStop(0.9, '#22d3ee'); // cyan rim sparks
        }
        grad.addColorStop(1, 'rgba(34, 211, 238, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Draw swirling spiral lines inside the vortex for dramatic detail!
        ctx.strokeStyle = wormhole.isReturn ? 'rgba(253, 186, 116, 0.45)' : 'rgba(192, 132, 252, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const startAngle = (j * Math.PI * 2) / 3;
          ctx.moveTo(0, 0);
          for (let step = 0; step < 35; step++) {
            const stepAng = startAngle + step * 0.12;
            const stepRad = (step / 35) * r;
            ctx.lineTo(Math.cos(stepAng) * stepRad, Math.sin(stepAng) * stepRad);
          }
        }
        ctx.stroke();

        ctx.restore();

        // Draw beautiful arrow indicator if the wormhole is offscreen!
        const pvx = focusPlayer.x - camX;
        const pvy = focusPlayer.y - camY;

        // If wormhole center is offscreen
        if (wx < 0 || wx > vw || wy < 0 || wy > vh) {
          const dx = wx - pvx;
          const dy = wy - pvy;
          const angleToWormhole = Math.atan2(dy, dx);

          // Position arrow on viewport edge with some padding
          const arrowDist = Math.min(vw, vh) * 0.4;
          const ax = pvx + Math.cos(angleToWormhole) * arrowDist;
          const ay = pvy + Math.sin(angleToWormhole) * arrowDist;

          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(angleToWormhole);

          // Pulsating indicator
          const scale = 1.0 + Math.sin(Date.now() / 150) * 0.15;

          // Glowing neon arrow
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#c084fc';
          ctx.fillStyle = '#a855f7';
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(15 * scale, 0);
          ctx.lineTo(-8 * scale, -10 * scale);
          ctx.lineTo(-4 * scale, 0);
          ctx.lineTo(-8 * scale, 10 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Text label
          ctx.rotate(-angleToWormhole); // keep text upright
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#000000';
          const distanceMeters = Math.round(Math.hypot(dx, dy) / 10);
          ctx.fillText(`PORTÁL (${distanceMeters}m)`, 0, -18 * scale);

          ctx.restore();
        }
      }

      // --- DRAW GENERAL CORSAIR BOSS SHIP ---
      if (isBossFightActiveRef.current && bossRef.current) {
        const boss = bossRef.current;
        const bx = boss.x - camX;
        const by = boss.y - camY;

        ctx.save();
        ctx.translate(bx, by);

        // Core animation rates
        const bob = Math.sin(Date.now() / 350) * 8;
        const limbSwing = Math.sin(Date.now() / 180) * 12;

        // Shadow glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ef4444';

        // --- 1. Draw Massive Hover Thrusters / Jet Pods ---
        const flameLength = 35 + Math.abs(Math.sin(Date.now() / 80)) * 25;
        const thrGrad = ctx.createLinearGradient(0, 30 + bob, 0, 30 + flameLength + bob);
        thrGrad.addColorStop(0, '#f97316');
        thrGrad.addColorStop(0.3, '#ef4444');
        thrGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = thrGrad;
        
        // Left thruster pod flame
        ctx.fillRect(-45, 20 + bob, 16, flameLength);
        // Right thruster pod flame
        ctx.fillRect(29, 20 + bob, 16, flameLength);

        // Metal thruster tubes
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.fillRect(-50, 10 + bob, 26, 15);
        ctx.strokeRect(-50, 10 + bob, 26, 15);
        ctx.fillRect(24, 10 + bob, 26, 15);
        ctx.strokeRect(24, 10 + bob, 26, 15);

        // --- 2. Draw Heavy Robotic Mech Arms / Cannons ---
        ctx.save();
        ctx.translate(-55, -10 + bob);
        ctx.rotate(Math.PI / 12 + limbSwing * 0.01);
        // Left arm frame
        ctx.fillStyle = '#334155';
        ctx.fillRect(-20, -15, 25, 35);
        ctx.strokeRect(-20, -15, 25, 35);
        // Giant cannon barrel
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-15, -45, 14, 30);
        ctx.strokeRect(-15, -45, 14, 30);
        // Laser emitter tip
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-13, -53, 10, 8);
        ctx.restore();

        ctx.save();
        ctx.translate(55, -10 + bob);
        ctx.rotate(-Math.PI / 12 - limbSwing * 0.01);
        // Right arm frame
        ctx.fillStyle = '#334155';
        ctx.fillRect(-5, -15, 25, 35);
        ctx.strokeRect(-5, -15, 25, 35);
        // Giant cannon barrel
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(1, -45, 14, 30);
        ctx.strokeRect(1, -45, 14, 30);
        // Laser emitter tip
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(3, -53, 10, 8);
        ctx.restore();

        // --- 3. Draw Massive Steel Core Torso ---
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        // Heavy octagonal armored chest
        ctx.moveTo(-45, 15 + bob);
        ctx.lineTo(-50, -35 + bob);
        ctx.lineTo(-25, -55 + bob);
        ctx.lineTo(25, -55 + bob);
        ctx.lineTo(50, -35 + bob);
        ctx.lineTo(45, 15 + bob);
        ctx.lineTo(0, 30 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Industrial hazard warning lines
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-25, 5 + bob);
        ctx.lineTo(-15, 15 + bob);
        ctx.moveTo(-5, 5 + bob);
        ctx.lineTo(5, 15 + bob);
        ctx.moveTo(15, 5 + bob);
        ctx.lineTo(25, 15 + bob);
        ctx.stroke();

        // Glowing Core Reactor Crystal
        ctx.save();
        const corePulse = 12 + Math.sin(Date.now() / 100) * 4;
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = corePulse;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -10 + bob, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- 4. Draw Mechanical Head with Admiral General's Cap ---
        // Metallic head
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.fillRect(-18, -80 + bob, 36, 25);
        ctx.strokeRect(-18, -80 + bob, 36, 25);

        // Glowing red horizontal visor eye
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-12, -72 + bob, 24, 6);

        // General's Admiral Cap
        ctx.fillStyle = '#0f172a'; // dark navy/black cap crown
        ctx.strokeStyle = '#facc15'; // golden cap lining
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, -80 + bob);
        ctx.lineTo(-30, -90 + bob);
        ctx.lineTo(30, -90 + bob);
        ctx.lineTo(24, -80 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cap peak visor
        ctx.fillStyle = '#020617';
        ctx.fillRect(-20, -79 + bob, 40, 4);

        // Golden crest/badge in center
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -91 + bob);
        ctx.lineTo(4, -85 + bob);
        ctx.lineTo(-4, -85 + bob);
        ctx.closePath();
        ctx.fill();

        // --- 5. HP HUD & Lives ---
        // Draw Boss HP HUD directly on canvas
        const barWidth = 180;
        const barHeight = 9;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-barWidth / 2, -125, barWidth, barHeight);
        
        const hpRatio = Math.max(0, boss.hp / boss.maxHp);
        const hpColor = hpRatio > 0.45 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillStyle = hpColor;
        ctx.fillRect(-barWidth / 2, -125, barWidth * hpRatio, barHeight);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(-barWidth / 2, -125, barWidth, barHeight);

        // Draw Remaining Lives as glowing burning fire symbols!
        const bLives = boss.lives ?? 6;
        const bMaxLives = boss.maxLives ?? 6;
        let heartsStr = "";
        for (let i = 0; i < bMaxLives; i++) {
          heartsStr += i < bLives ? "🔥" : "🖤";
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000000';
        ctx.fillText(`🤖 CYBER-GOLIÁŠ KORZÁRŮ (${Math.round(hpRatio * 100)}%)`, 0, -137);
        
        ctx.fillStyle = '#ff7849'; // fiery color
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const healAmt = hpRatio < 1.0 ? 250 + (6 - bLives) * 180 : 0;
        ctx.fillText(`${heartsStr}  |  🔥 REGEN: +${healAmt} HP/s`, 0, -112);

        ctx.restore();
      }

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

        if (isBossFightActiveRef.current) {
          // --- DRAW CUTE 2D ASTRONAUT CHARACTER ("PANÁČEK") ---
          const isFlashing = p.invulnerableTime > 0 && Math.floor(p.invulnerableTime / 4) % 2 === 0;
          if (isFlashing) {
            ctx.globalAlpha = 0.35;
          }

          // Let's determine coordinates and movement wiggle
          const isMoving = Math.hypot(p.vx, p.vy) > 0.4;
          const walkCycle = isMoving ? Math.sin(Date.now() / 90) : 0;
          const bounceY = isMoving ? Math.abs(Math.sin(Date.now() / 90)) * 3 : 0;

          // Align figure to tilt slightly based on speed
          const tilt = Math.max(-0.2, Math.min(0.2, p.vx * 0.04));
          ctx.rotate(tilt);

          // Shadow and base color
          ctx.shadowBlur = 10;
          ctx.shadowColor = playerNum === 1 ? '#0ea5e9' : '#c084fc';

          // Color palette
          const suitColor = playerNum === 1 ? '#0284c7' : '#7e22ce'; // Main suit
          const suitAccent = playerNum === 1 ? '#38bdf8' : '#e9d5ff'; // Accent chest armor
          const visorColor = playerNum === 1 ? '#22d3ee' : '#ec4899'; // Glowing faceplate

          // --- 1. Draw Jetpack on Back ---
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-15, -12 - bounceY, 6, 20); // Jetpack body left side
          
          if (p.thrusting) {
            // Emitting fire flames from the jetpack!
            const fLength = 15 + Math.random() * 12;
            const jetGrad = ctx.createLinearGradient(-12, 8 - bounceY, -12, 8 + fLength - bounceY);
            jetGrad.addColorStop(0, '#f97316');
            jetGrad.addColorStop(0.5, '#ef4444');
            jetGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = jetGrad;
            ctx.fillRect(-14, 8 - bounceY, 4, fLength);
            
            // Jetpack fire particles
            if (Math.random() < 0.3) {
              particlesRef.current.push({
                id: Math.random().toString(36).substring(2, 9),
                x: p.x - Math.cos(p.angle) * 12 + (Math.random() - 0.5) * 6,
                y: p.y - Math.sin(p.angle) * 12 + 10,
                vx: -p.vx * 0.5 + (Math.random() - 0.5) * 1.5,
                vy: 2.5 + Math.random() * 2,
                color: playerNum === 1 ? '#38bdf8' : '#ec4899',
                size: Math.random() * 3 + 1,
                alpha: 0.8,
                lifetime: 0,
                maxLifetime: 25
              });
            }
          }

          // --- 2. Draw Legs (Wiggle walking animation) ---
          ctx.fillStyle = suitColor;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;

          // Left Leg
          ctx.save();
          ctx.translate(-5, 10);
          ctx.rotate(walkCycle * 0.4);
          ctx.fillRect(-3, 0, 6, 8);
          // boot foot
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-4, 6, 6, 3);
          ctx.restore();

          // Right Leg
          ctx.save();
          ctx.translate(5, 10);
          ctx.rotate(-walkCycle * 0.4);
          ctx.fillStyle = suitColor;
          ctx.fillRect(-3, 0, 6, 8);
          // boot foot
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-2, 6, 6, 3);
          ctx.restore();

          // --- 3. Draw Body (Egg/Round rect suit) ---
          ctx.fillStyle = suitColor;
          ctx.beginPath();
          // Draw round suit body
          ctx.arc(0, -2 - bounceY, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Chest armor plate
          ctx.fillStyle = suitAccent;
          ctx.beginPath();
          ctx.arc(0, -1 - bounceY, 7, 0, Math.PI * 2);
          ctx.fill();

          // --- 4. Draw Helmet & Face Visor ---
          ctx.fillStyle = '#e2e8f0'; // Helmet dome
          ctx.beginPath();
          ctx.arc(0, -14 - bounceY, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Shiny reflective glass visor
          ctx.fillStyle = visorColor;
          ctx.shadowBlur = 8;
          ctx.shadowColor = visorColor;
          ctx.beginPath();
          // Face plate facing direction or forward
          ctx.ellipse(2, -14 - bounceY, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Visor sheen highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.ellipse(0, -15 - bounceY, 3, 1.5, Math.PI / 6, 0, Math.PI * 2);
          ctx.fill();

          // Reset shadow
          ctx.shadowBlur = 0;

          // --- 5. Draw Hand Holding Arm / Blaster (points at weapon angle p.angle!) ---
          ctx.save();
          ctx.translate(3, -2 - bounceY);
          ctx.rotate(p.angle); // Weapons face looking/aiming direction!

          // Laser Gun Stock & Barrel
          ctx.fillStyle = '#334155';
          ctx.fillRect(0, -3, 18, 5); // main frame
          ctx.fillStyle = playerNum === 1 ? '#0ea5e9' : '#ec4899'; // weapon laser tube
          ctx.fillRect(4, -2, 10, 3);
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(18, -1.5);
          ctx.lineTo(21, -1.5);
          ctx.stroke();

          // Small hand holding gun
          ctx.fillStyle = suitColor;
          ctx.beginPath();
          ctx.arc(3, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.restore();

          // Restore canvas matrix
          ctx.restore();
          
          // Draw Name Tag and Shield/Hull HUD over the character
          ctx.save();
          ctx.translate(sx, sy - bounceY);
          ctx.fillStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
          ctx.font = 'bold 9px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`ASTRONAUT H${playerNum}`, 0, -30);

          // Mini circular health / shield ring under the character
          const hpRatio = Math.max(0, currentHull / 100); // normalized max hull
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = playerNum === 1 ? '#38bdf8' : '#a855f7';
          ctx.beginPath();
          ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + (currentShield / maxShieldVal) * Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#10b981'; // green hull ring inside
          ctx.beginPath();
          ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + hpRatio * Math.PI * 2);
          ctx.stroke();

          ctx.restore();
          return;
        }

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

        const timeSinceHullHit = Date.now() - (p.lastHullHitTime || 0);
        const hullFlashActive = timeSinceHullHit < 500;
        const hullFlashColor = Math.floor(timeSinceHullHit / 80) % 2 === 0 ? '#ef4444' : '#ffffff';

        ctx.fillStyle = hullFlashActive ? hullFlashColor : (playerNum === 1 ? '#1e293b' : '#1e1b4b');
        ctx.strokeStyle = hullFlashActive ? '#ef4444' : (playerNum === 1 ? '#38bdf8' : '#c084fc');
        ctx.lineWidth = hullFlashActive ? 4.0 : 2.5;
        ctx.lineJoin = 'miter';

        const sClass = upgradesRef.current.playerShipClass || 'standard';

        if (sClass === 'standard') {
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
        } 
        else if (sClass === 'interceptor') {
          // Sleek wide wings, double engines
          ctx.beginPath();
          ctx.moveTo(26, 0);
          ctx.lineTo(-2, -10);
          ctx.lineTo(-14, -22); // wingtip
          ctx.lineTo(-20, -18);
          ctx.lineTo(-14, -6);
          ctx.lineTo(-14, 6);
          ctx.lineTo(-20, 18);
          ctx.lineTo(-14, 22); // wingtip
          ctx.lineTo(-2, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Canopy
          ctx.fillStyle = playerNum === 1 ? '#22d3ee' : '#f472b6';
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(2, -4);
          ctx.lineTo(-4, -2);
          ctx.lineTo(-4, 2);
          ctx.lineTo(2, 4);
          ctx.closePath();
          ctx.fill();
        } 
        else if (sClass === 'cruiser') {
          // Forked double hull, revolving center turret ring
          ctx.beginPath();
          ctx.moveTo(26, -6);
          ctx.lineTo(10, -18);
          ctx.lineTo(-16, -18);
          ctx.lineTo(-12, -4);
          ctx.lineTo(-12, 4);
          ctx.lineTo(-16, 18);
          ctx.lineTo(10, 18);
          ctx.lineTo(26, 6);
          ctx.lineTo(4, 0); // catamaran fork
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Canopy on both sides
          ctx.fillStyle = playerNum === 1 ? '#0ea5e9' : '#db2777';
          ctx.beginPath();
          ctx.moveTo(18, -7); ctx.lineTo(10, -12); ctx.lineTo(4, -10); ctx.lineTo(4, -5); ctx.closePath();
          ctx.moveTo(18, 7); ctx.lineTo(10, 12); ctx.lineTo(4, 10); ctx.lineTo(4, 5); ctx.closePath();
          ctx.fill();

          // Render Revolving Auto-Turret Ring in the middle!
          ctx.save();
          const tAng = (p as any).turretAngle || 0;
          ctx.rotate(tAng - p.angle); // turretAngle is absolute, we are rotated by p.angle
          ctx.strokeStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Turret barrel
          ctx.strokeStyle = playerNum === 1 ? '#ef4444' : '#ec4899';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(14, 0);
          ctx.stroke();
          ctx.restore();
        } 
        else if (sClass === 'dreadnought') {
          // Heavy shielded hexagonal fortress
          ctx.beginPath();
          ctx.moveTo(28, 0);
          ctx.lineTo(14, -15);
          ctx.lineTo(-10, -22);
          ctx.lineTo(-24, -14);
          ctx.lineTo(-16, -6);
          ctx.lineTo(-16, 6);
          ctx.lineTo(-24, 14);
          ctx.lineTo(-10, 22);
          ctx.lineTo(14, 15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Heavy armored canopy
          ctx.fillStyle = playerNum === 1 ? '#0284c7' : '#a21caf';
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(4, -7);
          ctx.lineTo(-8, -4);
          ctx.lineTo(-8, 4);
          ctx.lineTo(4, 7);
          ctx.closePath();
          ctx.fill();

          // Draw dual side turrets tracking the target!
          const tAng = (p as any).turretAngle || 0;
          const relativeTurretAng = tAng - p.angle;

          // Turret Left at -14
          ctx.save();
          ctx.translate(-4, -14);
          ctx.rotate(relativeTurretAng);
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = playerNum === 1 ? '#ef4444' : '#ec4899'; ctx.lineWidth = 2.0;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.restore();

          // Turret Right at 14
          ctx.save();
          ctx.translate(-4, 14);
          ctx.rotate(relativeTurretAng);
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = playerNum === 1 ? '#ef4444' : '#ec4899'; ctx.lineWidth = 2.0;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.restore();
        }

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
          
          const timeSinceShieldHit = Date.now() - (p.lastShieldHitTime || 0);
          const shieldFlashActive = timeSinceShieldHit < 500;
          
          if (shieldFlashActive) {
            const shieldFlashColor = Math.floor(timeSinceShieldHit / 80) % 2 === 0 ? '#facc15' : '#ef4444';
            ctx.strokeStyle = shieldFlashColor;
            ctx.shadowColor = shieldFlashColor;
            ctx.shadowBlur = 20;
            ctx.lineWidth = 3.8;
            
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 11, 0, Math.PI * 2);
            ctx.stroke();
            
            // Concentric shockwave ring
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 15 + (timeSinceShieldHit / 500) * 12, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = playerNum === 1 
              ? `rgba(56, 189, 248, ${0.15 + (currentShield / maxShieldVal) * 0.4})`
              : `rgba(168, 85, 247, ${0.15 + (currentShield / maxShieldVal) * 0.4})`;
            ctx.shadowColor = playerNum === 1 ? '#38bdf8' : '#a855f7';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw ice frost coating overlay ("loď pokrývají námrazou")
        if (p.frostLevel && p.frostLevel > 0) {
          ctx.save();
          ctx.rotate(-p.angle);
          
          ctx.fillStyle = `rgba(56, 189, 248, ${(p.frostLevel / 100) * 0.45})`; // ice blue tint
          ctx.strokeStyle = `rgba(224, 242, 254, ${(p.frostLevel / 100) * 0.75})`; // frost highlights
          ctx.lineWidth = 1.5 + (p.frostLevel / 100) * 1.5;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = (p.frostLevel / 100) * 12;

          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Tiny snowflake/frost crack markings inside the ice bubble if high frost
          if (p.frostLevel > 35) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
            ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
            ctx.moveTo(0, -8); ctx.lineTo(0, 8);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.rotate(-p.angle);
        
        // Critical HP warning indicator above name
        if (p.hull / p.maxHull <= 0.35) {
          const isBlinking = Math.floor(Date.now() / 200) % 2 === 0;
          if (isBlinking) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 6;
            ctx.fillText("⚠️ NOUZE!", 0, -p.radius - 23);
          }
        }

        ctx.fillStyle = playerNum === 1 ? '#38bdf8' : '#c084fc';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Hráč ${playerNum}`, 0, -p.radius - 12);
        ctx.restore();

        ctx.restore();
      };

      const drawCapitalShip = (ship: CapitalShip) => {
        const sx = ship.x - camX;
        const sy = ship.y - camY;

        ctx.save();
        ctx.translate(sx, sy);

        // Render shield outer boundary if active
        if (ship.shield > 0) {
          ctx.save();
          ctx.strokeStyle = ship.type === 'war' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(96, 165, 250, 0.4)';
          ctx.lineWidth = 3.5;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#60a5fa';
          ctx.beginPath();
          ctx.arc(0, 0, ship.radius + 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Rotate ctx for ship's own heading
        ctx.save();
        ctx.rotate(ship.angle);

        // Render specific ship geometries based on type
        ctx.strokeStyle = '#94a3b8'; // Slate grey default hull outline
        ctx.lineWidth = 3.0;
        ctx.fillStyle = '#0f172a'; // Deep slate fill

        if (ship.type === 'mining') {
          // Boxy Mining Cruiser
          ctx.beginPath();
          ctx.moveTo(ship.radius, -18);
          ctx.lineTo(ship.radius, 18);
          ctx.lineTo(ship.radius - 20, 32);
          ctx.lineTo(-ship.radius + 15, 32);
          ctx.lineTo(-ship.radius, 15);
          ctx.lineTo(-ship.radius, -15);
          ctx.lineTo(-ship.radius + 15, -32);
          ctx.lineTo(ship.radius - 20, -32);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Render a big drill at the front
          ctx.save();
          ctx.translate(ship.radius + 5, 0);
          ctx.rotate(Date.now() / 60);
          ctx.strokeStyle = '#cbd5e1';
          ctx.fillStyle = '#475569';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(15, 0);
          ctx.lineTo(0, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Draw cargo holds
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-ship.radius + 30, -20, 30, 40);
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(-ship.radius + 30, -20, 30, 40);

        } else if (ship.type === 'war') {
          // Sleek militaristic War Frigate
          ctx.beginPath();
          ctx.moveTo(ship.radius + 10, 0); // sharp pointed nose
          ctx.lineTo(ship.radius - 20, -28);
          ctx.lineTo(-ship.radius + 20, -28);
          ctx.lineTo(-ship.radius, -45); // wings
          ctx.lineTo(-ship.radius + 10, -15);
          ctx.lineTo(-ship.radius + 10, 15);
          ctx.lineTo(-ship.radius, 45); // wings
          ctx.lineTo(-ship.radius + 20, 28);
          ctx.lineTo(ship.radius - 20, 28);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Red glowing war strips
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.lineTo(ship.radius - 15, -5);
          ctx.moveTo(0, 20);
          ctx.lineTo(ship.radius - 15, 5);
          ctx.stroke();

        } else if (ship.type === 'mothership') {
          // Colossal spherical/hexagonal mothership
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const rx = Math.cos(angle) * ship.radius;
            const ry = Math.sin(angle) * ship.radius;
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Outer glowing runway lights
          const pulse = Math.abs(Math.sin(Date.now() / 200));
          ctx.fillStyle = `rgba(168, 85, 247, ${0.4 + pulse * 0.6})`;
          ctx.beginPath();
          ctx.arc(-25, -25, 6, 0, Math.PI * 2);
          ctx.arc(25, -25, 6, 0, Math.PI * 2);
          ctx.arc(-25, 25, 6, 0, Math.PI * 2);
          ctx.arc(25, 25, 6, 0, Math.PI * 2);
          ctx.fill();

          // Central core circle
          ctx.strokeStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();

        } else if (ship.type === 'explorer') {
          // Streamlined sensor dish explorer
          ctx.beginPath();
          ctx.moveTo(ship.radius + 5, 0);
          ctx.lineTo(ship.radius - 15, -18);
          ctx.lineTo(-ship.radius + 10, -18);
          ctx.lineTo(-ship.radius, 0);
          ctx.lineTo(-ship.radius + 10, 18);
          ctx.lineTo(ship.radius - 15, 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Sensor dish at the nose
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(ship.radius - 3, 0, 8, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        }

        // Draw engines at the back of the ship
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(-ship.radius - 4, -12, 6, 8);
        ctx.fillRect(-ship.radius - 4, 4, 6, 8);

        // --- DRAW INTERNAL STATIONS IN THE SHIP SPACE ---
        ship.stations.forEach(st => {
          let sx_st = 0;
          let sy_st = 0;

          if (st.id === 'pilot') {
            sx_st = ship.radius * 0.48;
            sy_st = 0;
          } else if (st.id === 'gunner_left') {
            sx_st = 0;
            sy_st = -ship.radius * 0.45;
          } else if (st.id === 'gunner_right') {
            sx_st = 0;
            sy_st = ship.radius * 0.45;
          } else if (st.id === 'engineer') {
            sx_st = -ship.radius * 0.48;
            sy_st = 0;
          }

          // Station terminal ring
          ctx.save();
          ctx.translate(sx_st, sy_st);
          
          let stationColor = '#64748b'; // Slate unassigned color
          let glowColor = 'transparent';
          let assignee = null;

          if (st.assignedPlayerId) {
            assignee = playersRef.current.find(p => p.id === st.assignedPlayerId);
            if (assignee && assignee.hull > 0) {
              stationColor = assignee.color;
              glowColor = assignee.glowColor;
            }
          }

          ctx.strokeStyle = stationColor;
          ctx.fillStyle = '#1e293b';
          ctx.lineWidth = 2.0;
          if (st.assignedPlayerId) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = glowColor;
          }
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw terminal screen light inside the ring
          ctx.fillStyle = st.assignedPlayerId ? stationColor : '#475569';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });

        // --- DRAW TURRETS DRAWING SECTION (LEFT & RIGHT) ---
        ship.stations.forEach(st => {
          if (st.id === 'gunner_left' || st.id === 'gunner_right') {
            const sideY = st.id === 'gunner_left' ? -ship.radius * 0.8 : ship.radius * 0.8;
            
            ctx.save();
            ctx.translate(0, sideY);
            // Rotate turret by st.angle (relative angle)
            ctx.rotate(st.angle);

            // Draw turret base
            ctx.fillStyle = '#334155';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw barrels
            ctx.fillStyle = '#64748b';
            ctx.strokeStyle = '#cbd5e1';
            // double barrels
            ctx.fillRect(0, -5, 18, 3);
            ctx.strokeRect(0, -5, 18, 3);
            ctx.fillRect(0, 2, 18, 3);
            ctx.strokeRect(0, 2, 18, 3);

            ctx.restore();
          }
        });

        ctx.restore(); // end of local rotated scope

        // --- DRAW HULL & SHIELDS HEALTH BARS ---
        const barWidth = 100;
        const barHeight = 6;
        const startX = -barWidth / 2;
        const startY = -ship.radius - 28;

        // Draw Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(startX, startY, barWidth, barHeight);
        ctx.fillRect(startX, startY - 8, barWidth, barHeight);

        // Hull Fill (Red/Green)
        const hullPercent = Math.max(0, Math.min(1, ship.hull / ship.maxHull));
        ctx.fillStyle = hullPercent > 0.45 ? '#10b981' : hullPercent > 0.20 ? '#eab308' : '#ef4444';
        ctx.fillRect(startX, startY, barWidth * hullPercent, barHeight);

        // Shields Fill (Blue)
        if (ship.maxShield > 0) {
          const shieldPercent = Math.max(0, Math.min(1, ship.shield / ship.maxShield));
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(startX, startY - 8, barWidth * shieldPercent, barHeight);
        }

        // Draw labels
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        let CzechClass = 'TĚŽAŘSKÝ KŘIŽNÍK';
        if (ship.type === 'war') CzechClass = 'VÁLEČNÁ FREGATA';
        else if (ship.type === 'mothership') CzechClass = 'MATEŘSKÁ LOĎ';
        else if (ship.type === 'explorer') CzechClass = 'PRŮZKUMNÍK';

        ctx.fillText(CzechClass, 0, -ship.radius - 40);

        // Active Player Labels orbiting the ship
        ship.stations.forEach(st => {
          if (st.assignedPlayerId) {
            const pl = playersRef.current.find(p => p.id === st.assignedPlayerId);
            if (pl && pl.hull > 0) {
              ctx.save();
              ctx.fillStyle = pl.color;
              ctx.font = 'bold 9px monospace';
              let nameOffset = 0;
              if (st.id === 'pilot') nameOffset = ship.radius + 15;
              else if (st.id === 'gunner_left') nameOffset = -ship.radius - 10;
              else if (st.id === 'gunner_right') nameOffset = ship.radius + 10;
              else nameOffset = -ship.radius - 15;

              // compute text position relative to ship
              let tx = 0;
              let ty = 0;
              if (st.id === 'pilot') {
                tx = Math.cos(ship.angle) * nameOffset;
                ty = Math.sin(ship.angle) * nameOffset;
              } else if (st.id === 'gunner_left') {
                tx = Math.cos(ship.angle - Math.PI / 2) * nameOffset;
                ty = Math.sin(ship.angle - Math.PI / 2) * nameOffset;
              } else if (st.id === 'gunner_right') {
                tx = Math.cos(ship.angle + Math.PI / 2) * nameOffset;
                ty = Math.sin(ship.angle + Math.PI / 2) * nameOffset;
              } else {
                tx = Math.cos(ship.angle + Math.PI) * nameOffset;
                ty = Math.sin(ship.angle + Math.PI) * nameOffset;
              }

              ctx.textAlign = 'center';
              ctx.fillText(`${pl.name.replace(" (P_Aktivní)", "").replace(" (P_WASD)", "")}: ${st.name.split(' ')[1]}`, tx, ty);
              ctx.restore();
            }
          }
        });

        ctx.restore();
      };

      const drawPlayerShipWrecked = (p: any, playerNum: 1 | 2, reviveProgress: number) => {
        const sx = p.x - camX;
        const sy = p.y - camY;

        ctx.save();
        ctx.translate(sx, sy);

        if (isBossFightActiveRef.current) {
          // --- DRAW KNEELING ASTRONAUT CHARACTER ---
          ctx.rotate(0.2); // Slouched posture
          ctx.globalAlpha = 0.75;

          const suitColor = '#475569'; // greyed out
          const visorColor = '#3f3f46'; // dark glass

          // Kneeling folded legs on floor
          ctx.fillStyle = '#334155';
          ctx.fillRect(-10, 4, 20, 6);

          // Slouched torso body
          ctx.fillStyle = suitColor;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, -3, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Drooped helmet
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(-2, -12, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Visor looking down
          ctx.fillStyle = visorColor;
          ctx.beginPath();
          ctx.ellipse(-4, -12, 5, 3.5, -Math.PI / 8, 0, Math.PI * 2);
          ctx.fill();

          // Sparks rising from the damaged suit
          if (Math.random() < 0.15) {
            particlesRef.current.push({
              id: Math.random().toString(36).substring(2, 9),
              x: p.x + (Math.random() - 0.5) * 10,
              y: p.y + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 1,
              vy: -1 - Math.random() * 1.5,
              color: '#38bdf8',
              size: Math.random() * 2 + 1,
              alpha: 0.9,
              lifetime: 0,
              maxLifetime: 30
            });
          }

          ctx.restore();

          // Draw reviving indicator
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

          // Detect nearest living player
          let isHelperNear = false;
          playersRef.current.forEach(pl => {
            if (pl.hull > 0 && pl.id !== p.id) {
              const dist = Math.hypot(p.x - pl.x, p.y - pl.y);
              if (dist < 90) {
                isHelperNear = true;
              }
            }
          });

          if (isHelperNear) {
            ctx.fillStyle = '#fbbf24'; // Warning yellow
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('👉 DRŽ MEZERNÍK / SPACE PRO HIGH-FIVE', 0, p.radius + 18);
          } else {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PŘILEŤ PRO OŽIVENÍ', 0, p.radius + 18);
          }

          if (reviveProgress > 0) {
            ctx.save();
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`⚡ OŽIVOVÁNÍ (${Math.round((reviveProgress / 150) * 100)}%)`, 0, -25);
            ctx.restore();
            
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + (reviveProgress / 150) * Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round((reviveProgress / 150) * 100)}%`, 0, -p.radius - 24);
          }
          ctx.restore();
          return;
        }

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

      // --- DRAW CARRIER (MATEŘSKÁ LOĎ) ---
      const hasCarrier = upgrades.carrierClass !== 'none';
      const carrier = carrierRef.current;

      if (hasCarrier) {
        const cx = carrier.x - camX;
        const cy = carrier.y - camY;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(carrier.angle);

        // Draw massive rocket engine flames if moving/thrusting
        const speed = Math.hypot(carrier.vx, carrier.vy);
        if (speed > 0.15) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-carrier.radius + 15, -18);
          ctx.lineTo(-carrier.radius - 25 - Math.random() * 20, 0);
          ctx.lineTo(-carrier.radius + 15, 18);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.moveTo(-carrier.radius + 15, -10);
          ctx.lineTo(-carrier.radius - 12 - Math.random() * 10, 0);
          ctx.lineTo(-carrier.radius + 15, 10);
          ctx.closePath();
          ctx.fill();
        }

        // Draw Titanium-composite main Hull
        ctx.strokeStyle = '#475569';
        ctx.fillStyle = '#1e293b';
        ctx.lineWidth = 3.5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#020617';

        ctx.beginPath();
        // Pointy Nose section
        ctx.moveTo(carrier.radius, 0);
        // Top side fins
        ctx.lineTo(-10, -carrier.radius + 20);
        ctx.lineTo(-carrier.radius + 25, -carrier.radius + 25);
        ctx.lineTo(-carrier.radius + 10, -25);
        // Rear section
        ctx.lineTo(-carrier.radius + 10, 25);
        ctx.lineTo(-carrier.radius + 25, carrier.radius - 25);
        ctx.lineTo(-10, carrier.radius - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw glowing golden bridge/cockpit
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(carrier.radius * 0.45, -8);
        ctx.lineTo(carrier.radius * 0.6, 0);
        ctx.lineTo(carrier.radius * 0.45, 8);
        ctx.lineTo(carrier.radius * 0.32, 0);
        ctx.closePath();
        ctx.fill();

        // Draw wing weapon pods and stripes
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(10, -24);
        ctx.lineTo(-25, -45);
        ctx.moveTo(10, 24);
        ctx.lineTo(-25, 45);
        ctx.stroke();

        ctx.restore();

        // Draw shimmering energy shield sphere
        if (carrier.shield > 0) {
          const shimmer = Math.sin(Date.now() / 140) * 0.03;
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#06b6d4';
          ctx.beginPath();
          ctx.arc(cx, cy, carrier.radius + 12, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, carrier.radius + 16 + shimmer * 120, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Draw Carrier dynamic health bars and status overlay
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const barW = 150;
        const barH = 6;
        const hpPercent = Math.max(0, carrier.hp / carrier.maxHp);

        // Hull HP bar background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(cx - barW / 2, cy - carrier.radius - 22, barW, barH);
        // HP fill
        ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(cx - barW / 2, cy - carrier.radius - 22, barW * hpPercent, barH);

        // Shield bar
        if (carrier.maxShield > 0) {
          const shPercent = Math.max(0, carrier.shield / carrier.maxShield);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(cx - barW / 2, cy - carrier.radius - 14, barW, 4);
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(cx - barW / 2, cy - carrier.radius - 14, barW * shPercent, 4);
        }

        // Title text
        ctx.font = '900 11px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(`MATEŘSKÁ LOĎ: ${upgradesRef.current.carrierClass.toUpperCase()}`, cx, cy - carrier.radius - 36);

        // Crew display list
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        const crewNames = dockedPlayerIdsRef.current.map(id => {
          const pl = playersRef.current.find(p => p.id === id);
          return pl ? pl.name.split(' ')[0] : 'Kosmonaut';
        });
        const crewString = crewNames.length > 0 ? `Posádka: ${crewNames.join(', ')}` : '⚠️ BEZ POSÁDKY (PRÁZDNÝ DOK)';
        ctx.fillText(crewString, cx, cy + carrier.radius + 22);

        // Show prompt to non-docked nearby players
        playersRef.current.forEach(p => {
          if (p.hull > 0 && !dockedPlayerIdsRef.current.includes(p.id)) {
            const dx = p.x - carrier.x;
            const dy = p.y - carrier.y;
            const dist = Math.hypot(dx, dy);
            if (dist < carrier.radius + p.radius + 60) {
              ctx.font = '900 10px monospace';
              ctx.fillStyle = '#fb923c';
              ctx.fillText('STISKNI [SHIFT / E] PRO DOKOVÁNÍ', p.x - camX, p.y - camY - p.radius - 18);
            }
          }
        });

        ctx.restore();
      }

      if (capitalShipModeRef.current && capitalShipRef.current) {
        if (capitalShipRef.current.hull > 0) {
          drawCapitalShip(capitalShipRef.current);
        }
      } else {
        playersRef.current.forEach(p => {
          if (p.hull > 0) {
            // Skip drawing individual ship if docked inside the Carrier!
            if (dockedPlayerIdsRef.current.includes(p.id)) return;
            const pMaxShield = 100 + (upgradesRef.current.shieldLevel - 1) * 35;
            drawPlayerShip(p, p.playerNum, p.hull, p.shield, pMaxShield);
          } else {
            if (playersRef.current.length > 1) {
              drawPlayerShipWrecked(p, p.playerNum, p.reviveTimer);
            }
          }
        });
      }

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

      // --- DRAW BLIZZARD SNOW STORMS OVERLAYS ---
      blizzardZonesRef.current.forEach(bz => {
        const sx = bz.x - camX;
        const sy = bz.y - camY;
        ctx.save();
        ctx.translate(sx, sy);
        
        // Translucent frosted ice wind circle
        const radPulse = bz.radius + Math.sin(Date.now() / 200 + bz.x) * 12;
        const grad = ctx.createRadialGradient(0, 0, radPulse * 0.2, 0, 0, radPulse);
        grad.addColorStop(0, 'rgba(186, 230, 253, 0.22)');
        grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.12)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, radPulse, 0, Math.PI * 2);
        ctx.fill();

        // Draw spinning blizzard lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.8;
        ctx.save();
        ctx.rotate(Date.now() * 0.0008 + bz.x);
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, radPulse * (0.35 + i * 0.2), 0.2, Math.PI * 0.6);
          ctx.stroke();
        }
        ctx.restore();
        
        ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('❄️ BLIZZARD', 0, -radPulse - 8);
        ctx.restore();
      });

      // --- DRAW TOXIC TRAIL BUBBLES ---
      playerTrailBubblesRef.current.forEach(tb => {
        const sx = tb.x - camX;
        const sy = tb.y - camY;
        ctx.save();
        ctx.globalAlpha = tb.alpha;
        ctx.fillStyle = tb.color;
        ctx.shadowBlur = tb.radius * 2;
        ctx.shadowColor = tb.color;
        ctx.beginPath();
        ctx.arc(sx, sy, tb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- DRAW LAVA PROJECTILES ---
      lavaProjectilesRef.current.forEach(lp => {
        const sx = lp.x - camX;
        const sy = lp.y - camY;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(lp.angle);

        // Core fiery heat glow
        ctx.shadowBlur = lp.radius * 3.5;
        ctx.shadowColor = lp.color;
        ctx.fillStyle = lp.color;
        ctx.beginPath();
        ctx.arc(0, 0, lp.radius, 0, Math.PI * 2);
        ctx.fill();

        // Yellow fiery center core
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, lp.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- DRAW FIRE TRAILS LEFT BY GUIDED FIREBALLS ---
      fireTrailsRef.current.forEach(ft => {
        const sx = ft.x - camX;
        const sy = ft.y - camY;
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.shadowBlur = ft.radius * 3;
        ctx.shadowColor = ft.color;
        ctx.beginPath();
        ctx.arc(sx, sy, ft.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- DRAW BOSS GUIDED FIREBALLS ---
      bossGuidedFireballsRef.current.forEach(gf => {
        const sx = gf.x - camX;
        const sy = gf.y - camY;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(gf.angle);

        ctx.shadowBlur = gf.radius * 4;
        ctx.shadowColor = gf.color;
        ctx.fillStyle = gf.color;
        ctx.beginPath();
        ctx.arc(0, 0, gf.radius, 0, Math.PI * 2);
        ctx.fill();

        // White hot center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, gf.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- DRAW BOSS FREEZING PULSES ---
      bossFreezingPulsesRef.current.forEach(fp => {
        const sx = fp.x - camX;
        const sy = fp.y - camY;
        ctx.save();
        ctx.translate(sx, sy);

        // Pulsating icy rings expanding
        ctx.strokeStyle = fp.color;
        ctx.shadowBlur = 18;
        ctx.shadowColor = fp.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, fp.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, fp.radius - 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // --- DRAW BOSS ESCORT DRONES ---
      bossEscortDronesRef.current.forEach(ed => {
        const sx = ed.x - camX;
        const sy = ed.y - camY;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ed.angle);

        ctx.shadowBlur = ed.radius * 2.5;
        ctx.shadowColor = ed.color;
        
        // Steel shielding outer body
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = ed.color;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, ed.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Golden power core eye
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(ed.radius * 0.4, 0, ed.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Tiny red defense laser barrels on sides
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-2, -ed.radius - 3, 4, 3);
        ctx.fillRect(-2, ed.radius, 4, 3);
        ctx.restore();
      });

      ctx.restore(); // Restore context origin shift

      // --- BOSS SPECIAL ATTACK PREPARATION WARNING VIGNETTE ---
      if (isBossFightActiveRef.current && bossRef.current && bossRef.current.state !== 'intro') {
        const boss = bossRef.current;
        const timeSinceLastValuable = Date.now() - (boss.lastValuableMove || 0);
        // Warning triggers 2.5 seconds before the attack
        if (timeSinceLastValuable > 9500 && timeSinceLastValuable <= 12000) {
          const timeLeftSec = ((12000 - timeSinceLastValuable) / 1000).toFixed(1);
          const progress = (timeSinceLastValuable - 9500) / 2500; // 0 to 1
          
          // Flash effect: pulse frequency increases as we get closer to trigger
          const pulseFrequency = 5 + progress * 20; // 5Hz to 25Hz
          const flashIntensity = 0.35 + 0.35 * Math.sin((Date.now() / 1000) * pulseFrequency * Math.PI * 2);
          const alpha = flashIntensity * progress; // grows stronger as trigger approaches

          ctx.save();
          // Draw a radial gradient centered in the viewport
          const grad = ctx.createRadialGradient(
            vx + vw / 2, vy + vh / 2, Math.min(vw, vh) * 0.2, // inner circle
            vx + vw / 2, vy + vh / 2, Math.max(vw, vh) * 0.7  // outer circle
          );
          // Red glowing vignette edges
          grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
          grad.addColorStop(0.5, `rgba(239, 68, 68, ${alpha * 0.18})`);
          grad.addColorStop(1, `rgba(220, 38, 38, ${alpha * 0.75})`);

          ctx.fillStyle = grad;
          ctx.fillRect(vx, vy, vw, vh);

          // Draw neon warning line along the viewport edges
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.lineWidth = 4 + 3 * Math.sin(Date.now() / 100 * (5 + progress * 10));
          ctx.strokeRect(vx + 2, vy + 2, vw - 4, vh - 4);

          // Menacing alert text centered at the top of the viewport
          ctx.font = '900 14px monospace';
          ctx.fillStyle = '#f87171';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.textAlign = 'center';
          
          const warningMsg = `⚠️ POZOR: KOSMICKÝ GEJZÍR ZA ${timeLeftSec}s ⚠️`;
          ctx.strokeText(warningMsg, vx + vw / 2, vy + 45);
          ctx.fillText(warningMsg, vx + vw / 2, vy + 45);

          ctx.restore();
        }
      }

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

    // --- DRAW TRANSPARENT COCKPIT RADAR MINIMAP ---
    if (playersRef.current.length > 0) {
      const centerPlayer = playersRef.current.find(pl => pl.hull > 0) || playersRef.current[0];
      if (centerPlayer) {
        ctx.save();
        const size = 150;
        const margin = 25;
        const cx = width - 75 - margin;
        const cy = height - 75 - margin - 35; // offset slightly upwards to stay clear of other frames
        
        // Background dark circle
        ctx.beginPath();
        ctx.arc(cx, cy, 75, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fill();
        
        // Neon green-blue cyber border
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Glow effect
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#06b6d4';
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
        
        // Crosshair lines
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(cx - 75, cy);
        ctx.lineTo(cx + 75, cy);
        ctx.moveTo(cx, cy - 75);
        ctx.lineTo(cx, cy + 75);
        ctx.stroke();

        // Moving sweep arm effect
        const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 75, sweepAngle, sweepAngle + 0.25);
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
        ctx.fill();

        // Scale factor: Radar ranges up to 2500 pixels
        const radarRange = 2500;
        const scale = 75 / radarRange;

        if (emStormActiveRef.current) {
          // Draw fuzzy static noise over radar area
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, 74, 0, Math.PI * 2);
          ctx.clip();
          
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 1.0;
          for (let i = 0; i < 15; i++) {
            const ry = cy - 75 + Math.random() * 150;
            ctx.beginPath();
            ctx.moveTo(cx - 75, ry);
            ctx.lineTo(cx + 75, ry + (Math.random() - 0.5) * 16);
            ctx.stroke();
          }

          // Random white/grey static noise pixels
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          for (let i = 0; i < 45; i++) {
            const rx = cx - 75 + Math.random() * 150;
            const ry = cy - 75 + Math.random() * 150;
            ctx.fillRect(rx, ry, 1.8, 1.8);
          }
          ctx.restore();

          // Error warning message
          const isBlinking = Math.floor(Date.now() / 250) % 2 === 0;
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isBlinking ? '#f43f5e' : '#78716c';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ SIGNAL ERROR ⚡', cx, cy + 3);

          // Outer red blinking hazard frame
          ctx.strokeStyle = isBlinking ? '#f43f5e' : '#991b1b';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(cx, cy, 75, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Draw Asteroids on Radar
          asteroidsRef.current.forEach(ast => {
            const dx = ast.x - centerPlayer.x;
            const dy = ast.y - centerPlayer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radarRange) {
              const ax = cx + dx * scale;
              const ay = cy + dy * scale;
              ctx.beginPath();
              ctx.arc(ax, ay, Math.max(1.5, ast.radius * 0.08), 0, Math.PI * 2);
              if (ast.asteroidType === 'magma') {
                ctx.fillStyle = '#f97316'; // orange magma
              } else if (ast.asteroidType === 'ice') {
                ctx.fillStyle = '#38bdf8'; // blue ice
              } else if (ast.asteroidType === 'gold' || ast.asteroidType === 'legendary') {
                ctx.fillStyle = '#eab308'; // gold
              } else {
                ctx.fillStyle = '#94a3b8'; // grey default
              }
              ctx.fill();
            }
          });

          // Draw Pirates on Radar
          piratesRef.current.forEach(pirate => {
            const dx = pirate.x - centerPlayer.x;
            const dy = pirate.y - centerPlayer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radarRange) {
              const px = cx + dx * scale;
              const py = cy + dy * scale;
              
              // Pulsating red dot for threats
              const pulse = 1.0 + Math.sin(Date.now() / 150) * 0.3;
              ctx.beginPath();
              ctx.arc(px, py, 3.5 * pulse, 0, Math.PI * 2);
              ctx.fillStyle = '#ef4444';
              ctx.fill();
              
              ctx.strokeStyle = '#f43f5e';
              ctx.lineWidth = 1.0;
              ctx.stroke();
            }
          });

          // Draw Boss on Radar (large threat!)
          if (isBossFightActiveRef.current && bossRef.current) {
            const boss = bossRef.current;
            const dx = boss.x - centerPlayer.x;
            const dy = boss.y - centerPlayer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radarRange) {
              const bx = cx + dx * scale;
              const by = cy + dy * scale;
              
              // Flashing heavy red ring
              const flash = Date.now() % 400 < 200;
              ctx.beginPath();
              ctx.arc(bx, by, 7.0, 0, Math.PI * 2);
              ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.8)' : 'rgba(244, 63, 94, 0.3)';
              ctx.fill();
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Core dot
              ctx.beginPath();
              ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
            }
          }

          // Draw Player and co-pilots
          playersRef.current.forEach(p => {
            if (p.hull > 0) {
              const dx = p.x - centerPlayer.x;
              const dy = p.y - centerPlayer.y;
              const dist = Math.hypot(dx, dy);
              if (dist < radarRange) {
                const px = cx + dx * scale;
                const py = cy + dy * scale;
                
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.8;
                ctx.stroke();
              }
            }
          });

          // Draw High-Value Ores on Radar when scan is active
          if (scanActiveTicksRef.current > 0) {
            oresRef.current.forEach(ore => {
              if (ore.type === 'diamond' || ore.type === 'obsidian') {
                const dx = ore.x - centerPlayer.x;
                const dy = ore.y - centerPlayer.y;
                const dist = Math.hypot(dx, dy);
                if (dist < radarRange) {
                  const ox = cx + dx * scale;
                  const oy = cy + dy * scale;

                  ctx.beginPath();
                  ctx.arc(ox, oy, 6.0, 0, Math.PI * 2);
                  ctx.fillStyle = ore.type === 'diamond' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(168, 85, 247, 0.45)';
                  ctx.fill();

                  const blink = Math.floor(Date.now() / 150) % 2 === 0;
                  ctx.strokeStyle = blink ? '#ffffff' : (ore.type === 'diamond' ? '#38bdf8' : '#a855f7');
                  ctx.lineWidth = 1.0;
                  
                  ctx.beginPath();
                  ctx.arc(ox, oy, 4.0, 0, Math.PI * 2);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.moveTo(ox - 6, oy); ctx.lineTo(ox - 2, oy);
                  ctx.moveTo(ox + 2, oy); ctx.lineTo(ox + 6, oy);
                  ctx.moveTo(ox, oy - 6); ctx.lineTo(ox, oy - 2);
                  ctx.moveTo(ox, oy + 2); ctx.lineTo(ox, oy + 6);
                  ctx.stroke();
                }
              }
            });

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, 74, 0, Math.PI * 2);
            ctx.clip();

            const scanY = cy - 74 + ((Date.now() / 6) % 148);
            const scanGrad = ctx.createLinearGradient(0, scanY - 12, 0, scanY);
            scanGrad.addColorStop(0, 'rgba(168, 85, 247, 0.0)');
            scanGrad.addColorStop(1, 'rgba(168, 85, 247, 0.22)');
            ctx.fillStyle = scanGrad;
            ctx.fillRect(cx - 74, scanY - 12, 148, 12);

            ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx - 74, scanY);
            ctx.lineTo(cx + 74, scanY);
            ctx.stroke();

            ctx.restore();
          }

          // --- ENHANCED MINIMAP: RESOURCE PATHS & WARNING SECTORS ---
          let nearestResource: { x: number; y: number; label: string; color: string; dist: number } | null = null;
          let minDist = Infinity;

          oresRef.current.forEach(ore => {
            const d = Math.hypot(ore.x - centerPlayer.x, ore.y - centerPlayer.y);
            if (d < minDist) {
              minDist = d;
              nearestResource = {
                x: ore.x,
                y: ore.y,
                label: ore.type === 'diamond' ? '💎' : ore.type === 'obsidian' ? '🔮' : '✨',
                color: ore.type === 'diamond' ? '#38bdf8' : ore.type === 'obsidian' ? '#c084fc' : '#22d3ee',
                dist: Math.round(d / 10)
              };
            }
          });

          if (!nearestResource) {
            asteroidsRef.current.forEach(ast => {
              if (['gold', 'legendary', 'magma', 'ice'].includes(ast.asteroidType)) {
                const d = Math.hypot(ast.x - centerPlayer.x, ast.y - centerPlayer.y);
                if (d < minDist) {
                  minDist = d;
                  nearestResource = {
                    x: ast.x,
                    y: ast.y,
                    label: ast.asteroidType === 'gold' ? '🟡' : ast.asteroidType === 'magma' ? '🔥' : '❄️',
                    color: ast.asteroidType === 'gold' ? '#eab308' : ast.asteroidType === 'magma' ? '#f97316' : '#38bdf8',
                    dist: Math.round(d / 10)
                  };
                }
              }
            });
          }

          if (nearestResource) {
            const res = nearestResource as { x: number; y: number; label: string; color: string; dist: number };
            const dx = res.x - centerPlayer.x;
            const dy = res.y - centerPlayer.y;
            const targetRx = cx + Math.max(-70, Math.min(70, dx * scale));
            const targetRy = cy + Math.max(-70, Math.min(70, dy * scale));

            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.lineDashOffset = -Date.now() / 40;
            ctx.strokeStyle = res.color;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = res.color;
            ctx.shadowBlur = 4;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(targetRx, targetRy);
            ctx.stroke();
            ctx.restore();

            // Distance Tag Badge
            ctx.save();
            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = res.color;
            ctx.textAlign = 'center';
            ctx.fillText(`${res.label} ${res.dist}m`, targetRx, targetRy - 6);
            ctx.restore();
          }

          // 2. Solar Storm Hazard Warning Sector Overlay
          if (solarStormActiveRef.current || solarStormTimeRef.current <= 900) {
            const dir = solarStormDirectionRef.current || (Math.PI * 0.5);
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, 74, dir - 0.5, dir + 0.5);
            ctx.lineTo(cx, cy);
            ctx.closePath();
            ctx.fillStyle = solarStormActiveRef.current ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.18)';
            ctx.fill();

            ctx.strokeStyle = solarStormActiveRef.current ? '#ef4444' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = solarStormActiveRef.current ? '#ef4444' : '#f59e0b';
            ctx.textAlign = 'center';
            const warnText = solarStormActiveRef.current ? '⚠️ BOUŘE' : '⚠️ VAROVÁNÍ';
            ctx.fillText(warnText, cx + Math.cos(dir) * 45, cy + Math.sin(dir) * 45);
            ctx.restore();
          }

          if (scanActiveTicksRef.current > 0) {
            const remainingS = (scanActiveTicksRef.current / 60).toFixed(1);
            ctx.font = '900 8px monospace';
            ctx.fillStyle = '#a855f7';
            ctx.textAlign = 'center';
            ctx.fillText(`📡 SKEN: ${remainingS}s`, cx, cy - 65);
          } else {
            if (stationaryTicksRef.current > 0) {
              const chargePct = Math.min(1.0, stationaryTicksRef.current / 120);
              ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
              ctx.lineWidth = 2.0;
              ctx.beginPath();
              ctx.arc(cx, cy, 74.5, -Math.PI / 2, -Math.PI / 2 + chargePct * Math.PI * 2);
              ctx.stroke();

              ctx.font = 'bold 7px monospace';
              ctx.fillStyle = '#a855f7';
              ctx.textAlign = 'center';
              ctx.fillText(`KALIBRACE...`, cx, cy + 65);
            }
          }
        }

        // Map label overlay
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#06b6d4';
        ctx.textAlign = 'center';
        ctx.fillText('RADAR SCANNER', cx, cy - 82);
        
        ctx.font = '600 7px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText('DOSAH: 2.5K KM', cx, cy + 86);
        ctx.restore();
      }
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
          <div className="w-full flex justify-between items-start gap-4 relative">
            
            {/* ABSOLUTE CENTER TOP: Boss Health Bar or Map Sector Badge */}
            {isBossFightActive ? (
              <div className="absolute left-1/2 -translate-x-1/2 top-0 max-w-[420px] w-[90%] sm:w-full bg-slate-950/95 border border-red-500/30 rounded-2xl px-4 py-2.5 flex flex-col items-center justify-center shadow-[0_10px_35px_rgba(239,68,68,0.2)] pointer-events-auto backdrop-blur-sm z-30 animate-fade-in">
                <div className="w-full flex justify-between items-center text-[10px] font-black tracking-wider text-red-400 font-sans leading-none mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    <span>👑 OMEGA KORZÁR (BOSS)</span>
                  </div>
                  <span className="font-mono text-red-300 font-bold">{Math.ceil(bossHp)} / {bossMaxHp} HP</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full border border-slate-800/80 overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                    style={{ width: `${Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100))}%` }}
                  />
                </div>
                <div className="w-full flex justify-between items-center text-[8px] font-mono text-slate-400 mt-1.5 leading-none">
                  <span>ŽIVOTY: <span className="text-[10px] tracking-normal">{Array.from({ length: bossMaxLives }).map((_, i) => i < bossLives ? "🔥" : "🖤").join(" ")}</span></span>
                  <span className="text-orange-400 font-bold">REGEN: +{bossHp < bossMaxHp ? 250 + (6 - bossLives) * 180 : 0} HP/s</span>
                </div>
              </div>
            ) : (
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5 pointer-events-auto bg-slate-950/90 border border-slate-800/80 rounded-full px-4.5 py-1.5 flex items-center gap-2 shadow-2xl backdrop-blur-xs select-none z-30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[9px] font-black tracking-widest text-slate-200 font-mono uppercase">
                  {selectedMap === 'silicon' && "🛰️ SEKTOR ALPHA: KŘEMÍKOVÝ PÁS"}
                  {selectedMap === 'magma' && "🔥 SEKTOR BETA: MAGMATICKÉ PEKLO"}
                  {selectedMap === 'ice' && "❄️ SEKTOR GAMMA: LEDOVÝ PRSTENEC"}
                  {selectedMap === 'gold' && "👑 SEKTOR DELTA: ZLATÉ JÁDRO"}
                </span>
              </div>
            )}

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

              {/* Prestige NG+ badge if active */}
              {stats.prestigeCount && stats.prestigeCount > 0 ? (
                <>
                  <div className="w-[1px] h-6 bg-slate-800 shadow-inner mx-1 self-center" />
                  <div className="flex items-center gap-1.5" title={`Prestiž Úroveň ${stats.prestigeCount} (Trvalý bonus +${stats.prestigeCount * 15}% k rychlosti lodi, magnetickému přitahování a bodům)`}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-amber-400 font-bold leading-none uppercase tracking-wider">Prestiž</span>
                      <span className="text-xs font-black text-amber-300 font-mono mt-0.5">NG+{stats.prestigeCount}</span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Live Score block & Combo Multiplier stack */}
            <div className="flex flex-col items-end gap-2">
              <div className="bg-slate-950/85 border border-slate-800 rounded-2xl px-5 py-2.5 flex flex-col items-end shadow-xl min-w-[120px]">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none">SKÓRE</span>
                <AnimatedScore value={currentScore} className="text-xl font-black text-amber-400 font-mono mt-1 tracking-tight" />
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
                  <Award className="w-3 h-3 text-slate-500" />
                  <span>Nejlepší: {stats.highScore}</span>
                </div>
              </div>

              {/* Combo Multiplier Badge with time countdown */}
              {comboMultiplier > 1 && (
                <div className="bg-gradient-to-r from-amber-600 to-red-600 border border-amber-400 rounded-2xl px-4 py-2 flex flex-col items-center justify-center shadow-2xl animate-pulse pointer-events-auto min-w-[140px]">
                  <span className="text-[9px] font-black text-amber-200 tracking-widest uppercase font-sans">🔥 COMBO NÁSOBIČ</span>
                  <span className="text-2xl font-black text-white mt-0.5 font-mono">
                    x{comboMultiplier}
                  </span>
                  <div className="w-full h-1 bg-slate-950/40 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-75"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((4000 - (Date.now() - lastAsteroidDestroyedTimeRef.current)) / 4000) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* COMBAT TELEMETRY LOG */}
          <div className="absolute left-4 bottom-[240px] pointer-events-auto flex flex-col gap-1.5 max-w-[320px] bg-slate-950/80 border border-slate-800 px-3.5 py-3 rounded-2xl shadow-2xl backdrop-blur-xs select-none font-mono text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5 font-sans font-extrabold text-[10px] text-cyan-400 uppercase tracking-widest border-b border-slate-800/80 pb-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>📡 KOSMICKÝ BOJOVÝ PROTOKOL</span>
            </div>
            {combatLog.length === 0 ? (
              <span className="text-slate-600 italic">Systémy trupu stabilní. Žádné kolize.</span>
            ) : (
              <div className="flex flex-col gap-1 max-h-[105px] overflow-y-auto scrollbar-thin">
                {combatLog.map((log) => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString('cs-CZ', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={log.id} className="flex gap-1.5 leading-normal animate-fade-in" style={{ color: log.color }}>
                      <span className="text-slate-500 font-medium font-mono">[{timeStr}]</span>
                      <span className="font-semibold">{log.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
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

              {/* Ability 4: Smradlavá ponožka (Y/Z) */}
              <div className={`relative flex items-center gap-2 px-3 py-2 border rounded-xl font-mono text-xs transition-all ${
                upgrades.abilitySockLevel > 0 
                  ? 'bg-slate-950/90 border-lime-500/25 text-lime-300' 
                  : 'bg-slate-950/40 border-slate-900/40 text-slate-600 opacity-40'
              }`}>
                <div className="flex items-center justify-center w-5 h-5 rounded bg-lime-500/15 text-lime-400 font-extrabold text-[10px]">Y</div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[11px] text-slate-200 leading-none">Smradlavá ponožka</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Lvl {upgrades.abilitySockLevel || 'Locked'}</span>
                </div>
                {sockCooldown > 0 && (
                  <div className="absolute inset-0 bg-slate-950/90 rounded-xl flex items-center justify-center font-bold text-red-500 border border-red-500/30">
                    {sockCooldown}s
                  </div>
                )}
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
            <button 
              onClick={() => {
                const cur = sectors.find(s => s.id === currentSectorId);
                setSelectedMapSector(cur || sectors[0]);
                setIsMapOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-violet-600/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              id="hud-open-map-button"
            >
              <Map className="w-4 h-4" />
              Sektorová Mapa 🌌
            </button>
            <button 
              onClick={() => setIsMissionsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-950/90 hover:bg-violet-900 border border-violet-500/40 text-violet-200 font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-500/10 cursor-pointer hover:scale-105 active:scale-95 transition-all relative"
              id="hud-open-missions-button"
            >
              <Target className="w-4 h-4 text-violet-400" />
              Mise
              {missions.filter(m => m.completed && !m.claimed).length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5 border border-slate-950" />
              )}
            </button>
            <button 
              onClick={() => setIsEarningsChartOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/10 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              id="hud-open-earnings-chart-button"
            >
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Graf Výdělků
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
                <p className="text-cyan-400 font-bold border-b border-slate-900 pb-0.5 text-[10px]">Hráč 1 (Modrý - Šipky):</p>
                <p>• <b>Pohyb:</b> Šipky [ ↑ / ↓ ] (Let / Zpět)</p>
                <p>• <b>Rotace:</b> Šipky [ ← / → ]</p>
                <p>• <b>Laser:</b> [ Mezerník ] / [ Pravý CTRL ]</p>
                <p>• <b>Kotvení:</b> Klávesa [ H ] nebo [ 0 ]</p>
                
                <p className="text-purple-400 font-bold border-b border-slate-900 pb-0.5 pt-1 text-[10px]">Hráč 2 (Fialový - WASD):</p>
                <p>• <b>Pohyb:</b> Klávesy [ W / S ] (Let / Zpět)</p>
                <p>• <b>Rotace:</b> Klávesy [ A / D ]</p>
                <p>• <b>Laser:</b> [ Levý CTRL ] / [ F ] / [ Mezerník ]</p>
                <p>• <b>Kotvení:</b> Klávesa [ G ] nebo [ 4 ]</p>

                <p className="text-emerald-400 font-bold border-b border-slate-900 pb-0.5 pt-1 text-[10px]">Ovladač (Gamepad):</p>
                <p>• <b>Let vpřed:</b> Levý Trigger [ LT ]</p>
                <p>• <b>Směr letu:</b> Levá páčka</p>
                <p>• <b>Otáčení lodi:</b> Pravá páčka</p>
                <p>• <b>Laser (Střelba):</b> Pravý Trigger [ RT ]</p>
                <p>• <b>Útoky (Schopnosti):</b> Tlačítka [ X, Y, B ]</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-900 pt-1">Hráči se mohou připojovat dynamicky stisknutím libovolného tlačítka!</p>
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
                      <AnimatedHealth value={p.hull} maxValue={pMaxHull} className="font-bold" style={{ color: p.color }} />
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
                        <AnimatedHealth value={p.shield} maxValue={pMaxShield} className="font-bold" style={{ color: p.glowColor }} isShield />
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
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.4, ease: "easeInOut" } }}
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
                  <p>• <b>Pohyb:</b> Šipky [ ↑ / ↓ ] (Let / Zpět)</p>
                  <p>• <b>Otáčení:</b> Šipky [ ← / → ]</p>
                  <p>• <b>Laser:</b> Pravý CTRL / Mezerník</p>
                  <p>• <b>Kotva:</b> Klávesa [ H ] nebo [ 0 ]</p>
                  <p>• <b>Dovednosti:</b> Čísla [ 9, 8, 7, 6 ]</p>
                </div>

                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850/80">
                  <span className="text-purple-400 font-black block border-b border-slate-950 pb-1 mb-1.5 text-[10px]">⌨️ PILOT 2 (KLÁVESNICE - WASD)</span>
                  <p>• <b>Pohyb:</b> Klávesy [ W / S ] (Let / Zpět)</p>
                  <p>• <b>Otáčení:</b> Klávesy [ A / D ]</p>
                  <p>• <b>Laser:</b> Levý CTRL / [ F ] / Mezerník</p>
                  <p>• <b>Kotva:</b> Klávesa [ G ] nebo [ 4 ]</p>
                  <p>• <b>Dovednosti:</b> [ Q, E, R, T ] nebo [ 1, 2, 3, 5 ]</p>
                </div>
              </div>

              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-850/80 text-[11px] text-slate-300 leading-relaxed font-sans">
                <span className="text-emerald-400 font-extrabold block border-b border-slate-950 pb-1 mb-1.5 text-[10px] uppercase">🎮 PILOTI NA OVLADAČÍCH (GAMEPADECH / STEAM DECKU)</span>
                <p>• Připojte gamepad a stiskněte jakékoli tlačítko pro automatický drop-in!</p>
                <p className="mt-1.5 pt-1.5 border-t border-slate-900/60 font-mono text-[10px] text-slate-400 space-y-0.5">
                  • <b>Let vpřed:</b> Levý Trigger [ LT ]<br/>
                  • <b>Laser (Střelba):</b> Pravý Trigger [ RT ]<br/>
                  • <b>Směr letu:</b> Levá analogová páčka<br/>
                  • <b>Otáčení lodičky:</b> Pravá analogová páčka<br/>
                  • <b>Speciální útoky (Schopnosti):</b> Tlačítka [ X, Y, B ]
                </p>
              </div>

              {/* Gamepad connection status detection */}
              {gamepadsDetected.some(x => x) ? (
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

            {/* Mission Configuration Panel */}
            <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl space-y-4 text-left">
              <span className="text-cyan-400 font-extrabold uppercase tracking-wider text-[10px] block font-sans">🛡️ NASTAVENÍ EXPEDIČNÍ MISE</span>
              
              {/* Difficulty Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Obtížnost:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDifficulty('easy');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-center items-center ${
                      difficulty === 'easy'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      SNADNÁ
                    </span>
                    <span className="text-[8px] text-slate-500 mt-0.5">Vrtání +50%, Škody -50%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDifficulty('medium');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-center items-center ${
                      difficulty === 'medium'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)] font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      STŘEDNÍ
                    </span>
                    <span className="text-[8px] text-slate-500 mt-0.5">Klasický zážitek</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDifficulty('hard');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-center items-center ${
                      difficulty === 'hard'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      TĚŽKÁ
                    </span>
                    <span className="text-[8px] text-slate-500 mt-0.5">Vrtání -20%, Škody +50%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDifficulty('nightmare');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-center items-center ${
                      difficulty === 'nightmare'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)] font-bold animate-pulse'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-rose-950/40 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-rose-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      NOČNÍ MŮRA
                    </span>
                    <span className="text-[8px] text-rose-500/80 mt-0.5">Škody +120%, Dual-Lasery</span>
                  </button>
                </div>
              </div>

              {/* Map / Sector Selection */}
              <div className="space-y-2 pt-2.5 border-t border-slate-900">
                <label className="text-xs font-bold text-slate-300 block">Kosmický Sektor (Mapa):</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap('silicon');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      selectedMap === 'silicon'
                        ? 'bg-slate-900 border-slate-500 text-slate-200 shadow-[0_0_12px_rgba(148,163,184,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🪨</span>
                      <span className="font-bold tracking-tight text-slate-300">SEKTOR ALPHA: KŘEMÍKOVÝ PÁS</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Standardní pás s vyváženým výskytem všech surovin. Bezpečný start. (1.0x skóre)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap('magma');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      selectedMap === 'magma'
                        ? 'bg-orange-950/20 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🔥</span>
                      <span className="font-bold tracking-tight text-orange-300">SEKTOR BETA: MAGMATICKÉ PEKLO</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Zvýšený výskyt magmatických skál s drahým obsidiánem. <span className="text-orange-400 font-bold">Anomálie: Solární erupce (lávové střely).</span> (1.25x skóre)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap('ice');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      selectedMap === 'ice'
                        ? 'bg-sky-950/20 border-sky-500 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">❄️</span>
                      <span className="font-bold tracking-tight text-sky-300">SEKTOR GAMMA: LEDOVÝ PRSTENEC</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Těžařská zóna s masivním podílem ledových jader a diamantů. <span className="text-sky-400 font-bold">Anomálie: Blizzardy (námraza lodě zpomaluje, roztaje střelbou!).</span> (1.25x skóre)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap('gold');
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      selectedMap === 'gold'
                        ? 'bg-amber-950/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">👑</span>
                      <span className="font-bold tracking-tight text-amber-300 font-black">SEKTOR DELTA: ZLATÉ JÁDRO</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Masivní naleziště ryzího zlata. Agresivní ochrana. <span className="text-amber-400 font-bold">Anomálie: Elektromagnetické bouře (výpadek radaru a magnetu).</span> (1.5x skóre)
                    </div>
                  </button>
                </div>
              </div>

              {/* Enemy Toggle Option */}
              <div className="flex items-center justify-between bg-slate-900/35 p-2.5 rounded-lg border border-slate-850">
                <div className="space-y-0.5 pr-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    🛡️ Nepřátelské lodě a korzáři:
                    <span className={`px-1.5 py-0.5 text-[8px] font-mono font-black uppercase rounded ${
                      enemiesEnabled ? 'bg-red-950 text-red-400 border border-red-900/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/50'
                    }`}>
                      {enemiesEnabled ? 'AKTIVNÍ' : 'DEAKTIVOVÁNO'}
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Pokud jsou deaktivováni, nebudou se v sektoru objevovat žádné pirátské lodě, což umožňuje klidnou těžbu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEnemiesEnabled(!enemiesEnabled);
                    playLaserSound(0);
                  }}
                  className={`w-12 h-6 rounded-full p-0.5 transition-all cursor-pointer outline-none relative flex items-center shrink-0 ${
                    enemiesEnabled ? 'bg-red-600' : 'bg-slate-800'
                  }`}
                  id="enemies-toggle-btn"
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-200 ${
                    enemiesEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Performance Mode Option */}
              <div className="flex items-center justify-between bg-slate-900/35 p-2.5 rounded-lg border border-slate-850">
                <div className="space-y-0.5 pr-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Úsporný režim (Steam Deck / Mobil):
                    <span className={`px-1.5 py-0.5 text-[8px] font-mono font-black uppercase rounded ${
                      lowPerformanceMode ? 'bg-cyan-950 text-cyan-400 border border-cyan-900/50 animate-pulse' : 'bg-slate-950 text-slate-400 border border-slate-900/50'
                    }`}>
                      {lowPerformanceMode ? 'ZAPNUTO (PLYNULÉ)' : 'VYPNUTO (KLASICKÉ)'}
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Vypne náročné zářící efekty a stíny, zredukuje nadbytečné efekty výbuchů a stabilizuje snímkovou frekvenci (FPS) na Steam Decku či mobilech.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLowPerformanceMode(!lowPerformanceMode);
                    playLaserSound(0);
                  }}
                  className={`w-12 h-6 rounded-full p-0.5 transition-all cursor-pointer outline-none relative flex items-center shrink-0 ${
                    lowPerformanceMode ? 'bg-cyan-600' : 'bg-slate-800'
                  }`}
                  id="performance-toggle-btn"
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-200 ${
                    lowPerformanceMode ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Capital Ship Mode Toggle and Class Selector */}
              <div className="space-y-3 pt-2.5 border-t border-slate-900">
                <label className="text-xs font-bold text-slate-300 block">Formace flotily a styl lodi:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCapitalShipMode(false);
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      !capitalShipMode
                        ? 'bg-slate-900 border-indigo-500 text-slate-200 shadow-[0_0_12px_rgba(99,102,241,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🛸</span>
                      <span className="font-bold tracking-tight text-indigo-300">FLOTILA MALÝCH LODÍ</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Klasický styl. Každý hráč ovládá a střílí ze své vlastní malé obratné lodičky.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCapitalShipMode(true);
                      playLaserSound(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      capitalShipMode
                        ? 'bg-indigo-950/30 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-bold'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🚢</span>
                      <span className="font-bold tracking-tight text-cyan-300">SPOLEČNÁ VELKÁ LOĎ (MULTICREW)</span>
                    </div>
                    <div className="text-[8px] leading-tight mt-1 text-slate-400 font-sans">
                      Styl Lovers in a Dangerous Spacetime. Všichni sdílí jednu velkou loď, obsazují stanice (Kormidelník, Střelci, Inženýr) a doplňují se!
                    </div>
                  </button>
                </div>

                {capitalShipMode && (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-850/80 space-y-2"
                  >
                    <span className="text-cyan-400 font-bold uppercase tracking-wider text-[9px] block">Vyberte třídu Velké Lodě:</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCapitalShipType('mining');
                          playLaserSound(0);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedCapitalShipType === 'mining'
                            ? 'bg-amber-950/20 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <span className="font-bold">⛏️ Těžařský křižník</span>
                        <p className="text-[8px] font-sans text-slate-400 mt-1 leading-snug">
                          • Trvanlivost: Vysoká (600 HP)<br/>
                          • Vrták, Silný magnet a extra náklad
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCapitalShipType('war');
                          playLaserSound(0);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedCapitalShipType === 'war'
                            ? 'bg-red-950/20 border-red-500 text-red-300 font-bold'
                            : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <span className="font-bold">🚀 Válečná fregata</span>
                        <p className="text-[8px] font-sans text-slate-400 mt-1 leading-snug">
                          • Trvanlivost: Střední (500 HP, 350 štít)<br/>
                          • 3x laser + automatický raketomet
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCapitalShipType('mothership');
                          playLaserSound(0);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedCapitalShipType === 'mothership'
                            ? 'bg-purple-950/20 border-purple-500 text-purple-300 font-bold'
                            : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <span className="font-bold">🛰️ Mateřská loď (Stoupa)</span>
                        <p className="text-[8px] font-sans text-slate-400 mt-1 leading-snug">
                          • Trvanlivost: Obrovská (800 HP, 400 štít)<br/>
                          • 4x stanice + drony, hangáry
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCapitalShipType('explorer');
                          playLaserSound(0);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedCapitalShipType === 'explorer'
                            ? 'bg-emerald-950/20 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <span className="font-bold">📡 Průzkumník</span>
                        <p className="text-[8px] font-sans text-slate-400 mt-1 leading-snug">
                          • Trvanlivost: Menší (300 HP)<br/>
                          • Rychlý, nízká spotřeba, laser + vrták
                        </p>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Launch Actions */}
            <div className="space-y-3 flex flex-col items-center">
              <button
                onClick={() => handleStartGame()}
                className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/10 cursor-pointer hover:scale-105 active:scale-95 transition-all text-center"
                id="portal-launch-run-btn"
              >
                <Play className="w-4 h-4 fill-current" />
                Spustit Motory a Vzlétnout
              </button>

              {upgrades.blackHoleActivator === 1 && (
                <button
                  onClick={() => handleStartGame(true)}
                  className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-red-500/30 cursor-pointer hover:scale-105 active:scale-95 transition-all text-center animate-pulse border border-red-400"
                  id="portal-boss-launch-btn"
                >
                  <Skull className="w-4 h-4" />
                  Aktivovat Černou Díru & Bojovat s Bossem
                </button>
              )}

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
        </motion.div>
      )}
      </AnimatePresence>

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

      {/* --- BOSS DEFEAT TELEPORTATION MODAL --- */}
      {showBossDefeatModal && (
        <div className="absolute inset-0 z-35 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-red-500 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.25)] p-6 text-center space-y-6 text-slate-100">
            <div className="space-y-1">
              <div className="w-20 h-20 bg-red-950/40 border border-red-500 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
                <Skull className="w-10 h-10 animate-bounce" />
              </div>
              <h2 className="text-2xl font-black text-red-500 tracking-tight uppercase pt-2">
                PORÁŽKA V DIMENZI BOSSE!
              </h2>
              <p className="text-xs text-red-400 font-mono">Teleportace selhala - Nouzový návrat úspěšný</p>
            </div>

            <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl space-y-4 text-left text-sm">
              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                Byli jste poraženi <b>Generálem Korzárů</b>. Síla černé díry vás sice teleportovala zpět do bezpečí naší dimenze, ale váš <b className="text-purple-400">fázový aktivátor černé díry (Black Hole Activator)</b> byl při tomto procesu přetížen a zcela <b>ZNIČEN!</b>
              </p>
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-xs text-red-300 font-medium">
                ⚠️ Musíte získat nový aktivátor v Obchodě za Diamanty a Obsidián, abyste se mohli pokusit o odvetu!
              </div>
            </div>

            <button
              onClick={() => {
                setShowBossDefeatModal(false);
                setShowIntro(true);
              }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg hover:scale-[1.01]"
              id="boss-defeat-ok-btn"
            >
              Návrat do bezpečné zóny
            </button>
          </div>
        </div>
      )}

      {/* --- BOSS VICTORY MODAL --- */}
      {showBossVictoryModal && (
        <div className="absolute inset-0 z-35 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-emerald-500 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.25)] p-6 text-center space-y-6 text-slate-100">
            <div className="space-y-1">
              <div className="w-20 h-20 bg-emerald-950/40 border border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <Award className="w-10 h-10 animate-spin-slow" />
              </div>
              <h2 className="text-2xl font-black text-emerald-400 tracking-tight uppercase pt-2">
                VÍTĚZSTVÍ JE VAŠE!
              </h2>
              <p className="text-xs text-emerald-300 font-mono">Dreadnought Generála Korzárů byl rozmetán</p>
            </div>

            <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl space-y-4 text-left text-sm">
              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                Neuvěřitelný pilotní výkon! Úspěšně jste porazili <b>Generála Korzárů</b> v jeho domovském světě. Hrozba byla zažehnána a galaxie oslavuje své zachránce!
              </p>
              
              <div className="w-full h-[1px] bg-slate-800" />
              
              <h4 className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Získané Epické Válečné Odměny:</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-1">
                <div className="bg-emerald-950/30 border border-emerald-500/20 p-2 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse" />
                  <span className="text-slate-400 font-mono flex flex-col mt-1">
                    <b className="text-emerald-400 font-black text-sm pr-1">+50</b> Krystalů
                  </span>
                </div>
                <div className="bg-blue-950/30 border border-blue-500/20 p-2 rounded-lg">
                  <Gem className="w-3.5 h-3.5 text-blue-400 mx-auto" />
                  <span className="text-slate-400 font-mono flex flex-col mt-0.5">
                    <b className="text-blue-400 font-black text-sm pr-1">+15</b> Diamantů
                  </span>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 p-2 rounded-lg">
                  <span className="w-2.5 h-2.5 bg-purple-600 rotate-45 border border-purple-300 inline-block mr-1" />
                  <span className="text-slate-400 font-mono flex flex-col mt-1">
                    <b className="text-purple-400 font-black text-sm pr-1">+5</b> Obsidiánu
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowBossVictoryModal(false);
                setShowIntro(true);
              }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg hover:scale-[1.01]"
              id="boss-victory-ok-btn"
            >
              Slavit Vítězství!
            </button>
          </div>
        </div>
      )}

      {/* --- REZISTENCE PORTÁLU: VOLBA O ZÁSOBÁCH --- */}
      {isDecisionOpen && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-amber-500 rounded-3xl shadow-[0_0_80px_rgba(245,158,11,0.2)] p-8 text-center space-y-6 text-slate-100 animate-fade-in">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-amber-950/40 border border-amber-500 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-amber-400 tracking-tight uppercase">
                ROZHODNUTÍ O ZÁSOBÁCH
              </h2>
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Fázový hyper-skok zpět do těžebního sektoru</p>
            </div>

            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Průlet fúzním portálem vyvolává obrovskou gravitační zátěž. Musíte se rozhodnout, zda odhodíte dříve získané zásoby surových rud z nákladového prostoru za účelem přetížení pohonů, nebo se pokusíte zásoby pronést za cenu nulového energetického zisku.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-left">
              {/* SACRIFICE/DISCARD OPTION */}
              <button
                onClick={() => handleWormholeDecision(true)}
                className="group relative flex flex-col justify-between p-6 bg-slate-900 hover:bg-slate-900/80 border border-red-500/30 hover:border-red-500 rounded-2xl transition-all duration-300 shadow-md hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] cursor-pointer text-left"
                id="portal-decision-discard-btn"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/20 rounded-full font-mono uppercase tracking-wider">Oběť zásob</span>
                    <Zap className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-lg font-extrabold text-red-400 tracking-tight">Zahodit nashromážděné zásoby</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Smaže krystaly, diamanty i obsidián ve vašem permanentním skladu na nulu. Lodní generátor absorbací těchto surovin vyvolá <b>PRESTIŽNÍ NEW GAME+</b> efekt.
                  </p>
                </div>
                <div className="w-full h-[1px] bg-slate-800 my-4" />
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trvalý bonus pro tuto a všechny příští hry:</span>
                  <div className="text-amber-400 font-mono text-xs font-bold space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span> +15 % k rychlosti a zrychlení lodi
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span> +15 % k dosahu a síle magnetu rud
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span> +15 % k zisku skóre (Trvalý multiplikátor)
                    </div>
                    <div className="flex items-center gap-1.5 text-red-400 font-bold">
                      <span className="text-red-500 font-black">⚠</span> Suroviny v peněžence klesnou na 0!
                    </div>
                  </div>
                </div>
                <div className="mt-5 w-full py-2 px-4 rounded-xl bg-red-600 group-hover:bg-red-500 text-white font-black uppercase text-[10px] tracking-widest text-center transition-colors">
                  ROZHODNOUT SE PRO PRESTIŽ 🔥
                </div>
              </button>

              {/* KEEP OPTION */}
              <button
                onClick={() => handleWormholeDecision(false)}
                className="group relative flex flex-col justify-between p-6 bg-slate-900 hover:bg-slate-900/80 border border-blue-500/30 hover:border-blue-500 rounded-2xl transition-all duration-300 shadow-md hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] cursor-pointer text-left"
                id="portal-decision-keep-btn"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-500/20 rounded-full font-mono uppercase tracking-wider">Konzervativní start</span>
                    <Gem className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-lg font-extrabold text-blue-400 tracking-tight">Ponechat si nashromážděné zásoby</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Uchováte si všechny své krystaly, diamanty i obsidián. Budete mít možnost v novém cyklu okamžitě nakoupit základní upgrady v doku pro snazší začátek.
                  </p>
                </div>
                <div className="w-full h-[1px] bg-slate-800 my-4" />
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vliv na herní průběh:</span>
                  <div className="text-blue-300 font-mono text-xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-400 font-bold">✓</span> Zachováte si stávající stav peněženky
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-400 font-bold">✓</span> Ždný risk ztráty surovin
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="text-red-500 font-bold">✗</span> Nezískáte prestižní bonus k atributům lodi
                    </div>
                  </div>
                </div>
                <div className="mt-5 w-full py-2 px-4 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest text-center transition-colors">
                  PONECHAT SI SUROVINY 💎
                </div>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 italic pt-2">
              Poznámka: Obě volby vynulují zakoupená loďní vylepšení a skóre aktuální jízdy z důvodu fázového resetu motorů při průletu červí dírou.
            </p>
          </div>
        </div>
      )}

      {/* SEKTOROVÁ MAPA (5x5 GRID) */}
      {isMapOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="relative w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[85vh]">
            
            {/* Left Column: Grid */}
            <div className="w-full md:w-3/5 p-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-800">
              <div className="mb-4">
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <Map className="w-5 h-5 text-violet-400 animate-pulse" />
                  Sektorový Navigační Systém
                </h3>
                <p className="text-xs text-slate-400">
                  Cestujte hyperpohonem mateřské lodi v mřížce 5x5 sektorů. Dosah hyperpohonu: <span className="text-violet-400 font-bold">{(upgrades.carrierHyperdriveRangeLevel || 1)} parseků</span>.
                </p>
              </div>

              {/* 5x5 Sector Grid Map */}
              <div className="grid grid-cols-5 gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 flex-1 overflow-y-auto">
                {Array.from({ length: 5 }).map((_, y) => {
                  return Array.from({ length: 5 }).map((_, x) => {
                    const sector = sectors.find(s => s.position.x === x && s.position.y === y);
                    if (!sector) return <div key={`empty-${x}-${y}`} className="bg-slate-900/10 border border-transparent rounded-xl" />;

                    const isCurrent = sector.id === currentSectorId;
                    
                    // Chebyshev distance
                    const curSector = sectors.find(s => s.id === currentSectorId);
                    const dist = curSector ? Math.max(Math.abs(sector.position.x - curSector.position.x), Math.abs(sector.position.y - curSector.position.y)) : 99;
                    const inRange = dist <= (upgrades.carrierHyperdriveRangeLevel || 1);
                    const isSelected = selectedMapSector?.id === sector.id;

                    // Style cell
                    let cellBg = 'bg-slate-900/50 border-slate-800/60';
                    let textClass = 'text-slate-400';
                    let typeLabel = '';

                    if (sector.discovered) {
                      if (sector.type === 'magma') {
                        cellBg = 'bg-red-950/30 border-red-900/40 hover:bg-red-950/40';
                        typeLabel = '🌋 Magma';
                      } else if (sector.type === 'ice') {
                        cellBg = 'bg-sky-950/30 border-sky-900/40 hover:bg-sky-950/40';
                        typeLabel = '❄️ Led';
                      } else if (sector.type === 'gold') {
                        cellBg = 'bg-amber-950/30 border-amber-900/40 hover:bg-amber-950/40';
                        typeLabel = '👑 Zlato';
                      } else if (sector.type === 'crystal') {
                        cellBg = 'bg-indigo-950/30 border-indigo-900/40 hover:bg-indigo-950/40';
                        typeLabel = '💎 Krystal';
                      } else if (sector.type === 'pirate') {
                        cellBg = 'bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-900/80';
                        typeLabel = '☠️ Korzár';
                      } else if (sector.type === 'void') {
                        cellBg = 'bg-purple-950/20 border-purple-950/40 hover:bg-purple-950/30';
                        typeLabel = '🌀 Void';
                      } else {
                        cellBg = 'bg-slate-900/60 border-slate-700/50 hover:bg-slate-900/80';
                        typeLabel = '🪨 Silicon';
                      }
                      textClass = 'text-white font-bold';
                    } else {
                      // Undiscovered
                      if (inRange) {
                        cellBg = 'bg-slate-950/70 border-dashed border-violet-900/50 hover:border-violet-500/60';
                        typeLabel = '📡 Neznámý';
                        textClass = 'text-slate-500 italic';
                      } else {
                        cellBg = 'bg-slate-950/30 border-slate-900/40 opacity-40 cursor-not-allowed';
                        typeLabel = '🔒 Uzamčeno';
                        textClass = 'text-slate-600';
                      }
                    }

                    if (isCurrent) {
                      cellBg = 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10';
                    } else if (isSelected) {
                      cellBg += ' ring-2 ring-violet-500 border-transparent';
                    }

                    return (
                      <button
                        key={sector.id}
                        onClick={() => inRange || sector.discovered ? setSelectedMapSector(sector) : null}
                        disabled={!inRange && !sector.discovered}
                        className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all ${cellBg} ${inRange || sector.discovered ? 'cursor-pointer hover:scale-[1.03]' : ''}`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="text-[9px] font-mono text-slate-500">
                            [{sector.position.y + 1},{sector.position.x + 1}]
                          </span>
                          {isCurrent && (
                            <span className="bg-emerald-500 text-slate-950 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                              ZDE
                            </span>
                          )}
                        </div>

                        <div className="my-1">
                          <h4 className={`text-xs truncate ${textClass}`}>
                            {sector.discovered ? sector.name : 'Zaslepený Signál'}
                          </h4>
                          <span className="text-[9px] text-slate-500">{typeLabel}</span>
                        </div>

                        <div className="flex items-center gap-0.5 text-[8px] text-amber-500">
                          {sector.discovered ? (
                            Array.from({ length: sector.difficulty }).map((_, i) => (
                              <span key={i}>⭐</span>
                            ))
                          ) : (
                            <span className="text-slate-600">Obtížnost: ?</span>
                          )}
                        </div>
                      </button>
                    );
                  });
                })}
              </div>
            </div>

            {/* Right Column: Selected Sector Details */}
            <div className="w-full md:w-2/5 p-6 bg-slate-950/60 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">
                  Detail Vybraného Sektoru
                </h3>

                {selectedMapSector ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                      <div className="flex justify-between items-start">
                        <h2 className="text-lg font-black text-white">
                          {selectedMapSector.discovered ? selectedMapSector.name : 'Sektor s neznámým označením'}
                        </h2>
                        <span className="text-xs font-mono text-slate-500">
                          [{selectedMapSector.position.y + 1},{selectedMapSector.position.x + 1}]
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-slate-400">Prostředí:</span>
                        <span className={`text-xs font-bold uppercase ${
                          selectedMapSector.discovered 
                            ? selectedMapSector.type === 'magma' ? 'text-red-400'
                              : selectedMapSector.type === 'ice' ? 'text-sky-400'
                              : selectedMapSector.type === 'gold' ? 'text-amber-400'
                              : selectedMapSector.type === 'crystal' ? 'text-indigo-400'
                              : selectedMapSector.type === 'pirate' ? 'text-zinc-400'
                              : 'text-slate-400'
                            : 'text-slate-500'
                        }`}>
                          {selectedMapSector.discovered ? selectedMapSector.type.toUpperCase() : 'NEZNÁMÉ 🔒'}
                        </span>
                      </div>
                    </div>

                    {selectedMapSector.discovered ? (
                      <div className="space-y-3 text-xs">
                        <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2">
                          <div className="flex justify-between text-slate-400">
                            <span>Hustota asteroidů:</span>
                            <span className="text-white font-mono font-bold">{selectedMapSector.asteroidDensity}%</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Obtížnost sektoru:</span>
                            <span className="text-amber-400 font-bold">
                              {Array.from({ length: selectedMapSector.difficulty }).map(() => '⭐').join('')}
                            </span>
                          </div>
                        </div>

                        {selectedMapSector.sectorBonuses.length > 0 && (
                          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-400">
                            <span className="font-bold block mb-1">🎁 SEKTOROVÉ BONUSY:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                              {selectedMapSector.sectorBonuses.map((bonus, i) => (
                                <li key={i}>{bonus}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedMapSector.hazards.length > 0 && (
                          <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400">
                            <span className="font-bold block mb-1">⚠️ ENVIRONMENTÁLNÍ NEBEZPEČÍ:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                              {selectedMapSector.hazards.map((haz, i) => {
                                let hazText = haz;
                                if (haz === 'solar_storm') hazText = '🌋 Solární erupce (láva)';
                                else if (haz === 'em_storm') hazText = '⚡ EM Bouře (rušení)';
                                else if (haz === 'pirate_patrol') hazText = '☠️ Hlídky korzárů';
                                return <li key={i}>{hazText}</li>;
                              })}
                            </ul>
                          </div>
                        )}

                        {selectedMapSector.bossId && (
                          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/40 text-purple-400 flex items-start gap-2 animate-pulse">
                            <Skull className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold block text-[11px]">👾 STRÁŽCE SEKTORU DETEKOVÁN!</span>
                              <p className="text-[10px] text-purple-300">
                                V tomto sektoru číhá Omega Korzár. Skok do této lokace vyvolá okamžitou bitvu.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500 py-10">
                        <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        Sektor je mimo dosah našich radarů. Prozkoumejte ho skokem s hyperpohonem!
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Vyberte sektor na levé mřížce kliknutím.
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-3">
                {/* Fuel Display */}
                <div className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-violet-400 animate-pulse fill-current" />
                    Zásoba Hyper-Paliva:
                  </span>
                  <span className="text-sm font-mono font-bold text-violet-400 bg-violet-950/50 px-2.5 py-1 rounded-lg border border-violet-900/60">
                    {(stats.deuterium || 0)}x Deuterium
                  </span>
                </div>

                {/* Jump controls */}
                {selectedMapSector && selectedMapSector.id !== currentSectorId && (
                  <button
                    onClick={() => handleExecuteHyperjump(selectedMapSector)}
                    disabled={(stats.deuterium || 0) < 1}
                    className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-center cursor-pointer transition-all ${
                      (stats.deuterium || 0) >= 1
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 hover:scale-[1.02] active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    {(stats.deuterium || 0) >= 1 ? '🚀 PROVÉST HYPER-SKOK' : '❌ NEDOSTATEK DEUTERIA'}
                  </button>
                )}

                {selectedMapSector && selectedMapSector.id === currentSectorId && (
                  <div className="w-full py-3 px-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-center text-xs font-bold font-mono">
                    🛰️ V TOMTO SEKTORU SE AKTUÁLNŮ NACHÁZÍTE
                  </div>
                )}

                <button
                  onClick={() => setIsMapOpen(false)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 text-center transition-colors cursor-pointer"
                >
                  ZAVŘÍT NAVIGÁTOR
                </button>
              </div>

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
        onBuyDeuterium={handleBuyDeuterium}
        onBuyCarrierClass={handleBuyCarrierClass}
        onBuyPlayerShipClass={handleBuyPlayerShipClass}
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

      {/* 8. RECHARTS EARNINGS GRAPH MODAL */}
      <EarningsChartModal
        isOpen={isEarningsChartOpen}
        onClose={() => setIsEarningsChartOpen(false)}
        data={earningsHistory}
      />

      {/* 9. MISSIONS & CONTRACTS CHECKLIST MODAL */}
      <MissionsModal
        isOpen={isMissionsOpen}
        onClose={() => setIsMissionsOpen(false)}
        missions={missions}
        onClaimReward={handleClaimMissionReward}
      />

      {/* MISSION COMPLETED TOAST NOTIFICATION */}
      {missionToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-slate-900/90 border border-emerald-500 text-emerald-300 font-extrabold text-sm shadow-2xl shadow-emerald-500/20 backdrop-blur-md animate-bounce flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          {missionToast}
        </div>
      )}

    </div>
  );
}
