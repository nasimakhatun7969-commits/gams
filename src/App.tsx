/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Github } from 'lucide-react';

// Constants
const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 2;
const MIN_SPEED = 60;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const getRandomPoint = (exclude: Point[] = []): Point => {
  let point: Point;
  do {
    point = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (exclude.some(p => p.x === point.x && p.y === point.y));
  return point;
};

export default function App() {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('UP');
  const [nextDirection, setNextDirection] = useState<Direction>('UP');
  const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isAiMode, setIsAiMode] = useState(true);
  const lastInputTime = useRef<number>(0);

  const gameLoopRef = useRef<number | null>(null);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('snake-high-score');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Update high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  }, [score, highScore]);

  // AI Logic: BFS to find the shortest safe path to food
  const getAiDirection = useCallback((currentSnake: Point[], currentFood: Point, currentDir: Direction): Direction => {
    const head = currentSnake[0];
    const queue: { pos: Point; path: Direction[] }[] = [
      { pos: head, path: [] }
    ];
    const visited = new Set<string>();
    visited.add(`${head.x},${head.y}`);

    const directions: { dir: Direction; dx: number; dy: number }[] = [
      { dir: 'UP', dx: 0, dy: -1 },
      { dir: 'DOWN', dx: 0, dy: 1 },
      { dir: 'LEFT', dx: -1, dy: 0 },
      { dir: 'RIGHT', dx: 1, dy: 0 },
    ];

    // BFS Search
    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;

      if (pos.x === currentFood.x && pos.y === currentFood.y) {
        return path[0]; // Return the first move of the shortest path
      }

      for (const { dir, dx, dy } of directions) {
        const nextPos = { x: pos.x + dx, y: pos.y + dy };
        const key = `${nextPos.x},${nextPos.y}`;

        const isOutOfBounds = nextPos.x < 0 || nextPos.x >= GRID_SIZE || nextPos.y < 0 || nextPos.y >= GRID_SIZE;
        const isSelfCollision = currentSnake.some(p => p.x === nextPos.x && p.y === nextPos.y);
        
        // Basic check for opposite direction only on the first move
        const isOpposite = path.length === 0 && (
          (dir === 'UP' && currentDir === 'DOWN') ||
          (dir === 'DOWN' && currentDir === 'UP') ||
          (dir === 'LEFT' && currentDir === 'RIGHT') ||
          (dir === 'RIGHT' && currentDir === 'LEFT')
        );

        if (!isOutOfBounds && !isSelfCollision && !isOpposite && !visited.has(key)) {
          visited.add(key);
          queue.push({ pos: nextPos, path: [...path, dir] });
        }
      }
    }

    // If no path to food, just try to survive (stay away from walls/body)
    const survivors = directions.filter(({ dir, dx, dy }) => {
      const nextPos = { x: head.x + dx, y: head.y + dy };
      const isOutOfBounds = nextPos.x < 0 || nextPos.x >= GRID_SIZE || nextPos.y < 0 || nextPos.y >= GRID_SIZE;
      const isSelfCollision = currentSnake.some(p => p.x === nextPos.x && p.y === nextPos.y);
      const isOpposite = (dir === 'UP' && currentDir === 'DOWN') ||
                        (dir === 'DOWN' && currentDir === 'UP') ||
                        (dir === 'LEFT' && currentDir === 'RIGHT') ||
                        (dir === 'RIGHT' && currentDir === 'LEFT');
      return !isOutOfBounds && !isSelfCollision && !isOpposite;
    });

    return survivors.length > 0 ? survivors[0].dir : currentDir;
  }, []);

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = { ...head };
      
      const currentTime = Date.now();
      // Manual control window: 1.2 seconds after any keypress
      const isUserControlled = currentTime - lastInputTime.current < 1200;

      let moveDir = nextDirection;
      
      // Use AI if enabled and user isn't overriding (or if user hasn't pressed keys lately)
      if (isAiMode && !isUserControlled) {
        moveDir = getAiDirection(prevSnake, food, direction);
        setNextDirection(moveDir);
      }
      
      setDirection(moveDir);

      switch (moveDir) {
        case 'UP': newHead.y -= 1; break;
        case 'DOWN': newHead.y += 1; break;
        case 'LEFT': newHead.x -= 1; break;
        case 'RIGHT': newHead.x += 1; break;
      }

      // Check wall collision
      if (
        newHead.x < 0 || 
        newHead.x >= GRID_SIZE || 
        newHead.y < 0 || 
        newHead.y >= GRID_SIZE
      ) {
        setStatus('GAME_OVER');
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(p => p.x === newHead.x && p.y === newHead.y)) {
        setStatus('GAME_OVER');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food consumption
      const ateFood = newHead.x === food.x && newHead.y === food.y;
      
      // Grow ONLY if food is eaten
      const shouldGrow = ateFood;

      if (ateFood) {
        setScore(s => s + 10);
        setFood(getRandomPoint(newSnake));
        setSpeed(prev => Math.max(MIN_SPEED, prev - SPEED_INCREMENT));
      }

      if (!shouldGrow) {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, nextDirection, isAiMode, getAiDirection, direction]);

  useEffect(() => {
    if (status === 'PLAYING') {
      gameLoopRef.current = window.setInterval(moveSnake, speed);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [status, moveSnake, speed]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      lastInputTime.current = Date.now();
    }
    switch (e.key) {
      case 'ArrowUp': if (direction !== 'DOWN') setNextDirection('UP'); break;
      case 'ArrowDown': if (direction !== 'UP') setNextDirection('DOWN'); break;
      case 'ArrowLeft': if (direction !== 'RIGHT') setNextDirection('LEFT'); break;
      case 'ArrowRight': if (direction !== 'LEFT') setNextDirection('RIGHT'); break;
    }
  }, [direction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
    setFood(getRandomPoint());
    setDirection('UP');
    setNextDirection('UP');
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setStatus('PLAYING');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans select-none overflow-hidden">
      {/* Header / Scoreboard */}
      <div className="w-full max-w-[400px] flex justify-between items-end mb-6">
        <div>
          <h1 className="font-retro text-xl md:text-2xl text-yellow-400 mb-1 tracking-tighter shadow-yellow-500/20 drop-shadow-md">
            RETRO SNAKE
          </h1>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-retro">
              <Trophy size={12} className="text-yellow-500" />
              <span>BEST: {highScore}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex flex-col items-end gap-2 mb-2">
            <button 
              onClick={() => setIsAiMode(!isAiMode)}
              className={`text-[8px] font-retro px-2 py-1 rounded transition-colors ${
                isAiMode ? 'bg-blue-500 text-white shadow-[0_2px_0_rgb(37,99,235)]' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              AI AUTO: {isAiMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="text-zinc-500 text-[10px] font-retro mb-1">SCORE</div>
          <motion.div 
            key={score}
            initial={{ scale: 1.2, color: '#4ade80' }}
            animate={{ scale: 1, color: '#f8fafc' }}
            className="text-2xl font-retro"
          >
            {score}
          </motion.div>
        </div>
      </div>

      {/* Game Board Container */}
      <div className="relative p-2 bg-zinc-800 rounded-lg shadow-2xl border-4 border-zinc-700">
        <div className="game-grid w-[320px] h-[320px] md:w-[400px] md:h-[400px] bg-zinc-900 overflow-hidden relative">
          
          {/* Background Grid Lines */}
          <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 opacity-5 pointer-events-none">
            {Array.from({ length: 400 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-zinc-400" />
            ))}
          </div>

          {/* Food */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 180, 270, 360]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2,
              ease: "linear"
            }}
            className="food-item absolute w-[5%] h-[5%] bg-red-500 rounded-sm z-10"
            style={{ 
              left: `${food.x * 5}%`, 
              top: `${food.y * 5}%` 
            }}
          />

          {/* Snake */}
          {snake.map((segment, i) => (
            <motion.div
              key={`${i}-${segment.x}-${segment.y}`}
              layout
              initial={false}
              className={`snake-segment absolute w-[5%] h-[5%] z-20 ${
                i === 0 ? 'bg-yellow-400 rounded-sm' : 'bg-yellow-600/80 rounded-sm'
              }`}
              style={{ 
                left: `${segment.x * 5}%`, 
                top: `${segment.y * 5}%`,
                opacity: 1 - (i / (snake.length + 5))
              }}
            />
          ))}

          {/* Overlays */}
          <AnimatePresence>
            {status !== 'PLAYING' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center p-6 backdrop-blur-sm"
              >
                {status === 'IDLE' && (
                  <div className="text-center">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Play className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-zinc-300 font-retro text-xs mb-8 leading-relaxed">
                      EAT THE PIXELS.<br/>DON'T HIT THE WALLS.<br/>DON'T EAT YOURSELF.
                    </p>
                    <button
                      onClick={startGame}
                      className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-retro text-sm rounded shadow-[0_4px_0_rgb(161,98,7)] active:translate-y-1 active:shadow-none transition-all duration-75"
                    >
                      START
                    </button>
                  </div>
                )}

                {status === 'GAME_OVER' && (
                  <div className="text-center">
                    <h2 className="text-red-500 font-retro text-2xl mb-2 animate-pulse">GAME OVER</h2>
                    <div className="text-zinc-400 font-retro text-[10px] mb-8">
                      FINAL SCORE: <span className="text-white">{score}</span>
                    </div>
                    <button
                      onClick={startGame}
                      className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-retro text-sm rounded shadow-[0_4px_0_rgb(161,161,170)] active:translate-y-1 active:shadow-none transition-all duration-75"
                    >
                      <RotateCcw size={16} />
                      RETRY
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls Help / Footer */}
      <div className="mt-8 flex flex-col items-center gap-6">
        <div className="grid grid-cols-3 gap-2">
          <div />
          <div className="p-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-500 shadow-sm"><ArrowUp size={20} /></div>
          <div />
          <div className="p-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-500 shadow-sm"><ArrowLeft size={20} /></div>
          <div className="p-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-500 shadow-sm"><ArrowDown size={20} /></div>
          <div className="p-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-500 shadow-sm"><ArrowRight size={20} /></div>
        </div>
        
        <p className="text-zinc-500 font-retro text-[9px] uppercase tracking-widest text-center max-w-[200px] leading-loose opacity-50">
          Use arrow keys to move.<br/>Mobile support coming soon.
        </p>
      </div>
    </div>
  );
}
