# End-to-end: open the review app, analyse the sample in-browser, step through key moments, screenshot.
import pathlib, time
from playwright.sync_api import sync_playwright
out = pathlib.Path('brand/site-png'); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5180/#/review'); pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(out / 'app-import.png'))
    pg.get_by_text('Try a sample').click()
    t0 = time.time(); pg.wait_for_timeout(2500); pg.screenshot(path=str(out / 'app-analysing.png'))
    pg.wait_for_selector('.scorecard', timeout=240000)
    print('analysis seconds', round(time.time() - t0, 1))
    pg.wait_for_timeout(2000); pg.screenshot(path=str(out / 'app-review-0.png'))
    for i in range(3):
        pg.keyboard.press('Space'); pg.wait_for_timeout(1200)
        pg.screenshot(path=str(out / f'app-review-key{i+1}.png'))
    print('coach:', pg.inner_text('.coach'))
    print('errors', errs[:6])
    b.close()
