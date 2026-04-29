# Architecture

Caro Multiplayer is a single Node.js service with a React client and a Socket.IO realtime backend. The shared folder owns the game contracts and pure rules so the client and server can evolve against the same data model.

## Runtime Model

- Express serves the production React bundle from `client/dist`.
- Socket.IO owns room membership, reconnects, turn changes, moves, winners, and room list broadcasts.
- Room state is in memory. A process restart clears all active rooms.
- The browser stores player identity and local play history in `localStorage`.

## Source Layout

```text
client/
  src/
    App.tsx              Socket lifecycle, routing state, room orchestration
    components/          Reusable UI components for board, players, and sheets
    screens/             Route-level UI composition
    lib/                 Browser storage helpers
    utils/               Navigation and history mapping helpers
server/
  index.ts               Express and Socket.IO bootstrap
  config.ts              Environment and path configuration
  socketHandlers.ts      Socket.IO event handlers and realtime flow
  lib/
    acks.ts              Typed acknowledgement helpers
    roomLifecycle.ts     Player creation, host reassignment, turn lifecycle
    roomStore.ts         In-memory room store and room summaries
shared/
  game.ts                Pure board, turn, win, and naming helpers
  types.ts               Shared TypeScript contracts and Socket.IO event types
tests/
  game.test.ts           Unit tests for pure shared rules
```

## Client Boundaries

`client/src/App.tsx` is intentionally a container. It creates the Socket.IO client, owns route-derived state, handles acknowledgements, and passes stable callbacks to screens.

Route-level layout belongs in `client/src/screens`:

- `HomeScreen` renders room creation, room list, status, and local history entry points.
- `JoinGateScreen` renders the name gate for direct room URLs.
- `GameScreen` composes the play surface, player rail, and bottom sheets.

Reusable UI belongs in `client/src/components`:

- `GameBoard` owns board viewport, panning, cell rendering, move submission, and win highlighting.
- `PlayerRail` and `PlayerIcon` render compact player identity.
- `HistorySheet`, `RenameSheet`, and `SettingsSheet` render modal-like overlays.

Browser persistence belongs in `client/src/lib/storage.ts`. Data conversion that is not UI-specific belongs in `client/src/utils`.

## Server Boundaries

`server/index.ts` should stay thin: create Express, create the HTTP server, configure Socket.IO, register handlers, and start listening.

`server/socketHandlers.ts` maps Socket.IO events to lifecycle operations. Keep request validation, ack responses, and broadcast decisions here.

`server/lib/roomLifecycle.ts` owns state transitions for rooms and players. Add lifecycle behavior here when it is not tied to one specific Socket.IO event.

`server/lib/roomStore.ts` is the only module that should directly access the in-memory room map.

## Shared Rules

`shared/game.ts` should remain pure and side-effect free. It is the right place for board coordinates, win detection, turn selection, display-name uniqueness, and room/player status normalization.

`shared/types.ts` is the source of truth for room state and Socket.IO events. When adding an event, update the types first, then implement server handling, then client consumption.

## Naming Conventions

- Components and screens use PascalCase file names.
- Utility and server helper modules use camelCase file names.
- Socket.IO event names use `domain:action`, for example `room:create` and `game:move`.
- Local storage keys use the `caro.` prefix.
- Room slugs are URL-safe lowercase identifiers generated from room names.

## Extension Guide

- Add new game rules in `shared/game.ts` and cover them in `tests/game.test.ts`.
- Add new realtime commands by updating `shared/types.ts`, then `server/socketHandlers.ts`.
- Add new room lifecycle state in `server/lib/roomLifecycle.ts`.
- Add new reusable UI in `client/src/components`; use `client/src/screens` only for screen composition.
- Keep server state serializable. Room objects are emitted directly to clients.
