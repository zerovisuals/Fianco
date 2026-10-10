import { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react';
import { LABELS, TALLY_ORDER, type Label } from './labels';
import { ClassIcon } from './icons';
import type { Review } from './types';

function CountUp({ value, digits = 1 }: { value: number | null | undefined; digits?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(digits));
  useEffect(() => {
    if (value == null) return;
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.35 });
    return () => c.stop();
  }, [value, reduce, mv]);
  if (value == null) return <span>-</span>;
  return <motion.span>{text}</motion.span>;
}

const PHASES = ['Opening', 'Middlegame', 'Endgame'];
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Scorecard({ review, onFocus, focus, onJump }: { review: Review; focus: Label | null; onFocus: (l: Label | null) => void; onJump: (l: Label) => void }) {
  const reduce = useReducedMotion();
  const tallies = useMemo(() => {
    const t = Object.fromEntries(TALLY_ORDER.map((l) => [l, { w: 0, b: 0 }])) as Record<Label, { w: number; b: number }>;
    review.moves.forEach((m) => { if (t[m.label]) t[m.label][m.color]++; });
    return t;
  }, [review]);
  const item = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.25 + i * 0.035, duration: 0.5, ease: EASE } });

  return (
    <aside className="scorecard">
      <div className="sc-players">
        {(['w', 'b'] as const).map((c) => {
          const p = c === 'w' ? review.white : review.black;
          return (
            <div className={`sc-player ${c}`} key={c}>
              <div className="sc-name"><span className={`chip ${c}`} />{p.name}<span className="sc-elo">{p.elo}</span></div>
              <div className="sc-acc"><CountUp value={review.accuracy[c]} /></div>
              <div className="sc-sub">accuracy</div>
              <div className="sc-rating"><span>Game rating</span><b>{review.rating ? <CountUp value={review.rating[c]} digits={0} /> : '-'}</b></div>
            </div>
          );
        })}
      </div>

      <div className="sc-phases">
        {PHASES.map((n, i) => (
          <motion.div className="sc-phase" key={n} {...item(i)}>
            <span className="sc-phase-name">{n}</span>
            <span className="sc-phase-vals"><b>{review.phaseAccuracy.w[i]?.toFixed(0) ?? '-'}</b><b className="b">{review.phaseAccuracy.b[i]?.toFixed(0) ?? '-'}</b></span>
          </motion.div>
        ))}
      </div>

      <div className="sc-tallies" onMouseLeave={() => onFocus(null)}>
        {TALLY_ORDER.map((l, i) => {
          const t = tallies[l]; const none = t.w + t.b === 0;
          return (
            <motion.button className={`sc-tally ${none ? 'none' : ''} ${focus === l ? 'on' : ''}`} key={l} {...item(i + 3)}
              onMouseEnter={() => !none && onFocus(l)} onFocus={() => !none && onFocus(l)} onClick={() => !none && onJump(l)} disabled={none}
              style={{ ['--c' as string]: LABELS[l].color }}>
              <span className="n w">{t.w}</span>
              <span className="mid"><ClassIcon label={l} size={22} /><span className="nm">{LABELS[l].name}</span></span>
              <span className="n b">{t.b}</span>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
