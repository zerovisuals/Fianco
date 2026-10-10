# Fianco

Free, unlimited chess game review that runs in your browser. Every move labelled from brilliant to blunder,
with accuracy, game rating, the best line and a plain reason for each label.

**Live:** https://fianco.app

## Run locally

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # static site in dist/
```

## How it works

- `app/` – the site (React + Vite + Motion). Landing page at `/`, review app at `/#/review`.
- `core/` – the review model: expected points, move classification, accuracy. Pure TypeScript, shared by the app and the tooling.
- `app/public/engine/` – Stockfish 17.1 (WebAssembly), runs in a Web Worker on the visitor's machine.
- Imports: paste a PGN, or a chess.com username (public API, read-only).

## Licences and credits

- Stockfish is GPL-3.0 (see `app/public/engine/Copying.txt`).
- Piece sets from the Lichess project: cburnett (GPL-2.0+); maestro, staunty, california (CC BY-NC-SA 4.0).
- Opening names: lichess-org/chess-openings (CC0).
- Icons: Phosphor (MIT). Font: Geist (OFL).

Fianco is not affiliated with chess.com or Lichess.
