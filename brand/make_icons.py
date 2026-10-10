# Renders favicon PNGs, touch icon and the 1200x630 share image with bundled Chromium.
from playwright.sync_api import sync_playwright
MARK = lambda s, pad=0: f'''<div style="width:{s}px;height:{s}px;display:grid;place-items:center;background:#fff">
<svg width="{s-2*pad}" height="{s-2*pad}" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="8" fill="#fff"/>
<path fill="#0b0b0b" d="M16 2h6a8 8 0 0 1 8 8v6H16Z"/><path fill="#0b0b0b" d="M2 16h14v14h-6a8 8 0 0 1-8-8Z"/>
<rect x="2.75" y="2.75" width="26.5" height="26.5" rx="7.25" fill="none" stroke="#0b0b0b" stroke-width="1.5"/></svg></div>'''
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size, pad in [('icon-192', 192, 0), ('icon-512', 512, 0), ('icon-512-maskable', 512, 80), ('apple-touch-icon', 180, 14), ('favicon-32', 32, 0)]:
        pg = b.new_page(viewport={'width': size, 'height': size}); pg.set_content(f'<body style="margin:0">{MARK(size, pad)}</body>')
        pg.screenshot(path=f'app/public/icons/{name}.png', omit_background=False); pg.close()
    # Share image: rendered from the live landing hero at 1200x630.
    pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    pg.goto('http://localhost:5180/'); pg.wait_for_timeout(3200)
    pg.wait_for_timeout(300); pg.screenshot(path='app/public/og.png'); b.close()
print('ok')
