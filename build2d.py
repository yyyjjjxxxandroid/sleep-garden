"""Bundle authored sources and generated illustrations into one offline mobile HTML.
Run after editing source.html, world.css, or world.js. Does not modify originals.
"""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent
html = (root / "source.html").read_text()
css = (root / "world.css").read_text()
js = (root / "world.js").read_text()
for name in ("garden-world.png", "kitten.png"):
    data = base64.b64encode((root / "assets" / name).read_bytes()).decode("ascii")
    js = js.replace("assets/" + name, "data:image/png;base64," + data)
html = html.replace('<link rel="stylesheet" href="world.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="world.js"></script>', '<script>\n' + js + '\n</script>')
(root / "index.html").write_text(html)
print(f"Built offline mobile HTML: {root / 'index.html'} ({len(html.encode()) / 1024 / 1024:.1f} MB)")
