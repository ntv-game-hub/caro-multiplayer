# Caro Multiplayer

A mobile-first realtime Caro/Tic-Tac-Toe-style game for kids. Players do not need accounts: one player creates a room, others join from the room list or a shared room URL, and everyone plays through the browser.

The app runs as a single Node.js service: Express serves the built React frontend and Socket.IO handles realtime room/game updates.

## Features

- Realtime multiplayer rooms with Socket.IO.
- No login or registration required.
- Room URLs support reload and reconnect.
- In-memory room, board, turn, and winner state on the server.
- Local browser storage for player name, player id, and play history.
- Coordinate-based expandable board using keys like `x:y`.
- Default win condition: 5 connected pieces.
- Mobile-first pastel UI with compact room controls, player icons, turn states, board panning, and win animations.
- PM2-ready production setup.

## Tech Stack

- Frontend: React, Vite, TypeScript, lucide-react.
- Backend: Node.js, Express, Socket.IO.
- Tests: Vitest.
- Process manager: PM2.

## Project Structure

```text
client/                 React/Vite frontend
  src/
    App.tsx             Socket/session orchestration
    components/         Reusable board, player, and sheet components
    screens/            Home, join gate, and game screens
    lib/                Browser storage helpers
    utils/              Navigation and history helpers
server/                 Express + Socket.IO backend
  index.ts              Thin server bootstrap
  socketHandlers.ts     Realtime event handlers
  lib/                  Room store, lifecycle, and ack helpers
shared/                 Shared TypeScript types and pure game logic
tests/                  Vitest unit tests for shared rules
docs/                   Architecture and realtime event documentation
scripts/                Utility scripts, including realtime stress tests
ecosystem.config.cjs    PM2 app configuration
requirements.md         Product requirements
```

More detail:

- [Architecture](docs/ARCHITECTURE.md)
- [Realtime Events](docs/EVENTS.md)

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

- Frontend dev server: `http://localhost:5173`
- Backend/Socket.IO server: `http://localhost:3000`

The Vite dev server proxies `/socket.io` to the backend server.

## Production Build

```bash
npm run build
```

This builds:

- Frontend static files into `client/dist`.
- Server JavaScript into `dist/server`.
- Shared server-side modules into `dist/shared`.

## Run Production Without PM2

```bash
npm start
```

The server uses port `3000` by default. To use another port:

```bash
PORT=3001 npm start
```

After startup, open:

```text
http://localhost:3000
```

or the custom port you selected.

## Run With PM2

Start or update the app with PM2:

```bash
npm run pm2:start
```

Use a custom port if `3000` is already occupied:

```bash
PORT=3001 npm run pm2:start
```

Useful PM2 commands:

```bash
npm run pm2:restart
npm run pm2:logs
npm run pm2:stop
npm run pm2:delete
npm run pm2:save
```

To make PM2 restore the app after reboot:

```bash
npm run pm2:save
pm2 startup
```

The PM2 app name is `caro-multiplayer`.

## Ubuntu Server / LAN Access

On an Ubuntu server, install Node.js 20+ first. One common option is `nvm`:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

Then install and start the app:

```bash
cd /path/to/caro-multiplayer
npm install
HOST=0.0.0.0 PORT=3000 npm run pm2:start
npm run pm2:save
```

Find the server LAN IP:

```bash
npm run lan:ip
```

Open the app from another device on the same network:

```text
http://SERVER_LAN_IP:3000
```

For example:

```text
http://192.168.1.10:3000
```

If Ubuntu Firewall is enabled, allow the app port:

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

If port `3000` is already used, choose another port:

```bash
HOST=0.0.0.0 PORT=3001 npm run pm2:start
sudo ufw allow 3001/tcp
```

Then open:

```text
http://SERVER_LAN_IP:3001
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Network interface to bind. Use `0.0.0.0` for LAN access. |
| `PORT` | `3000` | HTTP port for Express and Socket.IO. |
| `CORS_ORIGIN` | unset | Optional CORS origin. Usually not needed because frontend and backend are served from the same origin in production. |

## Nginx Reverse Proxy Example

```nginx
server {
  server_name caro.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

If you run the app on another port, update the `proxy_pass` value.

## Storage Model

- Server state is stored in memory.
- Active rooms are lost when the Node.js process restarts.
- Browser `localStorage` stores:
  - `caro.playerName`
  - `caro.playerId`
  - `caro.history`

This is intentional for the MVP. Add Redis or a database later if rooms need to survive restarts.

## Checks

Run tests:

```bash
npm test
```

Run a full build:

```bash
npm run build
```

Run the realtime stress test against a running server:

```bash
npm run stress
```

By default this connects to `http://127.0.0.1:3000`, creates 8 Socket.IO clients, plays 120 moves, simulates one disconnect/rejoin, and verifies that `room:leave` removes the player from the room.

To run it locally from a clean build:

```bash
npm run build
npm start
```

Then, in another terminal:

```bash
npm run stress
```

To test a deployed Render app:

```bash
SERVER_URL=https://your-app.onrender.com npm run stress
```

Optional tuning:

```bash
CLIENTS=12 MOVES=300 SYNC_TIMEOUT_MS=5000 npm run stress
```

- `SERVER_URL`: target app URL. Default: `http://127.0.0.1:3000`.
- `CLIENTS`: number of simulated players. Default: `8`.
- `MOVES`: number of moves to submit. Default: `120`.
- `SYNC_TIMEOUT_MS`: max wait for all connected clients to receive each state update. Default: `2500`.

## Notes

- The app is designed as a playable MVP, not a serverless deployment.
- A single port serves both the frontend and Socket.IO in production.
- PM2 runs one forked instance because realtime game state is in memory.
