/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upgrades, PlayerStats } from '../types';
import { playUpgradeSound } from '../utils/audio';
import { 
  Sparkles, 
  Shield, 
  Zap, 
  Hammer, 
  X, 
  Gem, 
  Star, 
  Swords, 
  Waves, 
  Cpu, 
  Lock, 
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';

interface UpgradeShopProps {
  upgrades: Upgrades;
  stats: PlayerStats;
  currentHull: number;
  maxHull: number;
  currentShield: number;
  maxShield: number;
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (type: keyof Upgrades, costs: { crystals: number; diamonds: number; obsidian: number }, nextLevel: number) => void;
  onRepair: (diamondsCost: number, amount: number) => void;
  onRechargeShield: (diamondsCost: number) => void;
}

interface UpgradeItem {
  id: keyof Upgrades;
  name: string;
  description: string;
  icon: React.ReactNode;
  maxLevel: number;
  levels: {
    level: number;
    title: string;
    description: string;
    costs: { crystals: number; diamonds: number; obsidian: number };
  }[];
}

interface Dependency {
  id: keyof Upgrades;
  minLevel: number;
  name: string;
}

export default function UpgradeShop({
  upgrades,
  stats,
  currentHull,
  maxHull,
  currentShield,
  maxShield,
  isOpen,
  onClose,
  onUpgrade,
  onRepair,
  onRechargeShield,
}: UpgradeShopProps) {
  const [activeTab, setActiveTab] = useState<'upgrades' | 'repairs'>('upgrades');
  const [selectedTechId, setSelectedTechId] = useState<keyof Upgrades>('laserLevel');
  const [hasPurchasedThisSession, setHasPurchasedThisSession] = useState<boolean>(false);

  // Upgrade specifications definitions in Czech with ONLY diamond, obsidian and crystal costs
  const upgradeDatabase: UpgradeItem[] = [
    {
      id: 'laserLevel',
      name: 'Laserové dělo',
      description: 'Zlepšuje palebnou sílu, šířku, počet paprsků a průraznost střelby.',
      icon: <Swords className="w-5 h-5 text-red-400" id="icon-laser" />,
      maxLevel: 7,
      levels: [
        {
          level: 2,
          title: 'Široký paprsek',
          description: 'Hustší plazma s dvojnásobným poškozením a širším zásahem.',
          costs: { crystals: 0, diamonds: 5, obsidian: 0 },
        },
        {
          level: 3,
          title: 'Trojitý rozptyl',
          description: 'Vystřeluje 3 lasery najednou v úhlovém vějíři (lepší rozptyl).',
          costs: { crystals: 0, diamonds: 15, obsidian: 2 },
        },
        {
          level: 4,
          title: 'Prorážející paprsek',
          description: 'Ultimátní energetický laser prorazí menší úlomky a letí dál.',
          costs: { crystals: 0, diamonds: 40, obsidian: 10 },
        },
        {
          level: 5,
          title: 'Kvantová kaskáda',
          description: 'Hlava s 5 hlavněmi! Prorážející hlavní paprsek a 4 boční krycí střely.',
          costs: { crystals: 0, diamonds: 90, obsidian: 25 },
        },
        {
          level: 6,
          title: 'Super-Nova dělo',
          description: 'Vystřeluje 7 ničivých paprsků naráz v gigantickém rozptylu s vysokou kadencí.',
          costs: { crystals: 0, diamonds: 140, obsidian: 45 },
        },
        {
          level: 7,
          title: 'Hyperprostorová anihilace',
          description: 'Absolutní arzenál! 9 hyper-laserů s anihilačním jádrem (+100 % body za zničení).',
          costs: { crystals: 0, diamonds: 220, obsidian: 75 },
        },
      ],
    },
    {
      id: 'magnetLevel',
      name: 'Gravitační magnet',
      description: 'Přitahuje vytěžené suroviny a krystaly z větší dálky ze všech směrů.',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" id="icon-magnet" />,
      maxLevel: 6,
      levels: [
        {
          level: 2,
          title: 'Magnetické pole',
          description: 'Zvýší dosah přitahování o 80 % a jemně zrychlí suroviny.',
          costs: { crystals: 0, diamonds: 3, obsidian: 0 },
        },
        {
          level: 3,
          title: 'Zesílená cívka',
          description: 'Dosah o 160 % větší. Suroviny letí o 50 % rychleji k lodi.',
          costs: { crystals: 0, diamonds: 10, obsidian: 1 },
        },
        {
          level: 4,
          title: 'Tachyonový puls',
          description: 'Obrovská gravitace (dosah +240 %, rychlost přitahování +100 %).',
          costs: { crystals: 0, diamonds: 25, obsidian: 5 },
        },
        {
          level: 5,
          title: 'Gravitační singularita',
          description: 'Těžební černé díry! Přitahuje suroviny z drtivé většiny mapy.',
          costs: { crystals: 0, diamonds: 50, obsidian: 12 },
        },
        {
          level: 6,
          title: 'Singularita hyperprostoru',
          description: 'Absolutní dosah! Veškeré suroviny letí bleskovou rychlostí (+250 %) k lodi.',
          costs: { crystals: 0, diamonds: 100, obsidian: 30 },
        },
      ],
    },
    {
      id: 'hullLevel',
      name: 'Zesílený trup lodi',
      description: 'Zvyšuje maximální odolnost lodi a přidává pasivní tlumení srážek.',
      icon: <Hammer className="w-5 h-5 text-amber-500" id="icon-hull" />,
      maxLevel: 6,
      levels: [
        {
          level: 2,
          title: 'Ocelové pláty',
          description: 'Maximální odolnost trupu stoupne o 50 HP.',
          costs: { crystals: 0, diamonds: 4, obsidian: 1 },
        },
        {
          level: 3,
          title: 'Karbonkeramika',
          description: 'Max trup o dalších 50 HP a pasivní redukce nárazů o 10 %.',
          costs: { crystals: 0, diamonds: 12, obsidian: 3 },
        },
        {
          level: 4,
          title: 'Obsidiánový plášť',
          description: 'Max trup +80 HP a pasivní redukce nárazů o 20 %.',
          costs: { crystals: 0, diamonds: 30, obsidian: 8 },
        },
        {
          level: 5,
          title: 'Nanokompozitní tlumící trup',
          description: 'Max trup +120 HP. Excelentní absorpce nárazů lodi o 35 %.',
          costs: { crystals: 0, diamonds: 60, obsidian: 18 },
        },
        {
          level: 6,
          title: 'Neutroniová matrice',
          description: 'Extrémní konstrukce (+100 HP, celkem 400 HP). Absorbuje 50 % nárazů!',
          costs: { crystals: 0, diamonds: 120, obsidian: 40 },
        },
      ],
    },
    {
      id: 'shieldLevel',
      name: 'Energetický štít',
      description: 'Ochranná bariéra, která se sama regeneruje a pohlcuje poškození.',
      icon: <Shield className="w-5 h-5 text-blue-400" id="icon-shield" />,
      maxLevel: 5,
      levels: [
        {
          level: 1,
          title: 'Bariéra z plazmy',
          description: 'Aktivuje regenerační štít lodi o kapacitě 50 bodů.',
          costs: { crystals: 0, diamonds: 6, obsidian: 1 },
        },
        {
          level: 2,
          title: 'Fázový rezonátor',
          description: 'Kapacita štítu posílena o +30. Rychlejší spuštění obnovy o 20 %.',
          costs: { crystals: 0, diamonds: 14, obsidian: 4 },
        },
        {
          level: 3,
          title: 'Těžký generátor štítů',
          description: 'Kapacita štítu +30 a zrychlení průběžného dobíjení o 50 %.',
          costs: { crystals: 0, diamonds: 32, obsidian: 10 },
        },
        {
          level: 4,
          title: 'Kvantová klenba Aegis',
          description: 'Monstrózní štít (kapacita +40, rychlost samočinného dobíjení +100 %).',
          costs: { crystals: 0, diamonds: 70, obsidian: 20 },
        },
        {
          level: 5,
          title: 'Nulový rezonátor singularity',
          description: 'Bariéra s kapacitou +40 (celkem 190 HP). Obnova štítu se spíná okamžitě.',
          costs: { crystals: 0, diamonds: 130, obsidian: 45 },
        },
      ],
    },
    {
      id: 'engineLevel',
      name: 'Pohonné trysky',
      description: 'Zvyšuje akceleraci, maximální rychlost a agilitu lodních úhybů.',
      icon: <Zap className="w-5 h-5 text-emerald-400" id="icon-engine" />,
      maxLevel: 6,
      levels: [
        {
          level: 2,
          title: 'Iontový reaktor',
          description: 'Zrychlí let lodi a obratnost o 20 %.',
          costs: { crystals: 0, diamonds: 3, obsidian: 0 },
        },
        {
          level: 3,
          title: 'Hyperspaciální injektor',
          description: 'Pohyblivost lodi navýšena o dalších 25 % s plynulejším skluzem.',
          costs: { crystals: 0, diamonds: 10, obsidian: 1 },
        },
        {
          level: 4,
          title: 'Stabilizační kompresory',
          description: 'Lepší akcelerace o 30 % a blesková reakce na brzdění.',
          costs: { crystals: 0, diamonds: 25, obsidian: 6 },
        },
        {
          level: 5,
          title: 'Antigravitační jádro',
          description: 'Maximální mobilita bez setrvačného omezení (+120 % výkonu).',
          costs: { crystals: 0, diamonds: 55, obsidian: 15 },
        },
        {
          level: 6,
          title: 'Tachyonový Warp pohon',
          description: 'Rychlost letu navýšena o dalších 25 % s nulovým třením.',
          costs: { crystals: 0, diamonds: 110, obsidian: 35 },
        },
      ],
    },
    {
      id: 'abilityLightningLevel',
      name: 'Řetězový blesk (Aktivní Q)',
      description: 'Vystřelí silný elektrický výboj, který přeskakuje mezi nejbližšími asteroidy a drtí je.',
      icon: <Zap className="w-5 h-5 text-yellow-400" id="icon-abl-lightning" />,
      maxLevel: 3,
      levels: [
        {
          level: 1,
          title: 'Elektrický výboj',
          description: 'Vystřelí blesk na 1 asteroid s poškozením, který přeskočí na další 3 nejbližší.',
          costs: { crystals: 0, diamonds: 8, obsidian: 2 },
        },
        {
          level: 2,
          title: 'Vysokofrekvenční ráz',
          description: 'Zasáhne první cíl a přeskočí na 5 dalších, s dvojnásobným poškozením.',
          costs: { crystals: 0, diamonds: 22, obsidian: 6 },
        },
        {
          level: 3,
          title: 'Kvantová bouře milénia',
          description: 'Absolutní vyčištění! Blesk zasáhne cíl a přeskočí až na 8 dalších cílů.',
          costs: { crystals: 0, diamonds: 50, obsidian: 15 },
        },
      ],
    },
    {
      id: 'abilityPulseLevel',
      name: 'Kinetický puls (Aktivní E)',
      description: 'Uvolní silnou rázovou vlnu ve tvaru prstence, která odhodí a poškodí nepřátele a asteroidy.',
      icon: <Waves className="w-5 h-5 text-indigo-400" id="icon-abl-pulse" />,
      maxLevel: 3,
      levels: [
        {
          level: 1,
          title: 'Silový puls',
          description: 'Aktivuje rázovou vlnu odhazující všechny okolní objekty.',
          costs: { crystals: 0, diamonds: 5, obsidian: 1 },
        },
        {
          level: 2,
          title: 'Magnetická drtivá stěna',
          description: 'Odhazuje objekty o 50 % větší silou a navíc jim způsobí poškození.',
          costs: { crystals: 0, diamonds: 16, obsidian: 4 },
        },
        {
          level: 3,
          title: 'Termonukleární otřes',
          description: 'Odhozené asteroidy, které po odhození narazí do sebe, okamžitě explodují.',
          costs: { crystals: 0, diamonds: 42, obsidian: 12 },
        },
      ],
    },
    {
      id: 'abilitySuperMagnetLevel',
      name: 'Super magnet / Vortex (Aktivní R)',
      description: 'Umožní jednorázově přitáhnout suroviny z celé herní plochy po omezenou dobu.',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" id="icon-abl-magnet" />,
      maxLevel: 3,
      levels: [
        {
          level: 1,
          title: 'Surovinová bouře',
          description: 'Aktivuje schopnost. Na 5 sekund zvýší dosah magnetu na celou obrazovku.',
          costs: { crystals: 0, diamonds: 10, obsidian: 2 },
        },
        {
          level: 2,
          title: 'Tachyonový fázový vír',
          description: 'Trvá 8 sekund a suroviny letí o 50 % rychleji přímo k lodi.',
          costs: { crystals: 0, diamonds: 28, obsidian: 8 },
        },
        {
          level: 3,
          title: 'Singularita Vacuum',
          description: 'Trvá 12 sekund, suroviny letí k lodi bleskovou rychlostí (+150 %).',
          costs: { crystals: 0, diamonds: 65, obsidian: 20 },
        },
      ],
    },
    {
      id: 'scoreMultiplierLevel',
      name: 'Datový skener skóre',
      description: 'Zvyšuje zisk bodů ze všech zničených asteroidů, nepřátel a nasbírané rudy.',
      icon: <Star className="w-5 h-5 text-amber-300" id="icon-multiplier" />,
      maxLevel: 5,
      levels: [
        {
          level: 2,
          title: 'Optimalizovaný záznam',
          description: 'Navýší zisk skóre o +25 % ze všech zdrojů.',
          costs: { crystals: 0, diamonds: 10, obsidian: 1 },
        },
        {
          level: 3,
          title: 'Skenování fázových jader',
          description: 'Navýší zisk skóre o +50 % ze všech zdrojů.',
          costs: { crystals: 0, diamonds: 25, obsidian: 4 },
        },
        {
          level: 4,
          title: 'Fázový datový uzel',
          description: 'Navýší zisk skóre o +75 % ze všech zdrojů.',
          costs: { crystals: 0, diamonds: 50, obsidian: 12 },
        },
        {
          level: 5,
          title: 'Kvantové archivy milénia',
          description: 'Dvojnásobný zisk skóre ze všeho (včetně zničených korzárů)!',
          costs: { crystals: 0, diamonds: 110, obsidian: 30 },
        },
      ],
    },
    {
      id: 'abilitySockLevel',
      name: 'Smradlavá ponožka (Aktivní Y)',
      description: 'Vystřelí toxickou zapáchající ponožku, která exploduje a vytvoří leptavou plynovou zónu.',
      icon: <span className="text-xl">🧦</span>,
      maxLevel: 3,
      levels: [
        {
          level: 1,
          title: 'Toxický ráz',
          description: 'Vystřelí ponožku vytvářející plynový mrak s poškozením 3.5 HP/s.',
          costs: { crystals: 0, diamonds: 8, obsidian: 1 },
        },
        {
          level: 2,
          title: 'Koncentrovaný sýr',
          description: 'O 50 % větší dosah mraku a vyšší poškození (7.0 HP/s).',
          costs: { crystals: 0, diamonds: 24, obsidian: 5 },
        },
        {
          level: 3,
          title: 'Biologická zbraň',
          description: 'Absolutní zamoření! Gigantická zóna smradu s brutálním poškozením 10.5 HP/s.',
          costs: { crystals: 0, diamonds: 60, obsidian: 16 },
        },
      ],
    },
    {
      id: 'miningDronesLevel',
      name: 'Automatické drony',
      description: 'Pasivní drony poletující kolem lodi, sbírající rudu a automaticky těžící asteroidy.',
      icon: <Cpu className="w-5 h-5 text-lime-400" id="icon-mining-drones" />,
      maxLevel: 3,
      levels: [
        {
          level: 1,
          title: 'Pasivní sběrač',
          description: 'Aktivuje 1 dron poletující kolem lodi, který automaticky sbírá krystaly.',
          costs: { crystals: 0, diamonds: 10, obsidian: 1 },
        },
        {
          level: 2,
          title: 'Těžební laserový dron',
          description: 'Navýší počet dronů na 2. Drony nyní těží z blízkých asteroidů dodatečné krystaly.',
          costs: { crystals: 0, diamonds: 28, obsidian: 5 },
        },
        {
          level: 3,
          title: 'Autonomní těžební roj',
          description: 'Celkem 3 drony s větším dosahem. Rychlost sběru a těžby se zvýší o 50 %.',
          costs: { crystals: 0, diamonds: 65, obsidian: 15 },
        },
      ],
    },
    {
      id: 'blackHoleActivator',
      name: 'Aktivátor černé díry',
      description: 'Permanentní mezigalaktický modul určený k aktivaci dimenzionální trhliny.',
      icon: <Waves className="w-5 h-5 text-purple-400" id="icon-blackhole" />,
      maxLevel: 1,
      levels: [
        {
          level: 1,
          title: 'Fázový klíč bosse',
          description: 'Odemkne portál Černé díry v hlavním menu. Umožní vyzvat Omega Korzára.',
          costs: { crystals: 0, diamonds: 80, obsidian: 20 },
        }
      ]
    },
    {
      id: 'omegaDestructorLevel',
      name: 'Minecraft Omega Destruktor',
      description: 'Legenda mezi zbraňovými lodními systémy, která přetěžuje laserové trysky.',
      icon: <Zap className="w-5 h-5 text-red-500 animate-pulse" id="icon-omega" />,
      maxLevel: 1,
      levels: [
        {
          level: 1,
          title: 'Svaté spalování',
          description: 'Vystřeluje 12 hořících rotujících střel do všech směrů vyhlazujících mapu.',
          costs: { crystals: 500, diamonds: 150, obsidian: 45 },
        }
      ]
    }
  ];

  // Branched Technology dependencies structure
  const techDependencies: Record<string, Dependency[]> = {
    abilityLightningLevel: [
      { id: 'laserLevel', minLevel: 2, name: 'Laserové dělo II' }
    ],
    abilityPulseLevel: [
      { id: 'shieldLevel', minLevel: 1, name: 'Energetický štít I' }
    ],
    abilitySuperMagnetLevel: [
      { id: 'magnetLevel', minLevel: 2, name: 'Gravitační magnet II' }
    ],
    miningDronesLevel: [
      { id: 'engineLevel', minLevel: 2, name: 'Pohonné trysky II' }
    ],
    shieldLevel: [
      { id: 'hullLevel', minLevel: 2, name: 'Zesílený trup II' }
    ],
    abilitySockLevel: [
      { id: 'abilityLightningLevel', minLevel: 1, name: 'Řetězový blesk I' },
      { id: 'abilityPulseLevel', minLevel: 1, name: 'Kinetický puls I' }
    ],
    blackHoleActivator: [
      { id: 'hullLevel', minLevel: 3, name: 'Zesílený trup III' },
      { id: 'shieldLevel', minLevel: 2, name: 'Energetický štít II' }
    ],
    omegaDestructorLevel: [
      { id: 'laserLevel', minLevel: 4, name: 'Laserové dělo IV' },
      { id: 'abilitySockLevel', minLevel: 1, name: 'Smradlavá ponožka I' }
    ]
  };

  // Setup tree groupings layout for the columns
  const techTreeLayout = [
    {
      category: 'Zbraně & Ofenzíva',
      desc: 'Zbraňové moduly a palebné síly',
      colorClass: 'border-red-900/40 bg-red-950/5 text-red-400',
      nodes: ['laserLevel', 'abilityLightningLevel', 'abilitySockLevel', 'omegaDestructorLevel'] as (keyof Upgrades)[]
    },
    {
      category: 'Konstrukce & Štíty',
      desc: 'Pasivní obrana a pohlcování rázů',
      colorClass: 'border-blue-900/40 bg-blue-950/5 text-blue-400',
      nodes: ['hullLevel', 'shieldLevel', 'abilityPulseLevel'] as (keyof Upgrades)[]
    },
    {
      category: 'Podpora & Těžba',
      desc: 'Mobilita, dosah magnetů a droni',
      colorClass: 'border-emerald-900/40 bg-emerald-950/5 text-emerald-400',
      nodes: ['engineLevel', 'miningDronesLevel', 'magnetLevel', 'abilitySuperMagnetLevel', 'scoreMultiplierLevel'] as (keyof Upgrades)[]
    },
    {
      category: 'Dimenze & Kosmos',
      desc: 'Legendární mimodimenzionální klíče',
      colorClass: 'border-purple-900/40 bg-purple-950/5 text-purple-400',
      nodes: ['blackHoleActivator'] as (keyof Upgrades)[]
    }
  ];

  // Pick default tech on open
  useEffect(() => {
    if (isOpen) {
      setHasPurchasedThisSession(false);
      setSelectedTechId('laserLevel');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine if dependencies are satisfied
  const getUnmetDependencies = (id: keyof Upgrades) => {
    const deps = techDependencies[id] || [];
    return deps.filter(dep => upgrades[dep.id] < dep.minLevel);
  };

  const isUnlocked = (id: keyof Upgrades) => {
    return getUnmetDependencies(id).length === 0;
  };

  // Helper to determine if resources are sufficient
  const canAfford = (costs: { crystals: number; diamonds: number; obsidian: number }) => {
    return (
      stats.crystals >= costs.crystals &&
      stats.diamonds >= costs.diamonds &&
      stats.obsidian >= costs.obsidian
    );
  };

  const handlePurchaseUpgrade = (id: keyof Upgrades, costs: { crystals: number; diamonds: number; obsidian: number }, nextLevel: number) => {
    if (!canAfford(costs) || hasPurchasedThisSession || !isUnlocked(id)) return;
    onUpgrade(id, costs, nextLevel);
    setHasPurchasedThisSession(true);
    playUpgradeSound();
  };

  const selectedTech = upgradeDatabase.find(t => t.id === selectedTechId)!;
  const currentLevel = upgrades[selectedTechId];
  const isMaxed = currentLevel >= selectedTech.maxLevel;
  const nextLevelSpec = selectedTech.levels.find(l => l.level === currentLevel + 1);
  const unmetDeps = getUnmetDependencies(selectedTechId);
  const selectedUnlocked = unmetDeps.length === 0;

  const currentLaserTypeDescription = () => {
    switch (upgrades.laserLevel) {
      case 1: return 'Základní plazmový laser';
      case 2: return 'Široký paprsek (2x poškození)';
      case 3: return 'Trojitý rozptylový vějíř';
      case 4: return 'Prorážející laser (Ultimate)';
      case 5: return 'Kvantová kaskáda (Quintuple)';
      case 6: return 'Super-Nova paprsek (Septuple)';
      case 7: return 'Hyperprostorová anihilace (Nonic)';
      default: return `Úroveň ${upgrades.laserLevel}`;
    }
  };

  // Service costs in Diamonds
  const repairCost = Math.max(1, Math.round((maxHull - currentHull) / 40));
  const rechargeShieldCost = 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5" id="upgrade-shop-overlay">
      <div 
        className={`w-full ${activeTab === 'upgrades' ? 'max-w-6xl' : 'max-w-lg'} h-[92vh] sm:h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-slate-100 transition-all duration-300`}
        id="upgrade-shop-container"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/90">
          <div>
            <h2 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              CYBERNETICKÉ TĚŽEBNÍ CENTRUM
            </h2>
            <p className="text-xs text-slate-400 font-mono">STATION COMMAND • MODULÁRNÍ DOKOVACÍ SÍŤ</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all hover:rotate-90 cursor-pointer"
            id="close-shop-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resources Indicator Bar */}
        <div className="px-5 py-3 bg-slate-950 flex justify-around sm:justify-start items-center border-b border-slate-850 gap-4 sm:gap-8 text-sm font-mono">
          <div className="flex items-center gap-2 bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-800/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="font-bold text-emerald-400 antialiased">{stats.crystals}</span>
            <span className="text-[10px] text-slate-400 font-medium">Krystal</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-800/30">
            <Gem className="w-4 h-4 text-blue-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.4)]" />
            <span className="font-bold text-blue-300 antialiased">{stats.diamonds}</span>
            <span className="text-[10px] text-slate-400 font-medium">Diamant</span>
          </div>
          <div className="flex items-center gap-2 bg-purple-950/30 px-3 py-1.5 rounded-lg border border-purple-800/30">
            <Star className="w-4 h-4 text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]" />
            <span className="font-bold text-purple-300 antialiased">{stats.obsidian}</span>
            <span className="text-[10px] text-slate-400 font-medium">Obsidián</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/45 p-1 font-mono text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`flex-1 py-2.5 text-center rounded-lg transition-all cursor-pointer ${
              activeTab === 'upgrades'
                ? 'bg-amber-950/50 text-amber-300 font-bold border-b-2 border-amber-500 shadow-[inset_0_-10px_15px_-10px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
            id="tab-upgrades"
          >
            📂 TECHNOLOGICKÝ STROM (VÝZKUM)
          </button>
          <button
            onClick={() => setActiveTab('repairs')}
            className={`flex-1 py-2.5 text-center rounded-lg transition-all cursor-pointer ${
              activeTab === 'repairs'
                ? 'bg-blue-950/50 text-blue-300 font-bold border-b-2 border-blue-500 shadow-[inset_0_-10px_15px_-10px_rgba(59,130,246,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
            id="tab-repairs"
          >
            🔧 ÚDRŽBA LODI (OPRAVY & ŠTÍTY)
          </button>
        </div>

        {/* Main Content Pane */}
        {activeTab === 'upgrades' ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950/30" id="upgrades-section">
            
            {/* LEFT / CENTER: Tech Tree Visual Map */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-4">
              
              {/* Information Banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 leading-relaxed flex items-start gap-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm text-amber-200 mb-0.5">Dokovací protokol vylepšení</span>
                  Lze vybrat jakoukoliv technologii v síti, u které splňujete prerekvizity. Během jednoho dokování je možné provést **pouze 1 nákup**!
                </div>
              </div>

              {hasPurchasedThisSession && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 text-center font-bold tracking-widest animate-pulse font-mono">
                  ✓ MODUL AKTIVOVÁN • SEKCE VÝZKUMU PRO TENTO START UZAMČENA
                </div>
              )}

              {/* Grid of Tree Branches */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
                {techTreeLayout.map((branch) => (
                  <div 
                    key={branch.category} 
                    className="border border-slate-800 bg-slate-950/60 rounded-xl p-3 flex flex-col space-y-3 relative"
                  >
                    {/* Branch Title */}
                    <div className="pb-2 border-b border-slate-900">
                      <h3 className="text-xs font-black tracking-wider text-slate-300 uppercase font-mono">{branch.category}</h3>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{branch.desc}</p>
                    </div>

                    {/* Nodes in this Branch */}
                    <div className="flex flex-col space-y-1">
                      {branch.nodes.map((nodeId, idx) => {
                        const item = upgradeDatabase.find(t => t.id === nodeId)!;
                        const lvl = upgrades[nodeId];
                        const maxed = lvl >= item.maxLevel;
                        const unlocked = isUnlocked(nodeId);
                        const isSelected = selectedTechId === nodeId;

                        // Check link met status to draw sequential indicators
                        let nextDepMinLvl = 2;
                        let isNextMet = lvl >= nextDepMinLvl;
                        if (nodeId === 'laserLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        } else if (nodeId === 'abilityLightningLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        } else if (nodeId === 'hullLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        } else if (nodeId === 'shieldLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        } else if (nodeId === 'engineLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        } else if (nodeId === 'magnetLevel') {
                          nextDepMinLvl = 2;
                          isNextMet = lvl >= 2;
                        }

                        let cardStateStyle = '';
                        if (maxed) {
                          cardStateStyle = 'border-amber-500/50 bg-amber-950/5 hover:bg-amber-950/10 text-amber-200 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]';
                        } else if (!unlocked) {
                          cardStateStyle = 'border-slate-950 bg-slate-900/10 text-slate-600 opacity-40';
                        } else {
                          cardStateStyle = 'border-slate-800 bg-slate-900/35 hover:bg-slate-900/55 hover:border-slate-700 text-slate-100 cursor-pointer';
                        }

                        if (isSelected) {
                          cardStateStyle += ' ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-950';
                        }

                        return (
                          <div key={nodeId} className="flex flex-col">
                            {/* Card Node */}
                            <button
                              onClick={() => setSelectedTechId(nodeId)}
                              className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 group ${cardStateStyle}`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`p-1.5 rounded-md ${maxed ? 'bg-amber-950/40 text-amber-400' : 'bg-slate-950/40 text-slate-400'} border border-slate-800 group-hover:scale-105 transition-transform`}>
                                  {item.icon}
                                </div>
                                <div className="leading-tight overflow-hidden text-ellipsis">
                                  <span className="text-xs font-bold block truncate">{item.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {maxed ? '★ MASTERED' : `Tier: ${lvl} / ${item.maxLevel}`}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {maxed ? (
                                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                                ) : !unlocked ? (
                                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5 text-blue-400 opacity-60" />
                                )}
                              </div>
                            </button>

                            {/* Sequential Connector */}
                            {idx < branch.nodes.length - 1 && (
                              <div className="flex flex-col items-center my-1 select-none">
                                <div className={`w-0.5 h-3 ${isNextMet ? 'bg-blue-500/70' : 'bg-slate-800'}`} />
                                <div className={`text-[8px] font-mono px-1 py-0.5 rounded border leading-none scale-90 ${isNextMet ? 'text-blue-300 bg-blue-950/50 border-blue-900/40' : 'text-slate-600 bg-slate-900/20 border-slate-800/10'}`}>
                                  T2+ odemkne další
                                </div>
                                <div className={`w-0.5 h-3 ${isNextMet ? 'bg-blue-500/70' : 'bg-slate-800'}`} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Selected Tech Details Drawer */}
            <div className="w-full lg:w-80 overflow-y-auto p-4 sm:p-5 bg-slate-950/70 flex flex-col justify-between space-y-4">
              
              <div className="space-y-4">
                {/* Tech Node Title Header */}
                <div className="flex gap-3 items-center pb-3 border-b border-slate-800/80">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 shadow-md">
                    {selectedTech.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-base leading-tight">{selectedTech.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedTechId === 'laserLevel' ? currentLaserTypeDescription() : `Aktuální úroveň: ${currentLevel}`}
                    </span>
                  </div>
                </div>

                {/* Main Desc */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans pl-1">
                  {selectedTech.description}
                </p>

                {/* Dependencies Panel */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    Odemknutí prerekvizit:
                  </h4>
                  {techDependencies[selectedTechId] ? (
                    <div className="space-y-1.5 pt-0.5">
                      {techDependencies[selectedTechId].map(dep => {
                        const met = upgrades[dep.id] >= dep.minLevel;
                        return (
                          <div key={dep.id} className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-300">{dep.name}</span>
                            <span className={`font-semibold flex items-center gap-1 ${met ? 'text-emerald-400' : 'text-red-400'}`}>
                              {met ? (
                                <>✓ Splněno (Lvl {upgrades[dep.id]})</>
                              ) : (
                                <>✗ Vyžaduje Lvl {dep.minLevel}</>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Bez doplňujících podmínek (Základní tech)
                    </p>
                  )}
                </div>

                {/* Next Level Specifications Block */}
                {!isMaxed && nextLevelSpec ? (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
                    <div>
                      <span className="text-[10px] font-bold text-blue-400 tracking-widest block uppercase font-mono">DALŠÍ STUPEŇ (T{nextLevelSpec.level})</span>
                      <span className="text-xs font-bold text-slate-100 mt-1 block leading-tight">{nextLevelSpec.title}</span>
                      <span className="text-xs text-slate-400 mt-1 block leading-relaxed">{nextLevelSpec.description}</span>
                    </div>

                    {/* Cost Specs */}
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5 font-mono">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cena modernizace:</span>
                      
                      <div className="space-y-1 text-xs">
                        {nextLevelSpec.costs.crystals > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Krystaly
                            </span>
                            <span className={`font-bold ${stats.crystals >= nextLevelSpec.costs.crystals ? 'text-emerald-400' : 'text-red-500/80 line-through'}`}>
                              {nextLevelSpec.costs.crystals}
                            </span>
                          </div>
                        )}
                        {nextLevelSpec.costs.diamonds > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Gem className="w-3 h-3 text-blue-400" />
                              Diamanty
                            </span>
                            <span className={`font-bold ${stats.diamonds >= nextLevelSpec.costs.diamonds ? 'text-blue-400' : 'text-red-500/80 line-through'}`}>
                              {nextLevelSpec.costs.diamonds}
                            </span>
                          </div>
                        )}
                        {nextLevelSpec.costs.obsidian > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Star className="w-3 h-3 text-purple-400" />
                              Obsidián
                            </span>
                            <span className={`font-bold ${stats.obsidian >= nextLevelSpec.costs.obsidian ? 'text-purple-400' : 'text-red-500/80 line-through'}`}>
                              {nextLevelSpec.costs.obsidian}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 text-xs text-amber-300 text-center font-bold tracking-wider font-mono">
                    ★ TENTO REAKTOR JE NA MAXIMÁLNÍ ÚROVNI MASTERED!
                  </div>
                )}
              </div>

              {/* Action Button Section */}
              <div className="pt-4 border-t border-slate-900 mt-auto">
                {!isMaxed && nextLevelSpec ? (
                  <button
                    disabled={!canAfford(nextLevelSpec.costs) || hasPurchasedThisSession || !selectedUnlocked}
                    onClick={() => handlePurchaseUpgrade(selectedTechId, nextLevelSpec.costs, nextLevelSpec.level)}
                    className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all font-mono shadow-lg cursor-pointer ${
                      canAfford(nextLevelSpec.costs) && !hasPurchasedThisSession && selectedUnlocked
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.99]'
                        : 'bg-slate-850 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                    }`}
                    id={`upgrade-btn-${selectedTechId}`}
                  >
                    {hasPurchasedThisSession 
                      ? '✓ VYČERPÁNA POZICE V SESSION' 
                      : !selectedUnlocked 
                        ? '🚨 TECH BLOKOVÁN'
                        : canAfford(nextLevelSpec.costs) 
                          ? '⚡ INICIALIZOVAT UPGRADE ⚡' 
                          : 'Nedostatek surovin'}
                  </button>
                ) : (
                  <div className="bg-slate-900/40 text-slate-500 border border-slate-850 rounded-xl py-3 text-center text-xs font-mono font-bold">
                    MODUL JE PLNĚ DOKONČEN
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          /* Tab OPRAVY & DOBÍJENÍ */
          <div className="flex-1 overflow-y-auto p-4 space-y-4" id="shop-items-scroll">
            <div className="space-y-4" id="repairs-section">
              {/* Repairs Header */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-[0_2px_15px_rgba(0,0,0,0.2)]">
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-widest font-mono">STAV TRUPU & ŠTÍTŮ LETKY</h3>
                <div className="space-y-2.5 mt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span className="text-slate-400">Pancéřování (Trup HP)</span>
                      <span className="text-amber-400 font-bold">{currentHull} / {maxHull} HP</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-950">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300" 
                        style={{ width: `${(currentHull / maxHull) * 100}%` }}
                      />
                    </div>
                  </div>
                  {upgrades.shieldLevel > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-mono">
                        <span className="text-slate-400">Generátory ochranného štítu</span>
                        <span className="text-blue-400 font-bold">{currentShield} / {maxShield} HP</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-950">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300" 
                          style={{ width: `${(currentShield / maxShield) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Repair Hull item */}
              <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 flex justify-between items-center hover:bg-slate-950/50 transition-all">
                <div className="space-y-1 pr-4 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-bold font-mono">HULL RECON</div>
                    <h4 className="font-bold text-slate-100 text-base">Rekonstrukce trupu lodi</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Okamžitě svaří a nanovo opancéřuje poškozené pláty trupu. Obnoví plné HP.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1 text-xs font-mono">
                    <Gem className="w-3.5 h-3.5 text-blue-400" />
                    <span className={stats.diamonds >= repairCost && currentHull < maxHull ? 'text-blue-400 font-bold' : 'text-slate-500 line-through'}>
                      {repairCost} d.
                    </span>
                  </div>

                  <button
                    disabled={stats.diamonds < repairCost || currentHull >= maxHull}
                    onClick={() => onRepair(repairCost, maxHull - currentHull)}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all font-mono cursor-pointer ${
                      stats.diamonds >= repairCost && currentHull < maxHull
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10 hover:scale-[1.02]'
                        : 'bg-slate-850 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                    }`}
                  >
                    {currentHull >= maxHull ? 'Plné HP' : 'Opravit'}
                  </button>
                </div>
              </div>

              {/* Recharge Shield item */}
              {upgrades.shieldLevel > 0 && (
                <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 flex justify-between items-center hover:bg-slate-950/50 transition-all">
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold font-mono">SHIELD OVER</div>
                      <h4 className="font-bold text-slate-100 text-base">Okamžité nabití štítů</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Přetékající energetické rezonátory okamžitě nabijí kapacitu štítů na 100 %.
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-xs font-mono">
                      <Gem className="w-3.5 h-3.5 text-blue-400" />
                      <span className={stats.diamonds >= rechargeShieldCost && currentShield < maxShield ? 'text-blue-400 font-bold' : 'text-slate-500 line-through'}>
                        {rechargeShieldCost} d.
                      </span>
                    </div>

                    <button
                      disabled={stats.diamonds < rechargeShieldCost || currentShield >= maxShield}
                      onClick={() => onRechargeShield(rechargeShieldCost)}
                      className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all font-mono cursor-pointer ${
                        stats.diamonds >= rechargeShieldCost && currentShield < maxShield
                          ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-md shadow-blue-500/10 hover:scale-[1.02]'
                          : 'bg-slate-850 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                      }`}
                    >
                      {currentShield >= maxShield ? 'Nabitý' : 'Dobít'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 text-center text-slate-500 text-[10px] font-mono">
          STATION CONTROL TERMINAL • SECURE PHASE SYNC: OK • VERZE V2.1.0-STABLE
        </div>
      </div>
    </div>
  );
}
