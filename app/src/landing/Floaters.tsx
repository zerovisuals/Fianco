import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { MiniBoard, pieceSrc } from '../MiniBoard';
import { ClassIcon } from '../icons';
import type { Label } from '../labels';

export type Floater =
  | { kind: 'crop'; x: number; y: number; size: number; rot: number; depth: number; fen: string; files: [number, number]; ranks: [number, number] }
  | { kind: 'piece'; x: number; y: number; size: number; rot: number; depth: number; p: string; dark?: boolean }
  | { kind: 'marble'; x: number; y: number; size: number; rot: number; depth: number; label: Label };

const FENS = {
  immortal: 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 0 1',
  opera: '1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 0 1',
  greek: 'r1bq1rk1/pppn1ppB/4p3/3pP3/1b1P4/2N2N2/PPP2PPP/R2QK2R b KQ - 0 1',
  italian: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
  ending: '8/5pk1/6p1/8/3K4/8/5P2/8 w - - 0 1',
};

// x / y are % of the hero box; depth 0.3 (far, soft) … 1 (near, crisp).
export const HERO_FLOATERS: Floater[] = [
  { kind: 'crop', x: 6, y: 16, size: 128, rot: -12, depth: 0.9, fen: FENS.immortal, files: [4, 6], ranks: [6, 4] },
  { kind: 'piece', x: 18, y: 38, size: 88, rot: 9, depth: 0.75, p: 'N' },
  { kind: 'marble', x: 9, y: 56, size: 60, rot: -8, depth: 0.85, label: 'brilliant' },
  { kind: 'crop', x: 22, y: 70, size: 108, rot: 14, depth: 0.7, fen: FENS.greek, files: [5, 7], ranks: [7, 5] },
  { kind: 'piece', x: 5, y: 82, size: 72, rot: -16, depth: 0.35, p: 'q', dark: true },
  { kind: 'marble', x: 30, y: 16, size: 40, rot: 0, depth: 0.35, label: 'book' },
  { kind: 'crop', x: 85, y: 12, size: 136, rot: 11, depth: 0.9, fen: FENS.opera, files: [2, 4], ranks: [7, 5] },
  { kind: 'piece', x: 76, y: 32, size: 92, rot: -10, depth: 0.7, p: 'K' },
  { kind: 'marble', x: 91, y: 47, size: 64, rot: 12, depth: 0.85, label: 'blunder' },
  { kind: 'crop', x: 79, y: 64, size: 116, rot: -7, depth: 0.75, fen: FENS.italian, files: [2, 4], ranks: [4, 2] },
  { kind: 'marble', x: 68, y: 18, size: 42, rot: 0, depth: 0.35, label: 'great' },
  { kind: 'piece', x: 92, y: 78, size: 80, rot: 18, depth: 0.8, p: 'b', dark: true },
  { kind: 'marble', x: 70, y: 82, size: 50, rot: -14, depth: 0.6, label: 'miss' },
  { kind: 'piece', x: 36, y: 86, size: 62, rot: -6, depth: 0.3, p: 'P' },
  { kind: 'marble', x: 61, y: 90, size: 46, rot: 8, depth: 0.55, label: 'best' },
  { kind: 'crop', x: 45, y: 9, size: 60, rot: 20, depth: 0.3, fen: FENS.ending, files: [5, 6], ranks: [6, 5] },
];

function Item({ f, i, mx, my, scroll }: { f: Floater; i: number; mx: MotionValue<number>; my: MotionValue<number>; scroll: MotionValue<number> }) {
  const reduce = useReducedMotion();
  // Pointer parallax: near objects travel further than far ones.
  const px = useTransform(mx, (v) => v * 28 * f.depth);
  const py = useTransform(my, (v) => v * 20 * f.depth);
  // Scroll: objects part away from the centre as the hero leaves.
  const out = useTransform(scroll, (s) => s * (f.x - 50) * 9 * f.depth);
  const lift = useTransform(scroll, (s) => -s * 260 * f.depth);
  const x = useTransform([px, out] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const y = useTransform([py, lift] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const fromCentre = Math.hypot(f.x - 50, f.y - 50);
  const blur = f.depth < 0.45 ? `blur(${(0.45 - f.depth) * 9}px)` : undefined;

  const body = f.kind === 'marble'
    ? <ClassIcon label={f.label} size={f.size} />
    : (
      <div className="floater-tile" style={{ width: f.size, height: f.size }}>
        {f.kind === 'crop'
          ? <MiniBoard fen={f.fen} size={f.size} files={f.files} ranks={f.ranks} />
          : <div className="floater-sq" style={{ background: f.dark ? 'var(--sq-d)' : 'var(--sq-l)' }}><img src={pieceSrc(f.p)} alt="" draggable={false} /></div>}
      </div>
    );

  return (
    <motion.div className={`floater ${Math.abs(f.x - 50) < 34 && Math.abs(f.y - 52) < 26 ? 'near' : ''}`} style={{ left: `${f.x}%`, top: `${f.y}%`, x, y, filter: blur, opacity: f.depth < 0.45 ? 0.75 : 1, zIndex: Math.round(f.depth * 10) }}
      initial={reduce ? false : { scale: 0.5, opacity: 0, rotate: f.rot - 24 }}
      animate={{ scale: 1, opacity: f.depth < 0.45 ? 0.75 : 1, rotate: f.rot }}
      transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 0.9, delay: reduce ? 0 : 0.15 + fromCentre * 0.012 + i * 0.01 }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -7 * f.depth - 2, 0], rotate: [0, f.depth * 2.2, 0] }}
        transition={{ duration: 5 + (i % 5) * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.37 }}>
        {body}
      </motion.div>
    </motion.div>
  );
}

/** Field of chess objects that drift, follow the pointer, and part on scroll. */
export function Floaters({ items, scroll, interactive = true }: { items: Floater[]; scroll: MotionValue<number>; interactive?: boolean }) {
  const rawX = useMotionValue(0), rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 20 }), my = useSpring(rawY, { stiffness: 60, damping: 20 });
  useEffect(() => {
    if (!interactive || !matchMedia('(pointer: fine)').matches) return;
    const on = (e: PointerEvent) => { rawX.set(e.clientX / innerWidth - 0.5); rawY.set(e.clientY / innerHeight - 0.5); };
    addEventListener('pointermove', on); return () => removeEventListener('pointermove', on);
  }, [interactive, rawX, rawY]);
  return <div className="floaters" aria-hidden>{items.map((f, i) => <Item key={i} f={f} i={i} mx={mx} my={my} scroll={scroll} />)}</div>;
}
