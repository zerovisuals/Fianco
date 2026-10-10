// UCI wrapper around the Stockfish 17.1 NNUE WASM build, for headless corpus runs.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Score = { cp?: number; mate?: number };
export type Line = { multipv: number; depth: number; score: Score; pv: string[] };

const ENGINE = fileURLToPath(new URL('../node_modules/stockfish/src/stockfish-17.1-8e4d048.js', import.meta.url));
/**
 * The exact build the website runs (single-threaded lite NNUE). It can't find its .wasm under a path
 * with spaces, so it runs from a copy in the temp folder.
 */
export const SITE_ENGINE = (() => {
  const name = 'stockfish-17.1-lite-single-03e3232', dir = join(tmpdir(), 'fianco-engine');
  mkdirSync(dir, { recursive: true });
  for (const ext of ['.js', '.wasm']) {
    const dst = join(dir, name + ext);
    if (!existsSync(dst)) copyFileSync(fileURLToPath(new URL(`../app/public/engine/${name}${ext}`, import.meta.url)), dst);
  }
  return join(dir, name + '.js');
})();

export class Engine {
  private p: ChildProcessWithoutNullStreams;
  private buf = '';
  private waiters: Array<{ test: (l: string) => boolean; resolve: (l: string) => void }> = [];
  private listeners: Array<(l: string) => void> = [];

  constructor(threads = 4, hashMb = 256, path = ENGINE) {
    this.p = spawn(process.execPath, [path], { stdio: 'pipe' });
    this.p.stdout.on('data', (d: Buffer) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        for (const l of this.listeners) l(line);
        const w = this.waiters.findIndex((w) => w.test(line));
        if (w >= 0) this.waiters.splice(w, 1)[0].resolve(line);
      }
    });
    this.send('uci');
    this.send(`setoption name Threads value ${threads}`);
    this.send(`setoption name Hash value ${hashMb}`);
  }

  send(cmd: string) { this.p.stdin.write(cmd + '\n'); }
  private wait(test: (l: string) => boolean) { return new Promise<string>((resolve) => this.waiters.push({ test, resolve })); }
  async ready() { this.send('isready'); await this.wait((l) => l === 'readyok'); }

  /** Analyse a FEN. Scores are from the side to move. */
  async analyse(fen: string, opts: { depth?: number; nodes?: number; multipv?: number; searchmoves?: string } = {}) {
    const multipv = opts.multipv ?? 1;
    this.send(`setoption name MultiPV value ${multipv}`);
    await this.ready();
    const lines = new Map<number, Line>();
    const onLine = (l: string) => {
      if (!l.startsWith('info ') || !l.includes(' pv ') || l.includes('lowerbound') || l.includes('upperbound')) return;
      const t = l.split(' ');
      const at = (k: string) => t[t.indexOf(k) + 1];
      const mpv = Number(at('multipv') ?? 1);
      const score: Score = t.includes('mate') ? { mate: Number(at('mate')) } : { cp: Number(at('cp')) };
      lines.set(mpv, { multipv: mpv, depth: Number(at('depth')), score, pv: t.slice(t.indexOf('pv') + 1) });
    };
    this.listeners.push(onLine);
    this.send(`position fen ${fen}`);
    this.send((opts.nodes ? `go nodes ${opts.nodes}` : `go depth ${opts.depth ?? 18}`) + (opts.searchmoves ? ` searchmoves ${opts.searchmoves}` : ''));
    const best = await this.wait((l) => l.startsWith('bestmove'));
    this.listeners.splice(this.listeners.indexOf(onLine), 1);
    return { bestmove: best.split(' ')[1], lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
  }

  newGame() { this.send('ucinewgame'); }
  quit() { this.send('quit'); this.p.kill(); }
}
