# README assets: label marbles (from the board page renderer), hero + review screenshots.
import shutil, time
from playwright.sync_api import sync_playwright
LABELS = ['brilliant','great','best','excellent','good','book','inaccuracy','mistake','miss','blunder','forced']
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 600, 'height': 300}, device_scale_factor=2)
    pg.goto('http://localhost:5180/brand/board.html'); pg.wait_for_timeout(800)
    for l in LABELS:
        pg.evaluate(f"document.body.innerHTML = '<div id=m style=\"display:inline-block;padding:6px;background:transparent\">' + marble('{l}', 40) + '</div>'; document.documentElement.style.background='transparent'; document.body.style.background='transparent'")
        pg.wait_for_timeout(100); pg.locator('#m').screenshot(path=f'docs/labels/{l}.png', omit_background=True)
    pg.close()
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.goto('http://localhost:5180/#/review'); pg.wait_for_timeout(1000)
    pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(1000)
    pg.get_by_text('Try a sample').click(); pg.wait_for_selector('.scorecard', timeout=300000); pg.wait_for_timeout(1500)
    for _ in range(2): pg.keyboard.press('Space'); pg.wait_for_timeout(900)
    pg.screenshot(path='docs/review.png'); b.close()
shutil.copy('app/public/og.png', 'docs/hero.png')
print('ok')
