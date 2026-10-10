# Viewport screenshots down the landing page (desktop + mobile) with bundled Chromium; also logs console errors.
import sys, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path('brand/site-png'); out.mkdir(parents=True, exist_ok=True)
url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5180/'
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('desk', {'width': 1440, 'height': 900}), ('mob', {'width': 390, 'height': 844})]:
        pg = b.new_page(viewport=vp, device_scale_factor=1)
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(2600)
        h = pg.evaluate('document.documentElement.scrollHeight')
        y, i = 0, 0
        while y < h and i < 12:
            pg.evaluate(f'scrollTo(0,{y})'); pg.wait_for_timeout(1800)
            pg.screenshot(path=str(out / f'{name}-{i:02d}.png')); y += vp['height']; i += 1
        print(name, 'height', h, 'shots', i, 'errors', errs[:5])
        pg.close()
    b.close()
