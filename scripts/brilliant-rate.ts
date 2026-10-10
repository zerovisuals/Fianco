// How often each label fires over the analysed public corpus (sanity check for rare labels).
import { readFileSync, readdirSync } from 'node:fs';
import { config } from '../core/config.ts';
import { reviewGame } from '../core/review.ts';
const ref = new Set((JSON.parse(readFileSync(new URL('../data/book-chesscom-ref.json', import.meta.url), 'utf8')) as string[]).map((f) => f.split(' ').slice(0, 3).join(' ')));
const isBook = (fen: string) => ref.has(fen.split(' ').slice(0, 3).join(' '));
const dir = new URL('../research/corpus/evals-d16/', import.meta.url);
const counts: Record<string, number> = {}; let games = 0, moves = 0; const examples: string[] = [];
for (const f of readdirSync(dir)) {
  const g = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); games++;
  for (const m of reviewGame(g.plies, { w: g.white.elo, b: g.black.elo }, config, isBook)) {
    moves++; counts[m.label] = (counts[m.label] ?? 0) + 1;
    if (m.label === 'brilliant' && examples.length < 12) examples.push(`${g.url} ply ${m.ply} ${m.san} (${m.sub}) elo ${m.color === 'w' ? g.white.elo : g.black.elo}`);
  }
}
console.log(`${games} games, ${moves} moves`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(k.padEnd(11), String(v).padStart(6), `${(v / games).toFixed(2)}/game`);
console.log(examples.join('\n'));
