import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, Skull, Scroll, Zap, Hand, Globe, Play, Square, User, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
}

type Character = "yuji" | "gojo";

export default function Game() {
  // Game State
  const [character, setCharacter] = useState<Character>("yuji");
  const [cursedEnergy, setCursedEnergy] = useState(150);
  const maxCursedEnergy = 200;
  const [steps, setSteps] = useState(1247);
  const [cursesDefeated, setCursesDefeated] = useState(3);
  const [techniques, setTechniques] = useState<string[]>(["Divergent Fist", "Black Flash"]);
  const [isTraining, setIsTraining] = useState(false);
  const [spirits, setSpirits] = useState<Spirit[]>([]);
  const [domainActive, setDomainActive] = useState(false);
  const [blackFlashActive, setBlackFlashActive] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [shake, setShake] = useState(0);

  // Refs
  const trainingInterval = useRef<NodeJS.Timeout | null>(null);
  const spiritSpawnInterval = useRef<NodeJS.Timeout | null>(null);

  // Character Config
  const charConfig = {
    yuji: {
      name: "YUJI ITADORI",
      grade: "Grade 1 Sorcerer",
      color: "text-red-500",
      bgGradient: "from-red-900 to-red-600",
      avatar: "🥊",
      techniqueName: "Divergent Fist",
      domainName: "Simple Domain",
    },
    gojo: {
      name: "SATORU GOJO",
      grade: "Special Grade",
      color: "text-cyan-400",
      bgGradient: "from-blue-900 to-cyan-600",
      avatar: "🤞",
      techniqueName: "Cursed Technique Reversal: Red",
      domainName: "Unlimited Void",
    }
  };

  // Helper: Add Floating Text
  const addFloatingText = (x: number, y: number, text: string, color: string = "text-white", isCrit: boolean = false) => {
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
  };

  // Helper: Trigger Screen Shake
  const triggerShake = (intensity: number) => {
    setShake(intensity);
    setTimeout(() => setShake(0), 200);
  };

  // Training Logic
  const toggleTraining = () => {
    if (isTraining) {
      setIsTraining(false);
      if (trainingInterval.current) clearInterval(trainingInterval.current);
      toast({ title: "Training Stopped" });
    } else {
      setIsTraining(true);
      toast({ title: "Training Started", description: "Regenerating Cursed Energy..." });
      trainingInterval.current = setInterval(() => {
        setSteps((prev) => prev + 10);
        setCursedEnergy((prev) => Math.min(prev + 10, maxCursedEnergy));
      }, 1000);
    }
  };

  // Spirit Spawning
  useEffect(() => {
    spiritSpawnInterval.current = setInterval(() => {
      if (spirits.length < 5) {
        const isSpecial = Math.random() > 0.9;
        const newSpirit: Spirit = {
          id: Date.now(),
          type: isSpecial ? "special" : "grade4",
          x: Math.random() * 80 + 10,
          y: Math.random() * 80 + 10,
          emoji: isSpecial ? "👹" : "👻",
          hp: isSpecial ? 500 : 100,
          maxHp: isSpecial ? 500 : 100,
        };
        setSpirits((prev) => [...prev, newSpirit]);
      }
    }, 3000);

    return () => {
      if (spiritSpawnInterval.current) clearInterval(spiritSpawnInterval.current);
      if (trainingInterval.current) clearInterval(trainingInterval.current);
    };
  }, [spirits.length]);

  // Actions
  const attackSpirit = (isTechnique: boolean = false) => {
    if (spirits.length === 0) {
      toast({ title: "No targets nearby", variant: "destructive" });
      return;
    }

    const cost = isTechnique ? 40 : 10;
    if (cursedEnergy < cost) {
      toast({ title: "Out of Cursed Energy!", variant: "destructive" });
      return;
    }

    setCursedEnergy(prev => prev - cost);

    // Target Logic
    const targetIndex = spirits.length - 1;
    const target = spirits[targetIndex];
    
    // Damage Logic
    let damage = isTechnique ? 150 : 50;
    let isCrit = false;

    // Black Flash Chance (Yuji passive or random)
    if (Math.random() > 0.8) {
      damage *= 2.5;
      isCrit = true;
      setBlackFlashActive(true);
      triggerShake(20);
      setTimeout(() => setBlackFlashActive(false), 150); // Quick flash
    } else {
      triggerShake(5);
    }

    // Apply Damage
    const newHp = target.hp - damage;
    
    // Visuals
    addFloatingText(target.x, target.y, `-${Math.floor(damage)}`, isCrit ? "text-red-500" : "text-white", isCrit);

    if (newHp <= 0) {
      // Exorcised
      const newSpirits = [...spirits];
      newSpirits.pop();
      setSpirits(newSpirits);
      setCursesDefeated(prev => prev + 1);
      addFloatingText(target.x, target.y - 5, "EXORCISED", "text-yellow-400", true);
    } else {
      // Update HP
      const newSpirits = [...spirits];
      newSpirits[targetIndex] = { ...target, hp: newHp };
      setSpirits(newSpirits);
    }
  };

  const switchCharacter = () => {
    const next = character === "yuji" ? "gojo" : "yuji";
    setCharacter(next);
    setTechniques(next === "yuji" ? ["Divergent Fist", "Black Flash"] : ["Red", "Blue", "Purple"]);
    toast({ title: `Switched to ${next === "yuji" ? "Yuji" : "Gojo"}` });
  };

  const useDomainExpansion = () => {
    const cost = 80;
    if (cursedEnergy < cost) {
      toast({ title: "Insufficient Energy", variant: "destructive" });
      return;
    }
    setCursedEnergy((prev) => prev - cost);
    setDomainActive(true);
    
    setTimeout(() => {
      setDomainActive(false);
      const count = spirits.length;
      setSpirits([]);
      setCursesDefeated((prev) => prev + count);
      triggerShake(30);
      toast({
        title: `Domain Expansion: ${charConfig[character].domainName}`,
        description: `Annihilated ${count} spirits instantly.`,
        className: "bg-purple-900/80 border-purple-500 text-white font-orbitron",
      });
    }, 2500);
  };

  const currentConfig = charConfig[character];

  return (
    <div className={`min-h-screen flex flex-col p-4 gap-4 bg-background overflow-hidden transition-colors duration-500 ${domainActive ? 'domain-active' : ''}`}>
      
      {/* Black Flash Overlay */}
      {blackFlashActive && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center pointer-events-none mix-blend-hard-light">
           <div className="w-full h-[200px] bg-red-600 blur-3xl opacity-50 animate-pulse transform rotate-12 scale-150"></div>
           <h1 className="absolute text-9xl font-black text-black stroke-white italic" style={{ WebkitTextStroke: "2px red" }}>BLACK FLASH</h1>
        </div>
      )}

      {/* HUD */}
      <Card className="p-4 bg-black/80 border-primary shadow-[0_0_20px_rgba(139,0,0,0.5)] rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 z-20">
        <div className="flex items-center gap-4">
          <div 
            className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl border-2 border-accent cursor-pointer hover:scale-110 transition-transform"
            onClick={switchCharacter}
            title="Switch Character"
          >
            {currentConfig.avatar}
          </div>
          <div className="text-center md:text-left">
            <div className={`font-orbitron text-sm ${character === 'gojo' ? 'text-cyan-300' : 'text-red-400'}`}>
              {currentConfig.grade}
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
        </div>

        <div className="flex gap-6 text-white">
          <div className="flex flex-col items-center">
            <Footprints className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-bold">{steps}</span>
          </div>
          <div className="flex flex-col items-center">
            <Skull className="h-5 w-5 text-red-500" />
            <span className="text-sm font-bold">{cursesDefeated}</span>
          </div>
        </div>
      </Card>

      {/* GAME WORLD */}
      <motion.div 
        className="flex-1 relative rounded-xl border-2 border-accent/20 game-world-gradient overflow-hidden shadow-inner"
        animate={{ x: [-shake, shake, -shake, shake, 0], y: [-shake, shake, -shake, 0] }}
        transition={{ duration: 0.1 }}
      >
        
        {/* Player */}
        <motion.div
          className="absolute z-10 flex justify-center items-center text-5xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {currentConfig.avatar}
        </motion.div>

        {/* Spirits */}
        <AnimatePresence>
          {spirits.map((spirit) => (
            <motion.div
              key={spirit.id}
              className={`absolute flex flex-col items-center cursor-pointer ${spirit.type === 'special' ? 'text-6xl' : 'text-4xl'}`}
              style={{ left: `${spirit.x}%`, top: `${spirit.y}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: [0, -15, 0],
              }}
              exit={{ opacity: 0, filter: "blur(20px)", scale: 2 }}
              transition={{ duration: 2, repeat: Infinity }}
              onClick={() => attackSpirit(false)}
            >
              <div className={`relative drop-shadow-[0_0_15px_rgba(139,0,0,0.8)]`}>
                {spirit.emoji}
              </div>
              {/* HP Bar for Spirits */}
              <div className="w-12 h-1 bg-black/50 mt-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-600" 
                  style={{ width: `${(spirit.hp / spirit.maxHp) * 100}%` }}
                />
              </div>
            </motion.div>
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
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className={`absolute inset-0 z-0 pointer-events-none backdrop-blur-[2px] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] ${character === 'gojo' ? 'bg-white/20 mix-blend-overlay' : 'bg-red-900/40'}`}
           />
        )}
      </motion.div>

      {/* CONTROLS */}
      <div className="flex flex-col gap-4 z-20">
        <div className="grid grid-cols-3 gap-4">
          <Button 
            onClick={() => attackSpirit(false)}
            className={`h-20 bg-gradient-to-br ${currentConfig.bgGradient} hover:opacity-90 border border-white/20 rounded-xl font-orbitron tracking-wider shadow-lg transition-all active:scale-95`}
          >
            <div className="flex flex-col items-center gap-1">
              <Zap className="h-6 w-6" />
              <span className="text-lg">ATTACK</span>
            </div>
          </Button>
          
          <Button 
            onClick={() => attackSpirit(true)}
            className="h-20 bg-gradient-to-br from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 border border-yellow-300 text-black rounded-xl font-orbitron tracking-wider shadow-lg shadow-yellow-900/20 transition-all active:scale-95"
          >
            <div className="flex flex-col items-center gap-1">
              <Hand className="h-6 w-6" />
              <span className="text-xs font-bold text-center">{currentConfig.techniqueName} (40)</span>
            </div>
          </Button>
          
          <Button 
            onClick={useDomainExpansion}
            className="h-20 bg-gradient-to-br from-purple-900 to-indigo-800 hover:from-purple-800 hover:to-indigo-700 border border-purple-400 rounded-xl font-orbitron tracking-wider shadow-lg shadow-purple-900/20 transition-all active:scale-95"
          >
            <div className="flex flex-col items-center gap-1">
              <Globe className="h-6 w-6" />
              <span className="text-xs font-bold text-center">{currentConfig.domainName} (80)</span>
            </div>
          </Button>
        </div>

        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-wrap justify-center gap-4 items-center">
          <h3 className="text-accent font-orbitron mr-4 hidden md:block">TRAINING MODE:</h3>
          
          <Button 
            size="sm" 
            variant={isTraining ? "destructive" : "secondary"}
            onClick={toggleTraining}
            className="font-mono"
          >
            {isTraining ? (
              <><Square className="mr-2 h-4 w-4" /> STOP</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> REGENERATE ENERGY</>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-white/5 border-white/20 hover:bg-white/10 text-white font-mono"
            onClick={() => setSteps(prev => prev + 100)}
          >
            +100 STEPS
          </Button>

           <Button 
            size="sm" 
            variant="ghost" 
            className="text-accent hover:text-accent/80 hover:bg-accent/10"
            onClick={switchCharacter}
          >
            <User className="mr-2 h-4 w-4" /> SWAP CHAR
          </Button>
        </div>
      </div>
    </div>
  );
}
