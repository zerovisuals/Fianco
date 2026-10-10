// Classification semantics. chess.com's palette (the meaning players already know), our own icons.
export type Label = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'miss' | 'forced';

export const LABELS: Record<Label, { name: string; color: string; glyph: string; verb: string }> = {
  brilliant: { name: 'Brilliant', color: '#26c2a3', glyph: '!!', verb: 'is brilliant' },
  great: { name: 'Great', color: '#749bbf', glyph: '!', verb: 'is a great move' },
  best: { name: 'Best', color: '#81b64c', glyph: '', verb: 'is best' },
  excellent: { name: 'Excellent', color: '#81b64c', glyph: '', verb: 'is excellent' },
  good: { name: 'Good', color: '#95b776', glyph: '', verb: 'is good' },
  book: { name: 'Book', color: '#c9a17a', glyph: '', verb: 'is a book move' },
  inaccuracy: { name: 'Inaccuracy', color: '#f7c631', glyph: '?!', verb: 'is an inaccuracy' },
  mistake: { name: 'Mistake', color: '#ffa459', glyph: '?', verb: 'is a mistake' },
  miss: { name: 'Miss', color: '#ff7769', glyph: '', verb: 'is a miss' },
  blunder: { name: 'Blunder', color: '#fa412d', glyph: '??', verb: 'is a blunder' },
  forced: { name: 'Forced', color: '#97af8b', glyph: '', verb: 'is forced' },
};

/** Tally order in the scorecard. */
export const TALLY_ORDER: Label[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
/** Labels worth stopping on ("key moments"). */
export const KEY: Label[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];
