# Realtime Events

Socket.IO events are typed in `shared/types.ts`. Server responses that use callbacks return `SocketAck<T>`, shaped as either `{ ok: true, data }` or `{ ok: false, error }`.

## Client To Server

| Event | Payload | Ack | Notes |
| --- | --- | --- | --- |
| `rooms:list` | none | none | Sends the current public room list back to the caller via `rooms:update`. |
| `room:create` | `{ roomName, maxPlayers, playerName, playerId }` | `{ room, player }` | Creates a room, adds the creator as host, starts the game, joins the socket room. |
| `room:join` | `{ roomSlug, playerName, playerId }` | `{ room, player }` | Joins, reconnects an existing player id, or returns an error if the room is gone. |
| `room:leave` | none | none | Explicitly removes the current player from the room and may reassign host. |
| `player:rename` | `{ playerName }` | `{ room, player }` | Applies a unique display name and updates previous moves by that player. |
| `game:start` | none | none | Host-only. Starts the game when valid. |
| `game:move` | `{ x, y }` | `{ room, move }` | Places a move for the current player if the cell is empty and the game is active. |
| `game:new-round` | none | none | Host-only. Resets board, ranks, moves, and starts a new round. |
| `game:end` | none | none | Host-only. Ends the current room game. |

## Server To Client

| Event | Payload | Notes |
| --- | --- | --- |
| `rooms:update` | `RoomSummary[]` | Broadcast when room visibility or counts change. |
| `room:state` | `Room` | Canonical state sync for clients in a room. |
| `room:error` | `string` | Human-readable error for transient UI messages. |
| `game:move-applied` | `Room, Move` | Emitted after a normal move without a winner. |
| `game:winner` | `Room, Player, string[]` | Emitted when a player completes a winning line. |
| `game:ended` | `Room` | Emitted when the game is no longer playable or host ends it. |
| `player:joined` | `Room, Player` | Emitted when a new player enters. |
| `player:left` | `Room, Player` | Emitted on explicit leave or disconnect. |
| `player:reconnected` | `Room, Player` | Emitted when a stored player id rejoins the same room. |

## State Flow

1. Every socket receives `rooms:update` on connection.
2. A player creates or joins a room and receives an ack with the canonical `Room`.
3. The server emits `room:state` to all sockets in the room after membership or lifecycle changes.
4. A valid `game:move` mutates the in-memory board, checks winner state, advances the turn, and emits the relevant game event.
5. Clients treat server room payloads as authoritative and replace local room state.

## Error Handling

- Events with callbacks return typed ack errors where the client needs direct feedback.
- Broadcast-only host actions silently no-op when the caller is not host.
- `room:error` is reserved for user-facing messages that should be visible outside the callback path.
