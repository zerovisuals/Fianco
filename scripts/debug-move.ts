// Debug one game's labels with our engine at a given depth: node scripts/debug-move.ts <pgnfile> [depth] [fromPly]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { Engine } from '../core/engine-node.ts';
import { config } from '../core/config.ts';
import { movesFromPlies, classify } from '../core/review.ts';
const [file, d = '14', from = '0'] = process.argv.slice(2);
const c = new Chess(); c.loadPgn(readFileSync(file, 'utf8'));
const h = c.history({ verbose: true });
const e = new Engine(4, 64); await e.ready();
const plies = [];
for (let i = 0; i <= h.length; i++) {
  const fen = i < h.length ? h[i].before : h[h.length - 1].after;
  const b = new Chess(fen);
  if (b.isGameOver()) { plies.push({ fen, over: true, mate: b.isCheckmate() }); break; }
  const a = await e.analyse(fen, { depth: Number(d), multipv: 2 });
  plies.push({ fen, lines: a.lines.map((l) => ({ score: l.score, pv: l.pv.slice(0, 6) })), played: i < h.length ? { uci: h[i].lan, san: h[i].san } : null });
}
e.quit();
const r = classify(movesFromPlies(plies), { w: 1500, b: 1500 }, config, () => false);
for (const m of r.slice(Number(from))) console.log(m.ply, m.san.padEnd(7), m.label.padEnd(10), 'best', m.best.uci, JSON.stringify(m.best.score), 'played', JSON.stringify(m.played.score), 'loss', m.loss.toFixed(3), m.sub ?? '');
