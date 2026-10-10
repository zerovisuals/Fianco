// Every free parameter of the model. compare/ fits these against chess.com output.
export const config = {
  ep: { k0: 0.40, k1: 0.10, mateValue: 1 },          // EP = 1/(1+e^(-k(elo)*cp/100))
  bands: { best: 0.0, excellent: 0.02, good: 0.05, inaccuracy: 0.10, mistake: 0.20 },
  blunder: { horizon: 6, minMaterial: 1 },              // material lost within N plies of the reply PV
  miss: { oppLoss: 0.10, recoverable: 0.10, minLoss: 0.05 },
  great: { gapBase: 0.12, gapEloSlope: 0.02, alreadyWinning: 0.92, losing: 0.30, winning: 0.70 },
  // Sacrificed piece must be worth ≥ minValue and the net material offered (SEE) ≥ netLoss.
  brilliant: { minValueLow: 3, minValueHigh: 3, netLossLow: 2, netLossHigh: 2, lowEloCut: 1000, floor: 0.45, alreadyWinning: 0.92 },
  // CAPS2-style accuracy, fitted on 448 players (chess.com API accuracies, our Stockfish evals): held-out MAE 2.13.
  // Own win curve (k per 100 cp), per-move score a·e^(-b·lost%) - c, power mean with exponent p. Book moves count.
  accuracy: { k0: 0.1869, k1: -0.0025, a: 114.986, b: 0.1417, c: 9.725, p: 0.3869, clipCp: 1500 },
  phase: { endgameMaterial: 26, openingMaxPly: 30 },
  // Game rating v1: linear in accuracy and both Elos, fitted on captured chess.com reviews (held-out MAE ~125).
  rating: { bias: -2685.42, acc: 41.5791, elo: 0.7821, opp: 0.2463, accElo: -4.2047,
    accOnly: { bias: -1669.80, acc: 43.9778 } },
};
export type Config = typeof config;
