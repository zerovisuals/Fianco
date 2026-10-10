import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue } from 'motion/react';
import { Chess, type Square } from 'chess.js';
import { LABELS, type Label } from './labels';
import { ClassIcon } from './icons';
import { Crown, Flag, Timer, SignOut } from '@phosphor-icons/react';
import type { Reason } from './engine/ending';

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
export type EndBadges = { winner: 'w' | 'b' | null; reason: Reason };
type Props = { fen: string; flipped?: boolean; lastMove?: string; label?: Label; arrows?: Arrow[]; pieceSet: string; onMove?: (uci: string) => void; end?: EndBadges | null };
const sqName = (i: number) => FILES[i % 8] + (8 - Math.floor(i / 8));

export function Board({ fen, flipped = false, lastMove, label, arrows = [], pieceSet, onMove, end }: Props) {
  const reduce = useReducedMotion();
  const state = useRef<{ pieces: Piece[]; counter: { n: number } }>({ pieces: [], counter: { n: 0 } });
  const pieces = useMemo(() => {
    state.current.pieces = track(state.current.pieces, fen, state.current.counter);
    return state.current.pieces;
  }, [fen]);
  const xy = (sq: number) => { const c = sq % 8, r = Math.floor(sq / 8); return flipped ? [7 - c, 7 - r] : [c, r]; };

  // ---- moving pieces: click a piece then a square, or drag it (mouse and touch) ----
  const boardEl = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; p: string; moved: boolean } | null>(null);
  const [instant, setInstant] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const gx = useMotionValue(0), gy = useMotionValue(0);
  const startPt = useRef<{ x: number; y: number; wasSel: boolean }>({ x: 0, y: 0, wasSel: false });
  const chess = useMemo(() => { try { return new Chess(fen); } catch { return null; } }, [fen]);
  const targets = useMemo(() => (sel !== null && chess ? chess.moves({ square: sqName(sel) as Square, verbose: true }).map((m) => sqIndex(m.to)) : []), [sel, chess]);
  useEffect(() => { setSel(null); setDrag(null); setPromo(null); if (instant !== null) { const t = setTimeout(() => setInstant(null), 60); return () => clearTimeout(t); } }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (e: { clientX: number; clientY: number }) => {
    const r = boardEl.current!.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * 8), rw = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || rw < 0 || rw > 7) return -1;
    return flipped ? (7 - rw) * 8 + (7 - c) : rw * 8 + c;
  };
  const ownPiece = (i: number) => { const pc = pieces.find((x) => x.sq === i); return pc && chess && (pc.p === pc.p.toUpperCase() ? 'w' : 'b') === chess.turn() ? pc : null; };
  const tryMove = (a: number, b: number) => {
    if (!chess || !onMove) return false;
    const m = chess.moves({ square: sqName(a) as Square, verbose: true }).find((x) => x.to === sqName(b));
    if (!m) return false;
    if (m.promotion) setPromo({ from: m.from, to: m.to, color: m.color });   // ask which piece
    else onMove(m.from + m.to);
    return true;
  };
  const place = (e: { clientX: number; clientY: number }) => {
    const r = boardEl.current!.getBoundingClientRect(), q = r.width / 8;
    gx.set(e.clientX - r.left - q / 2); gy.set(e.clientY - r.top - q / 2);
  };
  const down = (e: React.PointerEvent) => {
    if (!onMove || e.button !== 0 || promo) return;
    const i = at(e);
    if (sel !== null && i !== sel && targets.includes(i)) { tryMove(sel, i); setSel(null); return; }
    const pc = ownPiece(i);
    if (!pc) { setSel(null); return; }
    startPt.current = { x: e.clientX, y: e.clientY, wasSel: sel === i };
    setSel(i); setDrag({ id: pc.id, p: pc.p, moved: false }); place(e);
    boardEl.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > 4) setDrag({ ...drag, moved: true });
    place(e);
  };
  const up = (e: React.PointerEvent) => {
    if (!drag || sel === null) return;
    const i = at(e);
    if (drag.moved && i !== sel && tryMove(sel, i)) { setInstant(i); setSel(null); }
    else if (!drag.moved && startPt.current.wasSel) setSel(null);   // second click on the same piece: deselect
    setDrag(null);
  };

  const from = lastMove ? sqIndex(lastMove.slice(0, 2)) : -1, to = lastMove ? sqIndex(lastMove.slice(2, 4)) : -1;
  const color = label ? LABELS[label].color : '#f5f682';

  const squares = [];
  for (let i = 0; i < 64; i++) {
    const [x, y] = xy(i);
    const light = (x + y) % 2 === 0;
    squares.push(
      <div key={i} className={`sq ${light ? 'light' : 'dark'}`} style={{ gridColumn: x + 1, gridRow: y + 1 }}>
        {(i === from || i === to) && <motion.span className="hl" layoutId={undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: color }} />}
        {i === sel && <span className="sel" />}
        {targets.includes(i) && <span className={pieces.some((pc) => pc.sq === i) ? 'cap' : 'dot'} />}
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
    <div className={`board${onMove ? ' movable' : ''}${drag?.moved ? ' dragging' : ''}`} ref={boardEl} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
      <div className="squares">{squares}</div>
      <div className="pieces">
        <AnimatePresence initial={false}>
          {pieces.map((pc) => {
            const [x, y] = xy(pc.sq);
            return (
              <motion.img key={pc.id} className="piece" draggable={false} alt=""
                src={`/pieces/${pieceSet}/${pc.p === pc.p.toUpperCase() ? 'w' : 'b'}${pc.p.toUpperCase()}.svg`}
                initial={reduce ? false : { x: `${x * 100}%`, y: `${y * 100}%`, opacity: 0, scale: 0.85 }}
                animate={{ x: `${x * 100}%`, y: `${y * 100}%`, opacity: drag?.moved && drag.id === pc.id ? 0.25 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18, delay: 0.08 } }}
                transition={reduce || pc.sq === instant ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }} />
            );
          })}
        </AnimatePresence>
        {drag?.moved && <motion.img className="piece ghost" alt="" draggable={false} src={`/pieces/${pieceSet}/${drag.p === drag.p.toUpperCase() ? 'w' : 'b'}${drag.p.toUpperCase()}.svg`} style={{ x: gx, y: gy }} />}
      </div>
      {arrowEl}
      {/* How the game ended, on the kings themselves: crown for the winner; flag, clock or # for the loser; ½ for a draw. */}
      <AnimatePresence>
        {end && pieces.filter((pc) => pc.p === 'K' || pc.p === 'k').map((pc) => {
          const side = pc.p === 'K' ? 'w' : 'b', [x, y] = xy(pc.sq);
          const kind = end.winner === null ? 'draw' : end.winner === side ? 'win' : 'lose';
          const icon = kind === 'win' ? <Crown size={13} weight="fill" /> : kind === 'draw' ? <b>½</b>
            : end.reason === 'checkmate' ? <b>#</b> : end.reason === 'time' ? <Timer size={13} weight="bold" />
            : end.reason === 'abandonment' ? <SignOut size={13} weight="bold" /> : end.reason === 'resignation' ? <Flag size={13} weight="fill" /> : <b>0</b>;
          return (
            <motion.span key={`end-${side}`} className={`end-badge ${kind}`} style={{ left: `${(x + 1) * 12.5}%`, top: `${y * 12.5}%` }}
              initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24, delay: reduce ? 0 : 0.25 }}>{icon}</motion.span>
          );
        })}
      </AnimatePresence>
      <AnimatePresence>
        {promo && (() => {
          const [x, y] = xy(sqIndex(promo.to));
          const down = y === 0;   // picker grows from the edge the pawn promotes on
          return (
            <motion.div key="promo" className="promo glass" role="dialog" aria-label="Promote to"
              style={{ left: `${x * 12.5}%`, top: down ? 0 : 'auto', bottom: down ? 'auto' : 0 }}
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.18 }}
              onPointerDown={(e) => e.stopPropagation()}>
              {(down ? ['q', 'n', 'r', 'b'] : ['b', 'r', 'n', 'q']).map((t) => (
                <button key={t} onClick={() => { setPromo(null); onMove?.(promo.from + promo.to + t); }} aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[t]}>
                  <img src={`/pieces/${pieceSet}/${promo.color}${t.toUpperCase()}.svg`} alt="" draggable={false} />
                </button>
              ))}
              <button className="promo-x" onClick={() => setPromo(null)} aria-label="Cancel promotion">×</button>
            </motion.div>
          );
        })()}
      </AnimatePresence>
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
