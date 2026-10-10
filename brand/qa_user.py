# Username flow: fetch evptt games, open one where evptt is Black, check orientation, avatars, caption edge.
import time, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path('brand/site-png')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:5180/#/review'); pg.wait_for_timeout(1200)
    pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(1000)
    pg.fill('textarea', 'evptt'); pg.keyboard.press('Enter')
    pg.wait_for_selector('.games li', timeout=60000)
    rows = pg.query_selector_all('.games li button')
    target = next(r for r in rows if r.inner_text().split('vs')[1].strip().lower().startswith('evptt'))
    print('picked:', target.inner_text().replace('\n', ' | '))
    pg.click('text=Fast'); target.click()
    pg.wait_for_selector('.scorecard', timeout=300000); pg.wait_for_timeout(1500)
    bottom_player = pg.query_selector_all('.center .player')[1].inner_text()
    print('bottom player (should be evptt):', bottom_player)
    print('avatars:', [i.get_attribute('src') for i in pg.query_selector_all('img.avatar')])
    tops = []
    js = "(() => { const c = [...document.querySelectorAll('.coach')].pop(); const t = c.querySelector('.coach-text'); return [c.className, t ? t.innerText.split(String.fromCharCode(10))[0] : '']; })()"
    for i in range(60):
        pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(520)
        info = pg.evaluate(js)
        if i < 5: print(i, info)
        if 'at-top' in info[0]:
            tops.append(info[1])
            if len(tops) == 2: pg.screenshot(path=str(out / 'app-caption-top.png'))
    print('caption moved to top for:', tops[:8])
    pg.screenshot(path=str(out / 'app-user.png'))
    print('errors', errs[:5]); b.close()
