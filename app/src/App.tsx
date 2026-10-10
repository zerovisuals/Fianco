import './review.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CaretLeft, CaretRight, Lightning, ArrowsDownUp, MagnifyingGlass, Info, SpeakerHigh, SpeakerSlash, Star, BookmarkSimple, ArrowUUpLeft, X, Trash, Books } from '@phosphor-icons/react';
import { Chess } from 'chess.js';
import { MiniBoard } from './MiniBoard';
import { library, useLibrary, gameId, type SavedGame } from './library';
import { moveSound, chime, soundOn, setSoundOn } from './sound';
import { Board, EvalBar, type Arrow } from './Board';
import { Timeline } from './Timeline';
import { Scorecard } from './Scorecard';
import { ClassIcon } from './icons';
import { LABELS, KEY, type Label } from './labels';
import { analyzePgn, chesscomGames, chesscomProfile, exploreMove, type Strength } from './engine/analyze';
import { explain } from './engine/explain';
import type { Review, Move } from './types';

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
function Analysing({ progress, stage, onCancel }: { progress: number; stage: string | null; onCancel: () => void }) {
  return (
    <div className="analysing">
      <div className="an-board">{Array.from({ length: 64 }, (_, i) => <span key={i} className={(i + Math.floor(i / 8)) % 2 ? 'd' : 'l'} style={{ opacity: i / 64 < progress ? 1 : 0.35 }} />)}</div>
      <div className="an-bar"><motion.span animate={{ scaleX: progress }} transition={{ ease: 'linear', duration: 0.2 }} /></div>
      <p>{stage ? `${stage}…` : `Reviewing ${Math.round(progress * 100)}%.`} The engine runs on your computer.</p>
      <button className="pill line" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/* ---------- review ---------- */
type Tried = { key: number; uci: string; san: string; color: 'w' | 'b'; moveNo: string; fen: string; fenAfter: string; result: Move | null; failed?: boolean; pending: Promise<Move | null> };
let triedKey = 0;

function ReviewView({ review, initialPly = -1 }: { review: Review; initialPly?: number }) {
  const reduce = useReducedMotion();
  const lib = useLibrary();
  const [ply, setPly] = useState(initialPly);
  const [flipped, setFlipped] = useState(review.meta?.me === 'b');
  const [focus, setFocus] = useState<Label | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  // "What if": moves tried on the board from the current position, each labelled by the engine.
  const [tried, setTried] = useState<Tried[]>([]);
  const pieceSet = 'celtic';
  const n = review.moves.length;
  const gid = useMemo(() => gameId(review), [review]);
  const go = useCallback((i: number) => { setTried([]); setPly(Math.max(-1, Math.min(n - 1, i))); }, [n]);
  const [sound, setSound] = useState(soundOn);
  const lastPly = useRef(ply);
  useEffect(() => {
    if (ply === lastPly.current) return;
    lastPly.current = ply;
    const m = ply >= 0 ? review.moves[ply] : null;
    if (m) moveSound(m.san, m.label);
  }, [ply, review]);
  const nextKey = useCallback((label?: Label) => {
    const want = (l: Label) => (label ? l === label : KEY.includes(l));
    const i = review.moves.findIndex((m, k) => k > ply && want(m.label));
    go(i >= 0 ? i : review.moves.findIndex((m) => want(m.label)));
  }, [review, ply, go]);
  const back = useCallback(() => { if (tried.length) setTried((t) => t.slice(0, -1)); else go(ply - 1); }, [tried.length, go, ply]);
  const forward = useCallback(() => { if (!tried.length) go(ply + 1); }, [tried.length, go, ply]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.key === 'Escape') setTried([]);
      else if (e.key === 'Home') go(-1); else if (e.key === 'End') go(n - 1);
      else if (e.key === ' ') { e.preventDefault(); nextKey(); }
      else if (e.key === 'f') setFlipped((f) => !f);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [n, go, nextKey, back, forward]);

  const gameCur = ply >= 0 ? review.moves[ply] : null;
  const last = tried[tried.length - 1] ?? null;
  const boardFen = last ? last.fenAfter : gameCur ? gameCur.fenAfter : review.startFen;

  const onBoardMove = useCallback((uci: string) => {
    // Playing the game's own next move just steps forward.
    const next = review.moves[ply + 1];
    if (!tried.length && next && next.uci === uci) { go(ply + 1); return; }
    const c = new Chess(boardFen);
    let mv; try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return; }
    const color = mv.color, full = Number(boardFen.split(' ')[5] ?? 1);
    // Miss and Great depend on the move before: the previous tried move, or the game move we branched from.
    const prevTried = tried[tried.length - 1];
    const prev: Promise<Move | null> | Move | null = prevTried ? prevTried.pending : gameCur;
    const p = color === 'w' ? review.white : review.black;
    const pending = exploreMove(boardFen, mv.lan, p.elo || 1500, Math.min(review.meta?.depth ?? 16, 16), prev);
    const t: Tried = { key: ++triedKey, uci: mv.lan, san: mv.san, color, moveNo: `${full}${color === 'w' ? '.' : '…'}`, fen: boardFen, fenAfter: c.fen(), result: null, pending: pending.catch(() => null) };
    setTried((ts) => [...ts, t]);
    moveSound(mv.san, '');
    pending
      .then((r) => { setTried((ts) => ts.map((x) => (x.key === t.key ? { ...x, result: r } : x))); if (r.label === 'brilliant') chime(); })
      .catch(() => setTried((ts) => ts.map((x) => (x.key === t.key ? { ...x, failed: true } : x))));
  }, [review, ply, tried, gameCur, boardFen, go]);

  // What the caption, arrows and eval show: the tried move when exploring, else the game move.
  const cur = last ? last.result : gameCur;
  const thinking = !!last && !last.result && !last.failed;
  const moveNo = last ? last.moveNo : gameCur ? `${Math.floor(ply / 2) + 1}${gameCur.color === 'w' ? '.' : '…'}` : '';
  const ex = useMemo(() => (cur ? explain(cur) : null), [cur]);
  const arrows: Arrow[] = cur && !['best', 'book', 'forced', 'brilliant', 'great'].includes(cur.label) && cur.uci !== cur.best ? [{ uci: cur.uci, kind: 'played' }, { uci: cur.best, kind: 'best' }] : [];
  const top = flipped ? review.white : review.black, bottom = flipped ? review.black : review.white;
  const fav = lib.games.some((g) => g.id === gid && g.fav);
  const savedHere = !last && ply >= 0 && lib.moves.some((m) => m.id === `${gid}:${ply}`);
  const canSave = !last && gameCur && (gameCur.label === 'brilliant' || gameCur.label === 'great');

  const Avatar = ({ p, c }: { p: { name: string; avatar?: string | null }; c: 'w' | 'b' }) =>
    p.avatar ? <img className="avatar" src={p.avatar} alt="" /> : <span className={`avatar mono ${c}`} aria-hidden>{p.name[0]?.toUpperCase()}</span>;
  const endInfo = review.meta?.ending ?? null;
  const atEnd = !last && ply === n - 1 && !!endInfo;
  const PlayerRow = ({ p, c, children }: { p: Review['white']; c: 'w' | 'b'; children?: React.ReactNode }) => (
    <div className="player">
      <Avatar p={p} c={c} />{p.title && <span className="title-chip">{p.title}</span>}<b>{p.name}</b>{p.elo > 0 && <span className="elo">{p.elo}</span>}
      {atEnd && endInfo && <span className={`p-result ${endInfo.winner === null ? 'draw' : endInfo.winner === c ? 'win' : 'loss'}`}>{endInfo.winner === null ? '½' : endInfo.winner === c ? '1' : '0'}</span>}
      <span className="p-tools">{children}</span>
    </div>
  );
  const topC = flipped ? 'w' : 'b', bottomC = flipped ? 'b' : 'w';

  return (
    <main className="stage">
      <Timeline moves={review.moves} ply={ply} onPick={go} focus={focus} ending={endInfo} />
      <section className="center">
        <PlayerRow p={top} c={topC}>
          <button className={`tool${fav ? ' fav' : ''}`} onClick={() => library.toggleFav(review)} aria-pressed={fav} title={fav ? 'Remove from favourites' : 'Add to favourites'}><Star size={17} weight={fav ? 'fill' : 'bold'} /></button>
        </PlayerRow>
        <div className="board-wrap">
          <EvalBar evalWhite={cur ? cur.evalWhite : 20} flipped={flipped} />
          <div className="board-holder">
            <Board fen={boardFen} flipped={flipped} lastMove={cur?.uci ?? last?.uci} label={cur?.label} arrows={arrows} pieceSet={pieceSet} onMove={onBoardMove}
              end={atEnd && endInfo ? { winner: endInfo.winner, reason: endInfo.reason } : null} />
          </div>
        </div>
        <PlayerRow p={bottom} c={bottomC}>
          <button className="tool" onClick={() => setFlipped((f) => !f)} aria-label="Flip board" title="Flip board (F)"><ArrowsDownUp size={17} weight="bold" /></button>
          <button className="tool" onClick={() => { setSoundOn(!sound); setSound(!sound); }} aria-label={sound ? 'Mute move sounds' : 'Turn on move sounds'} aria-pressed={sound}>{sound ? <SpeakerHigh size={17} weight="bold" /> : <SpeakerSlash size={17} weight="bold" />}</button>
        </PlayerRow>
      </section>
      <aside className="side">
        <div className="under">
          <AnimatePresence initial={false}>
            {atEnd && endInfo && (
              <motion.div className="end-card" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                <span className="end-score">{endInfo.winner === 'w' ? '1-0' : endInfo.winner === 'b' ? '0-1' : '½-½'}</span>
                <span className="end-text">{endInfo.text}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* One card under the board: the verdict, why, and the best line. Never on the board. */}
          <motion.div key={`${ply}-${last?.key ?? 0}-${thinking}`} className="verdict" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="v-main">
              {cur ? (<>
                <ClassIcon label={cur.label} size={34} />
                <div className="v-text">
                  <div className="v-head">{last && <span className="whatif-tag">What if</span>}<b>{moveNo}{cur.san}</b> {LABELS[cur.label].verb}</div>
                  <div className="v-why">{ex?.why.join(' ')}</div>
                </div>
                {canSave && <button className={`tool${savedHere ? ' on' : ''}`} onClick={() => library.toggleMove(review, ply)} aria-pressed={savedHere} title={savedHere ? 'Remove from saved moves' : 'Save this move to your Library'}>
                  <BookmarkSimple size={18} weight={savedHere ? 'fill' : 'bold'} /></button>}
                <span className={`eval-chip ${cur.evalWhite >= 0 ? 'w' : 'b'}`}>{fmtEval(cur.evalWhite)}</span>
              </>) : last ? (
                <div className="v-text"><div className="v-head"><span className="whatif-tag">What if</span><b>{last.moveNo}{last.san}</b></div>
                  <div className="v-why">{last.failed ? 'The engine could not check this move.' : <span className="thinking">Checking with the engine</span>}</div></div>
              ) : <div className="v-text"><div className="v-head"><b>Start of the game</b></div><div className="v-why">Arrow keys to step, Space for the next key moment. Move a piece to try your own idea.</div></div>}
            </div>
            {cur && cur.bestLine && cur.bestLine.length > 0 && !['book', 'forced'].includes(cur.label) && (
              <div className="v-line">
                <span className="line-k">{cur.uci === cur.best ? 'Line' : 'Best'}</span>
                <span className="line-moves">{cur.bestLine.join(' ')}</span>
                <button className="why-btn" onClick={() => setShowNumbers((v) => !v)} aria-expanded={showNumbers}><Info size={14} weight="bold" />Why</button>
              </div>
            )}
            <AnimatePresence initial={false}>{showNumbers && ex && <motion.p className="numbers" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{ex.numbers}</motion.p>}</AnimatePresence>
          </motion.div>
          {tried.length > 0 && (
            <div className="whatif-bar">
              <span className="line-k">Your line</span>
              {tried.map((t, i) => <span key={t.key} className="line-m">{i === 0 || t.color === 'w' ? t.moveNo : ''}{t.san}{t.result && <i className="dotlabel" style={{ background: LABELS[t.result.label].color }} />}</span>)}
              <button className="pill line back-btn" onClick={() => setTried([])}><ArrowUUpLeft size={15} weight="bold" />Back to game</button>
            </div>
          )}
          <nav className="controls" aria-label="Move navigation">
            <button onClick={back} aria-label="Previous move" title="Previous (Left arrow)"><CaretLeft size={18} weight="bold" /></button>
            <button className="primary" onClick={() => nextKey()} title="Next key moment (Space)"><Lightning size={17} weight="fill" /><span className="lbl">Next key moment</span></button>
            <button onClick={forward} aria-label="Next move" title="Next (Right arrow)" disabled={tried.length > 0}><CaretRight size={18} weight="bold" /></button>
          </nav>
        </div>
        <Scorecard review={review} focus={focus} onFocus={setFocus} onJump={(l) => nextKey(l)} />
      </aside>
    </main>
  );
}

/* ---------- library ---------- */
function LibraryPanel({ onOpen, onClose }: { onOpen: (g: SavedGame, ply?: number) => void; onClose: () => void }) {
  const lib = useLibrary();
  const [tab, setTab] = useState<'fav' | 'moves' | 'recent'>(() => (lib.games.some((g) => g.fav) ? 'fav' : lib.moves.length ? 'moves' : 'recent'));
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const games = tab === 'fav' ? lib.games.filter((g) => g.fav) : lib.games;
  const tabs = [['fav', 'Favourites', lib.games.filter((g) => g.fav).length], ['moves', 'Saved moves', lib.moves.length], ['recent', 'Recent', lib.games.length]] as const;
  const empty = { fav: 'Star a game in a review and it stays here.', moves: 'Save a Brilliant or Great move from its caption and it lands here.', recent: 'Games you review show up here.' }[tab];
  return (
    <motion.div className="lib-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside className="lib glass" role="dialog" aria-modal="true" aria-label="Library" onClick={(e) => e.stopPropagation()}
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <header className="lib-head"><h2>Library</h2><button className="icon-btn" onClick={onClose} aria-label="Close library"><X size={18} weight="bold" /></button></header>
        <div className="lib-tabs" role="tablist">
          {tabs.map(([k, name, count]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{name}<span>{count}</span></button>)}
        </div>
        <div className="lib-body">
          {tab === 'moves' ? (lib.moves.length ? (
            <ul className="lib-moves">{lib.moves.map((m, i) => {
              const g = lib.games.find((x) => x.id === m.gameId);
              return (
                <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, ease: EASE, duration: 0.4 }}>
                  <button className="lib-move" onClick={() => g && onOpen(g, m.ply)} disabled={!g}>
                    <MiniBoard fen={m.fenAfter} size={112} marks={{ [m.uci.slice(0, 2)]: m.label, [m.uci.slice(2, 4)]: m.label }} />
                    <span className="lm-text"><span className="lm-move"><ClassIcon label={m.label} size={20} /><b>{m.moveNo}{m.san}</b></span>
                      <span className="lm-players">{m.white} vs {m.black}</span>{m.date && <span className="lm-date">{m.date.replace(/\./g, '-')}</span>}</span>
                  </button>
                  {g && <button className="icon-btn lm-del" onClick={() => library.toggleMove(g.review, m.ply)} aria-label={`Remove ${m.san} from saved moves`}><Trash size={15} weight="bold" /></button>}
                </motion.li>
              );
            })}</ul>
          ) : <p className="lib-empty">{empty}</p>) : games.length ? (
            <ul className="lib-games">{games.map((g, i) => {
              const r = g.review, saved = lib.moves.filter((m) => m.gameId === g.id).length;
              return (
                <motion.li key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, ease: EASE, duration: 0.4 }}>
                  <button className="lib-game" onClick={() => onOpen(g)}>
                    <span className="lg-players"><b>{r.white.name}</b> <span className="vs">vs</span> <b>{r.black.name}</b></span>
                    <span className="lg-meta">{r.meta?.result ?? ''}{r.meta?.date ? ` · ${r.meta.date.replace(/\./g, '-')}` : ''}{r.accuracy.w != null ? ` · ${r.accuracy.w.toFixed(1)} / ${r.accuracy.b?.toFixed(1)}` : ''}{saved ? ` · ${saved} saved` : ''}</span>
                  </button>
                  <button className={`icon-btn${g.fav ? ' on' : ''}`} onClick={() => library.toggleFav(r)} aria-pressed={g.fav} aria-label={g.fav ? 'Remove from favourites' : 'Add to favourites'}><Star size={16} weight={g.fav ? 'fill' : 'bold'} /></button>
                  <button className="icon-btn" onClick={() => library.removeGame(g.id)} aria-label="Remove from library"><Trash size={15} weight="bold" /></button>
                </motion.li>
              );
            })}</ul>
          ) : <p className="lib-empty">{empty}</p>}
        </div>
        <p className="lib-foot">Stored in this browser only.</p>
      </motion.aside>
    </motion.div>
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
  const [stage, setStage] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [openAt, setOpenAt] = useState({ ply: -1, n: 0 });
  const openSaved = useCallback((g: SavedGame, ply = -1) => {
    abort.current?.abort();
    setReview(g.review); setOpenAt({ ply, n: Date.now() }); store.set('fianco:last', JSON.stringify(g.review)); setMode('review'); setLibOpen(false);
  }, []);

  const run = useCallback(async (pgn: string, me?: string) => {
    setErr(null); setProgress(0); setStage(null); setMode('analysing');
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      const r = await analyzePgn(pgn, { strength, onProgress: setProgress, onStage: setStage, signal });
      if (signal.aborted) return;
      const meLc = me?.toLowerCase();
      if (meLc) r.meta = { ...r.meta, me: r.black.name.toLowerCase() === meLc ? 'b' : 'w' };
      if (/chess\.com/i.test(r.meta?.site ?? '')) {
        const [wp, bp] = await Promise.all([chesscomProfile(r.white.name), chesscomProfile(r.black.name)]);
        r.white.avatar = wp.avatar; r.black.avatar = bp.avatar;
        r.white.title ||= wp.title; r.black.title ||= bp.title;
      }
      setReview(r); setOpenAt({ ply: -1, n: Date.now() }); store.set('fianco:last', JSON.stringify(r)); library.remember(r); setMode('review');
    } catch (e) {
      if (signal.aborted) return; // Cancel already returned to the import screen; a newer run may be going.
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
        <div className="game-meta">{mode === 'review' && review ? <>{review.white.title ? `${review.white.title} ` : ''}{review.white.name} <span>vs</span> {review.black.title ? `${review.black.title} ` : ''}{review.black.name}{review.meta?.result ? <> · {review.meta.result}</> : null}</> : null}</div>
        <div className="top-actions">
          <div className="strength" role="radiogroup" aria-label="Engine strength">
            {(['fast', 'standard', 'deep'] as Strength[]).map((s) => <button key={s} role="radio" aria-checked={strength === s} className={strength === s ? 'on' : ''} onClick={() => setStrength(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
          </div>
          <button className="pill line lib-btn" onClick={() => setLibOpen(true)} aria-haspopup="dialog"><Books size={17} weight="bold" /><span>Library</span></button>
          {mode === 'review' && <button className="pill fill" onClick={() => setMode('import')}>New review</button>}
        </div>
      </header>
      {err && mode === 'import' && <p className="err top" role="alert">{err}</p>}
      {mode === 'import' && <Import onPgn={run} initial={initial && !isPgn(initial) ? initial : undefined} />}
      {mode === 'analysing' && <Analysing progress={progress} stage={stage} onCancel={() => { abort.current?.abort(); setMode('import'); }} />}
      {mode === 'review' && review && <ReviewView key={gameId(review) + openAt.n} review={review} initialPly={openAt.ply} />}
      <AnimatePresence>{libOpen && <LibraryPanel onOpen={openSaved} onClose={() => setLibOpen(false)} />}</AnimatePresence>
    </div>
  );
}
