// For every corpus game: evaluate each position (MultiPV 2) and a null-move
// probe, cache to research/corpus/evals/<id>.json. Re-runs skip cached games.
// Usage: node scripts/analyze-corpus.ts [depth=16] [limit] [shard/shards]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { Engine } from '../core/engine-node.ts';

const depth = Number(process.argv[2] ?? 16);
const limit = Number(process.argv[3] ?? Infinity);
const [shard, shards] = (process.argv[4] ?? '0/1').split('/').map(Number);
const all = readFileSync(new URL('../research/corpus/api-games.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
// Games in the chess.com review queue first: they get both labels and accuracy as ground truth.
const prio = new Set(readFileSync(new URL('../research/capture/queue-balanced.txt', import.meta.url), 'utf8').match(/\d{6,}/g) ?? []);
const idOf = (g: { url: string }) => g.url.split('/').pop()!;
const corpus = [...all.filter((g) => prio.has(idOf(g))), ...all.filter((g) => !prio.has(idOf(g)))];
const withNull = process.argv.includes('--null');
const dir = new URL(`../research/corpus/evals-d${depth}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

const nullFen = (fen: string) => {
  const f = fen.split(' '); f[1] = f[1] === 'w' ? 'b' : 'w'; f[3] = '-'; return f.join(' ');
};

const engine = new Engine(2, 64);
await engine.ready();
let n = 0;
for (const [gi, g] of corpus.entries()) {
  if (n >= limit) break;
  if (gi % shards !== shard) continue;
  const id = g.url.split('/').pop();
  const file = new URL(`${id}.json`, dir);
  if (existsSync(file)) { n++; continue; }
  const chess = new Chess();
  chess.loadPgn(g.pgn);
  const moves = chess.history({ verbose: true });
  const clocks = [...g.pgn.matchAll(/\[%clk ([0-9:.]+)\]/g)].map((m: RegExpMatchArray) => m[1]);
  const plies = [];
  engine.newGame();
  for (let i = 0; i <= moves.length; i++) {
    const fen = i < moves.length ? moves[i].before : moves[moves.length - 1].after;
    const board = new Chess(fen);
    if (board.isGameOver()) { plies.push({ fen, over: true, mate: board.isCheckmate() }); break; }
    const a = await engine.analyse(fen, { depth, multipv: 2 });
    // Null move: what the opponent threatens if we pass (skip when in check).
    const nm = !withNull || board.inCheck() ? null : await engine.analyse(nullFen(fen), { depth: Math.min(10, depth), multipv: 1 });
    plies.push({
      fen, turn: fen.split(' ')[1],
      lines: a.lines.map((l) => ({ score: l.score, pv: l.pv.slice(0, 8) })),
      nullMove: nm?.lines[0] ? { score: nm.lines[0].score, pv: nm.lines[0].pv.slice(0, 4) } : null,
      played: i < moves.length ? { uci: moves[i].lan, san: moves[i].san, clock: clocks[i] ?? null } : null,
    });
  }
  writeFileSync(file, JSON.stringify({ url: g.url, white: g.white, black: g.black, time_control: g.time_control, plies }));
  n++;
  if (n % 10 === 0) console.log(`${n} games`);
}
engine.quit();
console.log('done', n);
