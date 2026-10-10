import type { Label } from './labels';

export const pieceSrc = (p: string, set = 'celtic') => `/pieces/${set}/${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}.svg`;

export function parseFen(fen: string): (string | null)[][] {
  return fen.split(' ')[0].split('/').map((r) => { const o: (string | null)[] = []; for (const ch of r) /\d/.test(ch) ? o.push(...Array(+ch).fill(null)) : o.push(ch); return o; });
}

type Props = { fen: string; size: number; files?: [number, number]; ranks?: [number, number]; marks?: Partial<Record<string, Label>>; className?: string };

/** Static board crop. files: [from, to] 0=a; ranks: [top, bottom] 7=8th rank. */
export function MiniBoard({ fen, size, files = [0, 7], ranks = [7, 0], marks = {}, className = '' }: Props) {
  const rows = parseFen(fen);
  const cols = files[1] - files[0] + 1, nrows = ranks[0] - ranks[1] + 1, q = size / cols;
  const cells = [];
  for (let rk = ranks[0]; rk >= ranks[1]; rk--) for (let f = files[0]; f <= files[1]; f++) {
    const p = rows[7 - rk][f], light = (f + rk) % 2 === 1, sq = 'abcdefgh'[f] + (rk + 1);
    cells.push(
      <div key={sq} className="q" style={{ background: light ? 'var(--sq-l)' : 'var(--sq-d)' }}>
        {marks[sq] && <span className="mk" style={{ background: `var(--${marks[sq]})` }} />}
        {p && <img src={pieceSrc(p)} alt="" draggable={false} />}
      </div>,
    );
  }
  return <div className={`mini ${className}`} style={{ gridTemplateColumns: `repeat(${cols}, ${q}px)`, gridTemplateRows: `repeat(${nrows}, ${q}px)` }}>{cells}</div>;
}
