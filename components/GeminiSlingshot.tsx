/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint, TargetCandidate } from '../services/geminiService';
import { Point, Bubble, Particle, BubbleColor, DebugInfo, MultiplayerState, StrategicHint } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, MousePointerClick, Eye, Terminal, Clock, AlertTriangle, Target, Lightbulb, Monitor, ChevronLeft, ArrowLeft, ShieldCheck, Coins, ShoppingBag, Users, Palette, Check, Sparkles, Award, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameMode, ScoreService, SKINS, Skin } from '../services/ScoreService';
import { auth } from '../services/firebase';
// Standard Firebase Auth listener for real-time identity updates. 
// Note: Ensure your environment matches Firebase SDK v9+ modular syntax.
import { onAuthStateChanged } from 'firebase/auth';

/**
 * GEMINI VISION STRIKE - MAIN COMPONENT
 * 
 * A high-performance game engine built on React 19 + HTML5 Canvas.
 * Features:
 * - Real-time skeletal hand tracking via MediaPipe.
 * - Hexagonal grid physics for bubble positioning.
 * - Recursive flood-fill matching algorithms.
 * - AI Strategic Co-piloting using Gemini VLM.
 */

interface GeminiSlingshotProps {
  difficulty: GameMode;
  onBack: () => void;
  multiplayer?: MultiplayerState;
  onGameOverMultiplayer?: (score: number) => void;
}

const PINCH_THRESHOLD = 0.05;
const GRAVITY = 0.0; 
const FRICTION = 0.998; 

const BUBBLE_RADIUS = 22;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const GRID_COLS = 12;
const GRID_ROWS = 8;
const SLINGSHOT_BOTTOM_OFFSET = 220;

const MAX_DRAG_DIST = 180;
const MIN_FORCE_MULT = 0.15;
const MAX_FORCE_MULT = 0.45;
const POWER_UP_CHANCE = 0.08;

// Material Design Colors & Scoring Strategy
const COLOR_CONFIG: Record<BubbleColor, { hex: string, points: number, label: string }> = {
  red:    { hex: '#ef5350', points: 100, label: 'Red' },     // Material Red 400
  blue:   { hex: '#42a5f5', points: 150, label: 'Blue' },    // Material Blue 400
  green:  { hex: '#66bb6a', points: 200, label: 'Green' },   // Material Green 400
  yellow: { hex: '#ffee58', points: 250, label: 'Yellow' },  // Material Yellow 400
  purple: { hex: '#ab47bc', points: 300, label: 'Purple' },  // Material Purple 400
  orange: { hex: '#ffa726', points: 500, label: 'Orange' }   // Material Orange 400
};

const COLOR_KEYS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

// Sound Engine for synth-based feedback
const SoundEngine = {
  ctx: null as AudioContext | null,
  
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  play(type: 'shoot' | 'collision' | 'match' | 'powerup' | 'gameover') {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    if (type === 'shoot') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'collision') {
      // Shorter, sharper pop for bubble collisions
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'match') {
      // Harmonic ascending chime for successful matches
      [600, 800, 1200].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + (i * 0.05));
        gain.gain.setValueAtTime(0.1, now + (i * 0.05));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.05) + 0.3);
        osc.start(now + (i * 0.05));
        osc.stop(now + (i * 0.05) + 0.3);
      });
    } else if (type === 'powerup') {
      // Sweeping magic-like sound for power-ups
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, now);
      filter.frequency.exponentialRampToValueAtTime(3000, now + 0.5);
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'gameover') {
      // Low, dramatic bass drop for game over
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.8);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    }
  }
};

