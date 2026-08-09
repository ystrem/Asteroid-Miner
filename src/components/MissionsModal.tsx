/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Target, 
  Award, 
  CheckCircle, 
  Sparkles, 
  Gem, 
  Pickaxe, 
  Swords, 
  Compass, 
  Skull,
  Gift,
  Trophy,
  BarChart3,
  Check,
  Lock,
  Pin,
  Layers
} from 'lucide-react';
import { PlayerStats } from '../types';

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: 'mining' | 'combat' | 'exploration' | 'boss';
  targetType: 'mine_crystal' | 'mine_diamond' | 'mine_obsidian' | 'mine_gold' | 'mine_ice' | 'kill_pirates' | 'destroy_asteroids' | 'boss_kill' | 'super_magnet_use' | 'carrier_dock' | 'warp_jump' | 'buy_upgrade' | 'solar_storm_survive';
  targetAmount: number;
  currentAmount: number;
  rewardCrystals: number;
  rewardDiamonds: number;
  completed: boolean;
  claimed: boolean;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: 'mining' | 'combat' | 'exploration' | 'boss';
  targetAmount: number;
  currentAmount: number;
  rewardCrystals: number;
  rewardDiamonds: number;
  icon: string;
}

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  playerStats: PlayerStats;
  pinnedMissionIds: string[];
  onTogglePinMission: (id: string) => void;
  onClaimReward: (missionId: string) => void;
  onClaimBonusReward?: (crystals: number, diamonds: number) => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  isOpen,
  onClose,
  missions,
  playerStats,
  pinnedMissionIds,
  onTogglePinMission,
  onClaimReward,
  onClaimBonusReward
}) => {
  const [activeTab, setActiveTab] = useState<'missions' | 'achievements' | 'progress'>('missions');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cosmic_claimed_achievements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [claimedMilestones, setClaimedMilestones] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('cosmic_claimed_milestones');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cosmic_claimed_achievements', JSON.stringify(claimedAchievements));
    } catch (e) {
      console.warn('Could not save achievements', e);
    }
  }, [claimedAchievements]);

  useEffect(() => {
    try {
      localStorage.setItem('cosmic_claimed_milestones', JSON.stringify(claimedMilestones));
    } catch (e) {
      console.warn('Could not save milestones', e);
    }
  }, [claimedMilestones]);

  if (!isOpen) return null;

  // Calculate mission metrics
  const completedUnclaimedMissions = missions.filter(m => m.completed && !m.claimed);
  const totalMissionsCompleted = missions.filter(m => m.completed).length;
  const totalMissionsCount = missions.length;
  const missionsProgressPct = totalMissionsCount > 0 ? Math.round((totalMissionsCompleted / totalMissionsCount) * 100) : 0;

  // Build Career Achievements list derived from playerStats and missions
  const asteroidsMined = playerStats.totalAsteroidsMined || 0;
  const currentCrystals = playerStats.crystals || 0;
  const currentDiamonds = playerStats.diamonds || 0;
  const currentObsidian = playerStats.obsidian || 0;

  // Derived counts from missions target trackers
  const piratesKilled = missions.find(m => m.id === 'm_kill_pirates_veteran')?.currentAmount || missions.find(m => m.id === 'm_kill_pirates')?.currentAmount || 0;
  const warpJumps = missions.find(m => m.id === 'm_warp_jump')?.currentAmount || 0;
  const carrierDocks = missions.find(m => m.id === 'm_carrier_dock')?.currentAmount || 0;
  const bossesKilled = missions.find(m => m.id === 'm_boss_kill')?.currentAmount || 0;
  const solarStormsSurvived = missions.find(m => m.id === 'm_solar_storm')?.currentAmount || 0;

  const rawAchievements: AchievementItem[] = [
    {
      id: 'ach_crystals_1',
      title: 'Krystalový Magnát I',
      description: 'Shromáždi ve svém lodním skladu 500 krystalů.',
      tier: 'bronze',
      category: 'mining',
      targetAmount: 500,
      currentAmount: currentCrystals,
      rewardCrystals: 200,
      rewardDiamonds: 5,
      icon: '💎'
    },
    {
      id: 'ach_crystals_2',
      title: 'Krystalový Magnát II',
      description: 'Shromáždi ve svém lodním skladu 2,500 krystalů.',
      tier: 'silver',
      category: 'mining',
      targetAmount: 2500,
      currentAmount: currentCrystals,
      rewardCrystals: 600,
      rewardDiamonds: 12,
      icon: '💎'
    },
    {
      id: 'ach_crystals_3',
      title: 'Krystalová Legenda III',
      description: 'Shromáždi monumentálních 10,000 krystalů.',
      tier: 'gold',
      category: 'mining',
      targetAmount: 10000,
      currentAmount: currentCrystals,
      rewardCrystals: 2000,
      rewardDiamonds: 30,
      icon: '✨'
    },
    {
      id: 'ach_diamonds_1',
      title: 'Diamantový Hledač',
      description: 'Získej 10 vzácných modrých diamantů.',
      tier: 'silver',
      category: 'mining',
      targetAmount: 10,
      currentAmount: currentDiamonds,
      rewardCrystals: 500,
      rewardDiamonds: 10,
      icon: '🔷'
    },
    {
      id: 'ach_obsidian_1',
      title: 'Mistr Fialové Magmy',
      description: 'Vytěž 5 temných obsidiánů z magmatických vulkánů.',
      tier: 'gold',
      category: 'mining',
      targetAmount: 5,
      currentAmount: currentObsidian,
      rewardCrystals: 800,
      rewardDiamonds: 15,
      icon: '🔮'
    },
    {
      id: 'ach_asteroids_1',
      title: 'Hvězdný Drtič I',
      description: 'Rozbij celkem 50 vesmírných asteroidů.',
      tier: 'bronze',
      category: 'mining',
      targetAmount: 50,
      currentAmount: asteroidsMined,
      rewardCrystals: 300,
      rewardDiamonds: 4,
      icon: '☄️'
    },
    {
      id: 'ach_asteroids_2',
      title: 'Hvězdný Drtič II',
      description: 'Rozbij celkem 200 vesmírných asteroidů.',
      tier: 'silver',
      category: 'mining',
      targetAmount: 200,
      currentAmount: asteroidsMined,
      rewardCrystals: 1000,
      rewardDiamonds: 15,
      icon: '☄️'
    },
    {
      id: 'ach_pirates_1',
      title: 'Kat Pirátů I',
      description: 'Znič celkem 5 pirátských útočníků.',
      tier: 'bronze',
      category: 'combat',
      targetAmount: 5,
      currentAmount: piratesKilled,
      rewardCrystals: 400,
      rewardDiamonds: 8,
      icon: '⚔️'
    },
    {
      id: 'ach_pirates_2',
      title: 'Strážce Galaxie II',
      description: 'Vyčisti vesmír od 20 pirátských lodí.',
      tier: 'gold',
      category: 'combat',
      targetAmount: 20,
      currentAmount: piratesKilled,
      rewardCrystals: 1200,
      rewardDiamonds: 20,
      icon: '☠️'
    },
    {
      id: 'ach_warp_1',
      title: 'Galaktický Poutník',
      description: 'Proleť 5 warp skoky přes sektorové brány.',
      tier: 'silver',
      category: 'exploration',
      targetAmount: 5,
      currentAmount: warpJumps,
      rewardCrystals: 500,
      rewardDiamonds: 10,
      icon: '🌌'
    },
    {
      id: 'ach_dock_1',
      title: 'Letecká Základna',
      description: 'Přistaj 5x na mateřské lodi pro servis a tankování.',
      tier: 'bronze',
      category: 'exploration',
      targetAmount: 5,
      currentAmount: carrierDocks,
      rewardCrystals: 300,
      rewardDiamonds: 5,
      icon: '🛸'
    },
    {
      id: 'ach_boss_1',
      title: 'Ničitel Generála',
      description: 'Poraz sektorového bosse Generála Pirátů.',
      tier: 'platinum',
      category: 'boss',
      targetAmount: 1,
      currentAmount: bossesKilled,
      rewardCrystals: 1500,
      rewardDiamonds: 25,
      icon: '👑'
    },
    {
      id: 'ach_storm_1',
      title: 'Štít Solární Bouře',
      description: 'Přežij 2 divoké solární bouře ve vesmírném sektoru.',
      tier: 'silver',
      category: 'exploration',
      targetAmount: 2,
      currentAmount: solarStormsSurvived,
      rewardCrystals: 600,
      rewardDiamonds: 10,
      icon: '🛡️'
    }
  ];

  const totalAchievementsCompleted = rawAchievements.filter(a => a.currentAmount >= a.targetAmount).length;
  const unclaimedAchievementsCount = rawAchievements.filter(a => a.currentAmount >= a.targetAmount && !claimedAchievements.includes(a.id)).length;

  const handleClaimAchievement = (ach: AchievementItem) => {
    if (claimedAchievements.includes(ach.id)) return;
    setClaimedAchievements(prev => [...prev, ach.id]);
    if (onClaimBonusReward) {
      onClaimBonusReward(ach.rewardCrystals, ach.rewardDiamonds);
    }
  };

  const handleClaimMilestone = (milestonePct: number, rewardCrystals: number, rewardDiamonds: number) => {
    if (claimedMilestones.includes(milestonePct)) return;
    setClaimedMilestones(prev => [...prev, milestonePct]);
    if (onClaimBonusReward) {
      onClaimBonusReward(rewardCrystals, rewardDiamonds);
    }
  };

  const filteredMissions = missions.filter(m => {
    if (selectedCategory === 'all') return true;
    return m.category === selectedCategory;
  });

  const getCategoryIcon = (category: Mission['category']) => {
    switch (category) {
      case 'mining':
        return <Pickaxe className="w-4 h-4 text-cyan-400" />;
      case 'combat':
        return <Swords className="w-4 h-4 text-red-400" />;
      case 'boss':
        return <Skull className="w-4 h-4 text-amber-400" />;
      case 'exploration':
      default:
        return <Compass className="w-4 h-4 text-purple-400" />;
    }
  };

  const handleClaimAllMissions = () => {
    missions
      .filter(m => m.completed && !m.claimed)
      .forEach(m => onClaimReward(m.id));
  };

  // Rank title based on overall progress
  const getRankTitle = (pct: number) => {
    if (pct >= 100) return { title: 'Galaktická Legenda 👑', color: 'text-amber-400 border-amber-500/50 bg-amber-950/40' };
    if (pct >= 75) return { title: 'Hvězdný Admirál 🌟', color: 'text-purple-400 border-purple-500/50 bg-purple-950/40' };
    if (pct >= 50) return { title: 'Kapitán Flotily 🚀', color: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/40' };
    if (pct >= 25) return { title: 'Vesmírny Pilot 🛸', color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40' };
    return { title: 'Nováček Sektoru 👨‍🚀', color: 'text-slate-400 border-slate-700 bg-slate-900/60' };
  };

  const currentRank = getRankTitle(missionsProgressPct);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Vesmírné Mise, Úspěchy a Pokrok
                  {(completedUnclaimedMissions.length > 0 || unclaimedAchievementsCount > 0) && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold animate-pulse">
                      {completedUnclaimedMissions.length + unclaimedAchievementsCount} K ODMĚNĚ
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">Můžete mít až 3 aktivní připnuté mise na HUD widgetu současně</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Top Level Nav Tabs */}
          <div className="px-6 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('missions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'missions'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Target className="w-4 h-4" />
                Aktivní Mise ({totalMissionsCompleted}/{totalMissionsCount})
                {completedUnclaimedMissions.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('achievements')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'achievements'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                Úspěchy ({totalAchievementsCompleted}/{rawAchievements.length})
                {unclaimedAchievementsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('progress')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'progress'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-cyan-300" />
                Pokrok a Rank ({missionsProgressPct}%)
              </button>
            </div>

            {activeTab === 'missions' && completedUnclaimedMissions.length > 1 && (
              <button
                onClick={handleClaimAllMissions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0"
              >
                <Gift className="w-3.5 h-3.5" />
                VYBRAT ODMĚNY ({completedUnclaimedMissions.length})
              </button>
            )}
          </div>

          {/* TAB 1: MISSIONS LIST */}
          {activeTab === 'missions' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Category Sub-Filters */}
              <div className="px-6 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: 'Všechny', count: missions.length },
                    { id: 'mining', label: '⛏️ Těžba', count: missions.filter(m => m.category === 'mining').length },
                    { id: 'combat', label: '⚔️ Boj', count: missions.filter(m => m.category === 'combat').length },
                    { id: 'boss', label: '☠️ Bossové', count: missions.filter(m => m.category === 'boss').length },
                    { id: 'exploration', label: '🧭 Průzkum', count: missions.filter(m => m.category === 'exploration').length }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        selectedCategory === tab.id
                          ? 'bg-slate-800 text-white border border-violet-500/40'
                          : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 font-mono text-slate-300">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1 shrink-0">
                  <Pin className="w-3 h-3 fill-amber-400" />
                  Připnuto: {pinnedMissionIds.length}/3 na HUD
                </div>
              </div>

              {/* Missions Content Area */}
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                {filteredMissions.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">Žádné mise v této kategorii.</p>
                ) : (
                  filteredMissions.map((m) => {
                    const progressPct = Math.min(100, Math.round((m.currentAmount / m.targetAmount) * 100));
                    const pinnedIndex = pinnedMissionIds.indexOf(m.id);
                    const isPinned = pinnedIndex !== -1;

                    return (
                      <div
                        key={m.id}
                        className={`relative p-4 rounded-xl border transition-all ${
                          m.claimed
                            ? 'bg-slate-950/40 border-slate-900/60 opacity-60'
                            : m.completed
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 mt-0.5">
                              {getCategoryIcon(m.category)}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                                {m.title}
                                {isPinned && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                                    <Pin className="w-3 h-3 fill-amber-400" /> HUD Priorita #{pinnedIndex + 1}
                                  </span>
                                )}
                                {m.claimed && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                                    Vybráno
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                            </div>
                          </div>

                          {/* Pin Toggle & Rewards & Claim Button */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                              {!m.claimed && (
                                <button
                                  onClick={() => onTogglePinMission(m.id)}
                                  className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                    isPinned
                                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                                  }`}
                                  title={isPinned ? 'Odepnout z HUD' : 'Připnout na HUD (až 3 mise)'}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                                  <span>{isPinned ? `#${pinnedIndex + 1}` : 'Připnout'}</span>
                                </button>
                              )}

                              <div className="flex items-center gap-2 font-mono text-xs">
                                {m.rewardCrystals > 0 && (
                                  <span className="flex items-center gap-1 text-cyan-300 font-semibold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                                    <Sparkles className="w-3 h-3 text-cyan-400" />
                                    +{m.rewardCrystals}
                                  </span>
                                )}
                                {m.rewardDiamonds > 0 && (
                                  <span className="flex items-center gap-1 text-violet-300 font-semibold bg-violet-950/50 px-2 py-0.5 rounded border border-violet-800/40">
                                    <Gem className="w-3 h-3 text-violet-400" />
                                    +{m.rewardDiamonds}
                                  </span>
                                )}
                              </div>
                            </div>

                            {m.completed && !m.claimed ? (
                              <button
                                onClick={() => onClaimReward(m.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs tracking-wide shadow-md shadow-emerald-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              >
                                <Gift className="w-3.5 h-3.5" />
                                VYBRAT ODMĚNU
                              </button>
                            ) : m.claimed ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" /> Splněno
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                            <span>POSTUP MISÍ:</span>
                            <span>
                              {m.currentAmount} / {m.targetAmount} ({progressPct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full transition-all duration-300 ${
                                m.completed ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-500 to-violet-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACHIEVEMENTS SECTION (Includes Graphic Progress Element per Category) */}
          {activeTab === 'achievements' && (
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Category Progress Graphic Visualizer Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                        GRAFICKÝ PŘEHLED DOKONČENÝCH MISÍ DLE KATEGORIÍ
                      </h4>
                      <p className="text-[11px] text-slate-400">Počet splněných kontraktů vůči celkovému počtu</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded-lg shrink-0">
                    {totalMissionsCompleted} / {totalMissionsCount} DOKONČENO ({missionsProgressPct}%)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { key: 'mining', label: 'Těžba', icon: Pickaxe, color: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-500/30' },
                    { key: 'combat', label: 'Boj', icon: Swords, color: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30' },
                    { key: 'exploration', label: 'Průzkum', icon: Compass, color: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500/30' },
                    { key: 'boss', label: 'Bossové', icon: Skull, color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30' }
                  ].map(cat => {
                    const catMissions = missions.filter(m => m.category === cat.key);
                    const doneCount = catMissions.filter(m => m.completed).length;
                    const totalCount = catMissions.length;
                    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                    const Icon = cat.icon;

                    return (
                      <div key={cat.key} className={`p-3 rounded-xl bg-slate-950/80 border ${cat.border} flex flex-col justify-between`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                            <span className="font-bold text-xs text-slate-200">{cat.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold ${cat.color}`}>{pct}%</span>
                        </div>
                        
                        <div className="text-xs font-mono font-extrabold text-white mb-1.5">
                          {doneCount} / {totalCount} <span className="text-[10px] font-normal text-slate-400">misí</span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full ${cat.bg} transition-all duration-300`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Header Banner for Achievements */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-amber-200">Kariérní Úspěchy a Milníky</h3>
                    <p className="text-xs text-amber-400/80">
                      Plňte celoživotní výzvy pilota a získejte prestižní ocenění a vzácné krystaly
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-slate-400">DOKONČENO:</span>
                  <div className="font-black text-amber-400 text-sm">
                    {totalAchievementsCompleted} / {rawAchievements.length}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rawAchievements.map(ach => {
                  const isDone = ach.currentAmount >= ach.targetAmount;
                  const isClaimed = claimedAchievements.includes(ach.id);
                  const achPct = Math.min(100, Math.round((ach.currentAmount / ach.targetAmount) * 100));

                  const tierStyles = {
                    bronze: 'border-amber-700/50 text-amber-500 bg-amber-950/20',
                    silver: 'border-slate-400/50 text-slate-300 bg-slate-900/40',
                    gold: 'border-amber-400/60 text-amber-300 bg-amber-950/30',
                    platinum: 'border-cyan-400/60 text-cyan-300 bg-cyan-950/30'
                  };

                  return (
                    <div
                      key={ach.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isClaimed
                          ? 'bg-slate-950/40 border-slate-900/80 opacity-60'
                          : isDone
                          ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950/70 border-slate-800/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{ach.icon}</span>
                            <div>
                              <h4 className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                                {ach.title}
                                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase ${tierStyles[ach.tier]}`}>
                                  {ach.tier}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{ach.description}</p>
                            </div>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mt-3">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                            <span>POSTUP MILNÍKU:</span>
                            <span className="font-bold text-amber-400">
                              {ach.currentAmount} / {ach.targetAmount} ({achPct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isDone ? 'bg-amber-400' : 'bg-amber-600/70'
                              }`}
                              style={{ width: `${achPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Rewards & Action */}
                      <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="flex items-center gap-1 text-cyan-300 font-semibold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40 text-[10px]">
                            <Sparkles className="w-3 h-3 text-cyan-400" /> +{ach.rewardCrystals}
                          </span>
                          <span className="flex items-center gap-1 text-violet-300 font-semibold bg-violet-950/50 px-2 py-0.5 rounded border border-violet-800/40 text-[10px]">
                            <Gem className="w-3 h-3 text-violet-400" /> +{ach.rewardDiamonds}
                          </span>
                        </div>

                        {isDone && !isClaimed ? (
                          <button
                            onClick={() => handleClaimAchievement(ach)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                          >
                            <Gift className="w-3.5 h-3.5" /> VYBRAT
                          </button>
                        ) : isClaimed ? (
                          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3 text-amber-400" /> VYBRÁNO
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">PROBÍHÁ</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: VISUAL PROGRESS DASHBOARD */}
          {activeTab === 'progress' && (
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Pilot Rank Banner */}
              <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${currentRank.color}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    🏆
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase font-mono tracking-widest text-slate-400">
                      AKTUÁLNÍ SKON PILOTA
                    </span>
                    <h3 className="text-xl font-black text-white">{currentRank.title}</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Celková splněnost sektorových operací: <b className="text-cyan-300">{missionsProgressPct}%</b>
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-48 flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-slate-200">
                    <span>PROGRESS:</span>
                    <span>{totalMissionsCompleted} / {totalMissionsCount}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-amber-400 rounded-full transition-all duration-500" 
                      style={{ width: `${missionsProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Category Progress Breakdown Bars */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Rozpad Pokroku Dle Kategorií
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'mining', label: '⛏️ Těžební Operace', color: 'bg-cyan-500', text: 'text-cyan-400' },
                    { key: 'combat', label: '⚔️ Bojové Mise', color: 'bg-red-500', text: 'text-red-400' },
                    { key: 'boss', label: '☠️ Sektorové Bitvy', color: 'bg-amber-500', text: 'text-amber-400' },
                    { key: 'exploration', label: '🧭 Průzkum & Cestování', color: 'bg-purple-500', text: 'text-purple-400' }
                  ].map(cat => {
                    const catMissions = missions.filter(m => m.category === cat.key);
                    const doneCount = catMissions.filter(m => m.completed).length;
                    const totalCatCount = catMissions.length;
                    const pct = totalCatCount > 0 ? Math.round((doneCount / totalCatCount) * 100) : 0;

                    return (
                      <div key={cat.key} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-200">
                          <span>{cat.label}</span>
                          <span className={`font-mono ${cat.text}`}>{doneCount} / {totalCatCount} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full ${cat.color} transition-all duration-300`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Milestone Rewards Track */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Milníková Odměnová Dráha
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { pct: 25, title: 'Kadet Milník', crystals: 300, diamonds: 5 },
                    { pct: 50, title: 'Kapitán Milník', crystals: 600, diamonds: 10 },
                    { pct: 75, title: 'Admirál Milník', crystals: 1200, diamonds: 20 },
                    { pct: 100, title: 'Legenda Milník', crystals: 3000, diamonds: 50 }
                  ].map(m => {
                    const isUnlocked = missionsProgressPct >= m.pct;
                    const isClaimed = claimedMilestones.includes(m.pct);

                    return (
                      <div
                        key={m.pct}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isClaimed
                            ? 'bg-slate-950/40 border-slate-900 opacity-60'
                            : isUnlocked
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-950/80 border-slate-800 opacity-70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-black text-amber-400">{m.pct}% Pokrok</span>
                            {isUnlocked ? <Sparkles className="w-4 h-4 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-slate-600" />}
                          </div>
                          <h5 className="font-bold text-xs text-white">{m.title}</h5>
                          <div className="flex items-center gap-2 font-mono text-[10px] mt-2">
                            <span className="text-cyan-300">+{m.crystals} 💎</span>
                            <span className="text-violet-300">+{m.diamonds} 🔷</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          {isUnlocked && !isClaimed ? (
                            <button
                              onClick={() => handleClaimMilestone(m.pct, m.crystals, m.diamonds)}
                              className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] tracking-wider uppercase cursor-pointer hover:scale-102 transition-all shadow-md"
                            >
                              VYBRAT ODMĚNU
                            </button>
                          ) : isClaimed ? (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> VYBRÁNO
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-600 text-center block">ZAMČENO</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>💡 Pinned missions will appear automatically on your HUD for live flight tracking.</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MissionsModal;
