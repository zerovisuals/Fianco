import { Star, ThumbsUp, Check, BookOpenText, X, ArrowRight } from '@phosphor-icons/react';
import type { Label } from './labels';

/**
 * Label marble: semantic colour + chess annotation glyph or Phosphor shape.
 * Glyphs are drawn as separate marks (no font ligature) so "!!" reads as two clean strokes.
 */
export function ClassIcon({ label, size = 20, className = '' }: { label: Label; size?: number; className?: string }) {
  const s = size * 0.56;
  let inner: React.ReactNode;
  switch (label) {
    case 'best': inner = <Star size={s} weight="fill" />; break;
    case 'excellent': inner = <ThumbsUp size={s} weight="fill" />; break;
    case 'good': inner = <Check size={s} weight="bold" />; break;
    case 'book': inner = <BookOpenText size={s} weight="fill" />; break;
    case 'miss': inner = <X size={s} weight="bold" />; break;
    case 'forced': inner = <ArrowRight size={s} weight="bold" />; break;
    default: inner = <Glyph marks={{ brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', blunder: '??' }[label] ?? '?'} size={size} />;
  }
  return (
    <span className={`marble ${size < 20 ? 'small' : ''} ${className}`} style={{ width: size, height: size, ['--c' as string]: `var(--${label})` }} role="img" aria-label={label}>
      {inner}
    </span>
  );
}

/** Each mark rendered on its own so spacing and optical centre are controlled, not left to the font. */
function Glyph({ marks, size }: { marks: string; size: number }) {
  const one = marks.length === 1;
  const fs = size * (one ? 0.74 : 0.62);
  return (
    <span className="g" style={{ fontSize: fs, gap: size * 0.015, transform: `translateY(${size * 0.015}px)` }}>
      {[...marks].map((m, i) => <span key={i} style={{ marginInline: m === '!' ? -size * 0.02 : 0 }}>{m}</span>)}
    </span>
  );
}
