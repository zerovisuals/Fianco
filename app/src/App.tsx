import './review.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight, Lightning, ArrowsDownUp, MagnifyingGlass, Info } from '@phosphor-icons/react';
import { Board, EvalBar, type Arrow } from './Board';
import { Timeline } from './Timeline';
import { Scorecard } from './Scorecard';
import { ClassIcon } from './icons';
import { LABELS, KEY, type Label } from './labels';
import { analyzePgn, chesscomGames, chesscomAvatar, type Strength } from './engine/analyze';
import { explain } from './engine/explain';
import type { Review } from './types';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fmtEval = (e: number) => (Math.abs(e) >= 9000 ? `M${10000 - Math.abs(e)}` : `${e >= 0 ? '+' : ''}${(e / 100).toFixed(2)}`);
const isPgn = (s: string) => /\d+\.\s*\S/.test(s) || s.trim().startsWith('[');
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };

type Game = Awaited<ReturnType<typeof chesscomGames>>[number];

/* ---------- import ---------- */
function Import({ onPgn, initial }: { onPgn: (pgn: string, me?: string) => void; initial?: string }) {
  const [q, setQ] = useState(initial ?? '');
  const [games, setGames] = useState<Game[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<string | undefined>();
  const submit = useCallback(async (v: string) => {
    setErr(null);
    if (!v.trim()) return;
    if (isPgn(v)) return onPgn(v);
    setBusy(true);
    try { const g = await chesscomGames(v); setGames(g); setUser(v.trim()); if (!g.length) setErr('No recent games found for that player.'); store.set('fianco:user', v.trim()); }
    catch (e) { setErr((e as Error).message); setGames(null); }
    finally { setBusy(false); }
  }, [onPgn]);
  useEffect(() => { if (initial) submit(initial); }, [initial, submit]);
  return (
    <div className="import">
      <h1>Review a game</h1>
      <p className="sub">Paste a PGN, or type a chess.com username to pick one of your recent games.</p>
      <form className="import-box" onSubmit={(e) => { e.preventDefault(); submit(q); }}>
        <MagnifyingGlass size={18} weight="bold" />
        <textarea rows={q.includes('\n') ? 6 : 1} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username, or paste a PGN" aria-label="Username or PGN"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !q.includes('\n')) { e.preventDefault(); submit(q); } }} />
        <button className="pill fill" disabled={busy}>{busy ? 'Looking…' : isPgn(q) ? 'Review' : 'Find games'}</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
      {games && games.length > 0 && (
        <ul className="games">
          {games.map((g, i) => (
            <motion.li key={g.url} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, ease: EASE, duration: 0.4 }}>
              <button onClick={() => onPgn(g.pgn, user)}>
                <span className="g-players"><b>{g.white}</b> <span className="mono">{g.whiteElo}</span><span className="vs">vs</span><b>{g.black}</b> <span className="mono">{g.blackElo}</span></span>
                <span className="g-meta">{g.time} · {g.result} · {new Date(g.end * 1000).toLocaleDateString()}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
      {!games && <button className="sample" onClick={() => fetch('/sample.pgn').then((r) => r.text()).then(onPgn)}>No game at hand? Try a sample</button>}
    </div>
  );
}

/* ---------- analysing ---------- */
function Analysing({ progress, onCancel }: { progress: number; onCancel: () => void }) {
  return (
    <div className="analysing">
      <div className="an-board">{Array.from({ length: 64 }, (_, i) => <span key={i} className={(i + Math.floor(i / 8)) % 2 ? 'd' : 'l'} style={{ opacity: i / 64 < progress ? 1 : 0.35 }} />)}</div>
      <div className="an-bar"><motion.span animate={{ scaleX: progress }} transition={{ ease: 'linear', duration: 0.2 }} /></div>
      <p>Reviewing {Math.round(progress * 100)}%. The engine runs on your computer.</p>
      <button className="pill line" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/* ---------- review ---------- */
function ReviewView({ review }: { review: Review }) {
  const reduce = useReducedMotion();
  const [ply, setPly] = useState(-1);
  const [flipped, setFlipped] = useState(review.meta?.me === 'b');
  const [focus, setFocus] = useState<Label | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const pieceSet = 'celtic';
  const n = review.moves.length;
  const go = useCallback((i: number) => setPly(Math.max(-1, Math.min(n - 1, i))), [n]);
  const nextKey = useCallback((label?: Label) => {
    const want = (l: Label) => (label ? l === label : KEY.includes(l));
    const i = review.moves.findIndex((m, k) => k > ply && want(m.label));
    go(i >= 0 ? i : review.moves.findIndex((m) => want(m.label)));
  }, [review, ply, go]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(ply + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(ply - 1); }
      else if (e.key === 'Home') go(-1); else if (e.key === 'End') go(n - 1);
      else if (e.key === ' ') { e.preventDefault(); nextKey(); }
      else if (e.key === 'f') setFlipped((f) => !f);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [ply, n, go, nextKey]);

  const cur = ply >= 0 ? review.moves[ply] : null;
  const ex = useMemo(() => (cur ? explain(cur) : null), [cur]);
  const arrows: Arrow[] = cur && !['best', 'book', 'forced', 'brilliant', 'great'].includes(cur.label) && cur.uci !== cur.best ? [{ uci: cur.uci, kind: 'played' }, { uci: cur.best, kind: 'best' }] : [];
  const top = flipped ? review.white : review.black, bottom = flipped ? review.black : review.white;

  // Smart caption: sit on the edge of the board the move doesn't touch (castling on the back rank pushes it to the top).
  const edge = useMemo<'top' | 'bottom'>(() => {
    if (!cur) return 'bottom';
    const sqs = [cur.uci.slice(0, 2), cur.uci.slice(2, 4), ...arrows.flatMap((a) => [a.uci.slice(0, 2), a.uci.slice(2, 4)])];
    if (cur.san.startsWith('O-O')) sqs.push(cur.color === 'w' ? 'h1' : 'h8', cur.color === 'w' ? 'a1' : 'a8');
    const rows = sqs.map((q) => (flipped ? Number(q[1]) - 1 : 8 - Number(q[1])));
    const bottomBusy = rows.some((r) => r >= 7), topBusy = rows.some((r) => r <= 0);
    return bottomBusy && !topBusy ? 'top' : 'bottom';
  }, [cur, arrows, flipped]);
  const Avatar = ({ p, c }: { p: { name: string; avatar?: string | null }; c: 'w' | 'b' }) =>
    p.avatar ? <img className="avatar" src={p.avatar} alt="" /> : <span className={`avatar mono ${c}`} aria-hidden>{p.name[0]?.toUpperCase()}</span>;

  return (
    <main className="stage">
      <Timeline moves={review.moves} ply={ply} onPick={go} focus={focus} />
      <section className="center">
        <div className="player"><Avatar p={top} c={flipped ? 'w' : 'b'} /><b>{top.name}</b><span className="elo">{top.elo}</span></div>
        <div className="board-wrap">
          <EvalBar evalWhite={cur ? cur.evalWhite : 20} flipped={flipped} />
          <div className="board-holder">
            <Board fen={cur ? cur.fenAfter : review.startFen} flipped={flipped} lastMove={cur?.uci} label={cur?.label} arrows={arrows} pieceSet={pieceSet} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={ply} layout className={`coach glass at-${edge}`} initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 0.34, ease: EASE }}>
                {cur ? (<>
                  <ClassIcon label={cur.label} size={40} />
                  <div className="coach-text">
                    <div><b>{Math.floor(ply / 2) + 1}{cur.color === 'w' ? '.' : '…'}{cur.san}</b> {LABELS[cur.label].verb}</div>
                    <div className="coach-sub">{ex?.why.join(' ')}</div>
                  </div>
                  <span className={`eval-chip ${cur.evalWhite >= 0 ? 'w' : 'b'}`}>{fmtEval(cur.evalWhite)}</span>
                </>) : <div className="coach-text"><div><b>Start of the game.</b></div><div className="coach-sub">Arrow keys to step, Space for the next key moment.</div></div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="player"><Avatar p={bottom} c={flipped ? 'b' : 'w'} /><b>{bottom.name}</b><span className="elo">{bottom.elo}</span></div>

        <div className="under">
          {cur && cur.bestLine && cur.bestLine.length > 0 && cur.label !== 'book' && (
            <div className="line"><span className="line-k">Best line</span>{cur.bestLine.map((s, i) => <span key={i} className="line-m">{s}</span>)}
              <button className="why-btn" onClick={() => setShowNumbers((v) => !v)} aria-expanded={showNumbers}><Info size={15} weight="bold" />Why this label</button></div>
          )}
          <AnimatePresence initial={false}>{showNumbers && ex && <motion.p className="numbers" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{ex.numbers}</motion.p>}</AnimatePresence>
          <nav className="controls" aria-label="Move navigation">
            <button onClick={() => go(-1)} aria-label="First move"><CaretDoubleLeft size={18} weight="bold" /></button>
            <button onClick={() => go(ply - 1)} aria-label="Previous move"><CaretLeft size={18} weight="bold" /></button>
            <button className="primary" onClick={() => nextKey()} title="Next key moment (Space)"><Lightning size={17} weight="fill" /><span className="lbl">Next key moment</span></button>
            <button onClick={() => go(ply + 1)} aria-label="Next move"><CaretRight size={18} weight="bold" /></button>
            <button onClick={() => go(n - 1)} aria-label="Last move"><CaretDoubleRight size={18} weight="bold" /></button>
            <button onClick={() => setFlipped((f) => !f)} aria-label="Flip board"><ArrowsDownUp size={18} weight="bold" /></button>
          </nav>
        </div>
      </section>
      <Scorecard review={review} focus={focus} onFocus={setFocus} onJump={(l) => nextKey(l)} />
    </main>
  );
}

export default function App() {
  const [review, setReview] = useState<Review | null>(() => { const s = store.get('fianco:last'); try { return s ? JSON.parse(s) : null; } catch { return null; } });
  const [initial] = useState(() => { const v = sessionStorage.getItem('fianco:import') ?? undefined; sessionStorage.removeItem('fianco:import'); return v; });
  const [mode, setMode] = useState<'import' | 'analysing' | 'review'>(() => (initial || !review ? 'import' : 'review'));
  const [progress, setProgress] = useState(0);
  const [strength, setStrength] = useState<Strength>('standard');
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (pgn: string, me?: string) => {
    setErr(null); setProgress(0); setMode('analysing');
    abort.current = new AbortController();
    try {
      const r = await analyzePgn(pgn, { strength, onProgress: setProgress, signal: abort.current.signal });
      const meLc = me?.toLowerCase();
      if (meLc) r.meta = { ...r.meta, me: r.black.name.toLowerCase() === meLc ? 'b' : 'w' };
      if (/chess\.com/i.test(r.meta?.site ?? '')) {
        const [wa, ba] = await Promise.all([chesscomAvatar(r.white.name), chesscomAvatar(r.black.name)]);
        r.white.avatar = wa; r.black.avatar = ba;
      }
      setReview(r); store.set('fianco:last', JSON.stringify(r)); setMode('review');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr((e as Error).message || 'Could not read that game.');
      setMode('import');
    }
  }, [strength]);
  const started = useRef(false);
  useEffect(() => { if (!started.current && initial && isPgn(initial)) { started.current = true; run(initial); } }, [initial, run]);

  return (
    <div className="app">
      <header className="topbar">
        <a className="logo" href="#/" aria-label="Fianco home"><i /><span>Fianco</span></a>
        <div className="game-meta">{mode === 'review' && review ? <>{review.white.name} <span>vs</span> {review.black.name}{review.meta?.result ? <> · {review.meta.result}</> : null}</> : null}</div>
        <div className="top-actions">
          <div className="strength" role="radiogroup" aria-label="Engine strength">
            {(['fast', 'standard', 'deep'] as Strength[]).map((s) => <button key={s} role="radio" aria-checked={strength === s} className={strength === s ? 'on' : ''} onClick={() => setStrength(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
          </div>
          {mode === 'review' && <button className="pill fill" onClick={() => setMode('import')}>New review</button>}
        </div>
      </header>
      {err && mode === 'import' && <p className="err top" role="alert">{err}</p>}
      {mode === 'import' && <Import onPgn={run} initial={initial && !isPgn(initial) ? initial : undefined} />}
      {mode === 'analysing' && <Analysing progress={progress} onCancel={() => abort.current?.abort()} />}
      {mode === 'review' && review && <ReviewView key={review.startFen + review.moves.length + review.white.name} review={review} />}
    </div>
  );
}
