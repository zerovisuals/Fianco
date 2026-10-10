// Builds app/public/sample.json from one analysed corpus game so the UI can render
// before the in-browser engine is wired. Usage: node scripts/make-sample.ts [gameId]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { config } from '../core/config.ts';
import { movesFromPlies, classify, accuracy } from '../core/review.ts';
import { buildBook, epd } from '../core/book.ts';

const dir = new URL('../research/corpus/evals-d16/', import.meta.url);
const id = process.argv[2] ?? readdirSync(dir).find((f) => { const n = JSON.parse(readFileSync(new URL(f, dir), 'utf8')).plies.length; return n > 60 && n < 110; })!.replace('.json', '');
const g = JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
const book = buildBook('abcde'.split('').map((f) => readFileSync(new URL(`../data/openings-${f}.tsv`, import.meta.url), 'utf8')));
const elos = { w: g.white.elo, b: g.black.elo };
const moves = classify(movesFromPlies(g.plies), elos, config, (f) => book.has(epd(f)));
const pgn = readFileSync(new URL('../research/corpus/api-games.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.url === g.url)?.pgn ?? '';
const tag = (t: string) => pgn.match(new RegExp(`\\[${t} "([^"]*)"\\]`))?.[1] ?? '';
const whiteCp = (s: { cp?: number; mate?: number }, c: 'w' | 'b') => {
  const v = s.mate !== undefined ? (s.mate > 0 ? 10000 - s.mate : -10000 - s.mate) : s.cp ?? 0;
  return c === 'w' ? v : -v;
};
writeFileSync(new URL('../app/public/sample.json', import.meta.url), JSON.stringify({
  id, url: g.url,
  white: { name: tag('White'), elo: elos.w, ccAccuracy: g.white.acc }, black: { name: tag('Black'), elo: elos.b, ccAccuracy: g.black.acc },
  startFen: moves[0]?.fen,
  moves: moves.map((m) => ({ san: m.san, uci: m.uci, color: m.color, fen: m.fen, fenAfter: m.fenAfter, label: m.label, best: m.best.uci, bestSan: (() => { try { return new Chess(m.fen).move({ from: m.best.uci.slice(0, 2), to: m.best.uci.slice(2, 4), promotion: m.best.uci[4] }).san; } catch { return m.best.uci; } })(), evalWhite: whiteCp(m.played.score, m.color), phase: m.phase, loss: m.loss })),
  accuracy: { w: accuracy(moves, 'w', config), b: accuracy(moves, 'b', config) },
  phaseAccuracy: { w: [0, 1, 2].map((p) => accuracy(moves, 'w', config, p as 0 | 1 | 2)), b: [0, 1, 2].map((p) => accuracy(moves, 'b', config, p as 0 | 1 | 2)) },
}, null, 1));
console.log('sample', id, moves.length, 'moves');
