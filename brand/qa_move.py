import json
from playwright.sync_api import sync_playwright
PGN = open('showcase/opera.pgn', encoding='utf8').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.goto('http://localhost:5180/#/review'); pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(1000)
    print('isolated', pg.evaluate('crossOriginIsolated'), 'cores', pg.evaluate('navigator.hardwareConcurrency'))
    pg.click('textarea'); pg.keyboard.insert_text(PGN); pg.click('button:has-text("Review")')
    pg.wait_for_selector('.scorecard', timeout=300000)
    r = json.loads(pg.evaluate("localStorage.getItem('fianco:last')"))
    for i in range(24, 31):
        m = r['moves'][i]; print(i, m['san'], m['label'], 'best', m['best'], m['bestSan'], 'eval', m['evalWhite'], 'loss', round(m['loss'], 3), 'ep', round(m['epBest'], 3), round(m['epPlayed'], 3), m.get('reply'))
    b.close()
