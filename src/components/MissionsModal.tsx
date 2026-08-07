/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  Zap,
  Gift
} from 'lucide-react';

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: 'mining' | 'combat' | 'exploration' | 'boss';
  targetType: 'mine_crystal' | 'mine_diamond' | 'mine_obsidian' | 'kill_pirates' | 'destroy_asteroids' | 'boss_kill' | 'super_magnet_use';
  targetAmount: number;
  currentAmount: number;
  rewardCrystals: number;
  rewardDiamonds: number;
  completed: boolean;
  claimed: boolean;
}

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  onClaimReward: (missionId: string) => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  isOpen,
  onClose,
  missions,
  onClaimReward
}) => {
  if (!isOpen) return null;

  const completedUnclaimedCount = missions.filter(m => m.completed && !m.claimed).length;

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Vesmírné Mise a Kontrakty
                  {completedUnclaimedCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold animate-pulse">
                      {completedUnclaimedCount} K ODMĚNĚ
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">Plňte letové úkoly a získejte štědré odměny v krystalech a diamantech</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Missions List */}
          <div className="p-6 space-y-3 overflow-y-auto flex-1">
            {missions.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-8">Žádné aktivní mise.</p>
            ) : (
              missions.map((m) => {
                const progressPct = Math.min(100, Math.round((m.currentAmount / m.targetAmount) * 100));

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
                            {m.claimed && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                                Vybráno
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                        </div>
                      </div>

                      {/* Rewards & Claim Button */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
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

                        {m.completed && !m.claimed ? (
                          <button
                            onClick={() => onClaimReward(m.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs tracking-wide shadow-md shadow-emerald-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            VYBRAT ODMĚNU
                          </button>
                        ) : m.claimed ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-1">
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
                            m.completed ? 'bg-emerald-400' : 'bg-cyan-500'
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

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>💡 Sledujte plnění úkolů v reálném čase přímo při letu vesmírem.</span>
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
