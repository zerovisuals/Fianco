import type { Label } from './labels';
import type { Ending } from './engine/ending';

export type Move = {
  san: string; uci: string; color: 'w' | 'b'; fen: string; fenAfter: string; label: Label; sub?: string;
  best: string; bestSan?: string; bestLine?: string[]; reply?: string[];
  evalWhite: number; phase: 0 | 1 | 2; loss: number;
  epBest: number; epPlayed: number; elo: number; prevLoss?: number;
};
export type Player = { name: string; elo: number; avatar?: string | null; title?: string | null };
export type Review = {
  white: Player; black: Player; startFen: string; moves: Move[];
  accuracy: { w: number | null; b: number | null };
  phaseAccuracy: { w: (number | null)[]; b: (number | null)[] };
  rating?: { w: number; b: number } | null;
  ratingEst?: { w: { value: number; approx: boolean } | null; b: { value: number; approx: boolean } | null };
  meta?: { result?: string; date?: string; timeControl?: string; opening?: string; strength?: string; depth?: number; site?: string; me?: 'w' | 'b'; ending?: Ending | null };
};
