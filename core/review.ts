// Pure review core. Two layers:
//   1. an eval source turns a game into MoveEval[] (our Stockfish plies, or chess.com's captured evals)
//   2. classify() turns MoveEval[] into labels + accuracy. No I/O.
import { Chess, type Square } from 'chess.js';
import type { Config } from './config.ts';

export type Score = { cp?: number; mate?: number };
export type Label = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'miss' | 'forced';
export type Color = 'w' | 'b';

/** One played move with evals from the mover's point of view. */
export type MoveEval = {
  ply: number; color: Color; fen: string; fenAfter: string; uci: string; san: string;
  best: { uci: string; score: Score };   // engine's best move in `fen`
  second?: { score: Score } | null;      // 2nd-best (MultiPV 2), when the source has it
  played: { score: Score };              // eval after the played move
  reply?: string[];                      // opponent's best continuation after the played move
  clockMs?: number | null;
};
export type MoveReview = MoveEval & {
  label: Label; sub?: string; epBest: number; epPlayed: number; loss: number; moveAccuracy: number | null; phase: 0 | 1 | 2;
};
export type Ply = {
  fen: string; over?: boolean; mate?: boolean;
  lines?: { score: Score; pv: string[] }[];
  played?: { uci: string; san: string; clock?: string | null } | null;
};

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const neg = (s: Score): Score => (s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) });

/** Expected points for the side whose perspective the score is in. */
export function ep(s: Score | undefined, elo: number, cfg: Config): number {
  if (!s) return 0.5;
  if (s.mate !== undefined) return s.mate > 0 ? 1 : s.mate < 0 ? 0 : 0.5;
  const k = cfg.ep.k0 + cfg.ep.k1 * (elo - 1500) / 1000;
  return 1 / (1 + Math.exp(-k * (s.cp ?? 0) / 100));
}

function material(fen: string, color: Color): number {
  let m = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = VALUE[ch.toLowerCase()]; if (v === undefined) continue;
    m += (ch === ch.toUpperCase() ? 'w' : 'b') === color ? v : -v;
  }
  return m;
}
const nonPawnMaterial = (fen: string) => [...fen.split(' ')[0]].reduce((a, ch) => a + (/[nbrqNBRQ]/.test(ch) ? VALUE[ch.toLowerCase()] : 0), 0);

function play(fen: string, ucis: string[], horizon: number) {
  const c = new Chess(fen); const fens = [fen];
  for (const u of ucis.slice(0, horizon)) {
    try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    fens.push(c.fen());
  }
  return fens;
}

/** Piece on `sq` attacked by something cheaper, or attacked and undefended. */
function hanging(c: Chess, sq: Square, color: Color): boolean {
  const p = c.get(sq); if (!p || p.color !== color || p.type === 'k') return false;
  const opp = color === 'w' ? 'b' : 'w';
  const att = c.attackers(sq, opp);
  if (!att.length) return false;
  if (Math.min(...att.map((s) => VALUE[c.get(s)!.type])) < VALUE[p.type]) return true;
  return c.attackers(sq, color).length === 0;
}

const ORDER: Record<string, number> = { p: 1, n: 3, b: 3.1, r: 5, q: 9, k: 100 };
/** Static exchange: material the side to move wins by capturing on `sq` with best recaptures (≥ 0). */
function see(c: Chess, sq: Square, depth = 0): number {
  const target = c.get(sq);
  if (!target || depth > 12) return 0;
  const caps = c.moves({ verbose: true }).filter((m) => m.to === sq && m.captured);
  if (!caps.length) return 0;
  caps.sort((a, b) => ORDER[a.piece] - ORDER[b.piece]);
  c.move(caps[0]);
  const v = (target.type === 'k' ? 100 : VALUE[target.type]) - see(c, sq, depth + 1);
  c.undo();
  return Math.max(0, v);
}
const flipTurn = (fen: string) => { const f = fen.split(' '); f[1] = f[1] === 'w' ? 'b' : 'w'; f[3] = '-'; return f.join(' '); };
const safeChess = (fen: string) => { try { return new Chess(fen); } catch { return null; } };

