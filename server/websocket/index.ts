import type { Express } from "express";
import type { IncomingMessage, Server as HTTPServer } from "http";
import { randomUUID } from "crypto";
import WebSocket, { WebSocketServer } from "ws";
import { db } from "../db";
import { battles, users } from "@shared/schema";
import { MAX_HEALTH, TECHNIQUE_LOOKUP } from "@shared/constants";
import { eq, sql } from "drizzle-orm";

type BattleSocket = WebSocket & { userId: string };

interface CharacterSelection {
  characterId?: string;
}

interface PlayerMeta extends CharacterSelection {
  socket: BattleSocket;
  username: string;
  dbUserId: number;
}

type BattleStatus = "queued" | "active" | "finished";

interface Battle {
  id: string;
  player1: PlayerMeta;
  player2: PlayerMeta;
  player1HP: number;
  player2HP: number;
  threatMeter: number;
  threatPeak: number;
  turns: number;
  status: BattleStatus;
  log: string[];
  createdAt: Date;
}

type ClientMessage =
  | { type: "join"; payload: { username?: string } }
  | { type: "action"; payload: { techniqueId: string } }
  | { type: "character"; payload: { characterId: string } };

interface BattleStatePayload {
  id: string;
  youAre: "player1" | "player2";
  player1: { username: string; hp: number; characterId?: string };
  player2: { username: string; hp: number; characterId?: string };
  threat: number;
  threatPeak: number;
  turns: number;
  status: BattleStatus;
  log: string[];
  winner?: "player1" | "player2" | "draw";
}

interface AuthedIncomingMessage extends IncomingMessage {
  user?: { id: string };
}

const WAITING_MESSAGE = {
  type: "queue:status",
  payload: { message: "Waiting for another sorcerer..." },
};

