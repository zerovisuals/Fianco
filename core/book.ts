// Opening book: every position along every named line in the Lichess CC0 openings set.
import { Chess } from 'chess.js';

export const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function buildBook(tsvs: string[]): Set<string> {
  const set = new Set<string>();
  for (const tsv of tsvs) for (const row of tsv.split('\n').slice(1)) {
    const pgn = row.split('\t')[2]; if (!pgn) continue;
    const c = new Chess();
    for (const san of pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/)) {
      try { c.move(san); set.add(epd(c.fen())); } catch { break; }
    }
  }
  return set;
}
