# Records showcase clips from the live dev site (bundled Chromium, 1920x1080 video).
import pathlib, shutil, time
from playwright.sync_api import sync_playwright
RAW = pathlib.Path('showcase/raw'); RAW.mkdir(parents=True, exist_ok=True)
PGN = open('showcase/opera.pgn', encoding='utf8').read()

def ctx(b, name):
    c = b.new_context(viewport={'width': 1920, 'height': 1080}, record_video_dir=str(RAW / name), record_video_size={'width': 1920, 'height': 1080})
    return c, c.new_page()

def save(c, pg, name):
    v = pg.video; c.close()
    shutil.move(v.path(), RAW / f'{name}.webm'); shutil.rmtree(RAW / name, ignore_errors=True)

def glide(pg, pts, steps=60):
    for x, y in pts: pg.mouse.move(x, y, steps=steps)

def smooth_scroll(pg, total, step=6, delay=16):
    for _ in range(total // step): pg.mouse.wheel(0, step); pg.wait_for_timeout(delay)

with sync_playwright() as p:
    b = p.chromium.launch()
    import sys
    if 'review' in sys.argv: pass
    else:
     pass
    # 1 · Landing: entrance, parallax, scroll through, wordmark hover
    c, pg = ctx(b, 'landing'); pg.mouse.move(960, 540)
    pg.goto('http://localhost:5180/'); pg.wait_for_timeout(2600)
    glide(pg, [(1500, 300), (400, 800), (1200, 900), (960, 540)], 90)
    pg.wait_for_timeout(600); smooth_scroll(pg, 1100); pg.wait_for_timeout(5200)   # how-it-works cards play
    smooth_scroll(pg, 1000); pg.wait_for_timeout(1800); smooth_scroll(pg, 1000); pg.wait_for_timeout(1600)
    smooth_scroll(pg, 2400, 8); pg.wait_for_timeout(800)
    glide(pg, [(700, 950), (1100, 960)], 50); pg.wait_for_timeout(1400)
    save(c, pg, 'landing')
    # 2 · Review: paste the Opera Game, analyse, walk the key moments
    c, pg = ctx(b, 'review')
    pg.goto('http://localhost:5180/#/review'); pg.evaluate("localStorage.removeItem('fianco:last')"); pg.reload(); pg.wait_for_timeout(1200)
    pg.click('textarea'); pg.keyboard.insert_text(PGN); pg.wait_for_timeout(900)
    pg.click('button:has-text("Review")'); pg.wait_for_selector('.scorecard', timeout=300000); pg.wait_for_timeout(2500)
    # Story beats of the Opera Game, clicked in the move list.
    for ply, hold in [(18, 2600), (22, 2600), (24, 3200), (28, 2600), (30, 2400)]:
        pg.click(f'[data-ply="{ply}"]'); pg.wait_for_timeout(hold)
    pg.click('.why-btn'); pg.wait_for_timeout(3400)
    pg.click('[data-ply="32"]'); pg.wait_for_timeout(2800)
    save(c, pg, 'review')
    b.close()
print('ok', [f.name for f in RAW.glob('*.webm')])
