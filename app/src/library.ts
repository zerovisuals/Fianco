// The Library: reviewed games, favourites and saved moves, kept in this browser only (localStorage).
import { useSyncExternalStore } from 'react';
import type { Review } from './types';
import type { Label } from './labels';

export type SavedGame = { id: string; review: Review; fav: boolean; at: number };
export type SavedMove = {
  id: string; gameId: string; ply: number; san: string; label: Label; uci: string; fenAfter: string;
  moveNo: string; white: string; black: string; date?: string; at: number;
};
type Lib = { games: SavedGame[]; moves: SavedMove[] };

const KEY = 'fianco:library';
const RECENT_MAX = 20;   // recent games kept; favourites and games with saved moves are never dropped
const empty: Lib = { games: [], moves: [] };

/** Stable id for a reviewed game: players, date and the moves themselves. */
export function gameId(r: Review) {
  const s = [r.white.name, r.black.name, r.meta?.date ?? '', r.moves.map((m) => m.uci).join('')].join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

let cache: Lib | null = null;
const subs = new Set<() => void>();
function read(): Lib {
  if (cache) return cache;
  try { cache = { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { cache = empty; }
  return cache!;
}
function write(next: Lib) {
  // Drop the oldest plain recents first; if storage is still full, drop more until it fits.
  const keep = (g: SavedGame) => g.fav || next.moves.some((m) => m.gameId === g.id);
  let recents = next.games.filter((g) => !keep(g)).sort((a, b) => b.at - a.at).slice(0, RECENT_MAX);
  for (;;) {
    const lib = { games: [...next.games.filter(keep), ...recents].sort((a, b) => b.at - a.at), moves: next.moves };
    try { localStorage.setItem(KEY, JSON.stringify(lib)); cache = lib; break; }
    catch { if (!recents.length) { cache = lib; break; } recents = recents.slice(0, -1); }
  }
  subs.forEach((f) => f());
}

export const library = {
  get: read,
  game: (id: string) => read().games.find((g) => g.id === id) ?? null,
  /** Called after every finished review. Keeps an existing favourite flag. */
  remember(r: Review) {
    const id = gameId(r), lib = read(), old = lib.games.find((g) => g.id === id);
    write({ ...lib, games: [{ id, review: r, fav: old?.fav ?? false, at: Date.now() }, ...lib.games.filter((g) => g.id !== id)] });
    return id;
  },
  toggleFav(r: Review) {
    const id = gameId(r), lib = read(), old = lib.games.find((g) => g.id === id);
    const g = old ? { ...old, fav: !old.fav } : { id, review: r, fav: true, at: Date.now() };
    write({ ...lib, games: [g, ...lib.games.filter((x) => x.id !== id)] });
  },
  toggleMove(r: Review, ply: number) {
    const gid = gameId(r), id = `${gid}:${ply}`, lib = read();
    if (lib.moves.some((m) => m.id === id)) return write({ ...lib, moves: lib.moves.filter((m) => m.id !== id) });
    const m = r.moves[ply];
    const games = lib.games.some((g) => g.id === gid) ? lib.games : [{ id: gid, review: r, fav: false, at: Date.now() }, ...lib.games];
    write({ games, moves: [{ id, gameId: gid, ply, san: m.san, label: m.label, uci: m.uci, fenAfter: m.fenAfter,
      moveNo: `${Math.floor(ply / 2) + 1}${m.color === 'w' ? '.' : '…'}`, white: r.white.name, black: r.black.name, date: r.meta?.date, at: Date.now() }, ...lib.moves] });
  },
  removeGame(id: string) { const lib = read(); write({ games: lib.games.filter((g) => g.id !== id), moves: lib.moves.filter((m) => m.gameId !== id) }); },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};

export const useLibrary = () => useSyncExternalStore(library.subscribe, read, () => empty);
