/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  TrendingUp, 
  Gem, 
  Sparkles, 
  Clock, 
  BarChart3, 
  Zap, 
  ShieldAlert, 
  CheckCircle2,
  PieChart
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';

export interface EarningDataPoint {
  time: string; // "14:02"
  timestamp: number;
  crystals: number; // accumulated or rate
  diamonds: number; // accumulated or rate
  deltaCrystals: number; // earned in this interval
  deltaDiamonds: number;
}

interface EarningsChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: EarningDataPoint[];
  currentRunCrystals: number;
  currentRunDiamonds: number;
  totalCrystals: number;
  totalDiamonds: number;
}

export const EarningsChartModal: React.FC<EarningsChartModalProps> = ({
  isOpen,
  onClose,
  data,
  currentRunCrystals,
  currentRunDiamonds,
  totalCrystals,
  totalDiamonds
}) => {
  const [viewMode, setViewMode] = useState<'cumulative' | 'interval'>('cumulative');

  if (!isOpen) return null;

  // Prepare chart data based on view mode
  const chartData = data.map((pt, idx) => {
    if (viewMode === 'interval') {
      return {
        time: pt.time,
        Krystaly: pt.deltaCrystals,
        Diamanty: pt.deltaDiamonds,
      };
    }
    return {
      time: pt.time,
      Krystaly: pt.crystals,
      Diamanty: pt.diamonds,
    };
  });

  // Calculate totals and statistics over last 10 minutes
  const totalCrystalsInWindow = data.reduce((acc, curr) => acc + curr.deltaCrystals, 0);
  const totalDiamondsInWindow = data.reduce((acc, curr) => acc + curr.deltaDiamonds, 0);
  
  const peakCrystalsInterval = Math.max(...data.map(d => d.deltaCrystals), 0);
  const peakDiamondsInterval = Math.max(...data.map(d => d.deltaDiamonds), 0);

  // Rate per minute calculation
  const minutesTracked = Math.max(1, Math.round((data.length * 10) / 60));
  const avgCrystalsPerMin = Math.round(totalCrystalsInWindow / minutesTracked);
  const avgDiamondsPerMin = Math.round((totalDiamondsInWindow / minutesTracked) * 10) / 10;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Přehled Výdělků Surovin
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700 font-mono">
                    Posledních 10 minut
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Reálný graf těžby krystalů a vzácných diamantů v reálném čase</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Cumulative vs Interval */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setViewMode('cumulative')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                    viewMode === 'cumulative'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Kumulativně
                </button>
                <button
                  onClick={() => setViewMode('interval')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                    viewMode === 'interval'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Průběžný Zisk
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 pb-2">
            <div className="bg-slate-950/70 border border-cyan-500/20 rounded-xl p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Krystaly (Tento let)</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="text-xl font-bold font-mono text-cyan-300 mt-1">
                +{currentRunCrystals}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Celkem v bance: {totalCrystals}</span>
            </div>

            <div className="bg-slate-950/70 border border-violet-500/20 rounded-xl p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Diamanty (Tento let)</span>
                <Gem className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-xl font-bold font-mono text-violet-300 mt-1">
                +{currentRunDiamonds}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Celkem v bance: {totalDiamonds}</span>
            </div>

            <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Rychlost Těžby</span>
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {avgCrystalsPerMin} <span className="text-xs text-slate-400 font-sans font-normal">kry/min</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {avgDiamondsPerMin} dia/min
              </span>
            </div>

            <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Nejvyšší Žeň</span>
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xl font-bold font-mono text-amber-300 mt-1">
                +{peakCrystalsInterval}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Max za interval (10s)
              </span>
            </div>
          </div>

          {/* Main Recharts Container */}
          <div className="p-6 flex-1 min-h-[320px]">
            {chartData.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-950/40">
                <Clock className="w-8 h-8 text-slate-600 animate-spin mb-2" />
                <p className="text-sm font-semibold text-slate-300">Shromažďování telemetrických dat...</p>
                <p className="text-xs text-slate-500 mt-1">Graf se zaplní během několika sekund po zahájení těžby asteroidů!</p>
              </div>
            ) : (
              <div className="w-full h-[320px] bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCrystals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorDiamonds" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#020617', 
                        borderColor: '#334155', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                      itemStyle={{ padding: '2px 0' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Krystaly"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCrystals)"
                      activeDot={{ r: 6, stroke: '#67e8f9', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Diamanty"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDiamonds)"
                      activeDot={{ r: 6, stroke: '#c084fc', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Footer information */}
          <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Snímkování aktivní (každých 10 sekund)</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer text-xs"
            >
              Zavřít
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EarningsChartModal;
