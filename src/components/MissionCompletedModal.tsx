/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mission } from './MissionsModal';
import { Trophy, Sparkles, Gem, CheckCircle, ArrowRight, X, Gift, Zap, Flame, Clock } from 'lucide-react';

interface MissionCompletedModalProps {
  mission: Mission | null;
  onClose: () => void;
  onClaimReward: (missionId: string) => void;
  onOpenMissionsModal?: () => void;
}

export const MissionCompletedModal: React.FC<MissionCompletedModalProps> = ({
  mission,
  onClose,
  onClaimReward,
  onOpenMissionsModal
}) => {
  if (!mission) return null;

  const handleClaimAndConfirm = () => {
    onClaimReward(mission.id);
    onClose();
  };

  const bonusCrystals = mission.bonusCrystalsGained || 0;
  const bonusDiamonds = mission.bonusDiamondsGained || 0;
  const totalCrystals = mission.rewardCrystals + bonusCrystals;
  const totalDiamonds = mission.rewardDiamonds + bonusDiamonds;
  const hasBonus = bonusCrystals > 0 || bonusDiamonds > 0 || !!mission.bonusReason;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20 text-center overflow-hidden"
          id="mission-completed-reward-modal"
        >
          {/* Top Decorative Rays */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close X */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Trophy Header Icon */}
          <motion.div
            initial={{ rotate: -15, scale: 0.5 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 p-0.5 shadow-xl shadow-emerald-500/30 flex items-center justify-center"
          >
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Trophy className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
          </motion.div>

          {/* Title */}
          <span className="text-[10px] font-black uppercase font-mono tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full inline-block mb-2">
            🎯 MISE USPEŠNĚ SPLNĚNA!
          </span>

          <h3 className="text-xl font-black text-white mb-1 leading-tight">
            {mission.title}
          </h3>

          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4 leading-relaxed">
            {mission.description}
          </p>

          {/* Dynamic Bonus Banner if active */}
          {hasBonus && (
            <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-amber-950/90 border border-amber-500/60 shadow-lg shadow-amber-500/10 text-left animate-pulse">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-xs font-black text-amber-300 uppercase font-mono tracking-wider">
                  ⚡ DYNAMICKÝ REKORDNÍ BONUS NAVÝŠEN!
                </span>
              </div>
              <p className="text-[11px] text-amber-200/90 font-medium">
                {mission.bonusReason || 'Splněno za ztížených podmínek nebo v rekordním čase!'}
              </p>
              <div className="mt-1.5 flex items-center gap-3 font-mono text-xs font-bold text-amber-300">
                {bonusCrystals > 0 && <span>+ {bonusCrystals} Extra Krystalů</span>}
                {bonusDiamonds > 0 && <span>+ {bonusDiamonds} Extra Diamantů</span>}
              </div>
            </div>
          )}

          {/* Reward Breakdown Box */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 mb-6 shadow-inner">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-3 text-left">
              🎁 CELKOVÝ ZÍSKANÝ ODMĚNOVÝ BALÍČEK:
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* Crystals */}
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-[9px] font-mono text-cyan-300/80 uppercase block">Krystaly</span>
                  <span className="text-base font-black text-cyan-300 font-mono">
                    +{totalCrystals}
                  </span>
                  {bonusCrystals > 0 && (
                    <span className="text-[9px] text-amber-400 block font-mono">
                      (vč. +{bonusCrystals} bonus)
                    </span>
                  )}
                </div>
              </div>

              {/* Diamonds */}
              <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/30 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                  <Gem className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-[9px] font-mono text-violet-300/80 uppercase block">Diamanty</span>
                  <span className="text-base font-black text-violet-300 font-mono">
                    +{totalDiamonds}
                  </span>
                  {bonusDiamonds > 0 && (
                    <span className="text-[9px] text-amber-400 block font-mono">
                      (vč. +{bonusDiamonds} bonus)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleClaimAndConfirm}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide uppercase shadow-lg shadow-emerald-500/30 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              VYBRAT ODMĚNY A POTVRDIT
            </button>

            {onOpenMissionsModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMissionsModal();
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Zobrazit všechny mise</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MissionCompletedModal;
