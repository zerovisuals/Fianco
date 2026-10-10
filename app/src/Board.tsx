import { useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { LABELS, type Label } from './labels';
import { ClassIcon } from './icons';

const FILES = 'abcdefgh';
type Piece = { id: string; p: string; sq: number };   // sq: 0..63, a8 = 0

function parse(fen: string): { p: string; sq: number }[] {
  const out: { p: string; sq: number }[] = [];
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else out.push({ p: ch, sq: r * 8 + f++ }); }
  });
  return out;
}
const dist = (a: number, b: number) => Math.hypot((a % 8) - (b % 8), Math.floor(a / 8) - Math.floor(b / 8));
const sqIndex = (s: string) => (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);

/** Keep piece identities stable between positions so moves animate instead of re-rendering. */
function track(prev: Piece[], fen: string, counter: { n: number }): Piece[] {
  const next = parse(fen);
  const left = [...prev];
  const out: Piece[] = [];
  const pending: { p: string; sq: number }[] = [];
  for (const n of next) {
    const i = left.findIndex((x) => x.p === n.p && x.sq === n.sq);
    if (i >= 0) out.push(left.splice(i, 1)[0]); else pending.push(n);
  }
  for (const n of pending) {
    let bi = -1, bd = Infinity;
    left.forEach((x, i) => { if (x.p === n.p && dist(x.sq, n.sq) < bd) { bd = dist(x.sq, n.sq); bi = i; } });
    // A promoted piece takes over the pawn that vanished on the 7th/2nd rank.
    if (bi < 0) left.forEach((x, i) => { if (bi < 0 && x.p.toLowerCase() === 'p' && (x.p === 'P') === (n.p === n.p.toUpperCase()) && dist(x.sq, n.sq) < 2) bi = i; });
    if (bi >= 0) out.push({ ...left.splice(bi, 1)[0], p: n.p, sq: n.sq });
    else out.push({ id: `p${counter.n++}`, p: n.p, sq: n.sq });
  }
  return out;
}

export type Arrow = { uci: string; kind: 'best' | 'played' };
type Props = { fen: string; flipped?: boolean; lastMove?: string; label?: Label; arrows?: Arrow[]; pieceSet: string };

export function Board({ fen, flipped = false, lastMove, label, arrows = [], pieceSet }: Props) {
  const reduce = useReducedMotion();
  const state = useRef<{ pieces: Piece[]; counter: { n: number } }>({ pieces: [], counter: { n: 0 } });
  const pieces = useMemo(() => {
    state.current.pieces = track(state.current.pieces, fen, state.current.counter);
    return state.current.pieces;
  }, [fen]);
  const xy = (sq: number) => { const c = sq % 8, r = Math.floor(sq / 8); return flipped ? [7 - c, 7 - r] : [c, r]; };
  const from = lastMove ? sqIndex(lastMove.slice(0, 2)) : -1, to = lastMove ? sqIndex(lastMove.slice(2, 4)) : -1;
  const color = label ? LABELS[label].color : '#f5f682';

  const squares = [];
  for (let i = 0; i < 64; i++) {
    const [x, y] = xy(i);
    const light = (x + y) % 2 === 0;
    squares.push(
      <div key={i} className={`sq ${light ? 'light' : 'dark'}`} style={{ gridColumn: x + 1, gridRow: y + 1 }}>
        {(i === from || i === to) && <motion.span className="hl" layoutId={undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: color }} />}
        {x === 0 && <span className="coord rank">{8 - Math.floor(i / 8)}</span>}
        {y === 7 && <span className="coord file">{FILES[i % 8]}</span>}
      </div>,
    );
  }

  // Played move and best move drawn together: no toggling between positions.
  const arrowEl = arrows.length ? (
    <svg className="arrows" viewBox="0 0 100 100" key={arrows.map((x) => x.uci).join()}>
      {arrows.map((ar, k) => {
        const [x1, y1] = xy(sqIndex(ar.uci.slice(0, 2))), [x2, y2] = xy(sqIndex(ar.uci.slice(2, 4)));
        const c = (v: number) => v * 12.5 + 6.25;
        const dx = c(x2) - c(x1), dy = c(y2) - c(y1), len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len, ex = c(x2) - ux * 3.4, ey = c(y2) - uy * 3.4;
        const col = ar.kind === 'best' ? 'var(--arrow-best)' : 'var(--arrow-played)';
        return (
          <g key={ar.kind + ar.uci}>
            <motion.line x1={c(x1)} y1={c(y1)} x2={ex} y2={ey} stroke={col} strokeWidth="2.1" strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.35, delay: 0.18 + k * 0.12, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d={`M ${ex + ux * 3.6} ${ey + uy * 3.6} L ${ex - uy * 2.4} ${ey + ux * 2.4} L ${ex + uy * 2.4} ${ey - ux * 2.4} Z`} fill={col}
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 + k * 0.12 }} />
          </g>
        );
      })}
    </svg>
  ) : null;

  return (
    <div className="board">
      <div className="squares">{squares}</div>
      <div className="pieces">
        <AnimatePresence initial={false}>
          {pieces.map((pc) => {
            const [x, y] = xy(pc.sq);
            return (
              <motion.img key={pc.id} className="piece" draggable={false} alt=""
                src={`/pieces/${pieceSet}/${pc.p === pc.p.toUpperCase() ? 'w' : 'b'}${pc.p.toUpperCase()}.svg`}
                initial={reduce ? false : { x: `${x * 100}%`, y: `${y * 100}%`, opacity: 0, scale: 0.85 }}
                animate={{ x: `${x * 100}%`, y: `${y * 100}%`, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18, delay: 0.08 } }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }} />
            );
          })}
        </AnimatePresence>
      </div>
      {arrowEl}
      <AnimatePresence>
        {label && to >= 0 && (() => {
          const [x, y] = xy(to);
          return (
            <motion.div key={`${lastMove}-${label}`} className="stamp" style={{ left: `${(x + 1) * 12.5}%`, top: `${y * 12.5}%` }}
              initial={reduce ? false : { scale: 0.2, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 600, damping: 22, delay: reduce ? 0 : 0.16 }}>
              <ClassIcon label={label} size={30} />
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

export function EvalBar({ evalWhite, flipped }: { evalWhite: number; flipped?: boolean }) {
  const mate = Math.abs(evalWhite) >= 9000;
  const pct = mate ? (evalWhite > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-0.004 * evalWhite)) - 1);
  const text = mate ? `M${10000 - Math.abs(evalWhite)}` : (Math.abs(evalWhite) / 100).toFixed(1);
  return (
    <div className={`evalbar ${flipped ? 'flip' : ''}`}>
      <motion.div className="fill" animate={{ height: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
      <span className={`evaltext ${evalWhite >= 0 ? 'w' : 'b'}`}>{text}</span>
    </div>
  );
}
