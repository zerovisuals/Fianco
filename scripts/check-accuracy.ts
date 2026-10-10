// Sanity check: core accuracy() vs chess.com API accuracies on the analysed public corpus.
import { readFileSync, readdirSync } from 'node:fs';
import { config } from '../core/config.ts';
import { movesFromPlies, classify, accuracy } from '../core/review.ts';
const dir = new URL('../research/corpus/evals-d16/', import.meta.url);
const errs: number[] = [];
for (const f of readdirSync(dir)) {
  const g = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  const r = classify(movesFromPlies(g.plies), { w: g.white.elo, b: g.black.elo }, config, () => false);
  for (const [c, k] of [['w', 'white'], ['b', 'black']] as const) {
    const a = accuracy(r, c, config); if (a !== null && r.filter((m) => m.color === c).length >= 8) errs.push(Math.abs(a - g[k].acc));
  }
}
errs.sort((x, y) => x - y);
console.log(`sides ${errs.length}  MAE ${(errs.reduce((s, x) => s + x, 0) / errs.length).toFixed(2)}  median ${errs[errs.length >> 1].toFixed(2)}  within 3: ${(100 * errs.filter((e) => e <= 3).length / errs.length).toFixed(0)}%`);
