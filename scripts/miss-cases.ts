// Sanity cases for the Miss / Blunder logic, run through the same pipeline as the browser
// (one single-threaded engine, cleared hash per position, played move scored from the same root).
// Usage: node scripts/miss-cases.ts [depth]
import { Chess } from 'chess.js';
import { Engine } from '../core/engine-node.ts';
import { config } from '../core/config.ts';
import { movesFromPlies, classify, type Ply } from '../core/review.ts';
import { explain } from '../app/src/engine/explain.ts';

const depth = Number(process.argv[2] ?? 16);
const cases: { name: string; fen?: string; moves: string; expect: Record<string, string> }[] = [
  { name: 'Free queen not taken (equal game)', moves: 'e4 e5 Nf3 Nc6 Bc4 Qh4 d3', expect: { Qh4: 'blunder', d3: 'miss' } },
  { name: 'Free queen taken (control)', moves: 'e4 e5 Nf3 Nc6 Bc4 Qh4 Nxh4', expect: { Qh4: 'blunder', Nxh4: 'best' } },
  { name: 'Mate in one missed (queen hung too: Blunder wins)', moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 d3', expect: { Nf6: 'blunder', d3: 'blunder' } },
  { name: 'Mate in one missed (queen retreats)', moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qe2', expect: { Nf6: 'blunder', Qe2: 'miss' } },
  { name: 'Mate in one played (control)', moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#', expect: { Nf6: 'blunder', 'Qxf7#': 'best' } },
  { name: 'Already a piece up, free queen not taken', fen: 'r1bq1rk1/ppp2ppp/2n5/8/8/2N2N2/PPP2PPP/R1BQ1RK1 b - - 0 10', moves: 'Qd4 h3', expect: { Qd4: 'blunder', h3: 'miss' } },
  { name: 'Losing, opponent hangs the queen with check, not taken', fen: '6k1/5ppp/8/8/8/2q5/5PPP/R5K1 w - - 0 30', moves: 'h3 Qc1+ Kh2', expect: { 'Qc1+': 'blunder', Kh2: 'miss' } },
  { name: 'Losing, opponent hangs the queen, taken (control)', fen: '6k1/5ppp/8/8/8/2q5/5PPP/R5K1 w - - 0 30', moves: 'h3 Qc1+ Rxc1', expect: { Rxc1: 'best' } },
  { name: 'Queen and rook up, opponent hangs a knight, quiet move (not a Miss)', fen: '6k1/5ppp/8/3n4/8/8/3Q1PPP/3R2K1 b - - 0 30', moves: 'Kf8 h3', expect: { h3: 'not miss' } },
];

const eng = new Engine(1, 16);
async function line(fen: string, multipv: number, searchmoves?: string) {
  eng.newGame();
  return (await eng.analyse(fen, { depth, multipv, searchmoves })).lines.map((l) => ({ score: l.score, pv: l.pv }));
}
for (const c of cases) {
  const g = new Chess(c.fen);
  const plies: Ply[] = [];
  for (const san of c.moves.split(' ')) {
    const fen = g.fen(); const mv = g.move(san);
    const lines = await line(fen, 2);
    const playedScore = lines.find((l) => l.pv[0] === mv.lan)?.score ?? (await line(fen, 1, mv.lan))[0]?.score;
    plies.push({ fen, lines, played: { uci: mv.lan, san: mv.san }, playedScore });
  }
  const end = g.fen();
  plies.push(g.isGameOver() ? { fen: end, over: true, mate: g.isCheckmate() } : { fen: end, lines: await line(end, 1) });
  const res = classify(movesFromPlies(plies), { w: 1500, b: 1500 }, config, () => false);
  console.log(`\n${c.name}`);
  for (const m of res) {
    const want = c.expect[m.san];
    const ok = !want ? '' : want === 'not miss' ? (m.label !== 'miss' ? ' ok' : ' WRONG') : m.label === want ? ' ok' : ` WRONG (want ${want})`;
    const sc = (s: { cp?: number; mate?: number }) => (s.mate !== undefined ? `M${s.mate}` : String(s.cp));
    const sanOf = (fen: string, u: string) => { try { return new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch { return u; } };
    const line = (() => { const g2 = new Chess(m.fen), out: string[] = []; for (const u of plies[m.ply].lines?.[0]?.pv.slice(0, 6) ?? []) { try { out.push(g2.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } } return out; })();
    const why = explain({ ...m, best: m.best.uci, bestSan: sanOf(m.fen, m.best.uci), bestLine: line, evalWhite: 0, elo: 1500 } as never).why.join(' ');
    console.log(`  ${m.san.padEnd(7)} ${m.label.padEnd(10)} "${why}"`);
    console.log(`  ${m.san.padEnd(7)} ${m.label.padEnd(10)} best ${m.best.uci} ${sc(m.best.score)} played ${sc(m.played.score)} loss ${m.loss.toFixed(3)} epBest ${m.epBest.toFixed(3)}${m.sub ? ` [${m.sub}]` : ''}${ok}`);
  }
}
eng.quit();
