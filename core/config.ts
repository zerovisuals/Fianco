// Every free parameter of the model. compare/ fits these against chess.com output.
export const config = {
  ep: { k0: 0.40, k1: 0.10, mateValue: 1 },          // EP = 1/(1+e^(-k(elo)*cp/100))
  bands: { best: 0.0, excellent: 0.02, good: 0.05, inaccuracy: 0.10, mistake: 0.20 },
  blunder: { horizon: 6, minMaterial: 1 },              // material lost within N plies of the reply PV
  miss: { oppLoss: 0.10, recoverable: 0.10, minLoss: 0.05 },
  great: { gapBase: 0.12, gapEloSlope: 0.02, alreadyWinning: 0.92, losing: 0.30, winning: 0.70 },
  // Sacrificed piece must be worth ≥ minValue and the net material offered (SEE) ≥ netLoss.
  brilliant: { minValueLow: 3, minValueHigh: 3, netLossLow: 2, netLossHigh: 2, lowEloCut: 1000, floor: 0.45, alreadyWinning: 0.92 },
  accuracy: { a: 103.17, b: 4.0, c: 3.17, p: 1.0, floor: 0 },
  phase: { endgameMaterial: 26, openingMaxPly: 30 },
  rating: { base: 0, accSlope: 0, oppWeight: 1 },
};
export type Config = typeof config;
