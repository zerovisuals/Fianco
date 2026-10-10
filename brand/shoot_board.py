# Renders every board tile at native 1600x900 (2x DPR) with Playwright's bundled Chromium.
import sys, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'brand/board-png'); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1700, 'height': 1000}, device_scale_factor=1)
    pg.goto('http://localhost:5180/brand/board.html'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(500)
    pg.evaluate("document.documentElement.style.setProperty('--W','1600px');document.documentElement.style.setProperty('--s','1')")
    for i, t in enumerate(pg.query_selector_all('.tile')):
        t.screenshot(path=str(out / f'tile-{i+1:02d}.png'))
    b.close()
print('ok')
