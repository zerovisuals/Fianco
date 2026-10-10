import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView, useReducedMotion, AnimatePresence, animate, useMotionValue } from 'motion/react';
import { MagnifyingGlass, ArrowRight, Check } from '@phosphor-icons/react';
import { Floaters, HERO_FLOATERS } from './Floaters';
import { MiniBoard, pieceSrc } from '../MiniBoard';
import { ClassIcon } from '../icons';
import { LABELS, type Label } from '../labels';
import './landing.css';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const go = (q?: string) => { if (q) sessionStorage.setItem('fianco:import', q); location.hash = '#/review'; };

function Nav() {
  const [q, setQ] = useState('');
  return (
    <header className="nav glass">
      <a className="logo" href="#/" aria-label="Fianco home"><i /><span>Fianco</span></a>
      <nav className="nav-links"><a href="#how">How it works</a><a href="#fixed">What we fixed</a><a href="#pricing">Pricing</a></nav>
      <form className="nav-search" onSubmit={(e) => { e.preventDefault(); go(q.trim() || undefined); }}>
        <MagnifyingGlass size={16} weight="bold" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paste a PGN or a chess.com username" aria-label="Paste a PGN or a chess.com username" />
        <kbd>↵</kbd>
      </form>
      <button className="pill fill" onClick={() => go()}>Open app</button>
    </header>
  );
}

function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span className="word" key={i}>
          <motion.span initial={reduce ? false : { y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.06 }}>{w}</motion.span>
        </span>
      ))}
    </>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const reduce = useReducedMotion();
  const titleY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const titleO = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  return (
    <section className="hero" ref={ref}>
      <Floaters items={HERO_FLOATERS} scroll={scrollYProgress} />
      <motion.div className="hero-copy" style={{ y: titleY, opacity: titleO }}>
        <motion.div className="eyebrow" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>Free chess game review</motion.div>
        <h1 className="display"><Words text="Every move" /><br /><Words text="has a name." delay={0.14} /></h1>
        <motion.div className="hero-cta" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7, ease: EASE }}>
          <button className="pill fill" onClick={() => go()}>Review a game</button>
          <a className="pill line" href="#how">How it works</a>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ---------- three-up ---------- */
