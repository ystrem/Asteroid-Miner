/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upgrades, PlayerStats } from '../types';
import { playUpgradeSound } from '../utils/audio';
import { Sparkles, Shield, Zap, Hammer, X, Gem, Star, Swords, Waves } from 'lucide-react';

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
  levels: {
    level: number;
    title: string;
    description: string;
    costs: { crystals: number; diamonds: number; obsidian: number };
  }[];
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
  const [offeredUpgrades, setOfferedUpgrades] = useState<UpgradeItem[]>([]);
  const [hasPurchasedThisSession, setHasPurchasedThisSession] = useState<boolean>(false);

  // Upgrade specifications definitions in Czech with ONLY diamond and obsidian costs
  const upgradeDatabase: UpgradeItem[] = [
    {
      id: 'laserLevel',
      name: 'Laserové dělo',
      description: 'Zlepšuje palebnou sílu, šířku, počet paprsků a průraznost.',
      icon: <Swords className="w-5 h-5 text-red-400" id="icon-laser" />,
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
          description: 'Vystřeluje 3 lasery najednou v úhlovém vějíři (lepšení rozptylu).',
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
          description: 'Hlava s 5 hlavněmi! Prorážející hlavní paprsek a 4 boční krycí střely vyčistí obrazovku.',
          costs: { crystals: 0, diamonds: 90, obsidian: 25 },
        },
      ],
    },
    {
      id: 'magnetLevel',
      name: 'Gravitační magnet',
      description: 'Přitahuje vytěžené suroviny a krystaly z větší dálky ze všech směrů.',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" id="icon-magnet" />,
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
          description: 'Dosah o 160 % větší. Suroviny letí o 50 % rychleji ke středu.',
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
          description: 'Absolutní dosah! Veškeré suroviny letí bleskovou rychlostí (+250 %) přímo k lodi.',
          costs: { crystals: 0, diamonds: 100, obsidian: 30 },
        },
      ],
    },
    {
      id: 'hullLevel',
      name: 'Zesílený trup lodi',
      description: 'Zvyšuje maximální odolnost lodi a přidává pasivní tlumení srážek.',
      icon: <Hammer className="w-5 h-5 text-amber-500" id="icon-hull" />,
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
          description: 'Max trup o dalších 50 HP and pasivní redukce nárazů o 10 %.',
          costs: { crystals: 0, diamonds: 12, obsidian: 3 },
        },
        {
          level: 4,
          title: 'Obsidiánový plášť',
          description: 'Max trup +80 HP and pasivní redukce nárazů o 20 %.',
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
          description: 'Extrémní konstrukce (+100 HP, celkem 400 HP). Absorbuje neuvěřitelných 50 % veškerého nárazu!',
          costs: { crystals: 0, diamonds: 120, obsidian: 40 },
        },
      ],
    },
    {
      id: 'shieldLevel',
      name: 'Energetický štít',
      description: 'Ochranná bariéra, která se regeneruje. Absorbuje veškeré poškození.',
      icon: <Shield className="w-5 h-5 text-blue-400" id="icon-shield" />,
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
          description: 'Kapacita štítu posílena o +30. Rychlejší aktivace obnovy o 20 %.',
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
          description: 'Bariéra s kapacitou +40 (celkem 190 HP). Obnova štítu se spíná okamžitě (~0.6s od posledního zásahu!).',
          costs: { crystals: 0, diamonds: 130, obsidian: 45 },
        },
      ],
    },
    {
      id: 'engineLevel',
      name: 'Pohonné trysky',
      description: 'Zvyšuje akceleraci, maximální rychlost a agilitu lodních úhybů.',
      icon: <Zap className="w-5 h-5 text-emerald-400" id="icon-engine" />,
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
          description: 'Lepší akcelerace o 30 % a blesková reakce na brzdění / pohyb.',
          costs: { crystals: 0, diamonds: 25, obsidian: 6 },
        },
        {
          level: 5,
          title: 'Antigravitační jádro',
          description: 'Maximální mobilita bez setrvačného omezení (+120 % přetížení výkonu).',
          costs: { crystals: 0, diamonds: 55, obsidian: 15 },
        },
        {
          level: 6,
          title: 'Tachyonový Warp pohon',
          description: 'Rychlost letu navýšena o dalších 25 % s nulovým vesmírným třením.',
          costs: { crystals: 0, diamonds: 110, obsidian: 35 },
        },
      ],
    },
    {
      id: 'abilityLightningLevel',
      name: 'Řetězový blesk (Aktivní Q)',
      description: 'Vystřelí silný elektrický výboj, který zasáhne nejbližší asteroid a přeskočí na další v okolí, čímž je roztříští.',
      icon: <Zap className="w-5 h-5 text-yellow-400" id="icon-abl-lightning" />,
      levels: [
        {
          level: 1,
          title: 'Elektrický výboj',
          description: 'Aktivuje schopnost. Vystřelí blesk na 1 asteroid s poškozením, který přeskočí na další 3 nejbližší.',
          costs: { crystals: 0, diamonds: 8, obsidian: 2 },
        },
        {
          level: 2,
          title: 'Vysokofrekvenční ráz',
          description: 'Blesk nyní zasáhne první cíl a přeskočí na 5 dalších, s dvojnásobným bonus poškozením.',
          costs: { crystals: 0, diamonds: 22, obsidian: 6 },
        },
        {
          level: 3,
          title: 'Kvantová bouře milénia',
          description: 'Absolutní vyčištění! Blesk zasáhne cíl a přeskočí až na 8 dalších asteroidů s extrémní rázovou vlnou.',
          costs: { crystals: 0, diamonds: 50, obsidian: 15 },
        },
      ],
    },
    {
      id: 'abilityPulseLevel',
      name: 'Kinetický puls (Aktivní E)',
      description: 'Uvolní silnou rázovou vlnu ve tvaru prstence kolem lodi, která odhodí asteroidy a ochrání vás před obklíčením.',
      icon: <Waves className="w-5 h-5 text-indigo-400" id="icon-abl-pulse" />,
      levels: [
        {
          level: 1,
          title: 'Silový puls',
          description: 'Aktivuje rázovou vlnu odhazující všechny okolní asteroidy daleko ke krajům obrazovky.',
          costs: { crystals: 0, diamonds: 5, obsidian: 1 },
        },
        {
          level: 2,
          title: 'Magnetická drtivá stěna',
          description: 'Odhazuje asteroidy o 50 % větší silou a navíc jim způsobí poškození při odpálení.',
          costs: { crystals: 0, diamonds: 16, obsidian: 4 },
        },
        {
          level: 3,
          title: 'Termonukleární otřes Wave',
          description: 'Všechny odhozené asteroidy, které po odhození narazí nebo jsou velmi blízko, okamžitě vybuchnou.',
          costs: { crystals: 0, diamonds: 42, obsidian: 12 },
        },
      ],
    },
    {
      id: 'abilitySuperMagnetLevel',
      name: 'Super magnet / Vortex (Aktivní R)',
      description: 'Rozšíří gravitační dosah vašeho magnetu na celou obrazovku, což vám umožní instantně posbírat všechny suroviny.',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" id="icon-abl-magnet" />,
      levels: [
        {
          level: 1,
          title: 'Surovinová bouře',
          description: 'Aktivuje schopnost. Na 5 sekund zvýší dosah přitažlivosti na celou herní plochu.',
          costs: { crystals: 0, diamonds: 10, obsidian: 2 },
        },
        {
          level: 2,
          title: 'Tachyonový fázový vír',
          description: 'Trvá 8 sekund a suroviny letí o 50 % rychleji. Přitahuje je koryty energetických drah.',
          costs: { crystals: 0, diamonds: 28, obsidian: 8 },
        },
        {
          level: 3,
          title: 'Singularita Vacuum',
          description: 'Trvá 12 sekund, omezuje herní tření, přitahuje suroviny bleskovou rychlostí (+150 %).',
          costs: { crystals: 0, diamonds: 65, obsidian: 20 },
        },
      ],
    },
  ];

  // Pick exactly two eligible upgrades when the shop opens
  useEffect(() => {
    if (isOpen) {
      setHasPurchasedThisSession(false);
      // Filter upgrades that can actually be upgraded
      const eligible = upgradeDatabase.filter((item) => {
        const currentLvl = upgrades[item.id];
        return item.levels.some((l) => l.level === currentLvl + 1);
      });

      // Shuffle and pick exactly 2
      const shuffled = [...eligible].sort(() => 0.5 - Math.random());
      setOfferedUpgrades(shuffled.slice(0, 2));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to determine if resources are sufficient (Only uses Diamond and Obsidian!)
  const canAfford = (costs: { crystals: number; diamonds: number; obsidian: number }) => {
    return (
      stats.diamonds >= costs.diamonds &&
      stats.obsidian >= costs.obsidian
    );
  };

  const handlePurchaseUpgrade = (id: keyof Upgrades, costs: { crystals: number; diamonds: number; obsidian: number }, nextLevel: number) => {
    if (!canAfford(costs) || hasPurchasedThisSession) return;
    onUpgrade(id, costs, nextLevel);
    setHasPurchasedThisSession(true);
    playUpgradeSound();
  };

  const currentLaserTypeDescription = () => {
    switch (upgrades.laserLevel) {
      case 1: return 'Úroveň 1: Standardní jednoduchý laser';
      case 2: return 'Úroveň 2: Těžký paprsek (2x poškození)';
      case 3: return 'Úroveň 3: Trojitý rozptylový laser';
      case 4: return 'Úroveň 4: Prorážející laser (Ultimate)';
      case 5: return 'Úroveň 5: Kvantová kaskáda (Quintuple)';
      default: return '';
    }
  };

  // Service costs in Diamonds
  const repairCost = Math.max(1, Math.round((maxHull - currentHull) / 40));
  const rechargeShieldCost = 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs p-4 sm:p-6" id="upgrade-shop-overlay">
      <div 
        className="w-full max-w-lg h-full max-h-[85vh] sm:max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        id="upgrade-shop-container"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Těžební dok & Dokování
            </h2>
            <p className="text-xs text-slate-400">Vylepši systémy své těžební lodi</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            id="close-shop-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resources Indicator Bar */}
        <div className="px-4 py-3 bg-slate-950 flex justify-around items-center border-b border-slate-800 gap-1 text-sm">
          <div className="flex items-center gap-1.5 bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-800/20 opacity-60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-400 antialiased">{stats.crystals}</span>
            <span className="text-[10px] text-slate-400 font-medium">Krystal</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-800/30">
            <Gem className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-blue-300 antialiased">{stats.diamonds}</span>
            <span className="text-xs text-slate-400 font-medium">Diamant</span>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-950/40 px-2.5 py-1.5 rounded-lg border border-purple-800/30">
            <Star className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-purple-300 antialiased">{stats.obsidian}</span>
            <span className="text-xs text-slate-400 font-medium">Obsidián</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 font-medium text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`flex-1 py-2 text-center rounded-lg transition-all cursor-pointer ${
              activeTab === 'upgrades'
                ? 'bg-amber-950/45 text-amber-300 font-semibold border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-upgrades"
          >
            Modulární vylepšení
          </button>
          <button
            onClick={() => setActiveTab('repairs')}
            className={`flex-1 py-2 text-center rounded-lg transition-all cursor-pointer ${
              activeTab === 'repairs'
                ? 'bg-blue-950/45 text-blue-300 font-semibold border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-repairs"
          >
            Opravy & Dobíjení
          </button>
        </div>

        {/* Scrollable list of Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" id="shop-items-scroll">
          {activeTab === 'repairs' ? (
            <div className="space-y-4" id="repairs-section">
              {/* Repairs Header */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Stav Lodních systémů</h3>
                <div className="space-y-2 mt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Pancéřování (Trup HP)</span>
                      <span className="text-amber-400 font-semibold">{currentHull} / {maxHull} HP</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300" 
                        style={{ width: `${(currentHull / maxHull) * 100}%` }}
                      />
                    </div>
                  </div>
                  {upgrades.shieldLevel > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Energetický štít</span>
                        <span className="text-blue-400 font-semibold">{currentShield} / {maxShield} HP</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-400 h-full transition-all duration-300" 
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
                    <div className="p-1 px-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-semibold">HP</div>
                    <h4 className="font-bold text-slate-100 text-base">Oprava trupu letky</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Okamžitě zrekonstruuje chybějící pancéřování trupu lodi.
                  </p>
                  {currentHull >= maxHull ? (
                    <span className="text-xs text-emerald-400 font-medium block pt-1">✓ Pancíř je plně opraven</span>
                  ) : (
                    <span className="text-xs text-amber-400/80 font-medium block pt-1 mt-1">Opraví celkem až {maxHull - currentHull} HP</span>
                  )}
                </div>
                <button
                  disabled={currentHull >= maxHull || stats.diamonds < repairCost}
                  onClick={() => onRepair(repairCost, maxHull - currentHull)}
                  className={`px-4 py-2.5 rounded-xl font-bold flex flex-col items-center justify-center transition-all min-w-[110px] cursor-pointer ${
                    currentHull >= maxHull
                      ? 'bg-slate-800 text-slate-500 border border-slate-700'
                      : stats.diamonds >= repairCost
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10 hover:scale-[1.02]'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 cursor-not-allowed'
                  }`}
                  id="action-repair"
                >
                  <span className="text-xs uppercase tracking-wider font-semibold">Opravit</span>
                  <div className="flex items-center gap-1 mt-0.5 text-xs font-bold">
                    <Gem className="w-3 h-3 text-blue-300" />
                    <span>{currentHull >= maxHull ? '-' : `${repairCost}`}</span>
                  </div>
                </button>
              </div>

              {/* Shield recharge item */}
              {upgrades.shieldLevel > 0 && (
                <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 flex justify-between items-center hover:bg-slate-950/50 transition-all">
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold">SHIELD</div>
                      <h4 className="font-bold text-slate-100 text-base">Dobití štítu</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Aktivuje bleskovou plazmovou induktivitu a nabije štít na maximum.
                    </p>
                    {currentShield >= maxShield ? (
                      <span className="text-xs text-emerald-400 font-medium block pt-1">✓ Štít je plně nabit</span>
                    ) : (
                      <span className="text-xs text-blue-400/80 font-medium block pt-1 mt-1">Dobije štít na maximum</span>
                    )}
                  </div>
                  <button
                    disabled={currentShield >= maxShield || stats.diamonds < rechargeShieldCost}
                    onClick={() => onRechargeShield(rechargeShieldCost)}
                    className={`px-4 py-2.5 rounded-xl font-bold flex flex-col items-center justify-center transition-all min-w-[110px] cursor-pointer ${
                      currentShield >= maxShield
                        ? 'bg-slate-800 text-slate-500 border border-slate-700'
                        : stats.diamonds >= rechargeShieldCost
                        ? 'bg-blue-500 hover:bg-blue-400 text-slate-950 shadow-md shadow-blue-500/10 hover:scale-[1.02]'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 cursor-not-allowed'
                    }`}
                    id="action-recharge-shield"
                  >
                    <span className="text-xs uppercase tracking-wider font-semibold">Dobít</span>
                    <div className="flex items-center gap-1 mt-0.5 text-xs font-bold">
                      <Gem className="w-3 h-3 text-blue-300" />
                      <span>{currentShield >= maxShield ? '-' : `${rechargeShieldCost}`}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4" id="upgrades-section">
              {/* Instruction Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 leading-relaxed flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5 text-amber-200">Výběrové dokování</span>
                  Je vám nabídnut náhodný výběr **dvou modulů**. Můžete si zakoupit **pouze jeden** z nich, poté se síť pro toto dokování uzamkne!
                </div>
              </div>

              {hasPurchasedThisSession && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 text-center font-bold uppercase tracking-wider">
                  ✓ MODUL AKTIVOVÁN • SEKCE PRO TENTO START UZAMČENA
                </div>
              )}

              {offeredUpgrades.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm border border-slate-800 rounded-xl bg-slate-950/30">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  Všechny lodní systémy jsou vylepšeny na maximální úroveň!
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {offeredUpgrades.map((item) => {
                    const currentLvl = upgrades[item.id];
                    const nextLevelSpec = item.levels.find((l) => l.level === currentLvl + 1);
                    if (!nextLevelSpec) return null;

                    const canBuy = canAfford(nextLevelSpec.costs) && !hasPurchasedThisSession;

                    return (
                      <div 
                        key={item.id} 
                        className={`border rounded-xl p-4 space-y-3 transition-all flex flex-col ${
                          hasPurchasedThisSession
                            ? 'bg-slate-950/10 border-slate-900 opacity-50'
                            : 'bg-slate-950/25 border-slate-800 hover:border-slate-700/60'
                        }`}
                      >
                        {/* Title Info */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex gap-2.5 items-center">
                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                              {item.icon}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-100 text-base">{item.name}</h4>
                              <span className="text-xs text-slate-400 font-medium">
                                {item.id === 'laserLevel' ? currentLaserTypeDescription() : `Úroveň: ${currentLvl}`}
                              </span>
                            </div>
                          </div>
                          
                          <span className="text-xs text-amber-400 bg-amber-950/40 px-2 py-1 border border-amber-900/30 rounded-full font-bold">
                            Nová: Lvl {currentLvl + 1}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-1">
                          {item.description}
                        </p>

                        {/* Next level specs */}
                        <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 space-y-2 mt-1">
                          <div>
                            <span className="text-xs font-bold text-blue-400 tracking-wider block uppercase">Modul: {nextLevelSpec.title}</span>
                            <span className="text-xs text-slate-300 mt-0.5 block leading-relaxed">{nextLevelSpec.description}</span>
                          </div>

                          {/* Costs block */}
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-x-4 gap-y-2">
                            <span className="text-xs font-semibold text-slate-400">Cena:</span>
                            <div className="flex flex-wrap gap-2.5 text-xs">
                              {nextLevelSpec.costs.diamonds > 0 && (
                                <div className={`flex items-center gap-1 ${stats.diamonds >= nextLevelSpec.costs.diamonds ? 'text-blue-400 font-bold' : 'text-slate-500 line-through'}`}>
                                  <Gem className="w-3.5 h-3.5" />
                                  <span>{nextLevelSpec.costs.diamonds} diamantů</span>
                                </div>
                              )}
                              {nextLevelSpec.costs.obsidian > 0 && (
                                <div className={`flex items-center gap-1 ${stats.obsidian >= nextLevelSpec.costs.obsidian ? 'text-purple-400 font-bold' : 'text-slate-500 line-through'}`}>
                                  <Star className="w-3.5 h-3.5" />
                                  <span>{nextLevelSpec.costs.obsidian} obsidiánů</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Purchase Button */}
                          <div className="pt-1 select-none">
                            <button
                              disabled={!canBuy}
                              onClick={() => handlePurchaseUpgrade(item.id, nextLevelSpec.costs, nextLevelSpec.level)}
                              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                canBuy
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10 hover:scale-[1.01]'
                                  : 'bg-slate-850 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                              }`}
                              id={`upgrade-btn-${item.id}`}
                            >
                              {hasPurchasedThisSession ? 'Zakoupeno v této návštěvě' : 'Zakoupit modul'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-center text-xs text-slate-500 font-mono uppercase tracking-widest">
          SÍŤ AKTIVNÍ • JEDEN NÁKUP POVOLEN
        </div>
      </div>
    </div>
  );
}
