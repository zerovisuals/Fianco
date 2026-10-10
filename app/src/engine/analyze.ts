// In-browser review pipeline: PGN → Stockfish (WASM worker) → core classifier → Review.
import { Chess } from 'chess.js';
import { config } from '../../../core/config.ts';
import { movesFromPlies, classify, accuracy, type Ply, type Score } from '../../../core/review.ts';
import { buildBook, epd } from '../../../core/book.ts';
import type { Review } from '../types';

export type Strength = 'fast' | 'standard' | 'deep';
export const DEPTH: Record<Strength, number> = { fast: 10, standard: 14, deep: 18 };

class BrowserEngine {
  private w: Worker;
  private onLine: ((l: string) => void) | null = null;
  constructor() {
    const threads = typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated;
    this.w = new Worker(threads ? '/engine/stockfish-17.1-lite-51f59da.js' : '/engine/stockfish-17.1-lite-single-03e3232.js');
    this.w.onmessage = (e) => this.onLine?.(String(e.data));
    this.send('uci');
    if (threads) this.send(`setoption name Threads value ${Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))}`);
    this.send('setoption name Hash value 64');
  }
  send(c: string) { this.w.postMessage(c); }
  private until(test: (l: string) => boolean, each?: (l: string) => void) {
    return new Promise<string>((res) => { this.onLine = (l) => { each?.(l); if (test(l)) { this.onLine = null; res(l); } }; });
  }
  async ready() { const p = this.until((l) => l === 'readyok'); this.send('isready'); await p; }
  async analyse(fen: string, depth: number, multipv: number) {
    this.send(`setoption name MultiPV value ${multipv}`);
    await this.ready();
    const lines = new Map<number, { score: Score; pv: string[] }>();
    const done = this.until((l) => l.startsWith('bestmove'), (l) => {
      if (!l.startsWith('info ') || !l.includes(' pv ') || /lowerbound|upperbound/.test(l)) return;
      const t = l.split(' '), at = (k: string) => t[t.indexOf(k) + 1];
      lines.set(Number(at('multipv') ?? 1), { score: t.includes('mate') ? { mate: Number(at('mate')) } : { cp: Number(at('cp')) }, pv: t.slice(t.indexOf('pv') + 1, t.indexOf('pv') + 9) });
    });
    this.send(`position fen ${fen}`); this.send(`go depth ${depth}`);
    await done;
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }
  stop() { this.w.terminate(); }
}

let bookP: Promise<Set<string>> | null = null;
const loadBook = () => (bookP ??= Promise.all('abcde'.split('').map((f) => fetch(`/openings/openings-${f}.tsv`).then((r) => r.text()))).then(buildBook));

const tag = (pgn: string, t: string) => pgn.match(new RegExp(`\\[${t} "([^"]*)"\\]`))?.[1];
const whiteCp = (s: Score, c: 'w' | 'b') => { const v = s.mate !== undefined ? (s.mate > 0 ? 10000 - s.mate : -10000 - s.mate) : s.cp ?? 0; return c === 'w' ? v : -v; };
const san = (fen: string, uci: string) => { try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return uci; } };
const pvSan = (fen: string, pv: string[]) => { const c = new Chess(fen); const out: string[] = []; for (const u of pv.slice(0, 6)) { try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } } return out; };

export async function analyzePgn(pgn: string, opts: { strength: Strength; onProgress: (p: number) => void; signal?: AbortSignal }): Promise<Review> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const hist = chess.history({ verbose: true });
  if (!hist.length) throw new Error('This PGN has no moves.');
  const book = await loadBook();
  const engine = new BrowserEngine();
  const plies: Ply[] = [];
  const depth = DEPTH[opts.strength];
  try {
    for (let i = 0; i <= hist.length; i++) {
      if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const fen = i < hist.length ? hist[i].before : hist[hist.length - 1].after;
      const board = new Chess(fen);
      if (board.isGameOver()) { plies.push({ fen, over: true, mate: board.isCheckmate() }); break; }
      const lines = await engine.analyse(fen, depth, 2);
      plies.push({ fen, lines, played: i < hist.length ? { uci: hist[i].lan, san: hist[i].san } : null });
      opts.onProgress((i + 1) / (hist.length + 1));
    }
  } finally { engine.stop(); }

  const elos = { w: Number(tag(pgn, 'WhiteElo')) || 1500, b: Number(tag(pgn, 'BlackElo')) || 1500 };
  const moves = classify(movesFromPlies(plies), elos, config, (f) => book.has(epd(f)));
  return {
    white: { name: tag(pgn, 'White') || 'White', elo: elos.w }, black: { name: tag(pgn, 'Black') || 'Black', elo: elos.b },
    startFen: moves[0]?.fen ?? new Chess().fen(),
    moves: moves.map((m, i) => ({
      san: m.san, uci: m.uci, color: m.color, fen: m.fen, fenAfter: m.fenAfter, label: m.label, sub: m.sub,
      best: m.best.uci, bestSan: san(m.fen, m.best.uci), bestLine: pvSan(m.fen, plies[m.ply]?.lines?.[0]?.pv ?? []),
      reply: m.reply ?? [], evalWhite: whiteCp(m.played.score, m.color), phase: m.phase, loss: m.loss,
      epBest: m.epBest, epPlayed: m.epPlayed, elo: elos[m.color], prevLoss: i > 0 ? moves[i - 1].loss : 0,
    })),
    accuracy: { w: accuracy(moves, 'w', config), b: accuracy(moves, 'b', config) },
    phaseAccuracy: { w: [0, 1, 2].map((p) => accuracy(moves, 'w', config, p as 0 | 1 | 2)), b: [0, 1, 2].map((p) => accuracy(moves, 'b', config, p as 0 | 1 | 2)) },
    rating: null,
    meta: { result: tag(pgn, 'Result'), date: tag(pgn, 'Date'), timeControl: tag(pgn, 'TimeControl'), strength: opts.strength, depth, site: tag(pgn, 'Site') },
  };
}

/** Recent games from chess.com's public API (read-only). */
export async function chesscomGames(user: string) {
  const u = user.trim().toLowerCase();
  const arch = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  if (!arch.ok) throw new Error(arch.status === 404 ? `No chess.com player called "${user}".` : 'chess.com did not answer. Try again in a moment.');
  const months: string[] = (await arch.json()).archives ?? [];
  const games: { url: string; pgn: string; white: string; black: string; whiteElo: number; blackElo: number; result: string; time: string; end: number }[] = [];
  for (const m of months.slice(-2).reverse()) {
    const d = await (await fetch(m)).json();
    for (const g of (d.games ?? []).reverse()) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      games.push({ url: g.url, pgn: g.pgn, white: g.white.username, black: g.black.username, whiteElo: g.white.rating, blackElo: g.black.rating,
        result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '½-½', time: g.time_class, end: g.end_time });
    }
    if (games.length >= 30) break;
  }
  return games.slice(0, 30);
}

/** chess.com avatar URL (public API). The image host sends CORP: cross-origin, so it loads under COEP. */
export async function chesscomAvatar(user: string): Promise<string | null> {
  try { const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`); return r.ok ? ((await r.json()).avatar ?? null) : null; } catch { return null; }
}
