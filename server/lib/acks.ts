import type { SocketAck } from "../../shared/types.js";

export function makeAck<T>(data: T): SocketAck<T> {
  return { ok: true, data };
}

export function makeError<T>(error: string): SocketAck<T> {
  return { ok: false, error };
}