export function setupWS(httpServer: HTTPServer, _app: Express) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/battle" });

  const waitingQueue: PlayerMeta[] = [];
  const socketMeta = new Map<BattleSocket, PlayerMeta>();
  const socketToBattleId = new Map<BattleSocket, string>();
  const battleById = new Map<string, Battle>();

  wss.on("connection", (rawSocket, req) => {
    const socket = rawSocket as BattleSocket;
    const authedReq = req as AuthedIncomingMessage;
    socket.userId = authedReq.user?.id ?? "guest";

    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as ClientMessage;
        switch (data.type) {
          case "join":
            handleJoin(socket, data.payload?.username ?? "");
            break;
          case "action":
            handleAction(socket, data.payload?.techniqueId);
            break;
          case "character":
            handleCharacterSelection(socket, data.payload?.characterId);
            break;
          default:
            send(socket, {
              type: "error",
              payload: { message: "Unknown message type." },
            });
        }
      } catch (error) {
        console.error("[ws] failed to parse message", error);
        send(socket, {
          type: "error",
          payload: { message: "Invalid payload." },
        });
      }
    });

    socket.on("close", () => {
      handleDisconnect(socket);
    });

    send(socket, WAITING_MESSAGE);
  });

  async function handleJoin(socket: BattleSocket, providedName: string) {
    const username = sanitizeUsername(providedName);

    if (socketMeta.has(socket)) {
      send(socket, {
        type: "queue:status",
        payload: { message: "Already enlisted. Await battle start." },
      });
      return;
    }

    const userRecord =
      (await db.query.users.findFirst({
        where: eq(users.username, username),
      })) ??
      (await db
        .insert(users)
        .values({ username })
        .returning()
        .then((rows) => rows[0]));

    if (!userRecord) {
      send(socket, {
        type: "error",
        payload: { message: "Failed to register user." },
      });
      return;
    }

    const meta: PlayerMeta = {
      socket,
      username: userRecord.username,
      dbUserId: userRecord.id,
    };

    socketMeta.set(socket, meta);
    waitingQueue.push(meta);
    send(socket, {
      type: "queue:joined",
      payload: { username: meta.username },
    });
    attemptMatch();
  }

  function handleCharacterSelection(
    socket: BattleSocket,
    characterId?: string,
  ) {
    const meta = socketMeta.get(socket);
    if (!meta || !characterId) {
      return;
    }

    meta.characterId = characterId;

    const battle = getBattleForSocket(socket);
    if (!battle) {
      return;
    }

    addLog(
      battle,
      `${meta.username} attuned to ${formatCharacterId(characterId)}.`,
    );
    sendBattleState(battle, "update");
  }

  function handleAction(socket: BattleSocket, techniqueId?: string) {
    if (!techniqueId) {
      send(socket, {
        type: "error",
        payload: { message: "Technique is required." },
      });
      return;
    }

    const battle = getBattleForSocket(socket);
    if (!battle || battle.status !== "active") {
      send(socket, {
        type: "error",
        payload: { message: "No active battle found." },
      });
      return;
    }

    const attackerIndex =
      battle.player1.socket === socket
        ? 0
        : battle.player2.socket === socket
          ? 1
          : -1;

    if (attackerIndex === -1) {
      send(socket, {
        type: "error",
        payload: { message: "Battle state mismatch." },
      });
      return;
    }

    handlePlayerAction(battle, attackerIndex, techniqueId);
  }

  function handlePlayerAction(
    battle: Battle,
    attackerIndex: 0 | 1,
    techniqueId: string,
  ) {
    const technique = TECHNIQUE_LOOKUP[techniqueId];
    if (!technique) {
      send(
        getSocketByIndex(battle, attackerIndex),
        {
          type: "error",
          payload: { message: "Unknown technique." },
        },
      );
      return;
    }

    const attackerMeta = attackerIndex === 0 ? battle.player1 : battle.player2;
    const defenderMeta = attackerIndex === 0 ? battle.player2 : battle.player1;

    const randomBonus = Math.floor(Math.random() * 26); // 0 - 25
    const damage = technique.power + randomBonus;

    if (attackerIndex === 0) {
      battle.player2HP = Math.max(0, battle.player2HP - damage);
    } else {
      battle.player1HP = Math.max(0, battle.player1HP - damage);
    }

    battle.turns += 1;
    battle.threatMeter = Math.min(
      100,
      battle.threatMeter + 6 + Math.floor(Math.random() * 10),
    );
    battle.threatPeak = Math.max(battle.threatPeak, battle.threatMeter);

    addLog(
      battle,
      `${attackerMeta.username} used ${technique.name} on ${defenderMeta.username} (-${damage} HP)`,
    );

    sendBattleState(battle, "update");

    const defenderHP =
      attackerIndex === 0 ? battle.player2HP : battle.player1HP;
    if (defenderHP <= 0) {
      concludeBattle(battle, attackerIndex);
      return;
    }

    if (battle.threatMeter >= 100) {
      addLog(battle, "Threat level maxed out! Draw enforced.");
      concludeBattle(battle, null);
    }
  }

  function getSocketByIndex(battle: Battle, index: 0 | 1) {
    return index === 0 ? battle.player1.socket : battle.player2.socket;
  }

  function addLog(battle: Battle, message: string) {
    battle.log.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (battle.log.length > 12) {
      battle.log.shift();
    }
  }

  async function concludeBattle(battle: Battle, winnerIndex: 0 | 1 | null) {
    if (battle.status === "finished") {
      return;
    }

    battle.status = "finished";

    const winnerMeta =
      winnerIndex === null
        ? undefined
        : winnerIndex === 0
          ? battle.player1
          : battle.player2;
    const loserMeta =
      winnerIndex === null
        ? undefined
        : winnerIndex === 0
          ? battle.player2
          : battle.player1;

    try {
      await db.transaction(async (tx) => {
        if (winnerMeta) {
          await tx.execute(
            sql`update users set wins = wins + 1 where id = ${winnerMeta.dbUserId}`,
          );
        }
        if (loserMeta) {
          await tx.execute(
            sql`update users set losses = losses + 1 where id = ${loserMeta.dbUserId}`,
          );
        }

        await tx
          .insert(battles)
          .values({
            id: battle.id,
            player1Id: battle.player1.dbUserId,
            player2Id: battle.player2.dbUserId,
            winnerId: winnerMeta?.dbUserId ?? null,
            threatPeak: battle.threatPeak,
            turns: battle.turns,
          })
          .onConflictDoNothing();
      });
    } catch (error) {
      console.error("[ws] failed to persist battle", error);
    }

    sendBattleState(battle, "end", winnerIndex);
    cleanupBattle(battle);
  }

  function cleanupBattle(battle: Battle) {
    battleById.delete(battle.id);
    socketToBattleId.delete(battle.player1.socket);
    socketToBattleId.delete(battle.player2.socket);

    [battle.player1, battle.player2].forEach((meta) => {
      send(meta.socket, {
        type: "battle:complete",
        payload: { battleId: battle.id },
      });
    });
  }

  function attemptMatch() {
    while (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();
      if (!player1 || !player2) {
        continue;
      }

      if (!isSocketOpen(player1.socket)) {
        continue;
      }
      if (!isSocketOpen(player2.socket)) {
        waitingQueue.unshift(player1);
        continue;
      }

      startBattle(player1, player2);
    }
  }

  function startBattle(player1: PlayerMeta, player2: PlayerMeta) {
    const battle: Battle = {
      id: randomUUID(),
      player1,
      player2,
      player1HP: MAX_HEALTH,
      player2HP: MAX_HEALTH,
      threatMeter: 12,
      threatPeak: 12,
      turns: 0,
      status: "active",
      log: [`${player1.username} versus ${player2.username}`],
      createdAt: new Date(),
    };

    battleById.set(battle.id, battle);
    socketToBattleId.set(player1.socket, battle.id);
    socketToBattleId.set(player2.socket, battle.id);

    sendBattleState(battle, "start");
  }

  function sendBattleState(
    battle: Battle,
    phase: "start" | "update" | "end",
    winnerIndex?: 0 | 1 | null,
  ) {
    const winnerLabel =
      phase === "end"
        ? winnerIndex === null
          ? "draw"
          : winnerIndex === 0
            ? "player1"
            : "player2"
        : undefined;

    [battle.player1, battle.player2].forEach((meta, index) => {
      if (!isSocketOpen(meta.socket)) {
        return;
      }

      const payload: BattleStatePayload = {
        id: battle.id,
        youAre: index === 0 ? "player1" : "player2",
        player1: {
          username: battle.player1.username,
          hp: battle.player1HP,
          characterId: battle.player1.characterId,
        },
        player2: {
          username: battle.player2.username,
          hp: battle.player2HP,
          characterId: battle.player2.characterId,
        },
        threat: battle.threatMeter,
        threatPeak: battle.threatPeak,
        turns: battle.turns,
        status: battle.status,
        log: [...battle.log],
        winner: winnerLabel as BattleStatePayload["winner"],
      };

      send(meta.socket, {
        type: `battle:${phase}`,
        payload,
      });
    });
  }

  function handleDisconnect(socket: BattleSocket) {
    const meta = socketMeta.get(socket);
    socketMeta.delete(socket);

    const queueIndex = waitingQueue.findIndex((queued) => queued.socket === socket);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
    }

    const battle = getBattleForSocket(socket);
    if (!battle || battle.status !== "active") {
      return;
    }

    const opponentWins = battle.player1.socket === socket ? 1 : 0;
    addLog(
      battle,
      meta
        ? `${meta.username} disconnected. Automatic victory awarded.`
        : "Opponent disconnected. Victory awarded.",
    );
    concludeBattle(battle, opponentWins as 0 | 1);
  }

  function getBattleForSocket(socket: BattleSocket) {
    const battleId = socketToBattleId.get(socket);
    if (!battleId) return null;
    return battleById.get(battleId) ?? null;
  }

  function send(socket: BattleSocket, data: unknown) {
    if (!isSocketOpen(socket)) return;
    socket.send(JSON.stringify(data));
  }

  function isSocketOpen(socket: WebSocket) {
    return socket.readyState === WebSocket.OPEN;
  }
}

function sanitizeUsername(raw: string) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return `Sorcerer-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  return trimmed.slice(0, 24);
}

function formatCharacterId(characterId?: string) {
  if (!characterId) return "Unknown Technique";
  return characterId
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
