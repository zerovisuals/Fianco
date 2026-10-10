// Builds research/corpus/api-games.jsonl: public chess.com games that carry
// chess.com's own accuracy (CAPS2), sampled across rating bands.
// Sequential requests with a pause — the public API asks for serial access.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../research/corpus/api-games.jsonl', import.meta.url);
const UA = { 'User-Agent': 'chess-review research (local, low-rate)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r.json();
    if (r.status === 429) await sleep(5000); else return null;
  }
  return null;
};

const PER_BAND = Number(process.argv[2] ?? 120);
const bands = [[400, 800], [800, 1200], [1200, 1600], [1600, 2000], [2000, 2400], [2400, 3400]];
const counts = Object.fromEntries(bands.map((b) => [b.join('-'), 0]));
const seen = new Set();
mkdirSync(new URL('../research/corpus/', import.meta.url), { recursive: true });
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) {
  const g = JSON.parse(l); seen.add(g.url); counts[g.band] = (counts[g.band] ?? 0) + 1;
}
const bandOf = (e) => bands.find(([lo, hi]) => e >= lo && e < hi)?.join('-');
const lines = [];
const flush = () => { if (lines.length) { writeFileSync(OUT, lines.join('\n') + '\n', { flag: 'a' }); lines.length = 0; } };

// Seed players: start from a few public games' opponents and snowball outward.
const queue = [];
// Random ordinary accounts from public country lists reach the low-rating bands.
for (const cc of ['US', 'IN', 'GB', 'BR', 'PH', 'DE', 'FR', 'ES']) {
  const list = (await get(`https://api.chess.com/pub/country/${cc}/players`))?.players ?? []; await sleep(400);
  for (let i = 0; i < 150 && list.length; i++) queue.push(list[Math.floor(Math.random() * list.length)].toLowerCase());
}
queue.sort(() => Math.random() - 0.5);
const visited = new Set();
while (queue.length && Object.values(counts).some((c) => c < PER_BAND)) {
  const user = queue.shift();
  if (visited.has(user)) continue; visited.add(user);
  const arch = await get(`https://api.chess.com/pub/player/${user}/games/archives`); await sleep(400);
  const months = arch?.archives?.slice(-2) ?? [];
  for (const m of months) {
    const data = await get(m); await sleep(400);
    for (const g of data?.games ?? []) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      for (const side of ['white', 'black']) {
        const opp = g[side]?.username?.toLowerCase();
        if (opp && !visited.has(opp) && queue.length < 4000) queue.push(opp);
      }
      if (!g.accuracies || seen.has(g.url)) continue;
      const avg = (g.white.rating + g.black.rating) / 2;
      const band = bandOf(avg);
      if (!band || counts[band] >= PER_BAND || Math.abs(g.white.rating - g.black.rating) > 300) continue;
      seen.add(g.url); counts[band]++;
      lines.push(JSON.stringify({
        url: g.url, band, time_class: g.time_class, time_control: g.time_control, rated: g.rated,
        white: { elo: g.white.rating, acc: g.accuracies.white }, black: { elo: g.black.rating, acc: g.accuracies.black },
        pgn: g.pgn,
      }));
    }
    flush();
  }
  // Prefer users from under-filled bands: shuffle queue lightly.
  if (visited.size % 10 === 0) { queue.sort(() => Math.random() - 0.5); console.log(JSON.stringify(counts)); }
}
flush();
console.log('done', JSON.stringify(counts));
