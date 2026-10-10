// Fresh-hash, single-thread analysis of one position: node scripts/debug-pos.ts "<fen>" depth [searchmove]
import { Engine } from '../core/engine-node.ts';
const [fen, d = '14', sm] = process.argv.slice(2);
const e = new Engine(1, 16); await e.ready();
for (const depth of [10, 12, 14, 16, 18]) {
  e.newGame(); await e.ready();
  const a = await e.analyse(fen, { depth, multipv: 2 });
  e.newGame(); await e.ready();
  const s = sm ? await e.analyse(fen, { depth, multipv: 1, searchmoves: sm }) : null;
  console.log('depth', depth, a.lines.map((l) => `${l.pv[0]} ${JSON.stringify(l.score)}`).join(' | '), sm ? `|| ${sm}: ${JSON.stringify(s!.lines[0]?.score)} pv ${s!.lines[0]?.pv.slice(0, 5).join(' ')}` : '');
}
e.quit();
