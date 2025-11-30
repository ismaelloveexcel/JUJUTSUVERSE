import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, Skull, Zap, Hand, Globe, Play, Square, User, Pause, Trophy, Star, Flame, Keyboard, Target, Shield, AlertTriangle, Radar, Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface Spirit {
  id: number;
  type: "grade4" | "grade3" | "grade2" | "grade1" | "special";
  x: number;
  y: number;
  emoji: string;
  hp: number;
  maxHp: number;
  expReward: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface BattleLogEntry {
  id: number;
  message: string;
  tone: "info" | "success" | "danger";
}

type Character = "yuji" | "gojo" | "megumi" | "nobara";

// Spirit configurations by grade
const spiritConfigs = {
  grade4: { emoji: "👻", hp: 80, expReward: 10, spawnWeight: 40 },
  grade3: { emoji: "🕷️", hp: 120, expReward: 20, spawnWeight: 30 },
  grade2: { emoji: "🐍", hp: 200, expReward: 40, spawnWeight: 15 },
  grade1: { emoji: "👹", hp: 350, expReward: 80, spawnWeight: 10 },
  special: { emoji: "🐲", hp: 600, expReward: 150, spawnWeight: 5 },
};

// Calculate sorcerer grade based on experience
const calculateGrade = (exp: number): string => {
  if (exp >= 5000) return "Special Grade";
  if (exp >= 2000) return "Grade 1 Sorcerer";
  if (exp >= 800) return "Semi-Grade 1";
  if (exp >= 300) return "Grade 2 Sorcerer";
  if (exp >= 100) return "Grade 3 Sorcerer";
  return "Grade 4 Sorcerer";
};

export default function Game() {
  // Game State
  const [character, setCharacter] = useState<Character>("yuji");
  const [cursedEnergy, setCursedEnergy] = useState(150);
  const [maxCursedEnergy, setMaxCursedEnergy] = useState(200);
  const [steps, setSteps] = useState(1247);
  const [cursesDefeated, setCursesDefeated] = useState(3);
  const [experience, setExperience] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highestCombo, setHighestCombo] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [spirits, setSpirits] = useState<Spirit[]>([]);
  const [domainActive, setDomainActive] = useState(false);
  const [blackFlashActive, setBlackFlashActive] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [selectedSpiritId, setSelectedSpiritId] = useState<number | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([
    { id: Date.now(), message: "Welcome to the JujutsuVerse. Keep your guard up.", tone: "info" },
  ]);

  // Refs
  const trainingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const spiritSpawnInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameWorldRef = useRef<HTMLDivElement>(null);

  // Character Config
  const charConfig = {
    yuji: {
      name: "YUJI ITADORI",
      color: "text-red-500",
      bgGradient: "from-red-900 to-red-600",
      avatar: "🥊",
      techniqueName: "Divergent Fist",
      domainName: "Malevolent Shrine",
      passiveDesc: "Higher Black Flash chance",
      baseDamage: 55,
      critMultiplier: 3.0,
      glowColor: "#ef4444",
      domainClass: "bg-red-900/40",
    },
    gojo: {
      name: "SATORU GOJO",
      color: "text-cyan-400",
      bgGradient: "from-blue-900 to-cyan-600",
      avatar: "🤞",
      techniqueName: "Red",
      domainName: "Unlimited Void",
      passiveDesc: "Infinity reduces energy cost",
      baseDamage: 70,
      critMultiplier: 2.5,
      glowColor: "#00ffff",
      domainClass: "bg-white/20 mix-blend-overlay",
    },
    megumi: {
      name: "MEGUMI FUSHIGURO",
      color: "text-purple-400",
      bgGradient: "from-purple-900 to-indigo-600",
      avatar: "🐺",
      techniqueName: "Divine Dog",
      domainName: "Chimera Shadow Garden",
      passiveDesc: "Summons deal extra damage",
      baseDamage: 50,
      critMultiplier: 2.8,
      glowColor: "#8b5cf6",
      domainClass: "bg-purple-900/50",
    },
    nobara: {
      name: "NOBARA KUGISAKI",
      color: "text-orange-400",
      bgGradient: "from-orange-800 to-amber-500",
      avatar: "🔨",
      techniqueName: "Hairpin",
      domainName: "Resonance",
      passiveDesc: "Attacks cause bleeding",
      baseDamage: 60,
      critMultiplier: 2.6,
      glowColor: "#f59e0b",
      domainClass: "bg-orange-900/40",
    },
  };

  // Calculate current grade based on experience
  const currentGrade = calculateGrade(experience);

  const logEvent = useCallback(
    (message: string, tone: BattleLogEntry["tone"] = "info") => {
      setBattleLog((prev) => {
        const next = [{ id: Date.now() + Math.random(), message, tone }, ...prev];
        return next.slice(0, 5);
      });
    },
    []
  );

  const techniqueCost = character === "gojo" ? 32 : 40;
  const energyPercent = useMemo(() => Math.round((cursedEnergy / maxCursedEnergy) * 100), [cursedEnergy, maxCursedEnergy]);
  const expProgressPercent = useMemo(() => Math.min(((experience % 500) / 500) * 100, 100), [experience]);
  const comboHeat = useMemo(() => Math.min(combo / 15, 1), [combo]);
  const spiritPressure = useMemo(() => Math.min(spirits.length / 8, 1), [spirits.length]);
  const threatLevel = useMemo(() => Math.min(comboHeat * 0.6 + spiritPressure * 0.8 + (domainActive ? 0.3 : 0), 1), [comboHeat, spiritPressure, domainActive]);
  const threatLabel = threatLevel > 0.75 ? "Critical" : threatLevel > 0.4 ? "Alert" : "Stable";
  const domainReady = cursedEnergy >= 80;
  const techniqueReady = cursedEnergy >= techniqueCost;
  const pendingDomainEnergy = Math.max(0, 80 - Math.floor(cursedEnergy));
  const pendingTechniqueEnergy = Math.max(0, techniqueCost - Math.floor(cursedEnergy));
  const threatPercent = Math.round(threatLevel * 100);
  const comboHeatPercent = Math.round(comboHeat * 100);
  const targetSpirit = useMemo(() => {
    if (spirits.length === 0) return null;
    if (selectedSpiritId) {
      const selected = spirits.find((s) => s.id === selectedSpiritId);
      if (selected) {
        return selected;
      }
    }
    let closest = spirits[0];
    let minDist = Infinity;
    spirits.forEach((spirit) => {
      const dist = Math.hypot(spirit.x - playerPos.x, spirit.y - playerPos.y);
      if (dist < minDist) {
        minDist = dist;
        closest = spirit;
      }
    });
    return closest;
  }, [spirits, selectedSpiritId, playerPos]);
  const pointerAngle = useMemo(() => {
    if (!targetSpirit) return 0;
    return (Math.atan2(targetSpirit.y - playerPos.y, targetSpirit.x - playerPos.x) * 180) / Math.PI;
  }, [targetSpirit, playerPos]);
  const worldBackground = useMemo(() => {
    const heatColor = `rgba(239, 68, 68, ${0.2 + comboHeat * 0.4})`;
    const pressureColor = `rgba(14, 165, 233, ${0.15 + spiritPressure * 0.35})`;
    const glowColor = `${currentConfig.glowColor}33`;
    return `
      radial-gradient(circle at ${30 + comboHeat * 40}% ${60 - spiritPressure * 30}%, ${heatColor}, transparent 55%),
      radial-gradient(circle at ${70 - comboHeat * 20}% ${30 + spiritPressure * 30}%, ${pressureColor}, transparent 60%),
      radial-gradient(circle at center, ${glowColor}, transparent 65%),
      rgba(0,0,0,0.65)
    `;
  }, [comboHeat, spiritPressure, currentConfig.glowColor]);
  const toneClasses: Record<BattleLogEntry["tone"], string> = {
    info: "border-white/10 text-gray-200",
    success: "border-emerald-500/30 text-emerald-200",
    danger: "border-red-500/30 text-red-200",
  };
  const clampRadarCoord = (value: number) => Math.min(95, Math.max(5, value));

  // Helper: Add Floating Text
  const addFloatingText = useCallback((x: number, y: number, text: string, color: string = "text-white", isCrit: boolean = false) => {
    const newText: FloatingText = {
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      color,
      scale: isCrit ? 2 : 1,
    };
    setFloatingTexts(prev => [...prev, newText]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== newText.id));
    }, 1000);
  }, []);

  // Helper: Add Particles
  const addParticles = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Date.now() + Math.random() + i,
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        color,
        size: Math.random() * 8 + 4,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 800);
  }, []);

  // Helper: Trigger Screen Shake
  const triggerShake = (intensity: number) => {
    setShake(intensity);
    setTimeout(() => setShake(0), 200);
  };

  // Training Logic
  const toggleTraining = useCallback(() => {
    if (isTraining) {
      setIsTraining(false);
      if (trainingInterval.current) clearInterval(trainingInterval.current);
      toast({ title: "Training Stopped" });
      logEvent("Training halted. Movement focus only.", "info");
    } else {
      setIsTraining(true);
      toast({ title: "Training Started", description: "Regenerating Cursed Energy..." });
      logEvent("Training engaged. Energy regeneration increased.", "success");
      trainingInterval.current = setInterval(() => {
        setSteps((prev) => prev + 10);
        setCursedEnergy((prev) => Math.min(prev + 10, maxCursedEnergy));
      }, 1000);
    }
  }, [isTraining, maxCursedEnergy, logEvent]);

  // Toggle Pause
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    toast({ 
      title: isPaused ? "Game Resumed" : "Game Paused",
      description: isPaused ? "Keep fighting!" : "Press P or ESC to resume"
    });
    logEvent(isPaused ? "Combat focus restored." : "Combat paused.", isPaused ? "success" : "info");
  }, [isPaused, logEvent]);

  // Spawn a random spirit based on weights
  const spawnSpirit = useCallback(() => {
    if (isPaused || spirits.length >= 8) return;

    const totalWeight = Object.values(spiritConfigs).reduce((sum, s) => sum + s.spawnWeight, 0);
    let random = Math.random() * totalWeight;
    let selectedType: keyof typeof spiritConfigs = "grade4";

    for (const [type, config] of Object.entries(spiritConfigs)) {
      random -= config.spawnWeight;
      if (random <= 0) {
        selectedType = type as keyof typeof spiritConfigs;
        break;
      }
    }

    const config = spiritConfigs[selectedType];
    const newSpirit: Spirit = {
      id: Date.now() + Math.random(),
      type: selectedType,
      x: Math.random() * 75 + 10,
      y: Math.random() * 75 + 10,
      emoji: config.emoji,
      hp: config.hp,
      maxHp: config.hp,
      expReward: config.expReward,
    };
    setSpirits((prev) => [...prev, newSpirit]);
  }, [isPaused, spirits.length]);

  // Spirit Spawning
  useEffect(() => {
    if (isPaused) return;
    
    spiritSpawnInterval.current = setInterval(() => {
      spawnSpirit();
    }, 2500);

    return () => {
      if (spiritSpawnInterval.current) clearInterval(spiritSpawnInterval.current);
      if (trainingInterval.current) clearInterval(trainingInterval.current);
    };
  }, [isPaused, spawnSpirit]);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (domainActive) return;
      
      const moveSpeed = 8;
      
      switch (e.key.toLowerCase()) {
        // Movement - WASD and Arrow keys
        case 'w':
        case 'arrowup':
          setPlayerPos(prev => ({ ...prev, y: Math.max(5, prev.y - moveSpeed) }));
          break;
        case 's':
        case 'arrowdown':
          setPlayerPos(prev => ({ ...prev, y: Math.min(85, prev.y + moveSpeed) }));
          break;
        case 'a':
        case 'arrowleft':
          setPlayerPos(prev => ({ ...prev, x: Math.max(5, prev.x - moveSpeed) }));
          break;
        case 'd':
        case 'arrowright':
          setPlayerPos(prev => ({ ...prev, x: Math.min(90, prev.x + moveSpeed) }));
          break;
        // Attack controls
        case ' ':
        case 'j':
          e.preventDefault();
          if (!isPaused) attackSpirit(false);
          break;
        case 'k':
        case 'e':
          if (!isPaused) attackSpirit(true);
          break;
        case 'l':
        case 'q':
          if (!isPaused) useDomainExpansion();
          break;
        // Character switch
        case 'c':
          switchCharacter();
          break;
        // Pause
        case 'p':
        case 'escape':
          togglePause();
          break;
        // Training
        case 't':
          if (!isPaused) toggleTraining();
          break;
        // Target selection (Tab to cycle through spirits)
        case 'tab':
          e.preventDefault();
          if (spirits.length > 0) {
            const currentIndex = selectedSpiritId 
              ? spirits.findIndex(s => s.id === selectedSpiritId)
              : -1;
            const nextIndex = (currentIndex + 1) % spirits.length;
            setSelectedSpiritId(spirits[nextIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, domainActive, spirits, selectedSpiritId]);

  // Click to move player
  const handleGameWorldClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gameWorldRef.current || isPaused || domainActive) return;
    
    const rect = gameWorldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPlayerPos({ 
      x: Math.max(5, Math.min(90, x)), 
      y: Math.max(5, Math.min(85, y)) 
    });
  }, [isPaused, domainActive]);

  // Actions
  const attackSpirit = useCallback((isTechnique: boolean = false) => {
    if (isPaused || spirits.length === 0) {
      if (spirits.length === 0) {
        toast({ title: "No targets nearby", variant: "destructive" });
        logEvent("No spirits within range.", "info");
      }
      return;
    }

    // Gojo's Infinity passive reduces cost
    const baseCost = isTechnique ? 40 : 10;
    const cost = character === 'gojo' ? Math.floor(baseCost * 0.8) : baseCost;
    
    if (cursedEnergy < cost) {
      toast({ title: "Out of Cursed Energy!", variant: "destructive" });
      logEvent(`Need ${Math.max(1, cost - Math.floor(cursedEnergy))} more cursed energy.`, "danger");
      return;
    }

    setCursedEnergy(prev => prev - cost);

    // Target Logic - use selected or closest spirit
    let targetIndex = spirits.length - 1;
    if (selectedSpiritId) {
      const selectedIndex = spirits.findIndex(s => s.id === selectedSpiritId);
      if (selectedIndex !== -1) targetIndex = selectedIndex;
    } else {
      // Find closest spirit to player
      let minDist = Infinity;
      spirits.forEach((spirit, i) => {
        const dist = Math.hypot(spirit.x - playerPos.x, spirit.y - playerPos.y);
        if (dist < minDist) {
          minDist = dist;
          targetIndex = i;
        }
      });
    }
    
    const target = spirits[targetIndex];
    const config = charConfig[character];
    
    // Damage Logic with combo multiplier
    let baseDamage = isTechnique ? config.baseDamage * 2.5 : config.baseDamage;
    
    // Combo bonus (up to 50% extra damage at 10+ combo)
    const comboBonus = 1 + Math.min(combo * 0.05, 0.5);
    baseDamage *= comboBonus;
    
    let damage = baseDamage;
    let isCrit = false;

    // Black Flash Chance (Yuji has higher chance)
    const critChance = character === 'yuji' ? 0.25 : 0.15;
    if (Math.random() < critChance) {
      damage *= config.critMultiplier;
      isCrit = true;
      setBlackFlashActive(true);
      triggerShake(25);
      setTimeout(() => setBlackFlashActive(false), 200);
      addParticles(target.x, target.y, '#ff0000', 12);
      logEvent("Black Flash unleashed! Damage amplified.", "success");
    } else {
      triggerShake(5);
      addParticles(target.x, target.y, '#ff6b6b', 5);
    }

    // Update combo
    setCombo(prev => prev + 1);
    if (combo + 1 > highestCombo) {
      setHighestCombo(combo + 1);
    }
    
    // Reset combo after 2 seconds of no hits
    if (comboTimeout.current) clearTimeout(comboTimeout.current);
    comboTimeout.current = setTimeout(() => {
      setCombo(0);
    }, 2000);

    // Apply Damage
    const newHp = target.hp - damage;
    
    // Visuals
    const damageText = combo > 5 ? `${Math.floor(damage)} 🔥${combo}` : `-${Math.floor(damage)}`;
    addFloatingText(target.x, target.y, damageText, isCrit ? "text-red-500" : "text-white", isCrit);

    if (newHp <= 0) {
      // Exorcised
      const newSpirits = spirits.filter(s => s.id !== target.id);
      setSpirits(newSpirits);
      setCursesDefeated(prev => prev + 1);
      
      // Award experience
      const expGain = target.expReward * (1 + combo * 0.1);
      setExperience(prev => prev + Math.floor(expGain));
      
      // Level up check - increase max energy every 500 exp
      const newExp = experience + Math.floor(expGain);
      const newMaxEnergy = 200 + Math.floor(newExp / 500) * 25;
      if (newMaxEnergy > maxCursedEnergy) {
        setMaxCursedEnergy(newMaxEnergy);
        toast({ 
          title: "Power Increased!",
          description: `Max Cursed Energy: ${newMaxEnergy}`,
          className: "bg-gradient-to-r from-purple-600 to-pink-600 border-none text-white"
        });
      }
      
      addFloatingText(target.x, target.y - 5, "EXORCISED", "text-yellow-400", true);
      addFloatingText(target.x + 5, target.y - 10, `+${Math.floor(expGain)} XP`, "text-green-400", false);
      addParticles(target.x, target.y, '#ffd700', 10);
      const gradeText = target.type === "special" ? "Special Grade" : `Grade ${target.type.replace("grade", "")}`;
      logEvent(`Exorcised ${gradeText} spirit +${Math.floor(expGain)} XP`, "success");
      
      // Clear selection if target was selected
      if (selectedSpiritId === target.id) {
        setSelectedSpiritId(null);
      }
    } else {
      // Update HP
      const newSpirits = [...spirits];
      newSpirits[targetIndex] = { ...target, hp: newHp };
      setSpirits(newSpirits);
    }
  }, [isPaused, spirits, selectedSpiritId, character, cursedEnergy, playerPos, combo, highestCombo, experience, maxCursedEnergy, addFloatingText, addParticles, logEvent]);

  const switchCharacter = useCallback(() => {
    const chars: Character[] = ['yuji', 'gojo', 'megumi', 'nobara'];
    const currentIndex = chars.indexOf(character);
    const next = chars[(currentIndex + 1) % chars.length];
    setCharacter(next);
    toast({ 
      title: `Switched to ${charConfig[next].name}`,
      description: charConfig[next].passiveDesc
    });
    logEvent(`Switched to ${charConfig[next].name}.`, "info");
  }, [character, logEvent]);

  const useDomainExpansion = useCallback(() => {
    if (isPaused) return;
    
    const cost = 80;
    if (cursedEnergy < cost) {
      toast({ title: "Insufficient Energy", variant: "destructive" });
      logEvent("Need 80 cursed energy for Domain Expansion.", "danger");
      return;
    }
    setCursedEnergy((prev) => prev - cost);
    setDomainActive(true);
    logEvent(`Domain Expansion: ${charConfig[character].domainName}`, "success");
    
    // Add dramatic particles
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        addParticles(
          Math.random() * 80 + 10,
          Math.random() * 80 + 10,
          character === 'gojo' ? '#00ffff' : '#ff0066',
          3
        );
      }, i * 100);
    }
    
    setTimeout(() => {
      setDomainActive(false);
      const count = spirits.length;
      const totalExp = spirits.reduce((sum, s) => sum + s.expReward, 0);
      setSpirits([]);
      setCursesDefeated((prev) => prev + count);
      setExperience(prev => prev + totalExp * 1.5);
      triggerShake(35);
      toast({
        title: `Domain Expansion: ${charConfig[character].domainName}`,
        description: `Annihilated ${count} spirits! +${Math.floor(totalExp * 1.5)} XP`,
        className: "bg-purple-900/90 border-purple-500 text-white font-orbitron",
      });
      logEvent("Domain collapsed. Field cleared.", "info");
    }, 2500);
  }, [isPaused, cursedEnergy, spirits, character, addParticles, logEvent]);

  // Get spirit grade label and color
  const getSpiritGradeInfo = (type: string) => {
    const gradeColors = {
      grade4: 'text-gray-400',
      grade3: 'text-green-400',
      grade2: 'text-blue-400',
      grade1: 'text-purple-400',
      special: 'text-red-400',
    };
    const gradeLabels = {
      grade4: 'G4',
      grade3: 'G3',
      grade2: 'G2',
      grade1: 'G1',
      special: 'SP',
    };
    return {
      color: gradeColors[type as keyof typeof gradeColors] || 'text-white',
      label: gradeLabels[type as keyof typeof gradeLabels] || '?',
    };
  };

  return (
    <div className={`min-h-screen flex flex-col p-4 gap-4 bg-background overflow-hidden transition-colors duration-500 ${domainActive ? 'domain-active' : ''}`}>
      
      {/* Pause Overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/80 z-40 flex flex-col items-center justify-center gap-4">
          <Pause className="h-20 w-20 text-white animate-pulse" />
          <h1 className="text-4xl font-orbitron font-black text-white">PAUSED</h1>
          <p className="text-gray-400">Press P or ESC to resume</p>
          <Button onClick={togglePause} className="mt-4">Resume Game</Button>
        </div>
      )}

      {/* Black Flash Overlay */}
      {blackFlashActive && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center pointer-events-none mix-blend-hard-light">
           <div className="w-full h-[200px] bg-red-600 blur-3xl opacity-50 animate-pulse transform rotate-12 scale-150"></div>
           <h1 className="absolute text-9xl font-black text-black stroke-white italic" style={{ WebkitTextStroke: "2px red" }}>BLACK FLASH</h1>
        </div>
      )}

      {/* Keyboard Controls Help */}
      {showControls && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 right-4 bg-black/95 border border-accent/30 rounded-xl p-4 z-30 text-sm"
        >
          <h3 className="font-orbitron text-accent mb-2">KEYBOARD CONTROLS</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
            <span>W/↑</span><span>Move Up</span>
            <span>S/↓</span><span>Move Down</span>
            <span>A/←</span><span>Move Left</span>
            <span>D/→</span><span>Move Right</span>
            <span className="border-t border-gray-700 pt-1 mt-1">Space/J</span><span className="border-t border-gray-700 pt-1 mt-1">Attack</span>
            <span>E/K</span><span>Technique</span>
            <span>Q/L</span><span>Domain</span>
            <span>C</span><span>Swap Character</span>
            <span>Tab</span><span>Target Spirit</span>
            <span>P/Esc</span><span>Pause</span>
            <span>T</span><span>Toggle Training</span>
          </div>
        </motion.div>
      )}

      {/* HUD */}
      <Card className="p-4 bg-black/80 border-primary shadow-[0_0_20px_rgba(139,0,0,0.5)] rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 z-20">
        <div className="flex items-center gap-4">
          <div 
            className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl border-2 border-accent cursor-pointer hover:scale-110 transition-transform"
            onClick={switchCharacter}
            title="Switch Character (C)"
          >
            {currentConfig.avatar}
          </div>
          <div className="text-center md:text-left">
            <div className={`font-orbitron text-sm ${currentConfig.color}`}>
              {currentGrade}
            </div>
            <div className={`font-orbitron text-xl font-black drop-shadow-md ${currentConfig.color}`}>
              {currentConfig.name}
            </div>
          </div>
        </div>

        <div className="flex-1 w-full max-w-md px-4">
          <div className="flex justify-between text-xs font-orbitron text-muted-foreground mb-1">
            <span>CURSED ENERGY</span>
            <span>{Math.floor(cursedEnergy)}/{maxCursedEnergy}</span>
          </div>
          <div className="relative h-6 w-full bg-black/50 rounded-full border border-white/10 overflow-hidden">
            <motion.div 
              className={`h-full absolute top-0 left-0 bg-gradient-to-r ${currentConfig.bgGradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${(cursedEnergy / maxCursedEnergy) * 100}%` }}
              transition={{ type: "spring", stiffness: 50 }}
            />
          </div>
          {/* Experience bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs font-orbitron text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /> EXP</span>
              <span>{experience}</span>
            </div>
            <div className="relative h-2 w-full bg-black/50 rounded-full border border-yellow-500/30 overflow-hidden">
              <motion.div 
                className="h-full absolute top-0 left-0 bg-gradient-to-r from-yellow-600 to-yellow-400"
                initial={{ width: 0 }}
                animate={{ width: `${(experience % 500) / 5}%` }}
                transition={{ type: "spring", stiffness: 50 }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 text-white">
          <div className="flex flex-col items-center" title="Steps">
            <Footprints className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-bold">{steps.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center" title="Curses Defeated">
            <Skull className="h-5 w-5 text-red-500" />
            <span className="text-sm font-bold">{cursesDefeated}</span>
          </div>
          {combo > 0 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center"
              title="Current Combo"
            >
              <Flame className={`h-5 w-5 ${combo >= 10 ? 'text-red-500 animate-pulse' : combo >= 5 ? 'text-orange-400' : 'text-yellow-400'}`} />
              <span className="text-sm font-bold">{combo}x</span>
            </motion.div>
          )}
          <div className="flex flex-col items-center" title="Best Combo">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-bold">{highestCombo}</span>
          </div>
        </div>
        
        {/* Control help toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowControls(!showControls)}
          className="text-gray-400 hover:text-white"
          title="Show Controls"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-black/70 border-white/10 rounded-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-orbitron tracking-[0.4em] text-white/50">THREAT LEVEL</p>
              <p className={`text-2xl font-orbitron font-black ${threatLevel > 0.75 ? 'text-red-400' : threatLevel > 0.4 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {threatLabel}
              </p>
            </div>
            <Activity className={`h-10 w-10 ${threatLevel > 0.75 ? 'text-red-400' : threatLevel > 0.4 ? 'text-amber-300' : 'text-emerald-300'}`} />
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/50 font-mono">
              <span>Intensity</span>
              <span>{threatPercent}%</span>
            </div>
            <div className="mt-2 h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                animate={{ width: `${threatPercent}%` }}
                transition={{ type: "spring", stiffness: 60 }}
              />
            </div>
            <div className="mt-3 text-[11px] text-white/70 font-mono flex justify-between">
              <span>Spirits {spirits.length}/8</span>
              <span>Combo {combo}x</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-black/70 border-white/10 rounded-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-orbitron tracking-[0.4em] text-white/50">ENERGY CORE</p>
              <p className="text-xl font-orbitron text-white">Cursed Flow</p>
            </div>
            <Shield className="h-8 w-8 text-cyan-300" />
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-white/50 font-mono">
                <span>Energy</span>
                <span>{energyPercent}%</span>
              </div>
              <div className="mt-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-red-600 via-pink-500 to-yellow-300"
                  animate={{ width: `${energyPercent}%` }}
                  transition={{ type: "spring", stiffness: 60 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-white/50 font-mono">
                <span>EXP Loop</span>
                <span>{Math.round(expProgressPercent)}%</span>
              </div>
              <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-yellow-500 to-amber-300"
                  animate={{ width: `${Math.round(expProgressPercent)}%` }}
                  transition={{ type: "spring", stiffness: 60 }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-orbitron">
            <div className={`status-chip ${techniqueReady ? 'ready' : 'cooldown'}`}>
              <span>Technique</span>
              <span>{techniqueReady ? "READY" : `-${pendingTechniqueEnergy}`}</span>
            </div>
            <div className={`status-chip ${domainReady ? 'ready' : 'cooldown'}`}>
              <span>Domain</span>
              <span>{domainReady ? "READY" : `-${pendingDomainEnergy}`}</span>
            </div>
            <div className="status-chip neutral">
              <span>Combo Heat</span>
              <span>{comboHeatPercent}%</span>
            </div>
            <div className="status-chip neutral">
              <span>Training</span>
              <span>{isTraining ? "ACTIVE" : "IDLE"}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-black/70 border-white/10 rounded-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-orbitron tracking-[0.4em] text-white/50">BATTLE FEED</p>
              <p className="text-xl font-orbitron text-white">Tactical Log</p>
            </div>
            <Sparkles className="h-8 w-8 text-amber-300" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {battleLog.map((entry) => (
              <div key={entry.id} className={`battle-log-entry ${toneClasses[entry.tone]}`}>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* GAME WORLD */}
      <motion.div 
        ref={gameWorldRef}
        className="flex-1 relative rounded-xl border-2 border-accent/20 game-world-gradient overflow-hidden shadow-inner cursor-crosshair"
        style={{ backgroundImage: worldBackground }}
        animate={{ x: [-shake, shake, -shake, shake, 0], y: [-shake, shake, -shake, 0] }}
        transition={{ duration: 0.1 }}
        onClick={handleGameWorldClick}
      >
        <div className="world-aurora absolute inset-0 pointer-events-none" style={{ opacity: 0.2 + threatLevel * 0.4 }} />
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 border border-white/10 text-xs font-orbitron tracking-[0.3em] text-white">
          <AlertTriangle className={`h-4 w-4 ${threatLevel > 0.75 ? 'text-red-400' : threatLevel > 0.4 ? 'text-amber-300' : 'text-emerald-300'}`} />
          <span>{threatLabel}</span>
          <span className="text-white/60">{threatPercent}%</span>
        </div>

        <div className="absolute top-4 right-4 hidden md:flex flex-col items-center text-[10px] uppercase tracking-[0.3em] text-white/60 z-30">
          <div className="relative h-24 w-24 rounded-full border border-white/20 bg-black/60 overflow-hidden world-radar">
            <div className="absolute inset-0 world-radar-sweep" />
            <div
              className="absolute w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              style={{ left: `${clampRadarCoord(playerPos.x)}%`, top: `${clampRadarCoord(playerPos.y)}%`, transform: "translate(-50%, -50%)" }}
            />
            {spirits.map((spirit) => (
              <div
                key={`radar-${spirit.id}`}
                className={`absolute w-2 h-2 rounded-full ${spirit.type === 'special' ? 'bg-red-400' : 'bg-amber-300'}`}
                style={{ left: `${clampRadarCoord(spirit.x)}%`, top: `${clampRadarCoord(spirit.y)}%`, transform: "translate(-50%, -50%)" }}
              />
            ))}
          </div>
          <span className="mt-2 flex items-center gap-1">
            <Radar className="h-3 w-3" />
            RADAR
          </span>
        </div>

        {targetSpirit && !domainActive && (
          <motion.div
            key="target-pointer"
            className="absolute z-20 pointer-events-none origin-left target-pointer"
            style={{
              left: `${playerPos.x}%`,
              top: `${playerPos.y}%`,
              rotate: `${pointerAngle}deg`,
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <div className="h-[3px] w-20 bg-gradient-to-r from-transparent via-amber-400 to-amber-200" />
          </motion.div>
        )}
        
        {/* Player */}
        <motion.div
          className="absolute z-10 flex flex-col justify-center items-center text-5xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"
          animate={{ 
            left: `${playerPos.x}%`, 
            top: `${playerPos.y}%`,
            y: [0, -10, 0]
          }}
          transition={{ 
            left: { type: "spring", stiffness: 100, damping: 15 },
            top: { type: "spring", stiffness: 100, damping: 15 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          {currentConfig.avatar}
          {/* Player glow */}
          <motion.div 
            className={`absolute w-20 h-20 rounded-full blur-xl opacity-30 -z-10`}
            style={{ 
              background: `radial-gradient(circle, ${currentConfig.glowColor} 0%, transparent 70%)` 
            }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Spirits */}
        <AnimatePresence>
          {spirits.map((spirit) => {
            const gradeInfo = getSpiritGradeInfo(spirit.type);
            const isSelected = selectedSpiritId === spirit.id;
            
            return (
              <motion.div
                key={spirit.id}
                className={`absolute flex flex-col items-center cursor-pointer ${spirit.type === 'special' ? 'text-6xl' : spirit.type === 'grade1' ? 'text-5xl' : 'text-4xl'}`}
                style={{ left: `${spirit.x}%`, top: `${spirit.y}%`, transform: 'translate(-50%, -50%)' }}
                initial={{ scale: 0, opacity: 0, rotate: -180 }}
                animate={{ 
                  scale: isSelected ? 1.15 : 1, 
                  opacity: 1,
                  rotate: 0,
                  y: [0, -15, 0],
                }}
                exit={{ opacity: 0, filter: "blur(20px)", scale: 2.5, rotate: 180 }}
                transition={{ 
                  scale: { duration: 0.3 },
                  y: { duration: 2, repeat: Infinity },
                  default: { duration: 0.5 }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSpiritId(spirit.id);
                  attackSpirit(false);
                }}
                whileHover={{ scale: 1.1 }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <motion.div 
                    className="absolute inset-0 border-2 border-yellow-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ width: '60px', height: '60px', top: '-10px', left: '50%', transform: 'translateX(-50%)' }}
                  />
                )}
                
                {/* Grade label */}
                <span className={`text-xs font-orbitron font-bold ${gradeInfo.color} mb-1`}>
                  {gradeInfo.label}
                </span>
                
                <div className={`relative drop-shadow-[0_0_15px_rgba(139,0,0,0.8)]`}>
                  {spirit.emoji}
                </div>
                
                {/* HP Bar for Spirits */}
                <div className="w-14 h-2 bg-black/60 mt-2 rounded-full overflow-hidden border border-white/20">
                  <motion.div 
                    className={`h-full ${
                      spirit.hp / spirit.maxHp > 0.5 ? 'bg-green-500' : 
                      spirit.hp / spirit.maxHp > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(spirit.hp / spirit.maxHp) * 100}%` }}
                    transition={{ type: "spring", stiffness: 50 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Particles */}
        <AnimatePresence>
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ 
                opacity: 0, 
                scale: 0,
                x: (Math.random() - 0.5) * 100,
                y: (Math.random() - 0.5) * 100 - 50,
              }}
              exit={{ opacity: 0 }}
              className="absolute rounded-full pointer-events-none z-40"
              style={{ 
                left: `${particle.x}%`, 
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                width: particle.size,
                height: particle.size,
                boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              }}
            />
          ))}
        </AnimatePresence>

        {/* Floating Text */}
        <AnimatePresence>
            {floatingTexts.map(ft => (
              <motion.div
                key={ft.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -50, scale: ft.scale }}
                exit={{ opacity: 0 }}
                className={`absolute font-black font-orbitron pointer-events-none z-50 ${ft.color}`}
                style={{ left: `${ft.x}%`, top: `${ft.y}%`, textShadow: '0 2px 4px black' }}
              >
                {ft.text}
              </motion.div>
            ))}
        </AnimatePresence>
        
        {/* Domain Visuals */}
        {domainActive && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.5 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             className={`absolute inset-0 z-0 pointer-events-none backdrop-blur-[2px] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] ${currentConfig.domainClass}`}
           />
        )}

        {targetSpirit && (
          <div className="absolute bottom-4 left-4 z-30 w-60 rounded-2xl bg-black/70 border border-white/10 p-3 backdrop-blur">
            <p className="text-[10px] font-orbitron tracking-[0.4em] text-white/50">TARGET LOCK</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-3xl drop-shadow-[0_0_10px_rgba(0,0,0,0.6)]">{targetSpirit.emoji}</span>
              <div className="flex-1">
                <p className="font-orbitron text-sm text-white">
                  {getSpiritGradeInfo(targetSpirit.type).label} • {Math.max(0, Math.floor(targetSpirit.hp))}
                </p>
                <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-red-500"
                    animate={{ width: `${Math.max(0, (targetSpirit.hp / targetSpirit.maxHp) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 80 }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Click hint when no spirits */}
        {spirits.length === 0 && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-white/50"
            >
              <Target className="h-12 w-12 mx-auto mb-2 animate-pulse" />
              <p className="font-orbitron">Waiting for spirits...</p>
              <p className="text-sm mt-1">Click to move • WASD to navigate</p>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* CONTROLS */}
      <div className="flex flex-col gap-4 z-20">
        <div className="grid grid-cols-3 gap-4">
          <Button 
            onClick={() => attackSpirit(false)}
            disabled={isPaused}
            className={`h-20 bg-gradient-to-br ${currentConfig.bgGradient} hover:opacity-90 border border-white/20 rounded-xl font-orbitron tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50`}
          >
            <div className="flex flex-col items-center gap-1">
              <Zap className="h-6 w-6" />
              <span className="text-lg">ATTACK</span>
              <span className="text-xs opacity-70">Space / J</span>
            </div>
          </Button>
          
          <Button 
            onClick={() => attackSpirit(true)}
            disabled={isPaused || cursedEnergy < (character === 'gojo' ? 32 : 40)}
            className="h-20 bg-gradient-to-br from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 border border-yellow-300 text-black rounded-xl font-orbitron tracking-wider shadow-lg shadow-yellow-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-500"
          >
            <div className="flex flex-col items-center gap-1">
              <Hand className="h-6 w-6" />
              <span className="text-xs font-bold text-center">{currentConfig.techniqueName}</span>
              <span className="text-xs opacity-70">E / K ({character === 'gojo' ? 32 : 40})</span>
            </div>
          </Button>
          
          <Button 
            onClick={useDomainExpansion}
            disabled={isPaused || cursedEnergy < 80}
            className="h-20 bg-gradient-to-br from-purple-900 to-indigo-800 hover:from-purple-800 hover:to-indigo-700 border border-purple-400 rounded-xl font-orbitron tracking-wider shadow-lg shadow-purple-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:from-gray-700 disabled:to-gray-600"
          >
            <div className="flex flex-col items-center gap-1">
              <Globe className="h-6 w-6" />
              <span className="text-xs font-bold text-center">{currentConfig.domainName}</span>
              <span className="text-xs opacity-70">Q / L (80)</span>
            </div>
          </Button>
        </div>

        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-wrap justify-center gap-4 items-center">
          <h3 className="text-accent font-orbitron mr-4 hidden md:block">CONTROLS:</h3>
          
          <Button 
            size="sm" 
            variant={isPaused ? "default" : "outline"}
            onClick={togglePause}
            className={`font-mono ${isPaused ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-white/5 border-white/20 hover:bg-white/10 text-white'}`}
          >
            {isPaused ? (
              <><Play className="mr-2 h-4 w-4" /> RESUME (P)</>
            ) : (
              <><Pause className="mr-2 h-4 w-4" /> PAUSE (P)</>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant={isTraining ? "destructive" : "secondary"}
            onClick={toggleTraining}
            disabled={isPaused}
            className="font-mono"
          >
            {isTraining ? (
              <><Square className="mr-2 h-4 w-4" /> STOP</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> TRAIN (T)</>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-white/5 border-white/20 hover:bg-white/10 text-white font-mono"
            onClick={() => setSteps(prev => prev + 100)}
            disabled={isPaused}
          >
            +100 STEPS
          </Button>

           <Button 
            size="sm" 
            variant="ghost" 
            className="text-accent hover:text-accent/80 hover:bg-accent/10"
            onClick={switchCharacter}
          >
            <User className="mr-2 h-4 w-4" /> SWAP (C)
          </Button>
        </div>
      </div>
    </div>
  );
}
