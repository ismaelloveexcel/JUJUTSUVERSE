import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Flame,
  Shield,
  Sword,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  CharacterSelect,
  type Character,
} from "@/components/CharacterSelect";
import { MAX_HEALTH, TECHNIQUES } from "@shared/constants";

type QueueState = "idle" | "queued" | "active" | "finished";

interface BattleState {
  id: string;
  youAre: "player1" | "player2";
  player1: { username: string; hp: number; characterId?: string };
  player2: { username: string; hp: number; characterId?: string };
  threat: number;
  threatPeak: number;
  turns: number;
  status: "queued" | "active" | "finished";
  log: string[];
  winner?: "player1" | "player2" | "draw";
}

const WS_PATH = "/ws/battle";

function getWsUrl() {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${WS_PATH}`;
}

export default function BattleRoom() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [queueState, setQueueState] = useState<QueueState>("idle");
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [username, setUsername] = useState("");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [remoteLog, setRemoteLog] = useState<string[]>([]);
  const [localLog, setLocalLog] = useState<string[]>([]);
  const [showSelectHint, setShowSelectHint] = useState(false);

  useEffect(() => {
    const url = getWsUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    setSocket(ws);

    ws.onopen = () => {
      toast({ title: "Connected to Domain", description: "Awaiting orders." });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onerror = () => {
      toast({
        title: "Connection issue",
        description: "Unable to reach the battle server.",
        variant: "destructive",
      });
    };

    ws.onclose = () => {
      setQueueState("idle");
      setBattleState(null);
      setSocket(null);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleMessage = (event: any) => {
    switch (event.type) {
      case "queue:status":
        setQueueState("idle");
        break;
      case "queue:joined":
        setQueueState("queued");
        toast({
          title: "Queued",
          description: `Linked as ${event.payload?.username}`,
        });
        break;
      case "battle:start":
        setBattleState(event.payload);
        setQueueState("active");
        setRemoteLog(event.payload?.log?.slice().reverse() ?? []);
        setLocalLog([]);
        setSelectedChar(null);
        setShowSelectHint(true);
        toast({
          title: "Domain breach imminent",
          description: "Choose your sorcerer to begin.",
        });
        break;
      case "battle:update":
        setBattleState(event.payload);
        setRemoteLog(event.payload?.log?.slice().reverse() ?? []);
        break;
      case "battle:end":
        setBattleState(event.payload);
        setQueueState("finished");
        setRemoteLog(event.payload?.log?.slice().reverse() ?? []);
        setShowSelectHint(false);
        setLocalLog([]);
        if (event.payload?.winner) {
          const result =
            event.payload.winner === "draw"
              ? "Draw! Threat peaked."
              : event.payload.winner === event.payload.youAre
                ? "Victory secured!"
                : "You've been overwhelmed.";
          toast({ title: "Battle concluded", description: result });
        }
        break;
      case "battle:complete":
        setQueueState("idle");
        break;
      case "error":
        toast({
          title: "Battle server",
          description: event.payload?.message ?? "Unknown error",
          variant: "destructive",
        });
        break;
      default:
        break;
    }
  };

  const joinQueue = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "Not connected",
        description: "Waiting for websocket connection.",
        variant: "destructive",
      });
      return;
    }

    const codename = username.trim() || `Sorcerer-${Math.floor(Math.random() * 9999)}`;
    socket.send(JSON.stringify({ type: "join", payload: { username: codename } }));
    setUsername(codename);
    setQueueState("queued");
  };

  const handleCharacterPick = (character: Character) => {
    setSelectedChar(character);
    setShowSelectHint(false);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "character",
          payload: { characterId: character.id },
        }),
      );
    }
  };

  const sendTechnique = (techniqueId: string) => {
    if (!battleState || queueState !== "active") {
      toast({
        title: "No active battle",
        description: "Join a domain first.",
      });
      return;
    }

    if (!selectedChar) {
      setShowSelectHint(true);
      toast({
        title: "Choose a sorcerer",
        description: "Select a character before using techniques.",
      });
      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection lost",
        description: "Reconnecting to cursed network...",
        variant: "destructive",
      });
      return;
    }

    socket.send(
      JSON.stringify({ type: "action", payload: { techniqueId } }),
    );

    const technique = TECHNIQUES.find((item) => item.id === techniqueId);
    if (technique) {
      const message = `${selectedChar.name} unleashed ${technique.name}!`;
      setLocalLog((prev) => [message, ...prev].slice(0, 5));

      const audio = new Audio(
        `/assets/sounds/${technique.name
          .toLowerCase()
          .replace(/ /g, "-")}.mp3`,
      );
      audio.volume = 0.6;
      audio.play().catch(() => undefined);
    }
  };

  const logEntries = useMemo(() => {
    return [...localLog, ...remoteLog];
  }, [localLog, remoteLog]);

  const you = battleState
    ? battleState.youAre === "player1"
      ? battleState.player1
      : battleState.player2
    : null;
  const opponent = battleState
    ? battleState.youAre === "player1"
      ? battleState.player2
      : battleState.player1
    : null;
  const selectedCharacterId = selectedChar?.id;

  const threatPercent = battleState ? Math.round(battleState.threat) : 0;
  const yourHpPercent = you ? Math.round((you.hp / MAX_HEALTH) * 100) : 0;
  const opponentHpPercent = opponent
    ? Math.round((opponent.hp / MAX_HEALTH) * 100)
    : 0;

  return (
    <main className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 text-white shadow-[0_0_40px_rgba(0,0,0,0.45)]">
      <img
        src="/assets/domain-bg.gif"
        alt="Cursed Domain"
        className="fixed inset-0 -z-10 object-cover opacity-50"
      />
      <div className="relative z-10 space-y-6 p-6">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48">
            <p className="text-xs uppercase tracking-[0.4em] text-white/60">
              Battle Room
            </p>
            <h1 className="text-3xl font-orbitron">JUJUTSUVERSE Arena</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Callsign"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            <Button
              onClick={joinQueue}
              disabled={queueState === "queued" || queueState === "active"}
              className="bg-primary text-white"
            >
              <Sword className="mr-2 h-4 w-4" />
              {queueState === "queued" ? "Queued" : "Enter Domain"}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Status
                </p>
                <h3 className="text-xl font-orbitron">
                  {queueState === "idle" && "Idle"}
                  {queueState === "queued" && "Synchronizing"}
                  {queueState === "active" && "Battle Active"}
                  {queueState === "finished" && "Battle Complete"}
                </h3>
              </div>
              <Badge
                variant="secondary"
                className="bg-white/10 text-white border-white/20"
              >
                <Users className="mr-2 h-4 w-4" />
                {battleState ? "Duo Matched" : "Waiting"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  You
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-orbitron text-lg">
                    {you?.username ?? "-"}
                  </span>
                  <span className="text-white/70">{yourHpPercent}% HP</span>
                </div>
                <Progress value={yourHpPercent} className="mt-1 h-2" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Opponent
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-orbitron text-lg">
                    {opponent?.username ?? "-"}
                  </span>
                  <span className="text-white/70">{opponentHpPercent}% HP</span>
                </div>
                <Progress
                  value={opponentHpPercent}
                  className="mt-1 h-2 bg-red-200/20 [&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-amber-400"
                />
              </div>
            </div>
          </Card>

          <Card className="border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Threat Meter
                </p>
                <h3 className="text-2xl font-orbitron">{threatPercent}%</h3>
              </div>
              <AlertTriangle
                className={`h-12 w-12 ${
                  threatPercent > 70
                    ? "text-red-400"
                    : threatPercent > 40
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
              />
            </div>
            <div className="mt-4">
              <Progress
                value={threatPercent}
                className="h-3 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:via-amber-300 [&>div]:to-red-500"
              />
              <div className="mt-3 flex justify-between text-xs text-white/70">
                <span>{battleState?.turns ?? 0} turns</span>
                <span>Peak {battleState?.threatPeak ?? 0}%</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Battle Log
                </p>
                <h3 className="text-xl font-orbitron">
                  {selectedChar ? selectedChar.name : "Select a character"}
                </h3>
              </div>
              <Flame className="h-8 w-8 text-amber-300" />
            </div>
            <div className="mt-4 space-y-2 text-sm max-h-64 overflow-y-auto pr-1">
              {logEntries.length === 0 && (
                <p className="text-white/50">Waiting for combat data...</p>
              )}
              {logEntries.map((entry, index) => (
                <div
                  key={`${entry}-${index}`}
                  className="rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                >
                  {entry}
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Techniques
                </p>
                <h3 className="text-xl font-orbitron">
                  {selectedChar ? selectedChar.name : "Awaiting selection"}
                </h3>
              </div>
              <Shield className="h-8 w-8 text-cyan-300" />
            </div>

            <div className="mt-4 grid gap-3">
              {TECHNIQUES.map((technique) => (
                <button
                  key={technique.id}
                  onClick={() => sendTechnique(technique.id)}
                  className="flex justify-between rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 px-4 py-3 text-left transition hover:border-primary/50 hover:bg-primary/20"
                >
                  <div>
                    <p className="font-orbitron text-lg">{technique.name}</p>
                    <p className="text-xs text-white/60">
                      Power {technique.power} • Cooldown {technique.cooldown}s
                    </p>
                  </div>
                  <Zap className="h-6 w-6 text-yellow-300" />
                </button>
              ))}
            </div>
          </Card>
        </section>
      </div>

      {battleState?.status === "active" && !selectedChar && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6">
          <Card className="w-full max-w-4xl border border-primary/40 bg-black/80 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Choose your sorcerer
                </p>
                <h2 className="text-2xl font-orbitron">
                  Manifest your cursed energy
                </h2>
              </div>
              {showSelectHint && (
                <Badge className="bg-primary/20 text-primary">
                  Required to attack
                </Badge>
              )}
            </div>
            <CharacterSelect
              selectedId={selectedCharacterId}
              onSelect={handleCharacterPick}
            />
          </Card>
        </div>
      )}
    </main>
  );
}
