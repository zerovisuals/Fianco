import json, time
from playwright.sync_api import sync_playwright
PGN = open('showcase/opera.pgn', encoding='utf8').read()
SAMPLE = open('app/public/sample.pgn', encoding='utf8').read()
def run(pg, pgn):
    pg.goto('http://localhost:5180/#/review'); pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(800)
    pg.click('textarea'); pg.keyboard.insert_text(pgn); t = time.time(); pg.click('button:has-text("Review")')
    pg.wait_for_selector('.scorecard', timeout=300000); dt = time.time() - t
    r = json.loads(pg.evaluate("localStorage.getItem('fianco:last')"))
    return dt, [(m['label'], m['evalWhite']) for m in r['moves']], r['accuracy']
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for name, pgn in [('opera', PGN), ('sample 64 moves', SAMPLE)]:
        a = run(pg, pgn); c = run(pg, pgn)
        print(f'{name}: {a[0]:.1f}s / {c[0]:.1f}s  identical labels+evals: {a[1] == c[1]}  accuracy {a[2]} vs {c[2]}')
        if name == 'opera': print('  Bxd7+:', a[1][28], ' Rxd7:', a[1][24], ' Qb8+:', a[1][30])
    b.close()
