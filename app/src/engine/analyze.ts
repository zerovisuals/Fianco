// In-browser review pipeline: PGN → Stockfish (WASM worker) → core classifier → Review.
import { Chess } from 'chess.js';
import { config } from '../../../core/config.ts';
import { movesFromPlies, classify, accuracy, gameRating, type Ply, type Score } from '../../../core/review.ts';
import { buildBook, epd } from '../../../core/book.ts';
import type { Review } from '../types';

export type Strength = 'fast' | 'standard' | 'deep';
export const DEPTH: Record<Strength, number> = { fast: 12, standard: 16, deep: 20 };

/**
 * One single-threaded Stockfish per worker. Each position is searched from a cleared hash, so a position
 * always gets the same result: reviews are reproducible ("same answer every time"). Speed comes from
 * running several of these in parallel on different positions.
 */
class BrowserEngine {
  private w: Worker;
  private onLine: ((l: string) => void) | null = null;
  constructor() {
    this.w = new Worker('/engine/stockfish-17.1-lite-single-03e3232.js');
    this.w.onmessage = (e) => this.onLine?.(String(e.data));
    this.send('uci'); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 16');
  }
  send(c: string) { this.w.postMessage(c); }
  private until(test: (l: string) => boolean, each?: (l: string) => void) {
    return new Promise<string>((res) => { this.onLine = (l) => { each?.(l); if (test(l)) { this.onLine = null; res(l); } }; });
  }
  async ready() { const p = this.until((l) => l === 'readyok'); this.send('isready'); await p; }
  async analyse(fen: string, depth: number, multipv: number, searchmoves?: string) {
    this.send('ucinewgame');
    this.send(`setoption name MultiPV value ${multipv}`);
    await this.ready();
    const lines = new Map<number, { score: Score; pv: string[] }>();
    const done = this.until((l) => l.startsWith('bestmove'), (l) => {
      if (!l.startsWith('info ') || !l.includes(' pv ') || /lowerbound|upperbound/.test(l)) return;
      const t = l.split(' '), at = (k: string) => t[t.indexOf(k) + 1];
      lines.set(Number(at('multipv') ?? 1), { score: t.includes('mate') ? { mate: Number(at('mate')) } : { cp: Number(at('cp')) }, pv: t.slice(t.indexOf('pv') + 1, t.indexOf('pv') + 9) });
    });
    this.send(`position fen ${fen}`); this.send(`go depth ${depth}${searchmoves ? ` searchmoves ${searchmoves}` : ''}`);
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
  const depth = DEPTH[opts.strength];
  // Positions to search, up to the first finished position.
  const fens: string[] = [];
  for (let i = 0; i <= hist.length; i++) {
    const fen = i < hist.length ? hist[i].before : hist[hist.length - 1].after;
    fens.push(fen);
    if (new Chess(fen).isGameOver()) break;
  }
  const plies: Ply[] = new Array(fens.length);
  const workers = Array.from({ length: Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1)) }, () => new BrowserEngine());
  let next = 0, done = 0;
  const job = async (engine: BrowserEngine) => {
    for (let i = next++; i < fens.length; i = next++) {
      if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const fen = fens[i], board = new Chess(fen);
      if (board.isGameOver()) { plies[i] = { fen, over: true, mate: board.isCheckmate() }; }
      else {
        const lines = await engine.analyse(fen, depth, 2);
        const uci = i < hist.length ? hist[i].lan : null;
        // Score the played move from this root at the same depth, so best and played are compared like for like.
        let playedScore = uci ? lines.find((l) => l.pv[0] === uci)?.score : undefined;
        if (uci && !playedScore) playedScore = (await engine.analyse(fen, depth, 1, uci))[0]?.score;
        plies[i] = { fen, lines, played: uci ? { uci, san: hist[i].san } : null, playedScore };
      }
      opts.onProgress(++done / fens.length);
    }
  };
  try { await Promise.all(workers.map(job)); } finally { workers.forEach((w) => w.stop()); }

  const realW = Number(tag(pgn, 'WhiteElo')) || null, realB = Number(tag(pgn, 'BlackElo')) || null;
  const elos = { w: realW ?? 1500, b: realB ?? 1500 };
  const moves = classify(movesFromPlies(plies), elos, config, (f) => book.has(epd(f)));
  return {
    white: { name: tag(pgn, 'White') || 'White', elo: realW ?? 0 }, black: { name: tag(pgn, 'Black') || 'Black', elo: realB ?? 0 },
    startFen: moves[0]?.fen ?? new Chess().fen(),
    moves: moves.map((m, i) => ({
      san: m.san, uci: m.uci, color: m.color, fen: m.fen, fenAfter: m.fenAfter, label: m.label, sub: m.sub,
      best: m.best.uci, bestSan: san(m.fen, m.best.uci), bestLine: pvSan(m.fen, plies[m.ply]?.lines?.[0]?.pv ?? []),
      reply: m.reply ?? [], evalWhite: whiteCp(m.played.score, m.color), phase: m.phase, loss: m.loss,
      epBest: m.epBest, epPlayed: m.epPlayed, elo: elos[m.color], prevLoss: i > 0 ? moves[i - 1].loss : 0,
    })),
    accuracy: { w: accuracy(moves, 'w', config), b: accuracy(moves, 'b', config) },
    ratingEst: {
      w: gameRating(accuracy(moves, 'w', config), realW, realB, config),
      b: gameRating(accuracy(moves, 'b', config), realB, realW, config),
    },
    phaseAccuracy: { w: [0, 1, 2].map((p) => accuracy(moves, 'w', config, p as 0 | 1 | 2)), b: [0, 1, 2].map((p) => accuracy(moves, 'b', config, p as 0 | 1 | 2)) },
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