/**
 * Net material the mover offers with this move: the best SEE the opponent gets on any of the
 * mover's pieces after the move, minus what that piece already risked before, minus what the move captured.
 */
function sacrificeValue(m: MoveEval, minPiece: number): number {
  const after = new Chess(m.fenAfter);
  const before = safeChess(flipTurn(m.fen));             // opponent to move, before our move
  const captured = VALUE[new Chess(m.fen).get(m.uci.slice(2, 4) as Square)?.type ?? 'k'] ?? 0;
  let best = 0;
  for (const p of after.board().flat()) {
    if (!p || p.color !== m.color || p.type === 'k' || VALUE[p.type] < minPiece) continue;
    const s = see(after, p.square);
    if (s <= 0) continue;
    const origin = p.square === m.uci.slice(2, 4) ? m.uci.slice(0, 2) as Square : p.square;
    const already = before && !before.inCheck() ? see(before, origin) : 0;
    best = Math.max(best, s - already - (p.square === m.uci.slice(2, 4) ? captured : 0));
  }
  return best;
}

// ---------- eval source: our engine plies → MoveEval[] ----------
export function movesFromPlies(plies: Ply[]): MoveEval[] {
  const out: MoveEval[] = [];
  for (let i = 0; i < plies.length; i++) {
    const P = plies[i], N = plies[i + 1];
    if (!P.played || !P.lines?.length) continue;
    const color = P.fen.split(' ')[1] as Color;
    let played: Score;
    if (!N) played = P.lines[0].score;
    else if (N.over) played = N.mate ? { mate: 1 } : { cp: 0 };
    else played = neg(N.lines![0].score);
    const clk = P.played.clock?.split(':').map(Number);
    out.push({
      ply: i, color, fen: P.fen, fenAfter: N?.fen ?? P.fen, uci: P.played.uci, san: P.played.san,
      best: { uci: P.lines[0].pv[0], score: P.lines[0].score },
      second: P.lines[1] ? { score: P.lines[1].score } : null,
      played: { score: P.played.uci === P.lines[0].pv[0] ? P.lines[0].score : played },
      reply: N?.lines?.[0]?.pv ?? [],
      clockMs: clk ? ((clk[0] * 60 + clk[1]) * 60 + clk[2]) * 1000 : null,
    });
  }
  return out;
}

