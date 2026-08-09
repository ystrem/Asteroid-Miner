/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mission } from './MissionsModal';
import { 
  Target, 
  ChevronRight, 
  ChevronLeft,
  Sparkles, 
  Gem, 
  Pin, 
  Minimize2, 
  Maximize2,
  Pickaxe,
  Swords,
  Skull,
  Compass,
  Zap,
  Layers
} from 'lucide-react';

interface ActiveMissionHudWidgetProps {
  missions: Mission[];
  pinnedMissionIds: string[];
  onTogglePinMission: (id: string) => void;
  onOpenMissionsModal: () => void;
}

export const ActiveMissionHudWidget: React.FC<ActiveMissionHudWidgetProps> = ({
  missions,
  pinnedMissionIds,
  onTogglePinMission,
  onOpenMissionsModal
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activePriorityIndex, setActivePriorityIndex] = useState<number>(0);

  // Determine up to 3 active priority missions
  // 1) Unclaimed pinned missions
  const pinnedList = missions.filter(m => pinnedMissionIds.includes(m.id) && !m.claimed);
  
  // 2) Unclaimed & incomplete non-pinned missions to fill up to 3 slots
  const fallbackList = missions.filter(m => !pinnedMissionIds.includes(m.id) && !m.claimed);

  // Combine to form up to 3 active priorities
  const activeMissions: Mission[] = [...pinnedList, ...fallbackList].slice(0, 3);

  // Fallback if all 3 are completed or list empty
  if (activeMissions.length === 0) {
    const defaultM = missions.find(m => !m.claimed) || missions[0];
    if (defaultM) activeMissions.push(defaultM);
  }

  if (activeMissions.length === 0) return null;

  // Clamp current index
  const safeIndex = activePriorityIndex % activeMissions.length;
  const activeMission = activeMissions[safeIndex];

  const progressPct = Math.min(100, Math.round((activeMission.currentAmount / activeMission.targetAmount) * 100));

  const getCategoryIcon = (category: Mission['category']) => {
    switch (category) {
      case 'mining':
        return <Pickaxe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'combat':
        return <Swords className="w-3.5 h-3.5 text-red-400" />;
      case 'boss':
        return <Skull className="w-3.5 h-3.5 text-amber-400" />;
      case 'exploration':
      default:
        return <Compass className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  // Fast switch to next priority among up to 3 active ones
  const handleFastSwitchNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePriorityIndex((prev) => (prev + 1) % activeMissions.length);
  };

  const handleFastSwitchPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePriorityIndex((prev) => (prev - 1 + activeMissions.length) % activeMissions.length);
  };

  return (
    <div className="pointer-events-auto transition-all">
      {isCollapsed ? (
        /* Collapsed View */
        <div 
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-violet-500/30 text-slate-200 text-xs font-mono shadow-lg shadow-violet-950/40 cursor-pointer backdrop-blur-md group"
          title="Rozbalit HUD widget mise"
        >
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <Target className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-bold max-w-[120px] truncate">{activeMission.title}</span>
          <span className="text-cyan-400 font-extrabold">{progressPct}%</span>
          <span className="text-[10px] px-1.5 rounded bg-violet-950 text-violet-300 font-bold border border-violet-800/40">
            {safeIndex + 1}/{activeMissions.length}
          </span>
          <Maximize2 className="w-3 h-3 text-slate-400 group-hover:text-white" />
        </div>
      ) : (
        /* Expanded HUD Widget View */
        <div 
          onClick={onOpenMissionsModal}
          className={`relative w-80 p-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all cursor-pointer group ${
            activeMission.completed && !activeMission.claimed
              ? 'bg-emerald-950/90 border-emerald-500/80 shadow-emerald-500/20 animate-pulse'
              : 'bg-slate-950/90 hover:bg-slate-900/95 border-slate-800 hover:border-violet-500/50 shadow-slate-950/80'
          }`}
          id="hud-active-mission-widget"
        >
          {/* Top Priority Selector Tabs Bar (Up to 3 active missions) */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-extrabold font-mono tracking-wider text-violet-400 uppercase mr-1">
                PRIORITY ({activeMissions.length}/3):
              </span>
              {activeMissions.map((m, idx) => {
                const isSelected = idx === safeIndex;
                const isPinned = pinnedMissionIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePriorityIndex(idx);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/50'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                    title={`Mise ${idx + 1}: ${m.title}`}
                  >
                    <span>#{idx + 1}</span>
                    {isPinned && <Pin className="w-2.5 h-2.5 fill-amber-400 text-amber-300" />}
                  </button>
                );
              })}
            </div>

            {/* Fast Switch Priority Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleFastSwitchPrev}
                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Předchozí aktivní mise"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFastSwitchNext}
                className="p-1 rounded-lg bg-violet-950 hover:bg-violet-900 border border-violet-800 text-violet-300 hover:text-white transition-colors flex items-center gap-0.5 text-[9px] font-bold px-1.5"
                title="Rychlé přepnutí na další prioritu"
              >
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(true);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
                title="Sbalit widget"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Mission Header & Details */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-slate-900 border border-slate-800">
                {getCategoryIcon(activeMission.category)}
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-violet-300 transition-colors leading-tight truncate max-w-[160px]">
                {activeMission.title}
              </h4>
            </div>

            <div className="flex items-center gap-1">
              {pinnedMissionIds.includes(activeMission.id) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5 fill-amber-400" /> Pinned
                </span>
              )}
              {activeMission.completed && !activeMission.claimed && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black uppercase">
                  HOTOVO
                </span>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 line-clamp-1 mb-2">
            {activeMission.description}
          </p>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-300 mb-1">
              <span className="text-slate-400">POSTUP (# {safeIndex + 1}):</span>
              <span className="font-bold text-cyan-400">
                {activeMission.currentAmount} / {activeMission.targetAmount} ({progressPct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`h-full transition-all duration-300 ${
                  activeMission.completed ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-500 to-violet-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Quick Active Priority Summary Bar */}
          {activeMissions.length > 1 && (
            <div className="flex items-center gap-1 py-1 px-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 mb-2">
              <Layers className="w-3 h-3 text-slate-500 shrink-0" />
              <div className="flex-1 flex gap-1 overflow-hidden">
                {activeMissions.map((m, idx) => (
                  <div
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePriorityIndex(idx);
                    }}
                    className={`flex-1 h-1 rounded-full transition-all ${
                      idx === safeIndex
                        ? 'bg-violet-400'
                        : m.completed
                        ? 'bg-emerald-500/60'
                        : 'bg-slate-700/60'
                    }`}
                    title={`Mise ${idx + 1}: ${m.title}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer Reward Preview & CTA */}
          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-900">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[9px]">ODMĚNA:</span>
              {activeMission.rewardCrystals > 0 && (
                <span className="text-cyan-300 font-bold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  +{activeMission.rewardCrystals}
                </span>
              )}
              {activeMission.rewardDiamonds > 0 && (
                <span className="text-violet-300 font-bold flex items-center gap-0.5">
                  <Gem className="w-2.5 h-2.5 text-violet-400" />
                  +{activeMission.rewardDiamonds}
                </span>
              )}
            </div>

            <span className="text-violet-400 font-bold text-[9px] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              OTEVŘÍT MENU <ChevronRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveMissionHudWidget;