const GREEK_BEFORE = 'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 1';
function GreekGift() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [phase, setPhase] = useState(0);   // 0 start, 1 moved, 2 labelled
  useEffect(() => {
    if (!inView) return;
    let t: number[] = [];
    const loop = () => { setPhase(0); t = [window.setTimeout(() => setPhase(1), 900), window.setTimeout(() => setPhase(2), 1500), window.setTimeout(loop, 4600)]; };
    loop(); return () => t.forEach(clearTimeout);
  }, [inView]);
  const S = 96; // render size of a square for the static crop; animated pieces use % so the card can scale
  const at = (file: number, rank: number) => ({ x: `${(file - 3) * 100}%`, y: `${(7 - rank) * 100}%` });
  const from = at(3, 2), to = at(7, 6);
  const fenNoBishopNoPawn = 'r1bq1rk1/pppn1pp1/4p3/3pP3/1b1P4/2N2N2/PPP2PPP/R2QK2R w KQ - 0 1';
  return (
    <div className="card-art" ref={ref}>
      <MiniBoard fen={fenNoBishopNoPawn} size={S * 5} files={[3, 7]} ranks={[7, 3]} marks={phase ? { d3: 'brilliant', h7: 'brilliant' } : {}} />
      <AnimatePresence>{phase === 0 && <motion.img key="pawn" className="anim-piece" src={pieceSrc('p')} style={{ x: to.x, y: to.y }} exit={{ opacity: 0, scale: 0.7, transition: { delay: 0.25, duration: 0.2 } }} />}</AnimatePresence>
      <motion.img className="anim-piece" src={pieceSrc('B')} initial={false} animate={phase ? to : from} transition={{ type: 'spring', stiffness: 260, damping: 26 }} />
      <AnimatePresence>
        {phase === 2 && (
          <motion.div key="stamp" className="stamp" style={{ left: '91%', top: '15%' }} initial={{ scale: 0.2, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
            <ClassIcon label="brilliant" size={44} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === 2 && (
          <motion.div key="cap" className="caption glass" initial={{ y: 20, opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}>
            <ClassIcon label="brilliant" size={34} /><span><b>Bxh7+</b> is brilliant<small>Gives up the bishop to open the king</small></span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Count({ to, start }: { to: number; start: boolean }) {
  const v = useMotionValue(0);
  const [t, setT] = useState('0.0');
  useEffect(() => v.on('change', (x) => setT(x.toFixed(1))), [v]);
  useEffect(() => { if (start) { const c = animate(v, to, { duration: 1.6, ease: EASE }); return () => c.stop(); } }, [start, to, v]);
  return <>{t}</>;
}
function AccuracyArt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div className="card-art acc" ref={ref}>
      <div className="acc-big"><div className="n"><Count to={92.0} start={inView} /></div><span>White · accuracy</span></div>
      <div className="acc-small"><div className="n"><Count to={87.4} start={inView} /></div><span>Black</span></div>
      <div className="acc-phases">{[['Opening', 98], ['Middlegame', 89], ['Endgame', 94]].map(([n, v]) => <div key={n}><span>{n}</span><b className="mono">{v}</b></div>)}</div>
    </div>
  );
}
function LevelArt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [hi, setHi] = useState(false);
  useEffect(() => { if (!inView) return; const id = setInterval(() => setHi((h) => !h), 2400); return () => clearInterval(id); }, [inView]);
  const label: Label = hi ? 'good' : 'great';
  return (
    <div className="card-art" ref={ref}>
      <MiniBoard fen="r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1" size={480} files={[2, 6]} ranks={[6, 2]} marks={{ c3: label, d5: label }} />
      <div className="level glass" role="group" aria-label="Player rating">
        {[900, 2200].map((r, i) => <button key={r} className={(i === 1) === hi ? 'on' : ''} aria-pressed={(i === 1) === hi} onClick={() => setHi(i === 1)}><span>{r}</span></button>)}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={label} className="caption glass" initial={{ y: 16, opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: -12, opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease: EASE }}>
          <ClassIcon label={label} size={34} /><span><b>Nd5</b> {LABELS[label].verb}<small>{hi ? 'Expected at 2200' : 'Hard to find at 900'}</small></span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children, i = 0, className = '' }: { children: React.ReactNode; i?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.09 }}>
      {children}
    </motion.div>
  );
}

function How() {
  return (
    <section className="how" id="how">
      <Reveal><h2 className="h2 center">Read the game the way you played it.</h2></Reveal>
      <div className="three">
        <Reveal i={0}><GreekGift /><p className="card-cap">Every move named</p></Reveal>
        <Reveal i={1}><AccuracyArt /><p className="card-cap">Accuracy that reads like a grade</p></Reveal>
        <Reveal i={2}><LevelArt /><p className="card-cap">Judged at your level</p></Reveal>
      </div>
    </section>
  );
}

/* ---------- what we fixed ---------- */
const FIXES: { label: Label; t: string; d: string }[] = [
  { label: 'best', t: 'Unlimited reviews', d: 'No daily cap. The engine runs on your computer, so every game gets a full review.' },
  { label: 'great', t: 'Your move and the best move, together', d: 'Both arrows on the board at once, and the best line written out. No toggling.' },
  { label: 'good', t: 'The graph never leaves', d: 'The evaluation runs beside the move list for the whole review, marking where you are.' },
  { label: 'inaccuracy', t: 'Every label explains itself', d: 'What hangs, what was threatened, what the best move wins. Plain reasons from the engine line.' },
  { label: 'book', t: 'Same answer every time', d: 'Fixed strength, shown on screen. Your brilliant stays brilliant next week.' },
  { label: 'excellent', t: 'Any game, any source', d: 'Paste a PGN from a club game, or type a chess.com username to pull your latest.' },
];
function Fixed() {
  return (
    <section className="fixed" id="fixed">
      <div className="fixed-head"><Reveal><h2 className="h2">We fixed what bugged you about game review.</h2></Reveal>
        <Reveal i={1}><p className="lede">Built from what players keep asking for on forums and reviews.</p></Reveal></div>
      <div className="fixed-list">
        {FIXES.map((f, i) => (
          <Reveal key={f.t} i={i % 2} className="fix">
            <ClassIcon label={f.label} size={36} />
            <div><h3>{f.t}</h3><p>{f.d}</p></div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- pricing ---------- */
function Pricing() {
  const free = ['Unlimited full game reviews', 'All move labels, accuracy and game rating', 'Why every label was given', 'Best line shown automatically', 'Retry the key moments', 'PGN and chess.com import'];
  const pro = ['Insights across all your games', 'Drills built from your own mistakes', 'Your opening repertoire', 'Coach explanations in plain language', 'Auto-review, sync and history', 'Extra piece sets and board themes'];
  return (
    <section className="pricing" id="pricing">
      <Reveal><h2 className="h2 center">Review is free. Getting better is Pro.</h2></Reveal>
      <div className="plans">
        <Reveal i={0} className="plan">
          <div className="plan-top"><h3>Free</h3><div className="price">€0<span>forever</span></div></div>
          <ul>{free.map((x) => <li key={x}><Check size={16} weight="bold" />{x}</li>)}</ul>
          <button className="pill fill" onClick={() => go()}>Review a game</button>
        </Reveal>
        <Reveal i={1} className="plan pro">
          <div className="plan-board" aria-hidden><MiniBoard fen="r1bq1rk1/pppn1ppB/4p3/3pP3/1b1P4/2N2N2/PPP2PPP/R2QK2R b KQ - 0 1" size={560} /></div>
          <div className="plan-glass glass">
            <div className="plan-top"><h3>Pro <span className="soon">Early access</span></h3><div className="price">€7.99<span>per month · €59 a year</span></div><p className="founding">Founding members: €49 a year, locked for life.</p></div>
            <ul>{pro.map((x) => <li key={x}><Check size={16} weight="bold" />{x}</li>)}</ul>
            <button className="pill line" disabled title="Pro is not available yet">Coming soon</button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Closing() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const reduce = useReducedMotion();
  const mark = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 160, 0]);
  const parted = useTransform(scrollYProgress, (v) => 1 - v);
  return (
    <section className="closing" ref={ref}>
      <Floaters items={HERO_FLOATERS.filter((_, i) => i % 2 === 0).map((f) => ({ ...f, y: f.y * 0.55 }))} scroll={parted} interactive={false} />
      <div className="closing-copy">
        <p>Your last game is waiting.</p>
        <button className="cta-big" onClick={() => go()}>Review it with Fianco <ArrowRight size={22} weight="bold" /></button>
        <small>Free. Runs in your browser. Your games stay on your machine.</small>
      </div>
      <footer className="foot"><span>How it works · What we fixed · Pricing</span><span>Privacy · Licences</span></footer>
      <motion.div className="wordmark" style={{ y: mark }} aria-label="Fianco">{[...'FIANCO'].map((c, i) => <span key={i} style={{ ['--i' as string]: i }} aria-hidden>{c}</span>)}</motion.div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <Nav />
      <Hero />
      <How />
      <Fixed />
      <Pricing />
      <Closing />
    </div>
  );
}
