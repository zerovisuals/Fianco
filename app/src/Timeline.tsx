import type { Ending } from './engine/ending';
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LABELS, KEY, type Label } from './labels';
import { ClassIcon } from './icons';
import type { Move } from './types';

const ROW = 34;           // px per full move
const RIBBON = 64;        // px width of the eval ribbon
const winp = (e: number) => (Math.abs(e) >= 9000 ? (e > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.004 * e)));

/**
 * Move list with the evaluation drawn vertically beside it, aligned ply by ply:
 * the swing sits next to the move that caused it.
 */
export function Timeline({ moves, ply, onPick, focus, ending }: { moves: Move[]; ply: number; onPick: (i: number) => void; focus: Label | null; ending?: Ending | null }) {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const rows = Math.ceil(moves.length / 2);
  const H = rows * ROW;
  const yOf = (i: number) => Math.floor(i / 2) * ROW + (i % 2 ? ROW * 0.78 : ROW * 0.28);
  const xOf = (e: number) => RIBBON / 2 + (winp(e) - 0.5) * (RIBBON - 8);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-ply="${ply}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [ply, reduce]);

  const pts = [[RIBBON / 2, 0], ...moves.map((m, i) => [xOf(m.evalWhite), yOf(i)]), [xOf(moves.at(-1)?.evalWhite ?? 0), H]];
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${RIBBON / 2},0 ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${RIBBON / 2},${H} Z`;

  return (
    <div className="timeline" ref={listRef}>
      <div className="tl-inner" style={{ height: H }}>
        <svg className="ribbon" width={RIBBON} height={H} viewBox={`0 0 ${RIBBON} ${H}`}>
          <defs>
            <clipPath id="whiteSide"><rect x={RIBBON / 2} y="0" width={RIBBON / 2} height={H} /></clipPath>
            <clipPath id="blackSide"><rect x="0" y="0" width={RIBBON / 2} height={H} /></clipPath>
          </defs>
          <motion.g initial={reduce ? false : { clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}>
            <path d={area} fill="var(--ribbon-white)" clipPath="url(#whiteSide)" />
            <path d={area} fill="var(--ribbon-black)" clipPath="url(#blackSide)" />
            <line x1={RIBBON / 2} x2={RIBBON / 2} y1="0" y2={H} stroke="var(--line)" />
            <path d={line} fill="none" stroke="var(--ribbon-stroke)" strokeWidth="1.2" />
            {moves.map((m, i) => KEY.includes(m.label) && (
              <circle key={i} cx={xOf(m.evalWhite)} cy={yOf(i)} r={focus && focus !== m.label ? 2 : 3.6} fill={LABELS[m.label].color} stroke="var(--panel)" strokeWidth="1.4" style={{ transition: 'r .2s' }} />
            ))}
          </motion.g>
          {ply >= 0 && <motion.circle r="6" fill="#fff" stroke="var(--accent)" strokeWidth="2" cx={xOf(moves[ply].evalWhite)} cy={yOf(ply)} initial={false} animate={{ cx: xOf(moves[ply].evalWhite), cy: yOf(ply) }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
        </svg>
        <div className="rows">
          {Array.from({ length: rows }, (_, r) => (
            <div className="tl-row" key={r} style={{ height: ROW }}>
              <span className="tl-num">{r + 1}</span>
              {[0, 1].map((k) => {
                const i = r * 2 + k, m = moves[i];
                if (!m) return <span key={k} />;
                const dim = focus && focus !== m.label;
                return (
                  <button key={k} data-ply={i} className={`tl-move ${ply === i ? 'cur' : ''} ${dim ? 'dim' : ''}`} onClick={() => onPick(i)}
                    style={KEY.includes(m.label) ? { color: LABELS[m.label].color } : undefined}>
                    {ply === i && <motion.span layoutId="tl-cur" className="tl-cur-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className="tl-icon">{!['good', 'excellent', 'forced'].includes(m.label) && <ClassIcon label={m.label} size={16} />}</span>
                    <span className="tl-san">{m.san}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {ending && <div className="tl-end"><b>{ending.winner === 'w' ? '1-0' : ending.winner === 'b' ? '0-1' : '½-½'}</b>{ending.text}</div>}
        </div>
      </div>
    </div>
  );
}

/** Phones and narrow screens: the move list as one horizontal strip under the board; the current move stays in view. */
export function MoveStrip({ moves, ply, onPick, ending }: { moves: Move[]; ply: number; onPick: (i: number) => void; ending?: Ending | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current, el = box?.querySelector<HTMLElement>(`[data-ply="${ply}"]`);
    if (!box) return;
    if (!el) { box.scrollTo({ left: 0, behavior: 'smooth' }); return; }
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [ply]);
  return (
    <div className="strip" ref={ref} role="list" aria-label="Moves">
      {moves.map((m, i) => (
        <button key={i} role="listitem" data-ply={i} className={`st-move${ply === i ? ' cur' : ''}`} onClick={() => onPick(i)}
          style={KEY.includes(m.label) ? { color: LABELS[m.label].color } : undefined}>
          {m.color === 'w' && <span className="st-num">{i / 2 + 1}.</span>}
          {!['good', 'excellent', 'forced', 'best'].includes(m.label) && <ClassIcon label={m.label} size={14} />}
          <span className="st-san">{m.san}</span>
        </button>
      ))}
      {ending && <span className="st-end">{ending.winner === 'w' ? '1-0' : ending.winner === 'b' ? '0-1' : '½-½'}</span>}
    </div>
  );
}