// ---------- classification ----------
export function classify(moves: MoveEval[], elos: Record<Color, number>, cfg: Config, isBook: (fen: string) => boolean): MoveReview[] {
  const out: MoveReview[] = [];
  const bookOpen = { w: true, b: true };
  let phase: 0 | 1 | 2 = 0;
  for (const m of moves) {
    const elo = elos[m.color];
    const board = new Chess(m.fen);
    const legal = board.moves().length;
    const isTop = m.uci === m.best.uci;
    const epBest = ep(m.best.score, elo, cfg);
    const epPlayed = isTop ? epBest : ep(m.played.score, elo, cfg);
    const epSecond = m.second ? ep(m.second.score, elo, cfg) : null;
    const loss = isTop ? 0 : Math.max(0, epBest - epPlayed);

    if (phase < 2 && nonPawnMaterial(m.fenAfter) <= cfg.phase.endgameMaterial) phase = 2;
    else if (phase === 0 && (m.ply >= cfg.phase.openingMaxPly || (!bookOpen.w && !bookOpen.b))) phase = 1;

    const b = cfg.bands;
    let label: Label; let sub: string | undefined;
    if (bookOpen[m.color] && isBook(m.fenAfter)) label = 'book';
    else {
      bookOpen[m.color] = false;
      if (legal === 1) label = 'forced';
      else if (isTop || loss <= b.best) label = 'best';
      else if (loss < b.excellent) label = 'excellent';
      else if (loss < b.good) label = 'good';
      else if (loss < b.inaccuracy) label = 'inaccuracy';
      else if (loss < b.mistake) label = 'mistake';
      else label = 'blunder';
    }

    // Material consequence along the opponent's best reply line.
    const line = play(m.fenAfter, m.reply ?? [], cfg.blunder.horizon);
    const matBefore = material(m.fen, m.color);
    const matEnd = material(line[line.length - 1], m.color);
    const losesMaterial = matEnd <= matBefore - cfg.blunder.minMaterial
      || new Chess(m.fenAfter).board().flat().some((p) => p && p.color === m.color && VALUE[p.type] >= 3 && hanging(new Chess(m.fenAfter), p.square, m.color));
    const allowsMate = m.played.score.mate !== undefined && m.played.score.mate < 0;
    if (label === 'blunder' && !losesMaterial && !allowsMate) label = 'mistake';

    // Miss: the opponent just erred; we had the punishment and let it go without losing material.
    const prev = out[out.length - 1];
    if (['inaccuracy', 'mistake', 'blunder'].includes(label) && prev && prev.color !== m.color && prev.loss >= cfg.miss.oppLoss) {
      const gained = epBest - (1 - prev.epBest);  // what the opponent's error handed us
      if (gained >= cfg.miss.recoverable && loss >= cfg.miss.minLoss && !(label === 'blunder' && (losesMaterial || allowsMate))) {
        label = 'miss';
        sub = m.best.score.mate !== undefined && m.best.score.mate > 0 ? 'missedMate' : 'missedWin';
      }
    }

    // Great: the only good move, or an outcome changer.
    const g = cfg.great;
    if (label === 'best' && legal > 2 && !board.inCheck() && epBest < g.alreadyWinning) {
      const opp = m.color === 'w' ? 'b' : 'w';
      const capturedFree = m.san.includes('x') && hanging(board, m.uci.slice(2, 4) as Square, opp);
      const need = g.gapBase + g.gapEloSlope * (elo - 1500) / 1000;
      const gap = epSecond !== null ? epBest - epSecond : null;
      const before = prev ? 1 - prev.epBest : 0.5;
      const changesOutcome = (before < g.losing && epPlayed >= g.losing) || (before < g.winning && epPlayed >= g.winning);
      if (!capturedFree && ((gap !== null && gap >= need) || (changesOutcome && (gap === null || gap >= need / 2)))) label = 'great';
    }

    // Brilliant: a good piece sacrifice.
    const br = cfg.brilliant;
    const recapture = !!prev && prev.uci.slice(2, 4) === m.uci.slice(2, 4) && prev.san.includes('x');
    if (['best', 'great', 'excellent'].includes(label) && !m.uci[4] && !board.inCheck() && !recapture && epPlayed >= br.floor && (epSecond ?? epBest) < br.alreadyWinning) {
      const low = elo < br.lowEloCut;
      const sac = sacrificeValue(m, low ? br.minValueLow : br.minValueHigh);
      if (sac >= (low ? br.netLossLow : br.netLossHigh)) { label = 'brilliant'; sub = `sacrifice ${sac}`; }
    }

    out.push({ ...m, label, sub, epBest, epPlayed, loss, moveAccuracy: null, phase });
  }
  const a = cfg.accuracy;
  for (const r of out) if (r.label !== 'book' && r.label !== 'forced') r.moveAccuracy = Math.max(a.floor, Math.min(100, a.a * Math.exp(-a.b * r.loss) - a.c));
  return out;
}

/** Back-compat: engine plies straight to reviews. */
export const reviewGame = (plies: Ply[], elos: Record<Color, number>, cfg: Config, isBook: (fen: string) => boolean) =>
  classify(movesFromPlies(plies), elos, cfg, isBook);

export function powerMean(xs: number[], p: number) {
  if (!xs.length) return null;
  if (Math.abs(p) < 1e-6) return Math.exp(xs.reduce((s, x) => s + Math.log(Math.max(x, 1e-3)), 0) / xs.length);
  return Math.pow(xs.reduce((s, x) => s + Math.pow(Math.max(x, 1e-3), p), 0) / xs.length, 1 / p);
}

export function accuracy(moves: MoveReview[], color: Color, cfg: Config, phase?: 0 | 1 | 2) {
  const xs = moves.filter((m) => m.color === color && m.moveAccuracy !== null && (phase === undefined || m.phase === phase)).map((m) => m.moveAccuracy!);
  return powerMean(xs, cfg.accuracy.p);
}
