// Quiet move sounds (CC0 recordings from Kenney, see public/sounds/LICENSE.txt), played through Web Audio
// so rapid stepping through moves doesn't lag or cut off.
const FILES = { move1: 'move-1', move2: 'move-2', capture: 'capture', brilliant: 'brilliant' } as const;
type Name = keyof typeof FILES;
const VOLUME: Record<Name, number> = { move1: 0.35, move2: 0.35, capture: 0.4, brilliant: 0.22 };
const KEY = 'fianco:sound';

let ctx: AudioContext | null = null;
const buffers = new Map<Name, Promise<AudioBuffer | null>>();
let alt = false;

export function soundOn() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setSoundOn(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ } }

function load(name: Name) {
  if (!buffers.has(name)) {
    buffers.set(name, fetch(`/sounds/${FILES[name]}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).catch(() => null));
  }
  return buffers.get(name)!;
}

async function play(name: Name, delay = 0) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const buf = await load(name);
  if (!buf || !ctx) return;
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  gain.gain.value = VOLUME[name];
  src.buffer = buf; src.connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + delay);
}

/** Sound for stepping onto a move: a wood knock (heavier on captures), plus a soft chime on a Brilliant. */
export function moveSound(san: string, label: string) {
  if (!soundOn()) return;
  if (san.includes('x')) play('capture');
  else { play(alt ? 'move2' : 'move1'); alt = !alt; }
  if (label === 'brilliant') play('brilliant', 0.12);
}
