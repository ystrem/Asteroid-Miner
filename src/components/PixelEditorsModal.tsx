/**
 * Pixel Art Ship (16x16) and Planet (32x32) Editors for Kids & Developers
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Rocket, Globe, Paintbrush, Eraser, RotateCw, FlipHorizontal, 
  Copy, Check, Sparkles, Play, ShieldAlert, Zap, Gem, Flame, Snowflake
} from 'lucide-react';
import { CustomPlanetData, saveActiveShipSprite, saveActivePlanetSprites, getActivePlanetSprites } from '../data/sprites';

interface PixelEditorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyShipSprite: (dataUrl: string) => void;
  onAddPlanetToWorld: (planet: CustomPlanetData) => void;
  playLaserSound?: () => void;
  playUpgradeSound?: () => void;
}

// 16x16 Color Palette
const SHIP_PALETTE = [
  { name: 'Kovová šedá', color: '#94a3b8' },
  { name: 'Ocelová modrá', color: '#0284c7' },
  { name: 'Neon azurová', color: '#38bdf8' },
  { name: 'Zářivá červená', color: '#ef4444' },
  { name: 'Neon zelená', color: '#22c55e' },
  { name: 'Zlatá žlutá', color: '#eab308' },
  { name: 'Vesmírná fialová', color: '#a855f7' },
  { name: 'Ohnivá oranžová', color: '#f97316' },
  { name: 'Černá', color: '#0f172a' },
  { name: 'Křídově bílá', color: '#f8fafc' },
  { name: 'Guma (Průhledná)', color: 'transparent' },
];

// 32x32 Planet Palette
const PLANET_PALETTE = [
  { name: 'Hnědá půda', color: '#854d0e' },
  { name: 'Tmavé kamení', color: '#451a03' },
  { name: 'Zelená pevnina', color: '#15803d' },
  { name: 'Oceánská modrá', color: '#0284c7' },
  { name: 'Hluboký oceán', color: '#1e3a8a' },
  { name: 'Lávová oranžová', color: '#ea580c' },
  { name: 'Zlatá ruda', color: '#f59e0b' },
  { name: 'Ledová azurová', color: '#06b6d4' },
  { name: 'Ledově bílá', color: '#e0f2fe' },
  { name: 'Fialová mlhovina', color: '#7e22ce' },
  { name: 'Kráterová šedá', color: '#64748b' },
  { name: 'Černá', color: '#0f172a' },
  { name: 'Guma (Průhledná)', color: 'transparent' },
];

export const PixelEditorsModal: React.FC<PixelEditorsModalProps> = ({
  isOpen,
  onClose,
  onApplyShipSprite,
  onAddPlanetToWorld,
  playLaserSound,
  playUpgradeSound,
}) => {
  const [activeTab, setActiveTab] = useState<'ship' | 'planet'>('ship');

  // 16x16 Ship Grid State
  const [shipGrid, setShipGrid] = useState<string[][]>(() => {
    // Default starter symmetrical rocket shape
    const grid: string[][] = Array(16).fill(null).map(() => Array(16).fill('transparent'));
    // Draw nose
    grid[1][7] = '#38bdf8'; grid[1][8] = '#38bdf8';
    grid[2][7] = '#38bdf8'; grid[2][8] = '#38bdf8';
    grid[3][6] = '#0284c7'; grid[3][7] = '#f8fafc'; grid[3][8] = '#f8fafc'; grid[3][9] = '#0284c7';
    // Body & cockpit
    grid[4][6] = '#0284c7'; grid[4][7] = '#38bdf8'; grid[4][8] = '#38bdf8'; grid[4][9] = '#0284c7';
    grid[5][6] = '#94a3b8'; grid[5][7] = '#f8fafc'; grid[5][8] = '#f8fafc'; grid[5][9] = '#94a3b8';
    grid[6][5] = '#0284c7'; grid[6][6] = '#94a3b8'; grid[6][7] = '#94a3b8'; grid[6][8] = '#94a3b8'; grid[6][9] = '#94a3b8'; grid[6][10] = '#0284c7';
    // Wings
    grid[7][4] = '#ef4444'; grid[7][5] = '#94a3b8'; grid[7][6] = '#94a3b8'; grid[7][7] = '#94a3b8'; grid[7][8] = '#94a3b8'; grid[7][9] = '#94a3b8'; grid[7][10] = '#94a3b8'; grid[7][11] = '#ef4444';
    grid[8][3] = '#ef4444'; grid[8][4] = '#ef4444'; grid[8][5] = '#94a3b8'; grid[8][6] = '#94a3b8'; grid[8][7] = '#94a3b8'; grid[8][8] = '#94a3b8'; grid[8][9] = '#94a3b8'; grid[8][10] = '#94a3b8'; grid[8][11] = '#ef4444'; grid[8][12] = '#ef4444';
    grid[9][2] = '#ef4444'; grid[9][5] = '#94a3b8'; grid[9][6] = '#0f172a'; grid[9][7] = '#94a3b8'; grid[9][8] = '#94a3b8'; grid[9][9] = '#0f172a'; grid[9][10] = '#94a3b8'; grid[9][13] = '#ef4444';
    // Engines & thrusters
    grid[10][6] = '#f97316'; grid[10][7] = '#64748b'; grid[10][8] = '#64748b'; grid[10][9] = '#f97316';
    grid[11][6] = '#f97316'; grid[11][7] = '#eab308'; grid[11][8] = '#eab308'; grid[11][9] = '#f97316';
    grid[12][7] = '#ef4444'; grid[12][8] = '#ef4444';
    return grid;
  });

  const [selectedShipColor, setSelectedShipColor] = useState<string>('#38bdf8');

  // 32x32 Planet Grid State
  const [planetGrid, setPlanetGrid] = useState<string[][]>(() => {
    const grid: string[][] = Array(32).fill(null).map(() => Array(32).fill('transparent'));
    // Draw default round planet outline & continents inside 32x32
    const cx = 15.5, cy = 15.5, r = 13.5;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= r) {
          if ((x > 10 && x < 22 && y > 8 && y < 20) || (x > 18 && y > 18 && x < 28 && y < 26)) {
            grid[y][x] = '#15803d'; // land
          } else if (dist > r - 1.5) {
            grid[y][x] = '#0284c7'; // atmosphere/edge
          } else {
            grid[y][x] = '#1e3a8a'; // ocean
          }
        }
      }
    }
    return grid;
  });

  const [selectedPlanetColor, setSelectedPlanetColor] = useState<string>('#15803d');
  const [planetName, setPlanetName] = useState<string>('Moje Dětská Planeta');
  const [planetType, setPlanetType] = useState<'normal' | 'ice' | 'lava' | 'gold'>('normal');

  // Drag-to-draw state
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  // Export Modal Overlay State
  const [exportModalContent, setExportModalContent] = useState<{
    title: string;
    codeText: string;
    instructions: string;
    type: 'ship' | 'planet';
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Canvas Refs for Preview & Export Data URL generation
  const shipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const planetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Universal Grid Color Update
  const paintCell = useCallback((x: number, y: number, color: string, isShip: boolean) => {
    if (isShip) {
      setShipGrid(prev => {
        if (prev[y][x] === color) return prev;
        const next = prev.map(row => [...row]);
        next[y][x] = color;
        return next;
      });
    } else {
      setPlanetGrid(prev => {
        if (prev[y][x] === color) return prev;
        const next = prev.map(row => [...row]);
        next[y][x] = color;
        return next;
      });
    }
  }, []);

  // Global mouse up handler for continuous drag drawing
  useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Convert Grid array to Base64 PNG Data URL
  const renderGridToDataUrl = (grid: string[][], size: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const col = grid[y][x];
        if (col && col !== 'transparent') {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas.toDataURL('image/png');
  };

  // 🛸 Apply Custom Ship To Game
  const handleApplyShip = () => {
    const dataUrl = renderGridToDataUrl(shipGrid, 16);
    saveActiveShipSprite(dataUrl);
    onApplyShipSprite(dataUrl);
    if (playUpgradeSound) playUpgradeSound();
  };

  // 🛸 Export Custom Ship Code for GitHub
  const handleExportShip = () => {
    const dataUrl = renderGridToDataUrl(shipGrid, 16);
    const codeSnippet = `// Vložte tento řetězec do src/data/sprites.ts do proměnné PLAYER_SHIP_SPRITE:\nexport const PLAYER_SHIP_SPRITE: string = "${dataUrl}";`;
    
    setExportModalContent({
      title: '🛸 Export Kódu Lodě pro GitHub',
      codeText: codeSnippet,
      instructions: 'Tohle je kód naší nové lodě! Zkopírujte ho kliknutím na tlačítko a pošlete v chatu AI pro trvalé uložení na GitHub.',
      type: 'ship'
    });
    setCopiedSuccess(false);
  };

  // 🌍 Create Planet In Game World
  const handleAddPlanet = () => {
    const dataUrl = renderGridToDataUrl(planetGrid, 32);
    const newPlanet: CustomPlanetData = {
      id: 'planet_' + Date.now(),
      name: planetName.trim() || 'Custom Planet',
      type: planetType,
      dataUrl,
      radius: 45
    };

    const currentList = getActivePlanetSprites();
    const updatedList = [...currentList, newPlanet];
    saveActivePlanetSprites(updatedList);

    onAddPlanetToWorld(newPlanet);
    if (playUpgradeSound) playUpgradeSound();
  };

  // 🌍 Export Custom Planet Code for GitHub
  const handleExportPlanet = () => {
    const dataUrl = renderGridToDataUrl(planetGrid, 32);
    const jsonStructure = JSON.stringify({
      id: 'planet_' + Date.now(),
      name: planetName.trim() || 'Dětská Planeta',
      type: planetType,
      dataUrl
    }, null, 2);

    const codeSnippet = `// Přidejte tento objekt do pole PLANET_SPRITES v src/data/sprites.ts:\n${jsonStructure}`;

    setExportModalContent({
      title: '🌍 Export Kódu Planety pro GitHub',
      codeText: codeSnippet,
      instructions: 'Tohle je kód naší nové planety! Zkopírujte ho kliknutím na tlačítko a pošlete v chatu AI pro trvalé uložení na GitHub.',
      type: 'planet'
    });
    setCopiedSuccess(false);
  };

  // Copy code snippet to clipboard
  const handleCopyCode = () => {
    if (exportModalContent) {
      navigator.clipboard.writeText(exportModalContent.codeText);
      setCopiedSuccess(true);
      if (playLaserSound) playLaserSound();
      setTimeout(() => setCopiedSuccess(false), 3000);
    }
  };

  // Clear Grid
  const handleClearGrid = (isShip: boolean) => {
    if (isShip) {
      setShipGrid(Array(16).fill(null).map(() => Array(16).fill('transparent')));
    } else {
      setPlanetGrid(Array(32).fill(null).map(() => Array(32).fill('transparent')));
    }
  };

  // Flip Grid Horizontally
  const handleFlipHorizontal = (isShip: boolean) => {
    if (isShip) {
      setShipGrid(prev => prev.map(row => [...row].reverse()));
    } else {
      setPlanetGrid(prev => prev.map(row => [...row].reverse()));
    }
  };

  // Rotate Grid 90 degrees
  const handleRotate90 = (isShip: boolean) => {
    const size = isShip ? 16 : 32;
    const getter = isShip ? shipGrid : planetGrid;
    const newGrid: string[][] = Array(size).fill(null).map(() => Array(size).fill('transparent'));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        newGrid[x][size - 1 - y] = getter[y][x];
      }
    }

    if (isShip) setShipGrid(newGrid);
    else setPlanetGrid(newGrid);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-slate-100">
        
        {/* MODAL HEADER WITH TABS */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-800/60 px-3 py-1 rounded-full text-xs font-black uppercase text-indigo-400">
              <Paintbrush className="w-3.5 h-3.5" />
              Dětská Kreativní Dílna
            </div>
            <h2 className="text-base sm:text-lg font-black text-white hidden sm:block">
              Pixel Art Editor
            </h2>
          </div>

          {/* TAB SELECTOR */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ship');
                if (playLaserSound) playLaserSound();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'ship'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              🛸 Lodě (16x16)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('planet');
                if (playLaserSound) playLaserSound();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'planet'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              🌍 Planety (32x32)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* ==================== TAB 1: SHIP EDITOR 16x16 ==================== */}
          {activeTab === 'ship' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              
              {/* LEFT: CANVAS DRAWING GRID (16x16) */}
              <div className="md:col-span-7 flex flex-col items-center space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between w-full text-xs font-mono text-slate-400">
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <Rocket className="w-4 h-4" /> Plátno Vesmírné Lodě (16 × 16 pixelů)
                  </span>
                  <span className="text-[10px] text-slate-500">Kreslete držením myši</span>
                </div>

                {/* 16x16 GRID CONTAINER */}
                <div 
                  className="grid grid-cols-16 gap-[1px] bg-slate-800/80 p-1 rounded-lg border-2 border-cyan-900/60 shadow-inner cursor-crosshair touch-none"
                  onMouseDown={() => setIsMouseDown(true)}
                >
                  {shipGrid.map((row, y) =>
                    row.map((cellColor, x) => (
                      <div
                        key={`ship_${x}_${y}`}
                        data-x={x}
                        data-y={y}
                        onMouseDown={() => paintCell(x, y, selectedShipColor, true)}
                        onMouseEnter={() => {
                          if (isMouseDown) paintCell(x, y, selectedShipColor, true);
                        }}
                        style={{
                          backgroundColor: cellColor === 'transparent' ? '#0f172a' : cellColor,
                          backgroundImage: cellColor === 'transparent' 
                            ? 'radial-gradient(#1e293b 1px, transparent 1px)' 
                            : 'none',
                          backgroundSize: '4px 4px'
                        }}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-[2px] transition-colors hover:brightness-125 border border-slate-900/40"
                      />
                    ))
                  )}
                </div>

                {/* DRAWING TOOLBAR BUTTONS */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => handleFlipHorizontal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    title="Zrcadlit vodorovně"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Zrcadlit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotate90(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    title="Otočit o 90 stupňů"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Otočit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearGrid(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 transition-all cursor-pointer"
                    title="Vymazat celé plátno"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Smazat vše
                  </button>
                </div>
              </div>

              {/* RIGHT: PALETTE & PREVIEW PANEL */}
              <div className="md:col-span-5 space-y-4">
                
                {/* COLOR PALETTE */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 block font-mono">
                    🎨 PALETA BAREV:
                  </span>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {SHIP_PALETTE.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setSelectedShipColor(item.color);
                          if (playLaserSound) playLaserSound();
                        }}
                        style={{ backgroundColor: item.color === 'transparent' ? '#0f172a' : item.color }}
                        className={`h-9 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer relative ${
                          selectedShipColor === item.color
                            ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)] z-10'
                            : 'border-slate-800 hover:scale-105'
                        }`}
                        title={item.name}
                      >
                        {item.color === 'transparent' && (
                          <Eraser className="w-4 h-4 text-rose-400" />
                        )}
                        {selectedShipColor === item.color && item.color !== 'transparent' && (
                          <span className="w-2 h-2 rounded-full bg-white shadow-md" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono pt-1 flex items-center gap-1.5">
                    <span>Vybraný nástroj:</span>
                    <span 
                      className="px-2 py-0.5 rounded font-bold border border-slate-700"
                      style={{ 
                        backgroundColor: selectedShipColor === 'transparent' ? '#1e293b' : selectedShipColor,
                        color: selectedShipColor === '#f8fafc' || selectedShipColor === '#eab308' ? '#000' : '#fff'
                      }}
                    >
                      {SHIP_PALETTE.find(p => p.color === selectedShipColor)?.name || 'Barva'}
                    </span>
                  </div>
                </div>

                {/* LIVE PREVIEW BOX */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 text-center">
                  <span className="text-xs font-bold text-cyan-400 block font-mono uppercase tracking-wider">
                    ✨ NÁHLED VESMÍRNÉ LODĚ
                  </span>

                  <div className="w-28 h-28 mx-auto bg-slate-900/90 rounded-xl border border-cyan-800/50 flex items-center justify-center relative overflow-hidden shadow-inner group">
                    <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:8px_8px] opacity-40" />
                    <img 
                      src={renderGridToDataUrl(shipGrid, 16)} 
                      alt="Ship Preview" 
                      className="w-16 h-16 object-contain image-rendering-pixelated drop-shadow-[0_0_10px_rgba(56,189,248,0.5)] transform transition-transform group-hover:scale-110" 
                    />
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApplyShip}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Vyzkoušet loď ve hře
                    </button>

                    <button
                      type="button"
                      onClick={handleExportShip}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Exportovat loď pro GitHub
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== TAB 2: PLANET EDITOR 32x32 ==================== */}
          {activeTab === 'planet' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              
              {/* LEFT: CANVAS DRAWING GRID (32x32 WITH CIRCLE OVERLAY) */}
              <div className="md:col-span-7 flex flex-col items-center space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between w-full text-xs font-mono text-slate-400">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Globe className="w-4 h-4" /> Plátno Planety (32 × 32 pixelů)
                  </span>
                  <span className="text-[10px] text-slate-500">Slabý kruh vyznačuje hranici planety</span>
                </div>

                {/* 32x32 GRID CONTAINER WITH CIRCLE OVERLAY MASK */}
                <div 
                  className="relative grid grid-cols-32 gap-[1px] bg-slate-800/80 p-1 rounded-lg border-2 border-emerald-900/60 shadow-inner cursor-crosshair touch-none"
                  onMouseDown={() => setIsMouseDown(true)}
                >
                  {/* FAINT CIRCULAR OVERLAY GUIDELINE FOR KIDS */}
                  <div className="absolute inset-1 rounded-full border-2 border-dashed border-cyan-400/30 pointer-events-none z-10" />

                  {planetGrid.map((row, y) =>
                    row.map((cellColor, x) => (
                      <div
                        key={`planet_${x}_${y}`}
                        data-x={x}
                        data-y={y}
                        onMouseDown={() => paintCell(x, y, selectedPlanetColor, false)}
                        onMouseEnter={() => {
                          if (isMouseDown) paintCell(x, y, selectedPlanetColor, false);
                        }}
                        style={{
                          backgroundColor: cellColor === 'transparent' ? '#0f172a' : cellColor,
                        }}
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[1px] transition-colors hover:brightness-125 border border-slate-900/20"
                      />
                    ))
                  )}
                </div>

                {/* DRAWING TOOLBAR BUTTONS */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => handleFlipHorizontal(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Zrcadlit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotate90(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Otočit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearGrid(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 transition-all cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Smazat vše
                  </button>
                </div>
              </div>

              {/* RIGHT: PLANET SETTINGS, PALETTE & PREVIEW */}
              <div className="md:col-span-5 space-y-4">
                
                {/* PLANET METADATA & TYPE SELECTOR */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block font-mono">
                      🏷️ NÁZEV PLANETY:
                    </label>
                    <input
                      type="text"
                      value={planetName}
                      onChange={(e) => setPlanetName(e.target.value)}
                      placeholder="Zadejte jméno planety..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block font-mono">
                      🪐 VLASTNOSTI PLANETY V HŘE:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPlanetType('normal')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                          planetType === 'normal'
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Běžná (Překážka)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlanetType('ice')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                          planetType === 'ice'
                            ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Snowflake className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>Ledová (Zpomaluje)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlanetType('lava')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                          planetType === 'lava'
                            ? 'bg-orange-950/60 border-orange-500 text-orange-300 font-bold'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Lávová (Poškozuje)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlanetType('gold')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                          planetType === 'gold'
                            ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Gem className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Zlatá (Bonusy)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* PLANET COLOR PALETTE */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-2">
                  <span className="text-xs font-bold text-slate-300 block font-mono">
                    🎨 PALETA BAREV PLANET:
                  </span>
                  
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
                    {PLANET_PALETTE.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setSelectedPlanetColor(item.color);
                          if (playLaserSound) playLaserSound();
                        }}
                        style={{ backgroundColor: item.color === 'transparent' ? '#0f172a' : item.color }}
                        className={`h-8 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                          selectedPlanetColor === item.color
                            ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)] z-10'
                            : 'border-slate-800 hover:scale-105'
                        }`}
                        title={item.name}
                      >
                        {item.color === 'transparent' && (
                          <Eraser className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LIVE PLANET PREVIEW */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 text-center">
                  <span className="text-xs font-bold text-emerald-400 block font-mono uppercase tracking-wider">
                    ✨ NÁHLED NAKRESLENÉ PLANETY
                  </span>

                  <div className="w-28 h-28 mx-auto bg-slate-900/90 rounded-full border-2 border-emerald-800/50 flex items-center justify-center relative overflow-hidden shadow-inner group">
                    <img 
                      src={renderGridToDataUrl(planetGrid, 32)} 
                      alt="Planet Preview" 
                      className="w-24 h-24 object-contain image-rendering-pixelated drop-shadow-[0_0_12px_rgba(16,185,129,0.4)] transform transition-transform group-hover:scale-110" 
                    />
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddPlanet}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Globe className="w-4 h-4" />
                      Vytvořit planetu v herním vesmíru
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPlanet}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Exportovat planetu pro GitHub
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* ==================== EXPORT CODE MODAL OVERLAY ==================== */}
      {exportModalContent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-2 font-mono">
                <Sparkles className="w-4 h-4" />
                {exportModalContent.title}
              </h3>
              <button
                type="button"
                onClick={() => setExportModalContent(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {exportModalContent.instructions}
            </p>

            <div className="relative">
              <textarea
                readOnly
                rows={6}
                value={exportModalContent.codeText}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-300 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyCode}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  copiedSuccess
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                }`}
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Kód zkopírován do schránky!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Kopírovat kód
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setExportModalContent(null)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
