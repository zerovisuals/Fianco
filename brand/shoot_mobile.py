from playwright.sync_api import sync_playwright
PGN = open('showcase/opera.pgn', encoding='utf8').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg.goto('http://localhost:5180/'); pg.wait_for_timeout(2800); pg.screenshot(path='showcase/stills/05-mobile-landing.png')
    pg.goto('http://localhost:5180/#/review'); pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(800)
    pg.click('textarea'); pg.keyboard.insert_text(PGN); pg.click('button:has-text("Review")'); pg.wait_for_selector('.scorecard', timeout=300000)
    pg.keyboard.press('End'); [pg.keyboard.press('ArrowLeft') for _ in range(8)]; pg.wait_for_timeout(1500)
    pg.screenshot(path='showcase/stills/06-mobile-review.png'); b.close()
