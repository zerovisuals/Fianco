# Side-by-side render of piece sets on the Paper board.
from playwright.sync_api import sync_playwright
sets = ['chessnut', 'fantasy', 'spatial', 'celtic', 'merida', 'mpchess', 'papercut', 'cburnett']
fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R'
html = '<body style="margin:0;padding:16px;background:#fff;font:13px sans-serif;display:grid;grid-template-columns:repeat(3,320px);gap:18px">'
for s in sets:
    html += f'<div><div style="margin-bottom:6px">{s}</div><div style="display:grid;grid-template-columns:repeat(8,40px)">'
    for r, row in enumerate(fen.split('/')):
        f = 0
        for ch in row:
            if ch.isdigit():
                for _ in range(int(ch)): html += f'<div style="height:40px;background:{"#cfcdc6" if (r+f)%2 else "#f3f2ee"}"></div>'; f += 1
            else:
                c = 'w' if ch.isupper() else 'b'
                html += f'<div style="height:40px;background:{"#cfcdc6" if (r+f)%2 else "#f3f2ee"}"><img src="http://localhost:5180/pieces/{s}/{c}{ch.upper()}.svg" style="width:40px;height:40px"></div>'; f += 1
    html += '</div></div>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1040, 'height': 1180}, device_scale_factor=1)
    pg.set_content(html); pg.wait_for_timeout(1500); pg.screenshot(path='brand/site-png/pieces-compare.png', full_page=True); b.close()
