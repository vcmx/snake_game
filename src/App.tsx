/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pause, Settings, X, Ghost } from 'lucide-react';

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const BASE_SPEED = 150;
const SPEED_INCREMENT = 2;
const MIN_SPEED = 60;

type Point = { x: number; y: number };
type GameStatus = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export default function App() {
  // --- State ---
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [nextDirection, setNextDirection] = useState<Point>(INITIAL_DIRECTION);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<GameStatus>('START');
  const [speed, setSpeed] = useState(BASE_SPEED);
  const [showSettings, setShowSettings] = useState(false);
  const [particles, setParticles] = useState<{x: number, y: number, color: string, vx: number, vy: number, life: number}[]>([]);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // --- Audio placeholders (vibration for feel) ---
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // --- Load High Score ---
  useEffect(() => {
    const saved = localStorage.getItem('snake-high-score');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Helper: Random Point ---
  const getRandomPoint = useCallback((currentSnake: Point[]): Point => {
    let newPoint: Point;
    while (true) {
      newPoint = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check if point is on snake
      const isOnSnake = currentSnake.some(segment => segment.x === newPoint.x && segment.y === newPoint.y);
      if (!isOnSnake) break;
    }
    return newPoint;
  }, []);

  // --- Particles Effect ---
  const createExplosion = (x: number, y: number, color: string) => {
    const newParticles = Array.from({ length: 10 }).map(() => ({
      x, y, color,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0
    }));
    setParticles(prev => [...prev, ...newParticles].slice(-50));
  };

  // --- Game Controls ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        if (direction.y === 0) setNextDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
        if (direction.y === 0) setNextDirection({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
        if (direction.x === 0) setNextDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
        if (direction.x === 0) setNextDirection({ x: 1, y: 0 });
        break;
      case ' ':
        if (status === 'PLAYING') setStatus('PAUSED');
        else if (status === 'PAUSED') setStatus('PLAYING');
        else if (status === 'START' || status === 'GAMEOVER') startGame();
        break;
    }
  }, [direction, status]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setNextDirection(INITIAL_DIRECTION);
    setScore(0);
    setSpeed(BASE_SPEED);
    setFood(getRandomPoint(INITIAL_SNAKE));
    setStatus('PLAYING');
    lastUpdateTimeRef.current = performance.now();
  };

  // --- Game Logic ---
  const moveSnake = useCallback(() => {
    const head = snake[0];
    const newHead = {
      x: head.x + nextDirection.x,
      y: head.y + nextDirection.y,
    };

    setDirection(nextDirection);

    // Collision: Walls
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      handleGameOver();
      return;
    }

    // Collision: Self
    if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      handleGameOver();
      return;
    }

    const newSnake = [newHead, ...snake];

    // Collision: Food
    if (newHead.x === food.x && newHead.y === food.y) {
      setScore(prev => {
        const next = prev + 10;
        if (next > highScore) {
          setHighScore(next);
          localStorage.setItem('snake-high-score', next.toString());
        }
        return next;
      });
      setFood(getRandomPoint(newSnake));
      setSpeed(prev => Math.max(MIN_SPEED, prev - SPEED_INCREMENT));
      createExplosion(food.x, food.y, '#22c55e');
      vibrate(50);
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  }, [snake, food, nextDirection, highScore, getRandomPoint]);

  const handleGameOver = () => {
    setStatus('GAMEOVER');
    vibrate([100, 50, 100]);
    createExplosion(snake[0].x, snake[0].y, '#ef4444');
  };

  // --- Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      if (status === 'PLAYING') {
        const delta = time - lastUpdateTimeRef.current;
        if (delta > speed) {
          moveSnake();
          lastUpdateTimeRef.current = time;
        }
      }

      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid (Subtle - Styled from theme)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const cellSize = canvas.width / GRID_SIZE;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }

      // Draw Food (Rose/Red from theme)
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f43f5e';
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(
        food.x * cellSize + cellSize / 2,
        food.y * cellSize + cellSize / 2,
        cellSize / 3,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Draw Snake (Cyan from theme)
      ctx.shadowBlur = 10;
      snake.forEach((segment, i) => {
        ctx.shadowColor = i === 0 ? '#22d3ee' : '#0891b2';
        ctx.fillStyle = i === 0 ? '#22d3ee' : '#0891b2';
        
        const r = cellSize / 4;
        const x = segment.x * cellSize + 2;
        const y = segment.y * cellSize + 2;
        const w = cellSize - 4;
        const h = cellSize - 4;
        
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, i === 0 ? r * 2 : r);
        ctx.fill();

        if (i === 0) {
          ctx.fillStyle = '#fff';
          const eyeSize = cellSize / 10;
          let eyeX1, eyeY1, eyeX2, eyeY2;
          if (direction.x === 1) {
            eyeX1 = x + w * 0.7; eyeY1 = y + h * 0.2;
            eyeX2 = x + w * 0.7; eyeY2 = y + h * 0.8;
          } else if (direction.x === -1) {
            eyeX1 = x + w * 0.3; eyeY1 = y + h * 0.2;
            eyeX2 = x + w * 0.3; eyeY2 = y + h * 0.8;
          } else if (direction.y === 1) {
            eyeX1 = x + w * 0.2; eyeY1 = y + h * 0.7;
            eyeX2 = x + w * 0.8; eyeY2 = y + h * 0.7;
          } else {
            eyeX1 = x + w * 0.2; eyeY1 = y + h * 0.3;
            eyeX2 = x + w * 0.8; eyeY2 = y + h * 0.3;
          }
          ctx.beginPath();
          ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
          ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.shadowBlur = 0;

      // Draw Particles
      setParticles(prev => {
        const next: typeof prev = [];
        prev.forEach(p => {
          if (p.life > 0) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x * cellSize, p.y * cellSize, cellSize / 8, 0, Math.PI * 2);
            ctx.fill();
            next.push({
              ...p,
              x: p.x + p.vx * 0.01,
              y: p.y + p.vy * 0.01,
              life: p.life - 0.02
            });
          }
        });
        ctx.globalAlpha = 1.0;
        return next;
      });

      gameLoopRef.current = requestAnimationFrame(render);
    };

    gameLoopRef.current = requestAnimationFrame(render);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [status, snake, food, direction, speed, moveSnake]);

  // --- UI Components ---
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-between font-sans p-6 md:p-10 select-none touch-none border-8 border-slate-900 overflow-hidden">
      
      {/* Header */}
      <div className="w-full max-w-[1024px] flex justify-between items-center px-4 mb-6">
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 italic">
            NEON SNAKE v1.0
          </h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold">
            High-Performance Tactical Simulation
          </p>
        </div>
        
        <div className="flex gap-4 md:gap-8">
          <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl px-4 md:px-6 py-2 md:py-3 flex flex-col items-center min-w-[100px] md:min-w-[140px]">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Current Score</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-cyan-400">{score.toString().padStart(4, '0')}</span>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl px-4 md:px-6 py-2 md:py-3 flex flex-col items-center min-w-[100px] md:min-w-[140px]">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Personal Best</span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">{highScore.toString().padStart(4, '0')}</span>
          </div>
        </div>
      </div>

      {/* Main Game Area Section */}
      <div className="relative flex-1 w-full max-w-[1024px] flex flex-col lg:flex-row items-center justify-center gap-10">
        
        {/* Sidebar (Desktop) */}
        <div className="hidden lg:flex flex-col gap-4 w-64">
          <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl border-l-4 border-l-cyan-500">
            <h3 className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4">Controls</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: '↑', l: 'Up' }, { k: '↓', l: 'Down' },
                { k: '←', l: 'Left' }, { k: '→', l: 'Right' }
              ].map(ctrl => (
                <div key={ctrl.l} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-slate-700 bg-slate-800 flex items-center justify-center font-mono text-xs">{ctrl.k}</div>
                  <span className="text-xs text-slate-400">{ctrl.l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Status</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500">Processing Speed</span>
              <span className="text-xs font-mono text-cyan-400">{speed}ms</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-cyan-500" 
                animate={{ width: `${(1 - (speed - MIN_SPEED) / (BASE_SPEED - MIN_SPEED)) * 100}%` }}
              />
            </div>
          </div>

          <button 
            onClick={status === 'PLAYING' ? () => setStatus('PAUSED') : startGame}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {status === 'PLAYING' ? 'Suspend Process' : 'Initialize Game'}
          </button>
        </div>

        {/* Canvas Area */}
        <div className="relative p-1 bg-slate-800 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.2)]">
          <canvas
            ref={canvasRef}
            width={500}
            height={500}
            className="rounded bg-slate-900 block w-full max-w-[500px] aspect-square"
            id="game-canvas"
          />

          {/* Overlays */}
          <AnimatePresence>
            {status === 'START' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mb-4 inline-block px-4 py-1 border border-cyan-500/50 rounded-full text-cyan-400 text-[10px] font-mono tracking-widest"
                  >
                    SCANNING FOR INPUT...
                  </motion.div>
                  <h2 className="text-4xl font-black mb-6 italic tracking-tighter">WAITING FOR AUTH</h2>
                  <button 
                    onClick={startGame}
                    className="px-8 py-3 border-2 border-cyan-500 text-cyan-500 font-bold rounded-full hover:bg-cyan-500 hover:text-white transition-all uppercase tracking-widest text-sm"
                  >
                    Begin Simulation
                  </button>
                </div>
              </motion.div>
            )}

            {status === 'PAUSED' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-md rounded"
              >
                <h2 className="text-4xl font-black mb-8 italic text-cyan-400">PAUSED</h2>
                <button 
                  onClick={() => setStatus('PLAYING')}
                  className="px-10 py-4 border-2 border-white text-white rounded-full transition-all hover:bg-white hover:text-black font-bold uppercase tracking-widest text-sm"
                >
                  Resume Link
                </button>
              </motion.div>
            )}

            {status === 'GAMEOVER' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl rounded"
              >
                <div className="text-center">
                  <h2 className="text-5xl font-black mb-2 italic text-rose-500 tracking-tighter">CORE BREACHED</h2>
                  <p className="text-slate-400 text-xs mb-8 uppercase tracking-[0.3em] font-bold">System Collision Detected</p>
                  <button 
                    onClick={startGame}
                    className="px-10 py-4 border-2 border-cyan-500 text-cyan-500 font-bold rounded-full hover:bg-cyan-500 hover:text-white transition-all uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                  >
                    Reboot System
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 flex lg:hidden items-center justify-center gap-4">
         <div className="grid grid-cols-3 gap-2">
            <div />
            <ControlButton onClick={() => direction.y === 0 && setNextDirection({ x: 0, y: -1 })}>
              <ChevronUp className="w-8 h-8" />
            </ControlButton>
            <div />
            <ControlButton onClick={() => direction.x === 0 && setNextDirection({ x: -1, y: 0 })}>
              <ChevronLeft className="w-8 h-8" />
            </ControlButton>
            <ControlButton onClick={() => status === 'PLAYING' ? setStatus('PAUSED') : setStatus('PLAYING')}>
              {status === 'PAUSED' ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </ControlButton>
            <ControlButton onClick={() => direction.x === 0 && setNextDirection({ x: 1, y: 0 })}>
              <ChevronRight className="w-8 h-8" />
            </ControlButton>
            <div />
            <ControlButton onClick={() => direction.y === 0 && setNextDirection({ x: 0, y: 1 })}>
              <ChevronDown className="w-8 h-8" />
            </ControlButton>
            <div />
         </div>
      </div>

      {/* Footer (Styled from theme) */}
      <div className="w-full pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-slate-500 font-mono italic text-[10px] gap-2">
        <span>SYSTEM STATUS: {status === 'PLAYING' ? 'OPERATIONAL' : 'STANDBY'}</span>
        <span>LOGGED IN AS USER_ALPHA_01</span>
        <span>ENCRYPTION: AES-256-GCM</span>
      </div>
    </div>
  );
}

function ControlButton({ children, onClick }: { children: ReactNode, onClick: () => void }) {
  return (
    <button 
      className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center active:bg-blue-600 active:scale-95 transition-all text-slate-400 active:text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

