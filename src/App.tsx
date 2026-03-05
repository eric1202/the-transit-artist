import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Line as KonvaLine, Circle, Text, Group } from 'react-konva';
import { 
  Map, 
  Plus, 
  Minus, 
  Grid, 
  Settings, 
  MousePointer2, 
  Circle as StationIcon, 
  GitBranch, 
  Eraser, 
  Download, 
  Undo2, 
  Redo2,
  X,
  ChevronRight,
  Palette,
  Trash2,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Station, Line, MetroSystem, Tool, Point } from './types';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

const METRO_COLORS = [
  '#0095FF', // Cerulean
  '#EE352E', // Crimson
  '#FFC600', // Amber
  '#009B5D', // Emerald
  '#9B5DE5', // Violet
  '#636e72', // Slate
  '#FF793F', // Orange
  '#33D9B2', // Teal
];

const GRID_SIZE = 40;

export default function App() {
  // --- State ---
  const [system, setSystem] = useState<MetroSystem>({
    name: "Untitled Metro System",
    stations: [],
    lines: []
  });
  const [tool, setTool] = useState<Tool>('station');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [history, setHistory] = useState<MetroSystem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- History Management ---
  const pushToHistory = (newSystem: MetroSystem) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSystem);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSystem(prev);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSystem(next);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([system]);
      setHistoryIndex(0);
    }
  }, []);

  // --- Helpers ---
  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    // Convert screen coordinates to canvas coordinates
    const x = (pointerPosition.x - position.x) / scale;
    const y = (pointerPosition.y - position.y) / scale;

    if (tool === 'station') {
      const snappedX = snapToGrid(x);
      const snappedY = snapToGrid(y);
      
      // Check if station already exists at this location
      const existing = system.stations.find(s => s.x === snappedX && s.y === snappedY);
      if (existing) return;

      const newStation: Station = {
        id: `st-${Date.now()}`,
        name: `Station ${system.stations.length + 1}`,
        x: snappedX,
        y: snappedY,
        isTransfer: false
      };

      const newSystem = {
        ...system,
        stations: [...system.stations, newStation]
      };
      setSystem(newSystem);
      pushToHistory(newSystem);
    }
  };

  const handleStationClick = (stationId: string) => {
    if (tool === 'line') {
      if (!activeLineId) {
        // Start a new line
        const newLineId = `ln-${Date.now()}`;
        const newLine: Line = {
          id: newLineId,
          name: `Line ${system.lines.length + 1}`,
          color: METRO_COLORS[system.lines.length % METRO_COLORS.length],
          stationIds: [stationId],
          number: (system.lines.length + 1).toString(),
          isVisible: true
        };
        const newSystem = {
          ...system,
          lines: [...system.lines, newLine]
        };
        setSystem(newSystem);
        setActiveLineId(newLineId);
        pushToHistory(newSystem);
      } else {
        // Add to existing active line
        const activeLine = system.lines.find(l => l.id === activeLineId);
        if (!activeLine) return;

        // Don't add same station twice in a row
        if (activeLine.stationIds[activeLine.stationIds.length - 1] === stationId) return;

        const updatedLines = system.lines.map(l => {
          if (l.id === activeLineId) {
            return { ...l, stationIds: [...l.stationIds, stationId] };
          }
          return l;
        });

        const newSystem = { ...system, lines: updatedLines };
        setSystem(newSystem);
        pushToHistory(newSystem);
      }
    } else if (tool === 'select') {
      setSelectedStationId(stationId);
    } else if (tool === 'eraser') {
      const newStations = system.stations.filter(s => s.id !== stationId);
      const newLines = system.lines.map(l => ({
        ...l,
        stationIds: l.stationIds.filter(id => id !== stationId)
      })).filter(l => l.stationIds.length > 0);

      const newSystem = { ...system, stations: newStations, lines: newLines };
      setSystem(newSystem);
      pushToHistory(newSystem);
    }
  };

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);

  const handleExport = () => {
    const data = JSON.stringify(system, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, `${system.name.replace(/\s+/g, '_')}.json`);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleExportImage = () => {
    const uri = stageRef.current.toDataURL();
    saveAs(uri, `${system.name.replace(/\s+/g, '_')}.png`);
  };

  const clearSystem = () => {
    if (confirm("Are you sure you want to clear the entire system?")) {
      const newSystem = { name: "Untitled Metro System", stations: [], lines: [] };
      setSystem(newSystem);
      pushToHistory(newSystem);
    }
  };

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(prev + delta, 0.2), 3));
  };

  // --- Render Helpers ---
  const linePaths = useMemo(() => {
    return system.lines.filter(l => l.isVisible).map(line => {
      const points: number[] = [];
      line.stationIds.forEach(sid => {
        const station = system.stations.find(s => s.id === sid);
        if (station) {
          points.push(station.x, station.y);
        }
      });
      return { ...line, points };
    });
  }, [system]);

  return (
    <div className="w-screen h-screen flex flex-col bg-paper relative" ref={containerRef}>
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-50 p-6 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto bg-white border-3 border-ink rounded-xl shadow-hard px-6 py-3 flex flex-col gap-1 min-w-[280px]">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-ink" />
            <input 
              className="bg-transparent border-b-2 border-dashed border-ink/30 focus:border-ink outline-none text-xl font-bold text-ink w-full p-0 font-display tracking-tight placeholder-ink/50"
              value={system.name}
              onChange={(e) => setSystem({ ...system, name: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pl-7">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] text-ink/60 uppercase tracking-wider">All changes saved locally</span>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-3">
          <div className="bg-white border-3 border-ink rounded-full shadow-hard h-12 flex items-center px-1">
            <button 
              onClick={() => handleZoom(-0.1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="w-[2px] h-6 bg-grid mx-1" />
            <span className="font-mono text-sm font-medium w-12 text-center select-none">
              {Math.round(scale * 100)}%
            </span>
            <div className="w-[2px] h-6 bg-grid mx-1" />
            <button 
              onClick={() => handleZoom(0.1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={clearSystem}
            className="btn-hard bg-white border-3 border-ink rounded-full shadow-hard w-12 h-12 flex items-center justify-center hover:bg-red-50 text-red-500 transition-transform"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setIsLedgerOpen(true)}
            className="btn-hard bg-white border-3 border-ink rounded-full shadow-hard w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-transform"
          >
            <Grid className="w-5 h-5" />
          </button>
          
          <button className="btn-hard bg-white border-3 border-ink rounded-full shadow-hard w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-transform">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Canvas */}
      <main className="flex-grow w-full h-full relative overflow-hidden bg-grid-pattern">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight}
          ref={stageRef}
          onClick={handleStageClick}
          draggable={tool === 'select'}
          onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
        >
          <Layer>
            {/* Lines */}
            {linePaths.map((line) => (
              <KonvaLine
                key={line.id}
                points={line.points}
                stroke={line.color}
                strokeWidth={12}
                lineCap="round"
                lineJoin="round"
                tension={0.2}
                opacity={activeLineId && activeLineId !== line.id ? 0.3 : 1}
                onClick={() => setSelectedLineId(line.id)}
              />
            ))}

            {/* Stations */}
            {system.stations.map((station) => {
              const linesAtStation = system.lines.filter(l => l.stationIds.includes(station.id));
              const isTransfer = linesAtStation.length > 1;
              
              return (
                <Group 
                  key={station.id} 
                  x={station.x} 
                  y={station.y}
                  onClick={() => handleStationClick(station.id)}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage().container();
                    container.style.cursor = 'pointer';
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage().container();
                    container.style.cursor = tool === 'station' ? 'crosshair' : 'default';
                  }}
                >
                  {isTransfer ? (
                    <KonvaLine
                      points={[-15, 0, 15, 0]}
                      stroke="white"
                      strokeWidth={16}
                      lineCap="round"
                      shadowBlur={2}
                    />
                  ) : null}
                  <Circle
                    radius={isTransfer ? 8 : 6}
                    fill="white"
                    stroke="#1A1A1A"
                    strokeWidth={3}
                  />
                  <Text
                    text={station.name.toUpperCase()}
                    y={20}
                    align="center"
                    width={200}
                    offsetX={100}
                    fontFamily="Space Grotesk"
                    fontSize={10}
                    fontStyle="bold"
                    fill="#1A1A1A"
                    letterSpacing={1}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </main>

      {/* Toolbar */}
      <div className="absolute bottom-8 left-0 w-full flex justify-center pointer-events-none z-50">
        <div className="pointer-events-auto bg-white border-3 border-ink rounded-full shadow-hard h-16 px-4 flex items-center gap-2">
          <ToolButton 
            active={tool === 'select'} 
            onClick={() => setTool('select')} 
            icon={<MousePointer2 className="w-5 h-5" />} 
            label="Select (V)" 
          />
          <div className="w-[2px] h-8 bg-grid/80 mx-1" />
          <ToolButton 
            active={tool === 'station'} 
            onClick={() => setTool('station')} 
            icon={<StationIcon className="w-5 h-5" />} 
            label="Station (S)" 
          />
          <ToolButton 
            active={tool === 'line'} 
            onClick={() => {
              setTool('line');
              if (activeLineId) setActiveLineId(null);
            }} 
            icon={<GitBranch className="w-5 h-5" />} 
            label="Connect (C)" 
            isHighlighted={!!activeLineId}
          />
          <div className="w-[2px] h-8 bg-grid/80 mx-1" />
          <ToolButton 
            active={tool === 'eraser'} 
            onClick={() => setTool('eraser')} 
            icon={<Eraser className="w-5 h-5" />} 
            label="Eraser (E)" 
            danger
          />
        </div>
      </div>

      {/* Side Actions */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-50">
        <div className="bg-white border-3 border-ink rounded-2xl shadow-hard p-2 flex flex-col gap-2">
          <button 
            onClick={undo}
            disabled={historyIndex <= 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={handleExportImage}
          className="btn-hard bg-white text-ink border-3 border-ink rounded-2xl shadow-hard w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-transform"
          title="Export PNG"
        >
          <Palette className="w-5 h-5" />
        </button>

        <button 
          onClick={handleExport}
          className="btn-hard bg-ink text-white border-3 border-ink rounded-2xl shadow-hard w-12 h-12 flex items-center justify-center hover:bg-ink/90 transition-transform"
          title="Export JSON"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Ledger Sidebar (Lines Management) */}
      <AnimatePresence>
        {isLedgerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLedgerOpen(false)}
              className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l-3 border-ink z-[101] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-center justify-between p-8 border-b-3 border-ink shrink-0">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold tracking-tight">System Ledger</h1>
                  <p className="text-slate-500 text-sm font-medium font-mono uppercase tracking-wider">Manage lines & hierarchy</p>
                </div>
                <button 
                  onClick={() => setIsLedgerOpen(false)}
                  className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-paper transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {system.lines.map((line) => (
                  <div 
                    key={line.id}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 bg-white rounded-xl border-3 transition-all duration-200",
                      activeLineId === line.id ? "border-ink shadow-hard" : "border-grid hover:border-ink/50"
                    )}
                  >
                    <div className="flex items-center justify-center text-slate-400 p-1">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    
                    <div className="relative shrink-0">
                      <button 
                        className="w-10 h-10 rounded-full border-3 border-ink shadow-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: line.color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <input 
                        className="w-full bg-transparent border-none p-0 text-lg font-bold text-ink focus:ring-0 truncate"
                        value={line.name}
                        onChange={(e) => {
                          const updated = system.lines.map(l => l.id === line.id ? { ...l, name: e.target.value } : l);
                          setSystem({ ...system, lines: updated });
                        }}
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">ID: {line.number}</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{line.stationIds.length} Stations</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          const updated = system.lines.map(l => l.id === line.id ? { ...l, isVisible: !l.isVisible } : l);
                          setSystem({ ...system, lines: updated });
                        }}
                        className="p-2 text-ink hover:bg-slate-100 rounded-full transition-colors"
                      >
                        {line.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => {
                          const updated = system.lines.filter(l => l.id !== line.id);
                          setSystem({ ...system, lines: updated });
                          if (activeLineId === line.id) setActiveLineId(null);
                        }}
                        className="p-2 text-ink hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setActiveLineId(line.id === activeLineId ? null : line.id)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          activeLineId === line.id ? "bg-ink text-white" : "text-ink hover:bg-slate-100"
                        )}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {system.lines.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4 border-3 border-dashed border-grid rounded-2xl">
                    <GitBranch className="w-12 h-12 opacity-20" />
                    <p className="font-mono text-xs uppercase tracking-widest">No lines created yet</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t-3 border-ink bg-white shrink-0 pb-10">
                <button 
                  onClick={() => {
                    const newLineId = `ln-${Date.now()}`;
                    const newLine: Line = {
                      id: newLineId,
                      name: `Line ${system.lines.length + 1}`,
                      color: METRO_COLORS[system.lines.length % METRO_COLORS.length],
                      stationIds: [],
                      number: (system.lines.length + 1).toString(),
                      isVisible: true
                    };
                    setSystem({ ...system, lines: [...system.lines, newLine] });
                    setActiveLineId(newLineId);
                    setTool('line');
                    setIsLedgerOpen(false);
                  }}
                  className="w-full group relative flex items-center justify-center gap-3 h-14 rounded-full border-3 border-dashed border-ink hover:border-solid hover:bg-ink hover:text-white transition-all duration-300"
                >
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                  <span className="text-lg font-bold tracking-wide">Add New Line</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Onboarding Modal */}
      <AnimatePresence>
        {isOnboardingOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOnboardingOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white border-3 border-ink rounded-3xl shadow-hard p-10 max-w-2xl w-full"
            >
              <button 
                onClick={() => setIsOnboardingOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">Onboarding</span>
              </div>

              <h2 className="text-5xl font-bold tracking-tight mb-4">The Transit Artist</h2>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                Turn chaos into connectivity. Master the tools to build your network in a digital Vignelli style.
              </p>

              <div className="grid grid-cols-3 gap-6 mb-12">
                <OnboardingCard 
                  icon={<StationIcon className="w-6 h-6" />}
                  title="Plot"
                  desc="Click anywhere on the grid to stamp a new station node."
                />
                <OnboardingCard 
                  icon={<GitBranch className="w-6 h-6" />}
                  title="Link"
                  desc="Select two stations to forge a route. Watch lines snap."
                />
                <OnboardingCard 
                  icon={<MousePointer2 className="w-6 h-6" />}
                  title="Edit"
                  desc="Use the Ledger to manage colors, names, and visibility."
                />
              </div>

              <button 
                onClick={() => setIsOnboardingOpen(false)}
                className="w-full h-16 bg-blue-500 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 hover:bg-blue-600 transition-colors shadow-hard-sm"
              >
                Start Mapping <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OnboardingCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 border-3 border-grid rounded-2xl flex flex-col gap-4">
      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-ink border-2 border-grid">
        {icon}
      </div>
      <h3 className="text-lg font-bold uppercase tracking-wide">{title}</h3>
      <p className="text-sm text-slate-500 leading-snug">{desc}</p>
    </div>
  );
}

function ToolButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  danger,
  isHighlighted 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  danger?: boolean;
  isHighlighted?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "btn-hard w-12 h-12 rounded-full flex items-center justify-center transition-all group relative",
        active 
          ? "bg-ink text-white shadow-none translate-x-[2px] translate-y-[2px]" 
          : "bg-white hover:bg-gray-100",
        danger && !active && "hover:bg-red-50 hover:text-red-600",
        isHighlighted && !active && "ring-2 ring-ink ring-offset-2"
      )}
    >
      <div className="group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-mono pointer-events-none uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