// Color Helper for Gradients
const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    
    const componentToHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const GeminiSlingshot: React.FC<GeminiSlingshotProps> = ({ 
  difficulty, 
  onBack, 
  multiplayer, 
  onGameOverMultiplayer 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // ==========================================
  // COMPONENT STATE
  // ==========================================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  const isMultiplayer = multiplayer?.isMultiplayer;
  const currentPlayerName = isMultiplayer 
    ? (multiplayer.currentPlayer === 1 ? multiplayer.player1.name : multiplayer.player2.name)
    : (multiplayer?.player1.name || 'Solo Pilot');
  // Game State Refs
  const ballPos = useRef<Point>({ x: 0, y: 0 });
  const ballVel = useRef<Point>({ x: 0, y: 0 });
  const anchorPos = useRef<Point>({ x: 0, y: 0 });
  const isPinching = useRef<boolean>(false);
  const isFlying = useRef<boolean>(false);
  const flightStartTime = useRef<number>(0);
  const bubbles = useRef<Bubble[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  
  const aimTargetRef = useRef<Point | null>(null);
  const isAiThinkingRef = useRef<boolean>(false);
  
  // AI Request Trigger
  const captureRequestRef = useRef<boolean>(false);

  // Current active color (Ref for loop, State for UI)
  const selectedColorRef = useRef<BubbleColor>('red');
  
  // React State
  const [gameDifficulty, setGameDifficulty] = useState<GameMode>(difficulty);
  const [loading, setLoading] = useState(true);
  const [slowTimeActive, setSlowTimeActive] = useState(false);
  const [inventory, setInventory] = useState<{ id: string, type: Bubble['powerUp'] }[]>([]);
  const [aiHint, setAiHint] = useState<string | null>("Initializing strategy engine...");
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aimTarget, setAimTarget] = useState<Point | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [shotsFired, setShotsFired] = useState(0);
  const [coins, setCoins] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [selectedSkinId, setSelectedSkinId] = useState('default');
  const [showShop, setShowShop] = useState(false);
  const [dailyRewardMessage, setDailyRewardMessage] = useState<string | null>(null);
  const [targetPoints, setTargetPoints] = useState(1500); 
  const [timeLeft, setTimeLeft] = useState(60); 
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedColor, setSelectedColor] = useState<BubbleColor>('red');
  const [availableColors, setAvailableColors] = useState<BubbleColor[]>([]);
  const [aiRecommendedColor, setAiRecommendedColor] = useState<BubbleColor | null>(null);
  const [aiRecommendedTarget, setAiRecommendedTarget] = useState<TargetCandidate | null>(null);
  const [recommendationTimestamp, setRecommendationTimestamp] = useState<number | null>(null);
  const [isLockedOn, setIsLockedOn] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [multiplayerGameOver, setMultiplayerGameOver] = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<{ id: number; startX: number; startY: number }[]>([]);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (isMultiplayer) return; // Skip auth guard for multiplayer
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        onBack();
      }
    });
    return () => unsubscribe();
  }, [onBack, isMultiplayer]);

  // Initialize profile and daily reward
  useEffect(() => {
    const initProfile = async () => {
      const profile = ScoreService.getLocalProfile();
      setCoins(profile.coins);
      setOwnedSkins(profile.ownedSkins || ['default']);
      setSelectedSkinId(profile.selectedSkin || 'default');
      
      const reward = await ScoreService.claimDailyReward();
      if (reward) {
        setDailyRewardMessage(`Daily Reward: +${reward} Coins!`);
        setCoins(prev => prev + reward);
        setTimeout(() => setDailyRewardMessage(null), 5000);
      }
    };
    initProfile();
  }, []);

  // ==========================================
  // GAME DYNAMICS & DIFFICULTY SCALING
  // ==========================================
  
  /**
   * Generates a difficulty profile based on the current level and base game difficulty.
   * As the pilot levels up, parameters like descent rate, AI latency, and score
   * multipliers scale dynamically to maintain challenge and reward progression.
   */
  const getDifficultyProfile = useCallback(() => {
    const levelFactor = (level - 1) * 0.1; // 10% scaling per level
    
    if (gameDifficulty === 'easy') {
      return {
        gravity: 0,
        speedBonus: 1.0 + levelFactor * 0.5,
        descentRate: Math.max(10 - Math.floor(level / 2), 6), // Slings faster as level grows
        scoreMultiplier: 1.0 + levelFactor,
        aiLatency: Math.max(200 - level * 10, 50),
        interferenceChance: 0
      };
    } else if (gameDifficulty === 'moderate') {
      return {
        gravity: 0.01 + levelFactor * 0.01,
        speedBonus: 1.15 + levelFactor,
        descentRate: Math.max(8 - Math.floor(level / 2), 4),
        scoreMultiplier: 1.5 + levelFactor,
        aiLatency: Math.max(800 - level * 50, 200),
        interferenceChance: 0.05 + levelFactor * 0.05
      };
    } else {
      return {
        gravity: 0.04 + levelFactor * 0.02,
        speedBonus: 1.3 + levelFactor * 1.5,
        descentRate: Math.max(6 - Math.floor(level / 2), 2),
        scoreMultiplier: 2.0 + levelFactor * 2,
        aiLatency: Math.max(2000 - level * 150, 500),
        interferenceChance: Math.min(0.2 + levelFactor * 0.1, 0.5) // Max 50% "jamming" chance on Hard
      };
    }
  }, [gameDifficulty, level]);

  const profile = getDifficultyProfile();
  const gravity = profile.gravity;
  const initialRows = gameDifficulty === 'easy' ? 3 : (gameDifficulty === 'hard' ? 7 : 5);
  const scoreMultiplier = profile.scoreMultiplier;
  const speedBonus = profile.speedBonus;
  const aiLatency = profile.aiLatency;
  const interferenceChance = profile.interferenceChance;
  const descentRate = profile.descentRate;

  // Sync state to ref
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    aimTargetRef.current = aimTarget;
  }, [aimTarget]);

  useEffect(() => {
    isAiThinkingRef.current = isAiThinking;
  }, [isAiThinking]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') {
        setDebugMode(prev => !prev);
      }
      if (e.key.toLowerCase() === 'l' && aiRecommendedTarget) {
        setIsLockedOn(prev => !prev);
        SoundEngine.play('match');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiRecommendedTarget]);

  useEffect(() => {
    if (!aiRecommendedTarget || isLockedOn || !recommendationTimestamp) {
        return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - recommendationTimestamp;
      if (elapsed >= 5000) {
        setAiRecommendedTarget(null);
        setAiRecommendedColor(null);
        setRecommendationTimestamp(null);
        setAiHint("Strategic window expired. Manual intervention recommended.");
        setAiRationale(null);
        setAimTarget(null);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [aiRecommendedTarget, isLockedOn, recommendationTimestamp]);

  const handleNextMultiplayerTurn = () => {
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(60);
    setLevel(1);
    setTargetPoints(1500);
    if (gameContainerRef.current) {
        initGrid(gameContainerRef.current.clientWidth);
    }
  };

  const getBubblePos = (row: number, col: number, width: number) => {
    const xOffset = (width - (GRID_COLS * BUBBLE_RADIUS * 2)) / 2 + BUBBLE_RADIUS;
    const isOdd = row % 2 !== 0;
    const x = xOffset + col * (BUBBLE_RADIUS * 2) + (isOdd ? BUBBLE_RADIUS : 0);
    const y = BUBBLE_RADIUS + row * ROW_HEIGHT;
    return { x, y };
  };

  const updateAvailableColors = useCallback(() => {
    const activeColors = new Set<BubbleColor>();
    bubbles.current.forEach(b => {
        if (b.active) activeColors.add(b.color);
    });
    setAvailableColors(Array.from(activeColors));
    
    // If current selected color is gone, switch to first available
    if (!activeColors.has(selectedColorRef.current) && activeColors.size > 0) {
        const next = Array.from(activeColors)[0];
        setSelectedColor(next);
    }
  }, []);

  /**
   * Bubble Descent Mechanism:
   * Moves all active bubbles down by one row and introduces a fresh
   * combat line at the top. Triggered every 'descentRate' shots.
   */
  const descendGrid = useCallback(() => {
    bubbles.current.forEach(b => {
      if (b.active) {
        b.row += 1;
        const { y } = getBubblePos(b.row, b.col, canvasRef.current?.width || 1000);
        b.y = y;
        
        if (b.row >= GRID_ROWS) {
          triggerGameOver();
        }
      }
    });

    // Add a new row of bubbles at the top
    const width = canvasRef.current?.width || 1000;
    const colsInRow = GRID_COLS; // Even rows have GRID_COLS
    for (let c = 0; c < colsInRow; c++) {
      if (Math.random() > 0.3) {
        const { x, y } = getBubblePos(0, c, width);
        bubbles.current.push({
          id: `descend-${Date.now()}-${c}`,
          row: 0,
          col: c,
          x,
          y,
          color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
          active: true
        });
      }
    }
    updateAvailableColors();
    SoundEngine.play('collision');
  }, [updateAvailableColors]);

  const initGrid = useCallback((width: number) => {
    const newBubbles: Bubble[] = [];
    for (let r = 0; r < initialRows; r++) { 
      for (let c = 0; c < (r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS); c++) {
        if (Math.random() > 0.1) {
            const { x, y } = getBubblePos(r, c, width);
            const roll = Math.random();
            let powerUp: Bubble['powerUp'] = undefined;
            if (roll < POWER_UP_CHANCE) {
                const puRoll = Math.random();
                if (puRoll < 0.33) powerUp = 'rowClear';
                else if (puRoll < 0.66) powerUp = 'colorMatch';
                else powerUp = 'slowTime';
            }

            newBubbles.push({
              id: `${r}-${c}`,
              row: r,
              col: c,
              x,
              y,
              color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
              active: true,
              powerUp
            });
        }
      }
    }
    bubbles.current = newBubbles;
    updateAvailableColors();
    
    // Trigger initial AI analysis after a short delay to allow render
    setTimeout(() => {
        captureRequestRef.current = true;
    }, 2000);
  }, [initialRows]);

  // Auto-refresh AI Analysis for Easy mode
  useEffect(() => {
    if (gameDifficulty !== 'easy' || gameOver || !gameContainerRef.current) return;
    
    const interval = setInterval(() => {
      // Only request if not already thinking and not currently flying
      if (!isAiThinkingRef.current && !isFlying.current && !gameOver) {
        captureRequestRef.current = true;
      }
    }, 15000); // Check every 15s if it needs a new recommendation in easy mode
    
    return () => clearInterval(interval);
  }, [gameDifficulty, gameOver]);

  useEffect(() => {
    const profile = ScoreService.getLocalProfile();
    setCoins(profile.coins);
    
    // Start tutorial for new pilots
    const tutorialVp = localStorage.getItem('gemine_tutorial_v1');
    if (!tutorialVp && !isMultiplayer) {
      setTutorialStep(0);
    }
  }, [isMultiplayer]);

  // Save score on Game Over
  useEffect(() => {
    if (gameOver) {
      const coinsEarned = Math.floor(score / 5);
      ScoreService.updateScoreAndCoins(score, coinsEarned);
      ScoreService.saveGameResult(score, gameDifficulty as GameMode, level);
      ScoreService.getLeaderboard().then(setLeaderboard);
      SoundEngine.play('gameover'); // Tactical end sound
    }
  }, [gameOver, score, gameDifficulty, level]);

  const triggerGameOver = () => {
    if (isMultiplayer) {
      onGameOverMultiplayer?.(score);
      if (multiplayer && multiplayer.currentPlayer === 2 && multiplayer.currentRound === 3) {
        setMultiplayerGameOver(true);
      } else {
        setGameOver(true);
      }
    } else {
      setGameOver(true);
    }
  };

  // Timer logic
  useEffect(() => {
    if (gameOver || multiplayerGameOver || loading || timeLeft <= 0 || tutorialStep !== null) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          triggerGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, multiplayerGameOver, loading, timeLeft, isMultiplayer]);

  // Level progression
  useEffect(() => {
    if (score >= targetPoints) {
      // Level Up!
      const levelBonus = level * 500;
      const coinReward = Math.floor(score / 5); 
      
      setLevel(prev => prev + 1);
      setTargetPoints(prev => prev + 2500);
      setCoins(prev => prev + coinReward);
      ScoreService.updateScoreAndCoins(score, coinReward);
      
      // Trigger coin burst
      const newCoins = Array.from({ length: 15 }).map((_, i) => ({
        id: Date.now() + i,
        startX: window.innerWidth / 2,
        startY: window.innerHeight / 2
      }));
      setFlyingCoins(prev => [...prev, ...newCoins]);
      setTimeout(() => setFlyingCoins([]), 2000);

      // Reset bubbles for next level
      if (canvasRef.current) {
          initGrid(canvasRef.current.width);
      }
      
      // Bonus time for level up
      setTimeLeft(prev => prev + 30);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
      SoundEngine.play('match');
    }
  }, [score, targetPoints, level, initGrid]);

  const buyTime = () => {
    const cost = 250 + (level * 100);
    if (ScoreService.spendCoins(cost)) {
        setCoins(prev => prev - cost);
        setTimeLeft(prev => prev + 15);
        SoundEngine.play('shoot');
    } else {
        setAiHint("Insufficient credits for time extension.");
    }
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        color
      });
    }
  };

  const isPathClear = (target: Bubble) => {
    if (!anchorPos.current) return false;
    
    const startX = anchorPos.current.x;
    const startY = anchorPos.current.y;
    const endX = target.x;
    const endY = target.y;

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / (BUBBLE_RADIUS / 2)); 

    for (let i = 1; i < steps - 2; i++) { 
        const t = i / steps;
        const cx = startX + dx * t;
        const cy = startY + dy * t;

        for (const b of bubbles.current) {
            if (!b.active || b.id === target.id) continue;
            const distSq = Math.pow(cx - b.x, 2) + Math.pow(cy - b.y, 2);
            if (distSq < Math.pow(BUBBLE_RADIUS * 1.8, 2)) {
                return false; 
            }
        }
    }
    return true;
  };

  /**
   * HEXAGONAL CLUSTER ANALYSIS
   * Performs a breadth-first search (BFS) on the hex grid to identify
   * contiguous groups of color-matched bubbles. This information is passed 
   * to Gemini as a serialized candidate list for multimodal analysis.
   */
  const getAllReachableClusters = (): TargetCandidate[] => {
    const activeBubbles = bubbles.current.filter(b => b.active);
    const uniqueColors = Array.from(new Set(activeBubbles.map(b => b.color))) as BubbleColor[];
    const allClusters: TargetCandidate[] = [];

    // Analyze opportunities for ALL colors
    for (const color of uniqueColors) {
        const visited = new Set<string>();
        
        for (const b of activeBubbles) {
            if (b.color !== color || visited.has(b.id)) continue;

            const clusterMembers: Bubble[] = [];
            const queue = [b];
            visited.add(b.id);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                clusterMembers.push(curr);
                
                const neighbors = activeBubbles.filter(n => 
                    !visited.has(n.id) && n.color === color && isNeighbor(curr, n)
                );
                neighbors.forEach(n => {
                    visited.add(n.id);
                    queue.push(n);
                });
            }

            // Check if this cluster is hittable
            clusterMembers.sort((a,b) => b.y - a.y); 
            const hittableMember = clusterMembers.find(m => isPathClear(m));

            if (hittableMember) {
                const xPct = hittableMember.x / (gameContainerRef.current?.clientWidth || window.innerWidth);
                let desc = "Center";
                if (xPct < 0.33) desc = "Left";
                else if (xPct > 0.66) desc = "Right";

                allClusters.push({
                    id: hittableMember.id,
                    color: color,
                    size: clusterMembers.length,
                    row: hittableMember.row,
                    col: hittableMember.col,
                    pointsPerBubble: COLOR_CONFIG[color].points,
                    description: `${desc}`
                });
            }
        }
    }
    return allClusters;
  };

  const activatePowerUp = (type: Bubble['powerUp'], invId: string) => {
    if (!type) return;
    
    setInventory(prev => prev.filter(item => item.id !== invId));

    if (type === 'rowClear') {
      const activeRows = Array.from(new Set(bubbles.current.filter(b => b.active).map(b => b.row)));
      if (activeRows.length > 0) {
        const targetRow = activeRows[Math.floor(Math.random() * activeRows.length)];
        bubbles.current.forEach(b => {
          if (b.active && b.row === targetRow) {
            b.active = false;
            createExplosion(b.x, b.y, COLOR_CONFIG[b.color].hex);
            scoreRef.current += COLOR_CONFIG[b.color].points;
          }
        });
        setScore(scoreRef.current);
        setAiHint("Orbital Strike Activated! Row Cleared.");
      }
    } else if (type === 'colorMatch') {
      const colors = Array.from(new Set(bubbles.current.filter(b => b.active).map(b => b.color)));
      if (colors.length > 0) {
        const targetCol = colors[Math.floor(Math.random() * colors.length)];
        bubbles.current.forEach(b => {
          if (b.active && b.color === targetCol) {
            b.active = false;
            createExplosion(b.x, b.y, COLOR_CONFIG[b.color].hex);
            scoreRef.current += COLOR_CONFIG[b.color].points;
          }
        });
        setScore(scoreRef.current);
        setAiHint("Chameleon Pulse! System-wide sync complete.");
      }
    } else if (type === 'slowTime') {
      setSlowTimeActive(true);
      setTimeLeft(prev => prev + 15);
      setTimeout(() => setSlowTimeActive(false), 5000);
      setAiHint("Chronos Flux! Tactical window extended.");
    }
    SoundEngine.play('powerup');
  };

  const checkMatches = (startBubble: Bubble) => {
    const toCheck = [startBubble];
    const visited = new Set<string>();
    const matches: Bubble[] = [];
    const targetColor = startBubble.color;
    let foundPowerUp: Bubble['powerUp'] = undefined;

    while (toCheck.length > 0) {
      const current = toCheck.pop()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      if (current.color === targetColor) {
        matches.push(current);
        if (current.powerUp) foundPowerUp = current.powerUp;
        const neighbors = bubbles.current.filter(b => b.active && !visited.has(b.id) && isNeighbor(current, b));
        toCheck.push(...neighbors);
      }
    }

    if (matches.length >= 3) {
      let points = 0;
      const basePoints = COLOR_CONFIG[targetColor].points;
      
      matches.forEach(b => {
        b.active = false;
        createExplosion(b.x, b.y, COLOR_CONFIG[b.color].hex);
        points += basePoints;
      });

      // --- Collect Power-Up instead of immediate trigger ---
      if (foundPowerUp) {
        setInventory(prev => [...prev.slice(-2), { id: Math.random().toString(36).substr(2, 9), type: foundPowerUp }]);
        setAiHint(`Tactical Asset Collected: ${foundPowerUp === 'rowClear' ? 'Orbital Strike' : foundPowerUp === 'colorMatch' ? 'Chameleon Pulse' : 'Chronos Flux'}`);
      }

      // Combo + Difficulty Multiplier
      const comboMultiplier = matches.length > 3 ? 1.5 : 1.0;
      const totalPoints = Math.floor(points * comboMultiplier * scoreMultiplier);
      
      scoreRef.current += totalPoints;
      setScore(scoreRef.current);
      SoundEngine.play('match');
      return true;
    }
    return false;
  };

  const isNeighbor = (a: Bubble, b: Bubble) => {
    const dr = b.row - a.row;
    const dc = b.col - a.col;
    if (Math.abs(dr) > 1) return false;
    if (dr === 0) return Math.abs(dc) === 1;
    if (a.row % 2 !== 0) {
        return dc === 0 || dc === 1;
    } else {
        return dc === -1 || dc === 0;
    }
  };

  const performAiAnalysis = async (screenshot: string) => {
    // Lock interaction immediately via ref (fast) and state (render)
    isAiThinkingRef.current = true;
    setIsAiThinking(true);
    
    setAiHint("Calibrating Vision Strike...");
    setAiRationale("Running initial heuristic scan...");
    setAiRecommendedColor(null);
    setAimTarget(null);

    // Client-Side Pre-Calc for ALL colors
    const allClusters = getAllReachableClusters();
    const maxRow = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.row) : max, 0);
    const canvasWidth = canvasRef.current?.width || 1000;

    // IMMEDIATE HEURISTIC FEEDBACK
    if (allClusters.length > 0) {
      const best = [...allClusters].sort((a,b) => {
          const scoreIA = a.size * a.pointsPerBubble;
          const scoreIB = b.size * b.pointsPerBubble;
          return (scoreIB - scoreIA) || (a.row - b.row);
      })[0];
      
      const prelimHint: StrategicHint = {
          message: `PRELIMINARY: target ${best.color.toUpperCase()} at Row ${best.row}`,
          rationale: "Tactical depth analysis in progress...",
          targetRow: best.row,
          targetCol: best.col,
          recommendedColor: best.color as any
      };
      
      setAiRecommendedTarget(prelimHint);
      setAiRecommendedColor(best.color as any);
      setSelectedColor(best.color as any);
      const pos = getBubblePos(best.row, best.col, canvasWidth);
      setAimTarget(pos);
    }

    // Wait for AI Processing Simulation
    await new Promise(resolve => setTimeout(resolve, aiLatency));

    getStrategicHint(
        screenshot,
        allClusters,
        maxRow,
        gameDifficulty
    ).then(aiResponse => {
        const { hint, debug } = aiResponse;
        
        // Dynamic Interference: chance decreases as level increases (player becomes a pro) 
        // OR stays high for hard? Let's use the profile's interferenceChance.
        if (Math.random() < interferenceChance) {
            hint.message = "TACTICAL INTERFERENCE: Target coordinates unstable.";
            hint.rationale = "Atmospheric distortion detected. Operational risk high.";
        }

        setDebugInfo(debug);
        setAiHint(hint.message);
        setAiRationale(hint.rationale || null);
        
        setAiRecommendedTarget(hint);
        setRecommendationTimestamp(Date.now());
        
        // On Easy, automatically lock on targets
        if (gameDifficulty === 'easy') {
            setIsLockedOn(true);
        } else {
            setIsLockedOn(false);
        }
        
        if (typeof hint.targetRow === 'number' && typeof hint.targetCol === 'number') {
            if (hint.recommendedColor && tutorialStep === null) {
                setAiRecommendedColor(hint.recommendedColor);
                setSelectedColor(hint.recommendedColor); // Auto-equip recommendation
            }
            const pos = getBubblePos(hint.targetRow, hint.targetCol, canvasWidth);
            if (tutorialStep === null) setAimTarget(pos);
        }
        
        // Unlock
        isAiThinkingRef.current = false;
        setIsAiThinking(false);
    });
  };

  // --- Rendering Helper ---
  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colorKey: BubbleColor, powerUp?: string) => {
    const config = COLOR_CONFIG[colorKey];
    const baseColor = config.hex;
    
    // Main Sphere Gradient (gives 3D depth)
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, powerUp ? '#ffffff' : '#ffffff');
    grad.addColorStop(0.2, baseColor);
    grad.addColorStop(1, adjustColor(baseColor, -60));

    // Power-up Pulse Aura
    if (powerUp) {
      const pulse = Math.sin(Date.now() / 200) * 5 + 5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = `${baseColor}33`;
      ctx.fill();
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle Outline
    ctx.strokeStyle = adjustColor(baseColor, -80);
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Glossy Highlight
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.3, y - radius * 0.35, radius * 0.25, radius * 0.15, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // Power-up Icons
    if (powerUp) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let icon = '';
      if (powerUp === 'rowClear') icon = '⚡';
      if (powerUp === 'colorMatch') icon = '✨';
      if (powerUp === 'slowTime') icon = '⏲️';
      ctx.fillText(icon, x, y);
      ctx.restore();
    }
  };

  /**
   * INTEGRATED GAME LOOP (MediaPipe Reactive)
   * 
   * This logic is driven by the Computer Vision (MediaPipe) inference loop.
   * Every 'results' packet contains hand skeletal data which we transform into
   * game-space coordinates.
   * 
   * Architecture:
   * 1. Landmark Extraction (Index & Thumb tips)
   * 2. Gesture Logic (Pinch vs. Release)
   * 3. Slingshot Vector Physics
   * 4. Canvas-optimized Rendering
   */
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !gameContainerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = gameContainerRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Set initial size based on container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
    ballPos.current = { ...anchorPos.current };
    
    initGrid(canvas.width);

    let camera: any = null;
    let hands: any = null;

    const onResults = (results: any) => {
      setLoading(false);
      
      // Responsive Resize
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
        if (!isFlying.current && !isPinching.current) {
          ballPos.current = { ...anchorPos.current };
        }
      }

      // --- PHASE 1: ENVIRONMENT SETUP ---
      // Clear the canvas and prepare the viewport for the current frame iteration.
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Video Feed
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      // Material Dark Overlay
      ctx.fillStyle = 'rgba(18, 18, 18, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- PHASE 2: COMPUTER VISION & LANDMARK EXTRACTION ---
      // Extract skeletal hand positions to derive the pinch gesture (the controller).
      let handPos: Point | null = null;
      let pinchDist = 1.0;

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const idxTip = landmarks[8];
        const thumbTip = landmarks[4];

        handPos = {
          x: (idxTip.x * canvas.width + thumbTip.x * canvas.width) / 2,
          y: (idxTip.y * canvas.height + thumbTip.y * canvas.height) / 2
        };

        const dx = idxTip.x - thumbTip.x;
        const dy = idxTip.y - thumbTip.y;
        pinchDist = Math.sqrt(dx * dx + dy * dy);

        if (window.drawConnectors && window.drawLandmarks) {
           // Google Blue for tracking lines
           window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#669df6', lineWidth: 1});
           window.drawLandmarks(ctx, landmarks, {color: '#aecbfa', lineWidth: 1, radius: 2});
        }
        
        // Cursor
        ctx.beginPath();
        ctx.arc(handPos.x, handPos.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = pinchDist < PINCH_THRESHOLD ? '#66bb6a' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // --- PHASE 3: COMBAT & BALL PHYSICS ---
      // Handle the slingshot tension, launch velocity, and projectile trajectory.
      
      // Check if we are currently "Locked" waiting for AI
      const isLocked = isAiThinkingRef.current;

      if (!isLocked && handPos && pinchDist < PINCH_THRESHOLD && !isFlying.current) {
        const distToBall = Math.sqrt(Math.pow(handPos.x - ballPos.current.x, 2) + Math.pow(handPos.y - ballPos.current.y, 2));
        if (!isPinching.current && distToBall < 100) {
           isPinching.current = true;
        }
        
        if (isPinching.current) {
            ballPos.current = { x: handPos.x, y: handPos.y };
            const dragDx = ballPos.current.x - anchorPos.current.x;
            const dragDy = ballPos.current.y - anchorPos.current.y;
            const dragDist = Math.sqrt(dragDx*dragDx + dragDy*dragDy);
            
            if (dragDist > MAX_DRAG_DIST) {
                const angle = Math.atan2(dragDy, dragDx);
                ballPos.current.x = anchorPos.current.x + Math.cos(angle) * MAX_DRAG_DIST;
                ballPos.current.y = anchorPos.current.y + Math.sin(angle) * MAX_DRAG_DIST;
            }
        }
      } 
      else if (isPinching.current && (!handPos || pinchDist >= PINCH_THRESHOLD || isLocked)) {
        // Release or Forced Release if Locked
        isPinching.current = false;
        
        if (isLocked) {
             // If we lock while pinching, reset to anchor
             ballPos.current = { ...anchorPos.current };
        } else {
            const dx = anchorPos.current.x - ballPos.current.x;
            const dy = anchorPos.current.y - ballPos.current.y;
            const stretchDist = Math.sqrt(dx*dx + dy*dy);
            
            if (stretchDist > 30) {
                isFlying.current = true;
                SoundEngine.play('shoot');
                flightStartTime.current = performance.now();
                const powerRatio = Math.min(stretchDist / MAX_DRAG_DIST, 1.0);
                const velocityMultiplier = (MIN_FORCE_MULT + (MAX_FORCE_MULT - MIN_FORCE_MULT) * (powerRatio * powerRatio)) * speedBonus;

                ballVel.current = {
                    x: dx * velocityMultiplier,
                    y: dy * velocityMultiplier
                };
            } else {
                ballPos.current = { ...anchorPos.current };
            }
        }
      }
      else if (!isFlying.current && !isPinching.current) {
          const dx = anchorPos.current.x - ballPos.current.x;
          const dy = anchorPos.current.y - ballPos.current.y;
          ballPos.current.x += dx * 0.15;
          ballPos.current.y += dy * 0.15;
      }

      // --- Physics ---
      // --- PHASE 4: PROJECTILE MOTION ---
      // Update the flying bubble's position based on velocity and handle screen boundaries.
      if (isFlying.current) {
        // Infinite bounce safeguard: if flying for more than 5 seconds (5000ms), cancel shot
        if (performance.now() - flightStartTime.current > 5000) {
            isFlying.current = false;
            ballPos.current = { ...anchorPos.current };
            ballVel.current = { x: 0, y: 0 };
        } else {
            const currentSpeed = Math.sqrt(ballVel.current.x ** 2 + ballVel.current.y ** 2);
            const steps = Math.ceil(currentSpeed / (BUBBLE_RADIUS * 0.8)); 
            let collisionOccurred = false;

            for (let i = 0; i < steps; i++) {
                ballPos.current.x += ballVel.current.x / steps;
                ballPos.current.y += ballVel.current.y / steps;
                
                if (ballPos.current.x < BUBBLE_RADIUS || ballPos.current.x > canvas.width - BUBBLE_RADIUS) {
                    ballVel.current.x *= -1;
                    ballPos.current.x = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, ballPos.current.x));
                }

                if (ballPos.current.y < BUBBLE_RADIUS) {
                    collisionOccurred = true;
                    break;
                }

                // --- PHASE 5: COLLISION DETECTION & RESOLUTION ---
                // Identify target coordinates after projectile impact.
                for (const b of bubbles.current) {
                    if (!b.active) continue;
                    const dist = Math.sqrt(
                        Math.pow(ballPos.current.x - b.x, 2) + 
                        Math.pow(ballPos.current.y - b.y, 2)
                    );
                    if (dist < BUBBLE_RADIUS * 1.8) { 
                        collisionOccurred = true;
                        break;
                    }
                }
                if (collisionOccurred) break;
            }

            ballVel.current.y += gravity; 
            ballVel.current.x *= FRICTION;
            ballVel.current.y *= FRICTION;

            if (collisionOccurred) {
                isFlying.current = false;
                SoundEngine.play('collision');
                
                let bestDist = Infinity;
                let bestRow = 0;
                let bestCol = 0;
                let bestX = 0;
                let bestY = 0;

                for (let r = 0; r < GRID_ROWS + 5; r++) {
                    const colsInRow = r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS;
                    for (let c = 0; c < colsInRow; c++) {
                        const { x, y } = getBubblePos(r, c, canvas.width);
                        const occupied = bubbles.current.some(b => b.active && b.row === r && b.col === c);
                        if (occupied) continue;

                        const dist = Math.sqrt(
                            Math.pow(ballPos.current.x - x, 2) + 
                            Math.pow(ballPos.current.y - y, 2)
                        );
                        
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestRow = r;
                            bestCol = c;
                            bestX = x;
                            bestY = y;
                        }
                    }
                }

                // Check Game Over
                if (bestRow >= GRID_ROWS) {
                  setGameOver(true);
                  return;
                }

                const newBubble: Bubble = {
                    id: `${bestRow}-${bestCol}-${Date.now()}`,
                    row: bestRow,
                    col: bestCol,
                    x: bestX,
                    y: bestY,
                    color: selectedColorRef.current,
                    active: true
                };
                bubbles.current.push(newBubble);
                checkMatches(newBubble);
                updateAvailableColors();
                
                // Track turns for descent
                setShotsFired(prev => {
                  const next = prev + 1;
                  if (next >= descentRate) {
                    descendGrid();
                    return 0;
                  }
                  return next;
                });

                // Reset shot
                ballPos.current = { ...anchorPos.current };
                ballVel.current = { x: 0, y: 0 };

                // Request AI Analysis for next frame
                captureRequestRef.current = true;
            }
            
            if (ballPos.current.y > canvas.height) {
                isFlying.current = false;
                ballPos.current = { ...anchorPos.current };
                ballVel.current = { x: 0, y: 0 };
            }
        }
      }

      // --- Drawing ---
      const thinking = isAiThinkingRef.current;
      
      // Draw Grid Bubbles
      bubbles.current.forEach(b => {
          if (!b.active) return;
          drawBubble(ctx, b.x, b.y, BUBBLE_RADIUS - 1, b.color, b.powerUp);
      });

      // --- Player Trajectory Prediction (Strategic Cue) ---
      if (isPinching.current && !isFlying.current && !loading) {
        const dx = anchorPos.current.x - ballPos.current.x;
        const dy = anchorPos.current.y - ballPos.current.y;
        const stretchDist = Math.sqrt(dx*dx + dy*dy);

        if (stretchDist > 20) {
            ctx.save();
            const powerRatio = Math.min(stretchDist / MAX_DRAG_DIST, 1.0);
            const vMult = (MIN_FORCE_MULT + (MAX_FORCE_MULT - MIN_FORCE_MULT) * (powerRatio * powerRatio)) * speedBonus;
            
            let pX = ballPos.current.x;
            let pY = ballPos.current.y;
            let vX = dx * vMult;
            let vY = dy * vMult;

            ctx.beginPath();
            ctx.moveTo(pX, pY);
            
            // Draw predictive arc
            const projectionSteps = 40;
            for (let i = 0; i < projectionSteps; i++) {
                pX += vX;
                pY += vY;
                
                if (pX < BUBBLE_RADIUS || pX > canvas.width - BUBBLE_RADIUS) vX *= -1;
                
                vY += gravity;
                vX *= FRICTION;
                vY *= FRICTION;

                // Only trace the path
                ctx.lineTo(pX, pY);
                
                if (pY < -50 || pY > canvas.height + 50) break;
            }

            const pathGrad = ctx.createLinearGradient(ballPos.current.x, ballPos.current.y, pX, pY);
            pathGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            pathGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.strokeStyle = pathGrad;
            ctx.setLineDash([5, 8]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
      }

      // --- Trajectory Line (Previously Commented Out) ---
      // Logic removed per request to clean up file, but previously existed here.

      // Draw AI Recommendation Highlight
      if (aiRecommendedTarget || thinking) {
        let tr = aiRecommendedTarget?.targetRow;
        let tc = aiRecommendedTarget?.targetCol;
        
        // If thinking and no target yet, do a scanning sweep
        if (thinking && typeof tr !== 'number') {
            const time = performance.now();
            const scanRow = Math.floor((time / 1000) % GRID_ROWS);
            const scanCol = Math.floor((time / 100) % GRID_COLS);
            tr = scanRow;
            tc = scanCol;
        }

        if (typeof tr === 'number' && typeof tc === 'number') {
            const { x, y } = getBubblePos(tr, tc, canvas.width);
            const pulse = Math.sin(performance.now() / 200) * 0.5 + 0.5;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Highlight for Easy Mode (Solid fill)
            if (gameDifficulty === 'easy' && aiRecommendedTarget) {
              ctx.beginPath();
              ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(168, 199, 250, ${0.1 + pulse * 0.1})`;
              ctx.fill();
            }

            // Outer dashed ring
            ctx.beginPath();
            ctx.arc(0, 0, BUBBLE_RADIUS * (1.2 + pulse * 0.1), 0, Math.PI * 2);
            ctx.strokeStyle = isLockedOn ? `rgba(168, 199, 250, ${0.5 + pulse * 0.5})` : 'rgba(168, 199, 250, 0.3)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = isLockedOn ? 4 : 2;
            ctx.stroke();
            
            // Reticle crosshair
            if (isLockedOn) {
                ctx.beginPath();
                ctx.moveTo(-BUBBLE_RADIUS * 1.5, 0); ctx.lineTo(-BUBBLE_RADIUS * 0.8, 0);
                ctx.moveTo(BUBBLE_RADIUS * 1.5, 0); ctx.lineTo(BUBBLE_RADIUS * 0.8, 0);
                ctx.moveTo(0, -BUBBLE_RADIUS * 1.5); ctx.lineTo(0, -BUBBLE_RADIUS * 0.8);
                ctx.moveTo(0, BUBBLE_RADIUS * 1.5); ctx.lineTo(0, BUBBLE_RADIUS * 0.8);
                ctx.strokeStyle = '#a8c7fa';
                ctx.setLineDash([]);
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Pulsing center dot
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#a8c7fa';
                ctx.fill();
            }

            ctx.restore();
        }
      }

      // Scanning Line Sweep Overlay
      if (thinking) {
          ctx.save();
          const scanTime = performance.now();
          const sweepY = (scanTime / 2) % canvas.height;
          ctx.beginPath();
          ctx.moveTo(0, sweepY);
          ctx.lineTo(canvas.width, sweepY);
          ctx.strokeStyle = 'rgba(168, 199, 250, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.stroke();
          
          // Glow around sweep
          const sweepGrad = ctx.createLinearGradient(0, sweepY - 50, 0, sweepY + 50);
          sweepGrad.addColorStop(0, 'transparent');
          sweepGrad.addColorStop(0.5, 'rgba(168, 199, 250, 0.1)');
          sweepGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = sweepGrad;
          ctx.fillRect(0, sweepY - 50, canvas.width, 100);
          ctx.restore();
      }

      // Laser Sight
      const currentAimTarget = aimTargetRef.current;
      const currentSelected = selectedColorRef.current;
      const shouldShowLine = currentAimTarget && !isFlying.current && 
                             (!aiRecommendedColor || aiRecommendedColor === currentSelected);

      if (shouldShowLine || thinking) {
          ctx.save();
          const highlightColor = thinking ? '#a8c7fa' : COLOR_CONFIG[currentSelected].hex; 
          
          ctx.shadowBlur = 15;
          ctx.shadowColor = highlightColor;
          
          if (currentAimTarget) {
            // Fading Path Gradient
            const grad = ctx.createLinearGradient(
              anchorPos.current.x, anchorPos.current.y, 
              currentAimTarget.x, currentAimTarget.y
            );
            grad.addColorStop(0, highlightColor);
            grad.addColorStop(0.6, highlightColor);
            grad.addColorStop(1, 'transparent');
            ctx.strokeStyle = grad;

            // Distance Markers along trajectory
            const dx = currentAimTarget.x - anchorPos.current.x;
            const dy = currentAimTarget.y - anchorPos.current.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const dotCount = Math.floor(dist / 30);
            
            for (let i = 1; i < dotCount; i++) {
              const t = i / dotCount;
              const px = anchorPos.current.x + dx * t;
              const py = anchorPos.current.y + dy * t;
              const pulse = Math.sin((performance.now() / 200) - (i * 0.5)) * 0.5 + 0.5;
              
              ctx.beginPath();
              ctx.arc(px, py, 2 + pulse, 0, Math.PI * 2);
              ctx.fillStyle = highlightColor;
              ctx.globalAlpha = (1 - t) * 0.4;
              ctx.fill();
            }
            ctx.globalAlpha = 1.0;
          } else {
            ctx.strokeStyle = thinking ? 'rgba(168, 199, 250, 0.5)' : highlightColor;
          }
          
          ctx.beginPath();
          ctx.moveTo(anchorPos.current.x, anchorPos.current.y);
          if (currentAimTarget) {
            ctx.lineTo(currentAimTarget.x, currentAimTarget.y);
          } else {
            ctx.lineTo(anchorPos.current.x, anchorPos.current.y - 200);
          }
          
          const time = performance.now();
          const dashOffset = (time / 15) % 30;
          ctx.setLineDash([20, 15]);
          ctx.lineDashOffset = -dashOffset;
          
          ctx.lineWidth = 4;
          ctx.stroke();
          
          if (currentAimTarget && !thinking) {
              // Impact Zone Pulse
              const impactPulse = Math.sin(performance.now() / 150) * 0.2 + 1;
              ctx.beginPath();
              ctx.arc(currentAimTarget.x, currentAimTarget.y, BUBBLE_RADIUS * impactPulse, 0, Math.PI * 2);
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = highlightColor;
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(currentAimTarget.x, currentAimTarget.y, BUBBLE_RADIUS, 0, Math.PI * 2);
              ctx.fillStyle = thinking ? 'rgba(168, 199, 250, 0.1)' : `${highlightColor}1A`; // 10% alpha hex
              ctx.fill();
          }
          
          ctx.restore();
      }
      
      // Removed Canvas "ANALYZING..." drawing code from here

      // --- ASSET VISUALIZATION: SLINGSHOT SKIN ---
      // Apply selected skin properties (color, glow, materials) to the slingshot UI
      const currentSkin = SKINS.find(s => s.id === selectedSkinId) || SKINS[0];
      const bandColor = isPinching.current ? currentSkin.color : 'rgba(255,255,255,0.4)';
      
      if (!isFlying.current) {
        ctx.save();
        ctx.shadowBlur = isPinching.current ? 15 : 0;
        ctx.shadowColor = currentSkin.glowColor;
        ctx.beginPath();
        ctx.moveTo(anchorPos.current.x - 35, anchorPos.current.y - 10);
        ctx.lineTo(ballPos.current.x, ballPos.current.y);
        ctx.lineWidth = 5;
        ctx.strokeStyle = bandColor;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Slingshot Ball
      ctx.save();
      if (slowTimeActive) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#42a5f5';
      }
      if (isLocked && !isFlying.current) {
          ctx.globalAlpha = 0.5;
      }
      
      // Add skin glow to current ball
      ctx.shadowBlur = 10;
      ctx.shadowColor = currentSkin.glowColor;
      
      drawBubble(ctx, ballPos.current.x, ballPos.current.y, BUBBLE_RADIUS, selectedColorRef.current);
      ctx.restore();

      // Slingshot Band (Front)
      if (!isFlying.current) {
        ctx.save();
        ctx.shadowBlur = isPinching.current ? 15 : 0;
        ctx.shadowColor = currentSkin.glowColor;
        ctx.beginPath();
        ctx.moveTo(ballPos.current.x, ballPos.current.y);
        ctx.lineTo(anchorPos.current.x + 35, anchorPos.current.y - 10);
        ctx.lineWidth = 5;
        ctx.strokeStyle = bandColor;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Slingshot Handle
      ctx.save();
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'black';
      ctx.beginPath();
      ctx.moveTo(anchorPos.current.x, canvas.height); 
      ctx.lineTo(anchorPos.current.x, anchorPos.current.y + 40); 
      ctx.lineTo(anchorPos.current.x - 40, anchorPos.current.y); 
      ctx.moveTo(anchorPos.current.x, anchorPos.current.y + 40);
      ctx.lineTo(anchorPos.current.x + 40, anchorPos.current.y); 
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.strokeStyle = currentSkin.id === 'default' ? '#616161' : currentSkin.color;
      ctx.stroke();
      ctx.restore();

      // Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
          if (p.life <= 0) particles.current.splice(i, 1);
          else {
              ctx.globalAlpha = p.life;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = p.color;
              ctx.fill();
              ctx.globalAlpha = 1.0;
          }
      }
      
      ctx.restore();

      // --- CAPTURE SCREENSHOT IF REQUESTED ---
      // We do this at the end of the render loop to ensure everything is drawn
      if (captureRequestRef.current) {
        captureRequestRef.current = false;
        
        // --- OPTIMIZATION: Resize & Compress Image before sending ---
        const offscreen = document.createElement('canvas');
        const targetWidth = 480; // Small width is sufficient for color/layout analysis
        const scale = Math.min(1, targetWidth / canvas.width);
        
        offscreen.width = canvas.width * scale;
        offscreen.height = canvas.height * scale;
        
        const oCtx = offscreen.getContext('2d');
        if (oCtx) {
            oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
            // Use JPEG at 0.6 quality for faster upload/processing
            const screenshot = offscreen.toDataURL("image/jpeg", 0.6);
            
            // Send to AI (non-blocking for render loop, but locks game logic)
            setTimeout(() => performAiAnalysis(screenshot), 0);
        }
      }
    };

    if (window.Hands) {
      hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      hands.onResults(onResults);
      if (window.Camera) {
        camera = new window.Camera(video, {
          onFrame: async () => {
            if (videoRef.current && hands) await hands.send({ image: videoRef.current });
          },
          width: 1280,
          height: 720,
        });
        camera.start();
      }
    }

    return () => {
        if (camera) camera.stop();
        if (hands) hands.close();
    };
  }, [initGrid]);

  const recColorConfig = aiRecommendedColor ? COLOR_CONFIG[aiRecommendedColor] : null;
  const borderColor = recColorConfig ? recColorConfig.hex : '#444746';

  return (
    <div className="flex w-full h-screen bg-[#121212] overflow-hidden font-sans text-[#e3e3e3]">
      
      {/* MOBILE/TABLET BLOCKER OVERLAY */}
      <div className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center p-8 text-center md:hidden">
         <Monitor className="w-16 h-16 text-[#ef5350] mb-6 animate-pulse" />
         <h2 className="text-2xl font-bold text-[#e3e3e3] mb-4">Desktop View Required</h2>
         <p className="text-[#c4c7c5] max-w-md text-lg leading-relaxed">
           This experience requires a larger screen for the webcam tracking and game mechanics.
         </p>
         <div className="mt-8 flex items-center gap-2 text-sm text-[#757575] uppercase tracking-wider font-bold">
           <div className="w-2 h-2 bg-[#42a5f5] rounded-full"></div>
           Please maximize window
         </div>
      </div>

      {/* Game Area */}
      <div ref={gameContainerRef} className="flex-1 relative h-full overflow-hidden">
        <video ref={videoRef} className="absolute hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* HUD: Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex flex-col gap-4 pointer-events-none">
          <div className="flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-2 pointer-events-auto">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={onBack}
                  className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span className="font-bold text-sm uppercase tracking-wider">Back</span>
                </motion.button>

                {/* Tactical Inventory - Always Visible */}
                <div className="mt-4 flex flex-col gap-2 relative">
                    {tutorialStep === 3 && (
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-x-0 -inset-y-2 border-2 border-orange-500/40 rounded-3xl pointer-events-none z-10"
                      />
                    )}
                    <div className="text-[10px] text-white/40 font-black uppercase tracking-widest px-2">Assets</div>
                    <div className="flex flex-col gap-2">
                      {inventory.length === 0 ? (
                        <div className="w-12 h-24 bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                           <span className="text-[8px] text-white/20 -rotate-90 whitespace-nowrap font-bold uppercase tracking-widest">Empty</span>
                        </div>
                      ) : (
                        <AnimatePresence>
                          {inventory.map((item) => (
                            <motion.button
                              key={item.id}
                              initial={{ x: -50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              exit={{ x: -20, opacity: 0 }}
                              whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                              onClick={() => activatePowerUp(item.type, item.id)}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shadow-lg ${
                                item.type === 'rowClear' ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' :
                                item.type === 'colorMatch' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' :
                                'bg-blue-500/20 border-blue-500/40 text-blue-400'
                              }`}
                              title={`Activate ${item.type}`}
                            >
                              <span className="text-xl">
                                {item.type === 'rowClear' ? '⚡' : item.type === 'colorMatch' ? '✨' : '⏲️'}
                              </span>
                            </motion.button>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                </div>
              </div>
              
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3 shrink-0"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase font-black spacing-widest">Mission Level</span>
                  <span className="text-xl font-black text-blue-400">0{level}</span>
                </div>
                <div className="h-8 w-[1px] bg-white/10 mx-1" />
                <div className="flex flex-col min-w-[120px]">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-white/40 uppercase font-black">Progress</span>
                    <span className="text-white/60">{score} / {targetPoints}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (score / targetPoints) * 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex gap-4 pointer-events-auto">
              <button
                onClick={() => setShowShop(true)}
                className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-4 py-2 rounded-2xl flex items-center gap-3 transition-colors group"
              >
                 <Palette className="text-blue-400 group-hover:scale-110 transition-transform" size={18} />
                 <div className="flex flex-col items-start translate-y-[1px]">
                   <span className="text-[8px] text-blue-400/60 uppercase font-black tracking-widest">Slingshot</span>
                   <span className="text-xs font-bold text-white uppercase tracking-tighter">Skins</span>
                 </div>
              </button>

              {timeLeft <= 20 && !gameOver && (
                 <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={buyTime}
                    className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-tighter shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                 >
                    <ShoppingBag size={14} />
                    Buy Time ({250 + (level * 100)})
                 </motion.button>
              )}

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                 <Clock className={`${timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`} size={18} />
                 <span className={`font-mono text-xl font-bold ${timeLeft < 15 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                 <Target className={`${shotsFired >= descentRate - 1 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`} size={18} />
                 <div className="flex flex-col">
                   <span className="text-[8px] text-white/40 uppercase font-black">Sync</span>
                   <span className="font-mono text-sm font-bold text-white">{descentRate - shotsFired}</span>
                 </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                 <Coins className="text-yellow-500" size={18} />
                 <span className="font-mono text-xl font-bold text-yellow-500">{coins.toLocaleString()}</span>
              </div>
             <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setDebugMode(!debugMode)}
                className={`pointer-events-auto flex items-center gap-2 bg-white/5 backdrop-blur-xl border px-4 py-2 rounded-2xl transition-colors ${debugMode ? 'border-purple-500 text-purple-400' : 'border-white/10 hover:bg-white/10'}`}
             >
                <Terminal size={18} />
                <span className="font-bold text-sm uppercase tracking-wider">Debug</span>
             </motion.button>

             <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-2xl flex items-center gap-3">
                <Trophy className="text-yellow-500" size={18} />
                <span className="font-mono text-xl font-bold">{score.toLocaleString()}</span>
             </div>
             
             {isMultiplayer && (
               <div className="bg-purple-500/20 backdrop-blur-xl border border-purple-500/40 px-6 py-2 rounded-2xl flex items-center gap-3">
                  <Users className="text-purple-400" size={18} />
                  <div>
                     <div className="text-[8px] font-black uppercase text-purple-400 tracking-[0.2em] -mb-1">Active Pilot</div>
                     <div className="font-mono text-sm font-bold text-white uppercase">{currentPlayerName}</div>
                  </div>
                  <div className="w-[1px] h-6 bg-white/10 ml-2" />
                  <div className="text-sm font-black text-purple-400">R{multiplayer?.currentRound}</div>
               </div>
             )}
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-2xl flex items-center gap-1 pointer-events-auto">
                {(['easy', 'moderate', 'hard'] as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setGameDifficulty(mode);
                      SoundEngine.play('shoot');
                      setAiHint(`Difficulty set to ${mode.toUpperCase()}`);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      gameDifficulty === mode 
                        ? (mode === 'easy' ? 'bg-green-500 text-black' : mode === 'hard' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white')
                        : 'text-white/40 hover:bg-white/5'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {showLevelUp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -50 }}
              className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
               <div className="bg-blue-500 text-white px-12 py-8 rounded-[48px] shadow-[0_0_50px_rgba(59,130,246,0.6)] flex flex-col items-center">
                  <Trophy size={48} className="mb-4" />
                  <h1 className="text-6xl font-black italic tracking-tighter uppercase">Level Up!</h1>
                  <p className="text-blue-100 font-bold uppercase tracking-widest mt-2">Entering Sector {level}</p>
               </div>
            </motion.div>
          )}

          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 20 }}
                className="bg-[#1a1033] border border-white/10 rounded-[64px] p-12 max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
              >
                {/* Tactical Corner accents */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-red-500/30 rounded-tl-[64px]" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-red-500/30 rounded-tr-[64px]" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-red-500/30 rounded-bl-[64px]" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-red-500/30 rounded-br-[64px]" />
                
                <div className="relative z-10">
                   <motion.div 
                     initial={{ rotate: -15, scale: 0.5 }}
                     animate={{ rotate: 0, scale: 1 }}
                     className="inline-flex p-8 rounded-[40px] bg-red-500/10 border border-red-500/20 text-red-500 mb-8 shadow-[0_0_40px_rgba(239,83,80,0.2)]"
                   >
                      <AlertTriangle size={64} strokeWidth={2.5} />
                   </motion.div>
                   
                   <h2 className="text-6xl font-black mb-1 uppercase tracking-tighter italic text-white leading-none">MISSION OVER</h2>
                   <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] italic mb-12">Operations Ceased • System Disconnected</p>

                   <div className="space-y-6 mb-12">
                      <div className="bg-white/5 rounded-[40px] p-10 border border-white/5 relative group overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         
                         <div className="relative z-10 space-y-8">
                            <div>
                               <div className="text-[10px] text-white/20 uppercase font-black tracking-[0.3em] mb-4">Final Strategic Score</div>
                               <div className="text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                 {score.toLocaleString()}
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                               <div className="h-[1px] flex-1 bg-white/5" />
                               <div className="text-[10px] font-black text-white/10 uppercase tracking-widest italic">Section Report</div>
                               <div className="h-[1px] flex-1 bg-white/5" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                               <div className="text-left">
                                  <div className="text-[9px] text-white/20 uppercase font-bold tracking-widest mb-1">Combat Depth</div>
                                  <div className="text-2xl font-mono font-black text-white italic">LVL {level}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] text-white/20 uppercase font-bold tracking-widest mb-1">Target Sector</div>
                                  <div className="text-2xl font-mono font-black text-white/40 italic">Sect {level + 1}</div>
                                </div>
                            </div>
                         </div>
                      </div>

                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        onAnimationComplete={() => {
                           const newCoins = Array.from({ length: 25 }).map((_, i) => ({
                             id: Date.now() + i,
                             startX: window.innerWidth / 2,
                             startY: window.innerHeight / 2
                           }));
                           setFlyingCoins(prev => [...prev, ...newCoins]);
                           setTimeout(() => setFlyingCoins([]), 2000);
                        }}
                        className="bg-yellow-500/10 border border-yellow-500/20 rounded-[32px] p-8 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                           <div className="bg-yellow-500 p-3 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                              <Coins size={24} className="text-black" />
                           </div>
                           <div className="text-left">
                              <div className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">Rewards Claimed</div>
                              <div className="text-white font-bold text-sm uppercase">Galactic Credits</div>
                           </div>
                        </div>
                        <div className="text-3xl font-mono font-black text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">+{Math.floor(score / 5).toLocaleString()}</div>
                      </motion.div>
                   </div>

                   {isMultiplayer ? (
                     <button
                       onClick={handleNextMultiplayerTurn}
                       className="w-full py-7 rounded-[32px] bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-[0.3em] text-sm shadow-[0_20px_40px_rgba(168,85,247,0.3)] transition-all mb-4 active:scale-95 group relative overflow-hidden"
                     >
                       <span className="relative z-10">Deploy Next Pilot</span>
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                     </button>
                   ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <button
                         onClick={() => {
                           setGameOver(false);
                           scoreRef.current = 0;
                           setScore(0);
                           initGrid(gameContainerRef.current?.clientWidth || 1000);
                           SoundEngine.play('shoot');
                         }}
                         className="py-6 bg-white text-black rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-50 transition-all active:scale-95 shadow-[0_15px_30px_rgba(255,255,255,0.2)]"
                       >
                         Retry Mission
                       </button>
                       <button
                         onClick={onBack}
                         className="py-6 bg-white/5 border border-white/10 rounded-[32px] font-black uppercase tracking-[0.2em] text-xs text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                       >
                         Return to Hub
                       </button>
                     </div>
                   )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Multiplayer Duel Result */}
        <AnimatePresence>
          {multiplayerGameOver && multiplayer && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-[100] bg-[#0a0502]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
             >
               <motion.div
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-white/5 border border-white/10 rounded-[64px] p-16 max-w-2xl w-full backdrop-blur-3xl shadow-2xl relative"
               >
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                   <div className="relative">
                      <div className="bg-yellow-500 p-8 rounded-full shadow-[0_0_50px_rgba(234,179,8,0.5)]">
                        <Trophy size={60} className="text-black" />
                      </div>
                      <motion.div 
                         animate={{ scale: [1, 1.2, 1] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="absolute -top-2 -right-2 bg-purple-500 p-3 rounded-full border-4 border-[#0a0502]"
                       >
                         <Users size={20} className="text-white" />
                      </motion.div>
                   </div>
                 </div>

                 <h2 className="text-5xl font-black mb-12 mt-4 uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Duel Complete</h2>
                 
                 <div className="grid grid-cols-2 gap-8 mb-12">
                    <div className={`p-8 rounded-[40px] border transition-all ${multiplayer.player1.totalScore > multiplayer.player2.totalScore ? 'bg-purple-500/20 border-purple-500/50 scale-105' : 'bg-white/5 border-white/10 opacity-50'}`}>
                       <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black mb-4">{multiplayer.player1.name}</div>
                       <div className="text-4xl font-mono font-black text-white mb-2">{multiplayer.player1.totalScore.toLocaleString()}</div>
                       {multiplayer.player1.totalScore > multiplayer.player2.totalScore && (
                          <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mt-4">Champion</div>
                       )}
                    </div>
                    <div className={`p-8 rounded-[40px] border transition-all ${multiplayer.player2.totalScore > multiplayer.player1.totalScore ? 'bg-purple-500/20 border-purple-500/50 scale-105' : 'bg-white/5 border-white/10 opacity-50'}`}>
                       <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black mb-4">{multiplayer.player2.name}</div>
                       <div className="text-4xl font-mono font-black text-white mb-2">{multiplayer.player2.totalScore.toLocaleString()}</div>
                       {multiplayer.player2.totalScore > multiplayer.player1.totalScore && (
                          <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mt-4">Champion</div>
                       )}
                    </div>
                 </div>

                 <div className="bg-white/5 rounded-3xl p-8 mb-12 text-left space-y-4">
                    <div className="text-[10px] text-white/20 uppercase font-black tracking-widest px-4">Round Breakdown</div>
                    <div className="flex justify-between items-center px-4 mb-2">
                       <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Index</span>
                       <div className="flex gap-16 font-mono text-[10px] font-black uppercase text-white/40 tracking-widest">
                          <span className="w-24 text-right">Pilot 01</span>
                          <span className="w-24 text-right">Pilot 02</span>
                       </div>
                    </div>
                    {[0, 1, 2].map(idx => (
                       <div key={idx} className="flex justify-between items-center bg-white/5 rounded-2xl px-8 py-5">
                          <span className="text-xs font-black text-white/20 italic tracking-widest uppercase">Round 0{idx + 1}</span>
                          <div className="flex gap-16 font-mono text-sm font-black">
                             <span className={`w-24 text-right ${multiplayer.player1.scores[idx] > (multiplayer.player2.scores[idx] || 0) ? 'text-purple-400' : (multiplayer.player1.scores[idx] !== undefined ? 'text-white' : 'text-white/10')}`}>
                                {multiplayer.player1.scores[idx] !== undefined ? multiplayer.player1.scores[idx].toLocaleString() : '---'}
                             </span>
                             <span className={`w-24 text-right ${multiplayer.player2.scores[idx] > (multiplayer.player1.scores[idx] || 0) ? 'text-purple-400' : (multiplayer.player2.scores[idx] !== undefined ? 'text-white' : 'text-white/10')}`}>
                                {multiplayer.player2.scores[idx] !== undefined ? multiplayer.player2.scores[idx].toLocaleString() : '---'}
                             </span>
                          </div>
                       </div>
                    ))}
                 </div>

                 <button
                   onClick={onBack}
                   className="w-full py-6 rounded-[32px] bg-white text-black font-black uppercase tracking-[0.2em] text-sm hover:bg-white/90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                 >
                   Return to Command Center
                 </button>
               </motion.div>
             </motion.div>
          )}
        </AnimatePresence>
        
        {/* Loading Overlay */}
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#121212] z-50">
            <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-[#42a5f5] animate-spin mb-4" />
                <p className="text-[#e3e3e3] text-lg font-medium">Starting Engine...</p>
            </div>
            </div>
        )}

        {/* Analyzing Overlay - positioned at Slingshot Anchor */}
        {isAiThinking && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{ bottom: '220px', transform: 'translate(-50%, 50%)' }}
          >
             <div className="w-[72px] h-[72px] rounded-full border-4 border-t-[#a8c7fa] border-r-[#a8c7fa] border-b-transparent border-l-transparent animate-spin" />
             <p className="mt-4 text-[#a8c7fa] font-black text-[10px] tracking-[0.3em] animate-pulse uppercase italic">Analyzing battlefield...</p>
          </div>
        )}

        {/* HUD: Color Picker */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-[#1e1e1e] px-6 py-4 rounded-[32px] border border-[#444746] shadow-2xl flex items-center gap-4">
                <p className="text-xs text-[#c4c7c5] uppercase font-bold tracking-wider mr-2 hidden md:block">Select Color</p>
                {availableColors.length === 0 ? (
                    <p className="text-sm text-gray-500">No ammo</p>
                ) : (
                    COLOR_KEYS.filter(c => availableColors.includes(c)).map(color => {
                        const isSelected = selectedColor === color;
                        const isRecommended = aiRecommendedColor === color;
                        const config = COLOR_CONFIG[color];
                        
                        return (
                            <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={`relative w-14 h-14 rounded-full transition-all duration-300 transform flex items-center justify-center
                                    ${isSelected ? 'scale-110 ring-4 ring-white/50 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'}
                                `}
                                style={{ 
                                    background: `radial-gradient(circle at 35% 35%, ${config.hex}, ${adjustColor(config.hex, -60)})`,
                                    boxShadow: isSelected 
                                        ? `0 0 20px ${config.hex}, inset 0 -4px 4px rgba(0,0,0,0.3)`
                                        : '0 4px 6px rgba(0,0,0,0.3), inset 0 -4px 4px rgba(0,0,0,0.3)'
                                }}
                            >
                                {/* Glossy highlight for button */}
                                <div className="absolute top-2 left-3 w-4 h-2 bg-white/40 rounded-full transform -rotate-45 filter blur-[1px]" />
                                
                                {isRecommended && !isSelected && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black text-[10px] font-bold flex items-center justify-center rounded-full animate-bounce shadow-md">!</span>
                                )}
                                {isSelected && (
                                    <MousePointerClick className="w-6 h-6 text-white/90 drop-shadow-md" />
                                )}
                            </button>
                        )
                    })
                )}
            </div>
        </div>

        {/* Bottom Tip */}
        {!isPinching.current && !isFlying.current && !isAiThinking && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-50">
                <div className="flex items-center gap-2 bg-[#1e1e1e]/90 px-4 py-2 rounded-full border border-[#444746] backdrop-blur-sm">
                    <Play className="w-3 h-3 text-[#42a5f5] fill-current" />
                    <p className="text-[#e3e3e3] text-xs font-medium">Pinch & Pull to Shoot</p>
                </div>
            </div>
        )}
      </div>

      {/* RIGHT: Debug Panel */}
      {debugMode && (
        <div className="w-[380px] bg-[#1e1e1e] border-l border-[#444746] flex flex-col h-full overflow-hidden shadow-2xl relative z-[100]">
          {/* ... panel content ... */}
        
        {/* FLASH STRATEGY SECTION - PROMINENT */}
        <div 
            className="p-5 border-b-4 transition-colors duration-500 flex flex-col gap-2"
            style={{ 
                backgroundColor: '#252525',
                borderColor: borderColor
            }}
        >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5" style={{ color: borderColor }} />
                    <h2 className="font-bold text-sm tracking-widest uppercase" style={{ color: borderColor }}>
                        Flash Strategy
                    </h2>
                </div>
                {isAiThinking && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}
             </div>
             
             <p className="text-[#e3e3e3] text-sm leading-relaxed font-bold">
                {aiHint}
             </p>
             
             {aiRationale && (
                 <div className="flex flex-col gap-3 mt-1">
                     <div className="flex gap-2">
                        <Lightbulb className="w-4 h-4 text-[#a8c7fa] shrink-0 mt-0.5" />
                        <p className="text-[#a8c7fa] text-xs italic opacity-90 leading-tight">
                            {aiRationale}
                        </p>
                     </div>
                     
                     {aiRecommendedTarget && (
                        <div className="mt-2 flex flex-col gap-2">
                           <div className="flex items-center gap-3">
                              <button 
                                onClick={() => {
                                    setIsLockedOn(!isLockedOn);
                                    SoundEngine.play('match');
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isLockedOn 
                                    ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                                    : 'bg-white/10 text-white/60 hover:bg-white/20 whitespace-nowrap'
                                }`}
                              >
                                {isLockedOn ? 'TARGET LOCKED' : 'LOCK ON [L]'}
                              </button>
                              {isLockedOn && (
                                  <motion.div 
                                    animate={{ opacity: [0, 1, 0] }} 
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="flex items-center gap-2"
                                  >
                                     <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                     <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter animate-pulse">Confirmed</span>
                                  </motion.div>
                              )}
                           </div>

                           {!isLockedOn && recommendationTimestamp && (
                               <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                  <motion.div 
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: 5, ease: "linear" }}
                                    className="h-full bg-blue-400/50"
                                  />
                               </div>
                           )}
                        </div>
                     )}
                 </div>
             )}
             
             {aiRecommendedColor && (
                <div className="flex items-center gap-2 mt-3 bg-black/20 p-2 rounded">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Rec. Color:</span>
                    <span className="text-xs font-bold uppercase" style={{ color: COLOR_CONFIG[aiRecommendedColor].hex }}>
                        {COLOR_CONFIG[aiRecommendedColor].label}
                    </span>
                </div>
             )}
        </div>

        {/* DEBUG HEADER */}
        <div className="p-3 border-b border-[#444746] bg-[#1e1e1e] flex items-center gap-2 text-[#757575]">
            <Terminal className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Debugger</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Status Section */}
            <div>
                <div className="flex items-center gap-2 mb-2 text-[#c4c7c5] text-xs font-bold uppercase tracking-wider">
                    <BrainCircuit className="w-3 h-3" /> Status
                </div>
                <div className={`p-3 rounded-lg border ${isAiThinking ? 'bg-[#a8c7fa]/10 border-[#a8c7fa]/30 text-[#a8c7fa]' : 'bg-[#444746]/20 border-[#444746]/50 text-[#c4c7c5]'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isAiThinking ? 'bg-[#a8c7fa] animate-pulse' : 'bg-[#66bb6a]'}`} />
                        <span className="text-sm font-mono">{isAiThinking ? 'Processing Vision...' : 'Waiting for Input'}</span>
                    </div>
                </div>
            </div>

            {/* Vision Input */}
            {debugInfo?.screenshotBase64 && (
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[#c4c7c5] text-xs font-bold uppercase tracking-wider">
                        <Eye className="w-3 h-3" /> Vision Input
                    </div>
                    <div className="rounded-lg overflow-hidden border border-[#444746] bg-black/50 relative group">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={debugInfo.screenshotBase64} alt="AI Vision" className="w-full h-auto opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-[10px] text-center text-gray-400 font-mono">
                            Sent to gemini-3-flash
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Context */}
            {debugInfo?.promptContext && (
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[#c4c7c5] text-xs font-bold uppercase tracking-wider">
                        <Terminal className="w-3 h-3" /> Prompt Context
                    </div>
                    <div className="bg-[#121212] p-3 rounded-lg border border-[#444746] font-mono text-[10px] text-gray-400 h-32 overflow-y-auto whitespace-pre-wrap leading-tight">
                        {debugInfo.promptContext}
                    </div>
                </div>
            )}

            {/* AI Output Stats */}
            {debugInfo && (
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[#c4c7c5] text-xs font-bold uppercase tracking-wider">
                        <BrainCircuit className="w-3 h-3" /> AI Output
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                         <div className="bg-[#2a2a2a] p-2 rounded border border-[#444746]">
                            <p className="text-[10px] text-gray-500 mb-1">Latency</p>
                            <div className="flex items-center gap-1 text-[#a8c7fa] font-mono font-bold">
                                {debugInfo.latency}ms
                            </div>
                         </div>
                         <div className="bg-[#2a2a2a] p-2 rounded border border-[#444746]">
                            <p className="text-[10px] text-gray-500 mb-1">Rec. Color</p>
                            <div className="flex items-center gap-1 text-[#e3e3e3] font-mono font-bold capitalize">
                                {debugInfo.parsedResponse?.recommendedColor || '--'}
                            </div>
                         </div>
                    </div>

                    {debugInfo.error && (
                         <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 p-3 rounded-lg mb-3">
                            <div className="flex items-start gap-2 text-[#ef5350]">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold">PARSE ERROR DETAILS</p>
                                    <p className="text-[10px] font-mono mt-1 break-all">{debugInfo.error}</p>
                                </div>
                            </div>
                         </div>
                    )}

                    <p className="text-[10px] text-gray-500 mb-1">Raw Response Text</p>
                    <div className="bg-[#121212] p-3 rounded-lg border border-[#444746] font-mono text-[11px] text-[#66bb6a] max-h-40 overflow-y-auto whitespace-pre-wrap mb-3 border-l-2 border-l-[#66bb6a]">
                        {debugInfo.rawResponse}
                    </div>

                    <p className="text-[10px] text-gray-500 mb-1">Parsed JSON</p>
                    <div className="bg-[#121212] p-3 rounded-lg border border-[#444746] font-mono text-[10px] text-[#a8c7fa] overflow-x-auto">
                        <pre>{JSON.stringify(debugInfo.parsedResponse || { error: "Failed to parse" }, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
        
        <div className="p-3 bg-[#252525] border-t border-[#444746] text-center">
            <p className="text-[10px] text-gray-500 font-medium">Powered by Google Gemini 3 Flash</p>
        </div>
      </div>
      )}
      {/* Slingshot Highlight */}
      {(tutorialStep === 0 || tutorialStep === 1) && (
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ 
              left: anchorPos.current.x, 
              top: anchorPos.current.y,
              transform: 'translate(-50%, -50%)'
            }}
            className="fixed w-32 h-32 rounded-full border-4 border-blue-500/40 pointer-events-none z-50 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
          />
      )}

      {/* Grid Highlight */}
      {tutorialStep === 2 && (
          <motion.div 
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="fixed top-0 left-0 right-0 h-[400px] border-b-4 border-blue-500/20 bg-blue-500/5 pointer-events-none z-50"
          />
      )}

      {/* Flying Coins Layer */}
      <div className="fixed inset-0 pointer-events-none z-[200]">
        <AnimatePresence>
          {flyingCoins.map((coin, index) => (
            <motion.div
              key={coin.id}
              initial={{ 
                x: coin.startX, 
                y: coin.startY, 
                scale: 0,
                rotate: 0 
              }}
              animate={{ 
                x: [coin.startX, coin.startX + (Math.random() - 0.5) * 200, window.innerWidth - 300],
                y: [coin.startY, coin.startY - 150, window.innerHeight - 80],
                scale: [0, 1.5, 0.8, 0],
                rotate: 720,
              }}
              transition={{ 
                duration: 1.2, 
                delay: index * 0.05,
                ease: "easeOut" 
              }}
              className="absolute w-8 h-8 rounded-full bg-yellow-500 border-2 border-yellow-200 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.5)]"
            >
              <Coins size={16} className="text-black" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Tutorial Overlay */}
      <AnimatePresence>
        {tutorialStep !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 pointer-events-auto"
          >
            <div className="max-w-xl w-full bg-[#1a1a1a] border border-white/10 rounded-[40px] p-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20">
                <motion.div 
                  className="h-full bg-blue-500" 
                  initial={{ width: "0%" }}
                  animate={{ width: `${((tutorialStep + 1) / 4) * 100}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/40">
                    <Target className="text-blue-400" size={20} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-widest text-white">Tactical Directive</h3>
                </div>
                <button 
                  onClick={() => {
                    localStorage.setItem('gemine_tutorial_v1', 'done');
                    setTutorialStep(null);
                  }}
                  className="text-white/20 hover:text-white transition-colors uppercase text-[10px] font-bold tracking-[0.2em]"
                >
                  Skip Briefing
                </button>
              </div>

              <div className="space-y-6">
                {tutorialStep === 0 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <h4 className="text-2xl font-black text-white mb-2">Phase 1: CALIBRATION</h4>
                    <p className="text-white/60 leading-relaxed">
                      Move your hand in front of the camera. The blue tracking circle represents your strike vector. Position it over the projectile and <span className="text-blue-400 font-bold">PINCH</span> your thumb and index finger to grab.
                    </p>
                  </motion.div>
                )}
                {tutorialStep === 1 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <h4 className="text-2xl font-black text-white mb-2">Phase 2: EXECUTION</h4>
                    <p className="text-white/60 leading-relaxed">
                      Pull back while pinching to stretch the energy bands. The <span className="text-white font-bold">PREDICTIVE ARC</span> shows your trajectory. Release your pinch to launch the pulse into the battlefield.
                    </p>
                  </motion.div>
                )}
                {tutorialStep === 2 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <h4 className="text-2xl font-black text-white mb-2">Phase 3: CHAIN REACTION</h4>
                    <p className="text-white/60 leading-relaxed">
                      Match <span className="text-blue-400 font-bold italic underline">3 or more</span> bubbles of the same color to neutralize the sector. Clearing large clusters earns massive score multipliers and energy credits.
                    </p>
                  </motion.div>
                )}
                {tutorialStep === 3 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <h4 className="text-2xl font-black text-white mb-2">Phase 4: TACTICAL ASSETS</h4>
                    <p className="text-white/60 leading-relaxed">
                      Big chains drop <span className="text-orange-400 font-bold">Assets</span> in your inventory. Use the side panel to activate Orbital Strikes (⚡), Chameleon Pulses (✨), or Chronos Flux (⏲️) to dominate the field.
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="mt-12 flex items-center justify-end gap-4">
                {tutorialStep > 0 && (
                  <button 
                    onClick={() => setTutorialStep(prev => prev! - 1)}
                    className="px-8 py-4 rounded-2xl border border-white/5 text-white/40 font-black uppercase text-[10px] tracking-widest hover:border-white/20 transition-all"
                  >
                    Previous
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (tutorialStep === 3) {
                      localStorage.setItem('gemine_tutorial_v1', 'done');
                      setTutorialStep(null);
                    } else {
                      setTutorialStep(prev => prev! + 1);
                    }
                  }}
                  className="px-8 py-4 rounded-2xl bg-blue-600 border border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] text-white font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all"
                >
                  {tutorialStep === 3 ? "Initialize Combat" : "Understood"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Daily Reward Toast */}
      <AnimatePresence>
        {dailyRewardMessage && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[400] bg-blue-600 border border-white/20 px-8 py-4 rounded-[30px] shadow-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Award className="text-white" size={24} />
            </div>
            <div className="flex flex-col">
               <span className="text-white font-black uppercase tracking-widest leading-none mb-1">Combat Bonus</span>
               <span className="text-white/80 text-sm font-bold">{dailyRewardMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Modal */}
      <AnimatePresence>
        {showShop && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 pointer-events-auto"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="w-full max-w-4xl bg-[#0c0c14] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col"
             >
               {/* Header */}
               <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                       <Palette size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-widest">Tactical Armory</h2>
                      <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.3em]">Configure Slingshot Combat Profile</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="bg-white/5 px-4 py-2 rounded-xl flex items-center gap-3 border border-white/5">
                       <Coins className="text-yellow-500" size={16} />
                       <span className="font-mono font-bold text-white tracking-widest">{coins.toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => setShowShop(false)}
                      className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                      <X size={28} />
                    </button>
                  </div>
               </div>

               {/* Skins Grid */}
               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SKINS.map((skin) => {
                      const isOwned = ownedSkins.includes(skin.id);
                      const isSelected = selectedSkinId === skin.id;
                      
                      return (
                        <motion.div 
                          key={skin.id}
                          whileHover={{ y: -4 }}
                          className={`relative p-6 rounded-3xl border transition-all ${
                            isSelected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div 
                            className="w-full h-32 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden"
                            style={{ backgroundColor: `${skin.color}11` }}
                          >
                             {/* Preview Slingshot */}
                             <div className="flex items-center gap-2">
                               <div className="w-32 h-1 bg-white/10 rounded-full relative">
                                  <div 
                                    className="absolute inset-0 rounded-full blur-sm"
                                    style={{ backgroundColor: skin.color }}
                                  />
                                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-8 h-8 rounded-full border-4 flex items-center justify-center bg-[#0c0c14]" style={{ borderColor: skin.color }}>
                                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: skin.color }} />
                                  </div>
                               </div>
                             </div>

                             {skin.rarity === 'legendary' && (
                               <div className="absolute top-2 right-2">
                                 <Sparkles size={16} className="text-yellow-400 animate-pulse" />
                               </div>
                             )}
                          </div>

                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-black text-white uppercase tracking-wider text-sm">{skin.name}</h3>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                skin.rarity === 'common' ? 'bg-white/10 text-white/40' :
                                skin.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                                skin.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {skin.rarity}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">
                              {skin.description}
                            </p>
                          </div>

                          {isOwned ? (
                             <button
                               onClick={() => {
                                 setSelectedSkinId(skin.id);
                                 ScoreService.selectSkin(skin.id);
                               }}
                               className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 ${
                                 isSelected 
                                 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                 : 'bg-white/5 text-white/60 hover:bg-white/10'
                               }`}
                             >
                               {isSelected ? <><Check size={14} /> Selected</> : 'Select Asset'}
                             </button>
                          ) : (
                             <button
                               onClick={async () => {
                                 const success = await ScoreService.buySkin(skin.id);
                                 if (success) {
                                   setOwnedSkins(prev => [...prev, skin.id]);
                                   setCoins(prev => prev - skin.cost);
                                   SoundEngine.play('powerup');
                                 }
                               }}
                               disabled={coins < skin.cost}
                               className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 ${
                                 coins >= skin.cost 
                                 ? 'bg-yellow-600 text-white hover:bg-yellow-500' 
                                 : 'bg-white/5 text-white/20 cursor-not-allowed'
                               }`}
                             >
                               <Coins size={14} /> {skin.cost} Coins
                             </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
               </div>
               
               <div className="p-6 bg-blue-500/5 border-t border-white/5 flex items-center justify-center">
                  <p className="text-[10px] text-blue-400/60 font-medium uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck size={12} /> Secure Armory Sync Active
                  </p>
               </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GeminiSlingshot;