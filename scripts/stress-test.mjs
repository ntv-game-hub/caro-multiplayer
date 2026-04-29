import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:3000";
const CLIENTS = Number(process.env.CLIENTS || 8);
const MOVES = Number(process.env.MOVES || 120);
const SYNC_TIMEOUT_MS = Number(process.env.SYNC_TIMEOUT_MS || 2500);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function onceWithTimeout(socket, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (...args) => {
      clearTimeout(timer);
      resolve(args);
    };
    socket.once(event, onEvent);
  });
}

function emitAck(socket, event, payload, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      if (!response?.ok) {
        reject(new Error(`${event} failed: ${response?.error || "unknown error"}`));
        return;
      }
      resolve(response.data);
    });
  });
}

function connectClient(index) {
  const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 1000,
    timeout: 5000
  });

  const client = {
    index,
    playerId: `stress-player-${index}`,
    playerName: `Stress ${index}`,
    socket,
    room: undefined,
    disconnects: 0,
    reconnects: 0
  };

  socket.on("room:state", (room) => {
    client.room = room;
  });
  socket.on("game:move-applied", (room) => {
    client.room = room;
  });
  socket.on("game:winner", (room) => {
    client.room = room;
  });
  socket.on("game:ended", (room) => {
    client.room = room;
  });
  socket.on("disconnect", () => {
    client.disconnects += 1;
  });
  socket.io.on("reconnect", () => {
    client.reconnects += 1;
  });

  return client;
}

async function waitForSync(clients, moves, timeoutMs = SYNC_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const active = clients.filter((client) => client.socket.connected);
    if (active.length > 0 && active.every((client) => client.room?.game?.moves?.length === moves)) return;
    await sleep(20);
  }

  const lengths = clients.map((client) => ({
    index: client.index,
    connected: client.socket.connected,
    moves: client.room?.game?.moves?.length
  }));
  throw new Error(`Clients did not sync to ${moves} moves: ${JSON.stringify(lengths)}`);
}

function nextOpenCell(room) {
  const candidates = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 0],
    [0, 2],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 0],
    [0, 3],
    [3, 1],
    [1, 3],
    [3, 2],
    [2, 3],
    [3, 3]
  ];

  for (let radius = 0; radius < 80; radius += 1) {
    for (const [baseX, baseY] of candidates) {
      const points = [
        [baseX + radius, baseY],
        [baseX, baseY + radius],
        [baseX + radius, baseY + radius],
        [-baseX - radius, baseY],
        [baseX, -baseY - radius]
      ];
      for (const [x, y] of points) {
        const key = `${x}:${y}`;
        if (!room.game.board[key]) return { x, y };
      }
    }
  }

  throw new Error("No open cell found");
}

async function main() {
  const clients = Array.from({ length: CLIENTS }, (_, index) => connectClient(index + 1));
  await Promise.all(clients.map((client) => onceWithTimeout(client.socket, "connect", 5000)));

  const host = clients[0];
  const created = await emitAck(host.socket, "room:create", {
    roomName: `Stress ${Date.now()}`,
    maxPlayers: CLIENTS,
    playerName: host.playerName,
    playerId: host.playerId
  });
  host.room = created.room;
  const slug = created.room.slug;

  for (const client of clients.slice(1)) {
    const joined = await emitAck(client.socket, "room:join", {
      roomSlug: slug,
      playerName: client.playerName,
      playerId: client.playerId
    });
    client.room = joined.room;
  }

  await waitForSync(clients, 0);

  const latencies = [];
  for (let moveIndex = 0; moveIndex < MOVES; moveIndex += 1) {
    const reference = host.room;
    if (reference.game.status !== "playing") break;

    if (moveIndex === 30) {
      const mobileLike = clients[2];
      mobileLike.socket.disconnect();
      await sleep(300);
      mobileLike.socket.connect();
      await onceWithTimeout(mobileLike.socket, "connect", 5000);
      const rejoined = await emitAck(mobileLike.socket, "room:join", {
        roomSlug: slug,
        playerName: mobileLike.playerName,
        playerId: mobileLike.playerId
      });
      mobileLike.room = rejoined.room;
      await waitForSync(clients, reference.game.moves.length);
    }

    const currentClient = clients.find((client) => client.playerId === reference.game.currentPlayerId);
    if (!currentClient) throw new Error(`No client for current player ${reference.game.currentPlayerId}`);

    const move = nextOpenCell(reference);
    const started = performance.now();
    currentClient.socket.emit("game:move", move);
    await waitForSync(clients, reference.game.moves.length + 1);
    latencies.push(performance.now() - started);
  }

  const leaver = clients[CLIENTS - 1];
  leaver.socket.emit("room:leave");
  await sleep(250);
  const expectedPlayers = CLIENTS - 1;
  const activeClients = clients.slice(0, -1);
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (activeClients.every((client) => client.room?.players?.length === expectedPlayers)) break;
    await sleep(20);
  }
  if (!activeClients.every((client) => client.room?.players?.length === expectedPlayers)) {
    throw new Error(`Leave did not remove player. Counts: ${activeClients.map((client) => client.room?.players?.length).join(",")}`);
  }

  for (const client of clients) client.socket.disconnect();

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const max = latencies.at(-1) || 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        server: SERVER_URL,
        clients: CLIENTS,
        movesApplied: latencies.length,
        syncLatencyMs: {
          avg: Number(avg.toFixed(1)),
          p95: Number(p95.toFixed(1)),
          max: Number(max.toFixed(1))
        },
        disconnects: clients.map((client) => ({ index: client.index, disconnects: client.disconnects, reconnects: client.reconnects })),
        leaveRemovedPlayer: true
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
