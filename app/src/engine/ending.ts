// How a game ended, from the PGN's Result/Termination tags and the final position.
import { Chess } from 'chess.js';

export type Reason = 'checkmate' | 'resignation' | 'time' | 'abandonment' | 'stalemate' | 'repetition' | 'agreement' | 'insufficient' | 'fifty' | 'timeout-draw' | 'unknown';
export type Ending = { winner: 'w' | 'b' | null; reason: Reason; text: string };

const DRAW_TEXT: Partial<Record<Reason, string>> = {
  stalemate: 'Draw by stalemate', repetition: 'Draw by repetition', agreement: 'Draw by agreement',
  insufficient: 'Draw, insufficient material', fifty: 'Draw by the 50-move rule', 'timeout-draw': 'Draw, time out with insufficient material', unknown: 'Draw',
};
const WIN_TEXT: Partial<Record<Reason, string>> = {
  checkmate: 'won by checkmate', resignation: 'won by resignation', time: 'won on time', abandonment: 'won, game abandoned', unknown: 'won',
};

export function ending(result: string | undefined, termination: string | undefined, finalFen: string, names: { w: string; b: string }): Ending | null {
  const t = (termination ?? '').toLowerCase();
  const end = new Chess(finalFen);
  let winner: 'w' | 'b' | null;
  if (result === '1-0') winner = 'w'; else if (result === '0-1') winner = 'b';
  else if (result === '1/2-1/2' || result === '½-½') winner = null;
  else if (end.isCheckmate()) winner = end.turn() === 'w' ? 'b' : 'w';
  else if (end.isDraw()) winner = null;
  else return null;   // game still in progress or result unknown

  let reason: Reason = 'unknown';
  if (end.isCheckmate() || /checkmate/.test(t)) reason = 'checkmate';
  else if (winner === null) {
    reason = end.isStalemate() || /stalemate/.test(t) ? 'stalemate'
      : /repetition/.test(t) || end.isThreefoldRepetition() ? 'repetition'
      : /timeout vs insufficient|time.*insufficient/.test(t) ? 'timeout-draw'
      : /insufficient/.test(t) || end.isInsufficientMaterial() ? 'insufficient'
      : /50|fifty/.test(t) ? 'fifty' : /agree/.test(t) ? 'agreement' : 'unknown';
  } else {
    reason = /resign/.test(t) ? 'resignation' : /time|forfeit/.test(t) ? 'time' : /abandon/.test(t) ? 'abandonment'
      // lichess writes "Normal" for a resignation when there's no mate on the board; with no tag we don't guess.
      : /normal/.test(t) ? 'resignation' : 'unknown';
  }
  const text = winner === null ? DRAW_TEXT[reason]! : `${names[winner]} ${WIN_TEXT[reason]}`;
  return { winner, reason, text };
}
