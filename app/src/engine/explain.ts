// Plain, checkable reasons for each label, built only from the engine data (no generated prose).
import { Chess } from 'chess.js';
import { config } from '../../../core/config.ts';
import type { Move } from '../types';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** What the opponent's best reply does, in words. */
function replyText(m: Move): string | null {
  const u = m.reply?.[0]; if (!u) return null;
  const c = new Chess(m.fenAfter);
  try {
    const mv = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (Math.abs(m.evalWhite) >= 9000 && (m.evalWhite > 0) !== (m.color === 'w')) return `${mv.san} starts a forced mate.`;
    if (mv.captured) return `${mv.san} wins the ${NAME[mv.captured]}.`;
    if (c.inCheck()) return `${mv.san} comes with check.`;
    return `The best answer is ${mv.san}.`;
  } catch { return null; }
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (fen: string, side: 'w' | 'b') => [...fen.split(' ')[0]].reduce((a, ch) => {
  const v = VAL[ch.toLowerCase()]; if (v === undefined) return a;
  return a + ((ch === ch.toUpperCase() ? 'w' : 'b') === side ? v : -v);
}, 0);

/** What the engine's best move would have done, in words: mate, winning a piece, or just "stronger". */
function bestText(m: Move): string {
  const c = new Chess(m.fen);
  try {
    const mv = c.move({ from: m.best.slice(0, 2), to: m.best.slice(2, 4), promotion: m.best[4] });
    if (c.isCheckmate()) return `${mv.san} was mate.`;
    // epBest of 1 means the engine saw a forced mate for the mover.
    if (m.epBest >= 0.999) return `${mv.san} starts a forced mate.`;
    if (mv.captured) return `${mv.san} wins the ${NAME[mv.captured]}.`;
    return `${mv.san} would have punished it.`;
  } catch { return `${m.bestSan} was better.`; }
}

/** Material the mover is down after the opponent's best reply line (positive = lost). */
function materialLost(m: Move): number {
  const c = new Chess(m.fenAfter);
  for (const u of (m.reply ?? []).slice(0, 6)) { try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } }
  return material(m.fen, m.color) - material(c.fen(), m.color);
}

export function explain(m: Move): { headline: string; why: string[]; numbers: string } {
  const why: string[] = [];
  const reply = replyText(m);
  switch (m.label) {
    case 'book': why.push('A known opening move.'); break;
    case 'forced': why.push('The only legal move.'); break;
    case 'brilliant': {
      const sac = Number(m.sub?.match(/\d+/)?.[0] ?? 0);
      why.push(`Offers ${sac} point${sac === 1 ? '' : 's'} of material, and the engine says it works.`);
      break;
    }
    case 'great': why.push('The other moves give away much more. This one keeps the game on track.'); break;
    case 'best': why.push('The engine’s top choice.'); break;
    case 'excellent': case 'good': why.push(`Almost as strong as ${m.bestSan}.`); break;
    case 'miss':
      why.push('Your opponent’s last move was a mistake.');
      why.push(bestText(m));
      break;
    case 'inaccuracy': case 'mistake': case 'blunder': {
      if (reply) why.push(reply);
      why.push(m.epBest >= 0.999 && m.label !== 'inaccuracy' ? bestText(m) : `${m.bestSan} was better.`);
      // A big material loss with a mild label: the game was already decided, so the win chance barely moved.
      if (m.label !== 'blunder' && materialLost(m) >= 3) {
        if (m.epBest < 0.2) why.push('You were already lost, so it changes little.');
        else if (m.epPlayed > 0.8) why.push('You stay clearly winning, so it costs little.');
      }
      break;
    }
  }
  const b = config.bands;
  const band = m.label === 'brilliant' || m.label === 'great' || m.label === 'miss' || m.label === 'book' || m.label === 'forced'
    ? '' : ` Bands at ${m.elo}: Excellent under ${pct(b.excellent)}, Good under ${pct(b.good)}, Inaccuracy under ${pct(b.inaccuracy)}, Mistake under ${pct(b.mistake)}.`;
  const numbers = `Win chance before ${pct(m.epBest)}, after ${pct(m.epPlayed)}: ${m.loss > 0.0005 ? `${pct(m.loss)} lost.` : 'nothing lost.'}${band}`;
  return { headline: m.label, why, numbers };
}
